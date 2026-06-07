import { execFile } from "node:child_process";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PortOwner = {
  protocol: string;
  localAddress: string;
  pid: number;
  processName?: string;
};

export function checkTcp(host: string, port: number, timeoutMs = 1_000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

export async function waitForTcp(host: string, port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkTcp(host, port, 1_000)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for TCP ${host}:${port}`);
}

export function checkHttp(
  url: string,
  timeoutMs = 2_000,
  validateBody?: (body: string) => boolean,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        if (body.length < 10_000) {
          body += chunk;
        }
      });
      response.on("end", () => {
        const status = response.statusCode;
        const okStatus = status !== undefined && status >= 200 && status < 400;
        const okBody = validateBody ? validateBody(body) : true;
        resolve({ ok: okStatus && okBody, status, error: okBody ? undefined : "invalid response body" });
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("timeout"));
    });

    request.on("error", (error) => {
      resolve({ ok: false, error: error.message });
    });
  });
}

export async function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";

  while (Date.now() < deadline) {
    const result = await checkHttp(url);
    if (result.ok) {
      return;
    }
    lastError = result.status !== undefined ? `HTTP ${result.status}` : (result.error ?? "unknown error");
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(`Timed out waiting for ${url}${lastError ? ` (${lastError})` : ""}`);
}

export async function getProcessNames(pids: number[]): Promise<Map<number, string>> {
  const lookupPids = pids.filter((pid) => Number.isInteger(pid) && pid > 0);
  if (lookupPids.length === 0 || process.platform !== "win32") {
    return new Map();
  }

  const escapedIds = lookupPids.map((pid) => String(pid)).join(",");
  const script = `Get-Process -Id ${escapedIds} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id)|$($_.ProcessName)" }`;
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], { windowsHide: true });
  const names = new Map<number, string>();

  for (const line of stdout.split(/\r?\n/)) {
    const [pid, name] = line.trim().split("|");
    if (pid && name) {
      names.set(Number(pid), name);
    }
  }

  return names;
}

export async function getPortOwners(port: number): Promise<PortOwner[]> {
  if (process.platform !== "win32") {
    return [];
  }

  const { stdout } = await execFileAsync("netstat.exe", ["-ano", "-p", "tcp"], { windowsHide: true });
  const owners = parseNetstatTcpOwners(stdout, port);
  const names = await getProcessNames([...new Set(owners.map((owner) => owner.pid))]);
  return owners.map((owner) => ({ ...owner, processName: names.get(owner.pid) }));
}

export function parseNetstatTcpOwners(stdout: string, port: number): PortOwner[] {
  const owners: PortOwner[] = [];

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("TCP")) {
      continue;
    }

    const parts = line.split(/\s+/);
    const localAddress = parts[1];
    const state = parts[3];
    const pid = Number(parts[parts.length - 1]);
    if (!localAddress || state !== "LISTENING" || !Number.isInteger(pid) || pid <= 0) {
      continue;
    }

    const portText = localAddress.slice(localAddress.lastIndexOf(":") + 1);
    if (Number(portText) === port) {
      owners.push({ protocol: "TCP", localAddress, pid });
    }
  }

  return owners;
}

export async function describePortOwners(port: number): Promise<string> {
  const owners = await getPortOwners(port);
  if (owners.length === 0) {
    return `No Windows TCP owner found for port ${port}.`;
  }

  return owners
    .map((owner) => `${owner.localAddress} pid=${owner.pid}${owner.processName ? ` (${owner.processName})` : ""}`)
    .join(", ");
}
