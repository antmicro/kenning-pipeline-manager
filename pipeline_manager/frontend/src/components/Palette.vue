<!--
Copyright (c) 2022-2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div
        ref="paletteRef"
        class="baklava-node-palette export-hidden"
        :class="{'hidden-navbar': $isMobile}"
    >
        <div class="search-bar">
            <div class="palette-title">
                <span>Browser</span>
                Nodes
            </div>
            <div class="__entry_search">
                <Magnifier :color="'gray'" />
                <input class="palette-search" v-model="paletteSearch" placeholder="Search" />
            </div>
        </div>
        <NodePalette :paletteRef="paletteRef" :paletteSearch="paletteSearch"/>
        <!-- Height of the sidebar is 60 so we need to subtract that -->
        <Tooltip
            v-show="tooltip.visible"
            :text="tooltip.text"
            :left="tooltip.left"
            :top="tooltip.top - 60"
        />
    </div>
</template>

<script>
import { defineComponent, ref } from 'vue'; // eslint-disable-line object-curly-newline
import Tooltip from './Tooltip.vue';
import Magnifier from '../icons/Magnifier.vue';
import NodePalette from '../custom/nodepalette/NodePalette.vue';

export default defineComponent({
    components: {
        Magnifier,
        NodePalette,
        Tooltip,
    },
    setup() {
        const paletteRef = ref(null);
        const tooltip = ref(null);

        tooltip.value = {
            top: 0,
            left: 0,
            visible: false,
            text: '',
        };

        const paletteSearch = ref('');

        return {
            tooltip,
            paletteSearch,
            paletteRef,
        };
    },
});
</script>
