import assert from "node:assert/strict";
import { hasExplicitCenterView, centerView, legacyCheckoutChannel, resolveWorkspaceAlias, updateWorkspaceQuery } from "./workspaceNavigation";

assert.equal(updateWorkspaceQuery("?pair=EUR%2FUSD&t=trades&new=1", { t: "piano", new: null }), "?pair=EUR%2FUSD&t=piano");
assert.equal(updateWorkspaceQuery("?t=piano", { t: null }), "");
assert.equal(updateWorkspaceQuery("?vista=strumenti&layout=edit&pair=EURUSD", { vista: "strumenti", layout: null }), "?vista=strumenti&pair=EURUSD");
assert.equal(resolveWorkspaceAlias("/resources"), "/");
assert.equal(resolveWorkspaceAlias("/routine"), null);
assert.equal(resolveWorkspaceAlias("/broker", "?tab=history"), "/journal?tab=history&t=trades&panel=conti");
assert.equal(resolveWorkspaceAlias("/news", "?pair=XAUUSD&article=example"), "/?pair=XAUUSD&article=example&vista=notizie");
assert.equal(resolveWorkspaceAlias("/tornei"), "/chat?t=competizioni&vista=torneo");
assert.equal(resolveWorkspaceAlias("/backtest"), null);
assert.equal(centerView("?layout=edit&pair=EURUSD"), "strumenti");
assert.equal(centerView("?vista=unknown"), "mercati");
console.log("workspace navigation compatibility checks passed");

assert.equal(resolveWorkspaceAlias("/", "?channel=34&unlock=success"), "/chat?channel=34&unlock=success&t=conversazioni");
assert.equal(legacyCheckoutChannel("?channel=34&unlock=cancel"), 34);
for (const search of ["?channel=34", "?channel=-1&unlock=success", "?channel=34&community=invalid&unlock=success", "?channel=34&peer=user&unlock=success", "?channel=34&t=competizioni&unlock=success", "?channel=9007199254740992&unlock=success"]) {
  assert.equal(legacyCheckoutChannel(search), null, search);
  assert.equal(resolveWorkspaceAlias("/", search), null, search);
}

assert.equal(resolveWorkspaceAlias("/", "?vista=mercati&pair=EURUSD"), "/?pair=EURUSD");
assert.equal(hasExplicitCenterView(""), false);
assert.equal(hasExplicitCenterView("?pair=EURUSD"), false);
assert.equal(hasExplicitCenterView("?article=existing"), true);
assert.equal(centerView("?article=existing"), "notizie");
assert.equal(hasExplicitCenterView("?vista=notizie"), true);
assert.equal(hasExplicitCenterView("?pair=EURUSD&marketDecisionId=existing"), false);
