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
    extends: ['plugin:vue/essential', 'plugin:prettier/recommended', 'airbnb-base'],
    overrides: [],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['vue'],
    rules: {
        'import/no-extraneous-dependencies': 0,
        indent: ['error', 4, { SwitchCase: 1 }],
        'implicit-arrow-linebreak': 'off',
        'function-paren-newline': 'off',
        'operator-linebreak': 'off',
        'vue/multi-word-component-names': 0,
        quotes: ['error', 'single', { allowTemplateLiterals: true }],
    },
};
