/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This module containes all possible JSON-RPC requests that frontend can
 * receive and process.
 *
 * Each exported function is automatically registered as JSON-RPC method
 * when JSON-RPC server is created in fetchRequest.
 * Function name have to match with specification (resources/api_specification).
 */

import { useViewModel } from '@baklavajs/renderer-vue';

/* eslint-disable import/prefer-default-export */
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Finds node of id `node_id` in graph of id `graph_id`.
 * An error with appropriate message is thrown if any error occurs.
 *
 * @param graph_id Id of a graph to find
 * @param node_id Id of a node to find
 * @returns found node
 */
function getNode(graph_id: string, node_id: string): any {
    const { viewModel } = useViewModel();
    const graph = [...viewModel.value.editor.graphs].find((g) => g.id === graph_id);

    if (graph === undefined) {
        throw new Error(`Graph with id '${graph_id}' does not exist.`);
    }

    const node = graph.nodes.find((n) => n.id === node_id);
    if (node === undefined) {
        throw new Error(`Node with id '${node_id}' does not exist.`);
    }
    return node;
}

/**
 * Finds property of id `id` or name `name` in node.
 * One of those values has to be defined.
 * An error with appropriate message is thrown if any error occurs.
 *
 * @param node Node instance that is searched
 * @param id id of the property
 * @param name name of the property
 * @returns found property
 */
function getProperty(node: any, id?: string, name?: string) {
    let prop;

    if (id !== undefined) {
        prop = Object.values(
            node.inputs,
        ).find((p : any) => p.id === id) as any;

        // If not property found or it is not a property, but an interface
        if (prop === undefined || prop.side !== undefined) {
            throw new Error(`Property with id '${id}' does not exist.`);
        }
    } else {
        prop = Object.values(
            node.inputs,
        ).find((p : any) => p.name === name) as any;

        // If not property found or it is not a property, but an interface
        if (prop === undefined || prop.side !== undefined) {
            throw new Error(`Property with name '${name}' does not exist.`);
        }
    }

    return prop;
}

type ModifyPropertiesParamsType = {
    graph_id: string,
    node_id: string,
    properties: {
        id?: string,
        name?: string,
        new_value: any,
    }[]
};

/**
 * Updates values of properties specified in `params`.
 * An error with appropriate message is thrown if any error occurs.
 */
export async function modify_properties(
    params: ModifyPropertiesParamsType,
): Promise<undefined> {
    const node = getNode(params.graph_id, params.node_id);

    // First iteration to validate that every property exists
    // eslint-disable-next-line no-restricted-syntax
    for (const property of params.properties) {
        getProperty(node, property.id, property.name);
    }

    // Second iteration to actually alter the values
    // eslint-disable-next-line no-restricted-syntax
    for (const property of params.properties) {
        const prop = getProperty(node, property.id, property.name);
        prop.value = property.new_value;
    }
}

type GetPropertiesParamsType = {
    graph_id: string,
    node_id: string,
    properties?: {
        id?: string,
        name?: string,
    }[],
};

type GetPropertiesReturnType = {
    id: string,
    name: string,
    value: any,
}[];

/**
 * Returns an array of properties specified in `params`.
 * An error with appropriate message is thrown if any error occurs.
 */
export async function get_properties(
    params: GetPropertiesParamsType,
): Promise<GetPropertiesReturnType> {
    const node = getNode(params.graph_id, params.node_id);

    const properties: GetPropertiesReturnType = [];

    if (params.properties === undefined) {
        // eslint-disable-next-line no-restricted-syntax
        for (const property of Object.values((node as any).inputs) as any) {
            if (property.side === undefined) {
                properties.push({
                    id: property.id,
                    name: property.name,
                    value: property.value,
                });
            }
        }

        return properties;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const property of params.properties) {
        const prop = getProperty(node, property.id, property.name);

        properties.push({
            id: prop.id,
            name: prop.name,
            value: prop.value,
        });
    }

    return properties;
}

type GetNodeParamsType = {
    graph_id: string,
    node_id: string,
};

/**
 * Returns a serialized node state specified in `params`.
 * An error with appropriate message is thrown if any error occurs.
 */
export async function get_node(
    params: GetNodeParamsType,
): Promise<{ node: any }> {
    const node = getNode(params.graph_id, params.node_id);

    return {
        node: node.save(),
    };
}

/**
 * Sets width of progress bar.
 */
export function progress(params: {progress: number}) {
    const progressBar = document.querySelector<HTMLDivElement>('.progress-bar');
    if (!progressBar) throw new Error('Progress bar does not exist');
    if (params.progress > 100 || params.progress < 0) throw new Error(`Progress has to be in [0, 100]. Received: ${params.progress}`);
    progressBar.style.width = `${params.progress}%`;
}
