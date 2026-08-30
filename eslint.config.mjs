// Flat config (ESLint 9+). Deliberately small: the recommended sets only, so
// every warning that appears is one the wider JS/TS community agreed is worth
// hearing. Tighten later by adding rules, not by starting maximal and muting.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    // Not our code, or generated. Nothing here is worth linting.
    ignores: ["node_modules/**", "dist/**", "data/**", "coverage/**", "*.log"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // CommonJS config files (PM2 etc). Without this they lose `module`
    // and `__dirname` and get flagged as undefined.
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // 27 pre-existing `any`s. Each needs a real type worked out, which is
      // typing work, not lint cleanup. Kept visible as warnings so `npm run
      // lint` can exit 0 and any NEW error stands out. Raise to "error" once
      // the count reaches zero.
      "@typescript-eslint/no-explicit-any": "warn",
      // Deliberate throwaways are fine when named with a leading underscore:
      // catch (_err), (_req, res) => ... Everything else still gets flagged.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
);
