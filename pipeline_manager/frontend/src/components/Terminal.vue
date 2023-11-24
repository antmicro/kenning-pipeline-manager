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
import { terminalStore } from '../core/stores';
import { hterm, lib } from '../third-party/hterm_all';

export default defineComponent({
    setup() {
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

        onMounted(async () => {
            // wait for hterm.js library to load
            // (glatosinski: we may later need to move it to some global scope)
            await lib.init();
            // configure hterm.js style and instantiate the terminal
            setHTermPreferences();
            term = new hterm.Terminal();

            term.onTerminalReady = function onTerminalReady() {
                // load logs that have existed already in the storage.
                terminalStore.logs.forEach((log, index) => {
                    if (index > 0) this.io.println('\r\n\r\n');
                    this.io.println(log.replace(/\n/g, '\r\n'));
                });
                // for now configure the terminal as read-only
                this.onVTKeystroke = (_string) => {};
                this.io.sendString = (_string) => {};
                this.setCursorVisible(false);
                this.installKeyboard();
            };
            // pin hterm.js in the template
            term.decorate(document.querySelector('#hterm-terminal'));
        });

        const logs = computed(() => terminalStore.logs);

        const printLog = (log) => {
            if (term === undefined) return;
            term.io.println(log.replace(/\n/g, '\r\n'));
        };

        const clearLog = () => {
            if (term === undefined) return;
            term.clearHome();
        };

        watch(logs, (val, oldval) => {
            if (val === undefined) {
                clearLog();
            }
            if (val.length === 0) {
                clearLog();
            }
            val.forEach((log, index) => {
                if (oldval !== undefined && log === oldval[index]) {
                    return;
                }
                if (index > 0) printLog('\n\n');
                printLog(log);
            });
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
