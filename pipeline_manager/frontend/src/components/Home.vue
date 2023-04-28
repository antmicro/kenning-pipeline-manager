<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="container">
        <NavBar />
        <Editor class="inner-editor" :view-model="editorManager.baklavaView" />
        <TerminalPanel />
    </div>
</template>

<script>
import NavBar from './NavBar.vue';
import EditorManager from '../core/EditorManager';
import TerminalPanel from './TerminalPanel.vue';
import Editor from '../custom/Editor.vue';
import '@baklavajs/themes/dist/classic.css';

export default {
    components: {
        NavBar,
        Editor,
        TerminalPanel,
    },
    data() {
        const editorManager = EditorManager.getEditorManagerInstance();

        return { editorManager };
    },
    computed: {
        scale() {
            return this.editorManager.viewPlugin.scaling;
        },
    },
};
</script>
