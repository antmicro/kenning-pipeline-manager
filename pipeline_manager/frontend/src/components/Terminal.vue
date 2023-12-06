<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Container for the hterm.js terminal.
-->

<template>
    <div class="terminal-container">
        <div id="hterm-terminal"></div>
    </div>
</template>

<script>
import {
    defineComponent, computed, onMounted, watch,
} from 'vue';
import { terminalStore, MAIN_TERMINAL } from '../core/stores';
import { hterm, lib } from '../third-party/hterm_all';

export default defineComponent({
    props: {
        terminalInstance: {
            required: true,
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
        const logsLength = computed(() => logs.value.length);

        const printLog = (log) => {
            if (term === undefined) return;
            term.io.print(props.terminalInstance === MAIN_TERMINAL ? log.replace(/\n/g, '\r\n') : log);
        };

        let renderIndex = 0;

        const clearLog = () => {
            if (term === undefined) return;
            // This line console logs' "Couldn't fetch row index:"
            term.wipeContents();
            term.scrollHome();
            printLog('\u001b[0m');
            renderIndex = 0;
        };

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
                this.onVTKeystroke = (_string) => {};
                this.io.sendString = (_string) => {};
                this.setCursorVisible(false);
                this.installKeyboard();
            };
            // pin hterm.js in the template
            term.decorate(document.querySelector('#hterm-terminal'));

            if (logs.value !== undefined) {
                logs.value.forEach((log, _) => {
                    if (renderIndex > 0 && props.terminalInstance === MAIN_TERMINAL) printLog('\n\n');
                    printLog(log);
                    renderIndex += 1;
                });
            }

            // This watcher needs to be set inside of mount function as it has
            // to be turned after the async initialisation is done.
            watch(
                [() => props.terminalInstance, logsLength],
                ([newIns, newLen], [oldIns, oldLen]) => {
                    let terminalSwitched = false;

                    // If the instance of the terminal changed
                    if (oldIns !== newIns) {
                        clearLog();
                        terminalSwitched = true;
                    }

                    // If terminal was cleared, new content appeared or the instance was changed
                    if (oldLen !== newLen || terminalSwitched) {
                        const currentLogs = terminalStore.logs[props.terminalInstance];

                        // If terminal was cleared
                        if (newLen === 0 && !terminalSwitched) {
                            clearLog();
                        } else {
                            currentLogs.slice(renderIndex).forEach((log, _) => {
                                if (renderIndex > 0 && newIns === MAIN_TERMINAL) printLog('\n\n');
                                printLog(log);
                                renderIndex += 1;
                            });
                        }
                    }
                },
            );
        });
    },
});
</script>

<style lang="scss" scoped>
.terminal-container {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: $gray-600;
}
</style>
