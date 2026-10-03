import { EventEmitter } from "node:events";

/**
 * In-process social event bus. Mutating routes (e.g. posting a community message)
 * emit an event; the social WebSocket server is the listener and pushes it to the
 * authorized connected clients. Channel-scoped so delivery can be membership-gated.
 *
 * Single-instance today (vertical scale). To go horizontal, back this with Redis
 * pub/sub so an event emitted on one instance reaches sockets on the others — the
 * emit/onSocialEvent surface is intentionally small to make that swap isolated.
 */
export type SocialEvent = { type: "community:message"; channelId: number };

const emitter = new EventEmitter();
// One listener per attached WS server; raise the cap so multiple test/server
// instances don't trip the default max-listeners warning.
emitter.setMaxListeners(0);

export function emitSocialEvent(event: SocialEvent): void {
  emitter.emit("event", event);
}

export function onSocialEvent(listener: (event: SocialEvent) => void): () => void {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
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
