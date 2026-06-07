import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export type EnvLoadResult = {
  path: string;
  loaded: string[];
  skipped: string[];
  missing: boolean;
};

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\([nrt"\\$])/g, (_match, char: string) => {
    switch (char) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      default:
        return char;
    }
  });
}

function stripInlineComment(value: string): string {
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = index > 0 ? value[index - 1] : "";

    if ((char === "'" || char === '"') && previous !== "\\") {
      quote = quote === char ? undefined : quote ?? char;
      continue;
    }

    if (char === "#" && quote === undefined) {
      const before = index > 0 ? value[index - 1] : "";
      if (before === "" || /\s/.test(before)) {
        return value.slice(0, index).trimEnd();
      }
    }
  }

  return value.trim();
}

function parseValue(rawValue: string): string {
  const value = stripInlineComment(rawValue);

  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return unescapeDoubleQuoted(value.slice(1, -1));
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseEnvLocal(contents: string): Map<string, string> {
  const entries = new Map<string, string>();
  const normalized = contents.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  for (const [lineIndex, line] of normalized.split("\n").entries()) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trimStart() : trimmed;
    const equalsIndex = withoutExport.indexOf("=");
    if (equalsIndex <= 0) {
      throw new Error(`Invalid .env.local line ${lineIndex + 1}: expected KEY=value`);
    }

    const key = withoutExport.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid .env.local line ${lineIndex + 1}: invalid key "${key}"`);
    }

    entries.set(key, parseValue(withoutExport.slice(equalsIndex + 1).trimStart()));
  }

  return entries;
}

export function loadEnvLocal(envPath = path.join(repoRoot, ".env.local")): EnvLoadResult {
  if (!existsSync(envPath)) {
    return { path: envPath, loaded: [], skipped: [], missing: true };
  }

  const parsed = parseEnvLocal(readFileSync(envPath, "utf8"));
  const loaded: string[] = [];
  const skipped: string[] = [];

  for (const [key, value] of parsed) {
    if (process.env[key] !== undefined) {
      skipped.push(key);
      continue;
    }

    process.env[key] = value;
    loaded.push(key);
  }

  return { path: envPath, loaded, skipped, missing: false };
}

function isDirectRun(): boolean {
  return process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const result = loadEnvLocal();
  if (result.missing) {
    console.log(`.env.local not found at ${result.path}`);
  } else {
    console.log(`Loaded .env.local from ${result.path}`);
    console.log(`Set ${result.loaded.length} variable(s), preserved ${result.skipped.length} existing variable(s).`);
  }
}
