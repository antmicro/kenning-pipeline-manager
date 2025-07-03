<template>
    <div class="welcome-popup">
        <div class="welcome-text">
            This is an empty diagram. Drag and drop items from the left sidebar, a JSON file with
            specification or diagram data, or click to upload a file.
        </div>
        <button class="baklava-button" @click="uploadFileTrigger">Upload</button>
        <input ref="el" type="file" @change="uploadFileCallback" multiple />
    </div>
</template>

<script>
import { defineComponent, ref } from 'vue';

export default defineComponent({
    props: {
        loadFiles: {
            type: Function,
            required: true,
        },
    },
    setup(props) {
        const el = ref(null);
        const uploadFileTrigger = () => el.value.click();
        const uploadFileCallback = () => props.loadFiles(el.value.files);
        return { el, uploadFileTrigger, uploadFileCallback };
    },
});
</script>

<style>
.welcome-popup {
    display: flex;
    flex-direction: column;
}
.welcome-text {
    padding: 0.5em;
    text-align: center;
    width: 30vh;
}
</style>
