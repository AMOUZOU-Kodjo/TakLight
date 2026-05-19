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
  replyToId: z.string().optional(),
  tempId: z.string().optional(),
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
        replyTo: { include: { sender: { select: { id: true, username: true, avatarUrl: true } } } },
      },
      orderBy: { sentAt: 'desc' },
      take: limit + 1,
    });

    const hasNextPage = messages.length > limit;
    const items = hasNextPage ? messages.slice(0, -1) : messages;

    const filtered = items.filter((m) => {
      if (!m.deletedFor) return true;
      try {
        const deletedFor = JSON.parse(m.deletedFor);
        return !deletedFor.includes(req.userId);
      } catch {
        return true;
      }
    });

    const nextCursor = hasNextPage ? items[items.length - 1].id : undefined;

    await prisma.message.updateMany({
      where: { conversationId: req.params.id, senderId: { not: req.userId }, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ messages: filtered.reverse(), nextCursor, hasNextPage });
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

    const { content, mediaUrl, mediaType, mediaThumbnailUrl, replyToId, tempId } = sendMessageSchema.parse(req.body);

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
        replyToId: replyToId || null,
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
        replyTo: {
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
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
    if (tempId) {
      io.to(req.userId).emit('message:delivered', { messageId: message.id, tempId });
    }

    res.status(201).json({ message, messageId: message.id });
  } catch (error) {
    next(error);
  }
});

// GET /:id/search?q=...
const searchSchema = z.object({
  q: z.string().min(1).max(100),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

router.get('/:id/search', authMiddleware, async (req, res, next) => {
  try {
    const { q, page, limit } = searchSchema.parse(req.query);
    const offset = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          conversationId: req.params.id,
          content: { contains: q, mode: 'insensitive' },
          isDeleted: false,
        },
        include: {
          sender: { select: { id: true, username: true, avatarUrl: true } },
          replyTo: { include: { sender: { select: { id: true, username: true, avatarUrl: true } } } },
        },
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.message.count({
        where: {
          conversationId: req.params.id,
          content: { contains: q, mode: 'insensitive' },
          isDeleted: false,
        },
      }),
    ]);

    res.json({ messages, total, page, hasMore: offset + messages.length < total });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/messages/:messageId', authMiddleware, async (req, res, next) => {
  try {
    const message = await prisma.message.findFirst({
      where: { id: req.params.messageId },
      include: { conversation: { select: { user1Id: true, user2Id: true } } },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const isSender = message.senderId === req.userId;
    const isParticipant = message.conversation.user1Id === req.userId || message.conversation.user2Id === req.userId;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant' });
    }

    const forEveryone = req.query.forEveryone === 'true';

    if (forEveryone && isSender) {
      await prisma.message.update({
        where: { id: req.params.messageId },
        data: { isDeleted: true, content: null, mediaUrl: null, mediaType: null, mediaThumbnailUrl: null },
      });

      const otherUserId = message.conversation.user1Id === req.userId ? message.conversation.user2Id : message.conversation.user1Id;
      io.to(otherUserId).emit('message:deleted', { messageId: req.params.messageId, forEveryone: true });

      res.json({ message: 'Message deleted for everyone' });
    } else {
      const deletedFor = message.deletedFor ? JSON.parse(message.deletedFor) : [];
      if (!deletedFor.includes(req.userId)) {
        deletedFor.push(req.userId);
      }
      await prisma.message.update({
        where: { id: req.params.messageId },
        data: { deletedFor: JSON.stringify(deletedFor) },
      });

      res.json({ message: 'Message deleted for you' });
    }
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

router.post('/:id/batch-delete', authMiddleware, async (req, res, next) => {
  try {
    const { messageIds, forEveryone } = req.body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds must be a non-empty array' });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, OR: [{ user1Id: req.userId }, { user2Id: req.userId }] },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await prisma.message.findMany({
      where: { id: { in: messageIds }, conversationId: req.params.id },
    });

    if (messages.length === 0) {
      return res.status(404).json({ error: 'No messages found' });
    }

    const otherUserId = conversation.user1Id === req.userId ? conversation.user2Id : conversation.user1Id;

    if (forEveryone) {
      const ownMessageIds = messages.filter((m) => m.senderId === req.userId).map((m) => m.id);

      if (ownMessageIds.length === 0) {
        return res.status(403).json({ error: 'Cannot delete others messages for everyone' });
      }

      await prisma.message.updateMany({
        where: { id: { in: ownMessageIds } },
        data: { isDeleted: true, content: null, mediaUrl: null, mediaType: null, mediaThumbnailUrl: null },
      });

      for (const msgId of ownMessageIds) {
        io.to(otherUserId).emit('message:deleted', { messageId: msgId, forEveryone: true });
      }

      res.json({ deleted: ownMessageIds, forEveryone: true });
    } else {
      for (const msg of messages) {
        const deletedFor = msg.deletedFor ? JSON.parse(msg.deletedFor) : [];
        if (!deletedFor.includes(req.userId)) {
          deletedFor.push(req.userId);
        }
        await prisma.message.update({
          where: { id: msg.id },
          data: { deletedFor: JSON.stringify(deletedFor) },
        });
      }

      const allIds = messages.map((m) => m.id);
      res.json({ deleted: allIds, forEveryone: false });
    }
  } catch (error) {
    next(error);
  }
});

export default router;

