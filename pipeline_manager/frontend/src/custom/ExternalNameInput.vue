<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
External-name editor of a node interface, shared by all interface kinds:
the editable name label, displayed when `visible` or while editing, with
a text input validating the name against the other exposed names of the
graph and committing it on blur. Its state is owned by the component
through the `useExternalName` composable.
-->

<template>
    <div
        v-if="visible || editExternalName"
        :class="wrapperClass"
    >
        <input
            v-if="editExternalName"
            ref="externalNameInput"
            :value="inputExternalName"
            type="text"
            spellcheck="false"
            autocomplete="off"
            :class="[inputClass, { '__error': externalNameInputIncorrect }]"
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
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import useExternalName from './externalName';
import { CustomNodeInterface } from './CustomNodeInterface.js';

const props = defineProps({
    intf: { type: CustomNodeInterface, required: true },
    visible: { type: Boolean, default: false },
    wrapperClass: { type: [Object, String], default: undefined },
    inputClass: { type: String, default: '__port_input' },
});

const {
    editExternalName,
    enableExternalNameEdit,
    externalNameFocusOutCallback,
    externalNameInputIncorrect,
    inputExternalName,
    onExternalNameInput,
} = useExternalName(props.intf);

const externalNameInput = ref(null);
watch(
    editExternalName,
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
