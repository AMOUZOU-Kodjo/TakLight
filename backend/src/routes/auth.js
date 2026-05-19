import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  const refreshToken = jwt.sign({ userId, jti: v4() }, config.refreshSecret, {
    expiresIn: config.refreshExpiresIn,
  });
  return { accessToken, refreshToken };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, username, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email or username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, avatarUrl: true, bio: true, createdAt: true },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await prisma.session.create({
      data: { userId: user.id, refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await prisma.session.create({
      data: { userId: user.id, refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    setAuthCookies(res, accessToken, refreshToken);

    const { passwordHash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken } });
    }
    clearAuthCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, config.refreshSecret);
    const session = await prisma.session.findUnique({ where: { refreshToken } });

    if (!session || session.expiresAt < new Date()) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

    await prisma.session.delete({ where: { refreshToken } });
    await prisma.session.create({
      data: { userId: decoded.userId, refreshToken: newRefreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    setAuthCookies(res, accessToken, newRefreshToken);
    res.json({ message: 'Token refreshed' });
  } catch (error) {
    clearAuthCookies(res);
    next(error);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, username: true, avatarUrl: true, bio: true, role: true, lastSeen: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;


