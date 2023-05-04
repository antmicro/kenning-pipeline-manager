<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="settings-panel">
        <component
            :is="connectionStyleOption.component"
            :intf="connectionStyleOption"
        ></component>
    </div>
</template>

<script>
// import { NodeOption } from '@baklavajs/core';
import { SelectInterface } from 'baklavajs';

export default {
    props: [ 'baklavaView' ],

    computed: {
        connectionStyleOption() {
            const items = [
                {'text': 'Curved', 'value': 'curved'},
                {'text': 'Orthogonal', 'value': 'orthogonal'}
            ]
            const option = new SelectInterface('Connection style', this.baklavaView.connectionRenderer.style, items).setPort(false);
            option.events.setValue.subscribe(this, (v) => { this.baklavaView.connectionRenderer.style = v; });
            return option;
        }
    }
}
</script>

<style lang="scss">
.settings-panel {
    height: 100px;
    width: 435px;
    top: 60px;
    background-color: $gray-600;
    opacity: 0.9;
    position: absolute;
    right: -495px;
    overflow-y: auto;
}
</style>
