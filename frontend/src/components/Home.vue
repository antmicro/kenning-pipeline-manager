<template>
    <div id="container">
        <div>
            <div v-show="!specificationLoaded">
                <label for="load-spec-button">Load file: </label>
                <input
                    type="file"
                    id="load-spec-button"
                    @change="load_spec"
                >
            </div>
            <input v-show="!clientConnected"
                value="Open TCP connection"
                type="button"
                id="tcp-button"
                @click="open_tcp"
            >
            <input v-show="clientConnected && !specificationLoaded"
                value="Request specification"
                type="button"
                id="request-spec-button"
                @click="request_spec"
            >
        </div>
        <Editor v-show="specificationLoaded" :dataflowSpecification="dataflowSpecification"/>
    </div>
</template>

<script>
import Editor from "./Editor.vue";

export default {
   components: {
        Editor
    },
    data() {
        return {
            specificationLoaded: false,
            clientConnected: false,
            dataflowSpecification: null
        }
    },
    methods: {
        load_spec() {
            let file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            let formData = new FormData();
            formData.append('specfile', file);

            let requestOptions = {
                method: 'POST',
                body: formData
            };

            fetch('http://127.0.0.1:5000/loadspec', requestOptions)
                .then(response => response.json())
                .then(data => {
                    this.dataflowSpecification = data;
                    this.specificationLoaded = true;
                });
        },
        open_tcp() {
            fetch('http://127.0.0.1:5000/connect')
                .then(response => response.json())
                .then(data => {
                    this.clientConnected = data;
                });
        },
        request_spec() {
            fetch('http://127.0.0.1:5000/request_spec')
                .then(response => response.json())
                .then(data => {
                    this.dataflowSpecification = data;
                    this.specificationLoaded = true;
                });
        }
    }
}
</script>
