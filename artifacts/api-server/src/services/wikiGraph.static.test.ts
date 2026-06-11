import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
const { isQueryableWikiText } = await import("./wikiGraph.js");

assert.equal(isQueryableWikiText("pending_transcription: lesson.mp4 uploaded but not transcribed"), false);
assert.equal(isQueryableWikiText("   pending_transcription: call.wav"), false);
assert.equal(isQueryableWikiText("unextractable_pdf: eclipse2.pdf caricato ma senza testo estraibile"), false);
assert.equal(isQueryableWikiText("archived_file: archive.zip caricato e conservato"), false);
assert.equal(isQueryableWikiText("La mia strategia usa breakout e gestione rischio."), true);
assert.equal(isQueryableWikiText(""), false);

console.log("wiki graph static checks passed");
