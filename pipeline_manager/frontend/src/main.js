import { BaklavaVuePlugin } from '@baklavajs/plugin-renderer-vue';

import Vue from 'vue';
import App from './App.vue';
import RouterVue from './router/router';
import '@baklavajs/plugin-renderer-vue/dist/styles.css';
import '../styles/style.css';
import '../styles/editor.scss';

Vue.use(BaklavaVuePlugin);

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
