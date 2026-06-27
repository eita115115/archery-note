import js from "@eslint/js";
import globals from "globals";

const browserAppRules = {
  "no-undef": "off",
  "no-unused-vars": "off",
};

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "artifacts/**",
      "android/**",
      "docs/screenshots/**",
    ],
  },
  js.configs.recommended,
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["tools/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        AbortController: "readonly",
        fetch: "readonly",
        WebSocket: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.js", "sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    rules: browserAppRules,
  },
];
