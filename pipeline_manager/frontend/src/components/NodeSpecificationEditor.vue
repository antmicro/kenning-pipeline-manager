<!--
Copyright (c) 2022-2026 Antmicro <www.antmicro.com>

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
                :disabled="!canApplyChanges"
                @click="updateSpecification"
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
                :disabled="!editorStateChanged"
                @click="discard"
            >
                Discard
            </button>
            <p class="__validation_errors">
                <template v-if=" cachedValidationResult.length > 0">
                    Problems:<br>
                    <span
                        v-for="(err, idx) in cachedValidationResult"
                        :key="idx"
                        style="color: var(--baklava-control-color-error);"
                    >
                        {{ formatError(err) }}
                    </span>
                </template>
                <template v-else>
                    <span style="color: var(--baklava-control-color-primary);">
                        The specification is valid.
                    </span>
                </template>
            </p>
        </div>
    </div>
</template>

<script>
import YAML from 'yaml';
import {
    computed, defineComponent, nextTick, ref, toRef, watch, onMounted, onBeforeUnmount, reactive,
} from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';
import EditorManager, { EDITED_NODE_STYLE } from '../core/EditorManager';
import NotificationHandler from '../core/notifications';
import { menuState, configurationState, editorEventBus } from '../core/nodeCreation/ConfigurationState.ts';

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

        const editorManager = reactive(EditorManager.getEditorManagerInstance());
        const node = toRef(props, 'node');
        const root = ref(null);
        const el = ref(null);

        let typingTimer;
        const validateAfterIdleFor = 500;

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

        const getSpecificationWithIncludes = () => {
            const unresolved = editorManager.specification.unresolvedSpecification;
            const included = editorManager.specification.includedSpecification;
            const specification = JSON.parse(JSON.stringify(unresolved));

            EditorManager.mergeObjects(specification, included);
            specificationWithIncludes.value = specification;
        };

        getSpecificationWithIncludes();

        const specification = computed(() => specificationWithIncludes
            .value
            ?.nodes
            ?.find(nodeMatchesSpec));

        // We modify this value in the editor, so it's not exactly computed
        const currentSpecification = ref(maybeStringify(specification.value));

        // Validation

        /**
         * Find duplicate values in an array of objects based on a specified property.
         *
         * @param {Array} array - The array of objects to search for duplicates.
         * @param {string} propertyName - The property name to check for duplicate values.
         * @returns {Array} An array containing the values of the specified property
         *     that appear more than once.
         */
        const findDuplicates = (array, propertyName) => {
            const nameCounter = new Map();
            array.forEach((element) => {
                let count = 1;
                if (nameCounter.has(element[propertyName])) {
                    count = nameCounter.get(element[propertyName]) + 1;
                }
                nameCounter.set(element[propertyName], count);
            });

            return Array.from(
                nameCounter.entries(),
            )
                .filter(([_, count]) => count > 1)
                .map(([name]) => name);
        };

        const findMatching = (array1, array2, propertyName) => {
            const matching = [];
            array1.forEach((el1) => {
                if (array2.find((el2) => el1[propertyName] === el2[propertyName])) {
                    matching.push(el1[propertyName]);
                }
            });
            return matching;
        };

        /**
         * Validates the interfaces of a parsed node specification.
         *
         * This function ensures that there are no duplicate interface names.
         *
         * @param {Object} parsedSpecification - The parsed node specification object to validate.
         * @throws {Error} Thrown if the validation failed.
         */
        const validateNodeInterfaces = (parsedSpecification) => {
            if (!parsedSpecification?.interfaces) {
                return;
            }
            const type = parsedSpecification.name;
            const intfs = parsedSpecification.interfaces;

            const duplicates = findDuplicates(intfs, 'name');
            if (duplicates.length > 0) {
                throw new Error(`Conflicting interface names: ${duplicates.join(', ')}`);
            }
            const inheritedIntf = editorManager.findInheritedInterfaces(type);
            const inheritedShadowed = findMatching(intfs, inheritedIntf, 'name');
            const inheritedInvalid = inheritedShadowed.filter((name) =>
                !intfs.some((intf) => intf.name === name && intf.override));
            if (inheritedInvalid.length > 0) {
                throw new Error(`Implicitly overriding inherited interface: ${inheritedInvalid.join(', ')}, please use 'override'`);
            }
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
         * This function ensures that there are no duplicated properties names.
         *
         * @param {Object} parsedSpecification - The parsed node specification object to validate.
         * @throws {Error} Raised if a validation failed.
         */
        const validateNodeProperties = (parsedSpecification) => {
            if (!parsedSpecification?.properties) {
                return;
            }

            const type = parsedSpecification.name;
            const prop = parsedSpecification.properties;
            const duplicates = findDuplicates(prop, 'name');
            if (duplicates.length > 0) {
                throw new Error(`Conflicting property names: ${duplicates.join(', ')}`);
            }
            const inheritedProps = editorManager.findInheritedProperties(type);
            const inheritedShadowed = findMatching(prop, inheritedProps, 'name');
            const inheritedInvalid = inheritedShadowed.filter((name) =>
                !prop.some((p) => p.name === name && p.override));
            if (inheritedInvalid.length > 0) {
                throw new Error(`Implicitly overriding inherited property: ${inheritedInvalid.join(', ')}, please use 'override'`);
            }
        };

        /**
         * Validate the style of a node.
         *
         * @param {Object} parsedSpecification - The parsed node specification object to validate.
         * @throws {Error} Raised if a validation failed.
         */
        const validateNodeStyle = (parsedSpecification) => {
            const validationErrors = editorManager.validateNodeStyle(parsedSpecification);
            if (validationErrors.length) throw new Error(validationErrors);
        };

        const validate = () => {
            const errors = [];
            try {
                const parsedCurrentSpecification = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));
                const differingSpecifications =
                    JSON.stringify(specification.value) !==
                    JSON.stringify(parsedCurrentSpecification);

                if (!differingSpecifications) {
                    return []; // No changes, so no errors to show
                }

                try {
                    validateNode(parsedCurrentSpecification);
                } catch (e) { errors.push(e); }
                try {
                    validateNodeProperties(parsedCurrentSpecification);
                } catch (e) { errors.push(e); }
                try {
                    validateNodeInterfaces(parsedCurrentSpecification);
                } catch (e) { errors.push(e); }
                try {
                    validateNodeStyle(parsedCurrentSpecification);
                } catch (e) { errors.push(e); }
            } catch (error) {
                errors.push(error);
            }
            return errors;
        };

        // Reference to cache validation results.
        const cachedValidationResult = ref([]);
        const updateCachedValidationResult = () => {
            cachedValidationResult.value = validate();
        };

        const visible = computed(
            () => !editorManager.baklavaView.editor.readonly
                && specification.value
                && editorManager.baklavaView.settings.editableNodeTypes,
        );

        /**
         * Based on edited type and specification will propagate all changes through graphs
         * in the editor.
         * @param {string} type - type of node that was edited.
         * @param {Object} parsedSpecification - a graph that will be processed.
         * @param {Object} editor - opened editor in which the changes will be applied.
         */
        const updateGraphsInEditor = (type, parsedSpecification, editor) => {
            const graphs = Array.from(editor.graphs);
            graphs.forEach((graph) => {
                graph.nodes.filter((n) => n.type === type)
                    .forEach((n) => {
                        if (parsedSpecification?.isCategory) {
                            graph.replaceNode(n, n.type);
                        } else {
                            graph.replaceNode(n, parsedSpecification.name);
                        }
                    });
            });

            graphs.forEach((graph) => graph.nodes.filter((n) => n?.subgraph)
                .forEach((n) => n.updateExposedInterfaces(undefined, undefined)));
        };

        const updateSpecification = async () => {
            try {
                const { viewModel } = useViewModel();
                const { editor } = viewModel.value;

                const parsingErrors = validate();
                if (parsingErrors.length > 0) {
                    throw new Error(parsingErrors);
                }
                const parsedSpecification = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));

                // Update style of edited node type
                const { style } = parsedSpecification;
                if (!Array.isArray(style) || !style.includes(EDITED_NODE_STYLE)) {
                    parsedSpecification.style = EditorManager.mergeStyles(style, EDITED_NODE_STYLE);
                }

                // Update all nodes of the type to match the new specification
                const oldType = node.value.type;
                // eslint-disable-next-line no-underscore-dangle
                const errors = editorManager._unregisterNodeType(oldType);
                if (errors.length) {
                    NotificationHandler.terminalLog('error', 'Error when registering the node', errors);
                    return;
                }

                const ret = editorManager.addNodeToEditorSpecification(
                    parsedSpecification,
                    oldType,
                );
                // Add type to editor and specification
                if (ret.errors !== undefined && ret.errors.length) {
                    throw new Error(ret.errors);
                }

                updateGraphsInEditor(oldType, parsedSpecification, editor);

                validateNodeStyle(parsedSpecification);
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

                currentSpecification.value = YAML.stringify(parsedSpecification);
                editorManager.modifiedNodeSpecificationRegistry[node.value.id] =
                    currentSpecification.value;

                NotificationHandler.showToast('info', 'Node validated');
                // refresh specification
                getSpecificationWithIncludes();
            } catch (error) {
                const messages = Array.isArray(error) ? error : [error];
                NotificationHandler.terminalLog('error', 'Validation failed', messages);
            }
            editorManager.clearHistory(() => {
                NotificationHandler.terminalLog('warning', 'Can\'t undo changes after modifying specification', 'History unavailable after changing specification');
            });
        };

        /**
         * Checks whether the node specification has been changed.
         *
         * @returns {boolean} `true` if the specification has been modified
         */
        const editorStateChanged = computed(() => {
            try {
                const parsedCurrentSpecification = YAML.parse(
                    currentSpecification.value.replaceAll('\t', '  '),
                );

                const edited = specification.value;
                const cur = parsedCurrentSpecification;
                const sortObj = (obj) => Object.fromEntries(Object.entries(obj).sort());
                return JSON.stringify(sortObj(edited)) !==
                    JSON.stringify(sortObj(cur));
            } catch {
                return false;
            }
        });

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
        const canApplyChanges = computed(() => {
            if (!editorStateChanged.value) {
                console.log('Editor state: ', editorStateChanged.value);
                return false;
            }
            try {
                const parsedSpecForValidation = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));
                validateNode(parsedSpecForValidation);
                validateNodeProperties(parsedSpecForValidation);
                validateNodeInterfaces(parsedSpecForValidation);

                return true;
            } catch (error) {
                return false;
            }
        });

        /**
         * Format an error message into an HTML element.
         *
         * @param {string|Error} error - The error object or message to format.
         * @returns {string} The formatted error message.
         */
        const formatError = (error) => {
            let errorMessage = (error && error.message) ? error.message : String(error);
            errorMessage = errorMessage.replace(/^\s*unresolved_specification\//, '');
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
            return errorMessage;
        };

        /**
         * Set up a debounced event listener to validate a specification.
         *
         * Removes any existing 'keyup' event listener for live validation,
         * then attaches a new listener that waits for the user to stop typing
         * for a specified duration (`validateAfterIdleFor`) before triggering
         * the validation status display (`updateCachedValidationResult`).
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
                typingTimer = setTimeout(updateCachedValidationResult, validateAfterIdleFor);
            };
            el.value.addEventListener('keyup', el.value.liveValidateListener);
        };

        // Editor height

        const handleInput = () => {
            if (!visible.value) { return; }
            const { scrollHandle } = props;
            let prevParentScrollHeight;
            if (props.scrollHandle) {
                prevParentScrollHeight = scrollHandle.scrollTop;
            }

            // Setting the height to 'auto' first allows the element
            // to shrink if the content has decreased.
            // Then, setting it to the scrollHeight of the element (in pixels)
            // resizes the element to fit its content exactly.
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
        delayedEditorUpdate();

        // We modify this value in the editor, so it's not exactly computed
        watch(specification, async () => {
            currentSpecification.value =
                editorManager.modifiedNodeSpecificationRegistry[node.value.id]
                ?? maybeStringify(specification.value);
        });

        const handleUIUpdate = () => {
            if (menuState.configurationMenu.addNode) return;
            if (node.value.type !== configurationState.nodeData.name) return;

            const newSpecification = editorManager.specification.unresolvedSpecification
                ?.nodes
                ?.find(nodeMatchesSpec);
            specification.value = newSpecification;
            currentSpecification.value = maybeStringify(newSpecification);
            editorManager.modifiedNodeSpecificationRegistry[node.value.id] =
                currentSpecification.value;
        };

        watch(menuState, () => nextTick().then(handleUIUpdate));

        onMounted(() => {
            nextTick(() => {
                handleInput();
                // Resize the YAML editor after DOM is loaded.
                setTimeout(() => {
                    handleInput();
                }, 10);
            });
        });

        onBeforeUnmount(() => {
            document.removeEventListener('click', updateCachedValidationResult);
        });

        editorEventBus.addEventListener('check-validation', (event) => {
            const { resolve } = event.detail;
            console.log('Bus event ', editorStateChanged.value);
            resolve(editorStateChanged.value);
        });

        const discard = async () => {
            currentSpecification.value = maybeStringify(specification.value);
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
            currentSpecification,
            specification,
            validate,
            updateSpecification,
            canApplyChanges,
            discard,
            editorStateChanged,
            visible,
            handleTab,
            formatError,
            cachedValidationResult,
        };
    },
});
</script>

<style scoped>
    __validation_errors {
        max-width: 100%;
    }
</style>
