<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="container" class="outer">
        <EditorPanel />
        <DelegatePanel />
        <baklava-editor class="inner-editor" :plugin="this.editorManager.viewPlugin" />
        <AlertBar />
    </div>
</template>

<script>
import AlertBar from './AlertBar.vue';
import DelegatePanel from './DelegatePanel.vue';
import EditorPanel from './EditorPanel.vue';
import EditorManager from '../core/EditorManager';

export default {
    components: {
        EditorPanel,
        DelegatePanel,
        AlertBar,
    },
    data() {
        return {
            editorManager: EditorManager.getEditorManagerInstance(),
        };
    },
};
</script>

<style>
.inner-editor {
    border-top: 2px solid #000000;
}
</style>
