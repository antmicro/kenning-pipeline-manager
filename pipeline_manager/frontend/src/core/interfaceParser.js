/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Returns a prepared interface that is passed to baklava contructor
 *
 * @param io configuration of the interface
 * @param hidden whether th interface should be hidden. For example groups of interfaces
 * are hidden by default
 * @param {*} name custom name for the interface that should be used instead of the one coming
 * from `io`
 * @returns baklava interface constructor
 */
function createInterface(io, hidden, name = undefined) {
    const intf = {};
    Object.assign(intf, io);

    intf.name = name ?? io.name;
    if (intf.type !== undefined) {
        intf.type = typeof io.type === 'string' || io.type instanceof String ? [io.type] : io.type;
    }
    intf.componentName = 'NodeInterface';
    intf.hidden = hidden;

    // Readonly values used for detecting whether there were any changes to the interface
    intf.originalSide = intf.side;
    intf.originalSidePosition = intf.sidePosition;
    return intf;
}

/**
 * Returns a prepared graph interface state that is passed to baklava contructor
 *
 * @param io configuration of the interface
 * @param hidden whether th interface should be hidden. For example groups of interfaces
 * are hidden by default
 * @param {*} name custom name for the interface that should be used instead of the one coming
 * from `io`
 * @returns baklava interface constructor
 */
function createGraphInterface(io, hidden, name = undefined) {
    const intf = {};

    Object.assign(intf, io);
    intf.name = name ?? io.name;
    intf.id = io.id ?? uuidv4();
    if (intf.type !== undefined) {
        intf.type = typeof io.type === 'string' || io.type instanceof String ? [io.type] : io.type;
    }

    intf.nodePosition = io.nodePosition ?? { x: 0, y: 0 };

    // Readonly values used for detecting whether there were any changes to the interface
    intf.originalSide = intf.side;
    intf.originalSidePosition = intf.sidePosition;
    return intf;
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
                        `Interface named '${name}' of direction '${io.direction}' is a duplicate.`,
                    );
                }
                tempParsed[io.direction][`${io.name}[${j}]`] = io;
            }
        } else {
            if (tempParsed[io.direction][io.name] !== undefined) {
                errors.push(
                    `Interface named '${io.name}' of direction '${io.direction}' is a duplicate.`,
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
                    `Interface named '${name}' of direction '${state.direction}' ` +
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
 * @returns list tuples that have information about conflicting interfaces.
 */
export function validateInterfaceGroupsNames(enabledInterfaceGroups, inputs, outputs) {
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

                errors.push([parsedIntfName, intfDirection, groupName, groupDirection]);
            } else {
                usedInterfaces.add(intfName);
            }
        });
    });
    return errors;
}

/**
 * Checks whether interface groups that are in enabledInterfaceGroup
 * can be enabled at the same time
 * @param {array} enabledInterfaceGroups array of names of enabled interface groups
 * @param {*} inputs inputs of the node
 * @param {*} outputs outputs of the node
 * @returns list of explicit errors.
 */
export function validateInterfaceGroups(enabledInterfaceGroups, inputs, outputs) {
    const errors = validateInterfaceGroupsNames(enabledInterfaceGroups, inputs, outputs);
    const errorMessages = [];

    errors.forEach(([parsedIntfName, intfDirection, groupName, groupDirection]) => {
        errorMessages.push(
            `Interface of name '${parsedIntfName}' and direction '${intfDirection}' has been reused ` +
                `by interface group named '${groupName}' of direction '${groupDirection}'. ` +
                `Make sure your interface groups are disjoint.`,
        );
    });

    return errorMessages;
}

/**
 *
 * @param {*} inputs inputs of the node
 * @param {*} outputs outputs of the node
 * @returns inputs and outputs of the nodes with `sidePositions` assigned if
 * there were no errors found. Otherwise a list of errors is returned.
 */
export function applySidePositions(inputs, outputs) {
    const tempParsedSides = {
        left: {},
        right: {},
    };

    const errors = [];

    // Dividing interfaces into left and right sides
    Object.entries({ ...inputs, ...outputs }).forEach(([name, intf]) => {
        if (intf.side === 'right' || (intf.side === undefined && intf.direction === 'output')) {
            tempParsedSides.right[name] = { ...intf };
            tempParsedSides.right[name].side = 'right';
        } else if (intf.side === 'left' || (intf.side === undefined && (intf.direction === 'input' || intf.direction === 'inout'))) {
            tempParsedSides.left[name] = { ...intf };
            tempParsedSides.left[name].side = 'left';
        }
    });

    const stripName = (name) => name.slice(name.indexOf('_') + 1);

    // validating and setting sidePositions
    const occupiedInputSidePositions = new Set();
    const occupiedOutputSidePositions = new Set();

    Object.entries(tempParsedSides.left).forEach(([name, intf]) => {
        if (intf.sidePosition !== undefined) {
            if (occupiedInputSidePositions.has(intf.sidePosition)) {
                errors.push(
                    `Interface named '${stripName(name)}' of direction '${intf.direction}' has ` +
                        `invalid sidePosition value '${intf.sidePosition}'. ` +
                        `There already exists an input or output with this sidePosition.`,
                );
            }
            occupiedInputSidePositions.add(intf.sidePosition);
        }
    });

    Object.entries(tempParsedSides.right).forEach(([name, intf]) => {
        if (intf.sidePosition !== undefined) {
            if (occupiedOutputSidePositions.has(intf.sidePosition)) {
                errors.push(
                    `Interface named '${stripName(name)}' of direction '${intf.direction}' has ` +
                        `invalid sidePosition value '${intf.sidePosition}'. ` +
                        `There already exists an input or output with this sidePosition.`,
                );
            }
            occupiedOutputSidePositions.add(intf.sidePosition);
        }
    });

    if (errors.length) {
        return errors;
    }

    let leftSidePositionIndex = 0;
    let rightSidePositionIndex = 0;

    const getLeftSidePos = (intf) => {
        if (intf.sidePosition === undefined) {
            while (occupiedInputSidePositions.has(leftSidePositionIndex)) {
                leftSidePositionIndex += 1;
            }
            occupiedInputSidePositions.add(leftSidePositionIndex);
            return leftSidePositionIndex;
        }
        return intf.sidePosition;
    };

    const getRightSidePos = (intf) => {
        if (intf.sidePosition === undefined) {
            while (occupiedOutputSidePositions.has(rightSidePositionIndex)) {
                rightSidePositionIndex += 1;
            }
            occupiedOutputSidePositions.add(rightSidePositionIndex);
            return rightSidePositionIndex;
        }
        return intf.sidePosition;
    };

    Object.entries(tempParsedSides.left).forEach(([, intf]) => {
        intf.sidePosition = getLeftSidePos(intf); // eslint-disable-line no-param-reassign,max-len
    });

    Object.entries(tempParsedSides.right).forEach(([, intf]) => {
        intf.sidePosition = getRightSidePos(intf); // eslint-disable-line no-param-reassign,max-len
    });

    return {
        inputs: Object.fromEntries(
            Object.entries({ ...tempParsedSides.left, ...tempParsedSides.right })
                .filter(([, intf]) => intf.direction === 'input' || intf.direction === 'inout'),
        ),
        outputs: Object.fromEntries(
            Object.entries({ ...tempParsedSides.left, ...tempParsedSides.right })
                .filter(([, intf]) => intf.direction === 'output'),
        ),
    };
}

/**
 * @param {*} interfaces List of interfaces in the block (input, output and inout)
 * @param {*} interfaceGroups Object describing groups of interfaces'
 * @param {*} defaultInterfaceGroups Object describing groups of interfaces that are enabled
 * @returns object that has inputs and outputs key if parsing was successful,
 * a list of errors otherwise.
 */
export function parseInterfaces(
    interfaces,
    interfaceGroups,
    defaultInterfaceGroups,
    subgraphInterfaces = false,
) {
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
                            `Interface named '${intf.name}[${j}]' of direction '${intf.direction}' ` +
                                `used for interface group '${intfG.name}' of direction ` +
                                `'${intfG.direction}' does not exist.`,
                        );
                    }
                }
            } else {
                const name = `${intf.direction}_${intf.name}`;
                if (!Object.keys({ ...tempParsed.input, ...tempParsed.output }).includes(name)) {
                    errors.push(
                        `Interface named '${intf.name}' of direction '${intf.direction}' ` +
                            `used for interface group '${intfG.name}' of direction ` +
                            `'${intfG.direction}' does not exist.`,
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

    // Interfaces that belong to groups are removed as they should not have side
    // positions applied as they are never rendered
    tempParsed.input = Object.fromEntries(Object.entries(tempParsed.input).filter(
        ([name]) => !interfacesCreatingGroups.has(name),
    ));

    tempParsed.output = Object.fromEntries(Object.entries(tempParsed.output).filter(
        ([name]) => !interfacesCreatingGroups.has(name),
    ));

    const parsedSides = applySidePositions(
        { ...tempParsed.input, ...tempParsedGroups.input },
        { ...tempParsed.output, ...tempParsedGroups.output },
    );
    if (Array.isArray(parsedSides) && parsedSides.length) {
        return parsedSides;
    }

    const interfaceCreater = subgraphInterfaces ? createGraphInterface : createInterface;

    const stripName = (name) => name.slice(name.indexOf('_') + 1);

    const createdInterfaces = {
        inputs: {},
        outputs: {},
    };

    // Filtering single interfaces that are part of interface groups
    // Those interfaces are removed as they are never rendered
    // This is only used when parsing a specification format
    Object.entries(parsedSides.inputs).forEach(([name, intf]) => {
        // It is an interface group
        if (intf.interfaces !== undefined) {
            // Adding interfaces groups, hidden by default
            createdInterfaces.inputs[name] = interfaceCreater(
                intf,
                !enabledInterfaceGroupsNames.includes(name),
                stripName(name),
            );
        } else {
            createdInterfaces.inputs[name] = interfaceCreater(
                intf,
                false,
                stripName(name),
            );
        }
    });

    Object.entries(parsedSides.outputs).forEach(([name, intf]) => {
        // It is an interface group
        if (intf.interfaces !== undefined) {
            // Adding interfaces groups, hidden by default
            createdInterfaces.outputs[name] = interfaceCreater(
                intf,
                !enabledInterfaceGroupsNames.includes(name),
                stripName(name),
            );
        } else {
            createdInterfaces.outputs[name] = interfaceCreater(
                intf,
                false,
                stripName(name),
            );
        }
    });

    return createdInterfaces;
}
