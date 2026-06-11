import { db, signalsTable } from "@workspace/db";
import { and, eq, inArray, lt } from "drizzle-orm";

// WebRTC signals are short-lived; anything older than this is dropped.
const SIGNAL_TTL_MS = 30_000;

export interface WireSignal {
  callId: string | null;
  from: string;
  to: string;
  type: string;
  data: string;
  ts: number;
}

export interface PushSignalInput {
  scope: string;        // "call" or "voice:<channelId>"
  to: string;
  from: string;
  type: string;
  data?: string;
  callId?: string | null;
}

export async function pushSignal(input: PushSignalInput): Promise<void> {
  await db.insert(signalsTable).values({
    scope: input.scope,
    recipientId: input.to,
    fromId: input.from,
    callId: input.callId ?? null,
    type: input.type,
    data: input.data ?? "",
  });
}

// Read and consume (delete) the pending signals for a recipient within a scope,
// mirroring the previous in-memory "drain on read" semantics. Only rows that are
// still within the TTL are returned; consumed rows are deleted by id so signals
// that arrive mid-request are not lost. Stale rows are swept opportunistically.
export async function consumeSignals(scope: string, recipientId: string): Promise<WireSignal[]> {
  const rows = await db
    .select()
    .from(signalsTable)
    .where(and(eq(signalsTable.scope, scope), eq(signalsTable.recipientId, recipientId)));

  if (rows.length > 0) {
    await db.delete(signalsTable).where(inArray(signalsTable.id, rows.map((r) => r.id)));
  }

  // Opportunistic cleanup so the table never accumulates abandoned signals.
  await db.delete(signalsTable).where(lt(signalsTable.createdAt, new Date(Date.now() - SIGNAL_TTL_MS)));

  const cutoff = Date.now() - SIGNAL_TTL_MS;
  return rows
    .filter((r) => r.createdAt.getTime() > cutoff)
    .map((r) => ({
      callId: r.callId,
      from: r.fromId,
      to: r.recipientId,
      type: r.type,
      data: r.data,
      ts: r.createdAt.getTime(),
    }));
}
