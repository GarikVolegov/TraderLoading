import { spawn } from "node:child_process";
import { repoRoot } from "./env.js";

export type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "pipe";
  label?: string;
};

export type RunResult = {
  stdout: string;
  stderr: string;
};

export function commandName(command: string): string {
  return command;
}

function quoteWindowsPart(value: string): string {
  if (!/[\s"&|<>^]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function spawnCommand(command: string, args: string[]) {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: process.env["ComSpec"] ?? "cmd.exe",
    args: ["/d", "/c", [command, ...args].map(quoteWindowsPart).join(" ")],
  };
}

export function runCommand(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  const stdio = options.stdio ?? "inherit";
  const label = options.label ?? [command, ...args].join(" ");

  return new Promise((resolve, reject) => {
    const resolved = spawnCommand(commandName(command), args);
    const child = spawn(resolved.command, resolved.args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    if (stdio === "pipe") {
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", (error) => {
      reject(new Error(`Failed to start "${label}": ${error.message}`));
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const signalText = signal ? ` signal ${signal}` : "";
      reject(new Error(`Command failed (${code ?? "unknown"}${signalText}): ${label}`));
    });
  });
}

export function spawnLongRunning(command: string, args: string[], options: RunOptions = {}) {
  const label = options.label ?? [command, ...args].join(" ");
  const resolved = spawnCommand(commandName(command), args);
  const child = spawn(resolved.command, resolved.args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error(`Failed to start "${label}": ${error.message}`);
    process.exitCode = 1;
  });

  return child;
}
