<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Interface that is used to display inputs, outputs and properties of a node.

The custom implementations introduces wrapper functions that prevent the user
from creating and deleting connections or altering nodes' values if the editor is read-only.
-->

<template>
    <div
        :id="intf.id"
        ref="el"
        class="baklava-node-interface"
        :class="newClasses"
    >
        <div
            class="__port"
            v-if="intf.port"
            @mouseenter="startHoverWrapper"
            @mouseleave="endHoverWrapper"
            @pointerdown.left="onMouseDown"
            :class="{ greyedout_arrow: highlighted, picked: picked, '__square': isExposed }"
        >
            <div
                v-if="isExposed && (hovered || editExternalName)"
                :class="{
                    '__port_name_left': intf.side === 'left',
                    '__port_name_right': intf.side === 'right'
                }"
            >
                <input
                    v-if="editExternalName"
                    v-model="inputExternalName"
                    ref="externalNameInput"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    class="__port_input"
                    :class="{ '__error': externalNameInputIncorrect }"
                    placeholder="External name"
                    @focusout="externalNameFocusOutCallback"
                    @keydown.enter.exact.stop="(e) => { e.target.blur(); }"
                    @input="externalNameInputCallback"
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
            <Arrow
                v-if="displayArrow"
                :noninteractable="true"
                color="black"
                scale="big"
                :rotate="arrowRotation"
            />
        </div>

        <!-- @keydown.stop is added so that events are not bubbled up to the editor -->
        <component
            :is="intf.component"
            v-if="showComponent"
            v-model="intf.value"
            :node="node"
            :intf="intf"
            @keydown.stop
            :tabindex="tabindexValue"
        />
        <span v-else>
            {{ intf.name }}
        </span>
    </div>
</template>

<script>
import {
    defineComponent, ref, computed, nextTick,
} from 'vue';
import {
    Components, useViewModel, useGraph, TextInterface,
} from '@baklavajs/renderer-vue';
import Arrow from '../icons/Arrow.vue';
import doubleClick from '../core/doubleClick';
import { DYNAMIC_INTERFACE_PREFIX } from '../core/interfaceParser';

export default defineComponent({
    extends: Components.NodeInterface,
    props: {
        highlighted: Boolean,
        picked: Boolean,
        switchSides: {},
        toggleGroup: { default: () => {}, required: false },
        updateDynamicInterfaces: { default: () => {}, required: false },
        tabindexValue: { default: -1, required: false },
    },
    components: {
        Arrow,
    },
    setup(props) {
        const { el, isConnected, showComponent, startHover, endHover, openSidebar } =
            Components.NodeInterface.setup(props);

        const { viewModel } = useViewModel();
        const { graph } = useGraph();

        props.intf.events.beforeSetValue.unsubscribe(props.intf);
        props.intf.events.beforeSetValue.subscribe(props.intf, (value, prevent) => {
            if (viewModel.value.editor.readonly) {
                prevent();
            }

            if (
                (props.intf.min !== undefined && value < props.intf.min) ||
                (props.intf.max !== undefined && value > props.intf.max)
            ) {
                prevent();
            }
        });

        if (props.intf.group) {
            props.toggleGroup(props.intf);
            props.intf.events.setValue.unsubscribe(props.intf);
            props.intf.events.setValue.subscribe(props.intf, () => props.toggleGroup(props.intf));
        }

        if (props.intf.name.startsWith(DYNAMIC_INTERFACE_PREFIX)) {
            props.updateDynamicInterfaces(props.intf);
            props.intf.events.setValue.unsubscribe(props.intf);
            props.intf.events.setValue.subscribe(props.intf, () =>
                props.updateDynamicInterfaces(props.intf),
            );
        }

        const hovered = ref(false);
        const startHoverWrapper = () => {
            hovered.value = true;
            if (!viewModel.value.editor.readonly) {
                startHover();
            }
        };

        const endHoverWrapper = () => {
            hovered.value = false;
            if (!viewModel.value.editor.readonly) {
                endHover();
            }
        };

        /* eslint-disable vue/no-mutating-props,no-param-reassign */
        const onMouseDown = doubleClick(700, () => {
            if (!viewModel.value.editor.readonly) {
                props.switchSides(props.intf);
                endHover();
            }
        });

        const displayArrow = props.intf.port && props.intf.direction !== 'inout';
        const arrowRotation = computed(() => {
            if (props.intf.direction === 'input') {
                if (props.intf.side === 'left') {
                    return 'right';
                }
                if (props.intf.side === 'right') {
                    return 'down';
                }
            }
            if (props.intf.direction === 'output') {
                if (props.intf.side === 'left') {
                    return 'down';
                }
                if (props.intf.side === 'right') {
                    return 'right';
                }
            }
            return 'down';
        });

        const newClasses = computed(() => ({
            '--input': props.intf.side === 'left',
            '--output': props.intf.side === 'right',
            '--connected': isConnected.value,
            __readonly: viewModel.value.editor.readonly,
        }));

        const isExposed = computed(() =>
            props.intf.externalName !== undefined,
        );

        // External name editing
        const externalNameComponent = new TextInterface('External name', props.intf.externalName).setPort(false);
        externalNameComponent.componentName = 'TextInterface';

        const editExternalName = ref(false);
        const externalNameInputIncorrect = ref(false);
        const externalNameInput = ref(null);
        const externalNames = [];

        const inputExternalName = ref(props.intf.externalName);

        /**
         * Update the list of external names of the interfaces in the current graph.
         */
        const updateExternalNames = () => {
            externalNames.splice(0, externalNames.length);
            externalNames.push(...graph.value.obtainExposedNames());
            externalNames.splice(externalNames.indexOf(props.intf.externalName), 1);
        };

        const enableExternalNameEdit = (e) => {
            // Get the list of external names of the interfaces in the subgraph
            updateExternalNames();

            editExternalName.value = true;
            e.preventDefault();

            // Wait for the next tick to focus the input, so that it is rendered first
            nextTick().then(() => {
                externalNameInput.value.focus();
                externalNameInput.value.select();
                externalNameInputIncorrect.value = graph.value.isIncorrectExternalName(
                    props.intf.externalName,
                    externalNames,
                );
            });
        };

        const externalNameInputCallback = (e) => {
            externalNameInputIncorrect.value = graph.value.isIncorrectExternalName(
                e.target.value,
                externalNames,
            );
        };

        const externalNameFocusOutCallback = () => {
            editExternalName.value = false;
            externalNameInputIncorrect.value = false;
            const newExternalName = graph.value.resolveNewExposedName(inputExternalName.value);
            inputExternalName.value = newExternalName;

            viewModel.value.editor.exposeInterface(
                graph.value.id,
                props.intf,
                newExternalName,
            );
        };

        return {
            arrowRotation,
            displayArrow,
            editExternalName,
            el,
            enableExternalNameEdit,
            endHover,
            endHoverWrapper,
            externalNameInput,
            externalNameInputIncorrect,
            externalNameInputCallback,
            externalNameFocusOutCallback,
            hovered,
            isConnected,
            inputExternalName,
            newClasses,
            onMouseDown,
            openSidebar,
            showComponent,
            isExposed,
            startHover,
            startHoverWrapper,
        };
    },
});
</script>
