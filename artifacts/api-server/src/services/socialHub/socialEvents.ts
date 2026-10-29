import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { getSharedRedisClient } from "../../lib/redisClient.js";
import logger from "../../lib/logger.js";

/**
 * Social event bus with dual-mode operation:
 * - Single-instance / local dev: fast in-process EventEmitter.
 * - Multi-container production: Redis Pub/Sub backplane so an event emitted
 *   on any container instance instantly reaches WebSockets on all other replicas.
 */
export type SocialEvent = { type: "community:message"; channelId: number };
type WireSocialEvent = SocialEvent & { originId: string };

const PROCESS_ORIGIN_ID = randomUUID();
const REDIS_SOCIAL_CHANNEL = "limen:events:social";

const emitter = new EventEmitter();
// One listener per attached WS server; raise the cap so multiple test/server
// instances don't trip the default max-listeners warning.
emitter.setMaxListeners(0);

let subscriberClient: RedisClientType | null = null;
let subscriberPromise: Promise<RedisClientType | null> | null = null;

async function getSubscriberClient(): Promise<RedisClientType | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (!subscriberPromise) {
    subscriberPromise = (async () => {
      try {
        const client = createClient({ url: redisUrl }) as RedisClientType;
        client.on("error", (err) => logger.warn({ err }, "Redis social subscriber error"));
        await client.connect();
        await client.subscribe(REDIS_SOCIAL_CHANNEL, (message) => {
          try {
            const parsed = JSON.parse(message) as WireSocialEvent;
            // Ignore events published by this exact process instance to avoid duplicate local emits
            if (parsed.originId !== PROCESS_ORIGIN_ID) {
              const { originId: _, ...event } = parsed;
              emitter.emit("event", event);
            }
          } catch (err) {
            logger.warn({ err, message }, "Failed to parse Redis social event");
          }
        });
        subscriberClient = client;
        return client;
      } catch (err) {
        logger.warn({ err }, "Failed to initialize Redis social pub/sub subscriber");
        subscriberPromise = null;
        return null;
      }
    })();
  }
  return subscriberPromise;
}

export function emitSocialEvent(event: SocialEvent): void {
  // Always emit locally first for zero-latency local delivery
  emitter.emit("event", event);

  // Broadcast to other replicas across cluster via Redis Pub/Sub if configured
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    void (async () => {
      try {
        const client = await getSharedRedisClient(redisUrl);
        if (client) {
          const wireEvent: WireSocialEvent = { ...event, originId: PROCESS_ORIGIN_ID };
          await client.publish(REDIS_SOCIAL_CHANNEL, JSON.stringify(wireEvent));
        }
      } catch (err) {
        logger.warn({ err, event }, "Failed to publish social event to Redis");
      }
    })();
  }
}

export function onSocialEvent(listener: (event: SocialEvent) => void): () => void {
  // Lazily connect subscriber if REDIS_URL is configured
  if (process.env.REDIS_URL) {
    void getSubscriberClient();
  }

  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}

export async function closeSocialPubSub(): Promise<void> {
  if (subscriberClient) {
    try {
      await subscriberClient.unsubscribe(REDIS_SOCIAL_CHANNEL);
      await subscriberClient.quit();
    } catch (err) {
      logger.warn({ err }, "Failed to quit Redis social subscriber");
    } finally {
      subscriberClient = null;
      subscriberPromise = null;
    }
  }
}

/**
 * Whether a connected client should receive a channel event. A client only ever
 * subscribes to a channel after its community membership was verified server-side,
 * so membership is implied by presence in the subscribed-channel set — no event is
 * delivered to a non-subscriber. Pure on purpose: this is the leak-safety boundary.
 */
export function shouldDeliverToChannelSubscriber(
  subscribedChannels: Set<number> | undefined,
  event: SocialEvent,
): boolean {
  if (!subscribedChannels) return false;
  if (event.type === "community:message") return subscribedChannels.has(event.channelId);
  return false;
}
