const foundryGlobals = {
  CONFIG: "readonly",
  Dialog: "readonly",
  Hooks: "readonly",
  HTMLElement: "readonly",
  MutationObserver: "readonly",
  Roll: "readonly",
  game: "readonly",
  foundry: "readonly",
  ui: "readonly",
  URL: "readonly",
  cancelAnimationFrame: "readonly",
  console: "readonly",
  document: "readonly",
  process: "readonly",
  queueMicrotask: "readonly",
  requestAnimationFrame: "readonly",
  structuredClone: "readonly",
};

export default [
  {
    ignores: [
      ".build/**",
      "assets/**",
      "content/exports/**",
      "data/**",
      "node_modules/**",
      "packs/**",
    ],
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: foundryGlobals,
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-duplicate-imports": "error",
      "no-fallthrough": "error",
      "no-irregular-whitespace": "error",
      "no-unreachable": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrors: "none",
          varsIgnorePattern: "^_",
        },
      ],
      "no-undef": "error",
      "prefer-const": "error",
    },
  },
];
