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
                    v-for="name in Object.values(Tabs)"
                    :key="name"
                    :class="['tab', { '--active': name === currentTab }]"
                    @click="() => { currentTab = name }"
                >
                    <span>{{ name }}</span>
                </div>
            </div>
            <div class="__entry_search">
                <Magnifier class="__title-icon" :color="'gray'" />
                <input class="palette-search" v-model="paletteSearch" placeholder="Search" />
            </div>
        </div>
        <PaletteSection
            :entries="currentEntries"
            :palette="paletteRef!"
        />
    </div>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef } from 'vue';
import Magnifier from '../icons/Magnifier.vue';
import PaletteSection from './PaletteSection.vue';
import useNodePalette from '../core/palette/node.ts';
import useGraphPalette from '../core/palette/graph.ts';

const Tabs = {
    nodes: 'Nodes',
    graphs: 'Graphs',
    graphsTree: 'Graph Tree',
};

const paletteRef = useTemplateRef('paletteRef');
const currentTab = ref(Tabs.nodes);
const paletteSearch = ref('');
const paletteEntries = {
    [Tabs.nodes]: useNodePalette(paletteSearch),
    [Tabs.graphs]: useGraphPalette(paletteSearch),
    [Tabs.graphsTree]: useGraphPalette(paletteSearch, { tree: true }),
};
const currentEntries = computed(() => paletteEntries[currentTab.value]);
</script>

<style lang="scss" scoped>
.baklava-node-palette {
    top: 0;
    width: auto;
    min-width: min(300px, 50vw);
    max-width: min(450px, 50vw);
    background: $gray-700;
    user-select: none;
    border-right: 1px solid #393939;

    // default baklavjs height - terminal panel height
    height: calc(100% - $navbar-height - $terminal-container-height);
    padding: 0;
    z-index: 3;

    display: flex;
    flex-direction: column;
    overflow: visible;

    &.hidden-navbar {
        top: $navbar-height;
        transform: translate(-450px, 0px);
    }

    & > .search-bar {
        & > .palette-title {
            display: flex;
            margin: 0;

            border-bottom: 1px solid #393939;

            height: 3em;

            & .tab {
                cursor: pointer;
                display: flex;

                align-items: center;
                justify-content: center;

                height: 100%;
                width: 100%;

                &.--active {
                    background-color: var(--baklava-node-color-background);
                }

                &:not(.--active) {
                    color: var(--baklava-control-color-hover);
                }

                &:hover {
                    color: $green;
                }
            }

        }

        & > .__entry_search {
            display: flex;
            align-items: center;

            .__title-icon {
                margin-left: 10px;
            }

            font-size: $fs-small;

            gap: 1em;
            height: 4em;

            border-bottom: 1px solid #393939;

            background-color: $gray-700;
            cursor: auto;
            padding-right: 0;
            overflow: visible;

            & > .palette-search {
                height: 100%;
                width: 100%;
                color: $white;
                border: none;
                background-color: $gray-700;

                padding-left: 1em;

                &:focus {
                    outline: 1px solid $green;
                }

                &::placeholder {
                    opacity: 0.5;
                }
            }
        }
    }

    h1 {
        margin: 0;
    }
}
</style>
