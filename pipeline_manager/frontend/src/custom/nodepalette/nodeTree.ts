/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import { useViewModel } from '@baklavajs/renderer-vue';
import { INodeTypeInformation } from '@baklavajs/core';
import { watch, Ref, WatchStopHandle } from 'vue';
import fuzzysort from 'fuzzysort';
import EditorManager, { DEFAULT_GRAPH_NODE_TYPE, DEFAULT_CUSTOM_NODE_TYPE } from '../../core/EditorManager';

/* eslint-disable @typescript-eslint/ban-ts-comment */
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
    categoryNode: NodeType | undefined,
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
        if (!Object.keys(toParse).includes(label)) {
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
    const [name, node] = category;
    node.hitSubstring = name;
    if (node.categoryNode !== undefined) {
        node.categoryNode.hitSubstring = node.categoryNode.title;
    }

    if (node.nodes.nodeTypes !== undefined) {
        Object.entries(node.nodes.nodeTypes).forEach(([, nodeType]) => {
            nodeType.hitSubstring = nodeType.title;
        });
    }

    Object.entries(node.subcategories).forEach((subTree) => setDefaultNames(subTree));
};

/* eslint-disable no-param-reassign */
/**
 * Sets in place all masks inside nodes and subcategories to true
 * @param category Single category object
 */
const setMasksToTrue = (category: NodeCategory) => {
    category.mask = true;
    if (category.categoryNode !== undefined) {
        category.categoryNode.mask = true;
    }

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

            let categoryNode;

            allNames.forEach((nodeName) => {
                if (categoryNames.includes(nodeName)) {
                    categoryNode = (hitNodes as Nodes).nodeTypes[nodeName];
                } else {
                    nonCategoryNodes.nodeTypes[nodeName] = (hitNodes as Nodes).nodeTypes[nodeName];
                }
            });

            nodeTree[category] = {
                subcategories: categorizeNodes(subcategories, nodes, name),
                nodes: nonCategoryNodes,
                categoryNode,
                hitSubstring: category,
                mask: true,
            };
        } else {
            nodeTree[category] = {
                subcategories: categorizeNodes(subcategories, nodes, name),
                nodes: {},
                categoryNode: undefined,
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
 * @param forceMask whether the whole substree should be expanded
 * @returns Boolean value whether at least one of the categories in the tree has
 * mask set to true.
 */
const updateMasks = (treeNode: NodeSubcategories, filter: string, forceMask: boolean): boolean =>
    Object.entries(treeNode).map(([categoryName, node]) => {
        const threshold = -50;

        let categoryMatches = false;
        const categoryResult = fuzzysort.single(filter, categoryName);
        if (categoryResult !== null && categoryResult.score > threshold) {
            node.hitSubstring = fuzzysort.highlight(categoryResult, '<span>', '</span>') ?? '';
            categoryMatches = true;
        } else {
            node.hitSubstring = categoryName;
        }

        let entryMatches = false;
        if (node.nodes.nodeTypes !== undefined && Object.keys(node.nodes.nodeTypes).length !== 0) {
            entryMatches = Object.values(node.nodes.nodeTypes)
                .map((nt) => {
                    const entryResult = fuzzysort.single(filter, nt.title);
                    nt.mask = (entryResult !== null && entryResult.score > threshold) ||
                        categoryMatches ||
                        forceMask;
                    if (entryResult !== null) {
                        nt.hitSubstring = fuzzysort.highlight(entryResult, '<span>', '</span>') ?? '';
                    } else {
                        nt.hitSubstring = nt.title;
                    }
                    return nt.mask;
                })
                .includes(true);
        }

        // The node is expanded if any entry in its subtree is highlighted,
        // or a node that is part of this category is highlighted,
        // or the category is highlighted or forceMask is true.
        node.mask = updateMasks(node.subcategories, filter, categoryMatches || forceMask) ||
            categoryMatches ||
            entryMatches ||
            forceMask;

        return node.mask;
    }).includes(true);

/* eslint-enable no-param-reassign */
let unWatch: WatchStopHandle;

const TOP_LEVEL_CATEGORY = 'TopLevel';
export const TOP_LEVEL_NODES_NAMES = [
    DEFAULT_CUSTOM_NODE_TYPE,
    DEFAULT_GRAPH_NODE_TYPE,
];

export default function getNodeTree(nameFilterRef: Ref<string>) {
    const { viewModel } = useViewModel();
    const { editor } = viewModel.value;
    const editorManager = EditorManager.getEditorManagerInstance();

    const nodeTypeEntries = Array.from(editor.nodeTypes.entries());
    const categoryNames = new Set(nodeTypeEntries.map(([, ni]) => ni.category));

    const topLevelCategories: Nodes = {
        categoryName: 'TopLevel',
        nodeTypes: {},
    };

    const nodes: Array<Nodes> = [];
    categoryNames.forEach((c) => {
        // Add nodes with an empty category to the top level.
        if (c === '') {
            nodeTypeEntries
                .filter(([, ni]) => ni.category === '')
                .forEach(([nodeName, node]) => {
                    topLevelCategories.nodeTypes[nodeName] = {
                        ...node, // @ts-ignore
                        isCategory: node.isCategory,
                        mask: true,
                        hitSubstring: node.title, // @ts-ignore
                        iconPath: editor.getNodeIconPath(nodeName), // @ts-ignore
                        URLs: editor.getNodeURLs(nodeName),
                    };
                });
            return;
        }

        let nodeTypesInCategory = nodeTypeEntries.filter(([, ni]) => ni.category === c);
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

        let topLevelNodes = nodeTypesInCategory.filter(
            ([name, _]) => TOP_LEVEL_NODES_NAMES.includes(name), // eslint-disable-line @typescript-eslint/no-unused-vars,max-len
        );

        nodeTypesInCategory = nodeTypesInCategory.filter(
            ([name, _]) => !TOP_LEVEL_NODES_NAMES.includes(name), // eslint-disable-line @typescript-eslint/no-unused-vars,max-len
        );

        if (!editorManager.baklavaView.settings.editableNodeTypes) {
            topLevelNodes = topLevelNodes.filter(
                ([name, _]) => name !== DEFAULT_CUSTOM_NODE_TYPE,
            );
        }

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

        topLevelNodes.forEach(([nodeName, node]) => {
            topLevelCategories.nodeTypes[nodeName] = {
                ...node, // @ts-ignore
                isCategory: node.isCategory, // nodeTypes has an incorrect type, Ignoring
                mask: true,
                hitSubstring: node.title,
                iconPath: nodesIconPath[nodeName],
                URLs: nodesURLs[nodeName],
            };
        });
    });

    const nodeCategories = new Set(nodes.map((c) => c.categoryName));
    const categoryTree = parseCategories(nodeCategories);
    const parsedTree = categorizeNodes(categoryTree, nodes);

    // If specification changes we no longer want to watch it
    if (unWatch) {
        unWatch();
    }

    const topCategory = {
        subcategories: parsedTree,
        nodes: topLevelCategories,
        categoryNode: undefined,
        hitSubstring: TOP_LEVEL_CATEGORY,
        mask: true,
    } as NodeCategory;

    const topSubcategory: NodeSubcategories = {
        All: topCategory,
    };

    unWatch = watch(nameFilterRef, (newNameFilter) => {
        if (newNameFilter === '') {
            Object.entries(topSubcategory).forEach((subTree) => setDefaultNames(subTree));
            Object.values(topSubcategory).forEach((subTree) => setMasksToTrue(subTree));
        } else {
            updateMasks(topSubcategory, newNameFilter.toLowerCase(), false);
        }
    });

    return topCategory;
}
