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
                    v-for="terminal in displayedTerminals"
                    :key="terminal.name"
                    class="tab-item"
                    :class="pipelineSpanClasses(terminal.name)"
                    @click="toggleTerminalPanel(terminal.name)"
                >
                    <span :class="pipelineSpanClasses(terminal.name)">{{ terminal.name }}</span>
                    <div class="indicator-wrapper">
                        <Indicator
                            v-if="terminal.hasNewMessage"
                            :color="terminalIndicatorColor(terminal.hasNewMessage)"
                        />
                    </div>
                </button>
            </div>

            <div class="button-wrapper">
                <button v-if="isTerminalPanelOpened" @click="clearTerminalOutput(activeTerminal)">
                    <Bin/>
                    <span>Clear terminal</span>
                </button>
                <button
                    @click="() => { arrowHovered = false; toggleTerminalPanel(undefined) }"
                    @mouseenter="arrowHovered = true"
                    @mouseleave="arrowHovered = false"
                >
                    <Arrow
                        v-if="!isTerminalPanelOpened"
                        color="white"
                        scale="small"
                        rotate="up"
                        :hover="arrowHovered"
                    />
                    <Arrow v-else color="white" scale="small" rotate="left" :hover="arrowHovered" />
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
    Ref,
    computed,
    StyleValue,
    watch,
} from 'vue';

import Terminal from './Terminal.vue';
import Arrow from '../icons/Arrow.vue';
import Indicator from '../icons/Indicator.vue';
import Bin from '../icons/Bin.vue';
import { mouseDownHandler } from '../core/events';
import { terminalStore, MAIN_TERMINAL } from '../core/stores';

export default defineComponent({
    components: {
        Arrow,
        Indicator,
        Bin,
        Terminal,
    },
    setup() {
        const resizer = ref<HTMLElement | null>(null);
        const terminalWrapper = ref<HTMLElement | null>(null);

        const activeTerminal = ref<string | undefined>(undefined);
        const isTerminalPanelOpened = ref<boolean>(false);

        const arrowHovered = ref(false);

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

        onMounted(() => {
            resizer.value!.addEventListener('mousedown', mouseDownHandler);
        });

        const displayedTerminals: Ref<{
            name: string,
            hasNewMessage: boolean,
        }[]> = ref([]);

        // Computing tuples of names and lengths of terminals
        const terminalNamesLengths = computed(() => {
            const terminalLogs = Object.values(terminalStore.logs);
            const lengths = terminalLogs.map((log) => log.length);

            const names = Object.keys(terminalStore.logs);

            const tuples = [];
            for (let i = 0; i < names.length; i += 1) {
                tuples.push({
                    name: names[i],
                    length: lengths[i],
                });
            }
            return tuples;
        });

        watch(terminalNamesLengths, (newVal, oldVal) => {
            const oldNames = oldVal?.map((tuple) => tuple.name);

            newVal.forEach((tuple) => {
                if (!(oldNames?.includes(tuple.name))) {
                    // Adding new terminals to the displayed ones
                    displayedTerminals.value.push({
                        name: tuple.name,
                        hasNewMessage: tuple.length !== 0,
                    });
                } else {
                    // Checking whether length changed in an existing terminal
                    const oldTuple = oldVal!.find((t) => t.name === tuple.name);
                    if (oldTuple!.length !== tuple.length && tuple.name !== activeTerminal.value) {
                        const terminal = displayedTerminals.value.find(
                            (t) => t.name === tuple.name,
                        );
                        terminal!.hasNewMessage = true;
                    }
                }
            });
        }, {
            immediate: true,
        });

        const terminalIndicatorColor = (hasNewMessage: boolean) => {
            if (hasNewMessage) return 'green';
            return 'gray';
        };

        const setReadMessages = (terminalName: string) => {
            displayedTerminals.value.forEach((terminal) => {
                // eslint-disable-next-line no-param-reassign
                if (terminal.name === terminalName) terminal.hasNewMessage = false;
            });
        };

        const toggleTerminalPanel = (terminal: string | undefined) => {
            if (terminal === undefined && !isTerminalPanelOpened.value) {
                activeTerminal.value = MAIN_TERMINAL;
                isTerminalPanelOpened.value = true;
                setReadMessages(MAIN_TERMINAL);
            } else if (terminal === activeTerminal.value || terminal === undefined) {
                activeTerminal.value = undefined;
                isTerminalPanelOpened.value = false;
            } else {
                activeTerminal.value = terminal;
                isTerminalPanelOpened.value = true;
                setReadMessages(terminal);
            }
        };

        const clearTerminalOutput = (terminal?: string) => {
            if (terminal !== undefined) {
                terminalStore.remove(terminal);
            } else {
                terminalStore.remove();
            }
        };

        return {
            toggleTerminalPanel,
            clearTerminalOutput,
            displayedTerminals,
            activeTerminal,
            isTerminalPanelOpened,
            resizer,
            terminalWrapper,
            pipelineSpanClasses,
            terminalWrapperStyles,
            resizerStyles,
            arrowHovered,
            terminalIndicatorColor,
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
    width: calc(100% - #{$spacing-xxl});
    border-bottom: 1px solid $gray-500;
    display: flex;
    padding-right: $spacing-xxl;
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

        & > button {
            gap: $spacing-s;
        }
    }

    & > .tab {
        display: flex;
        text-align: center;
        height: $terminal-container-height;

        & > .tab-item {
            border-right: 1px solid $gray-500;
            padding: 0 0 0 $spacing-xl;

            line-height: $terminal-container-height;
            &.active {
                background-color: #{$gray-400};

                & > span {
                    color: $green;
                }
            }

            &:not(.active):hover {
                background-color: #{$gray-500};

                & > span {
                    color: $green;
                }
            }

            & .indicator-wrapper {
                width: $spacing-xl;
                height: 100%;
                display: flex;

                > svg {
                    padding: $spacing-xs;
                    display: block;
                    margin-left: auto;
                }
            }
        }
    }
}

span {
    color: $white;
    font-size: $fs-small;
    user-select: none;
}

button {
    display: flex;

    &:hover {
        color: $green;

        & > span {
            color: $green;
        }
    }
}
</style>
