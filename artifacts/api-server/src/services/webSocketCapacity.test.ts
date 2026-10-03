import assert from "node:assert/strict";

import { isAtConnectionCapacity, maxWsClients } from "./webSocketCapacity.js";

// Default cap, with a positive-integer env override and garbage rejected.
assert.equal(maxWsClients({}), 10_000);
assert.equal(maxWsClients({ MAX_WS_CLIENTS: "500" }), 500);
assert.equal(maxWsClients({ MAX_WS_CLIENTS: "0" }), 10_000);
assert.equal(maxWsClients({ MAX_WS_CLIENTS: "-5" }), 10_000);
assert.equal(maxWsClients({ MAX_WS_CLIENTS: "abc" }), 10_000);

// At/over the cap is rejected; below is allowed.
assert.equal(isAtConnectionCapacity(0, 3), false);
assert.equal(isAtConnectionCapacity(2, 3), false);
assert.equal(isAtConnectionCapacity(3, 3), true);
assert.equal(isAtConnectionCapacity(4, 3), true);

console.log("websocket capacity checks passed");
