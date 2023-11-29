<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Resizable terminal panel that handles the user interactions
-->

<template>
    <div ref="terminalWrapper" class="terminal-wrapper" :style="terminalWrapperStyles">
        <div class="container">
            <div ref="resizer" class="resizer" :style="resizerStyles"/>
            <div class="tab">
                <button
                    v-for="terminal in terminalNames"
                    :key="terminal"
                    class="tab-item"
                    @click="toggleTerminalPanel(terminal)"
                >
                    <span :class="pipelineSpanClasses(terminal)">{{ terminal }}</span>
                </button>
            </div>

            <div class="button-wrapper">
                <button v-if="isTerminalPanelOpened" @click="clearTerminalOutput(activeTerminal)">
                    <Bin/>
                    <span>Clear terminal</span>
                </button>
                <button @click="toggleTerminalPanel(undefined)">
                    <Arrow
                        v-if="!isTerminalPanelOpened"
                        color="white"
                        scale="small"
                        rotate="up"
                    />
                    <Arrow v-else color="white" scale="small" rotate="left" />
                </button>
            </div>
        </div>
        <Terminal :terminalInstance=activeTerminal v-if="isTerminalPanelOpened" />
    </div>
</template>

<script lang="ts">
import {
    defineComponent,
    onMounted,
    ref,
    computed,
    StyleValue,
} from 'vue';

import Terminal from './Terminal.vue';
import Arrow from '../icons/Arrow.vue';
import Bin from '../icons/Bin.vue';
import { mouseDownHandler } from '../core/events';
import { terminalStore, MAIN_TERMINAL } from '../core/stores';

export default defineComponent({
    components: {
        Arrow,
        Bin,
        Terminal,
    },
    setup() {
        const resizer = ref<HTMLElement | null>(null);
        const terminalWrapper = ref<HTMLElement | null>(null);

        const activeTerminal = ref<string | undefined>(undefined);
        const isTerminalPanelOpened = ref<boolean>(false);

        const pipelineSpanClasses = (terminal: string) => ({
            active: isTerminalPanelOpened.value && terminal === activeTerminal.value,
        });

        const terminalWrapperStyles = computed(() => {
            const terminalWrapperHeight = terminalWrapper.value?.clientHeight ?? 0;
            const minTerminalPanelHeight = 395;

            if (isTerminalPanelOpened.value) {
                return {
                    height: `${Math.max(terminalWrapperHeight, minTerminalPanelHeight)}px`,
                };
            }
            return {
                height: 'unset',
            };
        });

        const resizerStyles = computed(() => ({
            'pointer-events': (isTerminalPanelOpened.value ? 'all' : 'none'),
        }) as StyleValue);

        const toggleTerminalPanel = (terminal: string | undefined) => {
            if (terminal === undefined && !isTerminalPanelOpened.value) {
                activeTerminal.value = MAIN_TERMINAL;
                isTerminalPanelOpened.value = true;
            } else if (terminal === activeTerminal.value || terminal === undefined) {
                activeTerminal.value = undefined;
                isTerminalPanelOpened.value = false;
            } else {
                activeTerminal.value = terminal;
                isTerminalPanelOpened.value = true;
            }
        };

        const clearTerminalOutput = (terminal?: string) => {
            if (terminal !== undefined) {
                terminalStore.remove(terminal);
            } else {
                terminalStore.remove();
            }
        };

        onMounted(() => {
            resizer.value!.addEventListener('mousedown', mouseDownHandler);
        });

        const terminalNames = computed(() => Object.keys(terminalStore.logs));

        return {
            toggleTerminalPanel,
            clearTerminalOutput,
            terminalNames,
            activeTerminal,
            isTerminalPanelOpened,
            resizer,
            terminalWrapper,
            pipelineSpanClasses,
            terminalWrapperStyles,
            resizerStyles,
        };
    },
});
</script>

<style lang="scss" scoped>
.terminal-wrapper {
    z-index: 3;
    position: absolute;
    min-height: $terminal-container-height;
    border-top: 1px solid $gray-500;
    bottom: 0;
    width: 100%;
    transition: transform 1s;
    display: flex;
    flex-direction: column;
}

.container {
    position: relative;
    height: $terminal-container-height;
    min-height: $terminal-container-height;
    background-color: $gray-600;
    /* Calculation to prevent panel overflow */
    width: calc(100% - 2 * #{$spacing-xxl});
    border-bottom: 1px solid $gray-500;
    display: flex;
    padding: 0 $spacing-xxl;
    align-items: center;
    justify-content: space-between;
    user-select: none;

    & > .resizer {
        position: absolute;
        height: 5px;
        width: 100%;
        top: 0;
        cursor: row-resize;
        pointer-events: none;
    }

    & > .button-wrapper {
        display: flex;
        align-items: center;
        gap: $spacing-xxl;
    }

    & > .tab {
        display: flex;
        gap: 40px;
    }
}

span {
    color: $white;
    font-size: $fs-small;
    user-select: none;
}

span.active {
    color: $green;
}

button {
    display: flex;
    gap: $spacing-s;

    &:hover > span {
        color: $green;
    }
}
</style>
