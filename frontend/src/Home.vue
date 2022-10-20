<template>
    <div id="container">
        <div>
            <label for="spec-file">Load file: </label>
            <input
                type="file"
                id="spec-file"
                @change="load"
            >
        </div>
        <Editor />
    </div>
</template>

<script>
import Editor from "./Editor.vue";

export default {
   components: {
        Editor
    },
    methods: {
        load() {
            let file = document.getElementById('spec-file').files[0];
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
                    this.$root.$emit('updateEdtior', data)
                })
        }
    }
}
</script>
