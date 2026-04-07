export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    /* スコープ（括弧部分）を禁止: feat: init は許可、feat(): init は禁止 */
    "scope-empty": [2, "always"],
  },
};
