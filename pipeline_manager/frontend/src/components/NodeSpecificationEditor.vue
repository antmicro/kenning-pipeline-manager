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
                :disabled="!canApplyChanges()"
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
        const root = ref(null);
        const el = ref(null);

        let typingTimer;
        const validateAfterIdleFor = 500;
        const getCorrectSpecificationMessage = () => '<span style="color: var(--baklava-control-color-primary);">The specification is valid.</span>';
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
            specification.value && editorManager.baklavaView.settings.editableNodeTypes,
        );

        /**
         * Validates the interfaces of a parsed node specification.
         *
         * This function performs two main checks:
         * - Ensures that there are no duplicate interface names.
         * - Validates each interface object against a JSON schema.
         *
         * @param {Object} parsedSpecification - The parsed node specification object to validate.
         * @throws {Error} Thrown if the validation failed.
         */
        const validateNodeInterfaces = (parsedSpecification) => {
            if (!parsedSpecification?.interfaces) {
                return;
            }
            // Check for duplicate interface names.
            const names = parsedSpecification.interfaces.map((intf) => intf.name);
            const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);
            if (duplicates.length > 0) {
                throw new Error(`Conflicting interface names: ${[...new Set(duplicates)].join(', ')}`);
            }

            // Validate against the JSON schema.
            parsedSpecification.interfaces.forEach((intf) => {
                const validationErrors = editorManager.validateNodeInterface(intf);
                if (validationErrors.length) {
                    throw new Error(validationErrors);
                }
            });
        };

        /**
         * Validate a node specification.
         *
         * @param {Object} parsedSpecification - The node specification object to validate.
         * @throws {Error} Throws an error containing validation errors if any are found.
         */
        const validateNode = (parsedSpecification) => {
            const validationErrors = editorManager.validateNode(parsedSpecification);
            if (validationErrors.length) {
                throw new Error(validationErrors);
            }
        };

        /**
         * Validate the properties of a node.
         *
         * This function performs two main checks:
         * - Ensures that there are no duplicated properties names.
         * - Validates each interface object against a JSON schema.
         *
         * @param {Object} parsedSpecification - The parsed node specification object to validate.
         * @throws {Error} Raised if a validation failed.
         */
        const validateNodeProperties = (parsedSpecification) => {
            // Check for duplicate property names.
            if (parsedSpecification?.properties) {
                const propNames = parsedSpecification.properties.map((prop) => prop.name);
                const duplicates = propNames.filter((name, idx) => propNames.indexOf(name) !== idx);
                if (duplicates.length > 0) {
                    throw new Error(`Conflicting property names: ${[...new Set(duplicates)].join(', ')}`);
                }
            }

            if (parsedSpecification?.interfaces) {
                parsedSpecification.interfaces.forEach((intf) => {
                    const validationErrors = editorManager.validateNodeInterface(intf);
                    if (validationErrors.length) {
                        throw new Error(validationErrors);
                    }
                });
            }
        };

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

                validateNodeInterfaces(parsedSpecification);
                validateNodeProperties(parsedSpecification);
                validateNode(parsedSpecification);

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
                currentSpecification.value;
        };

        const delayedEditorUpdate = () => nextTick().then(handleInput);
        watch(currentSpecification, delayedEditorUpdate);
        watch(visible, delayedEditorUpdate);
        delayedEditorUpdate();

        const applyChanges = async (unresolvedSpecification, silent) => {
            const output = await editorManager.updateEditorSpecification(unresolvedSpecification);
            if (output.errors !== undefined && output.errors.length) {
                throw new Error(output.errors);
            }

            if (!silent) {
                NotificationHandler.showToast('info', 'Node validated');
            }
        };

        /**
         * Validate the properties of a node.
         *
         * This function performs two main checks:
         * - Ensures that there are no duplicated properties names.
         * - Validates each interface object against a JSON schema.
         *
         * @param {Object} parsedSpecification - The parsed node specification object to validate.
         * @throws {Error} Raised if a validation failed.
         */
        const validateNodeProperties = (parsedSpecification) => {
            // Check for duplicate property names.
            if (parsedSpecification?.properties) {
                const propNames = parsedSpecification.properties.map((prop) => prop.name);
                const duplicates = propNames.filter((name, idx) => propNames.indexOf(name) !== idx);
                if (duplicates.length > 0) {
                    throw new Error(`Conflicting property names: ${[...new Set(duplicates)].join(', ')}`);
                }
            }

            if (parsedSpecification?.interfaces) {
                parsedSpecification.interfaces.forEach((intf) => {
                    const validationErrors = editorManager.validateNodeInterface(intf);
                    if (validationErrors.length) {
                        throw new Error(validationErrors);
                    }
                });
            }
        };

        /**
         * Validates the interfaces of a parsed node specification.
         *
         * This function performs two main checks:
         * - Ensures that there are no duplicate interface names.
         * - Validates each interface object against a JSON schema.
         *
         * @param {Object} parsedSpecification - The parsed node specification object to validate.
         * @throws {Error} Thrown if the validation failed.
         */
        const validateNodeInterfaces = (parsedSpecification) => {
            if (!parsedSpecification?.interfaces) {
                return;
            }
            // Check for duplicate interface names.
            const names = parsedSpecification.interfaces.map((intf) => intf.name);
            const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);
            if (duplicates.length > 0) {
                throw new Error(`Conflicting interface names: ${[...new Set(duplicates)].join(', ')}`);
            }

            // Validate against the JSON schema.
            parsedSpecification.interfaces.forEach((intf) => {
                const validationErrors = editorManager.validateNodeInterface(intf);
                if (validationErrors.length) {
                    throw new Error(validationErrors);
                }
            });
        };

        /**
         * Validate a node specification.
         *
         * @param {Object} parsedSpecification - The node specification object to validate.
         * @throws {Error} Throws an error containing validation errors if any are found.
         */
        const validateNode = (parsedSpecification) => {
            const validationErrors = editorManager.validateNode(parsedSpecification);
            if (validationErrors.length) {
                throw new Error(validationErrors);
            }
        };

        /**
         * Handle the change of a node's name within the specification editor.
         *
         * This function checks if the new name already exists among the nodes in the current
         * specification, including included nodes. It throws an error if a node with the new
         * name already exists. If the node is not from an included specification and the old
         * name exists in the overridden (included) nodes, it sets `includeName` on the parsed
         * specification to the old name to indicate that it is overriding an included node.
         *
         * @param {string} oldName - The current name of the node before the change.
         * @param {string} newName - The new name to assign to the node.
         * @param {Object} parsedSpecification -
         *     The parsed specification object for the node being edited.
         * @throws {Error} If a node with the new name already exists in the specification.
         */
        const handleNameChange = (oldName, newName, parsedSpecification) => {
            if (oldName === newName) {
                return;
            }

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

                /* eslint-disable no-param-reassign */
                if (oldNameInOverridden) {
                    parsedSpecification.includeName = oldName;
                }
            }
        };

        const validate = async (silent = false, shouldCommitChanges = true) => {
            try {
                const parsedSpecification = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));
                let validationErrors = [];

                validateNode(parsedSpecification);
                validateNodeProperties(parsedSpecification);
                validateNodeInterfaces(parsedSpecification);

                // Validate the node in overridden specification
                const unresolvedSpecification =
                    JSON.parse(JSON.stringify(editorManager.specification.unresolvedSpecification));

                // Handle name overrides
                const oldName = node.value.type;
                const newName = EditorManager.getNodeName(parsedSpecification);
                handleNameChange(oldName, newName, parsedSpecification);

                unresolvedSpecification.nodes = (unresolvedSpecification.nodes ?? [])
                    .filter((specNode) => !nodeMatchesSpec(specNode))
                    .concat([parsedSpecification]);

                validationErrors = EditorManager.validateSpecification(unresolvedSpecification);
                if (validationErrors.length) {
                    throw new Error(validationErrors);
                }

                // Update specification
                if (shouldCommitChanges) {
                    await applyChanges(unresolvedSpecification, silent);
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

        /**
         * Checks if the changes to the node specification can be applied.
         *
         * This function compares the current specification (as YAML)
         * with the original specification, and ensures there are no validation
         * errors present in the UI. It uses a cached result to avoid
         * unnecessary recomputation if the specification has not changed.
         *
         * @returns {boolean} Returns `true` if the specification has changed
         *   and there are no validation errors; otherwise, `false`.
         * @throws {Error} Returns `false` if parsing the YAML fails.
         */
        const evaluateIfChangesMayBeApplied = () => {
            const parsedCurrentSpecification = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));
            const differingSpecifications =
                JSON.stringify(specification.value) !== JSON.stringify(parsedCurrentSpecification);

            const validationResult = validate(true, false);
            if (validationResult && validationResult.length > 0) {
                return false;
            }

            const validationErrorsElement = root.value?.querySelector('.__validation_errors');
            const noValidationErrors =
                validationErrorsElement?.innerHTML === getCorrectSpecificationMessage();

            return differingSpecifications && noValidationErrors;
        };

        /**
         * Determines whether the node specification changes can be applied.
         *
         * Compares the current YAML specification with the original,
         * and checks for the absence of validation errors in the UI.
         * Utilizes caching to prevent redundant computations if
         * the specification remains unchanged.
         *
         * @returns {boolean} `true` if the specification has been modified
         *   and there are no validation errors. Otherwise, `false`.
         * @throws {Error} If parsing the YAML fails.
         */
        const canApplyChanges = () => {
            try {
                const hasChanged =
                    canApplyChanges.previousSpecification !== currentSpecification.value;

                if (!hasChanged) {
                    if (canApplyChanges.cachedResult === undefined) {
                        canApplyChanges.cachedResult = evaluateIfChangesMayBeApplied();
                    }
                    return canApplyChanges.cachedResult;
                }

                canApplyChanges.cachedResult = evaluateIfChangesMayBeApplied();
                return canApplyChanges.cachedResult;
            } catch {
                return false;
            }
        };

        /**
         * Format an error message into an HTML element.
         *
         * @param {string|Error} error - The error object or message to format.
         * @returns {string} The formatted error message as an HTML string.
         */
        const formatError = (error) => {
            let errorMessage = (error && error.message) ? error.message : String(error);
            errorMessage = errorMessage.replace(/unresolved_specification\//g, '');
            try {
                // If the error message contains a stringified array, extract and format it.
                const match = errorMessage.match(/\[.*\]/);
                if (match) {
                    const arr = JSON.parse(match[0]);
                    if (Array.isArray(arr)) {
                        errorMessage = errorMessage.replace(match[0], arr.join(', '));
                    }
                }
            } catch (e) {
                // Not a JSON array, leave as it is.
            }
            return `<span style="color: var(--baklava-control-color-error);">${errorMessage}</span>`;
        };

        /**
         * Update the UI to display validation results.
         *
         * This function invokes the `validate` function internally.
         *
         * @async
         * @returns {Promise<void>} Resolves when the validation status has been displayed.
         */
        const showValidationStatus = async () => {
            let output = await validate(true, false) || [];
            if (!Array.isArray(output)) {
                output = [];
            }

            const validationErrorsElement = root.value?.querySelector('.__validation_errors');
            if (output.length > 0) {
                validationErrorsElement.innerHTML = `Problems:<br>${
                    output.map((err) =>
                        `<span style="color: var(--baklava-control-color-error);">${formatError(err)}</span>`,
                    ).join('<br><br>')}`;
            } else {
                validationErrorsElement.innerHTML = getCorrectSpecificationMessage();
            }
        };

        /**
         * Set up a debounced event listener to validate specification.
         *
         * Removes any existing 'keyup' event listener for live validation,
         * then attaches a new listener that waits for the user to stop typing
         * for a specified duration (`validateAfterIdleFor`) before triggering
         * the validation status display (`showValidationStatus`).
         *
         * @returns {void}
         */
        const validateIfTypingCompleted = () => {
            if (!el.value) {
                return;
            }
            el.value.removeEventListener('keyup', el.value.liveValidateListener);
            el.value.liveValidateListener = () => {
                clearTimeout(typingTimer);
                typingTimer = setTimeout(showValidationStatus, validateAfterIdleFor);
            };
            el.value.addEventListener('keyup', el.value.liveValidateListener);
        };

        watch(
            [() => editorManager.specification.unresolvedSpecification.nodes, node],
            () => {
                const unresolved = editorManager.specification.unresolvedSpecification;
                const included = editorManager.specification.includedSpecification;
                const baseSpecification = JSON.parse(JSON.stringify(unresolved));

                EditorManager.mergeObjects(
                    baseSpecification,
                    included,
                );
                specificationWithIncludes.value = baseSpecification;
            },
            { immediate: true, deep: true },
        );

        // Editor height

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
            validateIfTypingCompleted();
        };

        const delayedEditorUpdate = () => nextTick().then(handleInput);
        watch(currentSpecification, delayedEditorUpdate);
        watch(visible, delayedEditorUpdate);
        watch([specification, visible], () => {
            showValidationStatus();
        });
        delayedEditorUpdate();

        watch(
            [() => editorManager.specification.unresolvedSpecification.nodes, node],
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
