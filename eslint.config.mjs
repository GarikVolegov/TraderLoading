// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
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
  // Discipline already in place (0 @ts-ignore, 0 eslint-disable). no-explicit-any
  // is fully burned down (0 in non-test source) and enforced as an error. The
  // remaining rules stay at "warn" as a ratchet until their backlog is cleared.
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // unused-imports owns unused detection: imports are auto-fixable errors,
      // vars stay a ratchet warning (underscore-prefix to intentionally keep).
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          // `const { secret, ...rest } = x` intentionally drops fields.
          ignoreRestSiblings: true,
          // catch vars are `unknown` (useUnknownInCatchVariables) and routinely
          // handled generically without inspection — don't require their use.
          caughtErrors: "none",
        },
      ],
      // Off by design: under strictNullChecks `!` is a deliberate tool where an
      // invariant the type system can't express guarantees non-null (e.g.
      // `req.admin!` inside routes gated by the admin-auth middleware).
      "@typescript-eslint/no-non-null-assertion": "off",
      // Allow the idiomatic Express type-augmentation patterns (these are the
      // standard way to type req.user / req.admin, not legacy smells).
      "@typescript-eslint/no-namespace": ["warn", { allowDeclarations: true }],
      "@typescript-eslint/no-empty-object-type": [
        "warn",
        { allowInterfaces: "with-single-extends" },
      ],
      // Remaining structural/legacy rules: visible as backlog, do not hard-block.
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "no-console": "off",
    },
  },

  // ── Plain JS / ESM / CJS config & glue files (no TS type info) ────────────
  {
    files: ["**/*.{js,cjs}"],
    // CommonJS glue / config files legitimately use require().
    rules: { "@typescript-eslint/no-require-imports": "off" },
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
    files: ["artifacts/trader-dashboard/**/*.{ts,tsx}"],
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
