import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSchema(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const profileSource = readSchema("./profile.ts");
assert.match(profileSource, /index\("profile_user_idx"\)\.on\(table\.userId\)/);

const extrasSource = readSchema("./extras.ts");
assert.match(extrasSource, /uniqueIndex\("user_settings_user_idx"\)\.on\(t\.userId\)/);
assert.match(extrasSource, /index\("push_subscriptions_user_idx"\)\.on\(t\.userId\)/);
assert.match(extrasSource, /index\("login_access_user_created_idx"\)\.on\(t\.userId, t\.createdAt\)/);

const missionsSource = readSchema("./missions.ts");
assert.match(missionsSource, /index\("missions_user_date_completed_idx"\)\.on\(table\.userId, table\.missionDate, table\.completed\)/);
assert.match(missionsSource, /index\("mission_templates_user_idx"\)\.on\(table\.userId\)/);

const journalSource = readSchema("./journal.ts");
assert.match(journalSource, /index\("journal_entries_user_created_idx"\)\.on\(table\.userId, table\.createdAt\)/);
assert.match(journalSource, /index\("journal_images_entry_idx"\)\.on\(table\.entryId\)/);

const signalsSource = readSchema("./signals.ts");
assert.match(signalsSource, /index\("signals_created_idx"\)\.on\(t\.createdAt\)/);

const backtestSource = readSchema("./backtest.ts");
assert.match(backtestSource, /index\("backtest_sessions_user_created_idx"\)\.on\(table\.userId, table\.createdAt\)/);
assert.match(backtestSource, /index\("backtest_trades_session_created_idx"\)\.on\(table\.sessionId, table\.createdAt\)/);

// Keyset-pagination composites for high-traffic chat/feed reads.
const chatSource = readSchema("./chat.ts");
assert.match(chatSource, /index\("idx_chat_sender_receiver_id"\)\.on\(table\.senderId, table\.receiverId, table\.id\)/);

const communitySource = readSchema("./community.ts");
assert.match(communitySource, /index\("community_messages_channel_id_idx"\)\.on\(t\.channelId, t\.id\)/);

const socialSource = readSchema("./social.ts");
assert.match(socialSource, /index\("post_comments_post_created_idx"\)\.on\(t\.postId, t\.createdAt\)/);

console.log("database scalability index checks passed");
