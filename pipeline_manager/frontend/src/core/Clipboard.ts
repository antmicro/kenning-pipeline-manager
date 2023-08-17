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
    AbstractNode, INodeState, IConnectionState, Connection, NodeInterface, Editor,
} from '@baklavajs/core';
import {
    ICommandHandler, ICommand,
} from '@baklavajs/renderer-vue';

export const COPY_COMMAND = 'COPY';
export const PASTE_COMMAND = 'PASTE';
export const CLEAR_CLIPBOARD_COMMAND = 'CLEAR_CLIPBOARD';

export interface IClipboard {
    isEmpty: boolean;
}

export function useClipboard(
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    displayedGraph: any,
    editor: Ref<Editor>,
    commandHandler: ICommandHandler,
): IClipboard {
    const token = Symbol('ClipboardToken');

    const nodeBuffer = ref('');
    const connectionBuffer = ref('');

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
            (n : any) => n.save()),
        );
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

        // Map old IDs to new IDs
        const idmap = new Map<string, string>();

        const parsedNodeBuffer = JSON.parse(nodeBuffer.value) as INodeState<any, any>[];
        const parsedConnectionBuffer = JSON.parse(connectionBuffer.value) as IConnectionState[];

        const newNodes: AbstractNode[] = [];
        const newConnections: Connection[] = [];

        const graph = displayedGraph.value;

        commandHandler.executeCommand<ICommand<void>>('START_TRANSACTION');

        for (let i = 0; i < parsedNodeBuffer.length; i += 1) {
            const nodeType = editor.value.nodeTypes.get(parsedNodeBuffer[i].type);
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
                    ns.position.x += 10;
                    ns.position.y += 10;
                }
                copiedNode.hooks.beforeLoad.unsubscribe(token);
                return ns;
            });

            copiedNode = graph.addNode(copiedNode);
            parsedNodeBuffer[i].id = generatedId;
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
