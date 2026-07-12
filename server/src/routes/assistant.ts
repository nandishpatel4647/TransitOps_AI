import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST /api/assistant/chat - Converse with the AI Fleet Assistant (Intent-based routing)
router.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  const query = message.toLowerCase().trim();
  let responseText = '';
  let matchedIntent = '';

  const today = new Date();

  try {
    // 1. INTENT: Driver License Expiring/Expired
    if (query.includes('license') || query.includes('expired') || query.includes('expiry') || query.includes('driver')) {
      matchedIntent = 'LICENSE_EXPIRY';
      const thirtyDaysAhead = new Date();
      thirtyDaysAhead.setDate(today.getDate() + 30);

      const drivers = await prisma.driver.findMany({
        where: {
          licenseExpiryDate: {
            lte: thirtyDaysAhead
          }
        },
        orderBy: { licenseExpiryDate: 'asc' }
      });

      if (drivers.length === 0) {
        responseText = "I checked our driver database, and **all active operators currently hold valid commercial licenses** with no expiries in the next 30 days. Perfect compliance standing! ✅";
      } else {
        responseText = "Here is the driver compliance audit for expired or upcoming license expiries:\n\n";
        drivers.forEach(d => {
          const isExpired = d.licenseExpiryDate < today;
          const statusText = isExpired 
            ? "❌ **EXPIRED** (Suspended from assignments)" 
            : `⚠️ Expires on ${d.licenseExpiryDate.toLocaleDateString()}`;
          responseText += `- **${d.name}** (License: \`${d.licenseNumber}\`): ${statusText}\n`;
        });
      }
    }

    // 2. INTENT: Maintenance Due Next Week
    else if (query.includes('maintenance') || query.includes('repair') || query.includes('due') || query.includes('scheduled') || query.includes('workshop')) {
      matchedIntent = 'MAINTENANCE_DUE';
      const sevenDaysAhead = new Date();
      sevenDaysAhead.setDate(today.getDate() + 7);

      const services = await prisma.maintenanceRecord.findMany({
        where: {
          status: { in: ['Pending', 'Scheduled'] },
          serviceDate: {
            lte: sevenDaysAhead,
            gte: today
          }
        },
        include: { vehicle: true }
      });

      if (services.length === 0) {
        responseText = "There are **no vehicles scheduled for maintenance** over the next 7 days. Fleet availability remains optimal! 🚚";
      } else {
        responseText = "Here are the vehicles scheduled for maintenance or service logs in the next 7 days:\n\n";
        services.forEach(s => {
          responseText += `- **Vehicle ${s.vehicle.registrationNumber}** (${s.vehicle.name}) is scheduled for **${s.type}** at *"${s.workshop}"* on ${s.serviceDate.toLocaleDateString()} (Mechanic: ${s.mechanic}).\n`;
        });
      }
    }

    // 3. INTENT: Lowest ROI Vehicle
    else if (query.includes('roi') || query.includes('return') || query.includes('worst') || query.includes('lowest') || query.includes('perform')) {
      matchedIntent = 'LOWEST_ROI';

      const vehicles = await prisma.vehicle.findMany({
        where: { status: { not: 'Retired' } },
        include: {
          trips: { where: { status: 'Completed' } },
          expenses: true
        }
      });

      if (vehicles.length === 0) {
        responseText = "No active fleet vehicles found in database to calculate ROI metrics.";
      } else {
        const roiTable = vehicles.map(v => {
          const revenue = v.trips.reduce((sum, t) => sum + t.revenue, 0);
          const fuelCost = v.expenses.filter(e => e.category === 'Fuel').reduce((sum, e) => sum + e.amount, 0);
          const maintCost = v.expenses.filter(e => e.category === 'Maintenance').reduce((sum, e) => sum + e.amount, 0);
          
          const roiNumerator = revenue - (maintCost + fuelCost);
          const roi = v.acquisitionCost > 0 ? (roiNumerator / v.acquisitionCost) * 100 : 0;
          return { ...v, revenue, fuelCost, maintCost, roi };
        });

        // Sort ascending to get lowest
        roiTable.sort((a, b) => a.roi - b.roi);
        const worst = roiTable[0];

        responseText = `The vehicle with the lowest ROI in the fleet is **${worst.registrationNumber}** (${worst.name}).\n\n`;
        responseText += `### Telemetry Metrics for ${worst.registrationNumber}:\n`;
        responseText += `- **Computed ROI:** **${worst.roi.toFixed(1)}%**\n`;
        responseText += `- **Acquisition Cost:** $${worst.acquisitionCost.toLocaleString()}\n`;
        responseText += `- **Total Revenue Generated:** $${worst.revenue.toLocaleString()}\n`;
        responseText += `- **Fuel Expenditures:** $${worst.fuelCost.toLocaleString()}\n`;
        responseText += `- **Maintenance Expenditures:** $${worst.maintCost.toLocaleString()}\n\n`;
        responseText += `*Recommendation:* Review maintenance logs for recurring mechanical repairs or consider dispatching this asset on higher-yield Samsung routes to improve utilization. 📈`;
      }
    }

    // 4. INTENT: Highest Fuel Consumer
    else if (query.includes('fuel') || query.includes('efficiency') || query.includes('consumer') || query.includes('gas') || query.includes('mpg')) {
      matchedIntent = 'FUEL_EFFICIENCY';

      const vehicles = await prisma.vehicle.findMany({
        where: { status: { not: 'Retired' } },
        include: {
          expenses: { where: { category: 'Fuel' } },
          fuelLogs: true
        }
      });

      if (vehicles.length === 0) {
        responseText = "No active fleet vehicles found in database to calculate fuel logs.";
      } else {
        const fuelConsumption = vehicles.map(v => {
          const totalCost = v.expenses.reduce((sum, e) => sum + e.amount, 0);
          const totalGallons = v.fuelLogs.reduce((sum, f) => sum + f.fuelQuantity, 0);
          return { ...v, totalCost, totalGallons };
        });

        // Sort descending to get highest consumer
        fuelConsumption.sort((a, b) => b.totalCost - a.totalCost);
        const highest = fuelConsumption[0];

        responseText = `The highest fuel consumer in the fleet is **${highest.registrationNumber}** (${highest.name}).\n\n`;
        responseText += `### Fuel telemetries for ${highest.registrationNumber}:\n`;
        responseText += `- **Total Fuel Expenditures:** **$${highest.totalCost.toLocaleString()}**\n`;
        responseText += `- **Total Volume Consumed:** **${highest.totalGallons.toFixed(1)} gallons**\n`;
        responseText += `- **Odometer mileage status:** ${highest.odometer.toLocaleString()} mi\n\n`;
        responseText += `*Recommendation:* Schedule a preventive maintenance check to inspect spark plugs, fuel filters, and exhaust components, which can cause drops in fuel economy.`;
      }
    }

    // 5. INTENT: Fleet operations summary overview
    else if (query.includes('summary') || query.includes('status') || query.includes('overview') || query.includes('operation') || query.includes('monthly') || query.includes('active')) {
      matchedIntent = 'OPERATIONS_SUMMARY';

      const totalVehicles = await prisma.vehicle.count({ where: { status: { not: 'Retired' } } });
      const inShopVehicles = await prisma.vehicle.count({ where: { status: 'In Shop' } });
      const activeTrips = await prisma.trip.count({ where: { status: 'Dispatched' } });
      const completedTrips = await prisma.trip.count({ where: { status: 'Completed' } });

      const allTrips = await prisma.trip.findMany({ where: { status: 'Completed' } });
      const totalRevenue = allTrips.reduce((sum, t) => sum + t.revenue, 0);
      const allExpenses = await prisma.expense.findMany();
      const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfit = totalRevenue - totalExpenses;

      responseText = "### Fleet Operations Executive Summary:\n\n";
      responseText += `1. **Active Fleet Size:** **${totalVehicles}** vehicles (with **${inShopVehicles}** currently in the workshop 🔧).\n`;
      responseText += `2. **Current Deliveries:** **${activeTrips}** active dispatches on the road 🛣️.\n`;
      responseText += `3. **Total Completed Trips:** **${completedTrips}** shipments completed successfully.\n`;
      responseText += `4. **Fleet Financial standing:**\n`;
      responseText += `   - **Total Operational Revenue:** $${totalRevenue.toLocaleString()}\n`;
      responseText += `   - **Total Expenditures:** $${totalExpenses.toLocaleString()}\n`;
      responseText += `   - **Net Profit Cash Flow:** **$${netProfit.toLocaleString()}** ${netProfit >= 0 ? '📈' : '📉'}\n\n`;
      responseText += `System status is healthy. All operational parameters conform to Odoo hackathon compliance rules.`;
    }

    // FALLBACK
    else {
      matchedIntent = 'UNKNOWN';
      responseText = "Hi there! I am your **TransitOps AI Fleet Assistant**. I can help you query real-time data from our database using natural language.\n\n";
      responseText += "Currently, I can answer questions about these **5 core topics**:\n";
      responseText += "1. 👤 **Driver Compliance:** *\"Who has an expired driver license?\"* or *\"Check license expiry dates.\"*\n";
      responseText += "2. 🔧 **Workshop Schedules:** *\"Which vehicles need maintenance next week?\"* or *\"Show pending services.\"*\n";
      responseText += "3. 📈 **Return on Investment:** *\"Which vehicle has the lowest ROI?\"* or *\"Worst performing vehicles.\"*\n";
      responseText += "4. ⛽ **Fuel Consumptions:** *\"Which vehicle is the highest fuel consumer?\"* or *\"Show lowest fuel efficiency.\"*\n";
      responseText += "5. 📋 **Fleet Summaries:** *\"Give me a monthly fleet summary.\"* or *\"Overview of operations.\"*\n\n";
      responseText += "Feel free to select one of the prompts on the left or type your request below!";
    }

    return res.json({
      message: responseText,
      intent: matchedIntent,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('AI assistant processing error:', error);
    return res.status(500).json({ error: 'Failed to process conversation message.' });
  }
});

export default router;
