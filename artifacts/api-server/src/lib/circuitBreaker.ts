import logger from "./logger.js";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly circuitName: string, public readonly cooldownRemainingMs: number) {
    super(`Circuit breaker [${circuitName}] is OPEN. Upstream call rejected (${cooldownRemainingMs}ms cooldown remaining).`);
    this.name = "CircuitBreakerOpenError";
  }
}

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // default: 5
  cooldownMs?: number; // default: 30_000 (30s)
  successThreshold?: number; // default: 2 (in half-open)
  now?: () => number;
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;
  private readonly now: () => number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.successThreshold = options.successThreshold ?? 2;
    this.now = options.now ?? Date.now;
    this.onStateChange = options.onStateChange;
  }

  public getState(): CircuitState {
    if (this.state === "OPEN") {
      const elapsed = this.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        this.transitionTo("HALF_OPEN");
      }
    }
    return this.state;
  }

  public getStats() {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  private transitionTo(nextState: CircuitState): void {
    if (this.state === nextState) return;
    const previous = this.state;
    this.state = nextState;
    if (nextState === "CLOSED") {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (nextState === "HALF_OPEN") {
      this.successCount = 0;
    } else if (nextState === "OPEN") {
      this.lastFailureTime = this.now();
    }
    logger.warn({ circuit: this.name, from: previous, to: nextState }, `Circuit breaker transitioned from ${previous} to ${nextState}`);
    this.onStateChange?.(previous, nextState, this.name);
  }

  public async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      const remainingMs = Math.max(0, this.cooldownMs - (this.now() - this.lastFailureTime));
      if (fallback) {
        return fallback();
      }
      throw new CircuitBreakerOpenError(this.name, remainingMs);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      if (fallback) {
        return fallback();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.transitionTo("CLOSED");
      }
    } else if (this.state === "CLOSED") {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = this.now();
    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
    } else if (this.state === "CLOSED") {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.transitionTo("OPEN");
      }
    }
  }

  public reset(): void {
    this.transitionTo("CLOSED");
  }
}

/** Registry of active circuit breakers */
const circuitRegistry = new Map<string, CircuitBreaker>();

export function getOrCreateCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const existing = circuitRegistry.get(options.name);
  if (existing) return existing;
  const created = new CircuitBreaker(options);
  circuitRegistry.set(options.name, created);
  return created;
}

export function getAllCircuitBreakersStats() {
  const stats: Record<string, ReturnType<CircuitBreaker["getStats"]>> = {};
  for (const [name, breaker] of circuitRegistry) {
    stats[name] = breaker.getStats();
  }
  return stats;
}
