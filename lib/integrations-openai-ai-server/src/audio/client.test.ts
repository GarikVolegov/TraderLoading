import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const originalApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const tempRoot = await mkdtemp(join(tmpdir(), "openai-audio-test-"));

try {
  const { OpenAIIntegrationError } = await import("../client.js");
  const { cleanupTempFiles, convertToWav, textToSpeech, voiceChat } =
    await import("./client.js");

  await assert.rejects(
    () =>
      textToSpeech("hello", "alloy", "wav", {
        chat: { completions: { create: async () => ({ choices: [] }) } },
      }),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "empty_response",
  );

  await assert.rejects(
    () =>
      voiceChat(Buffer.from("audio"), "alloy", "wav", "mp3", {
        chat: { completions: { create: async () => ({ choices: [] }) } },
      }),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "empty_response",
  );

  await assert.rejects(
    () =>
      voiceChat(Buffer.from("audio"), "alloy", "wav", "mp3", {
        chat: {
          completions: {
            create: async () => ({
              choices: [{ message: { content: "solo transcript" } }],
            }),
          },
        },
      }),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "empty_response",
  );

  await assert.rejects(
    () =>
      convertToWav(Buffer.from("not-real-audio"), {
        command: "ffmpeg-definitely-not-installed-for-test",
        tempDir: tempRoot,
        timeoutMs: 100,
      }),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "ffmpeg_unavailable",
  );

  assert.deepEqual(await readdir(tempRoot), []);

  const cleanedPaths: string[] = [];

  await assert.rejects(
    () =>
      cleanupTempFiles(["first.tmp", "locked.tmp"], async (path) => {
        if (path === "locked.tmp") throw new Error("file locked");
        cleanedPaths.push(path);
      }),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "ffmpeg_cleanup_failed",
  );

  assert.deepEqual(cleanedPaths, ["first.tmp"]);
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

console.log("openai audio client validation checks passed");
