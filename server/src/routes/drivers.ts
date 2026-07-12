import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import * as z from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for driver license PDF/Image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'license-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// Zod validation schema
const driverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  licenseNumber: z.string().min(3, 'License number is required'),
  licenseCategory: z.string().min(1, 'License category is required'),
  licenseExpiryDate: z.string().transform(val => new Date(val)),
  contactNumber: z.string().min(5, 'Contact number is required'),
  emergencyContact: z.string().min(5, 'Emergency contact details are required'),
  safetyScore: z.number().min(0).max(100, 'Safety score must be between 0 and 100'),
  status: z.enum(['Available', 'On Trip', 'Off Duty', 'Suspended', 'Leave']),
});

// GET /api/drivers - Paginated list of drivers
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { search, status, sortBy = 'createdAt', sortOrder = 'desc', page = '1', limit = '10' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Build filters
  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { name: { contains: search as string } },
      { licenseNumber: { contains: search as string } },
      { contactNumber: { contains: search as string } },
    ];
  }

  try {
    const total = await prisma.driver.count({ where });
    const drivers = await prisma.driver.findMany({
      where,
      orderBy: { [sortBy as string]: sortOrder as string },
      skip,
      take: limitNum
    });

    return res.json({
      drivers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// GET /api/drivers/assignable - Returns drivers who are Available AND have unexpired licenses
router.get('/assignable', requireAuth, async (req, res) => {
  const today = new Date();
  
  try {
    const drivers = await prisma.driver.findMany({
      where: {
        status: 'Available',
        licenseExpiryDate: {
          gt: today
        }
      },
      select: {
        id: true,
        name: true,
        licenseNumber: true,
        licenseCategory: true,
        safetyScore: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    return res.json({ drivers });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch assignable drivers' });
  }
});

// GET /api/drivers/:id - Detail view (with trip history log)
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const driver = await prisma.driver.findUnique({
      where: { id }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Fetch past trips assigned to this driver
    const trips = await prisma.trip.findMany({
      where: { assignedDriverId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedVehicle: {
          select: {
            registrationNumber: true,
            name: true
          }
        }
      }
    });

    return res.json({ driver, trips });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch driver details' });
  }
});

// POST /api/drivers - Create driver
router.post('/', requireAuth, requireRoles(['superadmin', 'fleet_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const result = driverSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const { licenseNumber } = result.data;

  try {
    const existing = await prisma.driver.findUnique({
      where: { licenseNumber }
    });

    if (existing) {
      return res.status(409).json({ error: `Driver with license number "${licenseNumber}" already registered.` });
    }

    const driver = await prisma.driver.create({
      data: result.data
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'CREATE_DRIVER',
      `Registered driver ${driver.name} (License: ${driver.licenseNumber})`
    );

    return res.status(201).json({ driver });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/drivers/:id - Update driver
router.put('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const result = driverSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const { licenseNumber } = result.data;

  try {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Verify licenseNumber is not taken by another driver
    const existing = await prisma.driver.findFirst({
      where: {
        licenseNumber,
        id: { not: id }
      }
    });

    if (existing) {
      return res.status(409).json({ error: `License number "${licenseNumber}" is already registered to another driver.` });
    }

    const updated = await prisma.driver.update({
      where: { id },
      data: result.data
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'UPDATE_DRIVER',
      `Updated driver profile for ${updated.name} (License: ${updated.licenseNumber})`
    );

    return res.json({ driver: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/drivers/:id - Delete driver
router.delete('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    await prisma.driver.delete({ where: { id } });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'DELETE_DRIVER',
      `Deleted driver profile for ${driver.name} (License: ${driver.licenseNumber})`
    );

    return res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete driver. Ensure they have no active trip assignments.' });
  }
});

// POST /api/drivers/:id/license - Upload license document
router.post('/:id/license', requireAuth, requireRoles(['superadmin', 'fleet_manager']), (req, res, next) => {
  upload.single('license')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No license file uploaded' });
  }

  const documentUrl = `/uploads/${req.file.filename}`;

  try {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const updated = await prisma.driver.update({
      where: { id },
      data: {
        licenseUrl: documentUrl
      }
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'UPLOAD_DRIVER_LICENSE',
      `Uploaded license document for driver ${driver.name} (License: ${driver.licenseNumber})`
    );

    return res.json({
      message: 'License document uploaded successfully',
      licenseUrl: documentUrl,
      driver: updated
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save license document path' });
  }
});

export default router;
