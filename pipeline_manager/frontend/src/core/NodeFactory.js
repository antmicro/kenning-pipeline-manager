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
                console.error(propType, ' input type is not recognized.');
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
function createInterface(io, hidden, name = undefined) {
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

/**
 * Parses and validates interfaces passed in specification
 *
 * @param interfaces list of interfaces from specification that is going to be parsed
 * @param interfaceGroup determines whether `interfaces` are interface groups. If true the
 * additionaly field `.interfaces` is parsed.
 * @returns parsed interfaces that can be passed to baklavajs if the interfaces were valid.
 * Otherwise an array of errors is returned.
 */
function parseSingleInterfaces(interfaces, interfaceGroup = false) {
    const errors = [];
    const tempParsed = {
        input: {},
        inout: {},
        output: {},
    };

    interfaces.forEach((io) => {
        if (io.array !== undefined) {
            const [left, right] = io.array;

            for (let j = left; j < right; j += 1) {
                const name = `${io.name}[${j}]`;
                if (tempParsed[io.direction][name] !== undefined) {
                    errors.push(
                        `Interface named ${name} of direction ${io.direction} is a duplicate.`,
                    );
                }
                tempParsed[io.direction][`${io.name}[${j}]`] = io;
            }
        } else {
            if (tempParsed[io.direction][io.name] !== undefined) {
                errors.push(
                    `Interface named ${io.name} of direction ${io.direction} is a duplicate.`,
                );
            }
            tempParsed[io.direction][io.name] = io;
        }

        if (interfaceGroup) {
            const newInterfaces = [];

            io.interfaces.forEach((buildingIO) => {
                if (buildingIO.array !== undefined) {
                    const [left, right] = buildingIO.array;

                    for (let j = left; j < right; j += 1) {
                        const name = `${buildingIO.direction}_${buildingIO.name}[${j}]`;
                        newInterfaces.push(name);
                    }
                } else {
                    const name = `${buildingIO.direction}_${buildingIO.name}`;
                    newInterfaces.push(name);
                }
            });
            io.interfaces = newInterfaces; // eslint-disable-line no-param-reassign
        }
    });

    // Removing inout with duplicate names
    const filteredTempInouts = Object.fromEntries(
        Object.entries(tempParsed.inout).filter(([name, state]) => {
            const duplicate =
                Object.keys(tempParsed.output).includes(name) ||
                Object.keys(tempParsed.input).includes(name);
            if (duplicate) {
                errors.push(
                    `Interface named ${name} of direction ${state.direction} ` +
                        `is a duplicate. There already exists an input or output of this name.`,
                );
            }
            return !duplicate;
        }),
    );

    tempParsed.inout = filteredTempInouts;
    tempParsed.input = { ...tempParsed.input, ...tempParsed.inout };
    delete tempParsed.inout;

    tempParsed.input = Object.fromEntries(
        Object.entries(tempParsed.input).map(([name, state]) => [
            `${state.direction}_${name}`,
            state,
        ]),
    );
    tempParsed.output = Object.fromEntries(
        Object.entries(tempParsed.output).map(([name, state]) => [
            `${state.direction}_${name}`,
            state,
        ]),
    );

    if (errors.length) {
        return errors;
    }
    return tempParsed;
}

/**
 * Checks whether interface groups that are in enabledInterfaceGroup
 * can be enabled at the same time
 * @param {array} enabledInterfaceGroups array of names of enabled interface groups
 * @param {*} inputs inputs of the node
 * @param {*} outputs outputs of the node
 * @returns list of errors.
 */
function validateInterfaceGroups(enabledInterfaceGroups, inputs, outputs) {
    const errors = [];
    // Checking for integrity of interface groups
    const usedInterfaces = new Set();
    enabledInterfaceGroups.forEach((name) => {
        const interfaces = inputs[name]?.interfaces ?? outputs[name]?.interfaces;
        const groupDirection = name.slice(0, name.indexOf('_'));
        const groupName = name.slice(name.indexOf('_') + 1);

        interfaces.forEach((intfName) => {
            if (usedInterfaces.has(intfName)) {
                const intfDirection = intfName.slice(0, intfName.indexOf('_'));
                const parsedIntfName = intfName.slice(intfName.indexOf('_') + 1);

                errors.push(
                    `Interface of name ${parsedIntfName} and direction ${intfDirection} has been reused ` +
                        `by interface group named ${groupName} of direction ${groupDirection}. ` +
                        `Make sure your interface groups are disjoint.`,
                );
            } else {
                usedInterfaces.add(intfName);
            }
        });
    });
    return errors;
}

/**
 * Function performs sanity checking on parsed state before loading it
 * into the editor. It should throw explicit errors if any discrepancy is detected.
 *
 * @param parsedState that is passed to node to load
 * @param inputs inputs of the node
 * @param outputs outputs of the node
 * @returns list of errors.
 */
function detectDiscrepancies(parsedState, inputs, outputs) {
    let errors = [];

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
                    `Interface named ${name} of direction ${direction} not found in specification!`,
            );
        }
    });

    // Checking for existence of interface groups
    Object.keys(parsedState.enabledInterfaceGroups).forEach((groupName) => {
        if (
            !Object.prototype.hasOwnProperty.call(inputs, groupName) &&
            !Object.prototype.hasOwnProperty.call(outputs, groupName)
        ) {
            const direction = groupName.slice(0, groupName.indexOf('_'));
            const name = groupName.slice(groupName.indexOf('_') + 1);

            errors.push(
                `Node of name ${parsedState.type} and id ${parsedState.id} is corrupted. ` +
                    `Interface group named ${name} of direction ${direction} not found in specification!`,
            );
        }
    });

    if (errors && errors.length) {
        return errors;
    }

    errors = validateInterfaceGroups(
        Object.keys(parsedState.enabledInterfaceGroups),
        inputs,
        outputs,
    );

    return errors;
}

/**
 * @param {*} interfaces List of interfaces in the block (input, output and inout)
 * @param {*} interfaceGroups Object describing groups of interfaces
 * @param {*} defaultInterfaceGroups Object describing groups of interfaces that
 * @returns
 */
/* eslint-disable no-lonely-if */
function parseIntefaces(interfaces, interfaceGroups, defaultInterfaceGroups) {
    let errors = [];

    // Parsing single interfaces first
    const tempParsed = parseSingleInterfaces(interfaces);
    // If parseSingleInterfaces returns an array, it is an array of errors
    if (Array.isArray(tempParsed) && tempParsed.length) {
        return tempParsed;
    }

    // Checking for integrity of interface groups
    interfaceGroups.forEach((intfG) => {
        intfG.interfaces.forEach((intf) => {
            if (intf.array !== undefined) {
                const [left, right] = intf.array;

                for (let j = left; j < right; j += 1) {
                    const name = `${intf.direction}_${intf.name}[${j}]`;
                    if (
                        !Object.keys({ ...tempParsed.input, ...tempParsed.output }).includes(name)
                    ) {
                        errors.push(
                            `Interface named ${intf.name}[${j}] of direction ${intf.direction} ` +
                                `used for interface group ${intfG.name} of direction ` +
                                `${intfG.direction} does not exist.`,
                        );
                    }
                }
            } else {
                const name = `${intf.direction}_${intf.name}`;
                if (!Object.keys({ ...tempParsed.input, ...tempParsed.output }).includes(name)) {
                    errors.push(
                        `Interface named ${intf.name} of direction ${intf.direction} ` +
                            `used for interface group ${intfG.name} of direction ` +
                            `${intfG.direction} does not exist.`,
                    );
                }
            }
        });
    });

    if (errors.length) {
        return errors;
    }

    const tempParsedGroups = parseSingleInterfaces(interfaceGroups, true);
    // If parseSingleInterfaces returns an array, it is an array of errors
    if (Array.isArray(tempParsedGroups) && tempParsedGroups.length) {
        return tempParsedGroups;
    }

    // All interfaces that create some interfaces groups
    const interfacesCreatingGroups = new Set();
    Object.values({
        ...tempParsedGroups.input,
        ...tempParsedGroups.output,
    }).forEach((state) => {
        state.interfaces.forEach((intf) => interfacesCreatingGroups.add(intf));
    });

    // Detecting integrity of enabled interface groups
    const enabledInterfaceGroupsNames = defaultInterfaceGroups.map(
        (group) => `${group.direction}_${group.name}`,
    );

    errors = validateInterfaceGroups(
        enabledInterfaceGroupsNames,
        { ...tempParsedGroups.input, ...tempParsed.input },
        { ...tempParsedGroups.output, ...tempParsed.output },
    );

    if (errors.length) {
        return errors;
    }

    // Creating interfaces for baklavajs
    const createdInterfaces = {
        inputs: {},
        outputs: {},
    };

    // Filtering single interfaces that are part of interface groups
    // Those interfaces are removed as they are never rendered
    Object.entries(tempParsed.input).forEach(([name, intf]) => {
        if (!interfacesCreatingGroups.has(name)) {
            createdInterfaces.inputs[name] = createInterface(intf, false, name);
        }
    });

    Object.entries(tempParsed.output).forEach(([name, intf]) => {
        if (!interfacesCreatingGroups.has(name)) {
            createdInterfaces.outputs[name] = createInterface(intf, false, name);
        }
    });

    // Adding interfaces groups, hidden by default
    Object.entries(tempParsedGroups.input).forEach(([name, intf]) => {
        createdInterfaces.inputs[name] = createInterface(
            intf,
            !enabledInterfaceGroupsNames.includes(name),
            name,
        );
    });

    Object.entries(tempParsedGroups.output).forEach(([name, intf]) => {
        createdInterfaces.outputs[name] = createInterface(
            intf,
            !enabledInterfaceGroupsNames.includes(name),
            name,
        );
    });

    return {
        inputs: createdInterfaces.inputs,
        outputs: createdInterfaces.outputs,
    };
}

/**
 * @param {*} state state to be loaded. Should be a valid dataflow
 * @returns state that can be given to baklavajs
 */
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
        newState.enabledInterfaceGroups = interfaceGroups;
    } else {
        newState.enabledInterfaceGroups = {};
    }

    if ('name' in newState) {
        newState.title = newState.name;
    } else {
        newState.title = '';
    }
    delete newState.name;

    newState.parsed = true;
    return newState;
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
 * @param {*} interfaceGroups Object describing groups of interfaces
 * @param {*} defaultInterfaceGroups Object describing groups of interfaces that
 * are enabled by default
 * @param {boolean} twoColumn type of layout of the nodes
 * @returns Node based class is successful, otherwise an array of errors is returned.
 */
export function NodeFactory(
    name,
    displayName,
    nodeType,
    interfaces,
    properties,
    interfaceGroups,
    defaultInterfaceGroups,
    twoColumn,
) {
    const parsedInterfaces = parseIntefaces(interfaces, interfaceGroups, defaultInterfaceGroups);
    // If parsedInterfaces returns an array, it is an array of errors
    if (Array.isArray(parsedInterfaces) && parsedInterfaces.length) {
        return parsedInterfaces;
    }

    const node = defineNode({
        type: name,

        title: displayName,

        inputs: {
            ...parsedInterfaces.inputs,
            ...parseProperties(properties),
        },
        outputs: parsedInterfaces.outputs,

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
                let parsedState;

                // `parsed` determines whether the state was already parsed before loading
                // This is caused by the fact that `load` can be used both to load a state
                // from a dataflow and from an instance of a node
                if (Object.prototype.hasOwnProperty.call(state, 'parsed') && state.parsed) {
                    parsedState = state;
                } else {
                    parsedState = parseNodeState(state);
                }

                const errors = detectDiscrepancies(parsedState, this.inputs, this.outputs);

                if (Array.isArray(errors) && errors.length) {
                    return errors;
                }

                this.parentLoad(parsedState);

                // Disabling default interface groups if the node has its own state
                if (Object.keys(parsedState.enabledInterfaceGroups).length) {
                    Object.entries({ ...this.inputs, ...this.outputs }).forEach(([, intf]) => {
                        // If this is an interfaces group
                        if (intf.interfaces !== undefined) {
                            intf.hidden = true;
                        }
                    });
                }

                // Enabling interface groups
                Object.entries(parsedState.enabledInterfaceGroups).forEach(
                    ([groupName, groupState]) => {
                        if (groupState.direction === 'input' || groupState.direction === 'inout') {
                            this.inputs[groupName].hidden = false;
                        } else if (groupState.direction === 'output') {
                            this.outputs[groupName].hidden = false;
                        }
                    },
                );

                // As we do not save to dataflow information about interfaces
                // that have no connections they have to be initialized manually
                Object.entries({ ...this.inputs, ...this.outputs }).forEach(([, intf]) => {
                    intf.nodeId = this.id;
                });

                // Assigning sides to interfaces if any are defined
                Object.entries({
                    ...parsedState.inputs,
                    ...parsedState.outputs,
                    ...parsedState.enabledInterfaceGroups,
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
