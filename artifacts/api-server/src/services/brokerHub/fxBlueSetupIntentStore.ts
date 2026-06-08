export type FxBluePlatform = "MT4" | "MT5";
export type FxBlueSetupStatus = "created" | "profile_verified" | "waiting_for_sync" | "completed" | "error";

export interface FxBlueSetupIntent {
  id: string;
  platform: FxBluePlatform;
  brokerName: string;
  server: string;
  accountNumber: string;
  environment: "demo" | "live";
  status: FxBlueSetupStatus;
  displayStatus: string;
  fxBlueProfileRef?: string;
  profileId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FxBlueSetupIntentDraft {
  platform: unknown;
  brokerName: unknown;
  server: unknown;
  accountNumber: unknown;
  environment?: unknown;
  investorPassword?: unknown;
}

export interface FxBlueSetupIntentStore {
  createIntent(input: FxBlueSetupIntentDraft): Promise<FxBlueSetupIntent>;
  getIntent(id: string): Promise<FxBlueSetupIntent | null>;
  updateIntent(id: string, patch: Partial<FxBlueSetupIntent>): Promise<FxBlueSetupIntent>;
}

interface StoreOptions {
  now?: () => Date;
  id?: () => string;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizePlatform(value: unknown): FxBluePlatform {
  return value === "MT4" ? "MT4" : "MT5";
}

function sanitizeEnvironment(value: unknown): "demo" | "live" {
  return value === "demo" ? "demo" : "live";
}

function requireSetupInput(input: FxBlueSetupIntentDraft): Omit<FxBlueSetupIntent, "id" | "status" | "displayStatus" | "createdAt" | "updatedAt"> {
  const brokerName = readString(input.brokerName) || "FX Blue";
  const server = readString(input.server);
  const accountNumber = readString(input.accountNumber);
  const investorPassword = readString(input.investorPassword);
  if (!accountNumber) throw new Error("Numero conto richiesto.");
  if (!server) throw new Error("Server broker richiesto.");
  if (!investorPassword) throw new Error("Password investor/read-only richiesta per completare il setup su FX Blue.");
  return {
    platform: sanitizePlatform(input.platform),
    brokerName,
    server,
    accountNumber,
    environment: sanitizeEnvironment(input.environment),
  };
}

export function createFxBlueSetupIntentStore(options: StoreOptions = {}): FxBlueSetupIntentStore {
  const now = options.now ?? (() => new Date());
  const createId = options.id ?? (() => `fxblue-${crypto.randomUUID()}`);
  const intents = new Map<string, FxBlueSetupIntent>();

  return {
    async createIntent(input) {
      const safe = requireSetupInput(input);
      const timestamp = now().toISOString();
      const intent: FxBlueSetupIntent = {
        id: createId(),
        ...safe,
        status: "created",
        displayStatus: "Apri FX Blue Account Sync e avvia la raccolta in sola lettura.",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      intents.set(intent.id, intent);
      return { ...intent };
    },
    async getIntent(id) {
      const intent = intents.get(id);
      return intent ? { ...intent } : null;
    },
    async updateIntent(id, patch) {
      const current = intents.get(id);
      if (!current) throw new Error("FX Blue setup intent non trovato.");
      const next: FxBlueSetupIntent = {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: now().toISOString(),
      };
      intents.set(id, next);
      return { ...next };
    },
  };
}
