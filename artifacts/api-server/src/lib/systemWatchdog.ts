import { monitorEventLoopDelay } from "node:perf_hooks";
import logger from "./logger.js";
import { captureError } from "./observability.js";

export interface AnomalyRecord {
  id: string;
  timestamp: string;
  kind: "unhandledRejection" | "circuitBreaker" | "databaseLag" | "memoryPressure" | "transientError";
  severity: "info" | "warn" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface MaintenanceTelemetry {
  lastRunAt: string | null;
  prunedOrphanRooms: number;
  dbPingMs: number | null;
  status: "idle" | "running" | "completed" | "error";
  lastError?: string;
}

export interface WatchdogTelemetry {
  status: "healthy" | "degraded" | "critical";
  uptimeSeconds: number;
  totalAnomalies: number;
  recoveredRejections: number;
  consecutiveRejections: number;
  eventLoopDelayMs: {
    mean: number;
    p95: number;
    max: number;
  };
  recentAnomalies: AnomalyRecord[];
  maintenance?: MaintenanceTelemetry;
}

const MAX_ANOMALIES_HISTORY = 100;
const CASCADE_THRESHOLD_WINDOW_MS = 10_000;
const CASCADE_THRESHOLD_COUNT = 10;

class SystemWatchdog {
  private startTime = Date.now();
  private anomalies: AnomalyRecord[] = [];
  private totalAnomaliesCount = 0;
  private recoveredRejectionsCount = 0;
  private consecutiveRejections = 0;
  private rejectionTimestamps: number[] = [];
  private eventLoopMonitor = monitorEventLoopDelay ? monitorEventLoopDelay({ resolution: 20 }) : null;
  private maintenanceTelemetry: MaintenanceTelemetry = {
    lastRunAt: null,
    prunedOrphanRooms: 0,
    dbPingMs: null,
    status: "idle",
  };

  constructor() {
    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.enable();
    }
  }

  public recordAnomaly(
    kind: AnomalyRecord["kind"],
    message: string,
    severity: AnomalyRecord["severity"] = "warn",
    metadata?: Record<string, unknown>,
  ): AnomalyRecord {
    const record: AnomalyRecord = {
      id: `anom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      kind,
      severity,
      message,
      metadata,
    };

    this.totalAnomaliesCount += 1;
    this.anomalies.unshift(record);
    if (this.anomalies.length > MAX_ANOMALIES_HISTORY) {
      this.anomalies.pop();
    }

    if (severity === "critical") {
      logger.error({ anomaly: record }, `[AUREUS-WATCHDOG] Critical system anomaly: ${message}`);
    } else {
      logger.warn({ anomaly: record }, `[AUREUS-WATCHDOG] System anomaly recorded: ${message}`);
    }

    return record;
  }

  /**
   * Evaluates an unhandled promise rejection.
   * If rejections occur in a catastrophic storm (e.g. >10 in 10s), returns shouldShutdown: true.
   * Otherwise, isolates the fault, logs telemetry, captures to Sentry, and allows the server to keep living.
   */
  public handleUnhandledRejection(reason: unknown): { shouldShutdown: boolean; reasonSummary: string } {
    const now = Date.now();
    const reasonSummary = reason instanceof Error ? reason.message : String(reason);

    this.consecutiveRejections += 1;
    this.rejectionTimestamps.push(now);

    // Filter out timestamps older than the cascade window
    const windowStart = now - CASCADE_THRESHOLD_WINDOW_MS;
    this.rejectionTimestamps = this.rejectionTimestamps.filter((t) => t >= windowStart);

    const isCascade = this.rejectionTimestamps.length >= CASCADE_THRESHOLD_COUNT;
    const isStrictCrashEnv = process.env.STRICT_CRASH_ON_UNHANDLED_REJECTION === "true";

    captureError(reason instanceof Error ? reason : new Error(reasonSummary), {
      surface: "process",
      kind: "unhandledRejection",
      recovered: !isCascade && !isStrictCrashEnv,
      consecutiveCount: this.consecutiveRejections,
    });

    this.recordAnomaly(
      "unhandledRejection",
      reasonSummary,
      isCascade ? "critical" : "warn",
      {
        stack: reason instanceof Error ? reason.stack : undefined,
        consecutive: this.consecutiveRejections,
        rateInWindow: this.rejectionTimestamps.length,
      },
    );

    if (isCascade || isStrictCrashEnv) {
      logger.fatal(
        { count: this.rejectionTimestamps.length, reasonSummary },
        "[AUREUS-WATCHDOG] Unhandled rejection cascade detected! Initiating graceful containment shutdown",
      );
      return { shouldShutdown: true, reasonSummary };
    }

    this.recoveredRejectionsCount += 1;
    logger.warn(
      { reasonSummary, totalRecovered: this.recoveredRejectionsCount },
      "[AUREUS-WATCHDOG] Transient unhandled rejection contained. Server continuity maintained by Sovereign Protocol",
    );

    return { shouldShutdown: false, reasonSummary };
  }

  public getTelemetry(): WatchdogTelemetry {
    const now = Date.now();
    const uptimeSeconds = Math.round((now - this.startTime) / 1000);

    let meanDelayMs = 0;
    let p95DelayMs = 0;
    let maxDelayMs = 0;

    if (this.eventLoopMonitor) {
      meanDelayMs = Math.round((this.eventLoopMonitor.mean / 1e6) * 100) / 100;
      p95DelayMs = Math.round((this.eventLoopMonitor.percentile(95) / 1e6) * 100) / 100;
      maxDelayMs = Math.round((this.eventLoopMonitor.max / 1e6) * 100) / 100;
    }

    let status: WatchdogTelemetry["status"] = "healthy";
    if (this.rejectionTimestamps.length > 3 || p95DelayMs > 100) {
      status = "degraded";
    }
    if (this.rejectionTimestamps.length >= CASCADE_THRESHOLD_COUNT || p95DelayMs > 500) {
      status = "critical";
    }

    return {
      status,
      uptimeSeconds,
      totalAnomalies: this.totalAnomaliesCount,
      recoveredRejections: this.recoveredRejectionsCount,
      consecutiveRejections: this.consecutiveRejections,
      eventLoopDelayMs: {
        mean: meanDelayMs,
        p95: p95DelayMs,
        max: maxDelayMs,
      },
      recentAnomalies: this.anomalies.slice(0, 10),
      maintenance: { ...this.maintenanceTelemetry },
    };
  }

  public recordMaintenance(update: Partial<MaintenanceTelemetry>): void {
    this.maintenanceTelemetry = {
      ...this.maintenanceTelemetry,
      ...update,
    };
  }

  public getMaintenanceTelemetry(): MaintenanceTelemetry {
    return { ...this.maintenanceTelemetry };
  }

  public resetForTesting(): void {
    this.anomalies = [];
    this.totalAnomaliesCount = 0;
    this.recoveredRejectionsCount = 0;
    this.consecutiveRejections = 0;
    this.rejectionTimestamps = [];
    this.startTime = Date.now();
    this.maintenanceTelemetry = {
      lastRunAt: null,
      prunedOrphanRooms: 0,
      dbPingMs: null,
      status: "idle",
    };
    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.reset();
    }
  }
}

export const systemWatchdog = new SystemWatchdog();
