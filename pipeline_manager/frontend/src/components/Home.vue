<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
The entrypoint of the application.
-->

<template>
    <div>
        <LoadingScreen v-if="counter > 0" />
        <div id="container">
            <NavBar />
            <Editor
                class="inner-editor"
                :view-model="editorManager.baklavaView"
                @loadWait="handleLoadWait"
                @loadFinish="handleLoadFinish"
            />
            <TerminalPanel v-if="!hideHud" />
        </div>
    </div>
</template>

<script>
import { ref, computed } from 'vue';
import NavBar from './NavBar.vue';
import EditorManager from '../core/EditorManager.js';
import TerminalPanel from './TerminalPanel.vue';
import LoadingScreen from './LoadingScreen.vue';
import Editor from '../custom/Editor.vue';
import '@baklavajs/themes/dist/classic.css';

export default {
    components: {
        NavBar,
        Editor,
        TerminalPanel,
        LoadingScreen,
    },
    setup() {
        const editorManager = EditorManager.getEditorManagerInstance();
        const counter = ref(0);

        const hideHud = computed(() => editorManager.baklavaView.hideHud);

        const handleLoadWait = () => {
            counter.value += 1;
        };
        const handleLoadFinish = () => {
            counter.value -= 1;
        };

        return {
            editorManager,
            counter,
            hideHud,
            handleLoadWait,
            handleLoadFinish,
        };
    },
};
</script>

<style lang="scss">
</style>
