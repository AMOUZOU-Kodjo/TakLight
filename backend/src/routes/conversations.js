import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { io } from '../index.js';
import { redis, redisKeys } from '../lib/redis.js';

const router = Router();

const sendMessageSchema = z.object({
  content: z.string().max(2000).optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  mediaThumbnailUrl: z.string().optional(),
});

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
      include: {
        user1: { select: { id: true, username: true, avatarUrl: true, lastSeen: true } },
        user2: { select: { id: true, username: true, avatarUrl: true, lastSeen: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const result = conversations.map((conv) => {
      const otherUser = conv.user1Id === req.userId ? conv.user2 : conv.user1;
      return {
        id: conv.id,
        otherUser,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
      };
    });

    res.json({ conversations: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/messages', authMiddleware, apiLimiter, async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const cursorSchema = z.object({
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().min(1).max(50).default(20),
    });

    const { cursor, limit } = cursorSchema.parse(req.query);

    const messages = await prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        isDeleted: false,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: limit + 1,
    });

    const hasNextPage = messages.length > limit;
    const items = hasNextPage ? messages.slice(0, -1) : messages;
    const nextCursor = hasNextPage ? items[items.length - 1].id : undefined;

    await prisma.message.updateMany({
      where: { conversationId: req.params.id, senderId: { not: req.userId }, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ messages: items.reverse(), nextCursor, hasNextPage });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/messages', authMiddleware, async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { content, mediaUrl, mediaType, mediaThumbnailUrl } = sendMessageSchema.parse(req.body);

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'Message content or media required' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.userId,
        content: content || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        mediaThumbnailUrl: mediaThumbnailUrl || null,
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        lastMessage: content || (mediaType === 'image' ? '📷 Photo' : mediaType === 'audio' ? '🎤 Audio' : '📎 Fichier'),
        lastMessageAt: new Date(),
      },
    });

    const otherUserId = conversation.user1Id === req.userId ? conversation.user2Id : conversation.user1Id;

    io.to(otherUserId).emit('message:new', message);

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

router.delete('/messages/:id', authMiddleware, async (req, res, next) => {
  try {
    const message = await prisma.message.findFirst({
      where: { id: req.params.id, senderId: req.userId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await prisma.message.update({
      where: { id: req.params.id },
      data: { isDeleted: true, content: 'Message deleted' },
    });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/start', authMiddleware, async (req, res, next) => {
  try {
    const schema = z.object({
      userId: z.string().uuid(),
    });

    const { userId } = schema.parse(req.body);

    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot start conversation with yourself' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingConv = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: req.userId, user2Id: userId },
          { user1Id: userId, user2Id: req.userId },
        ],
      },
    });

    if (existingConv) {
      return res.json({ conversation: existingConv, isNew: false });
    }

    const conversation = await prisma.conversation.create({
      data: {
        user1Id: req.userId,
        user2Id: userId,
      },
    });

    res.status(201).json({ conversation, isNew: true });
  } catch (error) {
    next(error);
  }
});

router.get('/suggestions', authMiddleware, async (req, res, next) => {
  try {
    const existingConvIds = await prisma.conversation.findMany({
      where: { OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
      select: { user1Id: true, user2Id: true },
    });

    const existingUserIds = new Set();
    existingUserIds.add(req.userId);
    existingConvIds.forEach((c) => {
      existingUserIds.add(c.user1Id);
      existingUserIds.add(c.user2Id);
    });

    const suggestions = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(existingUserIds) },
        isActive: true,
      },
      select: { id: true, username: true, avatarUrl: true, bio: true, lastSeen: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({ users: suggestions });
  } catch (error) {
    next(error);
  }
});

export default router;

