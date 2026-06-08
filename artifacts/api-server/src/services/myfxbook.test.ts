import assert from "node:assert/strict";
import { buildMyfxbookOutlookUrl } from "./myfxbook.js";

const session = "abc%2Fdef%3Dghi";
const url = buildMyfxbookOutlookUrl(session);

assert.equal(
  url,
  "https://www.myfxbook.com/api/get-community-outlook.json?session=abc%2Fdef%3Dghi",
);
assert.equal(url.includes("%252F"), false);

console.log("myfxbook service checks passed");
