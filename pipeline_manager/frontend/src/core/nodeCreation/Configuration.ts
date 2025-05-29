/*
 * Copyright (c) 2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { reactive } from 'vue';
import { v4 as uuidv4 } from 'uuid';

import { useViewModel } from '@baklavajs/renderer-vue';
import { NodeInterface } from '@baklavajs/core';
import EditorManager from '../EditorManager.js';
import { parseInterfaces } from '../interfaceParser.js';
import { removeNode } from '../../custom/CustomNode.js';
import {
    configurationState, NodeDataConfiguration, PropertyConfiguration, InterfaceConfiguration,
    menuState,
} from './ConfigurationState.ts';

import { createProperties, parseProperties, createBaklavaInterfaces } from '../NodeFactory.js';
import NotificationHandler from '../notifications.js';
import { suppressHistoryLogging } from '../History.ts';

type CreatedInterfaces = {
    [key: string]: () => NodeInterface
}

/**
 * This class is responsible for handling the configuration of custom nodes.
 * It allows to create, modify and to add properties and interfaces to the custom node.
 *
 * The current metadata of the custom node can be accessed in ConfigurationState.ts
 * and the current configuration can be accessed in the customNodeConfiguration reactive object.
*/
export class NodeConfiguration {
    private nodeData: NodeDataConfiguration = {
        name: 'Custom Node',
        category: 'Default category',
        layer: '',
        description: '',
    };

    private properties: PropertyConfiguration[] = [];

    private interfaces: InterfaceConfiguration[] = [];

    private customNodeInProgress = false;

    /**
     * The current node type that is being created.
     * If the custom node is not being created, it is undefined.
     * Otherwise, it is the name of the custom node.
    */
    private get currentNodeType() {
        return this.customNodeInProgress ? this.nodeData.name : undefined;
    }

    /**
     * Resets the configuration of the custom node.
     * Should be called when the custom node is created or when the user cancels the creation.
    */
    private resetConfiguration(): void {
        this.nodeData.name = 'Custom Node';
        this.nodeData.category = 'Default category';
        this.nodeData.layer = '';
        this.nodeData.description = '';
        this.properties = [];
        this.interfaces = [];
        this.customNodeInProgress = false;
    }

    /**
     * Creates a new node based on the current configuration.
     * It first validates the configuration and if it is correct, it adjusts the existing nodes
     * to the new configuration and creates a new node if `configurationMenu.addNode`
     * is set to true. If the configuration is incorrect, it logs an error.
     * @param newNodeData - the configuration of the new node
     * @returns string[] - an array of errors that occurred during node creation
    */
    public createNode(newNodeData: NodeDataConfiguration): string[] {
        const { viewModel } = useViewModel();
        const { editor } = viewModel.value;
        const { displayedGraph } = viewModel.value;
        const editorManager = EditorManager.getEditorManagerInstance();

        // Checking if there is there already exists newNodeData.name type and is different
        // than the current node that is being created
        if (
            editorManager.baklavaView.editor.nodeTypes.has(newNodeData.name) && (
                this.currentNodeType === undefined ||
                this.currentNodeType !== newNodeData.name
            )
        ) {
            return [`Node of type ${newNodeData.name} already exists. Pick other type`];
        }

        const errors = this.registerNewNodeConfiguration(newNodeData);
        if (errors.length) {
            NotificationHandler.terminalLog('error', 'Error when creating a node', errors);
            return errors;
        }
        this.nodeData = { ...newNodeData };
        configurationState.nodeData = { ...newNodeData };
        this.customNodeInProgress = true;
        return [];
    }

    /**
     * Registers the configuration of the custom node type.
     * If a node type was already registered, it unregisters it first.
     * @param newNodeData? - the configuration of the new node
     * @returns string[] - an array of errors that occurred during the registration
    */
    private registerNewNodeConfiguration(newNodeData?: NodeDataConfiguration): string[] {
        if (newNodeData === undefined) {
            newNodeData = this.nodeData; // eslint-disable-line no-param-reassign
        }

        const editorManager = EditorManager.getEditorManagerInstance();

        // If there was a node registered, unregister it
        if (
            this.currentNodeType !== undefined &&
            editorManager.baklavaView.editor.nodeTypes.has(this.currentNodeType)
        ) {
            // eslint-disable-next-line no-underscore-dangle
            const errors = editorManager._unregisterNodeType(this.currentNodeType);
            if (errors.length) return errors;
        }

        // eslint-disable-next-line no-underscore-dangle
        const errors = editorManager._registerNodeType({
            name: newNodeData.name,
            layer: newNodeData.layer,
            category: newNodeData.category,
            description: newNodeData.description,
            properties: this.properties,
            interfaces: this.interfaces,
        });
        if (errors.length) return errors;
        return [];
    }

    /**
     * Modifies the configuration of the custom node.
     * It first validates the configuration and if it is correct, it adjusts the existing nodes
     * to the new configuration. If the configuration is incorrect, it logs an error.
     * @param newNodeData - the configuration of the new node
     * @returns string[] - an array of errors that occurred during the modification
    */
    public modifyConfiguration(newNodeData: NodeDataConfiguration): string[] {
        suppressHistoryLogging(true);

        const { viewModel } = useViewModel();
        const { editor } = viewModel.value;
        const { displayedGraph } = viewModel.value;
        const editorManager = EditorManager.getEditorManagerInstance();

        // If there was a node registered, unregister it
        const errors = this.registerNewNodeConfiguration(newNodeData);
        if (errors.length) return errors;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodes: any[] = displayedGraph.nodes.filter(
            (n) => n.type === this.currentNodeType,
        );

        // Changing existing nodes' types
        /* eslint-disable no-param-reassign */
        nodes.forEach((node) => {
            node.title = newNodeData.name;
            node.type = newNodeData.name;
            node.layer = newNodeData.layer;
            node.category = newNodeData.category;
            node.description = newNodeData.description;
            delete node.instanceName;
        });
        /* eslint-enable no-param-reassign */

        this.nodeData = { ...newNodeData };
        configurationState.nodeData = { ...newNodeData };
        this.customNodeInProgress = true;

        suppressHistoryLogging(false);
        return [];
    }

    /**
     * Adds property to the custom node. If the property is invalid, it logs an error.
     * @param property - the property to be added
     * @returns void
    */
    public addProperty(property: PropertyConfiguration): void {
        const { viewModel } = useViewModel();
        const { displayedGraph } = viewModel.value;

        const editorManager = EditorManager.getEditorManagerInstance();
        const error = editorManager.validateNodeProperty(property);

        if (error.length) {
            NotificationHandler.terminalLog('error', 'Invalid property', error);
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodes: any[] = displayedGraph.nodes.filter((n) => n.type === this.currentNodeType);
        if (nodes === undefined) {
            NotificationHandler.terminalLog(
                'error',
                'Node not found',
                `Node of type ${this.currentNodeType} not found`,
            );
            return;
        }

        this.properties.push(property);
        const parsedProperties = parseProperties(this.properties);
        if (Array.isArray(parsedProperties) && parsedProperties.length) {
            this.properties.pop();
            NotificationHandler.terminalLog('error', 'Invalid properties', parsedProperties);
            return;
        }
        this.registerNewNodeConfiguration();

        const createdProperties = (createProperties(parsedProperties) as CreatedInterfaces);
        nodes.forEach((node) => {
            const state = node.save();

            Object.keys(createdProperties).forEach((k) => {
                const input = createdProperties[k]();
                node.addInput(k, input);
                // Because `this` is not reactive in node functions, we need
                // to notice the reactive `node` reference inputs were updated
                node.inputs = node.inputs; // eslint-disable-line no-self-assign, no-param-reassign
            });

            node.load(state);
        });
    }

    /**
     * Adds interface to the custom node. If the interface is invalid, it logs an error.
     * @param intf - the interface to be added
     * @returns void
    */
    public addInterface(intf: InterfaceConfiguration): void {
        const { viewModel } = useViewModel();
        const { displayedGraph } = viewModel.value;

        const editorManager = EditorManager.getEditorManagerInstance();
        const error = editorManager.validateNodeInterface(intf);

        if (error.length) {
            NotificationHandler.terminalLog('error', 'Invalid interface', error);
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodes: any[] = displayedGraph.nodes.filter((n) => n.type === this.currentNodeType);
        if (nodes === undefined) {
            NotificationHandler.terminalLog(
                'error',
                'Node not found',
                `Node of type ${this.currentNodeType} not found`,
            );
            return;
        }

        this.interfaces.push(intf);
        const parsedInterfaces = parseInterfaces(this.interfaces, [], []);
        if (Array.isArray(parsedInterfaces) && parsedInterfaces.length) {
            this.interfaces.pop();
            NotificationHandler.terminalLog('error', 'Invalid interfaces', parsedInterfaces);
            return;
        }
        this.registerNewNodeConfiguration();

        const [inputs, outputs] =
            createBaklavaInterfaces(parsedInterfaces) as [CreatedInterfaces, CreatedInterfaces];

        nodes.forEach((node) => {
            const state = node.save();

            Object.keys(inputs).forEach((k) => {
                const input = inputs[k]();
                node.addInput(k, input);
                // Because `this` is not reactive in node functions, we need
                // to notice the reactive `node` reference inputs were updated
                node.inputs = node.inputs; // eslint-disable-line no-self-assign, no-param-reassign
            });
            Object.keys(outputs).forEach((k) => {
                const output = outputs[k]();
                node.addOutput(k, output);
                // Because `this` is not reactive in node functions, we need
                // to notice the reactive `node` reference outputs were updated
                node.outputs = node.outputs; // eslint-disable-line no-self-assign, no-param-reassign, max-len
            });

            node.load(state);
        });
    }

    /**
     * Finalizes the creation of the custom node. After the node is added to the specification
     * and the configuration is reset.
    */
    public register() {
        suppressHistoryLogging(true);
        const editorManager = EditorManager.getEditorManagerInstance();

        // eslint-disable-next-line no-underscore-dangle
        const errors = editorManager._unregisterNodeType(this.currentNodeType);
        if (errors.length) {
            NotificationHandler.terminalLog('error', 'Error when registering the node', errors);
            return;
        }

        const ret = editorManager.addNodeToEditorSpecification({
            name: this.nodeData.name,
            layer: this.nodeData.layer,
            category: this.nodeData.category,
            interfaces: this.interfaces,
            properties: this.properties,
        });

        if (ret.errors !== undefined && ret.errors.length) {
            NotificationHandler.terminalLog('error', 'Error when registering the node', ret.errors);
            return;
        }

        this.resetConfiguration();
        suppressHistoryLogging(false);
    }
}

/**
 * The reactive object that holds the current configuration of the custom node.
 * It is used to update the configuration using callbacks.
*/
export const customNodeConfiguration = reactive(new NodeConfiguration());
