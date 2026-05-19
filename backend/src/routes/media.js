import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
  secure: true,
});

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType,
        transformation: options.transformation,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'talklight/avatars',
      resourceType: 'image',
      transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
    });

    const avatarUrl = result.secure_url;
    await prisma.user.update({ where: { id: req.userId }, data: { avatarUrl } });

    res.json({ avatarUrl });
  } catch (error) {
    next(error);
  }
});

router.post('/init', authMiddleware, async (_req, res) => {
  res.json({ message: 'Direct upload to Cloudinary' });
});

router.post('/image', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'talklight/media',
      resourceType: 'image',
      transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto:70' }],
    });

    const thumbnailResult = await uploadToCloudinary(req.file.buffer, {
      folder: 'talklight/thumbnails',
      resourceType: 'image',
      transformation: [{ width: 200, height: 200, crop: 'fill', quality: 'auto:60' }],
    });

    res.json({
      mediaUrl: result.secure_url,
      mediaType: 'image',
      mediaThumbnailUrl: thumbnailResult.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/audio', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'talklight/audio',
      resourceType: 'video',
    });

    res.json({
      mediaUrl: result.secure_url,
      mediaType: 'audio',
      publicId: result.public_id,
      duration: Math.round(result.duration || 0),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
