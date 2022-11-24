import Vue from 'vue';

/* eslint-disable import/prefer-default-export */
export const backendApiUrl = (Vue.config.devtools)
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : `${window.location.protocol}//${window.location.host}`;
