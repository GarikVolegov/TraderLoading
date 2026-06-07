import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BrokerOrderResult, NormalizedBrokerOrderRequest } from "./types.js";

export type BrokerAuditRequest =
  | NormalizedBrokerOrderRequest
  | { action: "closePosition"; positionId: string };

export interface BrokerAuditLog {
  append(entry: {
    profileId: string;
    request: BrokerAuditRequest;
    result: BrokerOrderResult;
  }): Promise<void>;
  readAll(): Promise<unknown[]>;
}

function defaultPath(): string {
  return join(process.cwd(), ".local", "broker-order-audit.ndjson");
}

export function createBrokerAuditLog(path = defaultPath()): BrokerAuditLog {
  return {
    async append(entry): Promise<void> {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`, "utf8");
    },
    async readAll(): Promise<unknown[]> {
      try {
        const raw = await readFile(path, "utf8");
        return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown);
      } catch {
        return [];
      }
    },
  };
}
