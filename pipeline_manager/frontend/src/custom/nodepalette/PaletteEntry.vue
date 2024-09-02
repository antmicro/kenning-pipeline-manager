<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
A single entry representing available node type in the sidebar.
-->
<template>
    <div class="__entry __node-entry __dragged" :style="padding">
        <img class="__title-icon" v-if="nodeIcon !== undefined" :src="nodeIcon" draggable="false" />
        <div class="__title-label" v-html="titleSanitized"></div>
    </div>
</template>

<script>
import { defineComponent, computed } from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';
import DOMPurify from 'dompurify';

export default defineComponent({
    props: {
        title: {
            type: String,
            required: true,
        },
        iconPath: {
            type: String,
            required: false,
        },
        depth: {
            type: Number,
            required: true,
        },
    },
    setup(props) {
        const { viewModel } = useViewModel();
        const getIconPath = (name) => viewModel.value.cache[`./${name}`] ?? name;
        const nodeIcon = computed(() => getIconPath(props.iconPath));
        const paddingDepth = 20;
        const minPadding = 10;
        const padding = computed(
            () => `padding-left: ${minPadding + props.depth * paddingDepth}px`,
        );

        return {
            nodeIcon,
            padding,
            getIconPath,
        };
    },
    computed: {
        titleSanitized() {
            return DOMPurify.sanitize(this.title);
        },
    },
});
</script>

<style lang="scss" scoped>
.__dragged {
    border-radius: var(--baklava-node-border-radius);
    border-width: 0px;
}
</style>
