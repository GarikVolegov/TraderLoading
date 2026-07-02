import assert from "node:assert/strict";

// Substring patterns for browser APIs that trigger a permission prompt.
// storage.persist( is deliberately qualified: bare persist( is zustand middleware.
const FORBIDDEN_PATTERNS = [
  ".requestPermission(",
  "getUserMedia(",
  "getDisplayMedia(",
  ".getCurrentPosition(",
  ".watchPosition(",
  "pushManager.subscribe(",
  "clipboard.read",
  "storage.persist(",
  "requestMIDIAccess",
  ".requestDevice(",
] as const;

type ForbiddenPattern = (typeof FORBIDDEN_PATTERNS)[number];

// Every entry is a user-gesture call site reviewed on 2026-07-03. Adding a file
// or pattern here is a deliberate, reviewable act — see POLICY below.
const PERMISSION_ALLOWLIST: Record<string, readonly ForbiddenPattern[]> = {
  "hooks/usePushNotifications.ts": [".requestPermission(", "pushManager.subscribe("],
  "components/social/MessaggiTab.tsx": ["getUserMedia("],
  "components/social/StoryViewer.tsx": ["getUserMedia("],
  "components/social/VoiceChannelView.tsx": ["getUserMedia("],
};

type Violation = { file: string; line: number; pattern: string };

function findPermissionViolations(source: string, relPath: string): Violation[] {
  const allowed = new Set<ForbiddenPattern>(PERMISSION_ALLOWLIST[relPath] ?? []);
  const violations: Violation[] = [];
  source.split(/\r?\n/).forEach((line, index) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (line.includes(pattern) && !allowed.has(pattern)) {
        violations.push({ file: relPath, line: index + 1, pattern });
      }
    }
  });
  return violations;
}

// --- scanner self-tests on synthetic sources ---

assert.deepEqual(
  findPermissionViolations("navigator.geolocation.getCurrentPosition(onOk);", "pages/Dashboard.tsx"),
  [{ file: "pages/Dashboard.tsx", line: 1, pattern: ".getCurrentPosition(" }],
  "forbidden pattern in a non-allowlisted file must be flagged",
);

assert.deepEqual(
  findPermissionViolations(
    "const x = compute(1);\nawait navigator.clipboard.writeText(text);\npersist(store);",
    "pages/Clean.tsx",
  ),
  [],
  "clipboard.writeText and zustand persist( must not be flagged",
);

assert.deepEqual(
  findPermissionViolations("const p = await Notification.requestPermission();", "hooks/usePushNotifications.ts"),
  [],
  "allowlisted pattern in its allowlisted file must pass",
);

assert.deepEqual(
  findPermissionViolations("navigator.mediaDevices.getUserMedia({ audio: true });", "hooks/usePushNotifications.ts"),
  [{ file: "hooks/usePushNotifications.ts", line: 1, pattern: "getUserMedia(" }],
  "a different forbidden pattern in an allowlisted file must still be flagged",
);

console.log("permission hygiene static checks passed");
