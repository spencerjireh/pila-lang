/**
 * Enforces the packages/shared layering:
 *   primitives/**  →  cannot import from infra/** or domain/**
 *   infra/**       →  cannot import from domain/**
 *   domain/**      →  may import from anywhere
 *
 * Test files are exempt so they can wire up any combination of layers.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  rules: {},
  overrides: [
    {
      files: ["src/primitives/**/*.ts"],
      excludedFiles: ["**/*.test.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "@pila/shared/infra/*",
                  "@pila/shared/domain/*",
                  "../../infra/*",
                  "../../domain/*",
                  "../../../infra/*",
                  "../../../domain/*",
                ],
                message:
                  "primitives/ cannot depend on infra/ or domain/. Invert the dependency or move the module.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/infra/**/*.ts"],
      excludedFiles: ["**/*.test.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "@pila/shared/domain/*",
                  "../../domain/*",
                  "../../../domain/*",
                ],
                message:
                  "infra/ cannot depend on domain/. Move the module to domain/ if it needs domain imports.",
              },
            ],
          },
        ],
      },
    },
  ],
};
