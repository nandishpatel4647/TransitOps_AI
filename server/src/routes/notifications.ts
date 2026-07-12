import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper to check if a specific message key exists
async function notificationExists(message: string): Promise<boolean> {
  const count = await prisma.notification.count({
    where: { message }
  });
  return count > 0;
}

// Scan and generate compliance warnings dynamically
async function scanComplianceNotifications() {
  const today = new Date();
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(today.getDate() + 30);

  const sevenDaysAhead = new Date();
  sevenDaysAhead.setDate(today.getDate() + 7);

  try {
    // 1. Scan drivers with expiring licenses (<= 30 days)
    const expiringDrivers = await prisma.driver.findMany({
      where: {
        licenseExpiryDate: {
          lte: thirtyDaysAhead,
          gt: today
        }
      }
    });

    for (const driver of expiringDrivers) {
      const diffTime = Math.abs(driver.licenseExpiryDate.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const message = `Driver "${driver.name}" license (${driver.licenseNumber}) expires in ${diffDays} days on ${driver.licenseExpiryDate.toLocaleDateString()}.`;
      
      const exists = await notificationExists(message);
      if (!exists) {
        await prisma.notification.create({
          data: {
            type: 'LICENSE_EXPIRY',
            message,
            read: false
          }
        });
      }
    }

    // 2. Scan drivers with expired licenses
    const expiredDrivers = await prisma.driver.findMany({
      where: {
        licenseExpiryDate: {
          lte: today
        }
      }
    });

    for (const driver of expiredDrivers) {
      const message = `Driver "${driver.name}" license (${driver.licenseNumber}) has EXPIRED. Assigned trips are blocked.`;
      
      const exists = await notificationExists(message);
      if (!exists) {
        await prisma.notification.create({
          data: {
            type: 'LICENSE_EXPIRY',
            message,
            read: false
          }
        });
      }
    }

    // 3. Scan upcoming scheduled maintenance records (<= 7 days)
    const upcomingServices = await prisma.maintenanceRecord.findMany({
      where: {
        status: { in: ['Pending', 'Scheduled'] },
        serviceDate: {
          lte: sevenDaysAhead,
          gte: today
        }
      },
      include: { vehicle: true }
    });

    for (const service of upcomingServices) {
      const diffTime = Math.abs(service.serviceDate.getTime() - today.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const message = `Vehicle ${service.vehicle.registrationNumber} is scheduled for ${service.type} maintenance at "${service.workshop}" in ${diffDays} days (${service.serviceDate.toLocaleDateString()}).`;
      
      const exists = await notificationExists(message);
      if (!exists) {
        await prisma.notification.create({
          data: {
            type: 'MAINTENANCE_DUE',
            message,
            read: false
          }
        });
      }
    }
  } catch (error) {
    console.error('Scan compliance errors:', error);
  }
}

// GET /api/notifications - List notifications after scanning
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Run automated scan
    await scanComplianceNotifications();

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ notifications });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// POST /api/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { read: false },
      data: { read: true }
    });
    return res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

// PUT /api/notifications/:id/read - Mark single as read
router.put('/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });
    return res.json({ notification: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update notification.' });
  }
});

// DELETE /api/notifications/:id - Delete single warning
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.notification.delete({ where: { id } });
    return res.json({ message: 'Notification deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

export default router;
