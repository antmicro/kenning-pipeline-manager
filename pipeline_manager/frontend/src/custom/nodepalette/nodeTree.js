/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useViewModel } from 'baklavajs';
import {
    SUBGRAPH_INPUT_NODE_TYPE,
    SUBGRAPH_OUTPUT_NODE_TYPE,
    SUBGRAPH_INOUT_NODE_TYPE,
} from '../subgraphInterface';
import checkRecursion from './checkRecursion';

/**
 * Creates a tree of categories based on the passed names of categories.
 *
 * @param {Set} Set of categories names of the nodes
 * @returns Tree of parsed categories that represents categories and their subcategories structure
 */
const parseCategories = (categoriesNames) => {
    const categoryTree = {};
    categoriesNames.forEach((c) => {
        const [label, ...rest] = c.split('/');
        if (!(label in categoryTree)) {
            categoryTree[label] = [];
        }
        if (rest.length > 0) {
            categoryTree[label].push(rest.join('/'));
        }
    });

    Object.entries(categoryTree).forEach(([label, rest]) => {
        categoryTree[label] = parseCategories(new Set(rest));
    });

    return categoryTree;
};

/**
 * Uses parsed categories structure to create a full tree of nodes based on their categories
 * which can be used to render then in a node palette.
 *
 * @param {*} categoryTree Parsed tree returned by `parseCategories` function. It is used to divide
 * nodes into subcategories.
 * @param {*} nodes list of nodes that has information about their types and icons created
 * in `getNodeTree` function.
 * @param {*} prefix represents cagegory path of a node.
 * @returns Parsed structure where every node has two keys: `nodes`, which represents nodes of
 * a given category and `subcategories` which represent subcategories. Subcategories are
 * also of this type.
 */
const categorizeNodes = (categoryTree, nodes, prefix = '') => {
    const nodeTree = {};
    Object.entries(categoryTree).forEach(([category, subcategories]) => {
        let name = '';
        if (prefix === '') {
            name = category;
        } else {
            name = `${prefix}/${category}`;
        }

        if (subcategories) {
            nodeTree[category] = {
                subcategories: categorizeNodes(subcategories, nodes, name),
            };
        }

        const nodeTypesInCategory = nodes.find((n) => n.name === name);
        nodeTree[category].nodes = nodeTypesInCategory ?? {};
    });
    return nodeTree;
};

export default function getNodeTree() {
    const { viewModel } = useViewModel();
    const { editor } = viewModel.value;

    const nodeTypeEntries = Array.from(editor.nodeTypes.entries());
    const categoryNames = new Set(nodeTypeEntries.map(([, ni]) => ni.category));

    const nodes = [];
    categoryNames.forEach((c) => {
        let nodeTypesInCategory = nodeTypeEntries.filter(([, ni]) => ni.category === c);
        if (viewModel.value.displayedGraph.template) {
            // don't show the graph nodes that directly or indirectly contain
            // the current subgraph to prevent recursion
            nodeTypesInCategory = nodeTypesInCategory.filter(
                ([nt]) => !checkRecursion(editor, viewModel.value.displayedGraph, nt),
            );
        } else {
            // if we are not in a subgraph, don't show subgraph input & output nodes
            nodeTypesInCategory = nodeTypesInCategory.filter(
                ([nt]) =>
                    ![
                        SUBGRAPH_INPUT_NODE_TYPE,
                        SUBGRAPH_OUTPUT_NODE_TYPE,
                        SUBGRAPH_INOUT_NODE_TYPE,
                    ].includes(nt),
            );
        }

        // Filter out nodes added by baklava
        nodeTypesInCategory = nodeTypesInCategory.filter(
            ([nt]) => !['__baklava_SubgraphInputNode', '__baklava_SubgraphOutputNode'].includes(nt),
        );

        const nodesURLs = nodeTypesInCategory.map((n) => {
            const [nodeType] = n;
            const URLs = editor.getNodeURLs(nodeType);
            return URLs;
        });

        const nodesIconPath = nodeTypesInCategory.map((n) => {
            const [nodeType] = n;
            const iconPath = editor.getNodeIconPath(nodeType);
            return iconPath;
        });

        if (nodeTypesInCategory.length > 0) {
            nodes.push({
                name: c,
                nodeTypes: Object.fromEntries(nodeTypesInCategory),
                nodeIconPaths: nodesIconPath,
                nodeURLs: nodesURLs,
            });
        }
    });

    console.log(nodes);

    const nodeCategories = new Set(nodes.map((c) => c.name));
    const categoryTree = parseCategories(nodeCategories);

    return categorizeNodes(categoryTree, nodes);
}
