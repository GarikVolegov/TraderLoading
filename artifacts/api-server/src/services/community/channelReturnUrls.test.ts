import assert from "node:assert/strict";
import { channelReturnUrls } from "./channelReturnUrls.js";

for (const base of ["https://app.example", "https://app.example/", "https://app.example/trading/"]) {
  const urls = channelReturnUrls(base, 17, 31);
  const success = new URL(urls.successUrl), cancel = new URL(urls.cancelUrl);
  assert.equal(success.pathname, base.includes("trading") ? "/trading/chat" : "/chat");
  assert.equal(success.searchParams.get("t"), "conversazioni");
  assert.equal(success.searchParams.get("community"), "17");
  assert.equal(success.searchParams.get("channel"), "31");
  assert.equal(success.searchParams.get("unlock"), "success");
  assert.equal(cancel.searchParams.get("unlock"), "cancel");
  assert.equal(cancel.pathname, success.pathname);
}
console.log("channel checkout return URL checks passed");
