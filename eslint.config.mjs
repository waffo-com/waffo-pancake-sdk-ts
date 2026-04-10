/**
 * ESLint 配置 - @waffo/pancake-ts
 */
import { defineConfig, globalIgnores } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import jsdocPlugin from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  // TypeScript ESLint
  ...tseslint.configs.recommended,

  // Import plugin
  {
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true,
      },
    },
  },

  // JSDoc plugin
  {
    plugins: {
      jsdoc: jsdocPlugin,
    },
  },

  // SDK rules
  {
    rules: {
      // TypeScript type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],

      // Naming convention
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variable",
          modifiers: ["const"],
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        // Allow HTTP headers with hyphens
        {
          selector: "property",
          format: null,
          filter: {
            regex: "^(Content-Type|Accept|Authorization|x-[a-z-]+|X-[A-Za-z-]+)$",
            match: true,
          },
        },
        {
          selector: "property",
          format: ["camelCase", "snake_case", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
        },
      ],

      // Import order
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling"],
            "type",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],

      // No duplicate imports
      "import/no-duplicates": "error",

      // JSDoc rules
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          publicOnly: true,
          checkConstructors: false,
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > ClassDeclaration",
          ],
        },
      ],
      "jsdoc/require-description": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/check-param-names": "warn",
      "jsdoc/check-tag-names": "warn",
    },
  },

  // Relax naming convention for config files
  {
    files: ["eslint.config.mjs", "vitest.config.ts", "commitlint.config.js"],
    rules: {
      "@typescript-eslint/naming-convention": "off",
    },
  },

  // Global ignores
  globalIgnores(["dist/**", "node_modules/**", "coverage/**"]),
]);

export default eslintConfig;
