import assert from "node:assert/strict";
import fs from "node:fs";

const robots = fs.readFileSync("public/robots.txt", "utf8");

// Every authenticated-app top-level route (App.tsx AppRouter) must be disallowed
// for anonymous crawlers.
const authenticatedRoutes = [
  "/journal",
  "/zen",
  "/chat",
  "/news",
  "/routine",
  "/broker",
  "/calendar",
  "/milestones",
  "/missions",
  "/clock",
  "/checklist",
  "/library",
  "/settings",
  "/tools",
  "/pro",
  "/admin",
  "/wiki",
  "/tornei",
  "/support",
  "/welcome",
  "/styleguide",
];

for (const route of authenticatedRoutes) {
  assert.match(
    robots,
    new RegExp(`Disallow: ${route.replace(/\//g, "\\/")}(\\$|\\n)`),
    `robots.txt must disallow ${route}`,
  );
}

console.log("robots.txt static check passed");
