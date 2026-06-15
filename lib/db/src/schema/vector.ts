import { customType } from "drizzle-orm/pg-core";

// Embedding dimension for the wiki vector store. Fixed at DDL time by the
// `vector(N)` column type, so it MUST match the number baked into
// drizzle/0007_wiki_vector_folders.sql. Default 768 = Ollama `nomic-embed-text`.
// Switching to a provider with a different dimension (e.g. OpenAI
// text-embedding-3-small = 1536) requires an `ALTER TABLE ... ALTER COLUMN
// embedding TYPE vector(M)` migration followed by a full reindex.
export const EMBEDDING_DIM = 768;

// pgvector column type for Drizzle. drizzle-orm 0.45 has no native `vector`
// column, so we declare a customType. Postgres represents a vector literal as
// `[1,2,3]`; we serialize/parse around that. Stored as nullable everywhere so
// the app degrades to keyword search when no embedding provider is configured.
export const vector = (name: string, dim: number = EMBEDDING_DIM) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      if (Array.isArray(value)) return value as unknown as number[];
      return JSON.parse(value) as number[];
    },
  })(name);
