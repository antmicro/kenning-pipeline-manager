/*
 * Copyright (c) 2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { reactive } from 'vue';

export type NodeDataConfiguration = {
    name: string,
    category: string,
    layer?: string,
    description?: string,
}

export type PropertyConfiguration = {
    name: string,
    type: string,
    default: string | number | boolean | null,
    min?: number,
    max?: number,
};

export type InterfaceConfiguration = {
    name: string,
    type?: string | string[],
    direction: string,
}

export type ConfigurationState = {
    editedType?: string,
    nodeData: NodeDataConfiguration,
    properties: PropertyConfiguration[],
    interfaces: InterfaceConfiguration[],
}

/**
 * Configuration state for the configuration menu.
 * This state is reactive and can be accessed and modified from any component.
 * It is used to control the visibility of the configuration menu and its options.
 */
export const menuState = reactive({
    configurationMenu: {
        visible: false,
        addNode: true,
    },
    propertyMenu: false,
    interfaceMenu: false,
    propertyListMenu: false,
    interfaceListMenu: false,
    layerMenu: false,
});

/**
 * Configuration state for the node data.
 * It is used to store the node data that is being configured.
 */
export const configurationState: ConfigurationState = reactive({
    nodeData: {
        name: 'Custom Node',
        category: 'Default category',
        layer: '',
        description: '',
    },
    properties: [],
    interfaces: [],
});
