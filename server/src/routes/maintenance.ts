import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import * as z from 'zod';

const router = Router();
const prisma = new PrismaClient();

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
const maintenanceSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  type: z.enum(['Preventive', 'Corrective', 'Breakdown']),
  serviceDate: z.string().transform(val => new Date(val)),
  workshop: z.string().min(1, 'Workshop name is required'),
  mechanic: z.string().min(1, 'Mechanic name is required'),
  cost: z.number().min(0, 'Cost cannot be negative'),
  parts: z.string().optional().nullable(),
  labour: z.number().min(0, 'Labour cost cannot be negative').optional().nullable(),
  status: z.enum(['Pending', 'Scheduled', 'In Progress', 'Completed', 'Cancelled']),
});

// GET /api/maintenance - Paginated lists supporting search, type/status filter
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { search, status, type, sortBy = 'createdAt', sortOrder = 'desc', page = '1', limit = '10' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { workshop: { contains: search as string } },
      { mechanic: { contains: search as string } },
      { parts: { contains: search as string } },
      {
        vehicle: {
          registrationNumber: { contains: search as string }
        }
      }
    ];
  }

  try {
    const total = await prisma.maintenanceRecord.count({ where });
    const records = await prisma.maintenanceRecord.findMany({
      where,
      include: {
        vehicle: {
          select: { id: true, registrationNumber: true, name: true, status: true }
        }
      },
      orderBy: { [sortBy as string]: sortOrder as string },
      skip,
      take: limitNum
    });

    return res.json({
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch maintenance logs' });
  }
});

// GET /api/maintenance/:id - Detail view
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const record = await prisma.maintenanceRecord.findUnique({
      where: { id },
      include: { vehicle: true }
    });

    if (!record) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    return res.json({ record });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch maintenance details' });
  }
});

// Helper: Check if a vehicle has any other active maintenance records (not Completed or Cancelled)
async function hasOtherActiveMaintenance(tx: any, vehicleId: string, currentRecordId?: string) {
  const count = await tx.maintenanceRecord.count({
    where: {
      vehicleId,
      status: { in: ['Pending', 'Scheduled', 'In Progress'] },
      id: currentRecordId ? { not: currentRecordId } : undefined
    }
  });
  return count > 0;
}

// POST /api/maintenance - Create log
router.post('/', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'maintenance_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const result = maintenanceSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const data = result.data;
  const isActive = ['Pending', 'Scheduled', 'In Progress'].includes(data.status);

  try {
    const response = await prisma.$transaction(async (tx) => {
      // 1. Fetch Vehicle
      const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) {
        throw new Error('Vehicle does not exist.');
      }

      // If putting in shop, check if on trip
      if (isActive && vehicle.status === 'On Trip') {
        throw new Error(`Vehicle ${vehicle.registrationNumber} is currently On Trip and cannot be scheduled for maintenance.`);
      }

      // 2. Create Record
      const record = await tx.maintenanceRecord.create({
        data
      });

      // 3. Update Vehicle state to In Shop if active
      if (isActive && vehicle.status !== 'Retired') {
        await tx.vehicle.update({
          where: { id: data.vehicleId },
          data: { status: 'In Shop' }
        });
      }

      // 4. Log Expense if completed
      if (data.status === 'Completed') {
        const totalCost = data.cost + (data.labour || 0);
        await tx.expense.create({
          data: {
            category: 'Maintenance',
            amount: totalCost,
            date: data.serviceDate,
            vehicleId: data.vehicleId
          }
        });
      }

      return record;
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'CREATE_MAINTENANCE',
      `Logged ${data.type} maintenance record for vehicle ID: ${data.vehicleId} (Workshop: ${data.workshop}, Status: ${data.status})`
    );

    return res.status(201).json({ record: response });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to log maintenance.' });
  }
});

// PUT /api/maintenance/:id - Update log
router.put('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'maintenance_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const result = maintenanceSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const data = result.data;
  const newActive = ['Pending', 'Scheduled', 'In Progress'].includes(data.status);

  try {
    const response = await prisma.$transaction(async (tx) => {
      // Fetch original record
      const original = await tx.maintenanceRecord.findUnique({ where: { id } });
      if (!original) throw new Error('Maintenance record not found.');

      const vehicle = await tx.vehicle.findUnique({ where: { id: data.vehicleId } });
      if (!vehicle) throw new Error('Vehicle does not exist.');

      const oldActive = ['Pending', 'Scheduled', 'In Progress'].includes(original.status);

      // Verify trip conflicts
      if (newActive && !oldActive && vehicle.status === 'On Trip') {
        throw new Error(`Vehicle ${vehicle.registrationNumber} is currently On Trip and cannot be placed In Shop.`);
      }

      // 1. Update Record
      const updatedRecord = await tx.maintenanceRecord.update({
        where: { id },
        data
      });

      // 2. Adjust vehicle status based on state changes
      if (newActive && !oldActive && vehicle.status !== 'Retired') {
        // Closed ➔ Active: set In Shop
        await tx.vehicle.update({
          where: { id: data.vehicleId },
          data: { status: 'In Shop' }
        });
      } else if (!newActive && oldActive && vehicle.status === 'In Shop') {
        // Active ➔ Closed (Completed/Cancelled): check other active maintenance logs
        const otherActive = await hasOtherActiveMaintenance(tx, data.vehicleId, id);
        if (!otherActive) {
          await tx.vehicle.update({
            where: { id: data.vehicleId },
            data: { status: 'Available' }
          });
        }
      }

      // 3. Create expense if status newly completed
      if (data.status === 'Completed' && original.status !== 'Completed') {
        const totalCost = data.cost + (data.labour || 0);
        await tx.expense.create({
          data: {
            category: 'Maintenance',
            amount: totalCost,
            date: data.serviceDate,
            vehicleId: data.vehicleId
          }
        });
      }

      return updatedRecord;
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'UPDATE_MAINTENANCE',
      `Updated service log for vehicle ID: ${data.vehicleId} (Workshop: ${data.workshop}, Status: ${data.status})`
    );

    return res.json({ record: response });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to update maintenance.' });
  }
});

// DELETE /api/maintenance/:id - Delete log
router.delete('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'maintenance_manager']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.$transaction(async (tx) => {
      const record = await tx.maintenanceRecord.findUnique({ where: { id } });
      if (!record) throw new Error('Maintenance record not found.');

      const isActive = ['Pending', 'Scheduled', 'In Progress'].includes(record.status);

      // Delete record
      await tx.maintenanceRecord.delete({ where: { id } });

      // If it was active, restore vehicle status if no other active services exist
      if (isActive) {
        const vehicle = await tx.vehicle.findUnique({ where: { id: record.vehicleId } });
        if (vehicle && vehicle.status === 'In Shop') {
          const otherActive = await hasOtherActiveMaintenance(tx, record.vehicleId);
          if (!otherActive) {
            await tx.vehicle.update({
              where: { id: record.vehicleId },
              data: { status: 'Available' }
            });
          }
        }
      }
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'DELETE_MAINTENANCE',
      `Deleted maintenance log entry [ID: ${id}]`
    );

    return res.json({ message: 'Maintenance record deleted successfully.' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to delete maintenance log.' });
  }
});

export default router;
