import logger from "./logger.js";
import type { AnomalyRecord } from "./systemWatchdog.js";

export interface WatchdogAlertTelemetry {
  configured: boolean;
  dispatchedCount: number;
  suppressedCount: number;
  failedCount: number;
  lastAlertAt: string | null;
}

export interface WatchdogAlertDispatchOptions {
  webhookUrl?: string;
  telegramChatId?: string;
  fetchImpl?: typeof fetch;
  cooldownMs?: number;
  now?: number;
  isProduction?: boolean;
}

export type WatchdogAlertDispatchResult =
  | {
      dispatched: true;
      provider: "discord" | "slack" | "telegram" | "generic";
      statusCode: number;
    }
  | {
      dispatched: false;
      reason:
        | "webhook_unconfigured"
        | "severity_ignored"
        | "invalid_url"
        | "insecure_protocol"
        | "cooldown_suppressed"
        | "http_error"
        | "network_error";
      statusCode?: number;
    };

const DEFAULT_COOLDOWN_MS = 60_000;
const WEBHOOK_TIMEOUT_MS = 3_500;

const dedupeMap = new Map<string, number>();
let dispatchedCount = 0;
let suppressedCount = 0;
let failedCount = 0;
let lastAlertAt: string | null = null;

function isAllowedWebhookUrl(rawUrl: string, isProd: boolean): { valid: true; parsed: URL } | { valid: false; reason: "invalid_url" | "insecure_protocol" } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: "invalid_url" };
  }

  if (parsed.protocol === "https:") {
    return { valid: true, parsed };
  }

  if (
    !isProd &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  ) {
    return { valid: true, parsed };
  }

  return { valid: false, reason: "insecure_protocol" };
}

function detectProvider(parsedUrl: URL): "discord" | "slack" | "telegram" | "generic" {
  const host = parsedUrl.hostname.toLowerCase();
  const path = parsedUrl.pathname.toLowerCase();

  if (
    (host === "discord.com" || host === "discordapp.com" || host.endsWith(".discord.com")) &&
    path.includes("/api/webhooks")
  ) {
    return "discord";
  }

  if (host === "hooks.slack.com" || host.endsWith(".slack.com")) {
    return "slack";
  }

  if (host === "api.telegram.org") {
    return "telegram";
  }

  return "generic";
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildWatchdogWebhookPayload(
  provider: "discord" | "slack" | "telegram" | "generic",
  anomaly: AnomalyRecord,
  telegramChatId?: string,
): Record<string, unknown> {
  const severityBadge = anomaly.severity === "critical" ? "CRITICAL" : "WARN";
  const color = anomaly.severity === "critical" ? 0xef4444 : 0xc5a059;

  if (provider === "discord") {
    const fields = [
      { name: "Kind", value: `\`${anomaly.kind}\``, inline: true },
      { name: "Severity", value: `\`${severityBadge}\``, inline: true },
      { name: "Anomaly ID", value: `\`${anomaly.id}\``, inline: true },
    ];
    if (anomaly.metadata && Object.keys(anomaly.metadata).length > 0) {
      fields.push({
        name: "Telemetry Metadata",
        value: `\`\`\`json\n${JSON.stringify(anomaly.metadata).slice(0, 900)}\n\`\`\``,
        inline: false,
      });
    }

    return {
      username: "AUREUS Watchdog Canary",
      embeds: [
        {
          title: `[${severityBadge}] Sovereign Watchdog Anomaly: ${anomaly.kind}`,
          description: anomaly.message,
          color,
          timestamp: anomaly.timestamp,
          fields,
        },
      ],
    };
  }

  if (provider === "slack") {
    return {
      text: `*[AUREUS WATCHDOG ${severityBadge}]* \`${anomaly.kind}\` — ${anomaly.message} (_${anomaly.timestamp}_)`,
    };
  }

  if (provider === "telegram") {
    return {
      chat_id: telegramChatId || process.env.WATCHDOG_ALERT_TELEGRAM_CHAT_ID || "",
      parse_mode: "HTML",
      text: `<b>[AUREUS WATCHDOG ${severityBadge}]</b>\n<b>Kind:</b> <code>${escapeHtml(anomaly.kind)}</code>\n<b>Message:</b> ${escapeHtml(anomaly.message)}\n<b>Time:</b> <code>${escapeHtml(anomaly.timestamp)}</code>`,
    };
  }

  return {
    service: "aureus-api",
    event: "watchdog.anomaly",
    anomaly,
    timestamp: anomaly.timestamp,
  };
}

export async function dispatchWatchdogCanaryAlert(
  anomaly: AnomalyRecord,
  options?: WatchdogAlertDispatchOptions,
): Promise<WatchdogAlertDispatchResult> {
  const rawWebhookUrl = (options?.webhookUrl ?? process.env.WATCHDOG_ALERT_WEBHOOK_URL ?? "").trim();
  if (!rawWebhookUrl) {
    return { dispatched: false, reason: "webhook_unconfigured" };
  }

  if (anomaly.severity === "info") {
    return { dispatched: false, reason: "severity_ignored" };
  }

  const isProd = options?.isProduction ?? process.env.NODE_ENV === "production";
  const urlCheck = isAllowedWebhookUrl(rawWebhookUrl, isProd);
  if (!urlCheck.valid) {
    failedCount += 1;
    logger.warn(
      { reason: urlCheck.reason, anomalyId: anomaly.id },
      "[AUREUS-WATCHDOG-ALERT] Rejected invalid or non-HTTPS webhook URL",
    );
    return { dispatched: false, reason: urlCheck.reason };
  }

  const now = options?.now ?? Date.now();
  const cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const dedupeKey = `${anomaly.kind}:${anomaly.severity}`;
  const lastDispatchedAt = dedupeMap.get(dedupeKey);

  if (lastDispatchedAt !== undefined && now - lastDispatchedAt < cooldownMs) {
    suppressedCount += 1;
    return { dispatched: false, reason: "cooldown_suppressed" };
  }

  dedupeMap.set(dedupeKey, now);

  const provider = detectProvider(urlCheck.parsed);
  const payload = buildWatchdogWebhookPayload(provider, anomaly, options?.telegramChatId);
  const fetchFn = options?.fetchImpl ?? globalThis.fetch;

  try {
    const response = await fetchFn(urlCheck.parsed.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Aureus-Sovereign-Watchdog/1.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      failedCount += 1;
      logger.warn(
        { statusCode: response.status, provider, anomalyId: anomaly.id },
        "[AUREUS-WATCHDOG-ALERT] Canary webhook returned non-2xx status",
      );
      return { dispatched: false, reason: "http_error", statusCode: response.status };
    }

    dispatchedCount += 1;
    lastAlertAt = new Date(now).toISOString();
    return { dispatched: true, provider, statusCode: response.status };
  } catch (err) {
    failedCount += 1;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), provider, anomalyId: anomaly.id },
      "[AUREUS-WATCHDOG-ALERT] Canary webhook dispatch failed",
    );
    return { dispatched: false, reason: "network_error" };
  }
}

export function getWatchdogAlertTelemetry(): WatchdogAlertTelemetry {
  return {
    configured: Boolean(process.env.WATCHDOG_ALERT_WEBHOOK_URL?.trim()),
    dispatchedCount,
    suppressedCount,
    failedCount,
    lastAlertAt,
  };
}

export function resetWatchdogAlertDedupeForTesting(): void {
  dedupeMap.clear();
  dispatchedCount = 0;
  suppressedCount = 0;
  failedCount = 0;
  lastAlertAt = null;
}

export interface WatchdogDailyDigestInput {
  status: "healthy" | "degraded" | "critical";
  uptimeSeconds: number;
  totalRequests: number;
  errorRatePct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  heapUsedMb: number;
  rssMb: number;
  totalAnomalies: number;
  timestamp?: string;
}

export function buildWatchdogDailyDigestPayload(
  provider: "discord" | "slack" | "telegram" | "generic",
  digest: WatchdogDailyDigestInput,
  telegramChatId?: string,
): Record<string, unknown> {
  const ts = digest.timestamp ?? new Date().toISOString();
  const statusUpper = digest.status.toUpperCase();
  const hours = (digest.uptimeSeconds / 3600).toFixed(1);
  const color =
    digest.status === "critical"
      ? 0xef4444
      : digest.status === "degraded"
        ? 0xc5a059
        : 0x10b981;

  if (provider === "discord") {
    return {
      username: "AUREUS Araldo della Soglia",
      embeds: [
        {
          title: `[DIGEST GIORNALIERO] Stato Cluster AUREUS: ${statusUpper}`,
          description: `Bollettino telemetrico delle ultime 24 ore · Uptime ${hours}h`,
          color,
          timestamp: ts,
          fields: [
            { name: "Richieste Totali", value: `\`${digest.totalRequests}\``, inline: true },
            { name: "Error Rate", value: `\`${digest.errorRatePct.toFixed(2)}%\``, inline: true },
            {
              name: "Latenza (Avg / p95)",
              value: `\`${digest.avgLatencyMs}ms / ${digest.p95LatencyMs}ms\``,
              inline: true,
            },
            {
              name: "Memoria (Heap / RSS)",
              value: `\`${digest.heapUsedMb}MB / ${digest.rssMb}MB\``,
              inline: true,
            },
            { name: "Anomalie 24h", value: `\`${digest.totalAnomalies}\``, inline: true },
          ],
        },
      ],
    };
  }

  if (provider === "slack") {
    return {
      text: `*[AUREUS ARALDO DELLA SOGLIA · ${statusUpper}]* Uptime: \`${hours}h\` | Req: \`${digest.totalRequests}\` | Err: \`${digest.errorRatePct.toFixed(2)}%\` | p95: \`${digest.p95LatencyMs}ms\` | Heap: \`${digest.heapUsedMb}MB\` | Anomalie: \`${digest.totalAnomalies}\``,
    };
  }

  if (provider === "telegram") {
    return {
      chat_id: telegramChatId || process.env.WATCHDOG_ALERT_TELEGRAM_CHAT_ID || "",
      parse_mode: "HTML",
      text: `<b>[AUREUS ARALDO DELLA SOGLIA · ${escapeHtml(statusUpper)}]</b>\n<b>Uptime:</b> <code>${hours}h</code> | <b>Req:</b> <code>${digest.totalRequests}</code>\n<b>Error Rate:</b> <code>${digest.errorRatePct.toFixed(2)}%</code> | <b>p95:</b> <code>${digest.p95LatencyMs}ms</code>\n<b>Heap/RSS:</b> <code>${digest.heapUsedMb}MB / ${digest.rssMb}MB</code> | <b>Anomalie:</b> <code>${digest.totalAnomalies}</code>`,
    };
  }

  return {
    service: "aureus-api",
    event: "watchdog.daily_digest",
    digest,
    timestamp: ts,
  };
}

export async function dispatchWatchdogDailyDigest(
  digest: WatchdogDailyDigestInput,
  options?: WatchdogAlertDispatchOptions,
): Promise<WatchdogAlertDispatchResult> {
  const rawWebhookUrl = (
    options?.webhookUrl ??
    process.env.WATCHDOG_ALERT_WEBHOOK_URL ??
    ""
  ).trim();
  if (!rawWebhookUrl) {
    return { dispatched: false, reason: "webhook_unconfigured" };
  }

  const isProd = options?.isProduction ?? process.env.NODE_ENV === "production";
  const urlCheck = isAllowedWebhookUrl(rawWebhookUrl, isProd);
  if (!urlCheck.valid) {
    failedCount += 1;
    return { dispatched: false, reason: urlCheck.reason };
  }

  const provider = detectProvider(urlCheck.parsed);
  const payload = buildWatchdogDailyDigestPayload(
    provider,
    digest,
    options?.telegramChatId,
  );
  const fetchFn = options?.fetchImpl ?? globalThis.fetch;

  try {
    const response = await fetchFn(urlCheck.parsed.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Aureus-Sovereign-Watchdog/1.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      failedCount += 1;
      return {
        dispatched: false,
        reason: "http_error",
        statusCode: response.status,
      };
    }

    dispatchedCount += 1;
    lastAlertAt = new Date(options?.now ?? Date.now()).toISOString();
    return { dispatched: true, provider, statusCode: response.status };
  } catch {
    failedCount += 1;
    return { dispatched: false, reason: "network_error" };
  }
}
