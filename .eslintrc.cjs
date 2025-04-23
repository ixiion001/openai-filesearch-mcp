module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier", // Make sure this is last to override other configs
  ],
  rules: {
    "prettier/prettier": "error", // Report Prettier rule violations as ESLint errors
    // Add any project-specific ESLint rules here
  },
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  ignorePatterns: ["dist/", "node_modules/", "*.cjs", "*.json"], // Ignore build output, deps, CJS config, and JSON
};
