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
const tripSchema = z.object({
  source: z.string().min(1, 'Source location is required'),
  destination: z.string().min(1, 'Destination location is required'),
  stops: z.string().optional().default('[]'), // stringified JSON array
  cargoType: z.string().min(1, 'Cargo type is required'),
  cargoWeight: z.number().positive('Cargo weight must be positive'),
  priority: z.enum(['Low', 'Medium', 'High']),
  customer: z.string().min(1, 'Customer name is required'),
  notes: z.string().optional().nullable(),
  revenue: z.number().positive('Revenue must be positive'),
  plannedDistance: z.number().positive('Planned distance must be positive'),
  assignedVehicleId: z.string().min(1, 'Vehicle assignment is required'),
  assignedDriverId: z.string().min(1, 'Driver assignment is required'),
});

const completionSchema = z.object({
  actualDistance: z.number().positive('Actual distance must be positive'),
  fuelConsumed: z.number().positive('Fuel consumed must be positive'),
  finalOdometer: z.number().positive('Final odometer must be positive'),
});

// GET /api/trips - Paginated lists supporting filters and search
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { search, status, priority, sortBy = 'createdAt', sortOrder = 'desc', page = '1', limit = '10' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const where: any = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { source: { contains: search as string } },
      { destination: { contains: search as string } },
      { customer: { contains: search as string } },
      { cargoType: { contains: search as string } },
    ];
  }

  try {
    const total = await prisma.trip.count({ where });
    const trips = await prisma.trip.findMany({
      where,
      include: {
        assignedVehicle: { select: { id: true, registrationNumber: true, name: true } },
        assignedDriver: { select: { id: true, name: true, licenseNumber: true } }
      },
      orderBy: { [sortBy as string]: sortOrder as string },
      skip,
      take: limitNum
    });

    return res.json({
      trips,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// GET /api/trips/:id - Detail view with activity log timeline
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        assignedVehicle: true,
        assignedDriver: true
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Fetch dynamic timeline logs containing this Trip ID
    const logs = await prisma.activityLog.findMany({
      where: {
        details: {
          contains: id
        }
      },
      include: {
        user: {
          select: { name: true }
        }
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    return res.json({ trip, timeline: logs });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch trip details' });
  }
});

// POST /api/trips - Create trip in Draft state (enforces server-side validations)
router.post('/', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'dispatcher']), async (req: AuthenticatedRequest, res: Response) => {
  const result = tripSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const data = result.data;
  const today = new Date();

  try {
    // 1. Validate Vehicle compliance
    const vehicle = await prisma.vehicle.findUnique({ where: { id: data.assignedVehicleId } });
    if (!vehicle) {
      return res.status(400).json({ error: 'Assigned vehicle does not exist.' });
    }
    if (vehicle.status !== 'Available') {
      return res.status(400).json({ error: `Selected vehicle (${vehicle.registrationNumber}) is currently "${vehicle.status}" and cannot be assigned.` });
    }

    // 2. Validate Driver compliance
    const driver = await prisma.driver.findUnique({ where: { id: data.assignedDriverId } });
    if (!driver) {
      return res.status(400).json({ error: 'Assigned driver does not exist.' });
    }
    if (driver.status !== 'Available') {
      return res.status(400).json({ error: `Selected driver (${driver.name}) is currently "${driver.status}" and cannot be assigned.` });
    }
    if (driver.licenseExpiryDate < today) {
      return res.status(400).json({ error: `Selected driver (${driver.name}) has an expired license.` });
    }

    // 3. Validate Cargo weight limit
    if (data.cargoWeight > vehicle.loadCapacity) {
      return res.status(400).json({ error: `Cargo weight (${data.cargoWeight} kg) exceeds vehicle load capacity (${vehicle.loadCapacity} kg).` });
    }

    // Create Draft trip
    const trip = await prisma.trip.create({
      data: {
        ...data,
        status: 'Draft'
      }
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'CREATE_TRIP',
      `Created trip ${trip.source} -> ${trip.destination} in Draft state [Trip ID: ${trip.id}]`
    );

    return res.status(201).json({ trip });
  } catch (error) {
    console.error('Trip creation error:', error);
    return res.status(500).json({ error: 'Failed to create trip.' });
  }
});

// PUT /api/trips/:id - Edit trip configuration
router.put('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'dispatcher']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const result = tripSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const data = result.data;
  const today = new Date();

  try {
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    if (trip.status !== 'Draft' && trip.status !== 'Approved') {
      return res.status(400).json({ error: 'Cannot modify a trip that has already been dispatched or completed.' });
    }

    // Validate Vehicle if updated
    if (trip.assignedVehicleId !== data.assignedVehicleId) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: data.assignedVehicleId } });
      if (!vehicle) return res.status(400).json({ error: 'Assigned vehicle does not exist.' });
      if (vehicle.status !== 'Available') {
        return res.status(400).json({ error: `Selected vehicle (${vehicle.registrationNumber}) is currently "${vehicle.status}" and cannot be assigned.` });
      }
      if (data.cargoWeight > vehicle.loadCapacity) {
        return res.status(400).json({ error: `Cargo weight (${data.cargoWeight} kg) exceeds vehicle load capacity (${vehicle.loadCapacity} kg).` });
      }
    } else {
      // Vehicle not changed, just check cargo weight against same vehicle
      const vehicle = await prisma.vehicle.findUnique({ where: { id: trip.assignedVehicleId! } });
      if (vehicle && data.cargoWeight > vehicle.loadCapacity) {
        return res.status(400).json({ error: `Cargo weight (${data.cargoWeight} kg) exceeds vehicle load capacity (${vehicle.loadCapacity} kg).` });
      }
    }

    // Validate Driver if updated
    if (trip.assignedDriverId !== data.assignedDriverId) {
      const driver = await prisma.driver.findUnique({ where: { id: data.assignedDriverId } });
      if (!driver) return res.status(400).json({ error: 'Assigned driver does not exist.' });
      if (driver.status !== 'Available') {
        return res.status(400).json({ error: `Selected driver (${driver.name}) is currently "${driver.status}" and cannot be assigned.` });
      }
      if (driver.licenseExpiryDate < today) {
        return res.status(400).json({ error: `Selected driver (${driver.name}) has an expired license.` });
      }
    }

    const updated = await prisma.trip.update({
      where: { id },
      data
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'UPDATE_TRIP',
      `Updated trip details for ${updated.source} -> ${updated.destination} [Trip ID: ${updated.id}]`
    );

    return res.json({ trip: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update trip.' });
  }
});

// DELETE /api/trips/:id - Delete trip
router.delete('/:id', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'dispatcher']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });

    if (trip.status === 'Dispatched' || trip.status === 'Completed') {
      return res.status(400).json({ error: 'Cannot delete a dispatched or completed trip.' });
    }

    await prisma.trip.delete({ where: { id } });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'DELETE_TRIP',
      `Deleted trip from ${trip.source} -> ${trip.destination} [Trip ID: ${trip.id}]`
    );

    return res.json({ message: 'Trip deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete trip.' });
  }
});

// POST /api/trips/:id/approve - Approve draft trip
router.post('/:id/approve', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'dispatcher']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    if (trip.status !== 'Draft') return res.status(400).json({ error: 'Only Draft trips can be approved.' });

    const updated = await prisma.trip.update({
      where: { id },
      data: { status: 'Approved' }
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'APPROVE_TRIP',
      `Approved scheduled trip from ${trip.source} -> ${trip.destination} [Trip ID: ${trip.id}]`
    );

    return res.json({ trip: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to approve trip.' });
  }
});

// POST /api/trips/:id/dispatch - Dispatch trip (Atomic Transaction)
router.post('/:id/dispatch', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'dispatcher']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    // Run all inside a transaction to prevent race conditions on vehicle/driver status changes
    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id },
        include: { assignedVehicle: true, assignedDriver: true }
      });

      if (!trip) throw new Error('Trip not found.');
      if (trip.status !== 'Draft' && trip.status !== 'Approved') {
        throw new Error('Only Draft or Approved trips can be dispatched.');
      }

      // Re-verify vehicle status
      const vehicle = await tx.vehicle.findUnique({ where: { id: trip.assignedVehicleId! } });
      if (!vehicle || vehicle.status !== 'Available') {
        throw new Error(`Vehicle ${vehicle?.registrationNumber || 'unknown'} is no longer Available for dispatch (Status: ${vehicle?.status}).`);
      }

      // Re-verify driver status
      const driver = await tx.driver.findUnique({ where: { id: trip.assignedDriverId! } });
      if (!driver || driver.status !== 'Available') {
        throw new Error(`Driver ${driver?.name || 'unknown'} is no longer Available for dispatch (Status: ${driver?.status}).`);
      }

      // 1. Update trip status to Dispatched
      const updatedTrip = await tx.trip.update({
        where: { id },
        data: { status: 'Dispatched' }
      });

      // 2. Set Vehicle to On Trip
      await tx.vehicle.update({
        where: { id: trip.assignedVehicleId! },
        data: { status: 'On Trip' }
      });

      // 3. Set Driver to On Trip
      await tx.driver.update({
        where: { id: trip.assignedDriverId! },
        data: { status: 'On Trip' }
      });

      return updatedTrip;
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'DISPATCH_TRIP',
      `Dispatched trip ${result.source} -> ${result.destination}. Vehicle and Driver status set to On Trip [Trip ID: ${result.id}]`
    );

    return res.json({ trip: result });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to dispatch trip.' });
  }
});

// POST /api/trips/:id/complete - Complete trip (Atomic Transaction)
router.post('/:id/complete', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'dispatcher']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const validation = completionSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({ error: validation.error.errors[0].message });
  }

  const { actualDistance, fuelConsumed, finalOdometer } = validation.data;

  try {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { assignedVehicle: true, assignedDriver: true }
    });

    if (!trip) return res.status(404).json({ error: 'Trip not found.' });
    if (trip.status !== 'Dispatched') return res.status(400).json({ error: 'Only Dispatched trips can be completed.' });

    // Validate odometer bounds
    if (finalOdometer <= trip.assignedVehicle!.odometer) {
      return res.status(400).json({
        error: `Final odometer (${finalOdometer}) must exceed previous vehicle odometer (${trip.assignedVehicle!.odometer} mi).`
      });
    }

    // Process completion inside transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update trip properties
      const completedTrip = await tx.trip.update({
        where: { id },
        data: {
          status: 'Completed',
          actualDistance,
          fuelConsumed
        }
      });

      // 2. Restore vehicle to Available and update odometer
      await tx.vehicle.update({
        where: { id: trip.assignedVehicleId! },
        data: {
          status: 'Available',
          odometer: finalOdometer
        }
      });

      // 3. Restore driver to Available
      await tx.driver.update({
        where: { id: trip.assignedDriverId! },
        data: { status: 'Available' }
      });

      // 4. Create Fuel Log
      const fuelLogPrice = 3.85; // baseline price
      const totalFuelCost = fuelConsumed * fuelLogPrice;
      
      const fuelLog = await tx.fuelLog.create({
        data: {
          vehicleId: trip.assignedVehicleId!,
          driverId: trip.assignedDriverId!,
          date: new Date(),
          odometer: finalOdometer,
          fuelQuantity: fuelConsumed,
          price: fuelLogPrice,
          totalCost: totalFuelCost
        }
      });

      // 5. Create general operational fuel expense
      await tx.expense.create({
        data: {
          category: 'Fuel',
          amount: totalFuelCost,
          date: new Date(),
          vehicleId: trip.assignedVehicleId!,
          driverId: trip.assignedDriverId!,
          tripId: id
        }
      });

      return completedTrip;
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'COMPLETE_TRIP',
      `Completed trip ${result.source} -> ${result.destination}. Restored vehicle/driver to Available and updated vehicle odometer to ${finalOdometer} [Trip ID: ${result.id}]`
    );

    return res.json({ trip: result });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to complete trip.' });
  }
});

// POST /api/trips/:id/cancel - Cancel dispatched trip (Atomic Transaction)
router.post('/:id/cancel', requireAuth, requireRoles(['superadmin', 'fleet_manager', 'dispatcher']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id } });

      if (!trip) throw new Error('Trip not found.');
      if (trip.status !== 'Dispatched' && trip.status !== 'Draft' && trip.status !== 'Approved') {
        throw new Error('Trips cannot be cancelled from their current status.');
      }

      // 1. Update trip status to Cancelled
      const cancelledTrip = await tx.trip.update({
        where: { id },
        data: { status: 'Cancelled' }
      });

      // 2. Restore vehicle status to Available (if it was active)
      if (trip.status === 'Dispatched') {
        await tx.vehicle.update({
          where: { id: trip.assignedVehicleId! },
          data: { status: 'Available' }
        });

        // 3. Restore driver status to Available
        await tx.driver.update({
          where: { id: trip.assignedDriverId! },
          data: { status: 'Available' }
        });
      }

      return cancelledTrip;
    });

    await logActivity(
      req.user!.id,
      req.user!.email,
      'CANCEL_TRIP',
      `Cancelled trip from ${result.source} -> ${result.destination}. Released vehicle and driver assignments [Trip ID: ${result.id}]`
    );

    return res.json({ trip: result });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to cancel trip.' });
  }
});

export default router;
