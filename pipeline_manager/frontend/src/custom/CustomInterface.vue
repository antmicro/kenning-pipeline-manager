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
            @pointerover="startHoverWrapper"
            @pointerout="endHoverWrapper"
            @pointerdown.left="onMouseDown"
            :class="{ greyedout_arrow: highlighted, picked: picked }"
        >
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
        />
        <span v-else class="align-middle">
            {{ intf.name }}
        </span>
    </div>
</template>

<script>
import { defineComponent, computed } from 'vue';
import { Components, useViewModel } from '@baklavajs/renderer-vue';
import Arrow from '../icons/Arrow.vue';
import doubleClick from '../core/doubleClick';

export default defineComponent({
    extends: Components.NodeInterface,
    props: {
        highlighted: Boolean,
        picked: Boolean,
        switchSides: {},
        toggleGroup: { default: () => {}, required: false },
    },
    components: {
        Arrow,
    },
    setup(props) {
        /* eslint-disable object-curly-newline,no-unused-vars */
        const { el, isConnected, showComponent, startHover, endHover, openSidebar } =
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
