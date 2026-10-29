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

// Closed-trade reads (profile win-rate, edge/trading-coach, exports) filter
// account_trades by (user_id) and (user_id, status='closed'); the unique index
// leads with `source`, so it cannot serve them. The composite covers both the
// userId-only and (userId, status) shapes via its leftmost prefix.
const accountSource = readSchema("./account.ts");
assert.match(accountSource, /index\("account_trades_user_status_idx"\)\.on\(table\.userId, table\.status\)/);

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

const wikiSource = readSchema("./wiki.ts");
assert.match(wikiSource, /index\("wiki_sources_storage_key_idx"\)\.on\(table\.storageKey\)/);

const backtestTournamentSource = readSchema("./backtestTournament.ts");
assert.match(backtestTournamentSource, /index\("backtest_tournament_entries_user_idx"\)\.on\(t\.userId\)/);
assert.match(backtestTournamentSource, /index\("backtest_custom_lobbies_host_idx"\)\.on\(t\.hostUserId\)/);

const torneiSource = readSchema("./tornei.ts");
assert.match(torneiSource, /index\("tournament_prizes_user_idx"\)\.on\(t\.userId\)/);

const adminSource = readSchema("./admin.ts");
assert.match(adminSource, /index\("candidate_applications_user_idx"\)\.on\(table\.userId\)/);

const traderProcessSource = readSchema("./traderProcess.ts");
assert.match(traderProcessSource, /index\("process_evidence_session_idx"\)\.on\(t\.sessionId\)/);

assert.match(communitySource, /index\("community_join_requests_user_idx"\)\.on\(t\.userId\)/);
assert.match(communitySource, /index\("community_moderation_log_target_idx"\)\.on\(t\.targetUserId\)/);

const academyBillingSource = readSchema("./academyBilling.ts");
assert.match(academyBillingSource, /index\("academy_payout_affiliate_idx"\)\.on\(t\.affiliateUserId\)/);

const academySource = readSchema("./academy.ts");
assert.match(academySource, /index\("academy_lessons_module_idx"\)\.on\(table\.moduleId, table\.orderIndex\)/);

const arsenalOrdersSource = readSchema("./arsenalOrders.ts");
assert.match(arsenalOrdersSource, /index\("arsenal_orders_created_idx"\)\.on\(t\.createdAt\)/);

assert.match(journalSource, /index\("journal_images_file_path_idx"\)\.on\(table\.filePath\)/);
assert.match(profileSource, /index\("profile_xp_idx"\)\.on\(table\.xp\)/);
assert.match(traderProcessSource, /index\("process_evidence_user_observed_idx"\)\.on\(t\.userId, t\.observedAt\)/);

console.log("database scalability index checks passed");
