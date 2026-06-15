import { sql } from "drizzle-orm";
import { db as defaultDb } from "@workspace/db";
import { brokerHubRuntime } from "./brokerHub/runtime.js";

export const ACCOUNT_DELETION_CATEGORIES = [
  "auth-provider",
  "profile",
  "journal",
  "trading-data",
  "push-notifications",
  "social-community",
  "chat-security",
  "broker-connections",
  "supporting-preferences",
] as const;

export type AccountDeletionCategory = (typeof ACCOUNT_DELETION_CATEGORIES)[number];

export interface AccountDeletionDisclosure {
  title: string;
  deletedData: string[];
  retainedData: string[];
  confirmationPhrase: "ELIMINA";
}

type DatabaseLike = typeof defaultDb;

interface DeleteAccountDataOptions {
  db?: DatabaseLike;
  deleteAuthProviderUser?: (userId: string) => Promise<"deleted" | "skipped">;
  cleanupBrokerProfiles?: (userId: string) => Promise<number>;
}

export interface AccountDeletionResult {
  deleted: true;
  authProvider: "deleted" | "skipped";
  brokerProfilesDeleted: number;
}

export function getAccountDeletionDisclosure(): AccountDeletionDisclosure {
  return {
    title: "Elimina account",
    deletedData: [
      "Profilo, impostazioni, preferenze privacy e notifiche push.",
      "Diario di trading, immagini, tag, recap, check-in, routine e missioni.",
      "Dati di trading sincronizzati, backtest e fonti caricate nell'archivio.",
      "Messaggi, chiavi chat, relazioni social, post, commenti e dati community collegati al tuo account.",
      "Connessioni broker, segreti operativi e dati account importati.",
    ],
    retainedData: [
      "Log tecnici minimi possono restare per sicurezza, antifrode o obblighi legali, come descritto nella Privacy Policy.",
      "Contenuti già aggregati o anonimizzati non riconducibili all'account possono essere conservati.",
    ],
    confirmationPhrase: "ELIMINA",
  };
}

async function deleteClerkUser(userId: string): Promise<"deleted" | "skipped"> {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) return "skipped";

  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.ok || response.status === 404) return "deleted";

  const detail = await response.text().catch(() => "");
  throw new Error(
    `Clerk account deletion failed (${response.status}): ${detail.slice(0, 180)}`,
  );
}

async function cleanupDefaultBrokerProfiles(userId: string): Promise<number> {
  const list = await brokerHubRuntime.listProfiles();
  const ownedProfiles = list.profiles.filter(
    (profile) => profile.ownerUserId === userId,
  );

  for (const profile of ownedProfiles) {
    await brokerHubRuntime.deleteProfile(profile.id);
  }

  return ownedProfiles.length;
}

async function deleteLocalAccountData(database: DatabaseLike, userId: string) {
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      DELETE FROM post_comments
      WHERE user_id = ${userId}
         OR post_id IN (SELECT id FROM posts WHERE user_id = ${userId})
    `);
    await tx.execute(sql`
      DELETE FROM post_likes
      WHERE user_id = ${userId}
         OR post_id IN (SELECT id FROM posts WHERE user_id = ${userId})
    `);
    await tx.execute(sql`DELETE FROM posts WHERE user_id = ${userId}`);
    await tx.execute(sql`
      DELETE FROM follows
      WHERE follower_id = ${userId} OR following_id = ${userId}
    `);

    await tx.execute(sql`
      DELETE FROM chat_messages
      WHERE sender_id = ${userId} OR receiver_id = ${userId}
    `);
    await tx.execute(sql`
      DELETE FROM friendships
      WHERE user_id = ${userId} OR friend_id = ${userId}
    `);
    await tx.execute(sql`DELETE FROM user_public_keys WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM user_e2ee_key_backups WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM global_chat_messages WHERE user_id = ${userId}`);
    await tx.execute(sql`
      DELETE FROM signals
      WHERE recipient_id = ${userId} OR from_id = ${userId}
    `);

    await tx.execute(sql`
      DELETE FROM voice_presence
      WHERE user_id = ${userId}
         OR channel_id IN (
           SELECT id FROM community_channels
           WHERE community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
         )
    `);
    await tx.execute(sql`
      DELETE FROM community_files
      WHERE user_id = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    await tx.execute(sql`
      DELETE FROM community_messages
      WHERE user_id = ${userId}
         OR channel_id IN (
           SELECT id FROM community_channels
           WHERE community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
         )
    `);
    await tx.execute(sql`
      DELETE FROM community_members
      WHERE user_id = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    await tx.execute(sql`
      DELETE FROM community_channels
      WHERE community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    await tx.execute(sql`DELETE FROM communities WHERE creator_id = ${userId}`);

    await tx.execute(sql`
      DELETE FROM journal_images
      WHERE entry_id IN (SELECT id FROM journal_entries WHERE user_id = ${userId})
    `);
    await tx.execute(sql`DELETE FROM account_trades WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM journal_recaps WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM journal_tags WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM journal_entries WHERE user_id = ${userId}`);

    await tx.execute(sql`DELETE FROM backtest_trades WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM backtest_sessions WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM routine_completions WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM news_feedback WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM news_preferences WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM level_certificates WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM missions WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM mission_templates WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM checkins WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM checklist_items WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM ideas WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM quotes WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM user_settings WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM login_access WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM profile WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM users WHERE id = ${userId}`);
  });
}

export async function deleteAccountData(
  userId: string,
  options: DeleteAccountDataOptions = {},
): Promise<AccountDeletionResult> {
  if (!userId.trim()) throw new Error("Missing user id for account deletion");

  const database = options.db ?? defaultDb;
  const cleanupBrokerProfiles =
    options.cleanupBrokerProfiles ?? cleanupDefaultBrokerProfiles;
  const deleteAuthProviderUser =
    options.deleteAuthProviderUser ?? deleteClerkUser;

  const brokerProfilesDeleted = await cleanupBrokerProfiles(userId);
  await deleteLocalAccountData(database, userId);
  const authProvider = await deleteAuthProviderUser(userId);

  return {
    deleted: true,
    authProvider,
    brokerProfilesDeleted,
  };
}
