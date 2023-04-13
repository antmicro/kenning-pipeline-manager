<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="container">
        <NavBar />
        <Notifications />
        <EditorView
            class="inner-editor"
            :plugin="this.editorManager.viewPlugin"
            :style="`--scale: ${this.scale}`"
        />
    </div>
</template>

<script>
import NavBar from './NavBar.vue';
import EditorManager from '../core/EditorManager';
import Notifications from './Notifications.vue';
import EditorView from './Editor.vue';

export default {
    components: {
        NavBar,
        Notifications,
        EditorView,
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
