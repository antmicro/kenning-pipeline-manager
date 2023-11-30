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

        onMounted(async () => {
            // wait for hterm.js library to load
            // (glatosinski: we may later need to move it to some global scope)
            await lib.init();
            // configure hterm.js style and instantiate the terminal
            setHTermPreferences();
            term = new hterm.Terminal();

            term.onTerminalReady = function onTerminalReady() {
                // load logs that have existed already in the storage.
                if (props.terminalInstance === MAIN_TERMINAL) {
                    logs.value.forEach((log, index) => {
                        if (index > 0) this.io.print('\r\n\r\n');
                        this.io.print(log.replace(/\n/g, '\r\n'));
                    });
                }
                // for now configure the terminal as read-only
                this.onVTKeystroke = (_string) => {};
                this.io.sendString = (_string) => {};
                this.setCursorVisible(false);
                this.installKeyboard();
            };
            // pin hterm.js in the template
            term.decorate(document.querySelector('#hterm-terminal'));
        });

        const printLog = (log) => {
            if (term === undefined) return;
            term.io.print(props.terminalInstance === MAIN_TERMINAL ? log.replace(/\n/g, '\r\n') : log);
        };

        const clearLog = () => {
            if (term === undefined) return;
            term.clearHome();
        };

        // If a terminal instance was changed, then all messages should be written
        let flush = false;
        watch(() => props.terminalInstance, () => {
            clearLog();
            flush = true;
            // Stop escape sequences from other terminals
            printLog('\u001b[0m');
        });

        watch(logs, (val, oldval) => {
            if (val === undefined || val.length === 0) {
                clearLog();
                flush = false;
                return;
            }
            val.forEach((log, index) => {
                if (!flush && oldval !== undefined && log === oldval[index]) {
                    return;
                }
                if (index > 0 && props.terminalInstance === MAIN_TERMINAL) printLog('\n\n');
                printLog(log);
            });
            flush = false;
        }, {
            immediate: true,
            deep: true,
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
