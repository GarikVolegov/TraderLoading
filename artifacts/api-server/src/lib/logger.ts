import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

// ─── AsyncLocalStorage per il contesto della richiesta ───────────────────────
export interface RequestContext {
  requestId: string;
  userId?: string;
  method?: string;
  path?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * getRequestId()
 * --------------
 * Helper per recuperare il requestId corrente dall'AsyncLocalStorage.
 * Utile per layer separati (AI, workers) che devono propagare il requestId
 * esplicitamente in chiamate cross-process o log manuali.
 *
 * @returns requestId corrente oppure undefined se fuori contesto HTTP
 */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

// ─── Logger base ─────────────────────────────────────────────────────────────
const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

// ─── Logger proxy: inietta automaticamente requestId da AsyncLocalStorage ────
export const logger = new Proxy(baseLogger, {
  get(target, prop) {
    const method = (target as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof method !== "function") return method;

    return (...args: unknown[]) => {
      const ctx = requestContext.getStore();
      if (!ctx) return (method as Function).apply(target, args);

      // Inietta il contesto nel primo argomento (merge-object) se è già un oggetto,
      // altrimenti crea un wrapper {requestId, msg}.
      const [first, ...rest] = args;
      if (first && typeof first === "object" && !Array.isArray(first)) {
        return (method as Function).apply(target, [{ ...ctx, ...(first as object) }, ...rest]);
      }
      return (method as Function).apply(target, [{ ...ctx }, first, ...rest]);
    };
  },
});

export default logger;
