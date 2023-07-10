/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const { defineConfig } = require('@vue/cli-service');
const path = require('path');

module.exports = defineConfig({
    publicPath: '',
    css: {
        extract: !process.env.VUE_APP_SINGLEHTML_BUILD,
        loaderOptions: {
            scss: {
                additionalData: `
          @import "./styles/_variables.scss";
        `,
            },
        },
    },
    /* eslint-disable no-param-reassign */
    configureWebpack: (config) => {
        if (process.env.NODE_ENV === 'development') {
            config.devtool = 'eval-source-map';
        } else if (process.env.NODE_ENV === 'production') {
            config.optimization = {
                splitChunks: process.env.VUE_APP_SINGLEHTML_BUILD ? false : {
                    maxSize: 250000, // This value is arbitrary, can be adjusted if needed
                    chunks: 'all',
                }
            };
        }
        config.resolve = {
            alias: {
                '@baklavajs': path.resolve(__dirname, 'node_modules/@baklavajs/'),
            },
            fallback: {
                fs: false,
                path: false,
                system: false,
                file: false,
            },
        };
    },
    pages: {
        index: {
            entry: 'src/main.js',
            template: 'index.html',
            filename: 'index.html',
            title: 'Pipeline Manager',
        },
    },
});
