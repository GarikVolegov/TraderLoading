import { count, eq, desc, sql } from "drizzle-orm";
import { db, semAttributionsTable, type InsertSemAttribution } from "@workspace/db";
import { z } from "zod";
import logger from "../lib/logger.js";

export const semRecordInputSchema = z.object({
  channel: z.enum(["ai_search", "paid_sem", "organic_search", "social", "referral", "direct"]),
  aiEngine: z.enum(["chatgpt", "perplexity", "claude", "gemini", "copilot", "grok", "you", "phind", "meta_ai"]).nullable().optional(),
  utmSource: z.string().trim().max(180).nullable().optional(),
  utmMedium: z.string().trim().max(180).nullable().optional(),
  utmCampaign: z.string().trim().max(180).nullable().optional(),
  utmTerm: z.string().trim().max(180).nullable().optional(),
  utmContent: z.string().trim().max(180).nullable().optional(),
  gclid: z.string().trim().max(180).nullable().optional(),
  fbclid: z.string().trim().max(180).nullable().optional(),
  msclkid: z.string().trim().max(180).nullable().optional(),
  ttclid: z.string().trim().max(180).nullable().optional(),
  twclid: z.string().trim().max(180).nullable().optional(),
  referrerHost: z.string().trim().max(180).nullable().optional(),
  landingPath: z.string().trim().max(255).optional(),
});

export type SemRecordInput = z.infer<typeof semRecordInputSchema>;

export interface ExpansionTelemetryStats {
  totalTracked: number;
  byChannel: Record<string, number>;
  topAiEngines: Array<{ engine: string; count: number }>;
  topCampaigns: Array<{ campaign: string; count: number }>;
  timestamp: string;
}

// In-memory fallback if DB is temporarily unreachable in testing or startup
const memoryRecords: Array<InsertSemAttribution & { createdAt: Date }> = [];

export async function recordSemAttribution(
  input: SemRecordInput,
  userId?: string | null,
): Promise<{ success: boolean; id?: number }> {
  const validated = semRecordInputSchema.parse(input);

  const payload: InsertSemAttribution = {
    userId: userId ?? null,
    channel: validated.channel,
    aiEngine: validated.aiEngine ?? null,
    utmSource: validated.utmSource ?? null,
    utmMedium: validated.utmMedium ?? null,
    utmCampaign: validated.utmCampaign ?? null,
    utmTerm: validated.utmTerm ?? null,
    utmContent: validated.utmContent ?? null,
    gclid: validated.gclid ?? null,
    fbclid: validated.fbclid ?? null,
    msclkid: validated.msclkid ?? null,
    ttclid: validated.ttclid ?? null,
    twclid: validated.twclid ?? null,
    referrerHost: validated.referrerHost ?? null,
    landingPath: validated.landingPath || "/",
  };

  try {
    const inserted = await db
      .insert(semAttributionsTable)
      .values(payload)
      .returning({ id: semAttributionsTable.id });

    return { success: true, id: inserted[0]?.id };
  } catch (err) {
    logger.warn({ err }, "Database sem_attribution insert fallback to memory buffer");
    memoryRecords.push({ ...payload, createdAt: new Date() });
    return { success: true };
  }
}

export async function getUserLatestAttribution(userId: string) {
  try {
    const [row] = await db
      .select({
        channel: semAttributionsTable.channel,
        aiEngine: semAttributionsTable.aiEngine,
        utmSource: semAttributionsTable.utmSource,
        utmCampaign: semAttributionsTable.utmCampaign,
      })
      .from(semAttributionsTable)
      .where(eq(semAttributionsTable.userId, userId))
      .orderBy(desc(semAttributionsTable.createdAt))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function getExpansionTelemetryStats(): Promise<ExpansionTelemetryStats> {
  try {
    const [totalRows, channelRows, aiRows, campaignRows] = await Promise.all([
      db.select({ value: count() }).from(semAttributionsTable),
      db
        .select({ channel: semAttributionsTable.channel, count: count() })
        .from(semAttributionsTable)
        .groupBy(semAttributionsTable.channel),
      db
        .select({ engine: semAttributionsTable.aiEngine, count: count() })
        .from(semAttributionsTable)
        .where(sql`${semAttributionsTable.aiEngine} IS NOT NULL`)
        .groupBy(semAttributionsTable.aiEngine)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({ campaign: semAttributionsTable.utmCampaign, count: count() })
        .from(semAttributionsTable)
        .where(sql`${semAttributionsTable.utmCampaign} IS NOT NULL`)
        .groupBy(semAttributionsTable.utmCampaign)
        .orderBy(desc(count()))
        .limit(10),
    ]);

    const byChannel: Record<string, number> = {
      ai_search: 0,
      paid_sem: 0,
      organic_search: 0,
      social: 0,
      referral: 0,
      direct: 0,
    };

    for (const r of channelRows) {
      byChannel[r.channel] = Number(r.count);
    }

    return {
      totalTracked: Number(totalRows[0]?.value ?? 0),
      byChannel,
      topAiEngines: aiRows.map((r) => ({ engine: r.engine || "sconosciuto", count: Number(r.count) })),
      topCampaigns: campaignRows.map((r) => ({ campaign: r.campaign || "organico", count: Number(r.count) })),
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ err }, "Expansion stats DB query failed, using buffered stats");
    const byChannel: Record<string, number> = {
      ai_search: 0,
      paid_sem: 0,
      organic_search: 0,
      social: 0,
      referral: 0,
      direct: 0,
    };
    for (const m of memoryRecords) {
      byChannel[m.channel] = (byChannel[m.channel] || 0) + 1;
    }
    return {
      totalTracked: memoryRecords.length,
      byChannel,
      topAiEngines: [],
      topCampaigns: [],
      timestamp: new Date().toISOString(),
    };
  }
}
