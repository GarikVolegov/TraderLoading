// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // ── Ignored paths (build output, deps, generated, data) ──────────────────
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
      "lib/db/drizzle/**",
      ".local-postgres/**",
      ".local-logs/**",
      ".superpowers/**",
      ".agents/**",
      "artifacts/*/public/**",
      "artifacts/api-server/uploads/**",
    ],
  },

  // ── Base: JS + TypeScript recommended (non-type-checked: fast, no noise) ──
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Project-wide rule posture ────────────────────────────────────────────
  // Discipline already in place (0 @ts-ignore, 0 eslint-disable). These rules
  // are a RATCHET: noisy ones start as "warn" so CI stays green, then tighten
  // to "error" as the backlog is burned down.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Structural/legacy rules: keep visible as backlog, do not hard-block.
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "no-console": "off",
    },
  },

  // ── Plain JS / ESM / CJS config & glue files (no TS type info) ────────────
  {
    files: ["**/*.{js,cjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // ── Frontend (React) ─────────────────────────────────────────────────────
  {
    files: ["artifacts/trader-dashboard/**/*.{ts,tsx}", "artifacts/mockup-sandbox/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // ── Backend / scripts / libs (Node) ──────────────────────────────────────
  {
    files: ["artifacts/api-server/**/*.ts", "lib/**/*.ts", "scripts/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },

  // ── api-server is now free of explicit `any`: enforce it as a hard error so
  // it cannot regress. The frontend keeps `any` at warn (ratchet). The test
  // override below re-disables it for *.test files. ─────────────────────────
  {
    files: ["artifacts/api-server/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },

  // ── Test files: looser ───────────────────────────────────────────────────
  {
    files: ["**/*.test.{ts,tsx}", "**/*.static.test.{ts,mjs}"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // ── Prettier last: turn off all formatting-related lint rules ─────────────
  prettier,
);
