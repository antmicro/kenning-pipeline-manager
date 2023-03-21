<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="container">
        <NavBar />
        <Notifications />
        <baklava-editor class="inner-editor" :plugin="this.editorManager.viewPlugin" />
        <AlertBar />
    </div>
</template>

<script>
import AlertBar from './AlertBar.vue';
import NavBar from './NavBar.vue';
import EditorManager from '../core/EditorManager';
import Notifications from './Notifications.vue';

export default {
    components: {
        NavBar,
        AlertBar,
        Notifications,
    },
    data() {
        return {
            editorManager: EditorManager.getEditorManagerInstance(),
        };
    },
};
</script>
