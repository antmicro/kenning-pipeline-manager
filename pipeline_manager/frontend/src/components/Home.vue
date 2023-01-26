<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="container" class="outer">
        <div>
            <div v-show="!specificationLoaded">
                <label for="load-spec-button">Load specification</label>
                <input
                    type="file"
                    id="load-spec-button"
                    @change="load_specification"
                >
            </div>
            <input v-show="!externalApplicationConnected"
                value="Open TCP connection"
                type="button"
                @click="open_tcp"
            >
            <input v-show="externalApplicationConnected && !specificationLoaded"
                value="Request specification"
                type="button"
                @click="request_specification"
            >
        </div>
        <Editor v-show="specificationLoaded"
            :dataflowSpecification="dataflowSpecification"
            :externalApplicationConnected="externalApplicationConnected"
        />
    </div>
</template>

<script>
import Editor from './Editor.vue';
import { backendApiUrl } from '../core/utils';

export default {
    components: {
        Editor,
    },
    data() {
        return {
            specificationLoaded: false,
            externalApplicationConnected: false,
            dataflowSpecification: null,
        };
    },
    methods: {
        /**
         * Event handler that loads a specification passed by the user
         * and asks the backend to validate it.
         * If the validation is successful it is passed to the editor that
         * renders a new environment.
         * Otherwise user is alerted with a feedback message.
         */
        load_specification() {
            const file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('specfile', file);

            const requestOptions = {
                method: 'POST',
                body: formData,
            };

            fetch(`${backendApiUrl}/load_specification`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.dataflowSpecification = JSON.parse(obj.data);
                        this.specificationLoaded = true;
                    } else {
                        /* eslint-disable no-alert */
                        alert(obj.data);
                    }
                });
        },
        /**
         * Event handler that asks the backend to open a TCP socket that can be connected to.
         * If the external application did not connect the user is alertd with a feedback message.
         */
        open_tcp() {
            fetch(`${backendApiUrl}/connect`)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.externalApplicationConnected = true;
                    } else {
                        /* eslint-disable no-alert */
                        alert(obj.data);
                    }
                });
        },
        /**
         * Event handler that asks the backend to send a dataflow specification.
         * If the backend did not manage to send it the user is alerted with a feedback message.
         * Otherwise the specification is passed to the editor that renders a new environment.
         */
        request_specification() {
            fetch(`${backendApiUrl}/request_specification`)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.dataflowSpecification = JSON.parse(obj.data);
                        this.specificationLoaded = true;
                    } 
                    // Service Unavailable, which means that the external application was disconnected
                    else if (obj.response.status == 503) {
                        alert(obj.data);
                        this.externalApplicationConnected = false;
                    }
                    else {
                        /* eslint-disable no-alert */
                        alert(obj.data);    
                    }
                });
        },
    },
};
</script>
