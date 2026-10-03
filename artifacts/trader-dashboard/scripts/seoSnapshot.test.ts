import assert from "node:assert/strict";
import { isValidSnapshot } from "./seoSnapshot.ts";

const goodPage = `<!DOCTYPE html><html><body><div id="root"><h1>Trading journal</h1><p>Track every trade.</p></div></body></html>`;
assert.equal(isValidSnapshot(goodPage), true, "a real page with an h1 and no error marker must be valid");

const crashedPage = `<!DOCTYPE html><html><body><div id="root"><div role="alert" data-root-error-boundary><h1>Something went wrong</h1></div></body></html>`;
assert.equal(isValidSnapshot(crashedPage), false, "a page rendering the error boundary must be invalid even though it has an <h1>");

const emptyShell = `<!DOCTYPE html><html><body><div id="root"></div></body></html>`;
assert.equal(isValidSnapshot(emptyShell), false, "an empty SPA shell with no h1 must be invalid");

console.log("seoSnapshot validator tests passed");
