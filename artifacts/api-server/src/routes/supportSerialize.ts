// ─── Support ticket serializers (pure) ───────────────────────────────────────
// DB row → API shape (ISO dates). Kept free of I/O so they are unit-testable and
// reusable by both the user route and the admin route.

export const SUPPORT_STATUSES = ["open", "pending", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export interface ApiSupportTicket {
  id: number;
  subject: string;
  status: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSupportMessage {
  id: number;
  ticketId: number;
  authorType: string;
  body: string;
  createdAt: string;
}

interface TicketRowLike {
  id: number;
  subject: string;
  status: string;
  category: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface MessageRowLike {
  id: number;
  ticketId: number;
  authorType: string;
  body: string;
  createdAt: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function serializeTicket(row: TicketRowLike): ApiSupportTicket {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    category: row.category ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function serializeMessage(row: MessageRowLike): ApiSupportMessage {
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorType: row.authorType,
    body: row.body,
    createdAt: toIso(row.createdAt),
  };
}

export function isSupportStatus(value: string): value is SupportStatus {
  return (SUPPORT_STATUSES as readonly string[]).includes(value);
}
