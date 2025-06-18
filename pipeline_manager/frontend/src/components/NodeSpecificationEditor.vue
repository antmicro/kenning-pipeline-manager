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
                :disabled="canApplyChanges()"
                @click="validate"
            >
                Apply
            </button>
            <textarea
                ref="el"
                v-model="currentSpecification"
                class="baklava-input __editor"
                spellcheck="false"
                @input="handleInput"
                @keydown.tab="handleTab"
            />
            <button
                class="baklava-button __validate-button"
                :disabled="validationAvailable()"
                @click="validate"
            >
                Commit
            </button>

            <p class="__validation_errors" v-html="getCorrectSpecificationMessage()"></p>
        </div>
    </div>
</template>

<style scoped>
    __validation_errors {
        max-width: 100%;
    }
</style>

<script>
import YAML from 'yaml';
import {
    computed, defineComponent, nextTick, ref, toRef, watch,
} from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';
import EditorManager, { EDITED_NODE_STYLE } from '../core/EditorManager';
import NotificationHandler from '../core/notifications';
import { menuState, configurationState } from '../core/nodeCreation/ConfigurationState.ts';
import { alterInterfaces, alterProperties } from '../core/nodeCreation/Configuration.ts';
import unresolvedSpecificationSchema from '../../../resources/schemas/unresolved_specification_schema.json' with {type: 'json'};

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
        let typingTimer;
        const validateAfterIdleFor = 500;
        const specificationWithIncludes = ref(null);

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
        const currentSpecification = ref(maybeStringify(specification.value));
        const visible = computed(() =>
            specification.value && editorManager.baklavaView.settings.editableNodeTypes);

        // Validation
        const validate = async (silent = false, shouldCommitChanges = true) => {
            try {
                const parsedSpecification = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));

                // Update style of edited node type
                parsedSpecification.style
                    = EditorManager.mergeStyles(EDITED_NODE_STYLE, parsedSpecification.style);
                currentSpecification.value = YAML.stringify(parsedSpecification);
                editorManager.modifiedNodeSpecificationRegistry[node.value.id] =
                    currentSpecification.value;

                // Update all nodes of the type to match the new specification
                const oldType = node.value.type;
                const nodes = displayedGraph.nodes.filter(
                    (n) => n.type === oldType,
                );

                // Update each field if it is defined
                /* eslint-disable no-param-reassign */
                nodes.forEach((n) => {
                    if (n.type === n.title) {
                        n.title = EditorManager.getNodeName(parsedSpecification);
                    } else {
                        n.highlightedType = EditorManager.getNodeName(parsedSpecification);
                    }
                    n.type = EditorManager.getNodeName(parsedSpecification);

                    Object.entries(parsedSpecification).forEach(([key, value]) => {
                        if (value !== undefined && key !== 'name') {
                            n[key] = value;
                        }
                    });
                });

                editorManager.specification.unresolvedSpecification.nodes =
                    (editorManager.specification.unresolvedSpecification.nodes ?? [])
                        .filter((specNode) => !nodeMatchesSpec(specNode))
                        .concat([parsedSpecification]);

                // Remove deleted interfaces and properties
                // An interface was deleted if it's present in old resolved specification
                // but not in the editor and is also not inherited.
                let oldSpecification = editorManager.specification.currentSpecification
                    .nodes?.find((n) => EditorManager.getNodeName(n) === oldType);

                if (oldSpecification === undefined) {
                    oldSpecification = editorManager.specification.currentSpecification
                        .nodes?.find(nodeMatchesSpec);
                }
                if (oldSpecification === undefined) {
                    oldSpecification = editorManager.specification.unresolvedSpecification
                        .nodes?.find(nodeMatchesSpec);
                }
                if (oldSpecification === undefined) {
                    oldSpecification = editorManager.specification.unresolvedSpecification
                        .nodes?.find((n) => EditorManager.getNodeName(n) === oldType);
                }

                const parsedProperties = parsedSpecification.properties ?? [];
                const parsedInterfaces = parsedSpecification.interfaces ?? [];

                const removedProperties = oldProperties.filter(
                    (prop) => !parsedProperties.some((p) => p.name === prop.name),
                ) ?? [];
                const removedInterfaces = oldInterfaces.filter(
                    (intf) => !parsedInterfaces.some((i) => i.name === intf.name),
                ) ?? [];
                const addedProperties = parsedProperties.filter(
                    (prop) => !oldProperties.some((p) => p.name === prop.name),
                ) ?? [];
                const addedInterfaces = parsedInterfaces.filter(
                    (intf) => !oldInterfaces.some((i) => i.name === intf.name),
                ) ?? [];

                const childNodes = displayedGraph.nodes.filter(
                    (n) => n.extends?.includes(oldType),
                ) ?? [];

                alterProperties([...nodes, ...childNodes], removedProperties, true);
                alterInterfaces([...nodes, ...childNodes], removedInterfaces, true);
                alterProperties([...nodes, ...childNodes], parsedSpecification.properties);
                alterInterfaces([...nodes, ...childNodes], parsedSpecification.interfaces);

                const resolvedChildNodes = editorManager.specification.currentSpecification.nodes
                    .filter((n) => n.extends?.includes(oldType)) ?? [];

                resolvedChildNodes.forEach((n) => {
                    n.interfaces = n.interfaces?.filter(
                        (intf) => !removedInterfaces.some((i) => i.name === intf.name),
                    ) ?? [];
                    n.properties = n.properties?.filter(
                        (prop) => !removedProperties.some((p) => p.name === prop.name),
                    ) ?? [];
                    n.interfaces = [...n.interfaces, ...addedInterfaces];
                    n.properties = [...n.properties, ...addedProperties];
                });

                // eslint-disable-next-line no-underscore-dangle
                const errors = editorManager._unregisterNodeType(oldType);
                if (errors.length) {
                    NotificationHandler.terminalLog('error', 'Error when registering the node', errors);
                    return errors;
                }
                // Add type to editor and specification
                let ret = editorManager.addNodeToEditorSpecification(
                    parsedSpecification,
                    oldType,
                    node.value.twoColumn,
                );
                if (ret.errors !== undefined && ret.errors.length) {
                    throw new Error(ret.errors);
                }

                const validationErrors =
                    EditorManager
                        .validateSpecification(
                            editorManager.specification.unresolvedSpecification,
                        );
                if (validationErrors.length) {
                    throw new Error(validationErrors);
                }

                // Update specification
                ret =
                    await editorManager.updateEditorSpecification(
                        editorManager.specification.unresolvedSpecification,
                    );
                if (ret.warnings !== undefined && ret.warnings.length) {
                    if (!silent) {
                        NotificationHandler.terminalLog('warning', 'Warnings during node validation', ret.warnings);
                    }
                }
                if (ret.errors !== undefined && ret.errors.length) {
                    if (silent) {
                        return ret.errors;
                    }
                    throw new Error(ret.errors);
                }

                // Add type to editor and specification
                ret = editorManager.addNodeToEditorSpecification(
                    parsedSpecification,
                    oldType,
                );
                if (ret.errors !== undefined && ret.errors.length) {
                    throw new Error(ret.errors);
                }

                if (!silent) {
                    NotificationHandler.showToast('info', 'Node validated');
                }
                return [];
            } catch (error) {
                const messages = Array.isArray(error) ? error : [error];
                if (!silent) {
                    NotificationHandler.terminalLog('error', 'Validation failed', messages);
                }
                return messages.map((e) => ((e && e.message) ? e.message : String(e)));
            }
        };

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
                maybeStringify(currentSpecification.value);

        const showValidationStatus = async () => {
            let output = await validate(true, false) || [];
            if (!Array.isArray(output)) {
                output = [];
            }

            const validationErrorsElement = root.value?.querySelector('.__validation_errors');
            if (output.length > 0) {
                validationErrorsElement.innerHTML = `Problems:<br>${
                    output.map((err) =>
                        `<span style="color: var(--baklava-control-color-error);">${(err && err.message) ? err.message : String(err)}</span>`,
                    ).join('<br><br>')}`;
            } else {
                validationErrorsElement.innerHTML =
                    '<span style="color: var(--baklava-control-color-primary);">The specification is valid.</span>';
                }
            };

            // Validate only if a user stopped typing for a while.
            if (el.value) {
                el.value.removeEventListener('keyup', el.value.liveValidateListener);
                el.value.liveValidateListener = () => {
                    clearTimeout(typingTimer);
                    typingTimer = setTimeout(showValidationStatus, validateAfterIdleFor);
                };
                el.value.addEventListener('keyup', el.value.liveValidateListener);
            }
        };

        const delayedEditorUpdate = () => nextTick().then(handleInput);
        watch(currentSpecification, delayedEditorUpdate);
        watch(visible, delayedEditorUpdate);
        delayedEditorUpdate();

        watch(
            () => {
                const unresolved = editorManager.specification.unresolvedSpecification;
                const included = editorManager.specification.includedSpecification;
                specification.value = JSON.parse(JSON.stringify(unresolved));

                EditorManager.mergeObjects(
                    specification,
                    included,
                );
                specificationWithIncludes.value = specification;
            },
            { immediate: true, deep: true },
        );

        // We modify this value in the editor, so it's not exactly computed
        watch(specification, async () => {
            currentSpecification.value =
                editorManager.modifiedNodeSpecificationRegistry[node.value.id]
                ?? maybeStringify(specification.value);
        });

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
            canApplyChanges,
            visible,
            handleTab,
            getCorrectSpecificationMessage,
        };
    },
});
</script>
