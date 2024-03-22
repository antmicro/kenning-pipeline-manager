<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Container for the hterm.js terminal.
-->

<template>
    <div id="hterm-terminal"></div>
</template>

<script>
import {
    defineComponent, computed, onMounted, watch, nextTick,
} from 'vue';
import { terminalStore, MAIN_TERMINAL } from '../core/stores';
import { hterm, lib } from '../third-party/hterm_all';
import getExternalApplicationManager from '../core/communication/ExternalApplicationManager';

export default defineComponent({
    props: {
        terminalInstance: {
            type: String,
        },
    },
    setup(props) {
        let term;
        const htermSettings = {
            'background-color': '#1d1d1d',
            'cursor-color': 'white',
            'mouse-right-click-paste': false,
            'pass-meta-v': false,
            'mouse-paste-button': 'no-button',
            'pass-on-drop': false,
            'shift-insert-paste': false,
        };

        const setHTermPreferences = () => {
            Object.keys(htermSettings).forEach((key) => {
                localStorage.setItem(
                    `/hterm/profiles/default/${key}`,
                    htermSettings[key],
                );
            });
        };

        const logs = computed(() => terminalStore.logs[props.terminalInstance]);

        const logsLength = computed(() => {
            if (logs.value === undefined) {
                return 0;
            }
            return logs.value.length;
        });

        const printLog = (log) => {
            if (term === undefined) return;
            term.io.print(props.terminalInstance === MAIN_TERMINAL ? log.replace(/\n/g, '\r\n') : log);
        };

        let renderIndex = 0;

        const clearLog = () => {
            renderIndex = 0;
            if (term === undefined) return;

            printLog('\u001b[0m');
            term.scrollHome();
            // This line console logs' "Couldn't fetch row index:"
            term.wipeContents();
        };

        const externalApplicationManager = getExternalApplicationManager();
        const writableTerminal = () => (
            externalApplicationManager.appCapabilities.writable_terminal ?? []
        ).includes(props.terminalInstance);

        onMounted(async () => {
            // wait for hterm.js library to load
            // (glatosinski: we may later need to move it to some global scope)
            await lib.init();
            // configure hterm.js style and instantiate the terminal
            setHTermPreferences();
            term = new hterm.Terminal();
            // Disable virtual keyboard for mobile devices
            // eslint-disable-next-line no-underscore-dangle
            term.scrollPort_.contenteditable = false;

            term.onTerminalReady = function onTerminalReady() {
                // load logs that have existed already in the storage.
                // for now configure the terminal as read-only
                this.io.sendString = (string) => {
                    if (writableTerminal()) {
                        externalApplicationManager.requestTerminalRead(
                            props.terminalInstance,
                            string,
                        );
                    }
                };
                this.onVTKeystroke = (string) => {
                    if (writableTerminal()) {
                        externalApplicationManager.requestTerminalRead(
                            props.terminalInstance, string,
                        );
                    }
                };
                this.installKeyboard();
            };
            // pin hterm.js in the template
            term.decorate(document.querySelector('#hterm-terminal'));

            watch(
                [() => props.terminalInstance, logsLength],
                async ([newIns, newLen], [oldIns, oldLen]) => {
                    if (newIns === undefined) {
                        return;
                    }

                    if (writableTerminal()) {
                        // eslint-disable-next-line no-underscore-dangle
                        term.scrollPort_.contenteditable = true;
                        term.setCursorVisible(true);
                    } else {
                        // eslint-disable-next-line no-underscore-dangle
                        term.scrollPort_.contenteditable = false;
                        term.setCursorVisible(false);
                    }
                    // Wait for the next tick to make sure that the terminal is rendered
                    // Otherwise hterm may throw errors related to the dom not being ready
                    await nextTick();

                    // If the instance of the terminal changed
                    if (oldIns !== newIns || newLen === 0) {
                        clearLog();
                    }

                    if (oldLen !== newLen || oldIns !== newIns) {
                        const currentLogs = terminalStore.logs[newIns];

                        currentLogs.slice(renderIndex).forEach((log, _) => {
                            if (renderIndex > 0 && newIns === MAIN_TERMINAL) printLog('\n\n');
                            printLog(log);
                            renderIndex += 1;
                        });
                    }
                },
            );
        });
    },
});
</script>

<style lang="scss" scoped>
#hterm-terminal {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: $gray-600;
}
</style>
