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
    <div :id="intf.id" ref="el" class="baklava-node-interface" :class="classes">
        <div
            class="__port"
            v-if="intf.port"
            @pointerover="startHoverWrapper"
            @pointerout="endHoverWrapper"
        >
            <Arrow v-if="displayArrow" color="black" scale="medium" rotate="right" />
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
import { defineComponent } from 'vue';
import { Components, useViewModel } from 'baklavajs';
import Arrow from '../icons/Arrow.vue';

export default defineComponent({
    extends: Components.NodeInterface,
    components: {
        Arrow,
    },
    setup(props) {
        /* eslint-disable object-curly-newline */
        const { el, isConnected, classes, showComponent, startHover, endHover, openSidebar } =
            Components.NodeInterface.setup(props);

        const { viewModel } = useViewModel();

        if (viewModel.value.editor.readonly) {
            const token = Symbol(null);
            props.intf.events.beforeSetValue.subscribe(token, (_, prevent) => {
                prevent();
            });
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

        const displayArrow = props.intf.port && props.intf.direction !== 'inout';

        return {
            el,
            isConnected,
            classes,
            showComponent,
            startHover,
            endHover,
            openSidebar,
            startHoverWrapper,
            endHoverWrapper,
            displayArrow,
        };
    },
});
</script>
