import assert from "node:assert/strict";

import {
  getClientErrorMessage,
  reportClientError,
} from "./clientErrorReporter.js";

assert.equal(getClientErrorMessage(new Error("Network down")), "Network down");
assert.equal(getClientErrorMessage("plain failure"), "plain failure");
assert.equal(getClientErrorMessage(null, "Fallback"), "Fallback");

{
  const warnings: unknown[][] = [];
  const toasts: Array<{ description: string; variant?: string }> = [];

  reportClientError(new Error("Upload failed"), {
    context: "upload background",
    fallbackMessage: "Operazione non riuscita.",
    consoleWarn: (...args) => warnings.push(args),
    toast: (payload) => toasts.push(payload),
  });

  assert.equal(warnings.length, 1);
  assert.equal(String(warnings[0]?.[0]), "[upload background]");
  assert.deepEqual(toasts, [
    { description: "Upload failed", variant: "destructive" },
  ]);
}

{
  const toasts: unknown[] = [];
  reportClientError("quiet failure", {
    context: "background sync",
    notify: false,
    consoleWarn: () => {},
    toast: (payload) => toasts.push(payload),
  });

  assert.deepEqual(toasts, []);
}

console.log("client error reporter checks passed");
