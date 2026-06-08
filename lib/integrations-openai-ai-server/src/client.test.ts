import assert from "node:assert/strict";

const originalBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const originalApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

try {
  const {
    OpenAIIntegrationError,
    getOpenAIConfig,
    normalizeOpenAIError,
    readTranscriptionText,
    readImageBase64,
  } = await import("./client.js");

  assert.throws(
    () => getOpenAIConfig(),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "missing_config",
  );

  assert.throws(
    () => readImageBase64({ data: [] }, "image generation"),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "empty_response",
  );

  assert.throws(
    () => readImageBase64({ data: [{ b64_json: 42 }] }, "image generation"),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "invalid_response",
  );

  assert.throws(
    () => readTranscriptionText({ text: 42 }, "speech-to-text"),
    (error) =>
      error instanceof OpenAIIntegrationError &&
      error.code === "invalid_response",
  );

  const networkError = normalizeOpenAIError(
    Object.assign(new Error("fetch failed"), { code: "ECONNRESET" }),
    "image generation",
  );
  assert.equal(networkError.code, "network_error");

  const responseError = normalizeOpenAIError(
    Object.assign(new Error("rate limited"), { status: 429 }),
    "image generation",
  );
  assert.equal(responseError.code, "api_error");
} finally {
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

console.log("openai client validation checks passed");
