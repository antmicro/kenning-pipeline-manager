<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div ref="el" class="baklava-sidebar" :class="{ '--open': graph.sidebar.visible }" :style="styles">
        <div class="__resizer" @mousedown="startResize" />

        <div class="__header">
            <button tabindex="-1" class="__close" @click="close">
                &times;
            </button>
            <div class="__node-name">
                {{ node ? node.type : '' }}
            </div>
        </div>

        Sidebar
    </div>
</template>

<script>
import { computed, defineComponent, ref } from "vue";
import { useGraph } from '@baklavajs/renderer-vue';

export default defineComponent({
    setup() {
        const { graph } = useGraph();

        const el = ref<HTMLElement | null>(null);
        const width = ref(300);

        const node = computed(() => {
            const id = graph.value.sidebar.nodeId;
            const a = graph.value.nodes.find((x) => x.id === id);
            return a;
        });

        const styles = computed(() => ({
            width: `${width.value}px`,
        }));

        const close = () => {
            graph.value.sidebar.visible = false;
        };

        const startResize = () => {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener(
                "mouseup",
                () => {
                    window.removeEventListener("mousemove", onMouseMove);
                },
                { once: true },
            );
        };

        const onMouseMove = (event) => {
            width.value -= event.movementX;
        };

        return { el, graph, node, styles, startResize, close };
    },
});
</script>
