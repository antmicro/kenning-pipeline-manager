/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
    env: {
        browser: true,
        es2022: true,
    },
    extends: ['plugin:vue/essential', 'prettier', 'airbnb-base', 'plugin:import/typescript'],
    overrides: [{
        files: ['**/*.{ts,tsx}'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint', 'jsdoc'],
        extends: ['plugin:@typescript-eslint/recommended'],
        rules: {
            'jsdoc/no-types': 1,
        },
    }, {
        files: ['tests/**/*.{spec.ts,js}'],
        rules: {
            'no-await-in-loop': 0,
            'no-plusplus': 0,
        },
    }],
    parserOptions: {
        parser: '@typescript-eslint/parser',
        requireConfigFile: false,
        ecmaVersion: 'latest',
        sourceType: 'module',
        babelOptions: { plugins: ['@babel/plugin-syntax-import-assertions'], }
    },
    plugins: ['vue', '@typescript-eslint', 'jsdoc'],
    rules: {
        'import/no-extraneous-dependencies': 0,
        indent: ['error', 4, { SwitchCase: 1 }],
        'implicit-arrow-linebreak': 'off',
        'function-paren-newline': 'off',
        'operator-linebreak': 'off',
        'vue/multi-word-component-names': 0,
        quotes: ['error', 'single', { allowTemplateLiterals: true }],
        'import/extensions': ['error', { js: 'ignorePackages', json: 'ignorePackages', ts: 'ignorePackages' }],
        'no-unused-vars': ['error', {'vars': 'all', 'args': 'all', 'argsIgnorePattern': '^_'}],
        'no-console': ["error", { allow: ["warn", "error"] }],
        'no-restricted-syntax': ['off', 'ForOfStatement'],
        'jsdoc/valid-types': ['error'],
        'jsdoc/type-formatting': ['error', {'stringQuotes': 'single', 'objectFieldSeparator': 'comma-and-linebreak', 'objectFieldIndent': '  '}],
    },
    ignorePatterns: ["src/third-party/hterm_all.js", "specification_builder/specification_builder.js"],
};
