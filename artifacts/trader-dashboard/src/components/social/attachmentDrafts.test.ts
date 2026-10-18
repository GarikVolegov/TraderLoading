import assert from "node:assert/strict";
import { clearAttachmentDraft, getAttachmentDraft, keepAttachmentDraft } from "./attachmentDrafts";

const original = { type: "file" as const, url: "/api/uploads/chat-files/a.txt", fileName: "a.txt" };
keepAttachmentDraft("account-a", "peer-b", original);
assert.equal(getAttachmentDraft("account-b", "peer-b"), null, "Changing account must not expose another account's pending attachment");
assert.equal(getAttachmentDraft("account-a", "peer-c"), null, "Changing recipient must not reuse the previous recipient's file");
original.fileName = "changed outside the cache";
assert.equal(getAttachmentDraft("account-a", "peer-b")?.fileName, "a.txt");
const read = getAttachmentDraft("account-a", "peer-b")!;
read.url = "/different.txt";
assert.equal(getAttachmentDraft("account-a", "peer-b")?.url, "/api/uploads/chat-files/a.txt");
keepAttachmentDraft("account-a", "peer-b", { type: "file", url: "/api/uploads/chat-files/new.txt" });
clearAttachmentDraft("account-a", "peer-b", "/api/uploads/chat-files/a.txt");
assert.equal(getAttachmentDraft("account-a", "peer-b")?.url, "/api/uploads/chat-files/new.txt", "An old confirmation must not discard a newer attachment");
clearAttachmentDraft("account-a", "peer-b", "/api/uploads/chat-files/new.txt");
assert.equal(getAttachmentDraft("account-a", "peer-b"), null);
