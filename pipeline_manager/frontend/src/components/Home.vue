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
        /**
         * Event handler that loads a specification passed by the user and asks the backend to validate it.
         * If the validation is successful it is passed to the editor that renders a new environment.
         * Otherwise user is alerted with a feedback message.
         */
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
        /**
         * Event handler that asks the backend to open a TCP socket that can be connected to.
         * If the client did not connect the user is alertd with a feedback message. 
         */
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
        /**
         * Event handler that asks the backend to send a dataflow specification.
         * If the backend did not manage to send it the user is alerted with a feedback message.
         * Otherwise the specification is passed to the editor that renders a new environment.
         */
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
