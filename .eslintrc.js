/**
 * .eslintrc.js — Root ESLint configuration for the Sw3 monorepo.
 *
 * Stack: TypeScript · React · Next.js · Node.js services
 *
 * Workspace packages can extend this config by specifying:
 *   { "extends": ["../../.eslintrc.js"] }
 * or by using a local .eslintrc.js that merges/overrides rules.
 *
 * Docs: https://eslint.org/docs/latest/use/configure/
 */

"use strict";

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,

  // ── Parser ──────────────────────────────────────────────────────────────
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
    // Point at the nearest tsconfig for type-aware rules.
    // Individual packages override this with their own tsconfig.json path.
    project: ["./tsconfig.json", "./packages/*/tsconfig.json", "./apps/*/tsconfig.json", "./services/*/tsconfig.json"],
    tsconfigRootDir: __dirname,
  },

  // ── Environment ──────────────────────────────────────────────────────────
  env: {
    browser: true,
    node: true,
    es2022: true,
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  settings: {
    react: { version: "detect" },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: ["./tsconfig.base.json"],
      },
      node: true,
    },
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx", ".mts", ".cts"],
    },
  },

  // ── Extends ───────────────────────────────────────────────────────────────
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:sonarjs/recommended",
    // Must be last — turns off rules that conflict with Prettier.
    "prettier",
  ],

  // ── Plugins ───────────────────────────────────────────────────────────────
  plugins: [
    "@typescript-eslint",
    "react",
    "react-hooks",
    "jsx-a11y",
    "import",
    "unicorn",
    "sonarjs",
  ],

  // ── Rules ─────────────────────────────────────────────────────────────────
  rules: {
    // ── TypeScript ─────────────────────────────────────────────────────────
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
    "@typescript-eslint/consistent-type-exports": "error",
    "@typescript-eslint/no-import-type-side-effects": "error",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/require-await": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",

    // ── React ──────────────────────────────────────────────────────────────
    // Not needed with the new JSX transform (React 17+).
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/display-name": "warn",
    "react/no-unknown-property": "error",
    "react/jsx-no-target-blank": ["error", { enforceDynamicLinks: "always" }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // ── Imports ────────────────────────────────────────────────────────────
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
    "import/no-duplicates": ["error", { "prefer-inline": true }],
    "import/no-cycle": ["error", { maxDepth: 3, ignoreExternal: true }],
    "import/no-default-export": "off", // Next.js pages require default exports
    "import/no-extraneous-dependencies": ["error", { devDependencies: ["**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**", "**/__tests__/**", "**/*.stories.*", "**/vite.config.*", "**/vitest.config.*"] }],

    // ── Unicorn (modern JS practices) ─────────────────────────────────────
    "unicorn/prefer-module": "error",
    "unicorn/prefer-node-protocol": "error",
    "unicorn/no-array-for-each": "error",
    "unicorn/prefer-array-find": "error",
    "unicorn/prefer-array-flat-map": "error",
    "unicorn/prefer-object-from-entries": "error",
    "unicorn/no-useless-undefined": "error",
    "unicorn/prefer-ternary": ["error", "onlySingleLine"],
    "unicorn/filename-case": [
      "error",
      {
        cases: { camelCase: true, pascalCase: true, kebabCase: true },
        ignore: ["README\\.md", "\\.d\\.ts$"],
      },
    ],

    // ── General JS quality ─────────────────────────────────────────────────
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "no-debugger": "error",
    "eqeqeq": ["error", "always", { null: "ignore" }],
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-template": "error",
    "no-nested-ternary": "error",
    "spaced-comment": ["error", "always", { markers: ["/"] }],
    "curly": ["error", "all"],
  },

  // ── Per-file overrides ────────────────────────────────────────────────────
  overrides: [
    // ── Tests ────────────────────────────────────────────────────────────
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx", "**/test/**", "**/tests/**", "**/__tests__/**"],
      env: { jest: true },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/require-await": "off",
        "sonarjs/no-duplicate-string": "off",
      },
    },

    // ── Next.js pages & layouts ───────────────────────────────────────────
    {
      files: ["apps/**/app/**/{page,layout,loading,error,not-found,route}.tsx", "apps/**/pages/**/*.tsx"],
      rules: {
        "import/no-default-export": "off",
      },
    },

    // ── Config files (CommonJS) ───────────────────────────────────────────
    {
      files: ["*.config.{js,cjs,mjs}", ".eslintrc.js", "commitlint.config.js"],
      env: { node: true },
      rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-require-imports": "off",
        "unicorn/prefer-module": "off",
      },
    },

    // ── Storybook stories ────────────────────────────────────────────────
    {
      files: ["**/*.stories.tsx", "**/*.stories.ts"],
      rules: {
        "import/no-default-export": "off",
        "@typescript-eslint/consistent-type-assertions": "off",
      },
    },

    // ── Scripts / tooling (looser rules) ─────────────────────────────────
    {
      files: ["scripts/**/*.{ts,js,mjs}"],
      rules: {
        "no-console": "off",
        "@typescript-eslint/no-floating-promises": "off",
      },
    },
  ],

  // ── Ignore patterns ───────────────────────────────────────────────────────
  ignorePatterns: [
    "node_modules/",
    "dist/",
    ".next/",
    "out/",
    "build/",
    "coverage/",
    ".turbo/",
    "storybook-static/",
    "src/generated/",
    "generated/",
    "*.min.js",
    "public/",
  ],
};
