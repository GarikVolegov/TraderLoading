import assert from "node:assert/strict";
import { backgroundTasksEnabled } from "./localBackgroundTasks";
assert.equal(
  backgroundTasksEnabled({ NODE_ENV: "development", LOCAL_BACKGROUND_TASKS: "0" }),
  false,
);
assert.equal(backgroundTasksEnabled({ NODE_ENV: "development" }), true);
assert.equal(backgroundTasksEnabled({ NODE_ENV: "production", LOCAL_BACKGROUND_TASKS: "0" }), true);
assert.equal(backgroundTasksEnabled({ NODE_ENV: "test" }), true);
console.log(
  "Only an explicit local development setting disables startup jobs; production is unaffected",
);
