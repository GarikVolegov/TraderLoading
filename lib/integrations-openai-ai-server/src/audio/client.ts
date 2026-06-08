import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, unlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toFile } from "openai";
import {
  getOpenAIClient,
  OpenAIIntegrationError,
  readChatAudioData,
  readChatAudioMessage,
  readDeltaAudio,
  readTranscriptionText,
  openai,
  withOpenAIErrorHandling,
} from "../client";

export { openai };

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

type ChatClient = {
  chat: {
    completions: {
      create(params: unknown): Promise<unknown>;
    };
  };
};

type TranscriptionClient = {
  audio: {
    transcriptions: {
      create(params: unknown): Promise<unknown>;
    };
  };
};

type FfmpegOptions = {
  command?: string;
  tempDir?: string;
  timeoutMs?: number;
};

type UnlinkFile = (path: string) => Promise<void>;

const DEFAULT_FFMPEG_TIMEOUT_MS = 30_000;

/**
 * Detect audio format from buffer magic bytes.
 * Supports: WAV, MP3, WebM (Chrome/Firefox), MP4/M4A/MOV (Safari/iOS), OGG
 */
export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";

  // WAV: RIFF....WAVE
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  ) {
    return "wav";
  }
  // WebM: EBML header
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "webm";
  }
  // MP3: ID3 tag or frame sync
  if (
    (buffer[0] === 0xff &&
      (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return "mp3";
  }
  // MP4/M4A/MOV: ....ftyp (Safari/iOS records in these containers)
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return "mp4";
  }
  // OGG: OggS
  if (
    buffer[0] === 0x4f &&
    buffer[1] === 0x67 &&
    buffer[2] === 0x67 &&
    buffer[3] === 0x53
  ) {
    return "ogg";
  }
  return "unknown";
}

function runFfmpeg(
  command: string,
  args: string[],
  timeoutMs: number,
  phase: "availability" | "conversion",
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(
        new OpenAIIntegrationError(
          "ffmpeg_timeout",
          `ffmpeg ${phase} timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);

    child.stderr.on("data", () => {});
    child.stdout.on("data", () => {});

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new OpenAIIntegrationError(
          "ffmpeg_unavailable",
          "ffmpeg is not available on PATH.",
          { cause: error },
        ),
      );
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new OpenAIIntegrationError(
          phase === "availability" ? "ffmpeg_unavailable" : "ffmpeg_failed",
          `ffmpeg ${phase} exited with code ${code}.`,
        ),
      );
    });
  });
}

async function assertFfmpegAvailable(
  command: string,
  timeoutMs: number,
): Promise<void> {
  await runFfmpeg(command, ["-version"], timeoutMs, "availability");
}

function isMissingFileError(error: unknown): boolean {
  return (
    error != null &&
    typeof error === "object" &&
    !Array.isArray(error) &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

export async function cleanupTempFiles(
  paths: string[],
  unlinkFile: UnlinkFile = unlink,
): Promise<void> {
  const failures: unknown[] = [];

  await Promise.all(
    paths.map(async (path) => {
      try {
        await unlinkFile(path);
      } catch (error) {
        if (!isMissingFileError(error)) failures.push({ path, error });
      }
    }),
  );

  if (failures.length > 0) {
    throw new OpenAIIntegrationError(
      "ffmpeg_cleanup_failed",
      "ffmpeg temporary file cleanup failed.",
      { cause: failures },
    );
  }
}

/**
 * Convert any audio/video format to WAV using ffmpeg.
 */
export async function convertToWav(
  audioBuffer: Buffer,
  options: FfmpegOptions = {},
): Promise<Buffer> {
  const command = options.command ?? "ffmpeg";
  const tempDir = options.tempDir ?? tmpdir();
  const timeoutMs = options.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS;
  const inputPath = join(tempDir, `input-${randomUUID()}`);
  const outputPath = join(tempDir, `output-${randomUUID()}.wav`);

  try {
    await assertFfmpegAvailable(command, timeoutMs);
    await writeFile(inputPath, audioBuffer);

    await runFfmpeg(
      command,
      [
        "-i",
        inputPath,
        "-vn",
        "-f",
        "wav",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-acodec",
        "pcm_s16le",
        "-y",
        outputPath,
      ],
      timeoutMs,
      "conversion",
    );

    return await readFile(outputPath);
  } finally {
    await cleanupTempFiles([inputPath, outputPath]);
  }
}

/**
 * Auto-detect and convert audio to OpenAI-compatible format.
 */
export async function ensureCompatibleFormat(
  audioBuffer: Buffer,
  ffmpegOptions?: FfmpegOptions,
): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  const wavBuffer = await convertToWav(audioBuffer, ffmpegOptions);
  return { buffer: wavBuffer, format: "wav" };
}

/** Voice Chat: audio-in, audio-out using gpt-audio. */
export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3",
  client: ChatClient = getOpenAIClient() as unknown as ChatClient,
): Promise<{ transcript: string; audioResponse: Buffer }> {
  return withOpenAIErrorHandling("OpenAI voice chat", async () => {
    const audioBase64 = audioBuffer.toString("base64");
    const response = await client.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice, format: outputFormat },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: { data: audioBase64, format: inputFormat },
            },
          ],
        },
      ],
    });
    const { transcript, audioData } = readChatAudioMessage(
      response,
      "OpenAI voice chat",
    );
    return {
      transcript,
      audioResponse: Buffer.from(audioData, "base64"),
    };
  });
}

/** Streaming Voice Chat for real-time audio responses. */
export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  client: ChatClient = getOpenAIClient() as unknown as ChatClient,
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  const audioBase64 = audioBuffer.toString("base64");
  const stream = await withOpenAIErrorHandling("OpenAI voice chat stream", () =>
    client.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice, format: "pcm16" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: { data: audioBase64, format: inputFormat },
            },
          ],
        },
      ],
      stream: true,
    }),
  );

  return (async function* () {
    for await (const chunk of stream as AsyncIterable<unknown>) {
      const delta = readDeltaAudio(chunk);
      if (!delta) continue;
      if (delta.transcript) {
        yield { type: "transcript", data: delta.transcript };
      }
      if (delta.audioData) {
        yield { type: "audio", data: delta.audioData };
      }
    }
  })();
}

/** Text-to-Speech using gpt-audio. */
export async function textToSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav",
  client: ChatClient = getOpenAIClient() as unknown as ChatClient,
): Promise<Buffer> {
  return withOpenAIErrorHandling("OpenAI text-to-speech", async () => {
    const response = await client.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice, format },
      messages: [
        {
          role: "system",
          content: "You are an assistant that performs text-to-speech.",
        },
        {
          role: "user",
          content: `Repeat the following text verbatim: ${text}`,
        },
      ],
    });
    return Buffer.from(
      readChatAudioData(response, "OpenAI text-to-speech"),
      "base64",
    );
  });
}

/** Streaming Text-to-Speech. */
export async function textToSpeechStream(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  client: ChatClient = getOpenAIClient() as unknown as ChatClient,
): Promise<AsyncIterable<string>> {
  const stream = await withOpenAIErrorHandling(
    "OpenAI text-to-speech stream",
    () =>
      client.chat.completions.create({
        model: "gpt-audio",
        modalities: ["text", "audio"],
        audio: { voice, format: "pcm16" },
        messages: [
          {
            role: "system",
            content: "You are an assistant that performs text-to-speech.",
          },
          {
            role: "user",
            content: `Repeat the following text verbatim: ${text}`,
          },
        ],
        stream: true,
      }),
  );

  return (async function* () {
    for await (const chunk of stream as AsyncIterable<unknown>) {
      const delta = readDeltaAudio(chunk);
      if (delta?.audioData) {
        yield delta.audioData;
      }
    }
  })();
}

/** Speech-to-Text using gpt-4o-mini-transcribe. */
export async function speechToText(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav",
  client: TranscriptionClient = getOpenAIClient() as unknown as TranscriptionClient,
): Promise<string> {
  return withOpenAIErrorHandling("OpenAI speech-to-text", async () => {
    const file = await toFile(audioBuffer, `audio.${format}`);
    const response = await client.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });
    return readTranscriptionText(response, "OpenAI speech-to-text");
  });
}

/** Streaming Speech-to-Text. */
export async function speechToTextStream(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav",
  client: TranscriptionClient = getOpenAIClient() as unknown as TranscriptionClient,
): Promise<AsyncIterable<string>> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  const stream = await withOpenAIErrorHandling(
    "OpenAI speech-to-text stream",
    () =>
      client.audio.transcriptions.create({
        file,
        model: "gpt-4o-mini-transcribe",
        stream: true,
      }),
  );

  return (async function* () {
    for await (const event of stream as AsyncIterable<unknown>) {
      if (
        event != null &&
        typeof event === "object" &&
        !Array.isArray(event) &&
        (event as { type?: unknown }).type === "transcript.text.delta" &&
        typeof (event as { delta?: unknown }).delta === "string"
      ) {
        yield (event as { delta: string }).delta;
      }
    }
  })();
}
