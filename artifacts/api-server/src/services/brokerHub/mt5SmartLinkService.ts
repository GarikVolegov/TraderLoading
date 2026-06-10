import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type Mt5SmartLinkStatusCode =
  | "starting"
  | "waiting_for_terminal"
  | "waiting_for_login"
  | "waiting_for_snapshot"
  | "connected"
  | "stopped"
  | "error";

export interface Mt5SmartLinkStatus {
  profileId: string;
  status: Mt5SmartLinkStatusCode;
  connected: boolean;
  terminalDetected: boolean;
  terminalPath?: string;
  message: string;
}

export interface Mt5SmartLinkDiagnosticCheck {
  id: string;
  label: string;
  ok: boolean;
  message: string;
}

export interface Mt5SmartLinkService {
  start(input: { profileId: string; brokerName: string; tradingEnabled: boolean; token: string; terminalPath?: string }): Promise<Mt5SmartLinkStatus>;
  status(profileId: string): Promise<Mt5SmartLinkStatus>;
  login(input: { profileId: string; accountNumber: string; password: string; server: string; token: string; terminalPath?: string }): Promise<Mt5SmartLinkStatus>;
  stop(profileId: string): Promise<Mt5SmartLinkStatus>;
  diagnostics(profileId: string): Promise<{ profileId: string; checks: Mt5SmartLinkDiagnosticCheck[] }>;
}

interface ManagedBridge {
  process?: ChildProcessWithoutNullStreams;
  status: Mt5SmartLinkStatus;
  logs: string[];
}

const bridges = new Map<string, ManagedBridge>();

function workspaceRoot(): string {
  return resolve(process.cwd(), "..", "..");
}

function bridgeScriptPath(): string {
  const candidates = [
    resolve(process.cwd(), "tools", "mt5-local-bridge", "mt5_bridge.py"),
    resolve(workspaceRoot(), "tools", "mt5-local-bridge", "mt5_bridge.py"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function pythonCommand(): string {
  return process.platform === "win32" ? "python" : "python3";
}

function smartLinkApiBase(): string {
  return process.env.TRADERLOADING_SMARTLINK_API ?? "http://127.0.0.1:3001/api/brokers";
}

async function directoryEntries(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}

async function readOriginTerminalPath(dataFolder: string): Promise<string | null> {
  try {
    const origin = (await readFile(join(dataFolder, "origin.txt"), "utf8")).trim();
    const terminal = join(origin, "terminal64.exe");
    return existsSync(terminal) ? terminal : null;
  } catch {
    return null;
  }
}

export async function detectMt5Terminal(explicitPath?: string): Promise<string | null> {
  if (explicitPath && existsSync(explicitPath)) return explicitPath;
  const envPath = process.env.MT5_TERMINAL_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  const directCandidates = [
    "C:\\Program Files\\MetaTrader 5\\terminal64.exe",
    "C:\\Program Files (x86)\\MetaTrader 5\\terminal64.exe",
    "C:\\Program Files\\FP Markets MetaTrader 5\\terminal64.exe",
    "C:\\Program Files\\FP Trading MetaTrader 5\\terminal64.exe",
  ];
  const direct = directCandidates.find((candidate) => existsSync(candidate));
  if (direct) return direct;

  const terminalRoot = join(homedir(), "AppData", "Roaming", "MetaQuotes", "Terminal");
  for (const entry of await directoryEntries(terminalRoot)) {
    const fromOrigin = await readOriginTerminalPath(join(terminalRoot, entry));
    if (fromOrigin) return fromOrigin;
  }
  return null;
}

function initialStatus(profileId: string, terminalPath: string | null): Mt5SmartLinkStatus {
  return {
    profileId,
    status: terminalPath ? "waiting_for_snapshot" : "waiting_for_terminal",
    connected: false,
    terminalDetected: Boolean(terminalPath),
    terminalPath: terminalPath ?? undefined,
    message: terminalPath
      ? "MetaTrader rilevato. Attendo i dati del conto."
      : "MetaTrader 5 non rilevato. Apri MetaTrader 5 e riprova.",
  };
}

function remember(profileId: string, status: Mt5SmartLinkStatus, processHandle?: ChildProcessWithoutNullStreams): Mt5SmartLinkStatus {
  const existing = bridges.get(profileId);
  const bridge = {
    process: processHandle ?? existing?.process,
    status,
    logs: existing?.logs ?? [],
  };
  bridges.set(profileId, bridge);
  return { ...status };
}

export function createMt5SmartLinkService(): Mt5SmartLinkService {
  function launchBridge(input: {
    profileId: string;
    terminalPath: string;
    login?: string;
    password?: string;
    server?: string;
    token: string;
  }): { status?: Mt5SmartLinkStatus; process?: ChildProcessWithoutNullStreams } {
    const script = bridgeScriptPath();
    if (!existsSync(script)) {
      return {
        status: {
          profileId: input.profileId,
          status: "error",
          connected: false,
          terminalDetected: true,
          terminalPath: input.terminalPath,
          message: "SmartLink locale non trovato. Reinstalla TraderLoading Connector.",
        },
      };
    }

    const args = [
      script,
      "--host",
      "127.0.0.1",
      "--port",
      "8765",
      "--terminal-path",
      input.terminalPath,
      "--smartlink-api",
      smartLinkApiBase(),
      "--profile-id",
      input.profileId,
      "--token",
      input.token,
    ];
    if (input.login) args.push("--login", input.login);
    if (input.password) args.push("--password", input.password);
    if (input.server) args.push("--server", input.server);

    try {
      const child = spawn(pythonCommand(), args, {
        cwd: dirname(script),
        env: {
          ...process.env,
          MT5_TERMINAL_PATH: input.terminalPath,
          TRADERLOADING_SMARTLINK_API: smartLinkApiBase(),
          TRADERLOADING_SMARTLINK_PROFILE_ID: input.profileId,
          TRADERLOADING_SMARTLINK_TOKEN: input.token,
        },
        windowsHide: true,
      });
      child.stdout.on("data", (chunk) => {
        const bridge = bridges.get(input.profileId);
        if (bridge) bridge.logs.push(String(chunk).trim());
      });
      child.stderr.on("data", (chunk) => {
        const bridge = bridges.get(input.profileId);
        if (bridge) bridge.logs.push(String(chunk).trim());
      });
      child.on("exit", (code) => {
        const bridge = bridges.get(input.profileId);
        if (!bridge) return;
        bridge.status = {
          ...bridge.status,
          status: code === 0 ? "stopped" : "error",
          connected: false,
          message: code === 0 ? "SmartLink fermato." : "SmartLink non riesce a leggere MetaTrader. Apri il terminale e riprova.",
        };
      });
      return { process: child };
    } catch {
      return {
        status: {
          profileId: input.profileId,
          status: "error",
          connected: false,
          terminalDetected: true,
          terminalPath: input.terminalPath,
          message: "SmartLink non puo' avviare il collegamento locale. Verifica Python e MetaTrader 5.",
        },
      };
    }
  }

  return {
    async start(input) {
      const terminalPath = await detectMt5Terminal(input.terminalPath);
      const status = remember(input.profileId, initialStatus(input.profileId, terminalPath));
      if (!terminalPath) return status;

      const existing = bridges.get(input.profileId);
      if (existing?.process && !existing.process.killed) return { ...existing.status };

      const launched = launchBridge({ profileId: input.profileId, terminalPath, token: input.token });
      if (launched.status) return remember(input.profileId, launched.status);
      return remember(
        input.profileId,
        {
          ...status,
          status: "starting",
          message: "SmartLink avviato. Attendo i dati reali del conto.",
        },
        launched.process,
      );
    },

    async status(profileId) {
      const current = bridges.get(profileId);
      if (current) return { ...current.status };
      const terminalPath = await detectMt5Terminal();
      return remember(profileId, initialStatus(profileId, terminalPath));
    },

    async login(input) {
      const terminalPath = await detectMt5Terminal(input.terminalPath);
      if (terminalPath) {
        const current = bridges.get(input.profileId);
        if (current?.process && !current.process.killed) current.process.kill();
        const launched = launchBridge({
          profileId: input.profileId,
          terminalPath,
          login: input.accountNumber,
          password: input.password,
          server: input.server,
          token: input.token,
        });
        if (launched.status) return remember(input.profileId, launched.status);
        return remember(
          input.profileId,
          {
            profileId: input.profileId,
            status: "starting",
            connected: false,
            terminalDetected: true,
            terminalPath,
            message: "SmartLink sta accedendo al conto. Attendo i dati reali.",
          },
          launched.process,
        );
      }
      return remember(input.profileId, {
        profileId: input.profileId,
        status: "waiting_for_terminal",
        connected: false,
        terminalDetected: false,
        message: "MetaTrader 5 non rilevato. Apri MetaTrader 5 e riprova.",
      });
    },

    async stop(profileId) {
      const current = bridges.get(profileId);
      if (current?.process && !current.process.killed) current.process.kill();
      return remember(profileId, {
        profileId,
        status: "stopped",
        connected: false,
        terminalDetected: current?.status.terminalDetected ?? false,
        terminalPath: current?.status.terminalPath,
        message: "SmartLink fermato.",
      });
    },

    async diagnostics(profileId) {
      const status = await this.status(profileId);
      const bridge = bridges.get(profileId);
      return {
        profileId,
        checks: [
          {
            id: "terminal",
            label: "MetaTrader 5",
            ok: status.terminalDetected,
            message: status.terminalDetected ? "Terminale rilevato." : "Apri MetaTrader 5 o installalo dal tuo broker.",
          },
          {
            id: "smartlink",
            label: "SmartLink",
            ok: status.status !== "error",
            message: status.status === "error" ? status.message : "Servizio locale pronto.",
          },
          {
            id: "account",
            label: "Conto",
            ok: status.connected,
            message: status.connected ? "Conto sincronizzato." : "Accedi al conto in MetaTrader e attendi la sincronizzazione.",
          },
          {
            id: "logs",
            label: "Diagnostica",
            ok: true,
            message: bridge?.logs.slice(-1)[0] || "Nessun dettaglio tecnico necessario.",
          },
        ],
      };
    },
  };
}

export const mt5SmartLinkService = createMt5SmartLinkService();
