<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="baklava-node --palette" :data-node-type="type">
        <div class="__title">
            <div class="__title-label">
                {{ title }}
            </div>
            <div v-if="hasContextMenu" class="__menu">
                <vertical-dots
                    class="--clickable"
                    @pointerdown.stop.prevent
                    @click.stop.prevent="openContextMenu"
                />
                <context-menu
                    v-model="showContextMenu"
                    :x="-100"
                    :y="0"
                    :items="contextMenuItems"
                    @click="onContextMenuClick"
                    @pointerdown.stop.prevent
                />
            </div>
        </div>
    </div>
</template>

<script>
import { computed, defineComponent, ref } from 'vue';

import { useGraph, useViewModel, GRAPH_NODE_TYPE_PREFIX, Components } from 'baklavajs';
import VerticalDots from '../../components/VerticalDots.vue';

const { ContextMenu } = Components;

export default defineComponent({
    components: { ContextMenu, VerticalDots },
    props: {
        type: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
    },
    setup(props) {
        const { viewModel } = useViewModel();
        const { switchGraph } = useGraph();

        const showContextMenu = ref(false);
        const hasContextMenu = computed(() => props.type.startsWith(GRAPH_NODE_TYPE_PREFIX));

        const contextMenuItems = [
            { label: 'Edit Subgraph', value: 'editSubgraph' },
            { label: 'Delete Subgraph', value: 'deleteSubgraph' },
        ];

        const openContextMenu = () => {
            showContextMenu.value = true;
        };

        const onContextMenuClick = (action) => {
            const graphTemplateId = props.type.substring(GRAPH_NODE_TYPE_PREFIX.length);
            const graphTemplate = viewModel.value.editor.graphTemplates.find(
                (gt) => gt.id === graphTemplateId,
            );
            if (!graphTemplate) {
                return;
            }

            switch (action) {
                case 'editSubgraph':
                    switchGraph(graphTemplate);
                    break;
                case 'deleteSubgraph':
                    viewModel.value.editor.removeGraphTemplate(graphTemplate);
                    break;
            }
        };

        return {
            showContextMenu,
            hasContextMenu,
            contextMenuItems,
            openContextMenu,
            onContextMenuClick,
        };
    },
});
</script>
