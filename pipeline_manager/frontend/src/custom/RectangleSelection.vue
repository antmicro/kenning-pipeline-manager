<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="rectangle-selection" :style="styles">

    </div>
</template>

<script>
import { computed, reactive, defineComponent, watch, ref, toRef, onMounted } from 'vue'; // eslint-disable-line object-curly-newline
import useDragMove from './useDragMove';
import selectionRefBegin from './Editor'
import { useViewModel, useGraph } from '@baklavajs/renderer-vue';

export default defineComponent({
    setup(props) {

        // const dragMove = useDragMove(
        //     toRef(props.positionEnd)
        // );

        // const classes = computed(() => ({
        //     '--dragging': dragMove.dragging.value,
        // }));

        // console.log(selectionRefBegin);
        
        const selecting = ref(false);
        const selectionBegin = ref({x: 0, y: 0});
        const selectionEnd = ref({x: 0, y: 0});
        const selectionBoundingRect = computed(() => ({
            xBegin: selectionBegin?.value.x < selectionEnd?.value.x ? selectionBegin?.value.x : selectionEnd?.value.x,
            yBegin: selectionBegin?.value.y < selectionEnd?.value.y ? selectionBegin?.value.y : selectionEnd?.value.y,
            xEnd: selectionBegin?.value.x >= selectionEnd?.value.x ? selectionBegin?.value.x : selectionEnd?.value.x,
            yEnd: selectionBegin?.value.y >= selectionEnd?.value.y ? selectionBegin?.value.y : selectionEnd?.value.y,
        }));

        const { graph } = useGraph();

        const dragMove = useDragMove(selectionEnd);
        const { viewModel } = useViewModel();

        const styles = computed(() => ({
            position: 'absolute',
            top: `${selectionBoundingRect.value.yBegin}px`,
            left: `${selectionBoundingRect.value.xBegin}px`,
            width: `${Math.abs(selectionBoundingRect.value.xEnd - selectionBoundingRect.value.xBegin) ?? 0}px`,
            height: `${Math.abs(selectionBoundingRect.value.yEnd - selectionBoundingRect.value.yBegin) ?? 0}px`,
            
            background: 'red',
            opacity: 0.3,
        }));

        const onPointerDown = (ev) => {
            selecting.value = true;
            selectionBegin.value = {x: ev.pageX, y: ev.pageY};
            selectionEnd.value = {x: ev.pageX, y: ev.pageY};
        }

        const onPointerMove = (ev) => {
            if (selecting.value) {
                selectionEnd.value = {x: ev.pageX, y: ev.pageY};
            }
        }

        const onPointerUp = (ev) => {

            selecting.value = false;
            selectionBegin.value = {x: 0, y: 0};
            selectionEnd.value = {x: 0, y: 0};
        }

        return {
            styles,
            onPointerDown,
            onPointerMove,
            onPointerUp
        };
    },
});


</script>