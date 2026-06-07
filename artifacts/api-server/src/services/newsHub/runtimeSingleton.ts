import { getNewsData } from "../../routes/news.js";
import { createNewsHubRuntime } from "./runtime.js";

export const newsHubRuntime = createNewsHubRuntime({
  refreshIntervalMs: Number(process.env.NEWS_REFRESH_INTERVAL_MS ?? 60_000),
  fetchSnapshot: ({ pairs, lang, force }) =>
    getNewsData({
      pairs: pairs ?? "",
      lang,
      noCache: force === true,
    }),
});
