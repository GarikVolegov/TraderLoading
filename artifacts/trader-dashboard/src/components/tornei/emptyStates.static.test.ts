import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hall = readFileSync(new URL("./HallOfFame.tsx", import.meta.url), "utf8");
const percorso = readFileSync(new URL("./PercorsoView.tsx", import.meta.url), "utf8");

// Usability audit (live-sweep): a concluded season with zero participants has
// a hall-of-fame row but no champion — it used to render raw "—"/"—%" instead
// of a clear "no participants" label.
assert.match(hall, /e\.champion \?\? t\("tornei\.hall\.no_champion"\)/);
assert.match(hall, /\{e\.champion && \(/);

// Usability audit (live-sweep): the "I tuoi certificati" section vanished
// entirely for an enrolled user with zero certificates, with no explanation
// that certs arrive at season end if they qualify.
assert.match(percorso, /t\("tornei\.percorso\.noCertsYet"\)/);
assert.match(percorso, /me\.certificates\.length > 0 \? \(/);

console.log("tornei empty-state checks passed");
