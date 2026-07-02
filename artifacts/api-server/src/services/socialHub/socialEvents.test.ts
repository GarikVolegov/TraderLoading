import assert from "node:assert/strict";

import { emitSocialEvent, onSocialEvent, shouldDeliverToChannelSubscriber } from "./socialEvents.js";

// Delivery is scoped to channels the client has subscribed to (membership having
// been verified at subscribe time). A non-subscriber, or a client with no
// subscriptions at all, must never receive another channel's message events.
assert.equal(
  shouldDeliverToChannelSubscriber(new Set([1, 2]), { type: "community:message", channelId: 2 }),
  true,
);
assert.equal(
  shouldDeliverToChannelSubscriber(new Set([1, 2]), { type: "community:message", channelId: 9 }),
  false,
);
assert.equal(shouldDeliverToChannelSubscriber(undefined, { type: "community:message", channelId: 1 }), false);
assert.equal(shouldDeliverToChannelSubscriber(new Set(), { type: "community:message", channelId: 1 }), false);

// The in-process event bus delivers emitted events to listeners and stops once
// the listener unsubscribes (so a closed WS server detaches cleanly).
{
  const received: number[] = [];
  const off = onSocialEvent((event) => {
    if (event.type === "community:message") received.push(event.channelId);
  });
  emitSocialEvent({ type: "community:message", channelId: 5 });
  emitSocialEvent({ type: "community:message", channelId: 7 });
  off();
  emitSocialEvent({ type: "community:message", channelId: 9 });
  assert.deepEqual(received, [5, 7]);
}

console.log("social events checks passed");
