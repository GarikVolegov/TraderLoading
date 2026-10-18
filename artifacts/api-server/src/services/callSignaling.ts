import { db, signalsTable } from "@workspace/db";
import { and, eq, lt } from "drizzle-orm";

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

// Claim and consume in one statement: concurrent polls cannot deliver the same
// offer twice. Signals committed after this statement remain for the next poll.
export async function consumeSignals(scope: string, recipientId: string): Promise<WireSignal[]> {
  const rows = await db
    .delete(signalsTable)
    .where(and(eq(signalsTable.scope, scope), eq(signalsTable.recipientId, recipientId)))
    .returning();

  // Opportunistic cleanup so the table never accumulates abandoned signals.
  await db.delete(signalsTable).where(lt(signalsTable.createdAt, new Date(Date.now() - SIGNAL_TTL_MS)));

  const cutoff = Date.now() - SIGNAL_TTL_MS;
  return rows
    .filter((r) => r.createdAt.getTime() > cutoff)
    .sort((a, b) => a.id - b.id)
    .map((r) => ({
      callId: r.callId,
      from: r.fromId,
      to: r.recipientId,
      type: r.type,
      data: r.data,
      ts: r.createdAt.getTime(),
    }));
}
