/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import Toast, { POSITION } from 'vue-toastification';
import vClickOutside from 'click-outside-vue3';

import { createApp } from 'vue';
import App from './App.vue';
import RouterVue from './router/router';
import '../styles/style.scss';
import 'vue-toastification/dist/index.css';

const options = {
    timeout: 5000,
    position: POSITION.BOTTOM_RIGHT,
    icon: false,
    closeButton: false,
};

if (process.env.VUE_APP_NODE_ICONS_PATH !== undefined) {
    require.context(process.env.VUE_APP_NODE_ICONS_PATH, false, /\.svg$/);
}

const app = createApp(App);
app.use(vClickOutside);
app.use(RouterVue);
app.use(Toast, options);

app.mount('#app');
