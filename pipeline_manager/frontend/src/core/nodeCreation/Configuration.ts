/*
 * Copyright (c) 2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Methods responsible for handling the configuration of custom nodes.
 * It allows to create, modify and to add properties and interfaces to the custom node.
 *
 * The current metadata of the custom node can be accessed in ConfigurationState.ts
 * and the current configuration can be accessed in the configurationState reactive object.
*/

import { useViewModel } from '@baklavajs/renderer-vue';
import { NodeInterface } from '@baklavajs/core';
import EditorManager, { NEW_NODE_STYLE, EDITED_NODE_STYLE } from '../EditorManager.js';
import { parseInterfaces } from '../interfaceParser.js';
import {
    configurationState, PropertyConfiguration, InterfaceConfiguration,
} from './ConfigurationState.ts';

import {
    createProperties, parseProperties, createBaklavaInterfaces, GraphFactory,
} from '../NodeFactory.js';
import NotificationHandler from '../notifications.js';
import { suppressHistoryLogging } from '../History.ts';

type CreatedInterfaces = {
    [key: string]: () => NodeInterface
}

/**
  * Updates editor specification for the edited node type.
*/
function commitTypeToSpecification() {
    suppressHistoryLogging(true);
    const editorManager = EditorManager.getEditorManagerInstance();

    const newNodeData = configurationState.nodeData;
    const currentType = configurationState.editedType;
    let style = NEW_NODE_STYLE;

    if (currentType !== undefined) {
        // eslint-disable-next-line no-underscore-dangle
        const errors = editorManager._unregisterNodeType(currentType);
        if (errors.length) {
            NotificationHandler.terminalLog('error', 'Error when registering the node', errors);
            return;
        }
        style = EDITED_NODE_STYLE;
    }

    const ret = editorManager.addNodeToEditorSpecification({
        name: newNodeData.name,
        layer: newNodeData.layer,
        category: newNodeData.category,
        color: newNodeData.color,
        description: newNodeData.description,
        interfaces: configurationState.interfaces,
        properties: configurationState.properties,
        style,
    }, currentType, false);

    if (ret.errors !== undefined && ret.errors.length) {
        NotificationHandler.terminalLog('error', 'Error when registering the node', ret.errors);
        return;
    }

    suppressHistoryLogging(false);
}

/**
  * Finds all nodes of a given type in all editor graphs.
  * @param nodeType - type of the node to find
  * @param extending - find extending nodes
  * @returns any[] - an array of nodes
*/
export function findNodes(nodeType: string, extending = false): any[] {
    const { viewModel } = useViewModel();
    const { editor } = viewModel.value;

    const allNodes = Array.from(editor.graphs).map((graph: any) => graph.nodes).flat();

    if (extending) return allNodes.filter((n: any) => n.extends?.includes(nodeType));
    return allNodes.filter((n: any) => n.type === nodeType);
}

/**
  * Creates a new node based on the current configuration.
  * It first validates the configuration and if it is correct, it adjusts the existing nodes
  * to the new configuration and creates a new node if `configurationMenu.addNode`
  * is set to true. If the configuration is incorrect, it logs an error.
  * @returns string[] - an array of errors that occurred during node creation
*/
export function createNode(): string[] {
    const editorManager = EditorManager.getEditorManagerInstance();

    const newNodeData = configurationState.nodeData;
    const currentType = configurationState.editedType;

    // Checking if there is there already exists newNodeData.name type and is different
    // than the current node that is being created
    if (
        editorManager.baklavaView.editor.nodeTypes.has(newNodeData.name) && (
            currentType === undefined ||
            currentType !== newNodeData.name
        )
    ) {
        const errors = [`Node of type ${newNodeData.name} already exists. Please pick another type`];
        NotificationHandler.terminalLog('error', 'Error when creating a node', errors);
        return errors;
    }

    commitTypeToSpecification();
    editorManager.editor.additionalNodeTypes.add(newNodeData.name);
    return [];
}

/**
  * Modifies the configuration of the custom node.
  * It first validates the configuration and if it is correct, it adjusts the existing nodes
  * to the new configuration. If the configuration is incorrect, it logs an error.
  * @returns string[] - an array of errors that occurred during the modification
*/
export function modifyConfiguration(): string[] {
    suppressHistoryLogging(true);

    const newNodeData = configurationState.nodeData;
    const currentType = configurationState.editedType;

    const nodes = findNodes(currentType!);
    /* eslint-disable no-param-reassign */
    nodes.forEach((node) => {
        if (node.type === node.title) {
            node.title = newNodeData.name;
        } else {
            node.highlightedType = newNodeData.name;
        }
        node.type = newNodeData.name;
        node.layer = newNodeData.layer;
        node.category = newNodeData.category;
        node.color = newNodeData.color;
        node.description = newNodeData.description;
    });
    /* eslint-enable no-param-reassign */

    commitTypeToSpecification();
    suppressHistoryLogging(false);
    return [];
}

/**
  * Adds or removes node properties.
  * @param nodes - list of nodes
  * @param properties - list of properties
  * @param remove - whether properties should be removed
  * @returns void
*/
export function alterProperties(
    nodes: any[],
    properties: PropertyConfiguration[],
    remove = false,
): any[] {
    if (properties === undefined) return [];

    const parsedProperties = parseProperties(properties);
    // If parsedProperties returns an array, it is an array of errors
    if (Array.isArray(parsedProperties) && parsedProperties.length) {
        return parsedProperties;
    }
    const createdProperties = (createProperties(parsedProperties) as CreatedInterfaces);
    nodes.forEach((node) => {
        const state = node.save();

        Object.keys(createdProperties).forEach((k) => {
            const input = createdProperties[k]();
            if (remove) {
                node.removeInput(k, input);
            } else {
                node.addInput(k, input);
            }
            // Because `this` is not reactive in node functions, we need
            // to notice the reactive `node` reference inputs were updated
            node.inputs = node.inputs; // eslint-disable-line no-self-assign, no-param-reassign
        });

        node.load(state);
    });
    return [];
}

/**
  * Adds or removes node interfaces.
  * @param nodes - list of nodes
  * @param interfaces - list of interfaces
  * @param remove - whether interfaces should be removed
  * @returns void
*/
export function alterInterfaces(
    nodes: any[],
    interfaces: InterfaceConfiguration[],
    remove = false,
): any[] {
    if (interfaces === undefined) return [];

    const parsedInterfaces = parseInterfaces(interfaces, [], []);
    // If parsedInterfaces returns an array, it is an array of errors
    if (Array.isArray(parsedInterfaces) && parsedInterfaces.length) {
        return parsedInterfaces;
    }
    const [inputs, outputs] =
        createBaklavaInterfaces(parsedInterfaces) as [CreatedInterfaces, CreatedInterfaces];

    nodes.forEach((node) => {
        const state = node.save();

        Object.keys(inputs).forEach((k) => {
            const input = inputs[k]();
            if (remove) {
                node.removeInput(k, input);
            } else {
                node.addInput(k, input);
            }
            node.inputs = node.inputs; // eslint-disable-line no-self-assign, no-param-reassign
        });
        Object.keys(outputs).forEach((k) => {
            const output = outputs[k]();
            if (remove) {
                node.removeOutput(k, output);
            } else {
                node.addOutput(k, output);
            }
            node.outputs = node.outputs; // eslint-disable-line no-self-assign, no-param-reassign, max-len
        });

        node.load(state);
    });
    return [];
}

/**
  * Adds property to the custom node. If the property is invalid, it logs an error.
  * @param property - the property to be added
  * @returns void
*/
export function addProperty(property: PropertyConfiguration): void {
    const currentType = configurationState.editedType;
    const editorManager = EditorManager.getEditorManagerInstance();
    let error = editorManager.validateNodeProperty(property);

    if (error.length) {
        NotificationHandler.terminalLog('error', 'Invalid property', error);
        return;
    }

    const nodes = findNodes(currentType!);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (nodes === undefined) {
        NotificationHandler.terminalLog(
            'error',
            'Node not found',
            `Node of type ${currentType} not found`,
        );
        return;
    }

    configurationState.properties.push(property);
    error = alterProperties(nodes, configurationState.properties);

    if (error.length) {
        NotificationHandler.terminalLog('error', 'Invalid property', error);
        return;
    }

    const resolvedChildNodes = editorManager.specification.currentSpecification.nodes
        .filter((n: any) => n.extends?.includes(currentType)) ?? [];

    resolvedChildNodes.forEach((n: any) => {
        // eslint-disable-next-line no-param-reassign
        n.properties = [...(n.properties ?? []), ...[property]];
        const childNodes = findNodes(n.name!);
        alterProperties(childNodes, [property]);
    });

    commitTypeToSpecification();
}

/**
  * Removes properties from the custom node.
  * @param properties - the properties to be removed
  * @returns void
*/
export function removeProperties(properties: PropertyConfiguration[]): void {
    const currentType = configurationState.editedType;
    const editorManager = EditorManager.getEditorManagerInstance();

    const nodes = findNodes(currentType!);
    if (nodes === undefined) {
        NotificationHandler.terminalLog(
            'error',
            'Node not found',
            `Node of type ${currentType} not found`,
        );
        return;
    }

    configurationState.properties = configurationState.properties.filter(
        (item) => !properties.includes(item),
    );
    alterProperties(nodes, properties, true);

    const resolvedChildNodes = editorManager.specification.currentSpecification.nodes
        .filter((n: any) => n.extends?.includes(currentType)) ?? [];

    resolvedChildNodes.forEach((n: any) => {
        // eslint-disable-next-line no-param-reassign
        n.properties = n.properties?.filter(
            (prop: PropertyConfiguration) => !properties.some((p) => p.name === prop.name),
        ) ?? [];
        const childNodes = findNodes(n.name!);
        alterProperties(childNodes, properties, true);
    });

    commitTypeToSpecification();
}

/**
  * Adds interface to the custom node. If the interface is invalid, it logs an error.
  * @param intf - the interface to be added
  * @returns void
*/
export function addInterface(intf: InterfaceConfiguration): void {
    const currentType = configurationState.editedType;
    const editorManager = EditorManager.getEditorManagerInstance();
    let error = editorManager.validateNodeInterface(intf);

    if (error.length) {
        NotificationHandler.terminalLog('error', 'Invalid interface', error);
        return;
    }

    const nodes = findNodes(currentType!);
    if (nodes === undefined) {
        NotificationHandler.terminalLog(
            'error',
            'Node not found',
            `Node of type ${currentType} not found`,
        );
        return;
    }

    configurationState.interfaces.push(intf);
    error = alterInterfaces(nodes, configurationState.interfaces);

    if (error.length) {
        NotificationHandler.terminalLog('error', 'Invalid interface', error);
        return;
    }

    const resolvedChildNodes = editorManager.specification.currentSpecification.nodes
        .filter((n: any) => n.extends?.includes(currentType)) ?? [];

    resolvedChildNodes.forEach((n: any) => {
        // eslint-disable-next-line no-param-reassign
        n.interfaces = [...(n.interfaces ?? []), ...[intf]];
        const childNodes = findNodes(n.name!);
        alterInterfaces(childNodes, [intf]);
    });

    commitTypeToSpecification();
}

/**
  * Removes interfaces from the custom node.
  * @param interfaces - the interfaces to be removed
  * @returns void
*/
export function removeInterfaces(interfaces: InterfaceConfiguration[]): void {
    const currentType = configurationState.editedType;
    const editorManager = EditorManager.getEditorManagerInstance();

    const nodes = findNodes(currentType!);
    if (nodes === undefined) {
        NotificationHandler.terminalLog(
            'error',
            'Node not found',
            `Node of type ${currentType} not found`,
        );
        return;
    }

    // Remove interfaces from graphs in the editor
    configurationState.interfaces = configurationState.interfaces.filter(
        (item) => !interfaces.includes(item),
    );
    alterInterfaces(nodes, interfaces, true);

    const resolvedChildNodes = editorManager.specification.currentSpecification.nodes
        .filter((n: any) => n.extends?.includes(currentType)) ?? [];

    resolvedChildNodes.forEach((n: any) => {
        // eslint-disable-next-line no-param-reassign
        n.interfaces = n.interfaces?.filter(
            (intf: InterfaceConfiguration) => !interfaces.some((i) => i.name === intf.name),
        ) ?? [];
        const childNodes = findNodes(n.name!);
        alterInterfaces(childNodes, interfaces, true);
    });

    // Remove interfaces from uninitialized graphs
    function removeFromSubgraph(graph: any, nodesToUpdate: any[], names: string[]): string[] {
        const externalNames: string[] = [];
        nodesToUpdate.forEach((node: any) => {
            const interfacesToRemove = node.interfaces
                .filter((intf: any) => names.includes(intf.name));
            const ids = interfacesToRemove.map((intf: any) => intf.id);

            // eslint-disable-next-line no-param-reassign
            graph.connections = graph.connections
                .filter((conn: any) => !ids.includes(conn.from) && !ids.includes(conn.to));
            // eslint-disable-next-line no-param-reassign
            node.interfaces = node.interfaces.filter((intf: any) => !ids.includes(intf.id));

            externalNames.push(...interfacesToRemove
                .map((intf: any) => intf.externalName)
                .filter((name: string | undefined) => name),
            );
        });
        return externalNames;
    }

    const names = interfaces.map((intf: InterfaceConfiguration) => intf.name);
    [
        ...editorManager.specification.unresolvedSpecification.graphs ?? [],
        ...editorManager.specification.currentSpecification.graphs ?? [],
    ].forEach((graph: any) => {
        const nodesToUpdate = graph.nodes.filter((n: any) => n.name === currentType);
        let externalNames = removeFromSubgraph(graph, nodesToUpdate, names);

        while (externalNames.length > 0) {
            const newExternalNames = removeFromSubgraph(graph, graph.nodes, externalNames);
            externalNames = newExternalNames;
        }
    });

    [
        ...editorManager.specification.unresolvedSpecification.nodes ?? [],
        ...editorManager.specification.currentSpecification.nodes ?? [],
    ].forEach((node: any) => {
        editorManager.refreshSubgraph(node);
    });

    commitTypeToSpecification();
}
