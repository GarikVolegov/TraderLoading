import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  for (const envName of [".env.local", ".env"]) {
    const candidates = [
      path.resolve(process.cwd(), envName),
      path.resolve(process.cwd(), "../../", envName),
    ];
    for (const envPath of candidates) {
      if (existsSync(envPath)) {
        try {
          process.loadEnvFile(envPath);
          if (process.env.DATABASE_URL) break;
        } catch {
          // ignore parsing error if already partially loaded
        }
      }
    }
    if (process.env.DATABASE_URL) break;
  }
}

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: dbUrl,
  },
});
