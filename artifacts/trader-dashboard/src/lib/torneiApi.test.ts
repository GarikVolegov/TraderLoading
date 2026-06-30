import assert from "node:assert/strict";
import {
  torneiCurrentKey,
  torneiStandingsKey,
  torneiMeKey,
  torneiHallKey,
  torneiCertificatesKey,
} from "./torneiApi";

// ── le query key sono stabili e distinguono la metrica ───────────────────────
{
  assert.deepEqual(torneiCurrentKey(), ["/api/tornei/current"]);
  assert.deepEqual(torneiMeKey(), ["/api/tornei/me"]);
  assert.deepEqual(torneiHallKey(), ["/api/tornei/hall"]);
  assert.deepEqual(torneiCertificatesKey(), ["/api/tornei/certificates"]);
  assert.deepEqual(torneiStandingsKey("r"), ["/api/tornei/standings", "r"]);
  assert.deepEqual(torneiStandingsKey("ts"), ["/api/tornei/standings", "ts"]);
  assert.notDeepEqual(torneiStandingsKey("r"), torneiStandingsKey("ts"));
}

console.log("torneiApi.test.ts: all assertions passed");
