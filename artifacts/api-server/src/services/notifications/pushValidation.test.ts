import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  NotificationPreferencePatch,
  PushSubscriptionBody,
  createPublicPushAgent,
  isPublicPushAddress,
  parsePushEndpoint,
} from "./pushValidation.js";

for (const endpoint of [
  "https://fcm.googleapis.com/fcm/send/synthetic",
  "https://updates.push.services.mozilla.com/wpush/v2/synthetic",
  "https://web.push.apple.com/synthetic",
  "https://wns2-par02p.notify.windows.com/w/?token=synthetic",
])
  assert.equal(parsePushEndpoint(endpoint).protocol, "https:");
for (const endpoint of [
  "http://example.com/push",
  "file:///tmp/push",
  "https://user:pass@example.com/push",
  "https://127.0.0.1/push",
  "https://169.254.169.254/push",
  "https://10.0.0.1/push",
  "https://[::1]/push",
  "https://[0:0:0:0:0:0:0:1]/push",
  "https://[::ffff:7f00:1]/push",
  "https://localhost/push",
  "https://device.local/push",
  "https://service.internal/push",
])
  assert.throws(() => parsePushEndpoint(endpoint), { name: "Error" }, endpoint);
for (const address of [
  "::1",
  "0:0:0:0:0:0:0:1",
  "::ffff:127.0.0.1",
  "::ffff:7f00:1",
  "fd00::1",
  "ff02::1",
  "224.0.0.1",
]) {
  assert.equal(isPublicPushAddress(address), false, address);
}
assert.equal(isPublicPushAddress("8.8.8.8"), true);
assert.equal(isPublicPushAddress("2606:4700:4700::1111"), true);

let lookups = 0;
const agent = await createPublicPushAgent("https://push.example.com/sub", async () => {
  lookups++;
  return [{ address: "8.8.8.8", family: 4 }];
});
const pinnedLookup = agent.options.lookup!;
await new Promise<void>((resolve, reject) => {
  pinnedLookup("push.example.com", { all: false }, (err, address, family) => {
    if (err) {
      reject(err);
      return;
    }
    assert.equal(address, "8.8.8.8");
    assert.equal(family, 4);
    resolve();
  });
});
assert.equal(lookups, 1, "HTTPS connection reuses the already checked DNS address");
agent.destroy();
await assert.rejects(
  createPublicPushAgent("https://push.example.com/sub", async () => [
    { address: "8.8.8.8", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ]),
);
await assert.rejects(
  createPublicPushAgent("https://push.example.com/sub", async () => [
    { address: "::ffff:7f00:1", family: 6 },
  ]),
);
await assert.rejects(createPublicPushAgent("https://push.example.com/sub", async () => []));

const keys = {
  p256dh: Buffer.concat([Buffer.from([4]), randomBytes(64)]).toString("base64url"),
  auth: randomBytes(16).toString("base64url"),
};
assert.equal(
  PushSubscriptionBody.safeParse({ endpoint: "https://example.com/push", keys }).success,
  true,
);
assert.equal(
  PushSubscriptionBody.safeParse({
    endpoint: "https://example.com/push",
    keys: { p256dh: "bad", auth: "bad" },
  }).success,
  false,
);
for (const body of [
  { messages: "false" },
  { goals: null },
  { arbitrary: true },
  { __language: "de" },
]) {
  assert.equal(NotificationPreferencePatch.safeParse(body).success, false);
}
assert.equal(NotificationPreferencePatch.safeParse({ messages: false, goals: true }).success, true);
console.log("push endpoint security and preference validation checks passed");
