import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // TypeScript itself checks undefined identifiers; core no-undef
      // false-positives on type-only refs (React, RequestInit, RTCIceServer).
      "no-undef": "off",
      // react-three-fiber JSX (position, intensity, castShadow, object, …)
      // is unknown to the DOM property list; TSX typing covers real typos.
      "react/no-unknown-property": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // Node-run scripts at the repo root and in packaging/.
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.vite/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.scorm/**",
      "packaging/build/**",
      // Third-party / generated browser assets served verbatim — not ours to lint.
      "**/public/**",
      "**/*.min.js",
    ],
  },
];
