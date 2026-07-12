import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles, AuthenticatedRequest } from './middleware/auth';
import dotenv from 'dotenv';
import dashboardRouter from './routes/dashboard';
import vehicleRouter from './routes/vehicles';
import driverRouter from './routes/drivers';
import tripRouter from './routes/trips';
import maintenanceRouter from './routes/maintenance';
import expenseRouter from './routes/expenses';
import reportsRouter from './routes/reports';
import notificationsRouter from './routes/notifications';
import assistantRouter from './routes/assistant';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_12345!';

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// CORS options
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
app.use('/uploads', express.static(uploadDir));

// Helper for activity logging
async function logActivity(userId: string | null, userEmail: string | null, action: string, details: string) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        userEmail,
        action,
        details
      }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// Set up multer for avatar upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, png, webp) are allowed'));
    }
  }
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    await logActivity(user.id, user.email, 'LOGIN', `User ${user.email} logged in successfully`);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        avatarUrl: user.avatarUrl,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  res.clearCookie('token');
  await logActivity(user.id, user.email, 'LOGOUT', `User ${user.email} logged out`);
  return res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        avatarUrl: user.avatarUrl,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Profile endpoints
app.get('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        roleId: true,
        avatarUrl: true,
        createdAt: true,
        role: true
      }
    });
    return res.json({ profile: user });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { name, password } = req.body;
  const user = req.user!;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const updateData: any = { name };

    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      updateData.passwordHash = bcrypt.hashSync(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: { role: true }
    });

    await logActivity(user.id, user.email, 'UPDATE_PROFILE', `User ${user.email} updated profile details`);

    return res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        roleId: updatedUser.roleId,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/profile/avatar', requireAuth, (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No avatar image file provided' });
  }

  const user = req.user!;
  // Save avatar URL relative path
  const avatarUrl = `/uploads/${req.file.filename}`;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
      include: { role: true }
    });

    await logActivity(user.id, user.email, 'UPLOAD_AVATAR', `User ${user.email} uploaded avatar image`);

    return res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        roleId: updatedUser.roleId,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update avatar in database' });
  }
});

// Logs endpoint
app.get('/api/logs', requireAuth, requireRoles(['superadmin', 'fleet_manager']), async (req: AuthenticatedRequest, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            name: true,
            roleId: true
          }
        }
      }
    });
    return res.json({ logs });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Gated admin endpoint example
app.get('/api/admin/stats', requireAuth, requireRoles(['superadmin', 'fleet_manager']), async (req, res) => {
  return res.json({
    message: 'Welcome admin! This is restricted statistical data.',
    stats: {
      timestamp: new Date(),
      systemStatus: 'healthy',
      databaseEngine: 'sqlite'
    }
  });
});

app.use('/api/dashboard', dashboardRouter);
app.use('/api/vehicles', vehicleRouter);
app.use('/api/drivers', driverRouter);
app.use('/api/trips', tripRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/assistant', assistantRouter);

// --- Production: Serve React frontend ---
if (isProduction) {
  const clientDistPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDistPath));

  // SPA catch-all: send index.html for any non-API route
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`TransitOps server listening on port ${PORT} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
});
