import assert from "node:assert/strict";
import { parseChatTab, parseSocialLocation, socialHref } from "./chatTabs";

assert.equal(parseChatTab(""), "conversazioni", "Social opens the shared inbox by default");
assert.equal(parseChatTab("?t=social"), "social");
assert.equal(parseChatTab("?t=messaggi"), "conversazioni");
assert.equal(parseChatTab("?t=comunita"), "conversazioni");
assert.equal(parseChatTab("?t=classifica"), "competizioni");
assert.equal(parseChatTab("t=classifica"), "competizioni", "leading ? optional");
assert.equal(parseChatTab("?t=bogus"), "conversazioni");
assert.equal(parseChatTab("?foo=1"), "conversazioni");
assert.equal(parseSocialLocation("?t=messaggi").filter, "private");
assert.equal(parseSocialLocation("?t=comunita").filter, "community");
assert.equal(parseSocialLocation("?t=classifica").competitionView, "xp");
assert.equal(parseSocialLocation("?t=competizioni&vista=percorso&metrica=ts").competitionView, "percorso");
assert.equal(parseSocialLocation("?t=competizioni&vista=percorso&metrica=ts").metric, "ts");
assert.equal(parseSocialLocation("?t=competizioni&vista=wrong&metrica=wrong").competitionView, "torneo");
assert.equal(parseSocialLocation("?t=competizioni&vista=wrong&metrica=wrong").metric, "r");
const channel = parseSocialLocation("?t=conversazioni&community=12&channel=34&unlock=success");
assert.equal(channel.communityId, 12);
assert.equal(channel.channelId, 34);
assert.equal(channel.unlock, "success");
for (const bad of ["-1", "0", "1.5", "1e2", "foo", "9007199254740992"]) {
  assert.equal(parseSocialLocation(`?community=${bad}&channel=34`).communityId, null);
  assert.equal(parseSocialLocation(`?community=${bad}&channel=34`).channelId, null);
}
assert.equal(parseSocialLocation("?channel=34").channelId, null, "orphan channel cannot select a workspace");
const dm = parseSocialLocation(socialHref("conversazioni", { peer: "user/with &?", community: 12, channel: 34 }));
assert.equal(dm.peerId, "user/with &?");
assert.equal(dm.communityId, null, "DM and community cannot both become active");
assert.equal(dm.channelId, null);
assert.equal(parseSocialLocation("?t=social&peer=someone&community=12").peerId, null);
assert.equal(parseSocialLocation("?t=social&peer=someone&community=12").communityId, null);
assert.equal(parseSocialLocation("?unlock=pretend").unlock, null);
assert.equal(socialHref("conversazioni", { peer: null }), "/chat?t=conversazioni");

console.log("chatTabs unit checks passed");
