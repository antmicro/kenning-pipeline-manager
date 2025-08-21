<!--
Copyright (c) 2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="details-panel">
        <div class="__content">
            <div class="=__header">
                <div class="__title">{{ graphNodeName }}</div>
            </div>
            <div class="__properties" v-if="displayedProperties.length">
                <div class="__title">Properties</div>
                <div v-for="input in displayedProperties" :key="input.id" class="__property">
                    <div class="__property-name">
                        {{ getOptionName(input.componentName) ? `${input.name}:` : '' }}
                    </div>
                    <CustomInterface
                        :node="node"
                        :intf="input"
                        :toggleGroup="toggleGroup"
                        :updateDynamicInterfaces="updateDynamicInterfaces"
                        tabindex="-1"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, watch } from 'vue';
import { getOptionName } from '../custom/CustomNode.js';
import CustomInterface from '../custom/CustomInterface.vue';

export default {
    components: {
        CustomInterface,
    },
    props: {
        viewModel: {
            required: true,
        },
    },
    setup(props) {
        const node = ref(null);
        const graphNodeName = ref('');
        const displayedProperties = ref([]);

        watch(props.viewModel.editor.graph, () => {
            node.value = props.viewModel.editor.graph.graphNode;
            if (node.value) {
                graphNodeName.value = node.value.title !== '' ? node.value.title : node.value.type;
                displayedProperties.value = Object.values(node.value.inputs)
                    .filter((intf) => !intf.port);
            } else {
                graphNodeName.value = props.viewModel.editor.graph.name;
                displayedProperties.value = props.viewModel.editor.graph.nodes
                    .map((n) => Object.values(n.inputs)).flat()
                    .filter((intf) => !intf.port && intf.externalName);
            }
        });

        const toggleGroup = (intf) => {
            intf.group.forEach((name) => {
                node.value.inputs[name].hidden = !intf.value;
            });
        };

        const updateDynamicInterfaces = (intf) => {
            node.value.updateDynamicInterfaces(intf);
        };

        return {
            node,
            graphNodeName,
            displayedProperties,
            getOptionName,
            toggleGroup,
            updateDynamicInterfaces,
        };
    },
};
</script>

<style lang="scss">
.details-panel {
    $settings-width: 435px;
    $settings-maxwidth: calc(100vw - 2 * $spacing-l);

    position: absolute;
    padding: 0;
    top: calc($navbar-height + 1px);
    right: -495px;

    height: calc(100% - $navbar-height - $terminal-container-height);
    width: $settings-width;
    max-width: $settings-maxwidth;

    background-color: #{$gray-600}E6;
    color: white;

    z-index: 4;
    overflow-y: auto;

    & > .__content {
        display: flex;
        flex-direction: column;

        & > div {
            border: 1px solid #393939;
            border-right: 0;
            border-left: 0;
            border-top: 0;

            & > .__title {
                text-align: left;
                font-weight: 600;
                padding: 1.25em 0.625em;

                border: 1px solid #393939;
                border-right: 0;
                border-left: 0;
                border-top: 0;
            }
        }

        & > .__properties {
            & > .__property {
                padding: 0.625em 1.25em 0 1.25em;

                & > .__property-name {
                    font-size: 0.9em;
                }

                & * {
                    box-sizing: border-box;
                }
            }

            & > .__property:last-child {
                padding-bottom: 1.25em;
            }
        }
    }
}
</style>
