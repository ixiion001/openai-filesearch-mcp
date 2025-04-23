import eslintJs from "@eslint/js";
import typescriptEslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // Global ignores
  {
    ignores: [
      "dist/",
      "node_modules/",
      "*.cjs", // Ignore commonjs config files if any
      "*.json", // Ignore json files
      "eslint.config.js", // Ignore this config file itself
    ],
  },

  // Base ESLint recommended rules
  eslintJs.configs.recommended,

  // TypeScript specific configurations
  ...typescriptEslint.configs.recommended,

  // Configuration for TypeScript files
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        project: true, // Assumes tsconfig.json is in the root
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node, // Add Node.js globals
      },
    },
    rules: {
      // Add any project-specific TypeScript rules here
      // Example: '@typescript-eslint/no-unused-vars': 'warn'
    },
  },

  // Prettier configuration (must be last to override other rules)
  eslintConfigPrettier,
];
