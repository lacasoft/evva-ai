import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import IORedis from "ioredis";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client!: IORedis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
      keyPrefix: "evva:",
    });
    this.logger.log("Cache connected to Redis");
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Cache failures are non-critical
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      // Ignore
    }
  }

  /** Invalidate all cache for a user */
  async invalidateUser(userId: string): Promise<void> {
    try {
      const keys = await this.client.keys(`evva:user:${userId}:*`);
      if (keys.length > 0) {
        // Remove prefix since keys already include it from the scan
        const cleanKeys = keys.map((k) => k.replace("evva:", ""));
        await this.client.del(...cleanKeys);
      }
    } catch {
      // Ignore
    }
  }
}
