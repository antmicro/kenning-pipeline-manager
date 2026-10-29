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
            v-if="!isEditing && modelValue"
            class="rectangle-grouping-name"
            @dblclick.stop="startEditing"
        >
            {{ modelValue }}
        </div>

        <input
            v-else-if="isEditing"
            ref="inputRef"
            class="rectangle-grouping-name-input"
            :value="localName"
            @input="localName = $event.target.value"
            @blur="commit"
            @keydown.enter.prevent="commit"
            @keydown.esc.prevent="cancel"
        />
    </div>
</template>

<script>
import {
    computed, defineComponent, ref, nextTick, watch,
} from 'vue';

export default defineComponent({
    name: 'RectangleGrouping',

    props: {
        modelValue: { type: String, default: '' },
        min: { type: Object, required: true },
        max: { type: Object, required: true },
        visible: { type: Boolean, default: true },
        color: { type: String, default: '#00aaff' },
        padding: { type: Object, required: true },
    },

    emits: ['update:modelValue'],

    setup(props, { emit }) {
        const isEditing = ref(false);
        const localName = ref(props.modelValue);
        const inputRef = ref(null);

        watch(
            () => props.modelValue,
            (val) => { localName.value = val; },
        );

        const startEditing = async () => {
            isEditing.value = true;
            await nextTick();
            inputRef.value?.focus();
            inputRef.value?.select();
        };

        const commit = () => {
            isEditing.value = false;
            emit('update:modelValue', localName.value.trim());
        };

        const cancel = () => {
            isEditing.value = false;
            localName.value = props.modelValue;
        };

        const minWithPadding = computed(() => ({
            x: (props.min?.x ?? 0) - (props.padding?.left ?? 0),
            y: (props.min?.y ?? 0) - (props.padding?.top ?? 0),
        }));

        const maxWithPadding = computed(() => ({
            x: (props.max?.x ?? 0) + (props.padding?.right ?? 0),
            y: (props.max?.y ?? 0) + (props.padding?.bottom ?? 0),
        }));

        const width = computed(() =>
            Math.max(0, maxWithPadding.value.x - minWithPadding.value.x),
        );

        const height = computed(() =>
            Math.max(0, maxWithPadding.value.y - minWithPadding.value.y),
        );

        const styles = computed(() => ({
            position: 'absolute',
            visibility: props.visible ? 'visible' : 'hidden',
            top: `${minWithPadding.value.y}px`,
            left: `${minWithPadding.value.x}px`,
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
        }));

        return {
            styles,
            innerStyles,
            isEditing,
            localName,
            inputRef,
            startEditing,
            commit,
            cancel,
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
    border-radius: 0px;
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
    pointer-events: auto;
    cursor: text;
}

.rectangle-grouping-name-input {
    @extend .rectangle-grouping-name;
    border: none;
    outline: none;
    background-color: #{$gray-700};
}
</style>
