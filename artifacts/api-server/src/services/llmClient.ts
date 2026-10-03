import OpenAI from "openai";

// ─── Vision LLM client ──────────────────────────────────────────────────────────
// L'SDK OpenAI viene usato come semplice client HTTP verso provider compatibili
// gratuiti o locali (NON la API OpenAI diretta). Stesso pattern di routes/news.ts
// (Groq). Provider selezionabile via BRAIN_LLM_PROVIDER (default: openrouter).

type Provider = "openrouter" | "groq" | "local";

interface ProviderConfig {
  baseURL: string;
  apiKeyEnv: string;
  defaultModel: string;
  apiKeyOptional?: boolean; // local non richiede chiave reale
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    defaultModel: "meta-llama/llama-3.2-11b-vision-instruct:free",
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
  },
  local: {
    baseURL: "http://localhost:11434/v1",
    apiKeyEnv: "OLLAMA_API_KEY",
    defaultModel: "llama3.2-vision",
    apiKeyOptional: true,
  },
};

let _invalidUntil = 0;
let _client: OpenAI | null = null;
let _visionModel = "";

function resolveProvider(): Provider {
  const raw = (process.env.BRAIN_LLM_PROVIDER || "openrouter").toLowerCase();
  if (raw === "groq" || raw === "local") return raw;
  return "openrouter";
}

/**
 * Bound how long an LLM call may take. The OpenAI SDK defaults to a 600s
 * per-attempt timeout with 2 retries — far past the platform's ~100s request
 * cutoff — so a slow or stuck provider would hang the request and tie up a worker.
 * Defaults (30s, 1 retry) keep timeout*(1+retries) under that cutoff; override via
 * BRAIN_LLM_TIMEOUT_MS / BRAIN_LLM_MAX_RETRIES.
 */
export function resolveLlmTimeoutConfig(
  env: { BRAIN_LLM_TIMEOUT_MS?: string | undefined; BRAIN_LLM_MAX_RETRIES?: string | undefined } = process.env,
): { timeout: number; maxRetries: number } {
  const rawTimeout = Number(env.BRAIN_LLM_TIMEOUT_MS);
  const timeout = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 30_000;
  const rawRetries = Number(env.BRAIN_LLM_MAX_RETRIES);
  const maxRetries = Number.isInteger(rawRetries) && rawRetries >= 0 ? rawRetries : 1;
  return { timeout, maxRetries };
}

export interface VisionClient {
  client: OpenAI;
  model: string;
}

/** Crea (o riusa) il client OpenAI-compatibile condiviso, o null se non configurato. */
function ensureClient(): OpenAI | null {
  if (Date.now() < _invalidUntil) return null;
  if (_client) return _client;

  const provider = resolveProvider();
  const cfg = PROVIDERS[provider];
  const apiKey = process.env[cfg.apiKeyEnv] || (cfg.apiKeyOptional ? "ollama" : undefined);
  if (!apiKey) {
    console.warn(`[brain] ${cfg.apiKeyEnv} non impostata — cervello LLM disattivato (provider=${provider})`);
    return null;
  }

  const baseURL = process.env.BRAIN_LLM_BASE_URL || cfg.baseURL;
  _visionModel = process.env.BRAIN_VISION_MODEL || cfg.defaultModel;
  const { timeout, maxRetries } = resolveLlmTimeoutConfig();
  _client = new OpenAI({ baseURL, apiKey, timeout, maxRetries });
  console.log(`[brain] LLM client pronto (provider=${provider}, vision=${_visionModel})`);
  return _client;
}

/**
 * getVisionClient()
 * -----------------
 * Ritorna il client OpenAI-compatibile configurato + il modello vision da usare,
 * oppure null se il provider non è configurato (degradazione graziosa) o se la
 * chiave è risultata invalida di recente (backoff).
 */
export function getVisionClient(): VisionClient | null {
  const client = ensureClient();
  if (!client) return null;
  return { client, model: _visionModel };
}

/**
 * getTextClient()
 * ---------------
 * Come getVisionClient ma per chiamate solo-testo (estrazione del grafo di
 * conoscenza). Modello selezionabile via BRAIN_TEXT_MODEL; di default usa lo
 * stesso modello vision (che gestisce anche il testo).
 */
export function getTextClient(): VisionClient | null {
  const client = ensureClient();
  if (!client) return null;
  const model = process.env.BRAIN_TEXT_MODEL || _visionModel;
  return { client, model };
}

/** Marca la chiave come invalida per 5 minuti (backoff su 401/429). */
export function markKeyInvalid(): void {
  _invalidUntil = Date.now() + 5 * 60 * 1000;
  _client = null;
}

export function isBrainConfigured(): boolean {
  const provider = resolveProvider();
  const cfg = PROVIDERS[provider];
  return Boolean(process.env[cfg.apiKeyEnv] || cfg.apiKeyOptional);
}
