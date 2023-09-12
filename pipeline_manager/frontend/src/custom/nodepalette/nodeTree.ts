/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import { useViewModel } from '@baklavajs/renderer-vue';
import { INodeTypeInformation } from '@baklavajs/core';
import { watch, Ref, WatchStopHandle } from 'vue';
import fuzzysort from 'fuzzysort';

/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
    SUBGRAPH_INPUT_NODE_TYPE,
    SUBGRAPH_OUTPUT_NODE_TYPE,
    SUBGRAPH_INOUT_NODE_TYPE, // @ts-ignore
} from '../subgraphInterface.js'; // @ts-ignore
import checkRecursion from './checkRecursion.js';

interface NodeURL {
    icon: string,
    name: string,
    url: string,
}

interface NodeType extends INodeTypeInformation {
    mask: boolean,
    hitSubstring: string,
    isCategory: boolean,
    iconPath: string,
    URLs: NodeURL,
}

interface Nodes {
    categoryName: string;
    nodeTypes: Record<string, NodeType>;
}

interface CategoryTree {
    [key: string]: CategoryTree | Record<string, never>;
}

interface NodeSubcategories {
    [key: string]: NodeCategory // eslint-disable-line no-use-before-define
}

interface NodeCategory {
    subcategories: NodeSubcategories,
    nodes: Nodes | Record<string, never>,
    // For now it is assumed there there is only one category node
    categoryNodes: Nodes | Record<string, never>,
    hitSubstring: string,
    mask: boolean,
}

/**
 * Creates a tree of categories based on the passed names of categories.
 *
 * @param Set of categories names of the nodes
 * @returns Tree of parsed categories that represents categories and their subcategories structure
 */
const parseCategories = (categoriesNames: Set<string>) => {
    const categoryTree: CategoryTree = {};
    const toParse: Record<string, Array<string>> = {};

    categoriesNames.forEach((c) => {
        const [label, ...rest] = c.split('/');
        if (!(label in categoryTree)) {
            toParse[label] = [];
        }
        if (rest.length > 0) {
            toParse[label].push(rest.join('/'));
        }
    });

    Object.entries(toParse).forEach(([label, rest]) => {
        categoryTree[label] = parseCategories(new Set(rest));
    });

    return categoryTree;
};

/* eslint-disable no-param-reassign */
/**
 * Sets `hitSubstring` value of all nodes of a given category to default names.
 * @param category Single category entry
 */
const setDefaultNames = (category: [string, NodeCategory]) => {
    const [categoryName, categoryNode] = category;
    categoryNode.hitSubstring = categoryName;
    if (categoryNode.nodes.nodeTypes !== undefined) {
        Object.entries(categoryNode.nodes.nodeTypes).forEach(([, nodeType]) => {
            nodeType.hitSubstring = nodeType.title;
        });
    }

    Object.entries(categoryNode.subcategories).forEach((subTree) => setDefaultNames(subTree));
};

/* eslint-disable no-param-reassign */
/**
 * Sets in place all masks inside nodes and subcategories to true
 * @param category Single category object
 */
const setMasksToTrue = (category: NodeCategory) => {
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
 * @param categoryTree Parsed tree returned by `parseCategories` function. It is used to divide
 * nodes into subcategories.
 * @param nodes list of nodes that has information about their types and icons created
 * in `getNodeTree` function.
 * @param prefix represents category path of a node.
 * @returns Parsed structure where every node has two keys: `nodes`, which represents nodes of
 * a given category and `subcategories` which represent subcategories. Subcategories are
 * also of this type.
 */
const categorizeNodes = (categoryTree: CategoryTree, nodes: Array<Nodes>, prefix = '') => {
    const nodeTree: NodeSubcategories = {};
    Object.entries(categoryTree).forEach(([category, subcategories]) => {
        let name = '';
        if (prefix === '') {
            name = category;
        } else {
            name = `${prefix}/${category}`;
        }

        const hitNodes = nodes.find((n) => n.categoryName === name) ?? {};
        if (Object.keys(hitNodes).length !== 0) {
            const categoryNames: Array<string> = [];
            Object.entries((hitNodes as Nodes).nodeTypes).forEach(([nameNodeType, nodeType]) => {
                if (nodeType.isCategory) {
                    categoryNames.push(nameNodeType);
                }
            });
            const allNames: Array<string> = Object.keys((hitNodes as Nodes).nodeTypes);

            const nonCategoryNodes: Nodes = {
                categoryName: (hitNodes as Nodes).categoryName,
                nodeTypes: {},
            };

            const categoryNodes: Nodes = {
                categoryName: (hitNodes as Nodes).categoryName,
                nodeTypes: {},
            };

            allNames.forEach((nodeName) => {
                if (categoryNames.includes(nodeName)) {
                    categoryNodes.nodeTypes[nodeName] = (hitNodes as Nodes).nodeTypes[nodeName];
                } else {
                    nonCategoryNodes.nodeTypes[nodeName] = (hitNodes as Nodes).nodeTypes[nodeName];
                }
            });

            nodeTree[category] = {
                subcategories: categorizeNodes(subcategories, nodes, name),
                nodes: nonCategoryNodes,
                categoryNodes,
                hitSubstring: category,
                mask: true,
            };
        } else {
            nodeTree[category] = {
                subcategories: categorizeNodes(subcategories, nodes, name),
                nodes: {},
                categoryNodes: {},
                hitSubstring: category,
                mask: true,
            };
        }
    });

    return nodeTree;
};

/**
 *
 * Updates masks of all nodes and subcategories based on filter value.
 * The node is shown if filter is a substring of the name.
 * Category is shown if it contains at least one node in the subtree which is
 * shown or if filter is a substring of the category name
 *
 * @param treeNode NodeSubcategories instance.
 * @param filter String which is used for filtering
 * @returns Boolean value whether at least one of the categories in the tree has
 * mask set to true.
 */
const updateMasks = (treeNode: NodeSubcategories, filter: string): boolean =>
    Object.entries(treeNode).map(([categoryName, node]) => {
        const categoryResult = fuzzysort.single(filter, categoryName);

        if (categoryResult !== null) {
            setMasksToTrue(node);
            node.hitSubstring = fuzzysort.highlight(categoryResult, '<span>', '</span>') ?? '';
        } else {
            node.hitSubstring = categoryName;
        }

        if (node.nodes.nodeTypes !== undefined) {
            node.mask = Object.values(node.nodes.nodeTypes)
                .map((nt) => {
                    const threshold = -50;
                    const entryResult = fuzzysort.single(filter, nt.title);
                    nt.mask = (
                        (entryResult !== null && entryResult.score > threshold) ||
                        (categoryResult !== null && categoryResult.score > threshold)
                    );
                    if (entryResult !== null) {
                        nt.hitSubstring = fuzzysort.highlight(entryResult, '<span>', '</span>') ?? '';
                    } else {
                        nt.hitSubstring = nt.title;
                    }
                    return nt.mask;
                })
                .includes(true);
        } else {
            node.mask = false;
        }

        node.mask = updateMasks(node.subcategories, filter) || node.mask;
        return node.mask;
    }).includes(true);

/* eslint-enable no-param-reassign */
let unWatch: WatchStopHandle;

export default function getNodeTree(nameFilterRef: Ref<string>) {
    const { viewModel } = useViewModel();
    const { editor } = viewModel.value;

    const nodeTypeEntries = Array.from(editor.nodeTypes.entries());
    const categoryNames = new Set(nodeTypeEntries.map(([, ni]) => ni.category));

    const nodes: Array<Nodes> = [];
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
                const [nodeType] = n; // @ts-ignore Editor has an incorrect type. Ignoring for now
                const URLs = editor.getNodeURLs(nodeType);
                return [nodeType, URLs];
            }),
        );

        const nodesIconPath = Object.fromEntries(
            nodeTypesInCategory.map((n) => {
                const [nodeType] = n; // @ts-ignore Editor has an incorrect type. Ignoring for now
                const iconPath = editor.getNodeIconPath(nodeType);
                return [nodeType, iconPath];
            }),
        );

        if (nodeTypesInCategory.length > 0) {
            const nodeTypes: Array<[string, NodeType]> = nodeTypesInCategory.map(
                ([nodeName, node]) =>
                    [nodeName, {
                        ...node, // @ts-ignore
                        isCategory: node.isCategory, // nodeTypes has an incorrect type, Ignoring
                        mask: true,
                        hitSubstring: node.title,
                        iconPath: nodesIconPath[nodeName],
                        URLs: nodesURLs[nodeName],
                    }],
            );

            nodes.push({
                categoryName: c,
                nodeTypes: Object.fromEntries(nodeTypes),
            });
        }
    });

    const nodeCategories = new Set(nodes.map((c) => c.categoryName));
    const categoryTree = parseCategories(nodeCategories);
    const parsedTree = categorizeNodes(categoryTree, nodes);

    // If specification changes we no longer want to watch it
    if (unWatch) {
        unWatch();
    }

    unWatch = watch(nameFilterRef, (newNameFilter) => {
        if (newNameFilter === '') {
            Object.entries(parsedTree).forEach((subTree) => setDefaultNames(subTree));
            Object.values(parsedTree).forEach((subTree) => setMasksToTrue(subTree));
        } else {
            updateMasks(parsedTree, newNameFilter.toLowerCase());
        }
    });

    return parsedTree;
}
