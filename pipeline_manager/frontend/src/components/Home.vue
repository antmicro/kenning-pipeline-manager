<template>
    <div id="container">
        <div>
            <div v-show="!specificationLoaded">
                <label for="load-spec-button">Load file: </label>
                <input
                    type="file"
                    id="load-spec-button"
                    @change="load_specification"
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
                @click="request_specification"
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
        load_specification() {
            let file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            let formData = new FormData();
            formData.append('specfile', file);

            let requestOptions = {
                method: 'POST',
                body: formData
            };

            fetch('http://127.0.0.1:5000/load_specification', requestOptions)
                .then(response => response.text().then(data => ({status: response.status, data: data})))
                .then(obj => {
                    if (obj.status == 200) {
                        this.dataflowSpecification = JSON.parse(obj.data);
                        this.specificationLoaded = true;
                    }
                    else if (obj.status == 400) {
                        alert(obj.data);
                    }
                });
        },
        open_tcp() {
            fetch('http://127.0.0.1:5000/connect')
                .then(response => response.text().then(data => ({status: response.status, data: data})))
                .then(obj => {
                    if (obj.status == 200) {
                        this.clientConnected = true;
                    }
                    else if (obj.status == 400) {
                        alert(obj.data);
                    }
                });
        },
        request_specification() {
            fetch('http://127.0.0.1:5000/request_specification')
                .then(response => response.text().then(data => ({status: response.status, data: data})))
                .then(obj => {
                    if (obj.status == 200) {
                        this.dataflowSpecification = JSON.parse(obj.data);
                        this.specificationLoaded = true;
                    }
                    else if (obj.status == 400) {
                        alert(obj.data);
                    }
                });
        }
    }
}
</script>
