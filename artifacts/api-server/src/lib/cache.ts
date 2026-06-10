import { createClient, type RedisClientType } from "redis";
import logger from "./logger.js";

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

type MemoryEntry = { value: string; expiresAt: number };

export function createMemoryCacheStore(clock: () => number = () => Date.now()): CacheStore {
  const entries = new Map<string, MemoryEntry>();

  return {
    async get(key: string): Promise<string | null> {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= clock()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      entries.set(key, { value, expiresAt: clock() + ttlSeconds * 1_000 });
    },
  };
}

export function createRedisCacheStore(redisUrl: string): CacheStore {
  let clientPromise: Promise<RedisClientType> | null = null;

  async function client(): Promise<RedisClientType> {
    if (!clientPromise) {
      const next = createClient({ url: redisUrl }) as RedisClientType;
      next.on("error", (err) => logger.warn({ err }, "Redis cache error"));
      clientPromise = next.connect().then(() => next);
    }
    return clientPromise;
  }

  return {
    async get(key: string): Promise<string | null> {
      try {
        return await (await client()).get(key);
      } catch (err) {
        logger.warn({ err, key }, "Redis cache get failed");
        return null;
      }
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      try {
        await (await client()).setEx(key, ttlSeconds, value);
      } catch (err) {
        logger.warn({ err, key }, "Redis cache set failed");
      }
    },
  };
}

let appCache: CacheStore | null = null;

export function getAppCache(): CacheStore {
  if (!appCache) {
    appCache = process.env.REDIS_URL ? createRedisCacheStore(process.env.REDIS_URL) : createMemoryCacheStore();
  }
  return appCache;
}

export async function getJsonCache<T>(key: string, cache: CacheStore = getAppCache()): Promise<T | null> {
  const raw = await cache.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, key }, "JSON cache parse failed");
    return null;
  }
}

export async function setJsonCache<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  cache: CacheStore = getAppCache(),
): Promise<void> {
  await cache.set(key, JSON.stringify(value), ttlSeconds);
}
