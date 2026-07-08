// Deep, transactional deletion of communities and channels. There are no FK
// cascades on the community tables, so the old handlers left orphaned messages,
// files, reviews, reports and voice-presence rows (finding 2.9). Each function
// runs one transaction and returns the file URLs the caller should unlink from
// disk (best-effort — this service doesn't own the uploads dir).

import { eq, sql } from "drizzle-orm";
import { db as defaultDb, communityFilesTable } from "@workspace/db";

type DatabaseLike = typeof defaultDb;

/** Delete a community and every child row across all community tables. */
export async function deleteCommunityDeep(
  communityId: number,
  database: DatabaseLike = defaultDb,
): Promise<string[]> {
  const files = await database
    .select({ fileUrl: communityFilesTable.fileUrl })
    .from(communityFilesTable)
    .where(eq(communityFilesTable.communityId, communityId));

  await database.transaction(async (tx) => {
    // Children keyed indirectly (via channel/review) first, then direct children,
    // then the community row itself.
    await tx.execute(sql`
      DELETE FROM community_review_reports
      WHERE review_id IN (SELECT id FROM community_reviews WHERE community_id = ${communityId})
    `);
    await tx.execute(sql`DELETE FROM community_reviews WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM community_message_reports WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM community_join_requests WHERE community_id = ${communityId}`);
    await tx.execute(sql`
      DELETE FROM community_messages
      WHERE channel_id IN (SELECT id FROM community_channels WHERE community_id = ${communityId})
    `);
    await tx.execute(sql`
      DELETE FROM voice_presence
      WHERE channel_id IN (SELECT id FROM community_channels WHERE community_id = ${communityId})
    `);
    await tx.execute(sql`DELETE FROM community_files WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM community_channels WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM community_members WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM community_roles WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM community_bans WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM community_mutes WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM community_moderation_log WHERE community_id = ${communityId}`);
    await tx.execute(sql`DELETE FROM communities WHERE id = ${communityId}`);
  });

  return files.map((f) => f.fileUrl);
}

/** Delete a channel and every child row (messages, files, voice presence). */
export async function deleteChannelDeep(
  channelId: number,
  database: DatabaseLike = defaultDb,
): Promise<string[]> {
  const files = await database
    .select({ fileUrl: communityFilesTable.fileUrl })
    .from(communityFilesTable)
    .where(eq(communityFilesTable.channelId, channelId));

  await database.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM community_messages WHERE channel_id = ${channelId}`);
    await tx.execute(sql`DELETE FROM voice_presence WHERE channel_id = ${channelId}`);
    await tx.execute(sql`DELETE FROM community_files WHERE channel_id = ${channelId}`);
    await tx.execute(sql`DELETE FROM community_channels WHERE id = ${channelId}`);
  });

  return files.map((f) => f.fileUrl);
}
