import { eq, sql } from "drizzle-orm";
import { db as defaultDb, wikiSourcesTable } from "@workspace/db";
import { brokerHubRuntime } from "./brokerHub/runtime.js";
import { createWikiStorageFromEnv } from "./wikiStorage.js";

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
  cleanupStorage?: (database: DatabaseLike, userId: string) => Promise<void>;
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

// Remove the archive's binary files (local disk or S3/R2). Their storage keys
// must be read before the wiki_sources rows are deleted, so this runs before
// deleteLocalAccountData. Best effort: a failed file delete must not block the
// DB erasure of the account.
async function cleanupWikiStorageFiles(
  database: DatabaseLike,
  userId: string,
): Promise<void> {
  const rows = await database
    .select({ storageKey: wikiSourcesTable.storageKey })
    .from(wikiSourcesTable)
    .where(eq(wikiSourcesTable.userId, userId));
  const keys = rows
    .map((row) => row.storageKey)
    .filter((key): key is string => Boolean(key));
  if (keys.length === 0) return;
  const storage = createWikiStorageFromEnv();
  for (const key of keys) {
    await storage.delete(key).catch(() => {});
  }
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
    await tx.execute(sql`DELETE FROM chat_file_access WHERE owner_user_id = ${userId} OR peer_user_id = ${userId}`);
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
    // Join requests: the user's own, requests to their owned communities, and
    // scrub them as an approver of others' requests (audit 0.5b + GDPR).
    await tx.execute(sql`
      DELETE FROM community_join_requests
      WHERE user_id = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    await tx.execute(sql`
      UPDATE community_join_requests SET decided_by_user_id = NULL WHERE decided_by_user_id = ${userId}
    `);
    // Paid-channel entitlements (sub-project C): the user's own purchases and every
    // entitlement in their owned communities (before those channels are deleted).
    await tx.execute(sql`
      DELETE FROM community_channel_entitlements
      WHERE user_id = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    await tx.execute(sql`
      DELETE FROM community_channels
      WHERE community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    // Moderation + review tables have no real FK to communities, so they must be
    // cleared explicitly here (before communities is deleted, while the owned-
    // community subselect still resolves). Reports reference reviews, so first.
    await tx.execute(sql`
      DELETE FROM community_review_reports
      WHERE reporter_user_id = ${userId}
         OR review_id IN (
           SELECT id FROM community_reviews
           WHERE user_id = ${userId}
              OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
         )
    `);
    await tx.execute(sql`
      DELETE FROM community_reviews
      WHERE user_id = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    // Message reports the user filed, plus every report in the communities they own.
    await tx.execute(sql`
      DELETE FROM community_message_reports
      WHERE reporter_user_id = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    // Scrub the user's moderator identity from reports they resolved for others.
    await tx.execute(sql`
      UPDATE community_message_reports SET resolved_by = NULL WHERE resolved_by = ${userId}
    `);
    await tx.execute(sql`
      DELETE FROM community_roles
      WHERE community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    await tx.execute(sql`
      DELETE FROM community_bans
      WHERE user_id = ${userId}
         OR banned_by = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    await tx.execute(sql`
      DELETE FROM community_mutes
      WHERE user_id = ${userId}
         OR muted_by = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
    `);
    // Moderation audit rows carry the user's Clerk id as actor or target; erase
    // those and any rows in communities they own (no FK, so not auto-cascaded).
    await tx.execute(sql`
      DELETE FROM community_moderation_log
      WHERE actor_user_id = ${userId}
         OR target_user_id = ${userId}
         OR community_id IN (SELECT id FROM communities WHERE creator_id = ${userId})
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

    // Personal archive (wiki): rows here; the binary files are removed
    // separately in deleteAccountData (their storage keys are read first).
    // ingest jobs -> sources -> folders for FK safety.
    await tx.execute(sql`DELETE FROM wiki_ingest_jobs WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM wiki_sources WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM wiki_folders WHERE user_id = ${userId}`);

    // Support tickets: messages (of the user's tickets or authored by the user)
    // before the tickets themselves.
    await tx.execute(sql`
      DELETE FROM support_ticket_messages
      WHERE ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ${userId})
         OR (author_type = 'user' AND author_id = ${userId})
    `);
    await tx.execute(sql`DELETE FROM support_tickets WHERE user_id = ${userId}`);

    // Tournaments: full erasure. The Hall of Fame simply won't list an erased
    // user. Any on-chain NFT persists on the blockchain by nature (disclosed),
    // but its DB row (name/avatar/wallet) is removed.
    await tx.execute(sql`DELETE FROM tournament_enrollments WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM tournament_prizes WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM tournament_standings WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM tournament_certificates WHERE user_id = ${userId}`);

    // Public review / marketing: the user's own testimonial is removed; drop
    // the erased user's id from moderation fields on other rows.
    await tx.execute(sql`DELETE FROM testimonials WHERE user_id = ${userId}`);
    await tx.execute(sql`UPDATE testimonials SET moderated_by = NULL WHERE moderated_by = ${userId}`);
    await tx.execute(sql`DELETE FROM review_prompt_state WHERE user_id = ${userId}`);

    // Admin: the user's own admin rows are removed; references to the erased
    // user as actor on OTHER admins' rows are nulled.
    await tx.execute(sql`DELETE FROM admin_user_subscriptions WHERE user_id = ${userId}`);
    await tx.execute(sql`UPDATE admin_user_subscriptions SET updated_by = NULL WHERE updated_by = ${userId}`);
    await tx.execute(sql`DELETE FROM admin_user_status WHERE user_id = ${userId}`);
    await tx.execute(sql`UPDATE admin_user_status SET updated_by = NULL WHERE updated_by = ${userId}`);
    await tx.execute(sql`DELETE FROM admin_users WHERE user_id = ${userId}`);
    await tx.execute(sql`UPDATE admin_users SET created_by = NULL WHERE created_by = ${userId}`);
    // Security audit trail is retained (legitimate interest / anti-fraud) but
    // its network PII is scrubbed for the erased actor.
    await tx.execute(sql`
      UPDATE admin_audit_logs SET ip_address = NULL, user_agent = NULL
      WHERE actor_user_id = ${userId}
    `);

    // Referral loop: the user's own code and any referral rows they took part in.
    await tx.execute(sql`DELETE FROM referral_codes WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM referrals WHERE referrer_user_id = ${userId} OR referred_user_id = ${userId}`);

    // Lifecycle-email state (welcome/digest/win-back timestamps + opt-out).
    await tx.execute(sql`DELETE FROM email_lifecycle_state WHERE user_id = ${userId}`);

    // Credit wallet + ledger. Credits have no cash value, so they are forfeited
    // on deletion (stated in ToS) — no payout owed (sub-project B).
    await tx.execute(sql`DELETE FROM credit_transactions WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM credit_wallets WHERE user_id = ${userId}`);

    // Creator payout records (sub-project D): erase OUR copy of the Connect linkage +
    // payout ledger. Stripe retains its own account/transfer records for legal/tax.
    await tx.execute(sql`DELETE FROM creator_payouts WHERE user_id = ${userId}`);
    await tx.execute(sql`DELETE FROM creator_payout_accounts WHERE user_id = ${userId}`);

    // Legacy express-session store (jsonb). No-op under Clerk, safe otherwise.
    await tx.execute(sql`DELETE FROM sessions WHERE sess->'user'->>'id' = ${userId}`);

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
  const cleanupStorage = options.cleanupStorage ?? cleanupWikiStorageFiles;

  const brokerProfilesDeleted = await cleanupBrokerProfiles(userId);
  await cleanupStorage(database, userId);
  await deleteLocalAccountData(database, userId);
  const authProvider = await deleteAuthProviderUser(userId);

  return {
    deleted: true,
    authProvider,
    brokerProfilesDeleted,
  };
}
