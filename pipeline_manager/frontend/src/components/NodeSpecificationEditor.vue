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
import EditorManager from '../core/EditorManager';
import NotificationHandler from '../core/notifications';

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

        const specificationWithIncludes = computed(() => {
            const specification = JSON.parse(JSON.stringify(
                editorManager.specification.unresolvedSpecification));

            EditorManager.mergeObjects(
                specification,
                editorManager.specification.includedSpecification,
            );
            return specification;
        });

        const specification = computed(() => specificationWithIncludes
            .value
            ?.nodes
            ?.find(nodeMatchesSpec));

        // We modify this value in the editor, so it's not exactly computed
        const currentSpecification = ref(maybeStringify(specification.value));
        watch(specification, async () => {
            currentSpecification.value = maybeStringify(specification.value);
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
        };

        const delayedEditorUpdate = () => nextTick().then(handleInput);
        watch(currentSpecification, delayedEditorUpdate);
        watch(visible, delayedEditorUpdate);
        delayedEditorUpdate();

        // Validation

        const validate = async () => {
            try {
                const parsedSpecification = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));

                // Validate a single node
                let validationErrors = editorManager.validateNode(parsedSpecification);
                if (validationErrors.length) { throw new Error(validationErrors); }

                // Validate the node in overridden specification
                const unresolvedSpecification =
                    JSON.parse(JSON.stringify(editorManager.specification.unresolvedSpecification));

                // Handle name overrides
                const oldName = node.value.type;
                const newName = EditorManager.getNodeName(parsedSpecification);
                if (oldName !== newName) {
                    const newNameInSpec = specificationWithIncludes
                        .value
                        ?.nodes
                        ?.map(EditorManager.getNodeName)
                        .includes(newName);

                    if (newNameInSpec) {
                        throw new Error(`Node ${newName} already exists.`);
                    }

                    // Override included node
                    if (!parsedSpecification.includeName) {
                        const oldNameInOverridden = editorManager
                            .specification
                            .includedSpecification
                            .nodes
                            ?.map(EditorManager.getNodeName)
                            .includes(oldName);

                        if (oldNameInOverridden) {
                            parsedSpecification.includeName = oldName;
                        }
                    }
                }

                unresolvedSpecification.nodes = (unresolvedSpecification.nodes ?? [])
                    .filter((specNode) => !nodeMatchesSpec(specNode))
                    .concat([parsedSpecification]);

                validationErrors = EditorManager.validateSpecification(unresolvedSpecification);
                if (validationErrors.length) { throw new Error(validationErrors); }

                // Update specification
                const ret = await editorManager
                    .updateEditorSpecification(unresolvedSpecification, false, false);
                if (ret.warnings !== undefined && ret.warnings.length) {
                    NotificationHandler.terminalLog('warning', 'Warnings during node validation', ret.warnings);
                }
                if (ret.errors !== undefined && ret.errors.length) { throw new Error(ret.errors); }

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
            // This function is deprecated, but there are currently no alternative to preserve the
            // undo buffer unless we want to switch to a custom editor
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
