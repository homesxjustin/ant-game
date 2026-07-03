/* ESLint config for the TypeScript sources. Kept intentionally lean: the
 * strict tsconfig does the heavy lifting; ESLint catches stylistic and a few
 * correctness issues the compiler doesn't. */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { browser: true, es2022: true, node: true },
  ignorePatterns: ["dist/", "dist-tsc/", "node_modules/", "*.cjs", "scripts/"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "off",
    "no-constant-condition": ["error", { checkLoops: false }],
  },
};
