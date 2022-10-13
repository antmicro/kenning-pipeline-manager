import Vue from 'vue';
import Router from 'vue-router';
import Editor from '../Editor.vue';

Vue.use(Router);

const RouterVue = new Router({
    mode: 'history',
    base: process.env.BASE_URL,
    routes: [
        {
            path: '/',
            name: 'home',
            component: Editor
        }
    ]
});

export default RouterVue;
