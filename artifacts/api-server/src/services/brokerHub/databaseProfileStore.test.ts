import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDatabaseBrokerProfileStore } from "./databaseProfileStore.js";

class FakeDb {
  data: unknown;
  writes = 0;
  transactions = 0;

  async transaction<T>(run: (tx: FakeDb) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return run(this);
  }

  async execute(query: unknown): Promise<unknown> {
    const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
    const sqlText = chunks
      .map((chunk) =>
        typeof chunk === "object" && chunk !== null && Array.isArray((chunk as { value?: unknown[] }).value)
          ? (chunk as { value: string[] }).value.join("")
          : "",
      )
      .join("");

    if (sqlText.includes("SELECT data")) {
      return { rows: this.data ? [{ data: this.data }] : [] };
    }

    if (sqlText.includes("INSERT INTO broker_profile_store") && sqlText.includes("DO NOTHING")) {
      if (!this.data) {
        const rawJson = chunks.find((chunk): chunk is string => typeof chunk === "string" && chunk.startsWith("{"));
        this.data = rawJson ? JSON.parse(rawJson) : undefined;
      }
    }

    if (sqlText.includes("INSERT INTO broker_profile_store") && sqlText.includes("DO UPDATE SET")) {
      const rawJson = chunks.find((chunk): chunk is string => typeof chunk === "string" && chunk.startsWith("{"));
      this.data = rawJson ? JSON.parse(rawJson) : undefined;
      this.writes += 1;
    }

    return { rows: [] };
  }
}

const db = new FakeDb();
const firstStore = await createDatabaseBrokerProfileStore(db);
const profile = await firstStore.saveProfile({
  label: "FX Blue Live",
  brokerName: "FP Trading",
  kind: "fxblue-account-sync",
  providerKind: "fxblue-account-sync",
  accountId: "82364482",
  environment: "live",
  route: "fxblue_account_sync",
  connectionStatus: "connected",
});
await firstStore.activateProfile(profile.id);

const secondStore = await createDatabaseBrokerProfileStore(db);
const list = await secondStore.listProfiles();
const source = readFileSync(new URL("./databaseProfileStore.ts", import.meta.url), "utf8");

assert.equal(db.writes, 2);
assert.equal(db.transactions, 2);
assert.match(source, /FOR UPDATE/);
assert.equal(list.activeProfileId, profile.id);
assert.equal(list.profiles[0]?.id, profile.id);
assert.equal(list.profiles[0]?.connectionStatus, "connected");

console.log("database broker profile store checks passed");
