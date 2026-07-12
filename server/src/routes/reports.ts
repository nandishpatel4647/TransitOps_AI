import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/reports/analytics - Consolidated operational and ROI reports
router.get('/analytics', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Fetch active vehicles and associated trips & expenses
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: { not: 'Retired' }
      },
      include: {
        trips: {
          where: { status: 'Completed' }
        },
        expenses: true,
        fuelLogs: true
      }
    });

    // 2. Compute individual vehicle metrics
    const vehiclePerformance = vehicles.map(v => {
      const revenue = v.trips.reduce((sum, t) => sum + t.revenue, 0);
      
      const fuelCost = v.expenses
        .filter(e => e.category === 'Fuel')
        .reduce((sum, e) => sum + e.amount, 0);

      const maintenanceCost = v.expenses
        .filter(e => e.category === 'Maintenance')
        .reduce((sum, e) => sum + e.amount, 0);

      const otherCost = v.expenses
        .filter(e => e.category !== 'Fuel' && e.category !== 'Maintenance')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalExpense = fuelCost + maintenanceCost + otherCost;
      const netProfit = revenue - totalExpense;

      // ROI = (Revenue - (Maintenance + Fuel)) / Acquisition Cost * 100
      const roiNumerator = revenue - (maintenanceCost + fuelCost);
      const roi = v.acquisitionCost > 0 
        ? (roiNumerator / v.acquisitionCost) * 100 
        : 0;

      // Fuel efficiency (mpg) = total distance of completed trips / total fuel consumed
      const completedDistance = v.trips.reduce((sum, t) => sum + (t.actualDistance || t.plannedDistance || 0), 0);
      const totalFuelQuantity = v.fuelLogs.reduce((sum, f) => sum + f.fuelQuantity, 0);
      const fuelEfficiency = totalFuelQuantity > 0 
        ? completedDistance / totalFuelQuantity 
        : 0;

      return {
        vehicleId: v.id,
        registrationNumber: v.registrationNumber,
        name: v.name,
        type: v.type,
        acquisitionCost: v.acquisitionCost,
        revenue,
        fuelCost,
        maintenanceCost,
        otherCost,
        totalExpense,
        netProfit,
        roi,
        fuelEfficiency,
        completedDistance
      };
    });

    // 3. Fetch all expenses to construct category breakdowns
    const allExpenses = await prisma.expense.findMany();
    const categories = ['Fuel', 'Maintenance', 'Toll', 'Parking', 'Repair', 'Insurance', 'Tax', 'Salary', 'Misc'];
    const costDistribution = categories.map(cat => {
      const amount = allExpenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + e.amount, 0);
      return { name: cat, value: amount };
    }).filter(c => c.value > 0); // exclude categories with $0

    // 4. Calculate fleet totals
    const totalRevenue = vehiclePerformance.reduce((sum, v) => sum + v.revenue, 0);
    const totalExpense = vehiclePerformance.reduce((sum, v) => sum + v.totalExpense, 0);
    const totalNetProfit = totalRevenue - totalExpense;

    return res.json({
      vehiclePerformance,
      costDistribution,
      summary: {
        totalRevenue,
        totalExpense,
        totalNetProfit,
        activeVehicles: vehiclePerformance.length
      }
    });
  } catch (error) {
    console.error('Failed to compute analytics:', error);
    return res.status(500).json({ error: 'Failed to generate report analytics.' });
  }
});

export default router;
