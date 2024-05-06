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
            :class="{ greyedout_arrow: highlighted, picked: picked, '__square': squared }"
        >
            <div
                v-if="squared && (hovered || editExternalName)"
                :class="{
                '__port_name_left': intf.side === 'left',
                '__port_name_right': intf.side === 'right'
                }"
            >
                <input
                    v-if="editExternalName"
                    v-model="intf.externalName"
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
import { Components, useViewModel, TextInterface } from '@baklavajs/renderer-vue';
import Arrow from '../icons/Arrow.vue';
import doubleClick from '../core/doubleClick';

export default defineComponent({
    extends: Components.NodeInterface,
    props: {
        highlighted: Boolean,
        picked: Boolean,
        switchSides: {},
        toggleGroup: { default: () => {}, required: false },
        tabindexValue: { default: -1, required: false },
    },
    components: {
        Arrow,
    },
    setup(props) {
        const {
            el, isConnected, showComponent, startHover, endHover, openSidebar,
        } =
            Components.NodeInterface.setup(props);

        const { viewModel } = useViewModel();

        props.intf.events.beforeSetValue.unsubscribe(props.intf);
        props.intf.events.beforeSetValue.subscribe(props.intf, (_, prevent) => {
            if (viewModel.value.editor.readonly) {
                prevent();
            }
        });

        if (props.intf.group) {
            props.toggleGroup(props.intf);
            props.intf.events.setValue.unsubscribe(props.intf);
            props.intf.events.setValue.subscribe(props.intf, () => props.toggleGroup(props.intf));
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
        const squared = computed(() => {
            const sq = !isConnected.value && viewModel.value.editor.subgraphStack.length > 0;
            if (sq && props.intf.externalName === undefined) {
                props.intf.externalName = props.intf.name;
            }
            return sq;
        });

        // External name editing
        const externalNameComponent = new TextInterface('External name', props.intf.externalName).setPort(false);
        externalNameComponent.componentName = 'TextInterface';

        const editExternalName = ref(false);
        const externalNameInputIncorrect = ref(false);
        const externalNameInput = ref(null);
        const externalNames = [];

        const updateExternalNames = () => {
            /* eslint-disable no-underscore-dangle */
            const nodes = viewModel.value.editor.subgraphStack[0][1].subgraph._nodes;
            externalNames.splice(0, externalNames.length);
            nodes.forEach((node) => {
                Object.values(node.inputs).forEach((intf) => {
                    externalNames.push(intf.externalName);
                });
                Object.values(node.outputs).forEach((intf) => {
                    externalNames.push(intf.externalName);
                });
            });
            externalNames.splice(externalNames.indexOf(props.intf.externalName), 1);
        };

        const isIncorrectExternalName = (name) => {
            const sameNames = externalNames.filter((n) => n === name).length;
            return sameNames !== 0;
        };

        const enableExternalNameEdit = (e) => {
            editExternalName.value = true;
            e.preventDefault();

            // Get the list of external names of the interfaces in the subgraph
            updateExternalNames();

            // Wait for the next tick to focus the input, so that it is rendered first
            nextTick().then(() => {
                externalNameInput.value.focus();
                externalNameInput.value.select();
                externalNameInputIncorrect.value = isIncorrectExternalName(props.intf.externalName);
            });
        };

        const externalNameFocusOutCallback = (e) => {
            editExternalName.value = false;
            externalNameInputIncorrect.value = false;
            updateExternalNames();

            // Check if the external name is taken and add a suffix if it is
            let suffix = 1;
            let tmpName = e.target.value ? e.target.value : props.intf.name;
            e.target.value = tmpName;
            while (isIncorrectExternalName(tmpName)) {
                tmpName = `${e.target.value}_${suffix}`;
                suffix += 1;
            }

            props.intf.externalName = tmpName;
        };

        const externalNameInputCallback = (e) => {
            externalNameInputIncorrect.value = isIncorrectExternalName(e.target.value);
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
            newClasses,
            onMouseDown,
            openSidebar,
            showComponent,
            squared,
            startHover,
            startHoverWrapper,
        };
    },
});
</script>
