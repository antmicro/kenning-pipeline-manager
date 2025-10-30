<!--
Copyright (c) 2022-2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="graphs entries">
        <PaletteEntry
            v-for="entry in entries"
            @click="entry.click"
            :key="entry.id"
            :title="entry.title"
            :isCategory="!entry.isCurrent"
            :mask="entry.mask"
            :hitSubstring="entry.hitSubstring"
            :depth="0"
            style="cursor: pointer"
        />
    </div>
</template>

<script>
import { computed, defineComponent } from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';
import fuzzysort from 'fuzzysort';
import PaletteEntry from '../custom/nodepalette/PaletteEntry.vue';

export default defineComponent({
    components: {
        PaletteEntry,
    },
    props: {
        paletteSearch: {
            required: true,
        },
    },
    setup(props) {
        const { viewModel } = useViewModel();

        const entries = computed(() =>
            [...viewModel.value.editor.graphs].map((graph) => {
                const { displayedGraph, settings, editor } = viewModel.value;

                // Title
                const titleName = [graph.name, graph.graphNode?.title, graph.graphNode?.type, 'Anonymous'].find((title) => title && title !== '');
                const titleId = settings.showIds ? `(${graph.id})` : '';
                const title = `${titleName} ${titleId}`;

                // Filter
                const filterEntries = {};
                const threshold = settings.showIds ? -100 : -50;
                if (props.paletteSearch !== '') {
                    const filterResult = fuzzysort.single(props.paletteSearch, title);
                    if (filterResult?.score > threshold) {
                        filterEntries.mask = true;
                        filterEntries.hitSubstring = fuzzysort.highlight(filterResult, '<span>', '</span>');
                    } else {
                        filterEntries.mask = false;
                    }
                }

                // Graph entry
                return {
                    click: () => editor.switchToRelatedGraph(graph.id),
                    title,
                    isCurrent: displayedGraph.id === graph.id,
                    key: graph.id,
                    ...filterEntries,
                };
            }),
        );

        return { entries };
    },
});
</script>
