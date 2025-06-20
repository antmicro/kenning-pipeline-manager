<!--
Copyright (c) 2022-2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->
<template>
    <div
        ref="root"
        class="__spec-editor-section"
        v-if="visible"
    >
        <div class="__title">Specification</div>
        <div class="__spec-editor">
            <button
                class="baklava-button __validate-button"
                :disabled="validationAvailable()"
                @click="validate"
            >
                Validate
            </button>
            <textarea
                ref="el"
                v-model="currentSpecification"
                class="baklava-input __editor"
                spellcheck="false"
                @input="handleInput"
                @keydown.tab="handleTab"
            />
        </div>
    </div>
</template>

<script>
import YAML from 'yaml';
import {
    computed, defineComponent, nextTick, ref, toRef, watch,
} from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';
import EditorManager from '../core/EditorManager';
import NotificationHandler from '../core/notifications';
import { menuState, configurationState } from '../core/nodeCreation/ConfigurationState.ts';
import { alterInterfaces, alterProperties } from '../core/nodeCreation/Configuration.ts';

export default defineComponent({
    props: {
        node: {
            required: true,
            type: Object,
        },
        scrollHandle: {
            required: false,
            type: HTMLElement,
        },
    },
    setup(props) {
        // State

        const { viewModel } = useViewModel();
        const { displayedGraph } = viewModel.value;
        const editorManager = EditorManager.getEditorManagerInstance();
        const node = toRef(props, 'node');

        const maybeStringify = (maybeSpecification) => (maybeSpecification !== undefined
            ? YAML.stringify(maybeSpecification)
            : '');

        const nodeMatchesSpec = (specNode) => {
            const isCategory = specNode.isCategory ?? false;
            const nodeType = node.value?.type;
            const specNodeType = isCategory
                ? specNode.category?.split('/').slice(-1)[0]
                : specNode.name;
            return nodeType === specNodeType;
        };

        const specificationWithIncludes = ref(null);

        watch(
            [() => editorManager.specification.unresolvedSpecification.nodes, node],
            () => {
                const unresolved = editorManager.specification.unresolvedSpecification;
                const included = editorManager.specification.includedSpecification;
                const specification = JSON.parse(JSON.stringify(unresolved));

                EditorManager.mergeObjects(
                    specification,
                    included,
                );
                specificationWithIncludes.value = specification;
            },
            { immediate: true, deep: true },
        );

        const specification = computed(() => specificationWithIncludes
            .value
            ?.nodes
            ?.find(nodeMatchesSpec));

        // We modify this value in the editor, so it's not exactly computed
        const currentSpecification = ref(maybeStringify(specification.value));
        watch(specification, async () => {
            currentSpecification.value =
                editorManager.modifiedNodeSpecificationRegistry[node.value.id]
                ?? maybeStringify(specification.value);
        });

        const visible = computed(() =>
            specification.value && editorManager.baklavaView.settings.editableNodeTypes);

        // Editor height

        const root = ref(null);
        const el = ref(null);
        const height = ref('auto');
        const handleInput = () => {
            if (!visible.value) { return; }
            const { scrollHandle } = props;
            let prevParentScrollHeight;
            if (props.scrollHandle) {
                prevParentScrollHeight = scrollHandle.scrollTop;
            }

            el.value.style.height = 'auto';
            el.value.style.height = `${el.value.scrollHeight}px`;

            if (scrollHandle !== undefined && scrollHandle.scrollTop < prevParentScrollHeight) {
                scrollHandle.scrollTop = prevParentScrollHeight;
            }

            editorManager.modifiedNodeSpecificationRegistry[node.value.id] =
                currentSpecification.value;
        };

        const delayedEditorUpdate = () => nextTick().then(handleInput);
        watch(currentSpecification, delayedEditorUpdate);
        watch(visible, delayedEditorUpdate);
        delayedEditorUpdate();

        const handleUIUpdate = () => {
            node.value.type = configurationState.nodeData.name;
            const newSpecification = editorManager.specification.unresolvedSpecification
                ?.nodes
                ?.find(nodeMatchesSpec);
            specification.value = newSpecification;
            currentSpecification.value = maybeStringify(newSpecification);
            editorManager.modifiedNodeSpecificationRegistry[node.value.id] =
                currentSpecification.value;
        };

        const delayedUIUpdate = () => nextTick().then(handleUIUpdate);
        watch(menuState, delayedUIUpdate);

        // Validation

        const validate = async () => {
            try {
                const parsedSpecification = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));

                // Update all nodes of the type to match the new specification
                const oldType = node.value.type;
                const nodes = displayedGraph.nodes.filter(
                    (n) => n.type === oldType,
                );

                // Update each field if it is defined
                /* eslint-disable no-param-reassign */
                nodes.forEach((n) => {
                    n.type = parsedSpecification.name;
                    n.title = parsedSpecification.name;
                    delete n.instanceName;

                    Object.entries(parsedSpecification).forEach(([key, value]) => {
                        if (value !== undefined && key !== 'name') {
                            n[key] = value;
                        }
                    });
                });

                if (parsedSpecification.properties !== undefined) {
                    alterProperties(nodes, parsedSpecification.properties);
                }
                if (parsedSpecification.interfaces !== undefined) {
                    alterInterfaces(nodes, parsedSpecification.interfaces);
                }

                // eslint-disable-next-line no-underscore-dangle
                const errors = editorManager._unregisterNodeType(oldType);
                if (errors.length) {
                    NotificationHandler.terminalLog('error', 'Error when registering the node', errors);
                    return;
                }
                // Add type to editor and specification
                const ret = editorManager.addNodeToEditorSpecification(
                    parsedSpecification,
                    oldType,
                );
                if (ret.errors !== undefined && ret.errors.length) {
                    throw new Error(ret.errors);
                }

                NotificationHandler.showToast('info', 'Node validated');
            } catch (error) {
                const messages = Array.isArray(error) ? error : [error];
                NotificationHandler.terminalLog('error', 'Validation failed', messages);
            }
        };

        const validationAvailable = () => {
            try {
                return JSON.stringify(specification.value) ===
                    JSON.stringify(YAML.parse(currentSpecification.value.replaceAll('\t', '  ')));
            } catch {
                return false;
            }
        };

        // Editing

        const handleTab = async (event) => {
            event.preventDefault();
            document.execCommand('insertText', false, '\t');
        };

        return {
            el,
            root,
            handleInput,
            height,
            currentSpecification,
            specification,
            validate,
            validationAvailable,
            visible,
            handleTab,
        };
    },
});
</script>
