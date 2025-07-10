<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component defining connection between two different nodes
Inherits from baklavajs/renderer-vue/src/connection/ConnectionView.vue
-->

<template>
    <g v-if="hasAnchors">
        <path :d="parsedNewD" class="connection-wrapper baklava-connection"></path>
        <!-- The connection wrapper is rendered twice, once for
            easy highlight detection, and once for creating anchor points -->

        <!-- eslint-disable vue/valid-v-for -->
        <template v-if="hasAnchors">
            <g
                v-for="(d, index) in parsedNewD"
                @pointerdown.left.exact="onMouseDown"
                @pointerdown="(ev) => { if(ev.pointerType === 'touch') onMouseDown(ev) }"
                @pointerdown.left.ctrl.exact="(ev) => onMouseCtrlDown(ev, index)"
            >
            <path :d="d" class="connection-wrapper baklava-connection"></path>
            <path :d="d" class="baklava-connection" :class="cssClasses" :style="style"></path>
            </g>
            <template v-if="hover || !editorManager.baklavaView.settings.hideAnchors">
                <Anchor
                    v-for="(anchor, index) in connection.anchors"
                    :key="anchor.id"
                    :position="anchor"
                    :rightclickCallback="() => removeAnchor(index)"
                />
            </template>
        </template>
    </g>
    <g
        v-else
        @pointerdown.left.exact="onMouseDown"
        @pointerdown="(ev) => { if(ev.pointerType === 'touch') onMouseDown(ev) }"
        @pointerdown.left.ctrl.exact="(ev) => onMouseCtrlDown(ev, 0)"
    >
        <path :d="parsedNewD" class="connection-wrapper baklava-connection"></path>
        <path :d="parsedNewD" class="baklava-connection" :class="cssClasses" :style="style"></path>
    </g>
</template>

<script>
import {
    defineComponent, computed, toRef,
} from 'vue';
import { Components, useGraph, useViewModel } from '@baklavajs/renderer-vue';
import doubleClick from '../../core/doubleClick';
import Anchor from '../../components/Anchor.vue';
import EditorManager from '../../core/EditorManager';

/* eslint-disable vue/no-mutating-props,no-param-reassign */
export default defineComponent({
    extends: Components.Connection,
    props: {
        isHighlighted: { default: false },
        connection: { required: true },
        hover: { default: false },
    },
    components: { Anchor },
    setup(props) {
        const { classes } = Components.Connection.setup(props);
        const { graph } = useGraph();
        const { viewModel } = useViewModel();
        const { interfaceTypes } = viewModel.value;
        const editorManager = EditorManager.getEditorManagerInstance();
        const hover = toRef(props, 'hover');

        const connectionStyle = interfaceTypes.getConnectionStyle(
            props.connection.from,
            props.connection.to,
        );

        const cssClasses = computed(() => ({
            ...classes.value,
            '--hover': props.isHighlighted || hover.value,
            '--dashed': connectionStyle.interfaceConnectionPattern === 'dashed',
            '--dotted': connectionStyle.interfaceConnectionPattern === 'dotted',
        }));

        const style = computed(() => ({
            '--color': connectionStyle.interfaceConnectionColor,
        }));

        const onMouseDown = doubleClick(700, (ev) => {
            if (!viewModel.value.editor.readonly) {
                ev.preventDefault();
                graph.value.removeConnection(props.connection);
            }
        });

        const removeAnchor = (idx) => {
            if (viewModel.value.editor.readonly) return;
            graph.value.events.removeAnchor.emit([props.connection, idx]);
            props.connection.anchors.splice(idx, 1);
        };

        const onMouseCtrlDown = (ev, index) => {
            if (
                viewModel.value.editor.readonly ||
                viewModel.value.connectionRenderer.style !== 'orthogonal'
            ) return;
            ev.preventDefault();

            const newAnchor = {
                x: (ev.offsetX / graph.value.scaling) - graph.value.panning.x,
                y: (ev.offsetY / graph.value.scaling) - graph.value.panning.y,
                id: Date.now(),
            };
                // The index shows the connection section that was pressed -
                // since we have an extra one at the beginning, we need a -1 and a
                // division by 3 with no decimal to determine what anchor position
                // corresponds
            graph.value.addAnchor(newAnchor, props.connection, Math.trunc((index - 1) / 3));
        };

        const transform = (x, y) => {
            const tx = (x + graph.value.panning.x) * graph.value.scaling;
            const ty = (y + graph.value.panning.y) * graph.value.scaling;
            return [tx, ty];
        };

        const newD = computed(() => {
            const [tx1, ty1] = transform(props.x1, props.y1);
            const [tx2, ty2] = transform(props.x2, props.y2);
            return viewModel.value.connectionRenderer.render(tx1, ty1, tx2, ty2, props.connection);
        });

        const parsedNewD = computed(() => {
            const d = newD.value;

            if (Array.isArray(d) && d.length) {
                const parsedArray = [];
                for (let i = 0; i < d.length - 1; i += 1) {
                    parsedArray.push(`M ${d[i].x} ${d[i].y} L ${d[i + 1].x} ${d[i + 1].y}`);
                }
                return parsedArray;
            }
            return d;
        });

        const hasAnchors = computed(() =>
            props.connection.anchors !== undefined &&
            props.connection.anchors.length &&
            viewModel.value.connectionRenderer.style === 'orthogonal',
        );

        return {
            cssClasses,
            parsedNewD,
            onMouseDown,
            onMouseCtrlDown,
            style,
            hasAnchors,
            removeAnchor,
            editorManager,
        };
    },
});
</script>
