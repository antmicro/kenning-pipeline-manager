/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from '@vue/cli-service';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);

export default defineConfig({
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
                '@baklavajs': path.resolve(dirname(__filename), 'node_modules/@baklavajs/'),
            },
            fallback: {
                fs: false,
                path: false,
                system: false,
                file: false,
            },
            extensions: ['.ts', '.js', '.json']
        };

        config.module.rules = config.module.rules.filter((rule) => !rule.test.toString().match(/svg/) && !rule.test.toString().match(/png/))
        if (process.env.VUE_APP_SINGLEHTML_BUILD) {
            // Make sure that png and svg files are built into a separate folder with a predictable name
            config.module.rules.push({
                test: /\.(|svg|png|jpe?g|gif|webp|avif)(\?.*)?$/,
                type: 'asset/inline',
            })
        } else {
            config.module.rules.push({
                test: /\.(|svg|png|jpe?g|gif|webp|avif)(\?.*)?$/,
                type: 'asset/resource',
                generator: { filename: 'img/[name].[hash:8][ext]' }
            })
        }
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
