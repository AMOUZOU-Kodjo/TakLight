import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function generateSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = randomBytes(10);
  for (let i = 0; i < 10; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// POST /api/invitations
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const slug = generateSlug();
    const invitation = await prisma.invitation.create({
      data: { userId: req.userId, slug, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const baseUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const inviteUrl = `${baseUrl}/invite/${invitation.slug}`;

    res.status(201).json({ invitation: { ...invitation, url: inviteUrl } });
  } catch (error) {
    next(error);
  }
});

// GET /api/invitations/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { slug: req.params.slug },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Invitation expired' });
    }

    res.json({ invitation: { slug: invitation.slug, user: invitation.user, expiresAt: invitation.expiresAt } });
  } catch (error) {
    next(error);
  }
});

// POST /api/invitations/:slug/accept
router.post('/:slug/accept', authMiddleware, async (req, res, next) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { slug: req.params.slug },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Invitation expired' });
    }

    if (invitation.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot accept your own invitation' });
    }

    const existingConv = await prisma.conversation.findFirst({
      where: {
        OR: [
          { user1Id: invitation.userId, user2Id: req.userId },
          { user1Id: req.userId, user2Id: invitation.userId },
        ],
      },
    });

    if (existingConv) {
      return res.json({ conversation: existingConv, message: 'Conversation already exists' });
    }

    const conversation = await prisma.conversation.create({
      data: {
        user1Id: invitation.userId,
        user2Id: req.userId,
      },
    });

    res.status(201).json({ conversation });
  } catch (error) {
    next(error);
  }
});

export default router;



