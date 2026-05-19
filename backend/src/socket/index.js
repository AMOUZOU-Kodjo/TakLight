import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { redis, redisKeys } from '../lib/redis.js';

export function setupSocketIO(io) {
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth.token;

      if (!token) {
        const cookies = socket.handshake.headers.cookie;
        if (cookies) {
          const parsed = cookie.parse(cookies);
          token = parsed.accessToken;
        }
      }

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return next(new Error('Invalid user'));
      }

      socket.userId = user.id;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    socket.join(userId);

    await redis.set(redisKeys.userPresence(userId), JSON.stringify({ status: 'online', lastSeen: new Date() }), 300);
    io.emit('user:presence', { userId, status: 'online', lastSeen: new Date() });

    socket.on('user:typing', async ({ conversationId, isTyping }) => {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (conversation) {
        const otherUserId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
        io.to(otherUserId).emit('user:typing', { conversationId, userId, isTyping });
      }
    });

    socket.on('message:send', async ({ conversationId, content, mediaId, mediaType, mediaThumbnailUrl, tempId }) => {
      try {
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });

        if (!conversation) return;

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content: content || null,
            mediaUrl: mediaId || null,
            mediaType: mediaType || null,
            mediaThumbnailUrl: mediaThumbnailUrl || null,
          },
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true } },
          },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessage: content || (mediaType === 'image' ? '📷 Photo' : mediaType === 'audio' ? '🎤 Audio' : '📎 File'),
            lastMessageAt: new Date(),
          },
        });

        const otherUserId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
        io.to(otherUserId).emit('message:new', message);
        socket.emit('message:delivered', { messageId: message.id, tempId });
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message:error', { tempId, error: 'Failed to send message' });
      }
    });

    socket.on('message:read', async ({ messageId, conversationId }) => {
      await prisma.message.updateMany({
        where: { id: messageId, conversationId },
        data: { isRead: true, readAt: new Date() },
      });

      const message = await prisma.message.findUnique({ where: { id: messageId } });
      if (message) {
        io.to(message.senderId).emit('message:read', { messageId, userId });
      }
    });

    socket.on('webrtc:offer', ({ target, offer, conversationId }) => {
      io.to(target).emit('webrtc:offer', { offer, from: userId, conversationId });
    });

    socket.on('webrtc:answer', ({ target, answer }) => {
      io.to(target).emit('webrtc:answer', { answer, from: userId });
    });

    socket.on('webrtc:candidate', ({ target, candidate }) => {
      io.to(target).emit('webrtc:candidate', { candidate, from: userId });
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);
      await redis.set(
        redisKeys.userPresence(userId),
        JSON.stringify({ status: 'offline', lastSeen: new Date() }),
        300
      );
      io.emit('user:presence', { userId, status: 'offline', lastSeen: new Date() });
    });
  });
}
