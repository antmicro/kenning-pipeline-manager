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

import { parseInterfaces, validateInterfaceGroups } from './interfaceParser.js';

import InputInterface from '../interfaces/InputInterface.js';
import ListInterface from '../interfaces/ListInterface.js';
import SliderInterface from '../interfaces/SliderInterface.js';

function parseProperties(properties) {
    const getIntf = (p, hidden = false) => {
        const propName = p.name;
        const propType = p.type;
        let propDef = p.default;
        let intf;

        switch (propType) {
            case 'constant':
                intf = new TextInterface(propName, propDef).setPort(false);
                intf.componentName = 'TextInterface';
                break;
            case 'text':
                intf = new InputInterface(propName, propDef).setPort(false);
                intf.componentName = 'InputInterface';
                break;
            case 'number':
                intf = new NumberInterface(propName, propDef).setPort(false);
                intf.componentName = 'NumberInterface';
                break;
            case 'integer':
                intf = new IntegerInterface(propName, propDef).setPort(false);
                intf.componentName = 'IntegerInterface';
                break;
            case 'select': {
                const it = p.values.map((element) => element.toString());
                intf = new SelectInterface(propName, propDef, it).setPort(false);
                intf.componentName = 'SelectInterface';
            } break;
            case 'checkbox':
                intf = new CheckboxInterface(propName, propDef).setPort(false);
                intf.componentName = 'CheckboxInterface';
                break;
            case 'slider':
                if (propDef === undefined) {
                    propDef = p.min;
                }
                intf = new SliderInterface(propName, propDef, p.min, p.max).setPort(
                    false,
                );
                intf.componentName = 'SliderInterface';
                break;
            case 'list':
                intf = new ListInterface(propName, propDef, p.dtype).setPort(false);
                intf.componentName = 'ListInterface';
                break;
            default:
                /* eslint-disable no-console */
                console.error(propType, ' input type is not recognized.');
        }
        if (intf !== undefined) {
            intf.hidden = hidden;
        }

        return intf;
    };

    const tempInputs = {};
    const groups = {};
    properties.forEach((p) => {
        if (p.group !== undefined) {
            const checkbox = getIntf(p);
            checkbox.group = p.group.map((groupP) => `property_${groupP.name}`);
            tempInputs[`property_${p.name}`] = () => checkbox;

            p.group.forEach((groupP) => {
                tempInputs[`property_${groupP.name}`] = () => getIntf(groupP);
            });
        } else {
            tempInputs[`property_${p.name}`] = () => getIntf(p);
        }
    });

    return {
        parsedProperties: tempInputs,
        groups,
    };
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

            errors.push(`Interface named '${name}' of direction '${direction}' not found in specification!`);
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

            errors.push(`Interface group named '${name}' of direction '${direction}' not found in specification!`);
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
 * @param {*} state state to be loaded. Should be a valid dataflow
 * @returns state that can be given to baklavajs, or an array of errors if any occured
 */
function parseNodeState(state) {
    const newState = { ...state };

    if (newState.interfaces !== undefined) {
        const out = parseInterfaces(newState.interfaces, [], []);
        if (Array.isArray(out) && out.length) {
            return out;
        }

        const { inputs, outputs } = out;
        newState.inputs = inputs;
        newState.outputs = outputs;

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
    const parsedInterfaces = parseInterfaces(interfaces, interfaceGroups, defaultInterfaceGroups);
    // If parsedInterfaces returns an array, it is an array of errors
    if (Array.isArray(parsedInterfaces) && parsedInterfaces.length) {
        return parsedInterfaces.map((error) => `Node ${displayName} invalid. ${error}`);
    }

    function createBaklavaInterface(intf) {
        return () => {
            const baklavaIntf = new NodeInterface(intf.name);
            Object.assign(baklavaIntf, intf);
            return baklavaIntf;
        };
    }

    // Creating interfaces for baklavajs
    const inputs = Object.fromEntries(
        Object.entries(parsedInterfaces.inputs).map(
            ([n, intf]) => [n, createBaklavaInterface(intf)],
        ),
    );

    const outputs = Object.fromEntries(
        Object.entries(parsedInterfaces.outputs).map(
            ([n, intf]) => [n, createBaklavaInterface(intf)],
        ),
    );

    const { groups, parsedProperties } = parseProperties(properties);

    const node = defineNode({
        type: name,

        title: displayName,

        inputs: {
            ...inputs,
            ...parsedProperties,
        },
        outputs,

        /* eslint-disable no-param-reassign */
        onCreate() {
            this.groups = groups;
            this.nodeType = nodeType;
            this.parentSave = this.save;
            this.parentLoad = this.load;

            /**
             * Toggles interface groups and removes any connections attached
             * to the interface it is toggled to hidden.
             *
             * @param intf interface instance of the interface group
             * @param {bool} visible whether to enable or disable interface group
             */
            this.toggleInterfaceGroup = (intf, visible) => {
                // If the interface is visible and is being disabled

                if (!intf.hidden && !visible) {
                    const connections = this.graphInstance.connections.filter(
                        (c) => c.from === intf || c.to === intf,
                    );
                    connections.forEach((c) => {
                        this.graphInstance.removeConnection(c);
                    });
                }
                intf.hidden = !visible;
            };

            this.save = () => {
                const savedState = this.parentSave();
                const newProperties = [];
                const newInterfaces = [];
                const enabledInterfaceGroups = [];

                Object.entries({ ...this.inputs, ...this.outputs }).forEach((io) => {
                    const [ioName, ioState] = io;

                    if (ioState.port) {
                        if (ioState.interfaces && !ioState.hidden) {
                            enabledInterfaceGroups.push({
                                name: ioName.slice(ioState.direction.length + 1),
                                direction: ioState.direction,
                            });
                        }

                        newInterfaces.push({
                            name: ioName.slice(ioState.direction.length + 1),
                            id: ioState.id,
                            direction: ioState.direction,
                            side: ioState.side,
                            sidePosition: ioState.sidePosition,
                        });
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
                savedState.enabledInterfaceGroups = enabledInterfaceGroups;

                savedState.name = savedState.title;
                delete savedState.title;

                return savedState;
            };

            /**
             * Function used to update interfaces of a node when loading a dataflow
             * in a development mode.
             */
            this.updateInterfaces = (stateInputs, stateOutputs) => {
                const errors = [];
                // Updating interfaces of a graph node
                Object.entries(this.inputs).forEach(([k, intf]) => {
                    // Process only interfaces, not properties
                    if (intf.direction === undefined) return;
                    if (!Object.keys(stateInputs).includes(k)) {
                        errors.push(
                            `Interface '${intf.name}' of direction '${intf.direction}' ` +
                            `removed as it was not found in the dataflow.`,
                        );
                        this.removeInput(k);
                    }
                });
                Object.entries(stateInputs).forEach(([idA, intfA]) => {
                    if (intfA.direction === undefined) return;
                    const foundIntf = Object.entries(this.inputs).find(
                        ([idB, intfB]) => idB === idA && intfB.direction === intfA.direction,
                    );
                    if (foundIntf === undefined) {
                        const baklavaIntf = new NodeInterface(idA);
                        errors.push(
                            `Interface '${intfA.name}' of direction '${intfA.direction}' ` +
                            `created as it was not found in the specification.`,
                        );
                        Object.assign(baklavaIntf, intfA);
                        this.addInterface(baklavaIntf.direction, idA, baklavaIntf);
                    } else {
                        Object.assign(foundIntf[1], intfA);
                    }
                });

                Object.entries(this.outputs).forEach(([k, intf]) => {
                    // Process only interfaces, not properties
                    if (intf.direction === undefined) return;
                    if (!Object.keys(stateOutputs).includes(k)) {
                        errors.push(
                            `Interface '${intf.name}' of direction '${intf.direction}' ` +
                            `removed as it was not found in the dataflow.`,
                        );
                        this.removeOutput(k);
                    }
                });
                Object.entries(stateOutputs).forEach(([idA, intfA]) => {
                    const foundIntf = Object.entries(this.outputs).find(
                        ([idB, intfB]) => idB === idA && intfB.direction === intfA.direction,
                    );
                    if (foundIntf === undefined) {
                        const baklavaIntf = new NodeInterface(idA);
                        errors.push(
                            `Interface '${intfA.name}' of direction '${intfA.direction}' ` +
                            `created as it was not found in the specification.`,
                        );
                        Object.assign(baklavaIntf, intfA);
                        this.addInterface(baklavaIntf.direction, idA, baklavaIntf);
                    } else {
                        Object.assign(foundIntf[1], intfA);
                    }
                });
                return errors;
            };

            const updateProperties = (stateProperties) => {
                const errors = [];
                // Updating properties of a graph node
                Object.entries(this.inputs).forEach(([k, prop]) => {
                    // Process only properties, not interfaces
                    if (prop.direction !== undefined) return;
                    if (!Object.keys(stateProperties).includes(k)) {
                        errors.push(
                            `Property '${prop.name}' ` +
                            `removed as it was not found in the dataflow.`,
                        );
                        this.removeInput(k);
                    }
                });
                Object.entries(stateProperties).forEach(([idA, propA]) => {
                    if (propA.direction !== undefined) return;
                    const foundProp = Object.entries(this.inputs).find(
                        ([idB]) => idB === idA,
                    );
                    if (foundProp === undefined) {
                        const baklavaProp = new InputInterface(
                            propA.name,
                            propA.value,
                        ).setPort(false);
                        baklavaProp.componentName = 'InputInterface';
                        errors.push(
                            `Property '${propA.name}' ` +
                            `created as it was not found in the specification.`,
                        );
                        Object.assign(baklavaProp, propA);
                        this.addInput(idA, baklavaProp);
                    }
                });
                return errors;
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

                    if (Array.isArray(parsedState) && parsedState.length) {
                        return parsedState.map((error) => `Node ${displayName} of id: ${this.id} invalid. ${error}`);
                    }
                }

                let errors = [];
                if (process.env.VUE_APP_SOFT_VALIDATION === 'true') {
                    errors = this.updateInterfaces(parsedState.inputs, parsedState.outputs);
                    errors = [...errors, ...updateProperties(parsedState.inputs)];
                    errors = errors.map((error) => `Node ${displayName} of id: ${this.id} invalid. ${error}`);
                } else {
                    errors = detectDiscrepancies(parsedState, this.inputs, this.outputs);
                    if (Array.isArray(errors) && errors.length) {
                        return errors.map((error) => `Node ${displayName} of id: ${this.id} invalid. ${error}`);
                    }
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

                // Assigning sides and sides Positions to interfaces
                Object.entries({
                    ...parsedState.inputs,
                    ...parsedState.outputs,
                    ...parsedState.enabledInterfaceGroups,
                }).forEach(([ioName, ioState]) => {
                    if (ioState.direction === 'input' || ioState.direction === 'inout') {
                        this.inputs[ioName].side = ioState.side;
                    } else if (ioState.direction === 'output') {
                        this.outputs[ioName].side = ioState.side;
                    }

                    if (ioState.direction === 'input' || ioState.direction === 'inout') {
                        this.inputs[ioName].sidePosition = ioState.sidePosition;
                    } else if (ioState.direction === 'output') {
                        this.outputs[ioName].sidePosition = ioState.sidePosition;
                    }
                });

                // Default position should be undefined instead of (0, 0) so that it can be set
                // by autolayout
                if (state.position === undefined) {
                    this.position = undefined;
                }
                return errors;
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
    const { inputs, outputs } = parseInterfaces(interfaces, [], [], true);

    const graphInputs = Object.values(inputs);
    const graphOutputs = Object.values(outputs);

    const parsedState = nodes.map(parseNodeState);
    const errorMessages = parsedState.filter((n) => Array.isArray(n) && n.length);

    if (errorMessages.length) {
        return errorMessages.map((error) => `Node '${type}' invalid. ${error}`);
    }

    const state = {
        id: type,
        nodes: parsedState,
        connections,
        inputs: graphInputs,
        outputs: graphOutputs,
        name,
    };

    return new GraphTemplate(state, editor);
}
