module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:promise/recommended',
  ],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      './tsconfig.json',
      './lambda/api/tsconfig.json',
      './lambda/authorizer/tsconfig.json',
      './lambda/export/tsconfig.json',
      './lambda/common/tsconfig.json',
      './lambda/migrator/tsconfig.json',
    ],
  },
  rules: {
    "semi": ["error", "never"],
    "quotes": [ 2, "single" ],
    "@typescript-eslint/restrict-template-expressions": ["off"],
    "@typescript-eslint/no-floating-promises": ["error"]
  },
  overrides: [
    {
      "files": [ "*.test.*", "*.spec.*", "*jest*" ],
      "rules": {
        "@typescript-eslint/ban-ts-comment": ["off"],
        "@typescript-eslint/no-unsafe-call": ["off"],
        "@typescript-eslint/no-unsafe-return": ["off"]
      }
    }
  ]
};
