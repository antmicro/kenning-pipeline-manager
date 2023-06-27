/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useViewModel } from 'baklavajs';
import { watch } from 'vue';
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

/* eslint-disable no-param-reassign */
/**
 * Sets in place all masks inside nodes and subcategories to true
 * @param category Single category object
 */
const setMasksToTrue = (category) => {
    category.mask = true;
    if (category.nodes.nodeTypes !== undefined) {
        Object.values(category.nodes.nodeTypes).forEach((nodeType) => {
            nodeType.mask = true;
        });
    }

    Object.values(category.subcategories).forEach((subTree) => setMasksToTrue(subTree));
};

/**
 * Uses parsed categories structure to create a full tree of nodes based on their categories
 * which can be used to render then in a node palette.
 *
 * @param {*} categoryTree Parsed tree returned by `parseCategories` function. It is used to divide
 * nodes into subcategories.
 * @param {*} nodes list of nodes that has information about their types and icons created
 * in `getNodeTree` function.
 * @param {*} prefix represents category path of a node.
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
    Object.values(nodeTree).forEach((subTree) => setMasksToTrue(subTree));
    return nodeTree;
};

/**
 *
 * Updates masks of all nodes and subcategories based on filter value.
 * The node is shown if the lowercase name contains lowercase filter
 * Category is shown if it contains at least one node in the subtree which is
 * shown or if lowercase category name contains lowercase filter
 *
 * @param treeNode NodeTree instance.
 * @param filter String which is used for filtering
 * @returns Boolean value whether at least one of the categories in the tree has
 * mask set to true.
 */
const updateMasks = (treeNode, filter) =>
    Object.entries(treeNode)
        .map(([categoryName, node]) => {
            if (categoryName.toLowerCase().includes(filter.toLowerCase())) {
                setMasksToTrue(node);
                return true;
            }
            node.mask = updateMasks(node.subcategories, filter);
            if (node.nodes.nodeTypes !== undefined) {
                node.mask =
                    node.mask ||
                    Object.values(node.nodes.nodeTypes)
                        .map((nt) => {
                            nt.mask = nt.title.toLowerCase().includes(filter.toLowerCase());
                            return nt.mask;
                        })
                        .includes(true);
            }
            return node.mask;
        })
        .includes(true);
/* eslint-enable no-param-reassign */

export default function getNodeTree(nameFilterRef) {
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

        const nodesURLs = Object.fromEntries(
            nodeTypesInCategory.map((n) => {
                const [nodeType] = n;
                const URLs = editor.getNodeURLs(nodeType);
                return [nodeType, URLs];
            }),
        );

        const nodesIconPath = Object.fromEntries(
            nodeTypesInCategory.map((n) => {
                const [nodeType] = n;
                const iconPath = editor.getNodeIconPath(nodeType);
                return [nodeType, iconPath];
            }),
        );

        if (nodeTypesInCategory.length > 0) {
            nodes.push({
                name: c,
                nodeTypes: Object.fromEntries(nodeTypesInCategory),
                nodeIconPaths: nodesIconPath,
                nodeURLs: nodesURLs,
            });
        }
    });

    const nodeCategories = new Set(nodes.map((c) => c.name));
    const categoryTree = parseCategories(nodeCategories);

    const parsedTree = categorizeNodes(categoryTree, nodes);
    watch(nameFilterRef, (newNameFilter) => updateMasks(parsedTree, newNameFilter));

    return parsedTree;
}
