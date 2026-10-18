import assert from "node:assert/strict";
import { buildArchiveResources, filterArchiveResources, catalogMilestones, catalogRewardsForMilestone, canUsePersonalArchive, type LibraryContent } from "./archiveResources";
import { isRewardAvailable, type Reward } from "./rewardsLibrary";
import type { WikiSource } from "./archive";

const personal: WikiSource = { id: 42, kind: "text", title: "Private strategy", status: "ready", error: null,
  fileUrl: null, fileName: null, mimeType: null, folderId: 9, extractedText: "private rules", tags: '["edge"]',
  originalUrl: null, fileSize: 0, createdAt: "2026-10-01T00:00:00Z" };
const content: LibraryContent = { id: 42, collectionId: null, type: "mindmap", title: "Risk map", description: "Management",
  bodyMarkdown: "", fileUrl: null, fileName: null, fileSize: 0, mimeType: null, embedUrl: null,
  tags: '["risk"]', requiredLevel: 5, orderIndex: 0, published: true, mindmap: { nodes: [], edges: [] } };
const reward: Reward = { id: "r05-1", milestone: 5, type: "video", title: "Lesson", description: "Lesson summary", thumbnailUrl: "", url: "https://youtube.com/results?search_query=risk" };
const input = { personal: [personal], contents: [content, { ...content, id: 43, requiredLevel: 10 }, { ...content, id: 44, published: false }], level: 5, rewards: [reward] };
const pro = buildArchiveResources({ ...input, pro: true });
assert.deepEqual(pro.map(r => r.ref), ["wiki:42", "library:42", "reward:r05-1"]);
assert.equal(pro[0].origin, "personal");
if (pro[0].origin === "personal") assert.equal(pro[0].personal, personal);
if (pro[1].origin === "library") {
  assert.equal(pro[1].content, content); // Original mindmap retained, never converted into a private source.
  assert.equal(pro[1].content.mindmap, content.mindmap);
  assert.equal(pro[1].source.kind, "mindmap");
  assert.equal(pro[1].source.readOnly, true);
}
const free = buildArchiveResources({ ...input, pro: false });
assert.deepEqual(free.map(r => r.ref), ["library:42", "reward:r05-1"]); // Cached private rows cannot leak after downgrade.
assert.equal(canUsePersonalArchive(undefined), false);
assert.equal(canUsePersonalArchive(false), false);
assert.equal(canUsePersonalArchive(true), true);
assert.equal(buildArchiveResources({ ...input, level: 4, pro: false }).length, 0);
const filter = { search: "", type: "all" as const, collection: "all" as const, tag: null };
assert.deepEqual(filterArchiveResources(pro, filter, "unlocked").map(r => r.ref), ["library:42", "reward:r05-1"]);
assert.deepEqual(filterArchiveResources(pro, { ...filter, search: "private" }, "all").map(r => r.ref), ["wiki:42"]);
assert.deepEqual(filterArchiveResources(pro, { ...filter, type: "mindmap", tag: "risk" }, "all").map(r => r.ref), ["library:42"]);
assert.equal(free[1].source.unavailable, true);
assert.equal(free[1].source.originalUrl, null);
assert.equal(isRewardAvailable(reward), false);
assert.equal(isRewardAvailable({ ...reward, url: "https://docs.google.com/presentation/d/exampleTradingPlan/edit" }), false);
assert.equal(isRewardAvailable({ ...reward, url: "https://www.cmegroup.com/education/risk.html" }), true);
assert.equal(catalogMilestones([content]).includes(5), true);
const notices = catalogRewardsForMilestone([content], 5);
assert.equal(notices.find(r => r.id === "library:42")?.url, "/wiki?t=unlocked&resource=library%3A42");
console.log("unified archive resources behavior checks passed");
