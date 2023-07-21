<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div
        ref="el"
        class="baklava-sidebar"
        :class="{ '--open': graph.sidebar.visible }"
        :style="styles"
    >
        <div class="__resizer" @mousedown="startResize" />

        <div v-if="node" class="__content">
            <div class="__header">
                <Cross tabindex="-1" class="__close" @click="close" />
                <div class="__node-name">
                    {{ node.title ? node.title : node.type }}
                </div>
                <!-- !ICONS -->
            </div>

            <div class="__properties" v-if="displayedProperties.length">
                <div class="__title">Properties</div>
                <div v-for="input in displayedProperties" :key="input.id" class="__property">
                    {{ input.name }}
                    <CustomInterface :node="node" :intf="input" />
                </div>
            </div>

            <div class="__interface_groups" v-if="interfaceGroupsCheckboxes.length">
                <div class="__title">Interface Groups</div>
                <div v-for="intfG in interfaceGroupsCheckboxes" :key="intfG.id">
                    <component :is="intfG.component" :intf="intfG"></component>
                </div>
                <component
                    :is="interfaceGroupsButton.component"
                    :intf="interfaceGroupsButton"
                    :class="interfaceGroupsButtonClasses"
                ></component>
                <div v-if="interfaceGroupsOutput.length" class="__error_outputs">
                    <h1>Conflicts:</h1>
                    <!-- eslint-disable vue/require-v-for-key -->
                    <p v-for="output in interfaceGroupsOutput">
                        {{ output }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed, defineComponent, watch, ref } from 'vue'; // eslint-disable-line object-curly-newline
import { useGraph, CheckboxInterface, ButtonInterface } from '@baklavajs/renderer-vue';
import CustomInterface from './CustomInterface.vue';
import Cross from '../icons/Cross.vue';

import { validateInterfaceGroupsNames } from '../core/NodeFactory';

export default defineComponent({
    components: {
        Cross,
        CustomInterface,
        CheckboxInterface,
    },
    setup() {
        const { graph } = useGraph();

        const el = ref(null);
        const width = ref(300);

        const node = computed(() => {
            const id = graph.value.sidebar.nodeId;
            return graph.value.nodes.find((x) => x.id === id);
        });

        watch(node, () => {
            if (node.value === undefined) {
                graph.value.sidebar.visible = false;
            }
        });

        const styles = computed(() => ({
            width: `${width.value}px`,
        }));

        const close = () => {
            graph.value.sidebar.visible = false;
        };

        const onMouseMove = (event) => {
            width.value -= event.movementX;
        };

        const startResize = () => {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener(
                'mouseup',
                () => {
                    window.removeEventListener('mousemove', onMouseMove);
                },
                { once: true },
            );
        };

        const displayedInputs = computed(() =>
            Object.values(node.value.inputs).filter((ni) => !ni.hidden),
        );
        const displayedProperties = computed(() =>
            Object.values(displayedInputs.value).filter((intf) => !intf.port),
        );

        const interfaceGroups = computed(() =>
            Object.values({ ...node.value.inputs, ...node.value.outputs }).filter(
                (ni) => ni.interfaces !== undefined,
            ),
        );

        const interfaceGroupsOutput = ref('');
        const interfaceGroupsButtonClasses = computed(() => ({
            '--disabled': interfaceGroupsOutput.value !== '',
        }));

        const interfaceGroupsCheckboxes = computed(() => {
            const checkboxes = ref([]);
            // So that interfaces are recomputed when this value changes
            graph.value.sidebar.visible; // eslint-disable-line no-unused-expressions

            interfaceGroups.value.forEach((intfG) => {
                const checkbox = new CheckboxInterface(intfG.name, !intfG.hidden).setPort(false);
                checkbox.events.setValue.subscribe(this, () => {
                    const errors = validateInterfaceGroupsNames(
                        enabledInterfaceGroups.value, // eslint-disable-line no-use-before-define
                        node.value.inputs,
                        node.value.outputs,
                    );

                    if (errors.length) {
                        interfaceGroupsOutput.value = errors.map(
                            ([parsedIntfName, intfDirection, groupName]) =>
                                `Reused ${intfDirection} - ${parsedIntfName} for interface group ${groupName}`,
                        );
                    } else {
                        interfaceGroupsOutput.value = '';
                    }
                });
                checkbox.componentName = 'CheckboxInterface';
                checkbox.intfG = intfG;
                checkboxes.value.push(checkbox);
            });

            return checkboxes.value;
        });

        const enabledInterfaceGroups = computed(() => {
            const enabledInterfaceGroupsCheckboxes = [];

            interfaceGroupsCheckboxes.value.forEach((intf) => {
                if (intf.value) {
                    enabledInterfaceGroupsCheckboxes.push(
                        `${intf.intfG.direction}_${intf.intfG.name}`,
                    );
                }
            });
            return enabledInterfaceGroupsCheckboxes;
        });

        const interfaceGroupsButton = computed(() => {
            const checkbox = new ButtonInterface('Assign', () => {
                interfaceGroupsCheckboxes.value.forEach((intf) => {
                    node.value.toggleInterfaceGroup(intf.intfG, intf.value);
                });
                interfaceGroupsOutput.value = '';
            });
            checkbox.componentName = 'ButtonInterface';
            return checkbox;
        });

        return {
            el,
            graph,
            node,
            styles,
            startResize,
            close,
            displayedProperties,
            interfaceGroups,
            interfaceGroupsCheckboxes,
            interfaceGroupsButton,
            interfaceGroupsOutput,
            interfaceGroupsButtonClasses,
        };
    },
});
</script>

<style>
.--disabled {
    pointer-events: none;
    cursor: not-allowed;
    opacity: 0.65;
    filter: alpha(opacity=65);
    -webkit-box-shadow: none;
    box-shadow: none;
}
</style>
