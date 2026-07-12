import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import * as z from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Ensure documents folder exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for PDF and Image uploads (Insurance, PUC, etc.)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files (jpg, png) are allowed'));
    }
  }
});

// Helper for activity logging
async function logActivity(userId: string, userEmail: string, action: string, details: string) {
  try {
    await prisma.activityLog.create({
      data: { userId, userEmail, action, details }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Validation schemas
const vehicleSchema = z.object({
  registrationNumber: z.string()
    .min(3, 'Registration number must be at least 3 characters')
    .max(15, 'Registration number cannot exceed 15 characters')
    .regex(/^[A-Z0-9-]+$/, 'Registration must be uppercase alphanumeric and dashes only'),
  name: z.string().min(1, 'Vehicle Name is required'),
  type: z.string().min(1, 'Type is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  year: z.number().int().min(1950, 'Year must be after 1950').max(new Date().getFullYear() + 1, 'Invalid Year'),
  fuelType: z.string().min(1, 'Fuel Type is required'),
  loadCapacity: z.number().positive('Load capacity must be positive'),
  odometer: z.number().nonnegative('Odometer must be non-negative'),
  acquisitionCost: z.number().nonnegative('Acquisition cost must be non-negative'),
  status: z.enum(['Available', 'On Trip', 'In Shop', 'Retired', 'Reserved', 'Breakdown']),
  region: z.string().min(1, 'Region is required'),
});

// GET /api/vehicles - paginated vehicle list
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { search, status, type, sortBy = 'createdAt', sortOrder = 'desc', page = '1', limit = '10' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Build filters
  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (type) {
    where.type = type;
  }
  if (search) {
    where.OR = [
      { registrationNumber: { contains: search as string } },
      { name: { contains: search as string } },
      { manufacturer: { contains: search as string } },
    ];
  }

  try {
    const total = await prisma.vehicle.count({ where });
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { [sortBy as string]: sortOrder as string },
      skip,
      take: limitNum
    });

    return res.json({
      vehicles,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// GET /api/vehicles/assignable - Shared endpoint for trip/dispatch pickers (excludes Retired/In Shop/Breakdown/Reserved/On Trip)
router.get('/assignable', requireAuth, async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: 'Available'
      },
      select: {
        id: true,
        registrationNumber: true,
        name: true,
        type: true,
        loadCapacity: true,
        odometer: true
      },
      orderBy: {
        registrationNumber: 'asc'
      }
    });
    return res.json({ vehicles });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch assignable vehicles' });
  }
});

// GET /api/vehicles/:id - Detail view, including straight-line depreciation and odometer history
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // 1. Calculate straight-line depreciation
    // Assumes 10 year lifespan, 10% salvage value
    const currentYear = new Date().getFullYear();
    const age = Math.max(0, currentYear - vehicle.year);
    const lifespan = 10;
    const salvageRate = 0.1;
    const salvageValue = vehicle.acquisitionCost * salvageRate;
    const totalDepreciable = vehicle.acquisitionCost * (1 - salvageRate);
    const annualDepreciation = totalDepreciable / lifespan;
    const currentValue = Math.max(salvageValue, vehicle.acquisitionCost - (age * annualDepreciation));

    // 2. Fetch Odometer History Points from Fuel Logs and Completed Trips
    const fuelLogs = await prisma.fuelLog.findMany({
      where: { vehicleId: id },
      orderBy: { date: 'asc' },
      select: { date: true, odometer: true }
    });

    const completedTrips = await prisma.trip.findMany({
      where: { assignedVehicleId: id, status: 'Completed' },
      orderBy: { updatedAt: 'asc' },
      select: { updatedAt: true, actualDistance: true, plannedDistance: true }
    });

    // Create sorted timeline of odometer readings
    const odometerHistory: { date: string; odometer: number; source: string }[] = [];
    
    // Add initial odometer point
    odometerHistory.push({
      date: vehicle.createdAt.toLocaleDateString(),
      odometer: vehicle.odometer - (fuelLogs.reduce((sum, l) => sum + l.odometer, 0) > 0 ? 500 : 0), // rough backtrace
      source: 'Initial Setup'
    });

    // Add fuel log points
    fuelLogs.forEach(log => {
      odometerHistory.push({
        date: log.date.toLocaleDateString(),
        odometer: log.odometer,
        source: 'Fuel Log Refill'
      });
    });

    // Sort combined records chronologically
    odometerHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.json({
      vehicle,
      analytics: {
        ageYears: age,
        annualDepreciation: Math.round(annualDepreciation),
        salvageValue: Math.round(salvageValue),
        currentValue: Math.round(currentValue),
        odometerHistory
      }
    });

  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch vehicle details' });
  }
});

// POST /api/vehicles - Create vehicle
router.post('/', requireAuth, requireRoles(['superadmin', 'fleet_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const result = vehicleSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const { registrationNumber } = result.data;

  try {
    // Unique registration constraint verification
    const existing = await prisma.vehicle.findUnique({
      where: { registrationNumber }
    });

    if (existing) {
      return res.status(409).json({ error: `Vehicle with registration number "${registrationNumber}" already exists.` });
    }

    const vehicle = await prisma.vehicle.create({
      data: result.data
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'CREATE_VEHICLE',
      `Created vehicle ${vehicle.name} (${vehicle.registrationNumber})`
    );

    return res.status(201).json({ vehicle });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/vehicles/:id - Update vehicle
router.put('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const result = vehicleSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const { registrationNumber } = result.data;

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Verify registrationNumber is not taken by another vehicle
    const existing = await prisma.vehicle.findFirst({
      where: {
        registrationNumber,
        id: { not: id }
      }
    });

    if (existing) {
      return res.status(409).json({ error: `Registration number "${registrationNumber}" is already in use by another vehicle.` });
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: result.data
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'UPDATE_VEHICLE',
      `Updated vehicle details for ${updated.name} (${updated.registrationNumber})`
    );

    return res.json({ vehicle: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/vehicles/:id - Delete vehicle
router.delete('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    await prisma.vehicle.delete({ where: { id } });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'DELETE_VEHICLE',
      `Deleted vehicle ${vehicle.name} (${vehicle.registrationNumber})`
    );

    return res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete vehicle due to foreign key constraints.' });
  }
});

// POST /api/vehicles/:id/documents - File uploads for Insurance, PUC, Fitness, Permit
router.post('/:id/documents', requireAuth, requireRoles(['superadmin', 'fleet_manager']), (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'insurance' | 'puc' | 'fitnessCert' | 'permit'

  if (!req.file) {
    return res.status(400).json({ error: 'No document file uploaded' });
  }

  const allowedTypes = ['insurance', 'puc', 'fitnessCert', 'permit'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid document type. Must be insurance, puc, fitnessCert, or permit' });
  }

  const documentUrl = `/uploads/${req.file.filename}`;
  const fieldToUpdate = `${type}Url`;

  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        [fieldToUpdate]: documentUrl
      }
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'UPLOAD_VEHICLE_DOCUMENT',
      `Uploaded ${type} document for vehicle ${vehicle.name} (${vehicle.registrationNumber})`
    );

    return res.json({
      message: 'Document uploaded successfully',
      documentUrl,
      vehicle: updated
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save document details' });
  }
});

export default router;
