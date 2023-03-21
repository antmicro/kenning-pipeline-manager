/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaklavaVuePlugin } from '@baklavajs/plugin-renderer-vue';
import Toast, { POSITION } from 'vue-toastification';

import Vue from 'vue';
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

Vue.use(BaklavaVuePlugin);
Vue.use(Toast, options);

Vue.config.productionTip = false;
Vue.config.devtools = false;

/* eslint-disable no-console */
Vue.prototype.log = console.log;

/* eslint-disable no-new */
new Vue({
    el: '#app',
    router: RouterVue,
    render: (h) => h(App),
});
