import Redis from 'ioredis';
import { config } from '../config/index.js';

class RedisService {
  client = null;
  connected = false;

  constructor() {
    if (config.useRedis && config.redisUrl) {
      this.client = new Redis(config.redisUrl, {
        retryStrategy: (times) => {
          if (times > 5) return null;
          return Math.min(times * 100, 3000);
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis connection error:', err.message);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.connected = true;
      });
    } else {
      console.log('ℹ️  Redis disabled, using in-memory fallback');
    }
  }

  async get(key) {
    if (!this.client || !this.connected) return null;
    return this.client.get(key);
  }

  async set(key, value, ttl) {
    if (!this.client || !this.connected) return;
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key) {
    if (!this.client || !this.connected) return;
    await this.client.del(key);
  }

  async quit() {
    if (this.client && this.connected) {
      await this.client.quit();
    }
  }

  get isAvailable() {
    return this.connected;
  }
}

export const redis = new RedisService();

export const redisKeys = {
  userPresence: (userId) => `user:presence:${userId}`,
  rateLimitIP: (ip, endpoint) => `rate:ip:${ip}:${endpoint}`,
  rateLimitUser: (userId, endpoint) => `rate:user:${userId}:${endpoint}`,
  convRecent: (conversationId) => `conv:${conversationId}:recent`,
};
