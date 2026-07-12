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

// Zod validation schemas
const expenseSchema = z.object({
  category: z.enum(['Fuel', 'Maintenance', 'Toll', 'Parking', 'Repair', 'Insurance', 'Tax', 'Salary', 'Misc']),
  amount: z.number().positive('Expense amount must be positive'),
  date: z.string().transform(val => new Date(val)),
  vehicleId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  tripId: z.string().optional().nullable(),
});

const fuelLogSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  driverId: z.string().min(1, 'Driver is required'),
  date: z.string().transform(val => new Date(val)),
  odometer: z.number().nonnegative('Odometer reading cannot be negative'),
  fuelQuantity: z.number().positive('Fuel quantity must be positive'),
  price: z.number().positive('Fuel price must be positive'),
  totalCost: z.number().positive('Total cost must be positive'),
});

// GET /api/expenses - Paginated general expense list
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { category, vehicleId, driverId, search, sortBy = 'date', sortOrder = 'desc', page = '1', limit = '10' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const where: any = {};
  if (category) where.category = category;
  if (vehicleId) where.vehicleId = vehicleId;
  if (driverId) where.driverId = driverId;
  if (search) {
    where.OR = [
      { category: { contains: search as string } },
      {
        vehicle: {
          registrationNumber: { contains: search as string }
        }
      },
      {
        driver: {
          name: { contains: search as string }
        }
      }
    ];
  }

  try {
    const total = await prisma.expense.count({ where });
    const expenses = await prisma.expense.findMany({
      where,
      include: {
        vehicle: { select: { id: true, registrationNumber: true, name: true } },
        driver: { select: { id: true, name: true } },
        trip: { select: { id: true, source: true, destination: true } }
      },
      orderBy: { [sortBy as string]: sortOrder as string },
      skip,
      take: limitNum
    });

    return res.json({
      expenses,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /api/expenses - Create manual general expense
router.post('/', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'financial_analyst']), async (req: AuthenticatedRequest, res: Response) => {
  const result = expenseSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  try {
    const expense = await prisma.expense.create({
      data: result.data
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'CREATE_EXPENSE',
      `Logged $${expense.amount} operational expense under category "${expense.category}"`
    );

    return res.status(201).json({ expense });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create expense entry.' });
  }
});

// DELETE /api/expenses/:id - Delete manual expense
router.delete('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'financial_analyst']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) return res.status(404).json({ error: 'Expense not found.' });

    await prisma.expense.delete({ where: { id } });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'DELETE_EXPENSE',
      `Deleted operational expense ID: ${id} ($${expense.amount}, Category: ${expense.category})`
    );

    return res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete expense entry.' });
  }
});

// GET /api/expenses/summary - Dynamic consolidated operational costs summaries per vehicle
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: { not: 'Retired' } },
      select: {
        id: true,
        registrationNumber: true,
        name: true,
        odometer: true,
        expenses: {
          select: {
            category: true,
            amount: true
          }
        }
      }
    });

    const summary = vehicles.map(v => {
      const fuelCost = v.expenses
        .filter(e => e.category === 'Fuel')
        .reduce((sum, e) => sum + e.amount, 0);

      const maintenanceCost = v.expenses
        .filter(e => e.category === 'Maintenance')
        .reduce((sum, e) => sum + e.amount, 0);

      const otherCost = v.expenses
        .filter(e => e.category !== 'Fuel' && e.category !== 'Maintenance')
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        name: v.name,
        odometer: v.odometer,
        fuelCost,
        maintenanceCost,
        otherCost,
        totalCost: fuelCost + maintenanceCost + otherCost
      };
    });

    return res.json({ summary });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to compute cost summaries.' });
  }
});

// GET /api/fuel - Paginated list of fuel logs
router.get('/fuel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { vehicleId, driverId, sortBy = 'date', sortOrder = 'desc', page = '1', limit = '10' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const where: any = {};
  if (vehicleId) where.vehicleId = vehicleId;
  if (driverId) where.driverId = driverId;

  try {
    const total = await prisma.fuelLog.count({ where });
    const logs = await prisma.fuelLog.findMany({
      where,
      include: {
        vehicle: { select: { id: true, registrationNumber: true, name: true } },
        driver: { select: { id: true, name: true } }
      },
      orderBy: { [sortBy as string]: sortOrder as string },
      skip,
      take: limitNum
    });

    return res.json({
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch fuel logs.' });
  }
});

// POST /api/fuel - Create fuel purchase log & auto-sync General Expense
router.post('/fuel', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'financial_analyst', 'driver']), async (req: AuthenticatedRequest, res: Response) => {
  const result = fuelLogSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const data = result.data;

  try {
    const response = await prisma.$transaction(async (tx) => {
      // 1. Create FuelLog
      const log = await tx.fuelLog.create({
        data
      });

      // 2. Auto-generate General Expense category "Fuel"
      await tx.expense.create({
        data: {
          category: 'Fuel',
          amount: data.totalCost,
          date: data.date,
          vehicleId: data.vehicleId,
          driverId: data.driverId
        }
      });

      return log;
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'CREATE_FUEL_LOG',
      `Logged fuel log for vehicle ID: ${data.vehicleId} (${data.fuelQuantity} gal, $${data.totalCost}). Linked expense auto-created.`
    );

    return res.status(201).json({ log: response });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create fuel log entry.' });
  }
});

// DELETE /api/fuel/:id - Delete fuel purchase log & sync Expense delete
router.delete('/fuel/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'financial_analyst']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.$transaction(async (tx) => {
      const log = await tx.fuelLog.findUnique({ where: { id } });
      if (!log) throw new Error('Fuel log not found.');

      // Delete FuelLog
      await tx.fuelLog.delete({ where: { id } });

      // Find corresponding Fuel expense logged on same date & amount, and delete
      const expense = await tx.expense.findFirst({
        where: {
          category: 'Fuel',
          amount: log.totalCost,
          vehicleId: log.vehicleId,
          driverId: log.driverId
        }
      });

      if (expense) {
        await tx.expense.delete({ where: { id: expense.id } });
      }
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'DELETE_FUEL_LOG',
      `Deleted fuel purchase log ID: ${id} and synchronized general expense.`
    );

    return res.json({ message: 'Fuel purchase log deleted successfully.' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to delete fuel log.' });
  }
});

export default router;
