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
    computed, defineComponent, nextTick, ref, toRef, watch, onMounted,
} from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';
import EditorManager, { EDITED_NODE_STYLE } from '../core/EditorManager';
import NotificationHandler from '../core/notifications';
import { menuState, configurationState, editorEventBus } from '../core/nodeCreation/ConfigurationState.ts';
import {
    alterInterfaces, alterProperties, updateExtendedProperties, updateExtendedInterfaces, findNodes,
} from '../core/nodeCreation/Configuration.ts';

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
        watch(
            editorManager.specification.unresolvedSpecification,
            () => {
                const unresolved = editorManager.specification.unresolvedSpecification;
                const included = editorManager.specification.includedSpecification;
                const specification = JSON.parse(JSON.stringify(unresolved));

                EditorManager.mergeObjects(specification, included);
                specificationWithIncludes.value = specification;
            },
            { immediate: true },
        );

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

            const duplicates = findDuplicates(parsedSpecification.interfaces, 'name');
            if (duplicates.length > 0) {
                throw new Error(`Conflicting interface names: ${duplicates.join(', ')}`);
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

            const duplicates = findDuplicates(parsedSpecification.properties, 'name');
            if (duplicates.length > 0) {
                throw new Error(`Conflicting property names: ${duplicates.join(', ')}`);
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
         * Get the whole updated list of nodes influenced by specification.
         * @param {Object} parsedSpecification - The node specification object to validate.
         * @returns {Array} List of nodes that have been changed by the specification.
         */
        const getUpdatedNodes = (parsedSpecification) => {
            const oldType = node.value.type;
            const nodes = findNodes(oldType);

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
            return nodes;
        };
        /**
         * Get complete specification of a node type.
         *
         * @param {string} type - The type of node for which to fetch specification.
         * @returns {Object} Complete specification of provided type.
         */
        const getCurrentSpecification = (type) => {
            let spec = editorManager.specification.currentSpecification
                .nodes?.find((n) => EditorManager.getNodeName(n) === type);

            if (spec === undefined) {
                spec = editorManager.specification.currentSpecification
                    .nodes?.find(nodeMatchesSpec);
            }
            if (spec === undefined) {
                spec = editorManager.specification.unresolvedSpecification
                    .nodes?.find(nodeMatchesSpec);
            }
            if (spec === undefined) {
                spec = editorManager.specification.unresolvedSpecification
                    .nodes?.find((n) => EditorManager.getNodeName(n) === type);
            }
            return spec;
        };
        /**
         * Process parsed and old parsed information to deduce what interfaces and properties
         * have been removed.
         *
         * @param {Array} parsedProperties - list of current properties.
         * @param {Array} oldProperties - list of old properties.
         * @param {Array} parsedInterfaces - list of current interfaces.
         * @param {Array} oldInterfaces - list of old interfaces.
         * @returns {Array} An array of interfaces and properties that have been removed.
         */
        const getOmitted = (parsedProperties, oldProperties, parsedInterfaces, oldInterfaces) => {
            const removedProperties = [...oldProperties.filter(
                (prop) => !parsedProperties.some((p) => p.name === prop.name
                    && p.override === prop.override
                    && p.type === prop.type,
                ),
            )/* , ...overriddenProperties */] ?? [];
            const removedInterfaces = [...oldInterfaces.filter(
                (intf) => !parsedInterfaces.some((i) => i.name === intf.name
                        && i.array === intf.array
                        && i.type === intf.type
                        && i.override === intf.override
                        && i.direction === intf.direction),
            )/* , ...overriddenInterfaces */] ?? [];
            return [removedProperties, removedInterfaces];
        };
        /**
         * Process what interfaces or properties are no longer blocked and can now be inherited.
         *
         * @param {Array} inheritedProps - list of all inherited properties.
         * @param {Array} removedProps - list of removed properties.
         * @param {Array} inheritedIntfs - list of all inherited interfaces.
         * @param {Array} removedIntfs - list of removed interfaces.
         * @returns {Array} An array of interfaces that once overridden can now be inherited.
         */
        const getReInherited = (inheritedProps, removedProps, inheritedIntfs, removedIntfs) =>
            ([
                inheritedProps.filter((prop) =>
                    removedProps.some((rp) => rp.name === prop.name && rp.override),
                ).map((prop) => ({ ...prop, inherited: true })),
                inheritedIntfs.filter((intf) =>
                    removedIntfs.some((ri) => ri.name === intf.name && ri.override))
                    .map((intf) => ({ ...intf, inherited: true })),
            ]);

        /**
         * Returns a set of interfaces that have been edited and are external interfaces.
         * They are identified by matching the removed interface names with added interface names.
         * This processing requires for the removed interfaces to still be present in the node.
         *
         * @param {Object} curNode - the node that is being processed.
         * @param {Array} removedIntf - list of interfaces that will be removed.
         * @param {Array} removedProp - list of properties that will be removed.
         * @param {Array} addedIntf - list of added interfaces.
         * @param {Array} addedProp - list of added interfaces.
         * @returns {Array} An array containing the names and external names of interfaces edited.
         */
        const getEditedExternal = (curNode, addedProp, removedProp, addedIntf, removedIntf) => {
            const nodeIntfs = [...Object.values(curNode.inputs), ...Object.values(curNode.outputs)];
            return nodeIntfs.filter(
                (intf) => intf.externalName && (
                    (
                        intf.port
                        && removedIntf.find((ii) => ii.name === intf.name)
                        && addedIntf.find((ii) => ii.name === intf.name)
                    ) || (
                        !intf.port
                        && removedProp.find((ii) => ii.name === intf.name)
                        && addedProp.find((ii) => ii.name === intf.name))
                ),
            ).map((i) => ({ name: i.name, externalName: i.externalName, port: i.port }));
        };
        /**
         * Parses all nodes to find interfaces that are exposed and will have been removed.
         * @param {Array} removedInterfaces - list of interfaces that will be removed.
         * @returns {Array} An array of pairs - interface, graphID - of interfaces
            that were once exposed but will be removed.
         */
        const getAllExposedIntfsData = (nodes, removedInterfaces) =>
            nodes.flatMap((n) => [...Object.values(n.inputs), ...Object.values(n.outputs)]
                .map((inf) => ([
                    inf,
                    n.graphInstance?.id,
                ])))
                .filter(([inf, _graphId]) =>
                    inf?.externalName && removedInterfaces.some((i) => i.name === inf.name),
                );
        /**
         * Parses all connections in a graph and removes any connections that are invalid.
         * @param {Object} graph - a graph that will be processed.
         */
        const removeDanglingConnections = (graph) => {
            let connectionsToRemove = [];

            const graphNodes = graph.nodes;

            const graphInterfaces = graphNodes.flatMap((n) =>
                [...Object.values(n.inputs), ...Object.values(n.outputs)]);

            connectionsToRemove = graph.connections.filter((conn) => {
                const infTo = graphInterfaces.some((inf) => inf.id === conn.to.id);
                const infFrom = graphInterfaces.some((inf) => inf.id === conn.from.id);
                return !infTo || !infFrom;
            });

            connectionsToRemove.forEach((conn) => {
                graph.removeConnection(conn);
            });
        };
        /**
         * Based on edited type and specification will propagate all changes through the editor.
         * @param {string} type - type of node that was edited.
         * @param {Object} parsedSpecification - a graph that will be processed.
         * @param {Object} editor - opened editor in which the changes will be applied.
         */
        const propagateChangesInEditor = (type, parsedSpecification, editor) => {
            const oldSpecification = getCurrentSpecification(type);
            // Remove deleted interfaces and properties
            // An interface was deleted if it's present in old resolved specification
            // but not in the editor and is also not inherited.
            const oldProperties = oldSpecification.properties ?? [];
            const oldInterfaces = oldSpecification.interfaces ?? [];

            // Deep copy properties from specification before altering nodes
            const parsedProperties = [...structuredClone(parsedSpecification.properties ?? [])];
            const parsedInterfaces = [...structuredClone(parsedSpecification.interfaces ?? [])];

            const inheritedProperties = editorManager.findInheritedProperties(type);
            const inheritedInterfaces = editorManager.findInheritedInterfaces(type);

            const newProperties = parsedProperties.filter(
                (prop) => !oldProperties.some((p) => p.name === prop.name),
            ) ?? [];
            const newInterfaces = parsedInterfaces.filter(
                (intf) => !oldInterfaces.some((i) => i.name === intf.name),
            ) ?? [];

            // properties that were inherited before but are now inherited
            const overriddenProperties = inheritedProperties.filter((p) =>
                newProperties.some((pp) => p.name === pp.name && pp.override));
            const overriddenInterfaces = inheritedInterfaces.filter((intf) =>
                newInterfaces.some((pintf) => intf.name === pintf.name && pintf.override));

            const [deletedProperties, deletedInterfaces] =
                getOmitted(parsedProperties, oldProperties, parsedInterfaces, oldInterfaces);

            // truly removed are the ones removed from YAML and the overrides
            const removedProperties = [...deletedProperties, ...overriddenProperties];
            const removedInterfaces = [...deletedInterfaces, ...overriddenInterfaces];

            const [readdedProperties, readdedInterfaces] =
            // eslint-disable-next-line max-len
                getReInherited(inheritedProperties, removedProperties, inheritedInterfaces, removedInterfaces);
            // add new properties and properties from parent that are no longer overridden
            const addedProperties = [...newProperties, ...readdedProperties] ?? [];
            const addedInterfaces = [...newInterfaces, ...readdedInterfaces] ?? [];

            const nodes = getUpdatedNodes(parsedSpecification);
            const childNodes = findNodes(type, true) ?? [];

            const allParsedNodes = [...Object.values(nodes), ...Object.values(childNodes)];

            // get all exposed interfaces to privatize
            const exposedInterfaces = getAllExposedIntfsData(allParsedNodes, removedInterfaces);

            allParsedNodes.forEach((n) => {
                // This is needed because some of the addedProperties/Interfaces might have
                // been added as a result of removing 'override' flag or adding it.
                const allProp = [...addedProperties, ...parsedProperties.filter((pp) =>
                    !addedProperties.some((i) => i.name === pp.name))];
                const allIntf = [...addedInterfaces, ...parsedInterfaces.filter((pi) =>
                    !addedInterfaces.some((p) => p.name === pi.name))];
                // eslint-disable-next-line max-len
                const toReExpose = getEditedExternal(n, allProp, removedProperties, allIntf, removedInterfaces);
                alterProperties([n], removedProperties, true);
                alterInterfaces([n], removedInterfaces, true);
                alterProperties([n], allProp);
                alterInterfaces([n], allIntf);

                [...Object.values(n.inputs), ...Object.values(n.outputs)].forEach((intf) => {
                    const eintf = toReExpose.find((i) => i.name === intf.name);
                    if (eintf && eintf.port === intf.port) {
                        editor.exposeInterface(n.graphInstance.id, intf, eintf.externalName);
                    }
                });
            });
            updateExtendedProperties(type, addedProperties, removedProperties);
            updateExtendedInterfaces(type, addedInterfaces, removedInterfaces);
            // if in subgraph, refresh subgraph
            allParsedNodes.map((n) => n.graphInstance.graphNode).filter((g) => g)
                .forEach((g) => {
                    g.updateExposedInterfaces(undefined, undefined, true);
                });

            // updates exposed interfaces in graph nodes
            exposedInterfaces.filter(([_inf, graphId]) => graphId)
                .forEach(([inf, graphId]) => {
                    editor.privatizeInterface(graphId, inf);
                });
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
                const checkSubgraphExtends = (nodeName) => {
                    const nodeSpec = getCurrentSpecification(nodeName);
                    if (nodeSpec.subgraphId) {
                        return true;
                    }
                    return Object.values(nodeSpec.extends || {}).some((parent) =>
                        checkSubgraphExtends(parent),
                    );
                };
                if (Object.values(parsedSpecification.extends || {}).some(checkSubgraphExtends)) {
                    throw new Error('Extending subgraphs dynamically is not currently supported.');
                }
                const oldType = node.value.type;
                const oldSpec = getCurrentSpecification(oldType);

                if ((oldSpec.extending?.length || node.value.extending?.length)
                    && oldSpec.subgraphId) {
                    throw new Error('Extending subgraphs dynamically is not currently supported.');
                }
                // Update style of edited node type
                const { style } = parsedSpecification;
                if (!Array.isArray(style) || !style.includes(EDITED_NODE_STYLE)) {
                    parsedSpecification.style = EditorManager.mergeStyles(style, EDITED_NODE_STYLE);
                }

                // Update all nodes of the type to match the new specification
                propagateChangesInEditor(oldType, parsedSpecification, editor);

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
                // refresh graphs connections
                const graphs = Array.from(editor.graphs);
                graphs.forEach((graph) => {
                    removeDanglingConnections(graph);
                });
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
            const parsedCurrentSpecification = YAML.parse(
                currentSpecification.value.replaceAll('\t', '  '),
            );
            return JSON.stringify(specification.value) !==
                JSON.stringify(parsedCurrentSpecification);
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
