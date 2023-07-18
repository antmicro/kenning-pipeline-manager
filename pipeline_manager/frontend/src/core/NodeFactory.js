/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    CheckboxInterface,
    IntegerInterface,
    NumberInterface,
    SelectInterface,
    TextInterface,
} from '@baklavajs/renderer-vue';

import { defineNode, GraphTemplate, NodeInterface } from '@baklavajs/core';

import { v4 as uuidv4 } from 'uuid';

import InputInterface from '../interfaces/InputInterface.js';
import ListInterface from '../interfaces/ListInterface.js';
import SliderInterface from '../interfaces/SliderInterface.js';

function parseProperties(properties) {
    const tempInputs = {};
    properties.forEach((p) => {
        const propName = p.name;
        const propType = p.type;
        let propDef = p.default;

        switch (propType) {
            case 'constant':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new TextInterface(propName, propDef).setPort(false);
                    intf.componentName = 'TextInterface';
                    return intf;
                };
                break;
            case 'text':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new InputInterface(propName, propDef).setPort(false);
                    intf.componentName = 'InputInterface';
                    return intf;
                };
                break;
            case 'number':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new NumberInterface(propName, propDef).setPort(false);
                    intf.componentName = 'NumberInterface';
                    return intf;
                };
                break;
            case 'integer':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new IntegerInterface(propName, propDef).setPort(false);
                    intf.componentName = 'IntegerInterface';
                    return intf;
                };
                break;
            case 'select': {
                const it = p.values.map((element) => element.toString());
                tempInputs[`property_${propName}`] = () => {
                    const intf = new SelectInterface(propName, propDef, it).setPort(false);
                    intf.componentName = 'SelectInterface';
                    return intf;
                };
                break;
            }
            case 'checkbox':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new CheckboxInterface(propName, propDef).setPort(false);
                    intf.componentName = 'CheckboxInterface';
                    return intf;
                };
                break;
            case 'slider':
                if (propDef === undefined) {
                    propDef = p.min;
                }
                tempInputs[`property_${propName}`] = () => {
                    const intf = new SliderInterface(propName, propDef, p.min, p.max).setPort(
                        false,
                    );
                    intf.componentName = 'SliderInterface';
                    return intf;
                };
                break;
            case 'list':
                tempInputs[`property_${propName}`] = () => {
                    const intf = new ListInterface(propName, propDef, p.dtype).setPort(false);
                    intf.componentName = 'ListInterface';
                    return intf;
                };
                break;
            default:
                /* eslint-disable no-console */
                console.error(propType, '- input type is not recognized.');
        }
    });
    return tempInputs;
}

/**
 * Returns an interface constructor that is used to build nodes
 *
 * @param io configuration of the interface
 * @param hidden whether th interface should be hidden. For example groups of interfaces
 * are hidden by default
 * @param {*} name custom name for the interface that should be used instead of the one coming
 * from `io`
 * @returns baklava interface constructor
 */
function createInterface(io, hidden = true, name = undefined) {
    return () => {
        const intf = new NodeInterface(name ?? io.name);
        intf.type = typeof io.type === 'string' || io.type instanceof String ? [io.type] : io.type;
        intf.componentName = 'NodeInterface';
        intf.maxConnectionsCount = io.maxConnectionsCount;
        intf.direction = io.direction;
        intf.side = io.side ?? (io.direction === 'output' ? 'right' : 'left');
        intf.hidden = hidden;
        intf.interfaces = io.interfaces;
        return intf;
    };
}

/* eslint-disable no-lonely-if */
function parseIntefaces(interfaces, interfaceGroups) {
    const tempIO = {
        input: {},
        inout: {},
        output: {},
    };

    // Interfaces that are mentioned in interfaces groups should not be rendered by default
    const interfacesFromGroups = new Set();

    interfaceGroups.forEach((ig) => {
        tempIO[ig.direction][ig.name] = createInterface(ig, true);

        ig.interfaces.forEach((intf) => {
            if (intf.array !== undefined) {
                const [left, right] = intf.array;

                for (let j = left; j < right; j += 1) {
                    const newName = `${intf.name}[${j}]`;
                    interfacesFromGroups.add(`${intf.direction}_${newName}`);
                }
            } else {
                interfacesFromGroups.add(`${intf.direction}_${intf.name}`);
            }
        });
    });

    // storing inouts currently in the same list as inputs (since they are already
    // handling other things than inputs, such as parameters)
    interfaces.forEach((io) => {
        if (io.array !== undefined) {
            const [left, right] = io.array;

            for (let j = left; j < right; j += 1) {
                const newName = `${io.name}[${j}]`;
                if (!interfacesFromGroups.has(`${io.direction}_${newName}`)) {
                    tempIO[io.direction][newName] = createInterface(io, false, newName);
                }
            }
        } else {
            if (!interfacesFromGroups.has(`${io.direction}_${io.name}`)) {
                tempIO[io.direction][io.name] = createInterface(
                    io,
                    interfacesFromGroups.has(`${io.direction}_${io.name}`),
                );
            }
        }
    });

    const filteredInouts = Object.fromEntries(
        Object.entries(tempIO.inout).filter(
            ([name]) =>
                !Object.keys(tempIO.output).includes(name) &&
                !Object.keys(tempIO.input).includes(name),
        ),
    );

    const renamedInputs = Object.fromEntries(
        Object.entries(tempIO.input).map(([name, constructor]) => [`input_${name}`, constructor]),
    );
    const renamedInouts = Object.fromEntries(
        Object.entries(filteredInouts).map(([name, constructor]) => [`inout_${name}`, constructor]),
    );
    const renamedOutputs = Object.fromEntries(
        Object.entries(tempIO.output).map(([name, constructor]) => [`output_${name}`, constructor]),
    );

    return {
        inputs: { ...renamedInouts, ...renamedInputs },
        outputs: renamedOutputs,
    };
}

function parseNodeState(state) {
    const newState = { ...state };

    if (newState.inputs === undefined) {
        newState.inputs = {};
    }
    if (newState.outputs === undefined) {
        newState.outputs = {};
    }

    if (newState.interfaces !== undefined) {
        newState.interfaces.forEach((intf) => {
            if (intf.direction === 'input' || intf.direction === 'inout') {
                newState.inputs[`${intf.direction}_${intf.name}`] = { ...intf };
            } else if (intf.direction === 'output') {
                newState.outputs[`${intf.direction}_${intf.name}`] = { ...intf };
            }
        });

        delete newState.interfaces;
    }

    if (newState.properties !== undefined) {
        newState.properties.forEach((prop) => {
            newState.inputs[`property_${prop.name}`] = { ...prop };
        });
        delete newState.properties;
    }

    if (newState.enabledInterfaceGroups !== undefined) {
        const interfaceGroups = {};
        newState.enabledInterfaceGroups.forEach((intf) => {
            interfaceGroups[`${intf.direction}_${intf.name}`] = { ...intf };
        });
        newState.interfaceGroups = interfaceGroups;
        delete newState.enabledInterfaceGroups;
    } else {
        newState.interfaceGroups = {};
    }

    if ('name' in newState) {
        newState.title = newState.name;
    } else {
        newState.title = '';
    }
    delete newState.name;

    return newState;
}

/**
 * Function performs sanity checking on parsed state before loading it
 * into the editor. It should throw explicit errors if any discrepancy is detected.
 *
 * @param parsedState that is passed to node to load
 * @param inputs inputs of the node
 * @param outputs outputs of the node
 */
function detectDiscrepancies(parsedState, inputs, outputs) {
    const errors = [];

    // Checking for existence of interfaces defined
    Object.keys({
        ...parsedState.inputs,
        ...parsedState.outputs,
    }).forEach((ioName) => {
        if (
            !Object.prototype.hasOwnProperty.call(inputs, ioName) &&
            !Object.prototype.hasOwnProperty.call(outputs, ioName)
        ) {
            const direction = ioName.slice(0, ioName.indexOf('_'));
            const name = ioName.slice(ioName.indexOf('_') + 1);

            errors.push(
                `Node of name ${parsedState.type} and id ${parsedState.id} is corrupted. ` +
                    `Interface named - ${name} of direction - ${direction} not found in specification!`,
            );
        }
    });

    // Checking for existence of interface groups
    Object.keys(parsedState.interfaceGroups).forEach((groupName) => {
        if (
            !Object.prototype.hasOwnProperty.call(inputs, groupName) &&
            !Object.prototype.hasOwnProperty.call(outputs, groupName)
        ) {
            const direction = groupName.slice(0, groupName.indexOf('_'));
            const name = groupName.slice(groupName.indexOf('_') + 1);

            errors.push(
                `Node of name ${parsedState.type} and id ${parsedState.id} is corrupted. ` +
                    `Interface group named - ${name} of direction - ${direction} not found in specification!`,
            );
        }
    });

    if (Array.isArray(errors) && errors.length) {
        return errors;
    }

    // Checking for integrity of interface groups
    const usedInterfaces = new Set();
    Object.keys(parsedState.interfaceGroups).forEach((groupName) => {
        const interfaces = inputs[groupName]?.interfaces ?? outputs[groupName]?.interfaces;
        const direction = groupName.slice(0, groupName.indexOf('_'));
        const name = groupName.slice(groupName.indexOf('_') + 1);

        interfaces.forEach((intf) => {
            if (intf.array !== undefined) {
                const [left, right] = intf.array;

                for (let j = left; j < right; j += 1) {
                    const newName = `${intf.name}[${j}]`;
                    if (usedInterfaces.has(newName)) {
                        errors.push(
                            `Interface of name ${intf.name}[${j}] has been reused ` +
                                `by interface group named - ${name} of direction - ${direction}. ` +
                                `Make sure your interface groups are disjoint.`,
                        );
                    } else {
                        usedInterfaces.add(newName);
                    }
                }
            } else {
                if (usedInterfaces.has(intf.name)) {
                    errors.push(
                        `Interface of name ${intf.name} has been reused ` +
                            `by interface group named - ${name} of direction - ${direction}. ` +
                            `Make sure your interface groups are disjoint.`,
                    );
                } else {
                    usedInterfaces.add(intf.name);
                }
            }
        });
    });

    return errors;
}

/**
 * Class factory that creates a class for a custom Node that is described by the arguments.
 * It can be later registered so that the user can use it and save the editor.
 * `inputs`, `properties` and `outputs` formats are described in the documentation.
 *
 * @param {string} name Name of the block that is stored when saving
 * @param {string} displayName Name of the block displayed to the user
 * @param {string} type Type of the node
 * @param {*} interfaces List of interfaces in the block (input, output and inout)
 * @param {*} properties List of properties of the block
 * @param {boolean} twoColumn type of layout of the nodes
 * @returns Node based class
 */
export function NodeFactory(
    name,
    displayName,
    nodeType,
    interfaces,
    properties,
    interfaceGroups,
    twoColumn,
) {
    const node = defineNode({
        type: name,

        title: displayName,

        inputs: {
            ...parseIntefaces(interfaces, interfaceGroups).inputs,
            ...parseProperties(properties),
        },
        outputs: parseIntefaces(interfaces, interfaceGroups).outputs,

        /* eslint-disable no-param-reassign */
        onCreate() {
            this.nodeType = nodeType;
            this.parentSave = this.save;
            this.parentLoad = this.load;

            this.save = () => {
                const savedState = this.parentSave();

                const newProperties = [];
                const newInterfaces = [];

                Object.entries({ ...this.inputs, ...this.outputs }).forEach((io) => {
                    const [ioName, ioState] = io;

                    if (ioState.port) {
                        // Only interfaces that have any connections are stored
                        if (
                            ioState.connectionCount > 0 ||
                            this.graph.inputs.find((inp) => inp.nodeInterfaceId === ioState.id) ||
                            this.graph.outputs.find((inp) => inp.nodeInterfaceId === ioState.id)
                        ) {
                            newInterfaces.push({
                                name: ioName.slice(ioState.direction.length + 1),
                                id: ioState.id,
                                direction: ioState.direction,
                                side: ioState.side,
                            });
                        }
                    } else {
                        newProperties.push({
                            name: ioName.slice('property'.length + 1),
                            id: ioState.id,
                            value: ioState.value === undefined ? null : ioState.value,
                        });
                    }
                });

                delete savedState.inputs;
                delete savedState.outputs;
                savedState.interfaces = newInterfaces;
                savedState.properties = newProperties;

                savedState.name = savedState.title;
                delete savedState.title;

                return savedState;
            };

            this.load = (state) => {
                const parsedState = parseNodeState(state);
                const errors = detectDiscrepancies(parsedState, this.inputs, this.outputs);
                if (Array.isArray(errors) && errors.length) {
                    return errors;
                }

                Object.entries(parsedState.interfaceGroups).forEach(([groupName, groupState]) => {
                    if (groupState.direction === 'input' || groupState.direction === 'inout') {
                        this.inputs[groupName].hidden = false;
                    } else if (groupState.direction === 'output') {
                        this.outputs[groupName].hidden = false;
                    }
                });

                this.parentLoad(parsedState);

                // As we do not save to dataflow information about interfaces
                // that have no connections they have to be initialized manually
                Object.entries({ ...this.inputs, ...this.outputs }).forEach(([, intf]) => {
                    intf.nodeId = this.id;
                });

                // Assigning sides to interfaces if any are defined
                Object.entries({
                    ...parsedState.inputs,
                    ...parsedState.outputs,
                    ...parsedState.interfaceGroups,
                }).forEach(([ioName, ioState]) => {
                    if (ioState.direction !== undefined && ioState.side !== undefined) {
                        if (ioState.direction === 'input' || ioState.direction === 'inout') {
                            this.inputs[ioName].side = ioState.side;
                        } else if (ioState.direction === 'output') {
                            this.outputs[ioName].side = ioState.side;
                        }
                    }
                });

                // Default position should be undefined instead of (0, 0) so that it can be set
                // by autolayout
                if (state.position === undefined) {
                    this.position = undefined;
                }
                return [];
            };

            this.twoColumn = twoColumn;
        },
    });

    return node;
}

/**
 * Function creating the subgraph template as defined in specification
 *
 * @param nodes Nodes of the subgraph
 * @param connections Connections inside the subgraph
 * @param interfaces Inputs and outputs
 * @param name Default name that will be displayed in editor
 * @param type Type of the subgraph. Used to define which template should be used
 * when new subgraph node is create
 * @param editor PipelineManagerEditor instance
 * @returns Graph template that will be used to define the subgraph node
 */
export function SubgraphFactory(nodes, connections, interfaces, name, type, editor) {
    const inputs = interfaces
        .filter((interf) => interf.direction === 'input' || interf.direction === 'inout')
        .map((interf) => ({
            id: interf.id ?? uuidv4(),
            nodeInterfaceId: interf.nodeInterface,
            name: interf.name,
            direction: interf.direction,
        }));
    const outputs = interfaces
        .filter((interf) => interf.direction === 'output')
        .map((interf) => ({
            id: interf.id ?? uuidv4(),
            nodeInterfaceId: interf.nodeInterface,
            name: interf.name,
            direction: interf.direction,
        }));

    const state = {
        id: type,
        nodes: nodes.map(parseNodeState),
        connections,
        inputs,
        outputs,
        name,
    };
    return new GraphTemplate(state, editor);
}
