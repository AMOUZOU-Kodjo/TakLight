import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

async function requireAdmin(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.get('/stats', authMiddleware, requireAdmin, async (_req, res, next) => {
  try {
    const [totalUsers, activeUsers, totalConversations, totalMessages, newUsersToday, newUsersThisWeek] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    ]);

    const messagesToday = await prisma.message.count({
      where: { sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    const messagesByType = await prisma.message.groupBy({
      by: ['mediaType'],
      _count: true,
    });

    const mediaStats = { text: 0, image: 0, audio: 0 };
    messagesByType.forEach((g) => {
      if (g.mediaType === null) mediaStats.text = g._count;
      else if (g.mediaType === 'image') mediaStats.image = g._count;
      else if (g.mediaType === 'audio') mediaStats.audio = g._count;
    });

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalConversations,
        totalMessages,
        messagesToday,
        newUsersToday,
        newUsersThisWeek,
        mediaStats,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
      search: z.string().optional(),
    });

    const { page, limit, search } = schema.parse(req.query);
    const offset = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          avatarUrl: true,
          bio: true,
          role: true,
          isActive: true,
          lastSeen: true,
          createdAt: true,
          _count: {
            select: {
              conversationsUser1: true,
              conversationsUser2: true,
              messagesSent: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        ...u,
        conversationCount: u._count.conversationsUser1 + u._count.conversationsUser2,
        messageCount: u._count.messagesSent,
        _count: undefined,
      })),
      total,
      page,
      hasMore: offset + users.length < total,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({
      isActive: z.boolean().optional(),
      role: z.enum(['USER', 'ADMIN']).optional(),
    });

    const data = schema.parse(req.body);

    if (data.role && data.role === 'ADMIN') {
      const admin = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
      if (admin?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can assign admin role' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, username: true, email: true, role: true, isActive: true },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

router.get('/conversations', authMiddleware, requireAdmin, async (_req, res, next) => {
  try {
    const schema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(50).default(20),
    });

    const { page, limit } = schema.parse(req.query);
    const offset = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        include: {
          user1: { select: { id: true, username: true, avatarUrl: true } },
          user2: { select: { id: true, username: true, avatarUrl: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.conversation.count(),
    ]);

    res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        user1: c.user1,
        user2: c.user2,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        messageCount: c._count.messages,
        createdAt: c.createdAt,
      })),
      total,
      page,
      hasMore: offset + conversations.length < total,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/conversations/:id/messages', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(50).default(20),
    });

    const { page, limit } = schema.parse(req.query);
    const offset = (page - 1) * limit;

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        user1: { select: { id: true, username: true } },
        user2: { select: { id: true, username: true } },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: req.params.id },
        include: { sender: { select: { id: true, username: true } } },
        orderBy: { sentAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.message.count({ where: { conversationId: req.params.id } }),
    ]);

    res.json({
      conversation: {
        id: conversation.id,
        user1: conversation.user1,
        user2: conversation.user2,
      },
      messages,
      total,
      page,
      hasMore: offset + messages.length < total,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/messages/:id', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    await prisma.message.update({
      where: { id: req.params.id },
      data: { isDeleted: true, content: '[Supprimé par un administrateur]' },
    });
    res.json({ message: 'Message deleted by admin' });
  } catch (error) {
    next(error);
  }
});

router.get('/activity', authMiddleware, requireAdmin, async (_req, res, next) => {
  try {
    const [recentUsers, recentConversations, recentMessages] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, username: true, avatarUrl: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.conversation.findMany({
        include: {
          user1: { select: { id: true, username: true } },
          user2: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.message.findMany({
        include: { sender: { select: { id: true, username: true } } },
        orderBy: { sentAt: 'desc' },
        take: 20,
      }),
    ]);

    res.json({
      recentUsers,
      recentConversations: recentConversations.map((c) => ({
        id: c.id,
        user1: c.user1.username,
        user2: c.user2.username,
        createdAt: c.createdAt,
      })),
      recentMessages: recentMessages.map((m) => ({
        id: m.id,
        sender: m.sender.username,
        content: m.content,
        sentAt: m.sentAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export/users', authMiddleware, requireAdmin, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, username: true, role: true, isActive: true, createdAt: true, lastSeen: true },
      orderBy: { createdAt: 'desc' },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=users-export.json');
    res.json(users);
  } catch (error) {
    next(error);
  }
});

export default router;
