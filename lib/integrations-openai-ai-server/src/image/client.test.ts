import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const originalApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const tempRoot = await mkdtemp(join(tmpdir(), "openai-image-test-"));
const imagePath = join(tempRoot, "source.png");
await writeFile(imagePath, Buffer.from("not-a-real-png"));

try {
  const { OpenAIIntegrationError } = await import("../client.js");
  const { editImages, generateImageBuffer } = await import("./client.js");

  await assert.rejects(
    () =>
      generateImageBuffer("draw nothing", "1024x1024", {
        images: { generate: async () => ({ data: [] }) },
      }),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "empty_response",
  );

  await assert.rejects(
    () =>
      editImages([imagePath], "edit nothing", undefined, {
        images: { edit: async () => ({ data: [{ b64_json: 42 }] }) },
      }),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "invalid_response",
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });

  if (originalBaseUrl === undefined) {
    delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  } else {
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = originalBaseUrl;
  }

  if (originalApiKey === undefined) {
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  } else {
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = originalApiKey;
  }
}

console.log("openai image client validation checks passed");
