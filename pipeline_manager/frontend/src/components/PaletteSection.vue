<!--
Copyright (c) 2022-2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
A collection of palette entries.
-->

<template>
    <div ref="entriesRef" class="entries">
        <PaletteEntry
            v-for="entry in entries"
            :key="entry.id"
            :entry="entry"
        />
        <transition name="fade">
        <div v-if="draggedEntry" class="baklava-dragged-node __dragged" :style="{
                width: 'unset',
                top: `${pointer.y}px`,
                left: `${pointer.x}px`,
            }">
                <PaletteEntry :entry="draggedEntry" />
            </div>
        </transition>
        <CustomContextMenu
            v-model="showContextMenu"
            :x="contextMenuPosition.x"
            :y="contextMenuPosition.y"
            :items="contextMenuEntry?.computed?.items ?? []"
            :ignore-close="[entriesRef]"
            @click="(...args) => contextMenuEntry?.data?.onContextMenu?.(...args)"
        />
    </div>
</template>

<script lang="ts" setup generic="T extends IEntryData">
import {
    Ref,
    inject,
    onMounted,
    onUnmounted,
    provide,
    ref,
    shallowRef,
    useTemplateRef,
    Reactive,
    computed,
    nextTick,
} from 'vue';
import { useTransform } from '@baklavajs/renderer-vue';
import { usePointer } from '@vueuse/core';
// eslint-disable-next-line no-unused-vars
import { type IEntry, type IEntryData } from '../core/palette/types';
import PaletteEntry from './PaletteEntry.vue';
import CustomContextMenu from '../custom/ContextMenu.vue';

// eslint-disable-next-line no-undef
type IPaletteEntryDataT = T;
type Entry = IEntry<IPaletteEntryDataT>;

const props = defineProps<{ palette: HTMLElement, entries: Reactive<Entry[]> }>();

const editorEl = inject<Ref<HTMLElement | null>>('editorEl');

const absolutePointer = usePointer();
const pointer = computed(() => {
    const { left, top } = editorEl!.value!.getBoundingClientRect();
    return {
        x: absolutePointer.x.value - left,
        y: absolutePointer.y.value - top,
    };
});
const { transform } = useTransform();

/* DRAGGING */

const draggedEntry = shallowRef<Reactive<Entry> | null>();

// eslint-disable-next-line no-unused-vars
let dragEnd: ((ev: PointerEvent) => void);
let postDragEnd: () => void;

provide('dragstart', (entry: Reactive<Entry>) => {
    if (!entry.data.onDrag) return;
    draggedEntry.value = entry;
    document.body.classList.add('grabbing');
    document.addEventListener('pointerup', dragEnd);
});

let { x, y } = { x: 0, y: 0 };
dragEnd = (ev: PointerEvent) => {
    const entry = draggedEntry.value;
    document.body.classList.remove('grabbing');

    const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
    if (elements.includes(props.palette) || !entry?.data.onDrag) return;

    [x, y] = transform(pointer.value.x, pointer.value.y);

    // Callback
    entry.data.onDrag({ x, y });
    postDragEnd();
};

postDragEnd = () => {
    draggedEntry.value = null;
    document.removeEventListener('pointerup', dragEnd!);
};

const dragEndDeselect = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return;
    document.body.classList.remove('grabbing');
    postDragEnd();
};

const onMountedDrag = () => document.addEventListener('keydown', dragEndDeselect);
const onUnmountedDrag = () => document.removeEventListener('keydown', dragEndDeselect);

/* LINK MENU */

const scroll = ref(0);
const entriesRef = useTemplateRef('entriesRef');
provide('palettescroll', scroll);
provide('linkmenu', ref<string | null>(null));
const onMountedLinkMenu = () => entriesRef.value!.addEventListener('scroll', () => {
    scroll.value = entriesRef.value!.scrollTop;
});

/* CONTEXT MENU */

const contextMenuEntry = shallowRef<Reactive<IEntry> | null>(null);
const showContextMenu = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
provide('contextMenuEntry', computed(() => (showContextMenu.value ? contextMenuEntry.value : null)));
provide('contextMenuToggle', async (entry: Reactive<IEntry>) => {
    showContextMenu.value = false;
    await nextTick();
    if (!entry.computed?.items?.length) return;
    showContextMenu.value = true;
    contextMenuEntry.value = entry;
    contextMenuPosition.value.x = pointer.value.x + 1;
    contextMenuPosition.value.y = pointer.value.y + 1;
});

onMounted(() => {
    onMountedLinkMenu();
    onMountedDrag();
});
onUnmounted(() => {
    onUnmountedDrag();
});
</script>

<style lang="scss">
.entries {
    overflow-y: auto;
    overflow-x: hidden;
}

.__dragged {
    z-index: 1000;

    .__link-menu-wrapper, .__child {
        display: none
    }

    .__entry {
        background-color: unset;
        border-width: 0;

        * {
            display: none;
        }

        & > .__entry-content {
            display: flex;
            border-radius: var(--baklava-node-border-radius);

            & > .__title-label {
                display: revert;
            }
        }
    }
}
</style>
