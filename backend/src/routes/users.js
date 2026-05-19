import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const searchSchema = z.object({
  q: z.string().min(1).max(50),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

router.get('/search', authMiddleware, apiLimiter, async (req, res, next) => {
  try {
    const { q, page, limit } = searchSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { username: { contains: q, mode: 'insensitive' } },
          { id: { not: req.userId } },
          { isActive: true },
        ],
      },
      select: { id: true, username: true, avatarUrl: true, bio: true, lastSeen: true },
      take: limit,
      skip: offset,
    });

    const total = await prisma.user.count({
      where: {
        AND: [
          { username: { contains: q, mode: 'insensitive' } },
          { id: { not: req.userId } },
          { isActive: true },
        ],
      },
    });

    res.json({ users, total, page, hasMore: offset + users.length < total });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, username: true, avatarUrl: true, bio: true, lastSeen: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.put('/me', authMiddleware, async (req, res, next) => {
  try {
    const updateSchema = z.object({
      username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
      bio: z.string().max(500).optional(),
    });

    const { username, bio } = updateSchema.parse(req.body);

    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, id: { not: req.userId } },
      });
      if (existing) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { username, bio },
      select: { id: true, email: true, username: true, avatarUrl: true, bio: true, lastSeen: true, createdAt: true },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;

