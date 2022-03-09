module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    "cypress/globals": true,
  },
  extends: [
    "eslint:recommended",
    // Enforce all Vue recommendations
    // https://eslint.vuejs.org/rules/
    "plugin:vue/recommended",
    "@vue/airbnb",
    "plugin:sonarjs/recommended",
    "plugin:prettier/recommended",
    // https://github.com/vuejs/eslint-config-typescript#vueeslint-config-typescriptrecommended
    // Some might conflict with prettier, this config should be placed after all
    // other configs except for the prettier
    "@vue/typescript/recommended",
    "@vue/prettier",
    "plugin:cypress/recommended",
    "plugin:storybook/recommended",
  ],
  plugins: ["prettier", "sonarjs", "cypress"],
  // add your custom rules here
  rules: {
    "import/no-extraneous-dependencies": ["error", { devDependencies: true }],
    // Allow Prettier to throw errors via ESLint
    // https://ryanharris.dev/configure-eslint-and-prettier/
    "prettier/prettier": "error",
    // disable the rule for all files
    "@typescript-eslint/explicit-module-boundary-types": "off",
    // FIXME: Enable once we have agreed on strategy for keyboard listeners
    "vuejs-accessibility/click-events-have-key-events": "off",
    // We use a directory structure, which this rule doesn't consider. If we
    // have Directory/Component.vue, that is a multi-word name:
    // DirectoryComponent. But it throws an error because the filename Component
    // is only one word. Disable it until better support is enabled.
    "vue/multi-word-component-names": "off",
  },
  settings: {
    "import/core-modules": [
      "vue",
      "graphql-tag",
      "apollo-link",
      "dayjs",
      "apollo-upload-client",
    ],
    "import/resolver": {
      alias: {
        map: [
          ["@", "./*"],
          ["~", "./*"],
        ],
        extensions: [".js", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
      },
    },
  },
  overrides: [
    {
      // enable the rule specifically for TypeScript files
      files: ["*.ts", "*.tsx"],
      rules: {
        "@typescript-eslint/explicit-module-boundary-types": ["error"],
      },
    },
  ],
}