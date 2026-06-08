import OpenAI from "openai";

type Env = Record<string, string | undefined>;

export type OpenAIIntegrationErrorCode =
  | "missing_config"
  | "network_error"
  | "api_error"
  | "empty_response"
  | "invalid_response"
  | "ffmpeg_unavailable"
  | "ffmpeg_timeout"
  | "ffmpeg_failed"
  | "ffmpeg_cleanup_failed";

export class OpenAIIntegrationError extends Error {
  readonly code: OpenAIIntegrationErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: OpenAIIntegrationErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "OpenAIIntegrationError";
    this.code = code;
    this.cause = options?.cause;
  }
}

export function getOpenAIConfig(env: Env = process.env): {
  apiKey: string;
  baseURL: string;
} {
  const baseURL = env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  const apiKey = env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();

  if (!baseURL || !apiKey) {
    throw new OpenAIIntegrationError(
      "missing_config",
      "AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must be set before calling OpenAI.",
    );
  }

  return { apiKey, baseURL };
}

let defaultClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!defaultClient) {
    defaultClient = new OpenAI(getOpenAIConfig());
  }
  return defaultClient;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getOpenAIClient(), prop, receiver);
  },
});

/**
 * withRequestId(requestId)
 * ------------------------
 * Restituisce un client OpenAI arricchito con l'header X-Request-Id.
 * Usare questa factory nelle route/servizi che ricevono il requestId
 * dal contesto HTTP, in modo da correlare i log OpenAI con quelli Express.
 *
 * Esempio:
 *   import { getRequestId } from '@workspace/api-server/lib/logger';
 *   const client = withRequestId(getRequestId());
 *   await client.chat.completions.create({ ... });
 */
export function withRequestId(requestId: string | undefined): OpenAI {
  if (!requestId) return openai;

  return new OpenAI({
    ...getOpenAIConfig(),
    defaultHeaders: {
      "X-Request-Id": requestId,
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function getErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  const code = error.code;
  return typeof code === "string" ? code : undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const status = error.status;
  return typeof status === "number" ? status : undefined;
}

export function normalizeOpenAIError(
  error: unknown,
  operation: string,
): OpenAIIntegrationError {
  if (error instanceof OpenAIIntegrationError) return error;

  const code = getErrorCode(error);
  if (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "EAI_AGAIN"
  ) {
    return new OpenAIIntegrationError(
      "network_error",
      `${operation} failed because the OpenAI request could not reach the network.`,
      { cause: error },
    );
  }

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new OpenAIIntegrationError(
      "network_error",
      `${operation} failed because the OpenAI request could not reach the network.`,
      { cause: error },
    );
  }

  const status = getErrorStatus(error);
  if (status !== undefined) {
    return new OpenAIIntegrationError(
      "api_error",
      `${operation} failed with an OpenAI API response error (${status}).`,
      { cause: error },
    );
  }

  return new OpenAIIntegrationError(
    "invalid_response",
    `${operation} failed while processing the OpenAI response.`,
    { cause: error },
  );
}

export async function withOpenAIErrorHandling<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw normalizeOpenAIError(error, operation);
  }
}

function firstChoice(
  response: unknown,
  operation: string,
): Record<string, unknown> {
  if (!isRecord(response)) {
    throw new OpenAIIntegrationError(
      "invalid_response",
      `${operation} returned a non-object response.`,
    );
  }

  const choices = response.choices;
  if (!Array.isArray(choices)) {
    throw new OpenAIIntegrationError(
      "invalid_response",
      `${operation} returned a response without choices.`,
    );
  }

  if (choices.length === 0) {
    throw new OpenAIIntegrationError(
      "empty_response",
      `${operation} returned no choices.`,
    );
  }

  const choice = choices[0];
  if (!isRecord(choice)) {
    throw new OpenAIIntegrationError(
      "invalid_response",
      `${operation} returned an invalid choice.`,
    );
  }

  return choice;
}

function readChoiceMessage(
  response: unknown,
  operation: string,
): Record<string, unknown> {
  const choice = firstChoice(response, operation);
  const message = choice.message;
  if (!isRecord(message)) {
    throw new OpenAIIntegrationError(
      "invalid_response",
      `${operation} returned a choice without a message.`,
    );
  }
  return message;
}

function readAudioPayload(
  container: Record<string, unknown>,
): Record<string, unknown> | null {
  const audio = container.audio;
  return isRecord(audio) ? audio : null;
}

export function readImageBase64(response: unknown, operation: string): string {
  if (!isRecord(response)) {
    throw new OpenAIIntegrationError(
      "invalid_response",
      `${operation} returned a non-object response.`,
    );
  }

  const data = response.data;
  if (!Array.isArray(data)) {
    throw new OpenAIIntegrationError(
      "invalid_response",
      `${operation} returned a response without image data.`,
    );
  }

  if (data.length === 0) {
    throw new OpenAIIntegrationError(
      "empty_response",
      `${operation} returned no image data.`,
    );
  }

  const firstImage = data[0];
  if (!isRecord(firstImage)) {
    throw new OpenAIIntegrationError(
      "invalid_response",
      `${operation} returned invalid image data.`,
    );
  }

  const base64 = firstImage.b64_json;
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new OpenAIIntegrationError(
      "invalid_response",
      `${operation} returned image data without b64_json.`,
    );
  }

  return base64;
}

export function readChatAudioMessage(
  response: unknown,
  operation: string,
): {
  transcript: string;
  audioData: string;
} {
  const message = readChoiceMessage(response, operation);
  const audio = readAudioPayload(message);
  const transcript =
    (audio && typeof audio.transcript === "string" ? audio.transcript : "") ||
    (typeof message.content === "string" ? message.content : "");
  const audioData = audio && typeof audio.data === "string" ? audio.data : "";

  if (!audioData) {
    throw new OpenAIIntegrationError(
      "empty_response",
      `${operation} returned no audio data.`,
    );
  }

  return { transcript, audioData };
}

export function readChatAudioData(
  response: unknown,
  operation: string,
): string {
  const message = readChoiceMessage(response, operation);
  const audio = readAudioPayload(message);
  const audioData = audio && typeof audio.data === "string" ? audio.data : "";
  if (!audioData) {
    throw new OpenAIIntegrationError(
      "empty_response",
      `${operation} returned no audio data.`,
    );
  }
  return audioData;
}

export function readTranscriptionText(
  response: unknown,
  operation: string,
): string {
  if (
    response != null &&
    typeof response === "object" &&
    !Array.isArray(response) &&
    typeof (response as { text?: unknown }).text === "string"
  ) {
    return (response as { text: string }).text;
  }

  throw new OpenAIIntegrationError(
    "invalid_response",
    `${operation} returned a response without text.`,
  );
}

export function readDeltaAudio(chunk: unknown): {
  transcript?: string;
  audioData?: string;
} | null {
  if (!isRecord(chunk)) return null;
  const choices = chunk.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const choice = choices[0];
  if (!isRecord(choice)) return null;
  const delta = choice.delta;
  if (!isRecord(delta)) return null;
  const audio = readAudioPayload(delta);

  return {
    transcript:
      audio && typeof audio.transcript === "string"
        ? audio.transcript
        : undefined,
    audioData: audio && typeof audio.data === "string" ? audio.data : undefined,
  };
}
