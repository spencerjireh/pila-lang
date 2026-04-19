/**
 * Shared ESLint preset. Consumed via:
 *   { "extends": ["@pila/config/eslint-preset"] }
 * Next.js / React rules are added per-app (apps/web) since they pull
 * in framework-specific plugins that TS-only packages should not load.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "no-var": "off",
    "@typescript-eslint/no-empty-object-type": "off",
  },
  ignorePatterns: ["node_modules", "dist", "build", "coverage"],
};
