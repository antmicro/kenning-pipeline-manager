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
                    {{ getOptionName(option) ? `${option.name}:` : '' }}
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
import {
    SelectInterface,
    CheckboxInterface,
    IntegerInterface,
    ButtonInterface,
} from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline
import { getOptionName } from '../custom/CustomNode.js';
import getExternalApplicationManager from '../core/communication/ExternalApplicationManager';

export default {
    props: {
        viewModel: {
            required: true,
        },
    },
    setup(props) {
        const externalApplicationManager = getExternalApplicationManager();
        const metadataChanged = (name, value) => {
            externalApplicationManager.notifyAboutChange('metadata_on_change', {
                metadata: {
                    [name]: value,
                },
            });
        };

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
                metadataChanged('connectionStyle', v);
            });
            option.componentName = 'SelectInterface';
            return option;
        });

        const randomizedOffsetOption = computed(() => {
            const option = new CheckboxInterface(
                'Randomized offset',
                props.viewModel.connectionRenderer.randomizedOffset,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.viewModel.connectionRenderer.randomizedOffset = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
                metadataChanged('randomizedOffset', v);
            });
            option.componentName = 'CheckboxInterface';
            return option;
        });

        const backgroundGridSize = computed(() => {
            const option = new IntegerInterface(
                'Background grid size',
                props.viewModel.settings.background.gridSize,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.viewModel.settings.background.gridSize = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
                metadataChanged('backgroundSize', v);
            });
            option.componentName = 'IntegerInterface';
            return option;
        });

        const movementStep = computed(() => {
            const option = new IntegerInterface(
                'Node movement step',
                props.viewModel.movementStep,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.viewModel.movementStep = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
                metadataChanged('movementStep', v);
            });
            option.componentName = 'IntegerInterface';
            return option;
        });

        const LayoutOption = computed(() => {
            const { layoutManager } = props.viewModel.editor;
            const items = layoutManager
                .getAvailableAlgorithms()
                .map((algorithmName) => ({ text: algorithmName, value: algorithmName }));
            const option = new SelectInterface(
                'Autolayout algorithm',
                layoutManager.usedAlgorithm,
                items,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                layoutManager.useAlgorithm(v);
                metadataChanged('layout', v);
            });
            option.componentName = 'SelectInterface';
            return option;
        });

        const LayoutApply = computed(() => {
            const button = new ButtonInterface('Apply autolayout', () => {
                props.viewModel.editor.applyAutolayout();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        const center = computed(() => {
            const button = new ButtonInterface('Center', () => {
                props.viewModel.editor.centerZoom();
                externalApplicationManager.notifyAboutChange('viewport_on_center');
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        const clearEditor = computed(() => {
            const button = new ButtonInterface('Clean editor', () => {
                props.viewModel.editor.deepCleanEditor();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        const disableLayersOptions = computed(() => {
            const options = ref([]);

            props.viewModel.layers.forEach((layer) => {
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

        const readonlyOptions = computed(() => {
            if (props.viewModel.editor.readonly) {
                return [];
            }
            return [
                connectionStyleOption.value,
                LayoutOption.value,
                LayoutApply.value,
                backgroundGridSize.value,
                clearEditor.value,
                movementStep.value,
                randomizedOffsetOption.value,
            ];
        });

        const settingOptions = computed(() => ([
            center.value,
        ].concat(readonlyOptions.value)));

        return { getOptionName, settingOptions, disableLayersOptions };
    },
};
</script>

<style lang="scss">
.settings-panel {
    background-color: #{$gray-600}E6;
    position: absolute;
    padding: $spacing-l;
    color: white;
    right: -495px;
    width: 435px;
    // viewport - terminal - navbar - padding
    max-height: calc(100vh - 60px - 35px - 2 * $spacing-l);
    min-height: fit-content;
    overflow-y: auto;

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
        user-select: none;

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
