<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div
        class="rectangle-grouping-border"
        :style="styles"
    >
        <div
            class="rectangle-grouping"
            :style="innerStyles"
        />
        <div
            v-if="name"
            class="rectangle-grouping-name"
        >
            {{ name }}
        </div>
    </div>
</template>

<script>
import { computed, defineComponent } from 'vue';

export default defineComponent({
    name: 'RectangleGrouping',

    props: {
        name: { type: String, default: '' },
        min: { type: Object, required: true }, // { x, y }
        max: { type: Object, required: true }, // { x, y }
        visible: { type: Boolean, default: true },
        color: { type: String, default: '#00aaff' },
    },

    setup(props) {
        const width = computed(() =>
            Math.max(0, (props.max?.x ?? 0) - (props.min?.x ?? 0)),
        );

        const height = computed(() =>
            Math.max(0, (props.max?.y ?? 0) - (props.min?.y ?? 0)),
        );

        const styles = computed(() => ({
            position: 'absolute',
            visibility: props.visible ? 'visible' : 'hidden',
            top: `${props.min?.y ?? 0}px`,
            left: `${props.min?.x ?? 0}px`,
            width: `${width.value}px`,
            height: `${height.value}px`,
            border: `10px solid ${props.color}`,
            boxSizing: 'border-box',
            pointerEvents: 'none',
            borderRadius: '15px',
        }));

        const innerStyles = computed(() => ({
            width: '100%',
            height: '100%',
            backgroundColor: props.color,
            opacity: '0.15',
            position: 'relative',
            borderRadius: '15px',
        }));

        return {
            styles,
            innerStyles,
        };
    },
});
</script>

<style lang="scss" scoped>
.rectangle-grouping-border {
    boxSizing: border-box;
    pointerEvents: none;
    position: absolute;
}

.rectangle-grouping {
    width: 100%;
    height: 100%;
    border-radius: $spacing-s;
    pointer-events: none;
}

.rectangle-grouping-name {
    position: absolute;
    top: - $spacing-m - $spacing-s;
    left: $spacing-s;
    padding: 2px 8px;
    font-size: $fs-large;
    font-weight: 600;
    color: #ffffff;
    background-color: #{$gray-600};
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
}
</style>
