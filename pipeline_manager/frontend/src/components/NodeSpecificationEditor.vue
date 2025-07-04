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
            <p class="__validation_errors">
                <template v-if=" cachedValidationResult.length > 0">
                    Problems:<br>
                    <span v-for="(err, idx) in cachedValidationResult" :key="idx">
                        <span style="color: var(--baklava-control-color-error);">
                            {{ formatError(err) }}
                        </span>
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
    computed, defineComponent, nextTick, ref, toRef, watch, onMounted, onBeforeUnmount,
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

            const duplicates = findDuplicates(parsedSpecification.interfaces, 'name');
            if (duplicates.length > 0) {
                throw new Error(`Conflicting interface names: ${duplicates.join(', ')}`);
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
         * - Validates each property object against a JSON schema.
         *
         * @param {Object} parsedSpecification - The parsed node specification object to validate.
         * @throws {Error} Raised if a validation failed.
         */
        const validateNodeProperties = (parsedSpecification) => {
            if (!parsedSpecification?.properties) {
                return;
            }

            const duplicates = findDuplicates(parsedSpecification.properties, 'name');
            if (duplicates.length > 0) {
                throw new Error(`Conflicting property names: ${duplicates.join(', ')}`);
            }

            // Validate against a JSON schema of a property.
            parsedSpecification.properties.forEach((prop) => {
                const validationErrors = editorManager.validateNodeProperty(prop);
                if (validationErrors.length) {
                    throw new Error(validationErrors);
                }
            });
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
            () =>
                specification.value && editorManager.baklavaView.settings.editableNodeTypes,
        );

        updateCachedValidationResult();

        const updateSpecification = async () => {
            try {
                const parsingErrors = validate();
                if (parsingErrors.length > 0) {
                    throw new Error(parsingErrors);
                }
                const parsedSpecification = YAML.parse(currentSpecification.value.replaceAll('\t', '  '));

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
                    return Array.isArray(errors) ? errors : [errors];
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
                NotificationHandler.terminalLog('error', 'Validation failed', messages);
            }
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
        const canApplyChanges = computed(() => {
            try {
                const parsedCurrentSpecification = YAML.parse(
                    currentSpecification.value.replaceAll('\t', '  '),
                );
                const differingSpecifications =
                    JSON.stringify(
                        specification.value,
                    ) !==
                    JSON.stringify(
                        parsedCurrentSpecification,
                    );

                if (!differingSpecifications) {
                    return false;
                }

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
            errorMessage = errorMessage.replace(/^unresolved_specification\//, '');
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

        watch(menuState, () => nextTick().then(handleUIUpdate));

        onMounted(() => {
            document.addEventListener('click', updateCachedValidationResult);
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
