import assert from "node:assert/strict";

import { shouldNotifyGlobally } from "./mutationErrorPolicy.js";

// A mutation with no local error handling gets the global toast.
assert.equal(shouldNotifyGlobally({ options: {} }), true);
assert.equal(shouldNotifyGlobally({ options: { meta: {} } }), true);

// A mutation that defines its own onError already surfaces the failure — no double toast.
assert.equal(
  shouldNotifyGlobally({ options: { onError: () => {} } }),
  false,
);

// Opt-out for mutateAsync/try-catch call sites that show their own feedback.
assert.equal(
  shouldNotifyGlobally({ options: { meta: { suppressGlobalError: true } } }),
  false,
);

// Any other meta value (false, string junk…) does NOT opt out.
assert.equal(
  shouldNotifyGlobally({ options: { meta: { suppressGlobalError: false } } }),
  true,
);
assert.equal(
  shouldNotifyGlobally({ options: { meta: { suppressGlobalError: "yes" } } }),
  true,
);

// Defensive: missing options / undefined mutation notify (fail-open — better a
// generic toast than a silent failure).
assert.equal(shouldNotifyGlobally({}), true);
assert.equal(shouldNotifyGlobally(undefined), true);

console.log("mutation error policy checks passed");
