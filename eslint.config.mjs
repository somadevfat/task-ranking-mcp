import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      /* any型の完全禁止 */
      "@typescript-eslint/no-explicit-any": "error",

      /* 未使用変数の警告（_プレフィックスは許可） */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    /* テストファイルとコンフィグファイルは除外 */
    ignores: ["dist/", "node_modules/", "*.config.*", "commitlint.config.js"],
  },
);
