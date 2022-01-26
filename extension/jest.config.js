const lodash = require('lodash')

module.exports = {
    // preset: "@vue/cli-plugin-unit-jest/presets/typescript-and-babel",
    preset: '@vue/cli-plugin-unit-jest',
    collectCoverage: true,
    collectCoverageFrom: [
        '**/*.{js,vue}',
        '!**/node_modules/**',
        '!**/babel.config.js',
        '!**/vue.config.js',
        '!**/coverage/**',
        '!**/store/index.js',
        '!**/developer/**',
        '!**/developerscratchpad/**',
        '!**/componentlibrary/**',
        '!**/deprecated/**',
        '!**/mixins/**',
        '!**/dist/**',
        '**/components/contentscript/mixin_*',
        '!**/src/background.js',
        '!**/popup/main.js',
        '!**/src/App.vue',
        '!**/src/main.js',
        '!jest.config.js',
        '!**/content-scripts/content-script.js',
    ],
    globals: {
        _: lodash
    }
}
