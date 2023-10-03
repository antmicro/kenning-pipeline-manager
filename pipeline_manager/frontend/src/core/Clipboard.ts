/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/*
The baklavajs functionality was fully copied to this file, as the original
implementation is not exported and cannot be integrated with custom history
as the Commands have been replaced.

The original source is slightly adjusted to integrate with the customized history
and the new command handler
*/

import {
    computed, reactive, Ref, ref,
} from 'vue';
import { v4 as uuidv4 } from 'uuid';
import {
    AbstractNode,
    INodeState,
    IConnectionState,
    Connection,
    NodeInterface,
    Editor,
    GRAPH_NODE_TYPE_PREFIX,
} from '@baklavajs/core';
import {
    ICommandHandler, ICommand, useViewModel,
} from '@baklavajs/renderer-vue';
import {
    startTransaction, commitTransaction,
} from './History.ts';
import { removeNode } from '../custom/CustomNode.js';

export const COPY_COMMAND = 'COPY';
export const DELETE_COMMAND = 'DELETE';
export const UNHIGHLIGHT_COMMAND = 'UNHIGHLIGHT';
export const PASTE_COMMAND = 'PASTE';
export const CLEAR_CLIPBOARD_COMMAND = 'CLEAR_CLIPBOARD';

/* eslint-disable  @typescript-eslint/no-explicit-any */
interface PMNodeState extends INodeState<any, any> {
    name: string;
    subgraph?: string;
    graphState?: any;
}

export interface IClipboard {
    isEmpty: boolean;
}

export function useClipboard(
    displayedGraph: any,
    editor: Ref<Editor>,
    commandHandler: ICommandHandler,
): IClipboard {
    const token = Symbol('ClipboardToken');

    const nodeBuffer = ref('');
    const connectionBuffer = ref('');

    const consecutivePasteNumber = ref(0);

    const isEmpty = computed(() => !nodeBuffer.value);

    const clear = () => {
        nodeBuffer.value = '';
        connectionBuffer.value = '';
    };

    const copy = () => {
        // find all connections from and to the selected nodes
        const interfacesOfSelectedNodes = displayedGraph.value.selectedNodes.flatMap((n : any) => [
            ...Object.values(n.inputs),
            ...Object.values(n.outputs),
        ]);

        const connections = displayedGraph.value.connections
            .filter(
                (conn : any) => interfacesOfSelectedNodes.includes(conn.from) ||
                                interfacesOfSelectedNodes.includes(conn.to),
            )
            .map((conn : any) => ({ from: conn.from.id, to: conn.to.id } as IConnectionState));

        connectionBuffer.value = JSON.stringify(connections);
        nodeBuffer.value = JSON.stringify(displayedGraph.value.selectedNodes.map(
            (n : any) => n.save(),
        ));

        consecutivePasteNumber.value = 0;
    };

    const del = () => {
        startTransaction();
        displayedGraph.value.selectedNodes.forEach((node : any) => {
            removeNode(node);
        });
        commitTransaction();
    };

    const findInterface = (
        nodes: AbstractNode[],
        id: string,
        io?: 'input' | 'output',
    ): NodeInterface<any> | undefined => {
        for (let i = 0; i < nodes.length; i += 1) {
            let intf: NodeInterface<any> | undefined;
            if (!io || io === 'input') {
                intf = Object.values(nodes[i].inputs).find((iface) => iface.id === id);
            }
            if (!intf && (!io || io === 'output')) {
                intf = Object.values(nodes[i].outputs).find((iface) => iface.id === id);
            }
            if (intf) {
                return intf;
            }
        }
        return undefined;
    };

    const paste = () => {
        if (isEmpty.value) {
            return;
        }
        const { viewModel } = useViewModel();
        const movementStep = (<any>viewModel.value).movementStep ?? 1;

        // Map old IDs to new IDs
        const idmap = new Map<string, string>();

        const parsedNodeBuffer = JSON.parse(nodeBuffer.value) as PMNodeState[];
        const parsedConnectionBuffer = JSON.parse(connectionBuffer.value) as IConnectionState[];

        const newNodes: AbstractNode[] = [];
        const newConnections: Connection[] = [];

        const graph = displayedGraph.value;

        commandHandler.executeCommand<ICommand<void>>('START_TRANSACTION');

        for (let i = 0; i < parsedNodeBuffer.length; i += 1) {
            let nodeType;
            if (parsedNodeBuffer[i]?.subgraph !== undefined) {
                nodeType = editor.value.nodeTypes.get(`${GRAPH_NODE_TYPE_PREFIX}${parsedNodeBuffer[i].name}`);
            } else {
                nodeType = editor.value.nodeTypes.get(parsedNodeBuffer[i].name);
            }

            if (!nodeType) {
                return;
            }
            /* eslint-disable-next-line new-cap */
            let copiedNode = new nodeType.type();

            const generatedId = copiedNode.id;
            newNodes.push(copiedNode);

            const tapInterfaces = (intfs: Record<string, NodeInterface<any>>) => {
                Object.values(intfs).forEach((intf) => {
                    intf.hooks.load.subscribe(token, (intfState) => {
                        const newIntfId = uuidv4();
                        idmap.set(intfState.id, newIntfId);
                        /* eslint-disable-next-line no-param-reassign */
                        intf.id = newIntfId;
                        intf.hooks.load.unsubscribe(token);
                        return intfState;
                    });
                });
            };

            tapInterfaces(copiedNode.inputs);
            tapInterfaces(copiedNode.outputs);

            copiedNode.hooks.beforeLoad.subscribe(token, (nodeState) => {
                const ns = nodeState as any;
                if (ns.position) {
                    consecutivePasteNumber.value += 1;

                    ns.position.x += consecutivePasteNumber.value * Math.max(40, movementStep);
                    ns.position.y += consecutivePasteNumber.value * Math.max(40, movementStep);
                }
                if (parsedNodeBuffer[i].graphState !== undefined) {
                    parsedNodeBuffer[i].graphState.nodes.forEach((n: any) => {
                        /* eslint-disable-next-line no-param-reassign */
                        if (n.type !== undefined) n.name = n.type;
                    });
                }
                copiedNode.hooks.beforeLoad.unsubscribe(token);
                return ns;
            });

            copiedNode = graph.addNode(copiedNode);
            parsedNodeBuffer[i].id = generatedId;

            const assignNewId = (g: any) => {
                // TODO: Replace all other ids like connections, interfaces and regular nodes.
                g.nodes.forEach((node: any) => {
                    if (node.subgraph !== undefined) {
                        node.graphState.id = uuidv4(); // eslint-disable-line no-param-reassign
                        assignNewId(node.graphState);
                    }
                });
            };

            if (parsedNodeBuffer[i].subgraph !== undefined) {
                parsedNodeBuffer[i].graphState.id = uuidv4();
                assignNewId(parsedNodeBuffer[i].graphState);
            }

            copiedNode.load(parsedNodeBuffer[i]);
            idmap.set(parsedNodeBuffer[i].id, generatedId);
        }

        for (let i = 0; i < parsedConnectionBuffer.length; i += 1) {
            const fromId = idmap.get(parsedConnectionBuffer[i].from);
            const toId = idmap.get(parsedConnectionBuffer[i].to);
            if (fromId && toId) {
                const fromIntf = findInterface(newNodes, fromId, 'output');
                const toIntf = findInterface(newNodes, toId, 'input');
                if (fromIntf && toIntf) {
                    const newConnection = graph.addConnection(fromIntf, toIntf);
                    if (newConnection) {
                        newConnections.push(newConnection);
                    }
                }
            }
        }

        commandHandler.executeCommand<ICommand<void>>('COMMIT_TRANSACTION');

        /* eslint-disable-next-line consistent-return */
        return {
            newNodes,
            newConnections,
        };
    };

    commandHandler.registerCommand(DELETE_COMMAND, {
        canExecute: () => displayedGraph.value.selectedNodes.length > 0,
        execute: del,
    });
    commandHandler.registerHotkey(['Delete'], DELETE_COMMAND);
    commandHandler.registerCommand(UNHIGHLIGHT_COMMAND, {
        canExecute: () => true,
        execute: () => {
            displayedGraph.value.selectedNodes = []; // eslint-disable-line no-param-reassign
        },
    });
    commandHandler.registerHotkey(['Escape'], UNHIGHLIGHT_COMMAND);
    commandHandler.registerCommand(COPY_COMMAND, {
        canExecute: () => true,
        execute: copy,
    });
    commandHandler.registerHotkey(['Control', 'c'], COPY_COMMAND);
    commandHandler.registerCommand(PASTE_COMMAND, {
        canExecute: () => !isEmpty.value,
        execute: paste,
    });
    commandHandler.registerHotkey(['Control', 'v'], PASTE_COMMAND);
    commandHandler.registerCommand(CLEAR_CLIPBOARD_COMMAND, {
        canExecute: () => true,
        execute: clear,
    });

    return reactive({ isEmpty });
}
