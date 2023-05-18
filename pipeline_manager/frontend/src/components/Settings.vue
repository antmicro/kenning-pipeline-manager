<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="settings-panel">
        <div class="setting-header">
            <span>Settings</span>
        </div>
        <div class="panel">
            <component
                :is="connectionStyleOption.component"
                :intf="connectionStyleOption"
            ></component>
        </div>
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
    padding: $spacing-l;

    & > .setting-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: $spacing-l;

        & > span {
            color: $white;
            font-size: $fs-large;
        }
    }

    & > .panel {
        display: grid;
        grid-row-gap: $spacing-l;
    }
}
</style>
