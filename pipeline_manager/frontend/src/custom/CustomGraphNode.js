/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import {
    createGraphNodeType,
    GRAPH_NODE_TYPE_PREFIX,
    NodeInterface,
    Graph,
} from '@baklavajs/core';
import { v4 as uuidv4 } from 'uuid';
import { parseInterfaces } from '../core/interfaceParser.js';

export default function CreateCustomGraphNodeType(template, type) {
    const nt = createGraphNodeType(template);

    return class customGraphNodeType extends nt {
        type = `${GRAPH_NODE_TYPE_PREFIX}${type}`;

        save() {
            const state = super.save();

            const newInterfaces = [];
            [...this.subgraph.inputs, ...this.subgraph.outputs].forEach((io) => {
                newInterfaces.push({
                    name: io.name,
                    id: io.id,
                    subgraphNodeId: io.subgraphNodeId,
                    direction: io.direction,
                    side: io.side,
                    sidePosition: io.sidePosition,
                });
            });

            state.interfaces = newInterfaces;
            delete state.inputs;
            delete state.outputs;

            // After entering the edit subgraph mode, subgraph interfaces will contain
            // redundant information, such as side, nodePosition etc.
            // (these are already defined in state.interfaces) so they should be filtered out
            state.graphState.interfaces = [];
            state.graphState.inputs.forEach((input) =>
                state.graphState.interfaces.push({
                    id: input.subgraphNodeId,
                    nodePosition: input.nodePosition,
                }),
            );
            state.graphState.outputs.forEach((output) =>
                state.graphState.interfaces.push({
                    id: output.subgraphNodeId,
                    nodePosition: output.nodePosition,
                }),
            );

            delete state.graphState.inputs;
            delete state.graphState.outputs;

            state.name = state.type;
            delete state.type;

            state.instanceName = state.title === '' ? undefined : state.title;
            delete state.title;

            return state;
        }

        load(state) {
            const out = parseInterfaces(state.interfaces, [], [], true);
            if (Array.isArray(out) && out.length) {
                return out;
            }
            const { inputs, outputs } = out;

            /*
                When the subgraph node is created, it creates a placeholder interfaces
                which are later loaded by super.load, setting proper names and IDs.
                The name of interface is an ID of input/output in a subgraph (except for
                '_calculationResults`, which is baklava specific hidden output). IDs of
                inputs/outputs are also randomly generated IDs, which are later updated, but
                the names of are not adjusted. We need to tie an input interface with
                corresponding subgraph input (here it is done by name of subgraph input) and
                adjust the node's input (and likewise for outputs)
            */
            this.updateInterfaces(inputs, outputs);
            delete state.interfaces; // eslint-disable-line no-param-reassign

            let errors = [];
            if (!this.subgraph) {
                errors.push('Cannot load a graph node without a graph');
            }
            if (!this.template) {
                errors.push('Unable to load graph node without graph template');
            }
            if (errors.length) {
                return errors;
            }

            // Loading the subgraph of the graph
            errors = this.subgraph.load(state.graphState);
            if (errors.length) {
                return errors;
            }

            // Default position should be undefined instead of (0, 0) so that it can be set
            // by autolayout
            this.position = state.position;

            this.events.loaded.emit(this);
            return [];
        }

        initialize() {
            if (this.subgraph) {
                this.subgraph.destroy();
            }
            const graph = new Graph(this.template.editor);

            const state = this.prepareSubgraphInstance();
            this.updateInterfaces(state.inputs, state.outputs);

            const errors = graph.load(state);
            if (errors.length) {
                throw new Error(
                    `Internal error occured while initializing ${graph.type} graph. ` +
                    `Reason: ${errors.join('. ')}`,
                );
            }

            graph.template = this.template;
            this.subgraph = graph;

            this._title = this.template.name; // eslint-disable-line no-underscore-dangle
            this.events.update.emit(null);
        }

        updateInterfaces(newInputs, newOutputs) {
            Object.keys(this.inputs).forEach((key) => {
                this.removeInterface('input', key);
            });
            Object.values(newInputs).forEach((inputInfo) => {
                const ni = new NodeInterface(inputInfo.name);
                Object.assign(ni, inputInfo);
                this.addInterface('input', inputInfo.name, ni);
            });
            Object.keys(this.outputs).forEach((key) => {
                this.removeInterface('output', key);
            });
            Object.values(newOutputs).forEach((outputInfo) => {
                const ni = new NodeInterface(outputInfo.name);
                Object.assign(ni, outputInfo);
                this.addInterface('output', outputInfo.name, ni);
            });
        }

        prepareSubgraphInstance() {
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

            const nodes = this.template.nodes.map((n) => ({
                ...n,
                id: createNewId(n.id),
                inputs: mapNodeInterfaceIds(n.inputs),
                outputs: mapNodeInterfaceIds(n.outputs),
            }));

            const inputs = this.template.inputs.map((i) => ({
                ...i,
                id: uuidv4(),
                subgraphNodeId: createNewId(i.id),
            }));

            const outputs = this.template.outputs.map((o) => ({
                ...o,
                id: uuidv4(),
                subgraphNodeId: createNewId(o.id),
            }));

            const connections = this.template.connections.map((c) => ({
                id: createNewId(c.id),
                from: getNewId(c.from),
                to: getNewId(c.to),
            }));

            const clonedState = {
                id: uuidv4(),
                nodes,
                connections,
                inputs,
                outputs,
            };

            return clonedState;
        }
    };
}
