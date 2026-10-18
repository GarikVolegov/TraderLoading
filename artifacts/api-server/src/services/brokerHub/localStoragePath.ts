import { join } from "node:path";

/** Trusted deployment/test configuration; normal app storage remains in cwd/.local. */
export function brokerLocalPath(fileName: string): string {
  return join(process.env.BROKER_LOCAL_STORE_DIR || join(process.cwd(), ".local"), fileName);
}
