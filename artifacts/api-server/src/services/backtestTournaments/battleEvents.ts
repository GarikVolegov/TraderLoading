import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { getSharedRedisClient } from "../../lib/redisClient.js";
import logger from "../../lib/logger.js";
import type { BattleRoomServerMessage } from "./battleRoomTypes.js";

/**
 * Battle Room event bus with dual-mode operation:
 * - Single-instance / local dev: fast in-process EventEmitter.
 * - Multi-container production: Redis Pub/Sub backplane so live duals, ticks, trades
 *   and emotes are replicated in real-time across all horizontal replicas.
 */
export interface WireBattleEvent {
  roomId: string;
  msg: BattleRoomServerMessage;
  originId: string;
}

const PROCESS_ORIGIN_ID = randomUUID();
const REDIS_BATTLE_CHANNEL = "limen:events:battleroom";

const emitter = new EventEmitter();
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
        client.on("error", (err) => logger.warn({ err }, "Redis battle room subscriber error"));
        await client.connect();
        await client.subscribe(REDIS_BATTLE_CHANNEL, (rawMessage) => {
          try {
            const parsed = JSON.parse(rawMessage) as WireBattleEvent;
            if (parsed.originId !== PROCESS_ORIGIN_ID) {
              emitter.emit("message", parsed.roomId, parsed.msg);
            }
          } catch (err) {
            logger.warn({ err, rawMessage }, "Failed to parse Redis battle event");
          }
        });
        subscriberClient = client;
        return client;
      } catch (err) {
        logger.warn({ err }, "Failed to initialize Redis battle pub/sub subscriber");
        subscriberPromise = null;
        return null;
      }
    })();
  }
  return subscriberPromise;
}

export function publishBattleRoomMessage(roomId: string, msg: BattleRoomServerMessage): void {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    void (async () => {
      try {
        const client = await getSharedRedisClient(redisUrl);
        if (client) {
          const wireEvent: WireBattleEvent = {
            roomId,
            msg,
            originId: PROCESS_ORIGIN_ID,
          };
          await client.publish(REDIS_BATTLE_CHANNEL, JSON.stringify(wireEvent));
        }
      } catch (err) {
        logger.warn({ err, roomId }, "Failed to publish battle event to Redis");
      }
    })();
  }
}

export function onBattleRoomMessage(
  listener: (roomId: string, msg: BattleRoomServerMessage) => void,
): () => void {
  if (process.env.REDIS_URL) {
    void getSubscriberClient();
  }
  emitter.on("message", listener);
  return () => emitter.off("message", listener);
}

export async function closeBattleRoomPubSub(): Promise<void> {
  if (subscriberClient) {
    try {
      await subscriberClient.unsubscribe(REDIS_BATTLE_CHANNEL);
      await subscriberClient.quit();
    } catch (err) {
      logger.warn({ err }, "Failed to quit Redis battle subscriber");
    } finally {
      subscriberClient = null;
      subscriberPromise = null;
    }
  }
}
