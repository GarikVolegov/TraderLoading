import { desc, eq, or } from "drizzle-orm";
import {
  accountTradesTable,
  backtestSessionsTable,
  backtestTradesTable,
  chatMessagesTable,
  checkinsTable,
  checklistItemsTable,
  communityFilesTable,
  communityMessagesTable,
  followsTable,
  friendshipsTable,
  ideasTable,
  journalEntriesTable,
  journalRecapsTable,
  journalTagsTable,
  levelCertificatesTable,
  missionTemplatesTable,
  missionsTable,
  newsFeedbackTable,
  newsPreferencesTable,
  postCommentsTable,
  postLikesTable,
  postsTable,
  profileTable,
  pushSubscriptionsTable,
  quotesTable,
  routineCompletionsTable,
  userSettingsTable,
  db as defaultDb,
} from "@workspace/db";

type DatabaseLike = typeof defaultDb;

export const ACCOUNT_EXPORT_CATEGORIES = [
  "profile",
  "journal",
  "trading-data",
  "routine",
  "preferences",
  "social-signals",
] as const;

export type AccountExportCategory = (typeof ACCOUNT_EXPORT_CATEGORIES)[number];

export interface AccountExportDisclosure {
  title: string;
  format: "JSON";
  includedData: string[];
  excludedData: string[];
}

export interface AccountDataExport {
  exportedAt: string;
  userId: string;
  formatVersion: 1;
  categories: readonly AccountExportCategory[];
  data: Record<string, unknown>;
}

export function getAccountExportDisclosure(): AccountExportDisclosure {
  return {
    title: "Esporta dati",
    format: "JSON",
    includedData: [
      "Profilo, preferenze, notifiche e impostazioni operative.",
      "Diario, tag, recap, check-in, routine, missioni e certificati livello.",
      "Dati trading sincronizzati, sessioni backtest e trade manuali.",
      "Dati social e community collegati all'account, incluse relazioni, post e messaggi cifrati.",
    ],
    excludedData: [
      "Segreti broker, token tecnici, password, chiavi private operative e log di sicurezza interni non vengono esportati.",
    ],
  };
}

export async function exportAccountData(
  userId: string,
  database: DatabaseLike = defaultDb,
): Promise<AccountDataExport> {
  if (!userId.trim()) throw new Error("Missing user id for account export");

  const [
    profile,
    settings,
    pushSubscriptions,
    journalEntries,
    journalTags,
    journalRecaps,
    checkins,
    ideas,
    checklist,
    quotes,
    missions,
    missionTemplates,
    levelCertificates,
    accountTrades,
    backtestSessions,
    backtestTrades,
    routineCompletions,
    newsPreferences,
    newsFeedback,
    follows,
    friendships,
    posts,
    postLikes,
    postComments,
    directMessages,
    communityMessages,
    communityFiles,
  ] = await Promise.all([
    database.select().from(profileTable).where(eq(profileTable.userId, userId)),
    database.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId)),
    database.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId)),
    database.select().from(journalEntriesTable).where(eq(journalEntriesTable.userId, userId)).orderBy(desc(journalEntriesTable.createdAt)),
    database.select().from(journalTagsTable).where(eq(journalTagsTable.userId, userId)),
    database.select().from(journalRecapsTable).where(eq(journalRecapsTable.userId, userId)),
    database.select().from(checkinsTable).where(eq(checkinsTable.userId, userId)),
    database.select().from(ideasTable).where(eq(ideasTable.userId, userId)),
    database.select().from(checklistItemsTable).where(eq(checklistItemsTable.userId, userId)),
    database.select().from(quotesTable).where(eq(quotesTable.userId, userId)),
    database.select().from(missionsTable).where(eq(missionsTable.userId, userId)),
    database.select().from(missionTemplatesTable).where(eq(missionTemplatesTable.userId, userId)),
    database.select().from(levelCertificatesTable).where(eq(levelCertificatesTable.userId, userId)),
    database.select().from(accountTradesTable).where(eq(accountTradesTable.userId, userId)),
    database.select().from(backtestSessionsTable).where(eq(backtestSessionsTable.userId, userId)),
    database.select().from(backtestTradesTable).where(eq(backtestTradesTable.userId, userId)),
    database.select().from(routineCompletionsTable).where(eq(routineCompletionsTable.userId, userId)),
    database.select().from(newsPreferencesTable).where(eq(newsPreferencesTable.userId, userId)),
    database.select().from(newsFeedbackTable).where(eq(newsFeedbackTable.userId, userId)),
    database
      .select()
      .from(followsTable)
      .where(or(eq(followsTable.followerId, userId), eq(followsTable.followingId, userId))),
    database
      .select()
      .from(friendshipsTable)
      .where(or(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, userId))),
    database.select().from(postsTable).where(eq(postsTable.userId, userId)),
    database.select().from(postLikesTable).where(eq(postLikesTable.userId, userId)),
    database.select().from(postCommentsTable).where(eq(postCommentsTable.userId, userId)),
    database
      .select()
      .from(chatMessagesTable)
      .where(or(eq(chatMessagesTable.senderId, userId), eq(chatMessagesTable.receiverId, userId))),
    database.select().from(communityMessagesTable).where(eq(communityMessagesTable.userId, userId)),
    database.select().from(communityFilesTable).where(eq(communityFilesTable.userId, userId)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    userId,
    formatVersion: 1,
    categories: ACCOUNT_EXPORT_CATEGORIES,
    data: {
      profile,
      settings,
      pushSubscriptions: pushSubscriptions.map(({ p256dh, auth, ...item }) => item),
      journal: {
        entries: journalEntries,
        tags: journalTags,
        recaps: journalRecaps,
        checkins,
      },
      productivity: {
        ideas,
        checklist,
        quotes,
        missions,
        missionTemplates,
        routineCompletions,
        levelCertificates,
      },
      trading: {
        accountTrades,
        backtestSessions,
        backtestTrades,
      },
      news: {
        preferences: newsPreferences,
        feedback: newsFeedback,
      },
      social: {
        follows,
        friendships,
        posts,
        postLikes,
        postComments,
        directMessages,
        communityMessages,
        communityFiles,
      },
    },
  };
}
