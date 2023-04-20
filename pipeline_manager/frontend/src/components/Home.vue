<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="container">
        <NavBar />
        <EditorView
            class="inner-editor"
            :plugin="this.editorManager.viewPlugin"
            :style="`--scale: ${this.scale}`"
        />
        <TerminalPanel />
    </div>
</template>

<script>
import NavBar from './NavBar.vue';
import EditorManager from '../core/EditorManager';
import EditorView from '../custom/Editor.vue';
import TerminalPanel from './TerminalPanel.vue';

export default {
    components: {
        NavBar,
        EditorView,
        TerminalPanel,
    },
    data() {
        return {
            editorManager: EditorManager.getEditorManagerInstance(),
        };
    },
    computed: {
        scale() {
            return this.editorManager.viewPlugin.scaling;
        },
    },
};
</script>
