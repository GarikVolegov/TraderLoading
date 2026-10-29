/**
 * Real User Monitoring (RUM) & Core Web Vitals telemetry for AUREUS OS.
 * Uses native PerformanceObserver (zero runtime bundle overhead).
 * Tracks LCP (p75 < 2.5s) and INP (p75 < 200ms) with device category tagging.
 */

export interface WebVitalMetric {
  name: "LCP" | "INP" | "CLS" | "FCP";
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  device: "mobile" | "desktop";
  route: string;
}

const SLO_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
} as const;

function getRating(name: keyof typeof SLO_THRESHOLDS, value: number): "good" | "needs-improvement" | "poor" {
  const { good, poor } = SLO_THRESHOLDS[name];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

function getDeviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 1024 || "ontouchstart" in window ? "mobile" : "desktop";
}

let rumInitialized = false;

export function initRumTelemetry(
  onMetric?: (metric: WebVitalMetric) => void,
): () => void {
  if (typeof window === "undefined" || !("PerformanceObserver" in window) || rumInitialized) {
    return () => {};
  }
  rumInitialized = true;

  const observers: PerformanceObserver[] = [];
  const emit = (name: WebVitalMetric["name"], value: number) => {
    const metric: WebVitalMetric = {
      name,
      value: Math.round(value * 100) / 100,
      rating: getRating(name, value),
      device: getDeviceType(),
      route: window.location.pathname,
    };
    if (onMetric) {
      onMetric(metric);
    }
  };

  // 1. Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        emit("LCP", lastEntry.startTime);
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    observers.push(lcpObserver);
  } catch {
    // Unsupported entry type
  }

  // 2. Interaction to Next Paint (INP) / First Input Delay
  try {
    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        // duration indicates latency of user interaction
        if (entry.duration) {
          emit("INP", entry.duration);
        }
      }
    });
    inpObserver.observe({ type: "first-input", buffered: true });
    observers.push(inpObserver);
  } catch {
    // Unsupported entry type
  }

  return () => {
    for (const obs of observers) {
      obs.disconnect();
    }
    rumInitialized = false;
  };
}
