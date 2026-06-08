# Persistent Session And Cookie Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure API requests preserve auth cookies by default and add a global cookie consent popup.

**Architecture:** Harden the shared generated API fetch wrapper and add a small React component with a testable storage helper. Keep the backend session/database model unchanged.

**Tech Stack:** TypeScript, React, Vite, Node assert tests, PNPM workspace.

---

## File Structure

- Modify `lib/api-client-react/src/custom-fetch.ts`: default generated API requests to `credentials: "include"` while preserving explicit overrides.
- Create `lib/api-client-react/src/custom-fetch.test.ts`: focused tests for default and overridden credentials.
- Create `artifacts/trader-dashboard/src/lib/cookieConsent.ts`: storage-safe consent helpers and constants.
- Create `artifacts/trader-dashboard/src/lib/cookieConsent.test.ts`: tests for missing, accepted, accepting, and failing storage cases.
- Create `artifacts/trader-dashboard/src/components/CookieConsentPopup.tsx`: global popup UI.
- Create `artifacts/trader-dashboard/src/components/CookieConsentPopup.static.test.ts`: static integration checks for component copy and storage helper usage.
- Modify `artifacts/trader-dashboard/src/App.tsx`: mount the popup globally.

---

### Task 1: Generated API Credentials

**Files:**
- Test: `lib/api-client-react/src/custom-fetch.test.ts`
- Modify: `lib/api-client-react/src/custom-fetch.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { customFetch } from "./custom-fetch.js";

const originalFetch = globalThis.fetch;

try {
  {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await customFetch("/api/settings", { responseType: "json" });

    assert.equal(calls[0]?.init?.credentials, "include");
  }

  {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await customFetch("/api/public", {
      responseType: "json",
      credentials: "omit",
    });

    assert.equal(calls[0]?.init?.credentials, "omit");
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log("custom fetch credential defaults passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/api-client-react exec tsx src/custom-fetch.test.ts`

Expected: FAIL because `calls[0].init.credentials` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `customFetch`, change the final fetch call to:

```ts
const response = await fetch(input, {
  credentials: "include",
  ...init,
  method,
  headers,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/api-client-react exec tsx src/custom-fetch.test.ts`

Expected: PASS and print `custom fetch credential defaults passed`.

---

### Task 2: Cookie Consent Helpers

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/cookieConsent.ts`
- Test: `artifacts/trader-dashboard/src/lib/cookieConsent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import {
  COOKIE_CONSENT_ACCEPTED_VALUE,
  COOKIE_CONSENT_STORAGE_KEY,
  acceptCookieConsent,
  hasAcceptedCookieConsent,
} from "./cookieConsent.js";

function createStorage(throws = false): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      if (throws) throw new Error("storage unavailable");
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      if (throws) throw new Error("storage unavailable");
      values.set(key, value);
    },
  };
}

const storage = createStorage();
assert.equal(hasAcceptedCookieConsent(storage), false);

acceptCookieConsent(storage);

assert.equal(
  storage.getItem(COOKIE_CONSENT_STORAGE_KEY),
  COOKIE_CONSENT_ACCEPTED_VALUE,
);
assert.equal(hasAcceptedCookieConsent(storage), true);

assert.equal(hasAcceptedCookieConsent(createStorage(true)), false);
assert.doesNotThrow(() => acceptCookieConsent(createStorage(true)));

console.log("cookie consent storage helpers passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/lib/cookieConsent.test.ts`

Expected: FAIL because `cookieConsent.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export const COOKIE_CONSENT_STORAGE_KEY = "tl_cookie_consent_v1";
export const COOKIE_CONSENT_ACCEPTED_VALUE = "accepted";

export function hasAcceptedCookieConsent(storage: Storage | undefined = globalThis.localStorage): boolean {
  try {
    return storage?.getItem(COOKIE_CONSENT_STORAGE_KEY) === COOKIE_CONSENT_ACCEPTED_VALUE;
  } catch {
    return false;
  }
}

export function acceptCookieConsent(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_ACCEPTED_VALUE);
  } catch {
    // Consent still hides for the current render; storage may be blocked.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/lib/cookieConsent.test.ts`

Expected: PASS and print `cookie consent storage helpers passed`.

---

### Task 3: Cookie Consent Popup

**Files:**
- Create: `artifacts/trader-dashboard/src/components/CookieConsentPopup.tsx`
- Test: `artifacts/trader-dashboard/src/components/CookieConsentPopup.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/App.tsx`

- [ ] **Step 1: Write the failing static test**

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("src/components/CookieConsentPopup.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

assert.match(component, /hasAcceptedCookieConsent/);
assert.match(component, /acceptCookieConsent/);
assert.match(component, /Accetta/);
assert.match(component, /sessione/);
assert.match(component, /aggiornamenti/);
assert.match(app, /CookieConsentPopup/);
assert.match(app, /<CookieConsentPopup \/>/);

console.log("cookie consent popup integration checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/CookieConsentPopup.static.test.ts`

Expected: FAIL because `CookieConsentPopup.tsx` does not exist or is not mounted.

- [ ] **Step 3: Write minimal component**

```tsx
import { useState } from "react";
import { acceptCookieConsent, hasAcceptedCookieConsent } from "@/lib/cookieConsent";
import { Button } from "@/components/ui/button";

export function CookieConsentPopup() {
  const [visible, setVisible] = useState(() => !hasAcceptedCookieConsent());

  if (!visible) return null;

  const handleAccept = () => {
    acceptCookieConsent();
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-xl rounded-lg border border-border bg-background/95 p-4 shadow-2xl backdrop-blur md:bottom-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-muted-foreground">
          Usiamo cookie tecnici per mantenere attiva la sessione e salvare i tuoi dati durante refresh e aggiornamenti dell'app.
        </p>
        <Button type="button" onClick={handleAccept} className="shrink-0">
          Accetta
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount globally in `App.tsx`**

Add the import:

```ts
import { CookieConsentPopup } from "./components/CookieConsentPopup";
```

Render it near `Toaster`:

```tsx
<CookieConsentPopup />
<Toaster />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/components/CookieConsentPopup.static.test.ts`

Expected: PASS and print `cookie consent popup integration checks passed`.

---

### Task 4: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
pnpm --filter @workspace/api-client-react exec tsx src/custom-fetch.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/cookieConsent.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/CookieConsentPopup.static.test.ts
```

Expected: all three commands exit 0.

- [ ] **Step 2: Run typechecks**

Run:

```powershell
pnpm --filter @workspace/api-client-react typecheck
pnpm --filter @workspace/trader-dashboard typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Review diff**

Run: `git diff -- lib/api-client-react/src/custom-fetch.ts lib/api-client-react/src/custom-fetch.test.ts artifacts/trader-dashboard/src/lib/cookieConsent.ts artifacts/trader-dashboard/src/lib/cookieConsent.test.ts artifacts/trader-dashboard/src/components/CookieConsentPopup.tsx artifacts/trader-dashboard/src/components/CookieConsentPopup.static.test.ts artifacts/trader-dashboard/src/App.tsx`

Expected: diff only contains credential defaulting, cookie consent helper/component, tests, and App mount.
