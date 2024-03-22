<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!-- eslint-disable vue/no-multiple-template-root -->
<template>
    <Tooltip
        ref="tooltipRef"
        :left="tooltip.left"
        :top="tooltip.top"
        :text="tooltip.text"
        v-show="tooltip.visible"
    />
    <div
        class="baklava-sidebar prevent-select"
        ref="sidebarRef"
        :class="{
            '--open': graph.sidebar.visible,
            '--hidehud': editorManager.editor.hideHud,
            'hidden-navbar': $isMobile,
        }"
        :style="styles"
    >
        <div class="__resizer" @mousedown="startResize" />
        <div v-if="node" class="__content">
            <div class="__header">
                <Cross tabindex="-1" class="__close" @click="close" />
                <img
                    class="__node-icon"
                    v-if="nodeIconPath !== undefined"
                    :src="nodeIconPath"
                />
                <div class="__node-name">
                    {{ node.title ? node.title : node.type }}
                </div>
                <a
                    v-for="url in nodeURLs"
                    :key="url.name"
                    :href="url.url"
                    class="__url"
                    target="_blank"
                    draggable="false"
                    @pointerover="(ev) => onPointerOver(url.name, ev)"
                    @pointerleave="onPointerLeave"
                >
                    <img
                        v-if="url.icon !== undefined"
                        :src="getIconPath(url.icon)"
                        :alt="url.name"
                        draggable="false"
                    />
                </a>
            </div>
            <div class="__category">
                <div class="__title">Category</div>
                <div class="__category-name">
                    {{ prettyCategory }}
                </div>
            </div>
            <div v-if="!editorManager.editor.readonly" class="__replace">
                <div class="__replace_entry" v-if="replacementParents.length">
                    <div class="__replace_title">Generalize:</div>
                    <div
                        v-for="parent in replacementParents"
                        :key="parent"
                        class="__replace_button"
                    >
                        <component :is="parent.component" :intf="parent"></component>
                    </div>
                </div>
                <div class="__replace_entry" v-if="replacementChildren.length">
                    <div class="__replace_title">Specialize:</div>
                    <div v-for="child in replacementChildren" :key="child" class="__replace_button">
                        <component :is="child.component" :intf="child"></component>
                    </div>
                </div>
                <div class="__replace_entry" v-if="replacementSiblings.length">
                    <div class="__replace_title">Choose other type:</div>
                    <div
                        v-for="sibling in replacementSiblings"
                        :key="sibling"
                        class="__replace_button"
                    >
                        <component :is="sibling.component" :intf="sibling"></component>
                    </div>
                </div>
            </div>
            <div class="__properties" v-if="displayedProperties.length">
                <div class="__title">Properties</div>
                <div v-for="input in displayedProperties" :key="input.id" class="__property">
                    <div class="__property-name">
                        {{ getOptionName(input.componentName) ? `${input.name}:` : '' }}
                    </div>
                    <CustomInterface :node="node" :intf="input" :toggleGroup="toggleGroup" />
                </div>
            </div>

            <div v-show="desc">
                <div class="__title">
                    Description
                </div>
                <div class="__markdown-content" >
                    <span v-html="desc" class="node_description"></span>
                </div>
            </div>

            <div
                class="__interface_groups"
                v-if="interfaceGroupsCheckboxes.length > 0 && !editorManager.editor.readonly"
            >
                <div class="__title">Interface Groups</div>
                <div
                    v-for="intfG in interfaceGroupsCheckboxes"
                    :key="intfG.id"
                    class="__group"
                >
                    <component :is="intfG.component" :intf="intfG"></component>
                </div>
                <div class="__group-assign">
                    <component
                        :is="interfaceGroupsButton.component"
                        :intf="interfaceGroupsButton"
                        :class="interfaceGroupsButtonClasses"
                    ></component>
                </div>
            </div>
            <div v-show="interfaceGroupsOutput.length" class="__error_outputs">
                <div class="__title">Conflicts:</div>
                <!-- eslint-disable vue/require-v-for-key -->
                <p v-for="output in interfaceGroupsOutput">
                    {{ output }}
                </p>
            </div>
        </div>
    </div>
</template>

<script>
import { computed, defineComponent, watch, ref, nextTick } from 'vue'; // eslint-disable-line object-curly-newline
import { CheckboxInterface, ButtonInterface } from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline
import showdown from 'showdown';
import CustomInterface from './CustomInterface.vue';
import Cross from '../icons/Cross.vue';
import Tooltip from '../components/Tooltip.vue';
import EditorManager from '../core/EditorManager';

import { validateInterfaceGroupsNames } from '../core/interfaceParser';
import { getOptionName } from './CustomNode.js';

export default defineComponent({
    components: {
        Cross,
        CustomInterface,
        CheckboxInterface,
        Tooltip,
    },
    emits: ['sidebar-open'],
    setup(_props, { emit }) {
        const editorManager = EditorManager.getEditorManagerInstance();
        const viewModel = computed(() => editorManager.baklavaView);
        const graph = computed(() => viewModel.value.displayedGraph);

        const converter = new showdown.Converter({
            smartIndentationFix: true,
            simpleLineBreaks: true,
        });

        const width = ref(300);

        const node = computed(() => {
            const id = graph.value.sidebar.nodeId;
            return graph.value.nodes.find((x) => x.id === id);
        });

        const category = computed(() => graph.value.editor.nodeTypes.get(node.value.type).category);
        const prettyCategory = computed(() => `${category.value.split('/').join(' / ')}`);

        const desc = computed(() => {
            let html = converter.makeHtml(node.value?.description ?? '');
            const aTagRe = /<a href="[a-zA-Z0-9-$_.+!*'()/&?=:%]+">/gm;
            html.match(aTagRe)?.forEach((match) => {
                const hrefParts = match.split('"');
                // Forces the link to open in a new tab instead of closing the pipeline manager
                const newEnd = ` target="_blank"${hrefParts[2]}`;
                const newHref = [hrefParts[0], hrefParts[1], newEnd].join('"');
                html = html.replace(match, newHref);
            });
            return html;
        });
        const nodeIcon = computed(() => viewModel.value.editor.getNodeIconPath(node.value?.type));
        const nodeURLs = computed(() => viewModel.value.editor.getNodeURLs(node.value?.type));

        const getIconPath = (name) => viewModel.value.cache[`./${name}`] ?? name;
        const nodeIconPath = computed(() => getIconPath(nodeIcon.value));
        const sidebarVisible = computed(() => graph.value.sidebar.visible);

        watch(node, () => {
            if (node.value === undefined) {
                graph.value.sidebar.visible = false;
            }
        });
        watch(sidebarVisible, (newValue) => {
            if (newValue) emit('sidebar-open');
        });

        const tooltipRef = ref(null);
        const tooltip = ref(null);
        const sidebarRef = ref(null);

        tooltip.value = {
            top: 0,
            left: 0,
            visible: false,
            text: '',
        };

        const onPointerOver = (name, ev) => {
            tooltip.value.text = name;
            tooltip.value.visible = true;

            // We need to wait for the next frame to get the tooltips width first to get its width
            nextTick().then(() => {
                const right = ev.clientX - ev.offsetX + ev.currentTarget.offsetWidth / 2 +
                    tooltipRef.value.$el.clientWidth;

                tooltip.value.top = ev.clientY - ev.offsetY + ev.currentTarget.offsetHeight;

                // If the tooltip is out of user view port it is moved to the left
                if (right > window.innerWidth) {
                    tooltip.value.left = ev.clientX - ev.offsetX + ev.currentTarget.offsetWidth / 2
                        - tooltipRef.value.$el.clientWidth / 2;
                } else {
                    tooltip.value.left = ev.clientX - ev.offsetX + ev.currentTarget.offsetWidth / 2;
                }
            });
        };

        const toggleGroup = (intf) => {
            intf.group.forEach((name) => {
                node.value.inputs[name].hidden = intf.value;
            });
        };

        const onPointerLeave = () => {
            tooltip.value.visible = false;
        };

        const styles = computed(() => ({
            width: `${width.value}px`,
        }));

        const close = () => {
            graph.value.sidebar.visible = false;
        };

        const onMouseMove = (ev) => {
            ev.preventDefault();
            width.value -= ev.movementX;
        };

        const startResize = () => {
            width.value = sidebarRef.value.offsetWidth;
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener(
                'mouseup',
                (ev) => {
                    ev.preventDefault();
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

        const replacementButtons = (list) => {
            const buttons = ref([]);

            (list ?? []).forEach((eName) => {
                const button = new ButtonInterface(eName, () => {
                    const newNode = graph.value.replaceNode(node.value, eName);
                    graph.value.sidebar.nodeId = newNode.id;
                });
                button.componentName = 'ButtonInterface';
                buttons.value.push(button);
            });
            return buttons.value;
        };

        const replacementParents = computed(() => replacementButtons(node.value.extends));
        const replacementChildren = computed(() => replacementButtons(node.value.extending));
        const replacementSiblings = computed(() => replacementButtons(node.value.siblings));

        return {
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
            nodeIconPath,
            nodeURLs,
            getIconPath,
            desc,
            tooltip,
            onPointerOver,
            onPointerLeave,
            tooltipRef,
            sidebarRef,
            toggleGroup,
            getOptionName,
            prettyCategory,
            replacementParents,
            replacementChildren,
            replacementSiblings,
            editorManager,
        };
    },
});
</script>
<style lang="scss" scoped>
.prevent-select {
    -webkit-user-select: none; /* Safari */
    -ms-user-select: none; /* IE 10 and IE 11 */
    user-select: none; /* Standard syntax */

    & > .__content {
        -webkit-user-select: text; /* Safari */
        -ms-user-select: text; /* IE 10 and IE 11 */
        user-select: text; /* Standard syntax */
    }
}
</style>
