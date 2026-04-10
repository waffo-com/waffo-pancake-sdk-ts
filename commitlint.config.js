module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [1, "always", [
      "user", "store", "product", "order", "ticket",
      "notify", "auth", "graphql", "resource", "sdk",
    ]],
  },
};
