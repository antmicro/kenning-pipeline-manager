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
    NodeInterface,
    TextInterface,
    defineNode,
    setType,
    NodeInterfaceType,
} from 'baklavajs';

import InputInterface from '../interfaces/InputInterface';
import ListInterface from '../interfaces/ListInterface';
import SliderInterface from '../interfaces/SliderInterface';

function parseProperties(properties) {
    const tempInputs = {};
    properties.forEach((p) => {
        const propName = p.name;
        const propType = p.type;
        let propDef = p.default;

        switch (propType) {
            case 'constant':
                tempInputs[propName] = () => {
                    const intf = new TextInterface(propName, propDef).setPort(false);
                    intf.componentName = 'TextInterface';
                    return intf;
                };
                break;
            case 'text':
                tempInputs[propName] = () => {
                    const intf = new InputInterface(propName, propDef).setPort(false);
                    intf.componentName = 'InputInterface';
                    return intf;
                };
                break;
            case 'number':
                tempInputs[propName] = () => {
                    const intf = new NumberInterface(propName, propDef).setPort(false);
                    intf.componentName = 'NumberInterface';
                    return intf;
                };
                break;
            case 'integer':
                tempInputs[propName] = () => {
                    const intf = new IntegerInterface(propName, propDef).setPort(false);
                    intf.componentName = 'IntegerInterface';
                    return intf;
                };
                break;
            case 'select': {
                const it = p.values.map((element) => element.toString());
                tempInputs[propName] = () => {
                    const intf = new SelectInterface(propName, propDef, it).setPort(false);
                    intf.componentName = 'SelectInterface';
                    return intf;
                };
                break;
            }
            case 'checkbox':
                tempInputs[propName] = () => {
                    const intf = new CheckboxInterface(propName, propDef).setPort(false);
                    intf.componentName = 'CheckboxInterface';
                    return intf;
                };
                break;
            case 'slider':
                if (propDef === undefined) {
                    propDef = p.min;
                }
                tempInputs[propName] = () => {
                    const intf = new SliderInterface(propName, propDef, p.min, p.max).setPort(
                        false,
                    );
                    intf.componentName = 'SliderInterface';
                    return intf;
                };
                break;
            case 'list':
                tempInputs[propName] = () => {
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

function parseOutputs(outputs, interfaceTypes) {
    const tempOutputs = {};

    outputs.forEach((o) => {
        if (o.direction !== 'output') return;
        tempOutputs[o.name] = () => {
            const intf = new NodeInterface(o.name).use(setType, interfaceTypes[o.type]);
            intf.componentName = 'NodeInterface';
            intf.maxConnectionsCount = o.maxConnectionsCount;
            intf.direction = o.direction;
            intf.connectionSide = o.connectionSide ?? 'right';
            intf.interfaceConnectionPattern =
                interfaceTypes[o.type].interfaceConnectionPattern ?? 'solid';
            return intf;
        };
    });

    return tempOutputs;
}

function parseInputs(inputs, interfaceTypes) {
    const tempInputs = {};

    inputs.forEach((i) => {
        // TODO storing inouts currently in the same list as inputs (since they are already
        // handling other things than inputs, such as paramters)
        if (i.direction !== 'input' && i.direction !== 'inout') return;
        tempInputs[i.name] = () => {
            const intf = new NodeInterface(i.name).use(setType, interfaceTypes[i.type]);
            intf.componentName = 'NodeInterface';
            intf.maxConnectionsCount = i.maxConnectionsCount;
            intf.direction = i.direction;
            intf.connectionSide = i.connectionSide ?? 'left';
            intf.interfaceConnectionPattern =
                interfaceTypes[i.type].interfaceConnectionPattern ?? 'solid';
            return intf;
        };
    });

    return tempInputs;
}

/**
 * Class factory that creates a class for a custom Node that is described by the arguments.
 * It can be later registered so that the user can use it and save the editor.
 * `inputs`, `properties` and `outputs` formats are described in the documentation.
 *
 * @param {string} name Name of the block that is stored when saving
 * @param {string} displayName Name of the block displayed to the user
 * @param {*} interfaces List of interfaces in the block (input, output and inout)
 * @param {*} properties List of properties of the block
 * @param {*} interfaceTypes ReadInterfaceTypes of the specification
 * @param {boolean} twoColumn type of layout of the nodes
 * @returns Node based class
 */
export function NodeFactory(name, displayName, interfaces, properties, interfaceTypes, twoColumn) {
    const node = defineNode({
        type: name,

        title: displayName,

        outputs: parseOutputs(interfaces, interfaceTypes),
        inputs: { ...parseProperties(properties), ...parseInputs(interfaces, interfaceTypes) },

        /* eslint-disable no-param-reassign */
        onCreate() {
            this.parentSave = this.save;
            this.parentLoad = this.load;

            this.save = () => {
                const savedState = this.parentSave();

                const newProperties = [];
                const newInterfaces = [];

                Object.entries({ ...this.inputs }).forEach((io) => {
                    const [ioName, ioState] = io;

                    if (ioState.port) {
                        newInterfaces.push({
                            name: ioName,
                            id: ioState.id,
                            direction: ioState.direction,
                        });
                    } else {
                        newProperties.push({
                            name: ioName,
                            id: ioState.id,
                            value: ioState.value === undefined ? null : ioState.value,
                        });
                    }
                });

                Object.entries({ ...this.outputs }).forEach((io) => {
                    const [ioName, ioState] = io;

                    if (ioState.port) {
                        newInterfaces.push({
                            name: ioName,
                            id: ioState.id,
                            direction: ioState.direction,
                        });
                    } else {
                        newProperties.push({
                            name: ioName,
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
                state.inputs = {};
                state.outputs = {};

                state.interfaces.forEach((intf) => {
                    if (intf.direction === 'input' || intf.direction === 'inout') {
                        state.inputs[intf.name] = { id: intf.id };
                    } else if (intf.direction === 'output') {
                        state.outputs[intf.name] = { id: intf.id };
                    }
                });

                state.properties.forEach((prop) => {
                    state.inputs[prop.name] = { id: prop.id, value: prop.value };
                });

                delete state.properties;
                delete state.interfaces;

                if ('name' in state) {
                    state.title = state.name;
                } else {
                    state.title = '';
                }
                delete state.name;

                this.parentLoad(state);
            };

            this.twoColumn = twoColumn;
        },
    });

    return node;
}

/**
 * Function that reads all nodes in the specification and creates `NodeInterfaceType` objects for
 * their inputs' and outputs' types so that a simple validation based on those
 * types can be performed.
 *
 * The read interface types are stored in `interfaceTypes` object which is returned by this function
 * @param {*} nodes nodes of the specification
 * @param {*} metadata metadata containing information about styling
 * @returns read interface types
 */
export function readInterfaceTypes(nodes, metadata) {
    const interfaceTypes = {};

    nodes.forEach((node) => {
        [...node.interfaces].forEach((io) => {
            if (!Object.prototype.hasOwnProperty.call(interfaceTypes, io.type)) {
                interfaceTypes[io.type] = new NodeInterfaceType(io.type);
                if ('interfaces' in metadata && io.type in metadata.interfaces) {
                    interfaceTypes[io.type].interfaceConnectionPattern =
                        metadata.interfaces[io.type].interfaceConnectionPattern ?? 'solid';
                }
            }
        });
    });

    return interfaceTypes;
}
