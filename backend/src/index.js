import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import { config } from './config/index.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import conversationRoutes from './routes/conversations.js';
import mediaRoutes from './routes/media.js';
import invitationRoutes from './routes/invitations.js';
import adminRoutes from './routes/admin.js';
import { setupSocketIO } from './socket/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const frontendDist = path.resolve(__dirname, '../../frontend/dist');

const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      const allowed = [config.corsOrigin, undefined];
      if (allowed.includes(origin) || config.nodeEnv === 'production') {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  path: config.socketPath,
  transports: ['websocket', 'polling'],
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => {
      const allowed = [config.corsOrigin, undefined];
      if (allowed.includes(origin) || config.nodeEnv === 'production') {
        cb(null, true);
      } else {
        cb(null, true);
      }
    },
    credentials: true,
  })
);
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/upload', mediaRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

setupSocketIO(io);

const PORT = config.port;

if (config.nodeEnv === 'production') {
  try {
    console.log('Running database migrations...');
    execSync('npx prisma migrate deploy', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

httpServer.listen(PORT, () => {
  console.log(`🚀 TalkLight server running on port ${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}${config.socketPath}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(async () => {
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  });
});

export { io };
