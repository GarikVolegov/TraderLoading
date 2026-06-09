import { GetLeaderboardResponse } from "./generated/api.js";

const parsed = GetLeaderboardResponse.parse([
  {
    position: 1,
    userId: "user-1",
    name: "Ari",
    avatarUrl: "/api/uploads/avatars/ari.png",
    level: 7,
    xp: 3200,
  },
]);

if (parsed[0]?.userId !== "user-1") {
  throw new Error(`Expected userId to survive leaderboard schema parsing, got ${String(parsed[0]?.userId)}`);
}

if (parsed[0]?.avatarUrl !== "/api/uploads/avatars/ari.png") {
  throw new Error(`Expected avatarUrl to survive leaderboard schema parsing, got ${String(parsed[0]?.avatarUrl)}`);
}

console.log("leaderboard schema checks passed");
