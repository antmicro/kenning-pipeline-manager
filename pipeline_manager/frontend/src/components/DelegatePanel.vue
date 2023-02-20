<template>
    <div class="inner-row" v-show="externalApplicationManager.backendAvailable">
        <div v-show="externalApplicationManager.externalApplicationConnected">
            <label for="request-dataflow-button"> Import dataflow </label>
            <input type="file" id="request-dataflow-button" @change="importDataflow" />
            <input type="button" value="Export dataflow" @click="requestDataflowAction('export')" />
            <input
                type="button"
                value="Validate dataflow"
                @click="requestDataflowAction('validate')"
            />
            <input type="button" value="Run dataflow" @click="requestDataflowAction('run')" />
        </div>
    </div>
</template>

<script>
import ExternalApplicationManager from '../core/ExternalApplicationManager';

export default {
    data() {
        return {
            externalApplicationManager: new ExternalApplicationManager(),
        };
    },
    mounted() {
        this.externalApplicationManager.initializeConnection();
    },
    methods: {
        requestDataflowAction(action) {
            this.externalApplicationManager.requestDataflowAction(action);
        },
        importDataflow() {
            this.externalApplicationManager.importDataflow();
        },
    },
};
</script>
