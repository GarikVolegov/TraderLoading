import assert from "node:assert/strict";
import {
  getNotificationLanguage,
  getServerNotificationCopy,
} from "./notificationCopy.js";

assert.equal(getNotificationLanguage("it"), "it");
assert.equal(getNotificationLanguage("EN"), "en");
assert.equal(getNotificationLanguage("unknown"), "it");
assert.equal(getNotificationLanguage(null), "it");

assert.equal(getServerNotificationCopy("it").sessionTitle("Londra"), "Sessione Londra aperta");
assert.equal(getServerNotificationCopy("en").sessionTitle("London"), "London session is open");
assert.equal(getServerNotificationCopy("es").chatBody, "Te ha enviado un mensaje");
assert.equal(getServerNotificationCopy("en").socialFollowBody("Alex"), "Alex started following you");
assert.equal(getServerNotificationCopy("it").socialLikeBody("Alex"), "Alex ha messo like al tuo post");

console.log("server notification copy checks passed");
