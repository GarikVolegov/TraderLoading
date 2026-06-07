import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  BrokerCapabilities,
  BrokerDeal,
  BrokerOrder,
  BrokerOrderResult,
  BrokerSnapshot,
  ConnectionHealth,
  NormalizedBrokerOrderRequest,
} from "./types.js";

export interface CompanionPairing {
  profileId: string;
  token: string;
  brokerName: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  lastHeartbeatAt?: string;
  terminal?: string;
}

export interface CompanionPendingOrder {
  id: string;
  profileId: string;
  order: NormalizedBrokerOrderRequest;
  status: BrokerOrder["status"];
  createdAt: string;
  result?: BrokerOrderResult;
}

interface CompanionFile {
  pairings: CompanionPairing[];
  snapshots: Record<string, BrokerSnapshot>;
  histories: Record<string, BrokerDeal[]>;
  pendingOrders: CompanionPendingOrder[];
}

export interface CompanionStore {
  createPairing(input: { profileId: string; brokerName: string; ttlMs?: number }): Promise<CompanionPairing>;
  verify(profileId: string, token: string): Promise<CompanionPairing>;
  heartbeat(input: { profileId: string; token: string; terminal?: string }): Promise<CompanionPairing>;
  saveSnapshot(input: { profileId: string; token: string; snapshot: BrokerSnapshot; capabilities?: Partial<BrokerCapabilities> }): Promise<BrokerSnapshot>;
  getSnapshot(profileId: string): Promise<BrokerSnapshot | null>;
  getHealth(profileId: string, staleMs?: number): Promise<ConnectionHealth>;
  saveHistory(input: { profileId: string; token: string; deals: BrokerDeal[] }): Promise<BrokerDeal[]>;
  importSnapshot(input: { profileId: string; snapshot: BrokerSnapshot; deals: BrokerDeal[] }): Promise<void>;
  getHistory(profileId: string): Promise<BrokerDeal[]>;
  enqueueOrder(profileId: string, order: NormalizedBrokerOrderRequest): Promise<CompanionPendingOrder>;
  listPendingOrders(profileId: string, token: string): Promise<CompanionPendingOrder[]>;
  listPendingOrdersTrusted(profileId: string): Promise<CompanionPendingOrder[]>;
  completeOrder(input: { profileId: string; token: string; orderId: string; result: BrokerOrderResult }): Promise<CompanionPendingOrder>;
  completeOrderTrusted(input: { profileId: string; orderId: string; result: BrokerOrderResult }): Promise<CompanionPendingOrder>;
}

const EMPTY_FILE: CompanionFile = { pairings: [], snapshots: {}, histories: {}, pendingOrders: [] };
const DEFAULT_STALE_MS = 1000 * 60 * 2;

function defaultPath(): string {
  return join(process.cwd(), ".local", "broker-companion.json");
}

function now(): string {
  return new Date().toISOString();
}

function token(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function readStore(path: string): Promise<CompanionFile> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<CompanionFile>;
    return {
      pairings: Array.isArray(parsed.pairings) ? parsed.pairings.filter((item) => item && typeof item.profileId === "string" && typeof item.token === "string") as CompanionPairing[] : [],
      snapshots: typeof parsed.snapshots === "object" && parsed.snapshots !== null ? parsed.snapshots as Record<string, BrokerSnapshot> : {},
      histories: typeof parsed.histories === "object" && parsed.histories !== null ? parsed.histories as Record<string, BrokerDeal[]> : {},
      pendingOrders: Array.isArray(parsed.pendingOrders) ? parsed.pendingOrders as CompanionPendingOrder[] : [],
    };
  } catch {
    return clone(EMPTY_FILE);
  }
}

async function writeStore(path: string, data: CompanionFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

function isExpired(pairing: CompanionPairing): boolean {
  return Date.parse(pairing.expiresAt) <= Date.now();
}

export function createCompanionStore(path = defaultPath()): CompanionStore {
  return {
    async createPairing(input) {
      const file = await readStore(path);
      const createdAt = now();
      const pairing: CompanionPairing = {
        profileId: input.profileId,
        token: token(),
        brokerName: input.brokerName,
        createdAt,
        expiresAt: new Date(Date.now() + (input.ttlMs ?? 1000 * 60 * 30)).toISOString(),
      };
      await writeStore(path, {
        ...file,
        pairings: [pairing, ...file.pairings.filter((item) => item.profileId !== input.profileId)],
      });
      return clone(pairing);
    },

    async verify(profileId, rawToken) {
      const file = await readStore(path);
      const pairing = file.pairings.find((item) => item.profileId === profileId && item.token === rawToken);
      if (!pairing || isExpired(pairing)) throw new Error("Pairing Connector non valido o scaduto.");
      return clone(pairing);
    },

    async heartbeat(input) {
      const file = await readStore(path);
      const pairing = file.pairings.find((item) => item.profileId === input.profileId && item.token === input.token);
      if (!pairing || isExpired(pairing)) throw new Error("Pairing Connector non valido o scaduto.");
      const next = { ...pairing, consumedAt: pairing.consumedAt ?? now(), lastHeartbeatAt: now(), terminal: input.terminal };
      await writeStore(path, {
        ...file,
        pairings: file.pairings.map((item) => item.profileId === input.profileId ? next : item),
      });
      return clone(next);
    },

    async saveSnapshot(input) {
      await this.verify(input.profileId, input.token);
      const file = await readStore(path);
      const snapshot = { ...input.snapshot, status: "connected" as const, lastUpdated: now(), error: undefined };
      await writeStore(path, { ...file, snapshots: { ...file.snapshots, [input.profileId]: snapshot } });
      await this.heartbeat({ profileId: input.profileId, token: input.token });
      return clone(snapshot);
    },

    async getSnapshot(profileId) {
      const file = await readStore(path);
      return file.snapshots[profileId] ? clone(file.snapshots[profileId]) : null;
    },

    async getHealth(profileId, staleMs = DEFAULT_STALE_MS) {
      const file = await readStore(path);
      const pairing = file.pairings.find((item) => item.profileId === profileId);
      if (!pairing?.lastHeartbeatAt) return file.snapshots[profileId] ? "import_only" : "waiting_for_companion";
      if (Date.now() - Date.parse(pairing.lastHeartbeatAt) > staleMs) return "stale";
      return file.snapshots[profileId] ? "connected" : "stale";
    },

    async saveHistory(input) {
      await this.verify(input.profileId, input.token);
      const file = await readStore(path);
      const deals = input.deals.map((deal) => ({ ...deal }));
      await writeStore(path, { ...file, histories: { ...file.histories, [input.profileId]: deals } });
      return clone(deals);
    },

    async getHistory(profileId) {
      const file = await readStore(path);
      return clone(file.histories[profileId] ?? []);
    },

    async importSnapshot(input) {
      const file = await readStore(path);
      await writeStore(path, {
        ...file,
        snapshots: { ...file.snapshots, [input.profileId]: input.snapshot },
        histories: { ...file.histories, [input.profileId]: input.deals.map((deal) => ({ ...deal })) },
      });
    },

    async enqueueOrder(profileId, order) {
      const file = await readStore(path);
      const pending: CompanionPendingOrder = {
        id: order.clientRequestId,
        profileId,
        order,
        status: "pending",
        createdAt: now(),
      };
      await writeStore(path, { ...file, pendingOrders: [pending, ...file.pendingOrders] });
      return clone(pending);
    },

    async listPendingOrders(profileId, rawToken) {
      await this.verify(profileId, rawToken);
      const file = await readStore(path);
      return clone(file.pendingOrders.filter((order) => order.profileId === profileId && order.status === "pending"));
    },

    async listPendingOrdersTrusted(profileId) {
      const file = await readStore(path);
      return clone(file.pendingOrders.filter((order) => order.profileId === profileId && order.status === "pending"));
    },

    async completeOrder(input) {
      await this.verify(input.profileId, input.token);
      return this.completeOrderTrusted({ profileId: input.profileId, orderId: input.orderId, result: input.result });
    },

    async completeOrderTrusted(input) {
      const file = await readStore(path);
      const existing = file.pendingOrders.find((order) => order.profileId === input.profileId && order.id === input.orderId);
      if (!existing) throw new Error("Ordine companion non trovato.");
      const next: CompanionPendingOrder = {
        ...existing,
        status: input.result.accepted ? "filled" : "rejected",
        result: input.result,
      };
      await writeStore(path, {
        ...file,
        pendingOrders: file.pendingOrders.map((order) => order.profileId === input.profileId && order.id === input.orderId ? next : order),
      });
      return clone(next);
    },
  };
}

export const companionStore = createCompanionStore();
