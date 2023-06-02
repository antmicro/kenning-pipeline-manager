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
            <div v-for="option in settingOptions" :key="option.id">
                <div class="option-label">
                    {{ displayOptionName(option) ? `${option.name}:` : '' }}
                </div>
                <component :is="option.component" :intf="option"></component>
            </div>

            <div class="__properties" v-show="disableLayersOptions.length !== 0">
                <div class="option-label">Hide Layers:</div>
                <div v-for="option in disableLayersOptions" :key="option.id">
                    <component :is="option.component" :intf="option"></component>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed, ref } from 'vue';
import { SelectInterface, CheckboxInterface } from 'baklavajs';

export default {
    props: {
        viewModel: {
            required: true,
        },
    },
    setup(props) {
        const connectionStyleOption = computed(() => {
            const items = [
                { text: 'Curved', value: 'curved' },
                { text: 'Orthogonal', value: 'orthogonal' },
            ];
            const option = new SelectInterface(
                'Connection style',
                props.viewModel.connectionRenderer.style,
                items,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.viewModel.connectionRenderer.style = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
            });
            option.componentName = 'SelectInterface';
            return option;
        });

        const disableLayersOptions = computed(() => {
            const options = ref([]);

            props.viewModel.ignorableLayers.forEach((layer) => {
                const option = new CheckboxInterface(layer.name, false).setPort(false);
                option.events.setValue.subscribe(this, () => {
                    if (props.viewModel.ignoredLayers.has(layer.name)) {
                        props.viewModel.ignoredLayers.delete(layer.name);
                    } else {
                        props.viewModel.ignoredLayers.add(layer.name);
                    }
                });
                option.componentName = 'CheckboxInterface';
                options.value.push(option);
            });

            return options.value;
        });

        const displayOptionName = (option) => {
            switch (option.componentName) {
                case 'InputInterface':
                case 'SelectInterface':
                case 'ListInterface':
                case 'TextInterface':
                    return true;
                case 'NumberInterface':
                case 'IntegerInterface':
                case 'CheckboxInterface':
                case 'SliderInterface':
                case 'NodeInterface':
                default:
                    return false;
            }
        };

        const settingOptions = computed(() => [connectionStyleOption.value]);

        return { displayOptionName, settingOptions, disableLayersOptions };
    },
};
</script>

<style lang="scss">
.settings-panel {
    // height: 100px;
    width: 435px;
    top: 60px;
    background-color: $gray-600;
    opacity: 0.9;
    position: absolute;
    right: -495px;
    padding: $spacing-l;
    z-index: 1;
    color: white;

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

        & > div {
            & > .option-label {
                padding-bottom: $spacing-s;
                color: $white;
                font-size: $fs-medium;
            }
        }
    }
}
</style>
