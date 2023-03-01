// vue.config.js
const { defineConfig } = require('@vue/cli-service');
const path = require('path');

module.exports = defineConfig({
    publicPath: '',
    css: {
        loaderOptions: {
            scss: {
                additionalData: `
          @import "./styles/_variables.scss";
        `,
            },
        },
    },
    configureWebpack: {
        resolve: {
            alias: {
                '@baklavajs': path.resolve(__dirname, 'node_modules/@baklavajs/'),
            },
        },
    },
});
