import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { createWikiStorage, createWikiStorageFromEnv, isS3ReadyConfig, sha256Hex } = await import("./wikiStorage.js");

assert.equal(isS3ReadyConfig({}), false);
assert.equal(isS3ReadyConfig({ bucket: "brain", endpoint: "https://r2.example", accessKeyId: "a", secretAccessKey: "s" }), true);

const root = await mkdtemp(join(tmpdir(), "wiki-storage-"));
try {
  const storage = createWikiStorage({ kind: "local", rootDir: root, publicBaseUrl: "/api/uploads/wiki" });
  const saved = await storage.put({
    userId: "user-one",
    filename: "Plan Final.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("hello wiki"),
  });

  assert.equal(saved.provider, "local");
  assert.match(saved.key, /^user-one\/\d+-plan-final\.pdf$/);
  assert.match(saved.url, /^\/api\/uploads\/wiki\/user-one\/\d+-plan-final\.pdf$/);
  assert.equal(await readFile(join(root, saved.key), "utf8"), "hello wiki");
  assert.ok(storage.get);
  await assert.rejects(() => storage.get!("../escape.txt"), /Invalid wiki storage key/);
  await assert.rejects(storage.delete("../escape.txt"), /Invalid wiki storage key/);

  await storage.delete(saved.key);
  await assert.rejects(readFile(join(root, saved.key), "utf8"));
} finally {
  await rm(root, { recursive: true, force: true });
}

const s3Calls: Array<{ url: string; method: string; headers: Headers; body?: unknown }> = [];
const s3Storage = createWikiStorage({
  kind: "s3",
  bucket: "brain",
  endpoint: "https://r2.example.test",
  accessKeyId: "access",
  secretAccessKey: "secret",
  region: "auto",
  publicBaseUrl: "https://cdn.example.test/wiki",
  fetchImpl: async (url, init) => {
    s3Calls.push({
      url: String(url),
      method: String(init?.method),
      headers: new Headers(init?.headers),
      body: init?.body,
    });
    return new Response("", { status: 200 });
  },
});

const remote = await s3Storage.put({
  userId: "user/one",
  filename: "My Source.md",
  mimeType: "text/markdown",
  buffer: Buffer.from("remote wiki"),
});

assert.equal(remote.provider, "s3");
assert.match(remote.key, /^user_one\/\d+-my-source\.md$/);
assert.match(remote.url, /^https:\/\/cdn\.example\.test\/wiki\/user_one\/\d+-my-source\.md$/);
assert.equal(s3Calls[0]?.method, "PUT");
assert.match(s3Calls[0]?.url ?? "", /^https:\/\/r2\.example\.test\/brain\/user_one\/\d+-my-source\.md$/);
assert.equal(s3Calls[0]?.headers.get("x-amz-content-sha256"), sha256Hex(Buffer.from("remote wiki")));
assert.match(s3Calls[0]?.headers.get("authorization") ?? "", /^AWS4-HMAC-SHA256 Credential=access\//);

await s3Storage.delete(remote.key);
assert.equal(s3Calls[1]?.method, "DELETE");
assert.match(s3Calls[1]?.headers.get("authorization") ?? "", /^AWS4-HMAC-SHA256 Credential=access\//);

const envStorage = createWikiStorageFromEnv({
  WIKI_STORAGE_PROVIDER: "r2",
  WIKI_STORAGE_BUCKET: "brain",
  WIKI_STORAGE_ENDPOINT: "https://r2.example.test",
  WIKI_STORAGE_ACCESS_KEY_ID: "access",
  WIKI_STORAGE_SECRET_ACCESS_KEY: "secret",
  WIKI_STORAGE_REGION: "auto",
  WIKI_STORAGE_PUBLIC_BASE_URL: "https://cdn.example.test/wiki",
} as NodeJS.ProcessEnv);
assert.ok(envStorage);

console.log("wiki storage checks passed");
