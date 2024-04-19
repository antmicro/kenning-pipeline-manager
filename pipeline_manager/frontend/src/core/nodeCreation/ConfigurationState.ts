import { reactive } from 'vue';

export type NodeDataConfiguration = {
    name: string,
    category: string,
    layer?: string,
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
});

/**
 * Configuration state for the node data.
 * It is used to store the node data that is being configured.
 * Namely, its type, category and layer.
 */
export const configurationState: {
    nodeData?: NodeDataConfiguration,
} = { nodeData: undefined };
