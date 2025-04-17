/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import { NodeInterface, Graph } from '@baklavajs/core';
import { v4 as uuidv4 } from 'uuid';
import { parseInterfaces } from '../core/interfaceParser.js';
import { updateSubgraphInterfaces, CustomNode } from '../core/NodeFactory.js';
import { ir } from '../core/interfaceRegistry.ts';

export default function CreateCustomGraphNodeType(template, graphNode) {
    return class CustomGraphNodeType extends CustomNode {
        type = graphNode.name;

        title = graphNode.name;

        template = template;

        inputs = {};

        outputs = {};

        properties = graphNode.properties ?? [];

        constructor() {
            super(
                graphNode.name,
                graphNode.layer,
                graphNode.inputs ?? [],
                graphNode.outputs ?? [],
                false,
                graphNode.description ?? '',
                graphNode.extends ?? [],
                graphNode.extending ?? [],
                graphNode.siblings ?? [],
                graphNode.width ?? 300,
            );
        }

        save() {
            const state = super.save();

            const newInterfaces = [];
            const thisInterfaces = Object.values(this.inputs).concat(Object.values(this.outputs));
            thisInterfaces.forEach((io) => {
                newInterfaces.push({
                    name: io.name,
                    externalName: io.externalName,
                    id: io.id,
                    direction: io.direction,
                    side: io.side,
                    sidePosition: io.sidePosition,
                });
            });

            state.interfaces = newInterfaces;
            delete state.inputs;
            delete state.outputs;

            state.name = state.type;
            delete state.type;

            state.instanceName = state.title === '' ? undefined : state.title;
            delete state.title;

            return state;
        }

        /* eslint-disable no-param-reassign */
        load(state) {
            this.hooks.beforeLoad.execute(state);

            const out = parseInterfaces(state.interfaces ?? [], [], []);
            if (Array.isArray(out) && out.length) {
                return out;
            }
            let { inputs, outputs } = out;

            inputs = Object.values(inputs);
            outputs = Object.values(outputs);

            delete state.graphState.interfaces;
            delete state.subgraph;

            // Loading the subgraph of the graph node first, before creating
            // interfaces based on the nodes in the subgraph. Thanks to that
            // the originally exposed interfaces (coming from regular nodes)
            // are found first.
            const errors = this.subgraph.load(state.graphState);
            if (errors.length) {
                return errors;
            }

            this.updateExposedInterfaces(inputs, outputs);

            if (!this.subgraph) {
                errors.push('Cannot load a graph node without a graph');
            }
            if (!this.template) {
                errors.push('Unable to load graph node without graph template');
            }
            if (errors.length) {
                return errors;
            }

            // Default position should be undefined instead of (0, 0) so that it can be set
            // by autolayout
            this.position = state.position;
            this.title = state.instanceName ?? '';

            this.events.loaded.emit(this);
            return [];
        }

        /**
         * Function used to update exposed interfaces of the graph node based on the
         * nodes inside the graph, their interfaces and their external names.
         *
         * @param {Array} inputs inputs of the graph node. If not provided, the function
         * will use the current inputs of the graph node.
         * @param {Array} outputs outputs of the graph node. If not provided, the function
         * will use the current outputs of the graph node.
         */
        updateExposedInterfaces(inputs = undefined, outputs = undefined) {
            // Update interfaces based on subgraph interfaces and their external names
            const evaluatedIntf = updateSubgraphInterfaces(
                this.subgraph.nodes,
                inputs ?? Object.values(this.inputs),
                outputs ?? Object.values(this.outputs),
            );
            if (Array.isArray(evaluatedIntf) && evaluatedIntf.length) {
                throw new Error(
                    `Internal error occurred while exposing an interface.\n` +
                    `Reason: ${evaluatedIntf.join('. ')}`,
                );
            }

            // After resolving exposed interfaces, the graph node is updated accordingly.
            this.updateInterfaces(evaluatedIntf.inputs, evaluatedIntf.outputs);
        }

        /**
         * Function called when the node is created using the nodePalette
         */
        onPlaced() {
            this.initialize();
        }

        /**
         * Creates a new graph node instance based on the template, loads its graph state
         * and updates exposed interfaces based on the nodes in the subgraph.
         */
        initialize() {
            if (this.subgraph) {
                this.subgraph.destroy();
            }
            const graph = new Graph(this.template.editor);

            const state = this.prepareSubgraphInstance();
            const errors = graph.load(state);
            if (errors.length) {
                throw new Error(
                    `Internal error occurred while initializing ${graph.type} graph. ` +
                    `Reason: ${errors.join('. ')}`,
                );
            }

            graph.template = this.template;
            this.subgraph = graph;
            graph.graphNode = this;

            this.updateExposedInterfaces([], []);

            this._title = this.template.name; // eslint-disable-line no-underscore-dangle
            this.events.update.emit(null);
        }

        /**
         * Function used to update interfaces of the graph node. It makes use of InterfaceRegistry
         * object to create interfaces that share part of the state of the exposed interfaces.
         *
         * @param {Array} newInputs inputs to be added to the graph node
         * @param {Array} newOutputs outputs to be added to the graph node
         */
        updateInterfaces(newInputs, newOutputs) {
            const newInterfaces = [...newInputs, ...newOutputs];
            const currentInterfaces = { ...this.inputs, ...this.outputs };

            Object.entries(currentInterfaces).forEach(([nodeKey, nodeIntf]) => {
                // If current interface cannot be found in `newInterfaces`, it means that
                // it was removed.
                if (newInterfaces.find((intf) => intf.id === nodeIntf.id) === undefined) {
                    const container = nodeIntf.direction === 'output' ? 'output' : 'input';
                    this.removeInterface(container, nodeKey);
                }
            });

            newInterfaces.forEach((nodeIntf) => {
                // If new interface cannot be found in the current interfaces, it means that
                // it has to be created
                const foundIntf = Object.values(currentInterfaces).find(
                    (intf) => intf.id === nodeIntf.id,
                );

                if (foundIntf === undefined) {
                    const ni = new NodeInterface(nodeIntf.name);
                    Object.assign(ni, nodeIntf);
                    ir.pushGraphIdToRegistry(ni.id, this.subgraph.id);
                    ir.createSharedInterface(ni);

                    const container = nodeIntf.direction === 'output' ? 'output' : 'input';
                    this.addInterface(container, `${nodeIntf.direction}_${nodeIntf.name}`, ni);
                } else {
                    Object.assign(foundIntf, nodeIntf);
                }
            });
        }

        /**
         * The function uses its internal static template to create a new graph state
         * based on the template. It creates a new graph node ID and maps all interfaces
         * to new IDs. The function is used to create a new graph state that can be loaded
         * by the graph node.
         *
         * @returns graph state ready to be loaded
         */
        prepareSubgraphInstance() {
            this.updateProperties(this.properties);
            const idMap = new Map();

            const createNewId = (oldId) => {
                const newId = uuidv4();
                idMap.set(oldId, newId);
                return newId;
            };

            const getNewId = (oldId) => {
                const newId = idMap.get(oldId);
                if (!newId) {
                    throw new Error(`Unable to create graph from template: Could not map old id ${oldId} to new id`);
                }
                return newId;
            };

            const mapValues = (obj, fn) =>
                Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

            const mapNodeInterfaceIds = (interfaceStates) => mapValues(
                interfaceStates, (intf) => {
                    const clonedIntf = {
                        ...intf,
                        id: createNewId(intf.id),
                    };
                    return clonedIntf;
                },
            );

            const newGraphNodeId = uuidv4();

            const nodes = this.template.nodes.map((n) => ({
                ...n,
                id: createNewId(n.id),
                inputs: mapNodeInterfaceIds(n.inputs),
                outputs: mapNodeInterfaceIds(n.outputs),
            }));

            const connections = this.template.connections.map((c) => ({
                id: createNewId(c.id),
                from: getNewId(c.from),
                to: getNewId(c.to),
            }));

            const clonedState = {
                id: newGraphNodeId,
                nodes,
                connections,
            };

            return clonedState;
        }
    };
}
