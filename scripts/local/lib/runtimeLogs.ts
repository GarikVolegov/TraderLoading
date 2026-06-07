import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./env.js";

export type RuntimeErrorRecord = {
  sourceFile: string;
  timestamp: number;
  name?: string;
  message: string;
  location?: string;
};

type RuntimeErrorPayload = {
  timestamp?: unknown;
  name?: unknown;
  message?: unknown;
  loc?: { file?: unknown; line?: unknown; column?: unknown };
};

const RUNTIME_ERROR_PREFIX = "[RUNTIME_ERROR]";

function extractJsonObject(line: string, jsonStart: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < line.length; index += 1) {
    const char = line[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return line.slice(jsonStart, index + 1);
      }
    }
  }

  return line.slice(jsonStart);
}

function formatLocation(payload: RuntimeErrorPayload): string | undefined {
  const file = typeof payload.loc?.file === "string" ? payload.loc.file : undefined;
  const line = typeof payload.loc?.line === "number" ? payload.loc.line : undefined;
  if (!file) return undefined;
  return line ? `${file}:${line}` : file;
}

export function parseRuntimeErrors(contents: string, sinceMs: number, sourceFile: string): RuntimeErrorRecord[] {
  const errors: RuntimeErrorRecord[] = [];

  for (const line of contents.split(/\r?\n/)) {
    const markerIndex = line.indexOf(RUNTIME_ERROR_PREFIX);
    if (markerIndex < 0) continue;

    const jsonStart = line.indexOf("{", markerIndex + RUNTIME_ERROR_PREFIX.length);
    if (jsonStart < 0) continue;

    try {
      const payload = JSON.parse(extractJsonObject(line, jsonStart)) as RuntimeErrorPayload;
      const timestamp = typeof payload.timestamp === "number" ? payload.timestamp : 0;
      if (timestamp < sinceMs) continue;

      errors.push({
        sourceFile,
        timestamp,
        name: typeof payload.name === "string" ? payload.name : undefined,
        message: typeof payload.message === "string" ? payload.message : "Unknown runtime error",
        location: formatLocation(payload),
      });
    } catch {
      // Ignore malformed log lines; they are not actionable runtime error payloads.
    }
  }

  return errors;
}

export function readRuntimeSessionStart(logDir = path.join(repoRoot, ".local-logs")): number | null {
  const markerPath = path.join(logDir, "runtime-session.json");
  if (!existsSync(markerPath)) return null;

  try {
    const marker = JSON.parse(readFileSync(markerPath, "utf8")) as { startedAtMs?: unknown };
    return typeof marker.startedAtMs === "number" ? marker.startedAtMs : null;
  } catch {
    return null;
  }
}

export function scanRuntimeErrorsSince(sinceMs: number, logDir = path.join(repoRoot, ".local-logs")): RuntimeErrorRecord[] {
  if (!existsSync(logDir)) return [];

  const errors: RuntimeErrorRecord[] = [];
  for (const entry of readdirSync(logDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(err|out)\.log$/.test(entry.name)) continue;
    const filePath = path.join(logDir, entry.name);
    errors.push(...parseRuntimeErrors(readFileSync(filePath, "utf8"), sinceMs, entry.name));
  }

  return errors.sort((left, right) => left.timestamp - right.timestamp);
}
