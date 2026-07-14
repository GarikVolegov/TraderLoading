// Client off-contract dell'import CSV del diario (come torneiApi): apiJSON.
import { apiJSON } from "./apiFetch";

export interface CsvImportResult {
  /** Rows successfully imported (or updated on re-import). */
  imported: number;
  /** Rows skipped: malformed CSV lines + rows missing required fields. */
  skipped: number;
}

/** POST a broker-statement CSV; the server parses + upserts closed trades that
 *  feed the coach (source="manual", excluded from tornei). */
export function importTradesCsv(csv: string): Promise<CsvImportResult> {
  return apiJSON<CsvImportResult>("journal/import-csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv }),
  });
}
