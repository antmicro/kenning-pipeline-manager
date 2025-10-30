<!--
Copyright (c) 2022-2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Implements left sidebar containing available nodes and graphs.
-->

<template>
    <div
        ref="paletteRef"
        class="baklava-node-palette export-hidden"
        :class="{'hidden-navbar': $isMobile}"
    >
        <div class="search-bar">
            <div class="palette-title">
                <div
                    v-for="name in Object.keys(tabs)"
                    :key="name"
                    :class="['tab', { '--active': name === tabValue }]"
                    @click="() => { tabValue = name }"
                >
                    <span>{{ name }}</span>
                </div>
            </div>
            <div class="__entry_search">
                <Magnifier :color="'gray'" />
                <input class="palette-search" v-model="paletteSearch" placeholder="Search" />
            </div>
        </div>
        <component
            v-for="[tab, value] in Object.entries(tabs)"
            v-show="tab === tabValue"
            :key="tab"
            :is="value"
            :paletteRef="paletteRef"
            :paletteSearch="paletteSearch"
        />
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
import { defineComponent, markRaw, ref } from 'vue';
import Tooltip from './Tooltip.vue';
import Magnifier from '../icons/Magnifier.vue';
import NodePalette from '../custom/nodepalette/NodePalette.vue';
import GraphListPalette from './GraphListPalette.vue';

export default defineComponent({
    components: {
        GraphListPalette,
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
        const tabValue = ref('Nodes');
        const tabs = {
            Nodes: markRaw(NodePalette),
            Graphs: markRaw(GraphListPalette),
        };
        return {
            tooltip,
            paletteSearch,
            paletteRef,
            tabs,
            tabValue,
        };
    },
});
</script>
