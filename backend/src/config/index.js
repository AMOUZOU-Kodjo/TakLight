import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  socketPath: process.env.VITE_SOCKET_PATH || '/socket.io',

  databaseUrl: process.env.DATABASE_URL || '',

  redisUrl: process.env.REDIS_URL || '',
  useRedis: process.env.USE_REDIS === 'true',

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: '15m',
  refreshSecret: process.env.REFRESH_SECRET || 'dev-refresh-secret-change-me',
  refreshExpiresIn: '7d',

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
};
