<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Interface that is used to display inputs, outputs and properties of a node.

The custom implementations introduces wrapper functions that prevent the user
from creating and deleting connections or altering nodes' values if the editor is read-only.
-->

<template>
    <div :id="intf.id" ref="el" class="baklava-node-interface" :class="newClasses">
        <div
            class="__port"
            v-if="intf.port"
            @pointerover="startHoverWrapper"
            @pointerout="endHoverWrapper"
            @pointerdown="onMouseDown"
            :class="{ greyedout_arrow: highlighted }"
        >
            <Arrow v-if="displayArrow" color="black" scale="medium" :rotate="arrowRotation" />
        </div>

        <component
            :is="intf.component"
            v-if="showComponent"
            v-model="intf.value"
            :node="node"
            :intf="intf"
            @open-sidebar="openSidebar"
        />
        <span v-else class="align-middle">
            {{ intf.name }}
        </span>
    </div>
</template>

<script>
import { defineComponent, computed } from 'vue';
import { Components, useViewModel } from 'baklavajs';
import Arrow from '../icons/Arrow.vue';
import doubleClick from '../core/doubleClick';

export default defineComponent({
    extends: Components.NodeInterface,
    props: {
        highlighted: Boolean,
    },
    components: {
        Arrow,
    },
    setup(props) {
        /* eslint-disable object-curly-newline,no-unused-vars */
        const { el, isConnected, classes, showComponent, startHover, endHover, openSidebar } =
            Components.NodeInterface.setup(props);

        const { viewModel } = useViewModel();

        const token = Symbol(null);
        props.intf.events.beforeSetValue.subscribe(token, (_, prevent) => {
            if (viewModel.value.editor.readonly) {
                prevent();
            }
        });

        const startHoverWrapper = () => {
            if (!viewModel.value.editor.readonly) {
                startHover();
            }
        };

        const endHoverWrapper = () => {
            if (!viewModel.value.editor.readonly) {
                endHover();
            }
        };

        /* eslint-disable vue/no-mutating-props,no-param-reassign */
        const onMouseDown = doubleClick(700, () => {
            if (!viewModel.value.editor.readonly) {
                if (props.intf.side === 'left') {
                    props.intf.side = 'right';
                } else {
                    props.intf.side = 'left';
                }
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
        }));

        return {
            el,
            isConnected,
            newClasses,
            showComponent,
            startHover,
            endHover,
            openSidebar,
            startHoverWrapper,
            endHoverWrapper,
            displayArrow,
            arrowRotation,
            onMouseDown,
        };
    },
});
</script>
