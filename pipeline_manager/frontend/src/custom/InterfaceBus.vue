<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
The bus part of a node interface. Element carrying the bus stubs, the temporary
stub preview and the bus name.
-->

<template>
    <div
        class="__port-bus"
        :class="{
            '__big-bus': intf.isTwoSidedBus(),
            greyedout_arrow: highlighted,
        }"
        no-drag="true"
        :style="{height: intf.bus?.size.toString() + 'px'}"
        @mouseenter="startHoverWrapperBus"
        @mouseleave="endHoverWrapperBus"
        @pointerdown.left="(e) => { onMouseDown(); e.stopPropagation() }"
    >
        <div
            v-if="isExposed && (hovered || editExternalName)"
            :class="{
                '__port_name_left': intf.side === 'left',
                '__port_name_top': intf.side == 'top',
                '__port_name_right': intf.side === 'right',
                '__port_name_bottom': intf.side == 'bottom'
            }"
        >
            <input
                v-if="editExternalName"
                ref="externalNameInput"
                :value="inputExternalName"
                type="text"
                spellcheck="false"
                autocomplete="off"
                class="__port_input"
                :class="{ '__error': externalNameInputIncorrect }"
                placeholder="External name"
                @focusout="externalNameFocusOutCallback"
                @keydown.enter.exact.stop="(e) => { e.target.blur(); }"
                @input="onExternalNameInput"
                @pointerdown.left.stop="(e) => e.stopPropagation()"
                @keydown.ctrl.stop="(e) => e.stopPropagation()"
            />
            <span
                v-else
                @pointerdown.left.stop="enableExternalNameEdit"
                @keydown.stop
            >
                {{ intf.externalName }}
            </span>
        </div>
        <div
            class="__port-bus-stub"
            v-if="tempBusIntfOffset && intf.bus?.size"
            :class="{
                picked: picked,
                '__square': isExposed,
                '--input': intf.side === 'left',
                '--output': intf.side === 'right',
            }"
        >
            <div
                class="__port"
                no-drag="true"
                v-if="!hidePort"
                :style="{
                    position: 'absolute',
                    top: tempBusIntfOffset + 'px',
                    pointerEvents: 'none',
                }"
            >
            </div>
        </div>
        <div
            class="__port-bus-stub"
            v-for="stub in intf.bus?.stubs"
            :key="stub.id"
            :id="stub.id"
            :class="newClasses(stub)"
        >
            <div
                class="__port"
                v-if="!hidePort"
                no-drag="true"
                @pointerdown.left.stop="(e) => onStubMouseDown(e, stub.id, stub.offset )"
                :style="{
                    position: 'absolute',
                    top: stub.offset + 'px',
                }"
            >
            </div>
        </div>
        <span
            class="__port-bus-name"
        >
            {{ intf.name }}
        </span>
    </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import {
    useViewModel, useGraph,
} from '@baklavajs/renderer-vue';
import doubleClick from '../core/doubleClick';

const { viewModel } = useViewModel();
const { graph } = useGraph();

const props = defineProps({
    intf: { type: CustomNodeInterface, required: true },
    temporaryConnection: { type: Object, required: true },
    nodeWidth: { type: Number, required: true },
    highlighted: { type: Boolean, default: false },
    picked: { type: Boolean, default: false },
    hidePort: { type: Boolean, default: false },
    isExposed: { type: Boolean, default: false },
    hovered: { type: Boolean, default: false },
    editExternalName: { type: Boolean, default: false },
    inputExternalName: { type: String, default: undefined },
    externalNameInputIncorrect: { type: Boolean, default: false },
    newClasses: { type: Function, required: true },
    startHoverWrapper: { type: Function, required: true },
    endHoverWrapper: { type: Function, required: true },
    onMouseDown: { type: Function, required: true },
    externalNameFocusOutCallback: { type: Function, required: true },
    externalNameInputCallback: { type: Function, required: true },
    enableExternalNameEdit: { type: Function, required: true },
    setInputExternalName: { type: Function, required: true },
});

const mousePosStubDragStart = ref(undefined);
const movedStubId = ref(undefined);
const movedStubOffset = ref(undefined);
const onStubMove = (ev) => {
    if (!viewModel.value.editor.readonly) {
        const stub = props.intf.findBusStub(movedStubId.value);
        const curY = ev.clientY;
        // no recalculations on each pan since this is used in callaback
        const dv = (curY - mousePosStubDragStart.value) / graph.value.scaling;
        stub.offset = movedStubOffset.value + dv;
        stub.offset = Math.min(Math.max(stub.offset, 0), props.intf.bus?.size ?? 0);
    }
};
const onStubMouseUp = () => {
    if (!viewModel.value.editor.readonly) {
        window.removeEventListener('pointermove', onStubMove);
        window.removeEventListener('pointerup', onStubMouseUp);
        mousePosStubDragStart.value = undefined;
        movedStubId.value = undefined;
        movedStubOffset.value = undefined;
    }
};
const stubSideSwitch = doubleClick(700, (id) => {
    if (props.intf.isTwoSidedBus()) {
        const stub = props.intf.findBusStub(id);
        props.switchSides(stub);
    }
});

const onStubMouseDown = (ev, id, off) => {
    if (viewModel.value.editor.readonly) {
        return;
    }
    window.addEventListener('pointermove', onStubMove);
    window.addEventListener('pointerup', onStubMouseUp);
    mousePosStubDragStart.value = ev.clientY;
    movedStubId.value = id;
    movedStubOffset.value = off;
    stubSideSwitch(id);
};
const tempBusIntfOffset = ref(undefined);
const onBusMove = (ev) => {
    if (props.temporaryConnection.value && props.intf.bus?.type) {
        /* eslint-disable vue/no-mutating-props,no-param-reassign */
        props.temporaryConnection.value.updated = ev.offsetY;
        tempBusIntfOffset.value = ev.offsetY;

        const bus = props.intf;
        if (props.intf.isTwoSidedBus()) {
            if (ev.offsetX > props.nodeWidth.value / 2) {
                bus.side = 'right';
            } else {
                bus.side = 'left';
            }
        }
    } else {
        tempBusIntfOffset.value = undefined;
    }
};
const startHoverWrapperBus = (ev) => {
    window.addEventListener('pointermove', onBusMove);
    onBusMove(ev);
    props.startHoverWrapper(ev);
};

const endHoverWrapperBus = () => {
    window.removeEventListener('pointermove', onBusMove);
    tempBusIntfOffset.value = undefined;
    props.endHoverWrapper();
};

const onExternalNameInput = (e) => {
    props.setInputExternalName(e.target.value);
    props.externalNameInputCallback(e);
};

const externalNameInput = ref(null);
watch(
    () => props.editExternalName,
    (val) => {
        if (val) {
            nextTick().then(() => {
                externalNameInput.value?.focus();
                externalNameInput.value?.select();
            });
        }
    },
);
</script>
<style lang="scss">
.__big-bus {
    width: auto !important;
    margin-left: -0.75em !important;
    margin-right: -0.75em !important;

    &>.--input {
        margin-left: -0.5em;
        margin-right: auto;
    }

    &>.--output {
        margin-right: 0em;
        margin-left: auto;
    }

    &>.__port-bus-name {
        display: block;
        width: 100%;
        display: flex;
        justify-content: center;
        writing-mode: horizontal-tb;
    }
}

.__port-bus {
    width: 3em;
    background-color: var(--baklava-control-color-background);
    cursor: crosshair;
    border-radius: 1px;
    border-color: var(--baklava-control-color-primary);
    border-style: dotted;

    &>.__port-bus-stub {
        width: 0;
        max-height: 0px;
        z-index: 2;

        &>.__port {
            cursor: grab;
        }
    }
}

.__port-bus-name {
    display: var(--kpm-interface-display-name);
    writing-mode: vertical-lr;
}

.--output {
    &>.__port-bus:not(.__big-bus) {
        margin-right: -1.25em;
        margin-left: auto;

        &>.__port-bus-name {
            float: left;
        }
    }
}

.--input {
    &>.__port-bus:not(.__big-bus) {
        margin-left: -1.25em;
        margin-right: auto;

        &>.__port-bus-name {
            float: right;
        }
    }
}

.baklava-ignore-mouse .__port-bus {
    pointer-events: all !important;
}

.baklava-ignore-mouse .__port-bus-stub {
    pointer-events: all !important;
}

.__port-bus.greyedout_arrow {
    border-color: $gray-500 !important;
}
</style>
