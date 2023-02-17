<template>
    <div class="inner-row" v-show="externalApplicationManager.backendAvailable">
        <div v-show="externalApplicationManager.externalApplicationConnected">
            <label for="request-dataflow-button"> Import dataflow </label>
            <input type="file" id="request-dataflow-button" @change="externalApplicationManager.importDataflow" />
            <input type="button" value="Export dataflow" @click="externalApplicationManager.requestDataflowAction('export')" />
            <input
                type="button"
                value="Validate dataflow"
                @click="externalApplicationManager.requestDataflowAction('validate')"
            />
            <input type="button" value="Run dataflow" @click="externalApplicationManager.requestDataflowAction('run')" />
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
    }
};
</script>
