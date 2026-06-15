import OpenAI from "openai";
import { EMBEDDING_DIM } from "@workspace/db";

// ─── Embeddings client ──────────────────────────────────────────────────────
// Powers the wiki vector store (semantic search). Same shape as llmClient.ts:
// the OpenAI SDK is used as a plain HTTP client toward an OpenAI-compatible
// /embeddings endpoint. NOTE: OpenRouter and Groq (the chat providers) do NOT
// expose /embeddings, so embeddings have their OWN provider axis.
//
// Default: local Ollama `nomic-embed-text` (768 dim) — free, private, offline.
// Set BRAIN_EMBED_PROVIDER=openai (+ OPENAI_API_KEY) to use text-embedding-3-*.
//
// Everything degrades gracefully: when no provider is configured getEmbeddingClient()
// returns null, ingest stores NULL embeddings, and queryWiki falls back to
// keyword retrieval (the prior behavior).

type Provider = "local" | "openai" | "off";

interface ProviderConfig {
  baseURL: string;
  apiKeyEnv: string;
  defaultModel: string;
  apiKeyOptional?: boolean;
}

const PROVIDERS: Record<Exclude<Provider, "off">, ProviderConfig> = {
  local: {
    baseURL: "http://localhost:11434/v1",
    apiKeyEnv: "OLLAMA_API_KEY",
    defaultModel: "nomic-embed-text",
    apiKeyOptional: true,
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "text-embedding-3-small",
  },
};

const EMBED_BATCH = 64;

let _invalidUntil = 0;
let _client: OpenAI | null = null;
let _model = "";
let _dim = EMBEDDING_DIM;

function resolveProvider(): Provider {
  const raw = (process.env.BRAIN_EMBED_PROVIDER || "").toLowerCase();
  if (raw === "local" || raw === "openai" || raw === "off") return raw as Provider;
  // No explicit setting: default to local only when the chat LLM is also local
  // (so a bare install with no keys stays in keyword-only mode by default).
  return (process.env.BRAIN_LLM_PROVIDER || "").toLowerCase() === "local" ? "local" : "off";
}

export interface EmbeddingClient {
  client: OpenAI;
  model: string;
  dim: number;
}

/** Create (or reuse) the shared embeddings client, or null if disabled/unconfigured. */
export function getEmbeddingClient(): EmbeddingClient | null {
  if (Date.now() < _invalidUntil) return null;
  if (_client) return { client: _client, model: _model, dim: _dim };

  const provider = resolveProvider();
  if (provider === "off") return null;

  const cfg = PROVIDERS[provider];
  const apiKey = process.env[cfg.apiKeyEnv] || (cfg.apiKeyOptional ? "ollama" : undefined);
  if (!apiKey) {
    console.warn(
      `[wiki] ${cfg.apiKeyEnv} non impostata — embeddings disattivati (provider=${provider}), ricerca solo keyword`,
    );
    return null;
  }

  const baseURL = process.env.BRAIN_EMBED_BASE_URL || cfg.baseURL;
  _model = process.env.BRAIN_EMBED_MODEL || cfg.defaultModel;
  _dim = Number(process.env.BRAIN_EMBED_DIM) || EMBEDDING_DIM;
  _client = new OpenAI({ baseURL, apiKey });
  console.log(`[wiki] embeddings pronti (provider=${provider}, model=${_model}, dim=${_dim})`);
  return { client: _client, model: _model, dim: _dim };
}

export function isEmbeddingConfigured(): boolean {
  return resolveProvider() !== "off";
}

/** Mark the provider as unavailable for 5 minutes (backoff on auth/rate errors). */
function markInvalid(): void {
  _invalidUntil = Date.now() + 5 * 60 * 1000;
  _client = null;
}

/**
 * A vector is usable only if it's a numeric array of EXACTLY the column's
 * dimension. A mismatch (provider/model changed without a migration) is dropped
 * so the chunk stays keyword-only rather than corrupting the index or crashing.
 */
export function isValidEmbedding(vec: unknown, dim: number): vec is number[] {
  return Array.isArray(vec) && vec.length === dim && vec.every((n) => typeof n === "number");
}

/**
 * Embed a batch of texts. Returns an array aligned 1:1 with the input where each
 * element is the embedding vector or null (unconfigured, error, or a dimension
 * that doesn't match the DB column — in which case the chunk stays keyword-only).
 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const handle = getEmbeddingClient();
  if (!handle) return texts.map(() => null);

  const out: (number[] | null)[] = new Array(texts.length).fill(null);
  for (let start = 0; start < texts.length; start += EMBED_BATCH) {
    const batch = texts.slice(start, start + EMBED_BATCH).map((t) => t.replace(/\n/g, " ").slice(0, 8000));
    try {
      const res = await handle.client.embeddings.create({ model: handle.model, input: batch });
      for (let i = 0; i < res.data.length; i++) {
        const vec = res.data[i]?.embedding;
        const len = Array.isArray(vec) ? vec.length : 0;
        if (isValidEmbedding(vec, handle.dim)) {
          out[start + i] = vec;
        } else if (len > 0) {
          console.warn(
            `[wiki] embedding dim mismatch: atteso ${handle.dim}, ricevuto ${len} — chunk salvato senza vettore`,
          );
        }
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403 || status === 429) markInvalid();
      console.warn(
        `[wiki] embeddings batch fallito (${start}-${start + batch.length}):`,
        err instanceof Error ? err.message : err,
      );
      // leave this batch as nulls and continue
    }
  }
  return out;
}

/** Convenience for single-text embedding (e.g. a query). Null when unavailable. */
export async function embedText(text: string): Promise<number[] | null> {
  const [vec] = await embedTexts([text]);
  return vec ?? null;
}
