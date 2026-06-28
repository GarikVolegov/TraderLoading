import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  supportTicketsTable,
  supportTicketMessagesTable,
} from "@workspace/db";
import {
  CreateSupportTicketBody,
  CreateSupportTicketMessageBody,
} from "@workspace/api-zod";
import { getUserId } from "./profile.js";
import { serializeMessage, serializeTicket } from "./supportSerialize.js";
import { getRateLimitKey } from "../lib/security.js";
import {
  createRedisRateLimitStore,
  type RateLimitRedis,
} from "../lib/rateLimitStore.js";
import { getSharedRedisClient } from "../lib/redisClient.js";
import { sendTicketCreatedEmail } from "../services/email/ticketEmails.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// Stricter limiter for opening tickets (anti-spam). Reuses the shared Redis
// store when present, else a per-process memory store — same wiring as app.ts.
const createTicketStore = process.env.REDIS_URL
  ? createRedisRateLimitStore({
      getClient: async () => {
        const pending = getSharedRedisClient();
        return pending ? ((await pending) as unknown as RateLimitRedis) : null;
      },
    })
  : undefined;

const createTicketLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  keyGenerator: getRateLimitKey,
  legacyHeaders: false,
  standardHeaders: true,
  ...(createTicketStore ? { store: createTicketStore } : {}),
});

router.get("/support/tickets", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, userId))
    .orderBy(desc(supportTicketsTable.updatedAt));
  res.json(rows.map(serializeTicket));
});

router.post("/support/tickets", createTicketLimiter, async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const subject = parsed.data.subject.trim();
  const body = parsed.data.body.trim();
  if (!subject || !body) {
    res.status(400).json({ error: "subject and body are required" });
    return;
  }
  const category = parsed.data.category?.trim() || null;

  const [ticket] = await db
    .insert(supportTicketsTable)
    .values({ userId, subject, status: "open", category })
    .returning();
  const [message] = await db
    .insert(supportTicketMessagesTable)
    .values({ ticketId: ticket.id, authorType: "user", authorId: userId, body })
    .returning();

  // Best-effort confirmation email — never blocks the response.
  void sendTicketCreatedEmail({ id: ticket.id, userId, subject }).catch((err) =>
    logger.error({ err }, "[support] confirmation email failed"),
  );

  res.status(201).json({
    ticket: serializeTicket(ticket),
    messages: [serializeMessage(message)],
  });
});

router.get("/support/tickets/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, userId)));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const messages = await db
    .select()
    .from(supportTicketMessagesTable)
    .where(eq(supportTicketMessagesTable.ticketId, id))
    .orderBy(asc(supportTicketMessagesTable.createdAt));
  res.json({
    ticket: serializeTicket(ticket),
    messages: messages.map(serializeMessage),
  });
});

router.post("/support/tickets/:id/messages", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = CreateSupportTicketMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const body = parsed.data.body.trim();
  if (!body) {
    res.status(400).json({ error: "body is required" });
    return;
  }
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, userId)));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const [message] = await db
    .insert(supportTicketMessagesTable)
    .values({ ticketId: id, authorType: "user", authorId: userId, body })
    .returning();
  // A user reply re-opens the ticket and bumps its recency.
  await db
    .update(supportTicketsTable)
    .set({ status: "open", updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));

  res.status(201).json(serializeMessage(message));
});

export default router;
