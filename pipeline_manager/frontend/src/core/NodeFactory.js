/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
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

import { updateInterfacePosition } from '../custom/CustomNode.js';
import { parseInterfaces, validateInterfaceGroups } from './interfaceParser.js';

import InputInterface from '../interfaces/InputInterface.js';
import ListInterface from '../interfaces/ListInterface.js';
import SliderInterface from '../interfaces/SliderInterface.js';
import HexInterface from '../interfaces/HexInterface.js';

/**
 * @param properties coming from the specification
 * @returns object that can be used to create properties or an array of errors
 * if any occurred.
 */
function parseProperties(properties) {
    const parsedProperties = {};
    const usedNames = new Set();
    const errors = [];

    properties.forEach((prop) => {
        if (prop.group !== undefined) {
            const parsedGroup = parseProperties(prop.group);
            if (Array.isArray(parsedGroup) && parsedGroup.length) {
                errors.push(...parsedGroup);
            }

            Object.entries(parsedGroup).forEach(([pgroupname]) => {
                if (usedNames.has(pgroupname)) {
                    const realname = pgroupname.slice(pgroupname.indexOf('_') + 1);
                    errors.push(
                        `Property named '${realname}' in a group property '${prop.name}' is a duplicate.`,
                    );
                }
                usedNames.add(pgroupname);
            });

            prop.group = parsedGroup; // eslint-disable-line no-param-reassign
        }

        if (usedNames.has(`property_${prop.name}`)) {
            errors.push(
                `Property named '${prop.name}' is a duplicate.`,
            );
        }

        parsedProperties[`property_${prop.name}`] = { ...prop };
        usedNames.add(`property_${prop.name}`);
    });

    if (errors.length) {
        return errors;
    }

    return parsedProperties;
}

/**
 * @param properties that are validated and parsed
 * @returns created properties
 */
function createProperties(properties) {
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
            case 'hex':
                intf = new HexInterface(
                    propName,
                    propDef.toLowerCase(),
                    p.min ? BigInt(p.min) : NaN,
                    p.max ? BigInt(p.max) : NaN,
                ).setPort(false);
                intf.componentName = 'HexInterface';
                break;
            case 'select': {
                const it = p.values.map((element) => element.toString());
                intf = new SelectInterface(propName, propDef, it).setPort(false);
                intf.componentName = 'SelectInterface';
            } break;
            case 'bool':
                intf = new CheckboxInterface(propName, propDef).setPort(false);
                intf.componentName = 'CheckboxInterface';
                break;
            case 'slider':
                if (propDef === undefined) {
                    propDef = p.min;
                }
                intf = new SliderInterface(propName, propDef, p.min, p.max, p.step).setPort(
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
            intf.type = propType;
        }

        return intf;
    };

    const tempProperties = {};

    Object.entries(properties).forEach(([pname, p]) => {
        if (p.group !== undefined) {
            tempProperties[pname] = (() => {
                const groupedProperty = getIntf(p);
                groupedProperty.group = Object.keys(p.group);
                return groupedProperty;
            });
            Object.entries(p.group).forEach(([pgroupname, pgroup]) => {
                tempProperties[pgroupname] = () => getIntf(pgroup);
            });
        } else {
            tempProperties[pname] = () => getIntf(p);
        }
    });
    return tempProperties;
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

    const checkType = (propType, value) => {
        switch (propType) {
            case 'constant':
            case 'select':
                return true;
            case 'text':
            case 'hex':
                return typeof value === 'string';
            case 'number':
            case 'integer':
            case 'slider':
                return typeof value === 'number';
            case 'bool':
                return typeof value === 'boolean';
            default:
                return false;
        }
    };

    // Checking for existence of interfaces defined
    Object.keys({
        ...parsedState.inputs,
        ...parsedState.outputs,
    }).forEach((ioName) => {
        const name = ioName.slice(ioName.indexOf('_') + 1);
        const direction = ioName.slice(0, ioName.indexOf('_'));
        if (
            !Object.prototype.hasOwnProperty.call(inputs, ioName) &&
            !Object.prototype.hasOwnProperty.call(outputs, ioName)
        ) {
            if (direction === 'property') {
                errors.push(`Property named '${name}' not found in specification!`);
            } else {
                errors.push(`Interface named '${name}' of direction '${direction}' not found in specification!`);
            }
        } else if (direction === 'property') {
            // Verifying property type defined in the node and the value passed
            const parsedValue = parsedState.inputs[ioName].value;
            const propertyType = inputs[ioName].type;
            if (!checkType(propertyType, parsedValue)) {
                errors.push(`Property '${name}' type mismatch! ${propertyType} expected, ${typeof parsedValue} found.`);
            } else if (propertyType === 'select' && !inputs[ioName].items.includes(parsedValue)) {
                errors.push(`Property '${name}' value mismatch! ${parsedValue} not found in ${inputs[ioName].items}`);
            }
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
 * @returns state that can be given to baklavajs, or an array of errors if any occurred
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
        const out = parseProperties(newState.properties);
        if (Array.isArray(out) && out.length) {
            return out;
        }

        newState.inputs = { ...newState.inputs, ...out };
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

    newState.title = newState.instanceName ?? '';
    delete newState.instanceName;

    newState.parsed = true;
    return newState;
}

/**
 * Class factory that creates a class for a custom Node that is described by the arguments.
 * It can be later registered so that the user can use it and save the editor.
 * `inputs`, `properties` and `outputs` formats are described in the documentation.
 *
 * @param {string} name Name of the block that is stored when saving
 * @param {string} layer Layer of the node
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
    layer,
    interfaces,
    properties,
    interfaceGroups,
    defaultInterfaceGroups,
    twoColumn,
    description = '',
    nodeExtends = [],
    nodeExtending = [],
    nodeSiblings = [],
) {
    const parsedInterfaces = parseInterfaces(interfaces, interfaceGroups, defaultInterfaceGroups);
    // If parsedInterfaces returns an array, it is an array of errors
    if (Array.isArray(parsedInterfaces) && parsedInterfaces.length) {
        return parsedInterfaces.map((error) => `Node ${name} invalid. ${error}`);
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

    const parsedProperties = parseProperties(properties);
    // If parsedProperties returns an array, it is an array of errors
    if (Array.isArray(parsedProperties) && parsedProperties.length) {
        return parsedProperties.map((error) => `Node ${name} invalid. ${error}`);
    }
    const createdProperties = createProperties(parsedProperties);

    const node = defineNode({
        type: name,

        inputs: {
            ...inputs,
            ...createdProperties,
        },
        outputs,

        /* eslint-disable no-param-reassign */
        onCreate() {
            this.description = description;
            this.extends = nodeExtends;
            this.extending = nodeExtending;
            this.siblings = nodeSiblings;
            this.layer = layer;
            this.parentSave = this.save;
            this.parentLoad = this.load;
            this.title = name;

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

                // checking if there is an interface with the same side position
                if (visible) {
                    updateInterfacePosition(this, intf, intf.side);
                }
                // It may also need a new sidePosition
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
                        if (!ioState.hidden) {
                            if (ioState.interfaces) {
                                // Enabled interface groups
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
                savedState.enabledInterfaceGroups = enabledInterfaceGroups;

                savedState.name = savedState.type;
                delete savedState.type;

                savedState.instanceName = savedState.title === '' ? undefined : savedState.title;
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

            this.updateProperties = (stateProperties) => {
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
                        return parsedState.map((error) => `Node ${name} of id: ${this.id} invalid. ${error}`);
                    }
                }

                let errors = [];
                if (process.env.VUE_APP_GRAPH_DEVELOPMENT_MODE === 'true') {
                    errors = this.updateInterfaces(parsedState.inputs, parsedState.outputs);
                    errors = [...errors, ...this.updateProperties(parsedState.inputs)];
                    errors = errors.map((error) => `Node ${name} of id: ${this.id} invalid. ${error}`);
                } else {
                    errors = detectDiscrepancies(parsedState, this.inputs, this.outputs);
                    if (Array.isArray(errors) && errors.length) {
                        return errors.map((error) => `Node ${name} of id: ${this.id} invalid. ${error}`);
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

                const occupied = { left: [], right: [] };

                const stateios = { ...parsedState.inputs, ...parsedState.outputs };

                // Assigning sides and sides Positions to interfaces
                Object.entries(stateios).forEach(([ioName, ioState]) => {
                    if (ioState.direction === 'input' || ioState.direction === 'inout') {
                        this.inputs[ioName].side = ioState.side;
                        this.inputs[ioName].sidePosition = ioState.sidePosition;
                        occupied[ioState.side].push(ioState.sidePosition);
                    } else if (ioState.direction === 'output') {
                        this.outputs[ioName].side = ioState.side;
                        this.outputs[ioName].sidePosition = ioState.sidePosition;
                        occupied[ioState.side].push(ioState.sidePosition);
                    }
                });

                const refreshSidePositions = (entries) => {
                    // When state provided in the graph is incomplete, e.g. it misses
                    // an interface, we allow it.
                    // This, however, requires from us that we make sure that newly added
                    // interfaces (not present in parsedState) are not on conflicting positions
                    Object.entries(entries).forEach(([ioName, ioState]) => {
                        if (ioName.startsWith('property_')) return;
                        // if interface was explicitly defined in the graph file, skip it
                        if (ioName in stateios) return;
                        // otherwise, if the interface was implicitly created but it does not
                        // cover existing interface, skip it
                        if (!occupied[ioState.side].includes(ioState.sidePosition)) return;
                        // if the positions are clashing, pick first available max position on
                        // given side
                        const maxposition = Math.max(...occupied[ioState.side]);
                        ioState.sidePosition = maxposition + 1;
                        occupied[ioState.side].push(maxposition + 1);
                    });
                };

                refreshSidePositions(this.inputs);
                refreshSidePositions(this.outputs);

                // Default position should be undefined instead of (0, 0) so that it can be set
                // by autolayout
                if (state.position === undefined) {
                    this.position = undefined;
                }
                return errors;
            };

            this.twoColumn = twoColumn;
        },
        onDestroy() {
            [...Object.values(this.inputs), ...Object.values(this.outputs)].forEach((io) => {
                Object.values(io.events).forEach((event) => {
                    // We need to unsubscribe from all events to avoid memory leaks
                    // On token mismatch, the event will not be unsubscribed
                    event.unsubscribe(io);
                });
            });
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
 * @param editor PipelineManagerEditor instance
 * @returns Graph template that will be used to define the subgraph node
 */
export function SubgraphFactory(nodes, connections, interfaces, name, editor) {
    const { inputs, outputs } = parseInterfaces(interfaces, [], [], true);

    const graphInputs = Object.values(inputs);
    const graphOutputs = Object.values(outputs);

    const parsedState = nodes.map(parseNodeState);
    const errorMessages = parsedState.filter((n) => Array.isArray(n) && n.length);

    if (errorMessages.length) {
        return errorMessages.map((error) => `Node '${name}' invalid. ${error}`);
    }

    const state = {
        name,
        nodes: parsedState,
        connections,
        inputs: graphInputs,
        outputs: graphOutputs,
    };

    return new GraphTemplate(state, editor);
}
