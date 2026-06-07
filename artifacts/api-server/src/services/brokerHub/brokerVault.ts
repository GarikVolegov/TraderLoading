import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface BrokerVaultOptions {
  path?: string;
  key?: string;
}

interface VaultRecord {
  iv: string;
  tag: string;
  value: string;
}

type VaultFile = Record<string, Record<string, VaultRecord>>;

export interface BrokerVault {
  setSecret(profileId: string, name: string, value: string): Promise<void>;
  getSecret(profileId: string, name: string): Promise<string | null>;
  deleteProfile(profileId: string): Promise<void>;
  readRawForTest(): Promise<string>;
}

function vaultPath(): string {
  return join(process.cwd(), ".local", "broker-vault.json");
}

function keyMaterial(raw?: string): Buffer {
  const source = raw || process.env.BROKER_VAULT_KEY || "traderloading-local-development-vault-key";
  if (/^[a-f0-9]{64}$/i.test(source)) return Buffer.from(source, "hex");
  return createHash("sha256").update(source).digest();
}

async function readVault(path: string): Promise<VaultFile> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as VaultFile) : {};
  } catch {
    return {};
  }
}

async function writeVault(path: string, data: VaultFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

function encrypt(value: string, key: Buffer): VaultRecord {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
  };
}

function decrypt(record: VaultRecord, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(record.value, "base64")), decipher.final()]).toString("utf8");
}

export function createBrokerVault(options: BrokerVaultOptions = {}): BrokerVault {
  const path = options.path ?? vaultPath();
  const key = keyMaterial(options.key);

  return {
    async setSecret(profileId: string, name: string, value: string): Promise<void> {
      const data = await readVault(path);
      data[profileId] = { ...(data[profileId] ?? {}), [name]: encrypt(value, key) };
      await writeVault(path, data);
    },

    async getSecret(profileId: string, name: string): Promise<string | null> {
      const data = await readVault(path);
      const record = data[profileId]?.[name];
      return record ? decrypt(record, key) : null;
    },

    async deleteProfile(profileId: string): Promise<void> {
      const data = await readVault(path);
      delete data[profileId];
      await writeVault(path, data);
    },

    async readRawForTest(): Promise<string> {
      try {
        return await readFile(path, "utf8");
      } catch {
        return "";
      }
    },
  };
}
