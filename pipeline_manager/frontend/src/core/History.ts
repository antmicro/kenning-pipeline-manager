/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    reactive, Ref, ref, watch,
} from 'vue';
import { Graph } from '@baklavajs/core';

import { v4 as uuidv4 } from 'uuid';

import {
    ICommandHandler, ICommand,
} from '@baklavajs/renderer-vue';

export const suppressingHistory: Ref<boolean> = ref(false);
const transactionId: Ref<string> = ref('');

export interface IHistory {
    max_steps: number;
}

export class Step {
    type: string;

    transactionId: string;

    // I need this to be of basically any type, as
    // it may need to receive objects, arrays of objects, other steps
    /* eslint-disable @typescript-eslint/no-explicit-any */
    topic: any;

    constructor(type: string, topic: any, tid: string = uuidv4()) {
        this.type = type;
        this.topic = topic;
        this.transactionId = tid;
    }
}
export function suppressHistoryLogging(value: boolean) {
    suppressingHistory.value = value;
}

function createStep(key: string, value: string, id: string) {
    if (id !== '') return new Step(key, value, id);
    return new Step(key, value);
}

export function startTransaction(id: string = uuidv4()) {
    if (transactionId.value !== '') return undefined;
    transactionId.value = id;
    return id;
}

export function commitTransaction() {
    transactionId.value = '';
}

export function useHistory(graph: Ref<Graph>, commandHandler: ICommandHandler): IHistory {
    const token = Symbol('CustomHistoryToken');
    const maxSteps = 200;
    const history: Map<string, Step[]> = new Map<string, Step[]>();
    const undoneHistory: Map<string, Step[]> = new Map<string, Step[]>();
    const removedObjectsMap : Map<string, any> = new Map<string, any>();
    let currentId = 'ThisShouldNotAppearInHistoryMaps';
    let oldId = 'ThisShouldNotAppearInHistoryMaps';

    // Switch all the events to any new graph that's displayed
    const graphSwitch = (newGraph : any, oldGraph: any, copyStateStack = false) => {
        if (oldGraph) {
            oldGraph.events.addNode.unsubscribe(token);
            oldGraph.events.removeNode.unsubscribe(token);
            oldGraph.events.addConnection.unsubscribe(token);
            oldGraph.events.removeConnection.unsubscribe(token);
        }
        if (newGraph) {
            oldId = currentId;
            currentId = newGraph.id;
            if (history.get(currentId) === undefined) history.set(currentId, []);
            if (undoneHistory.get(currentId) === undefined) undoneHistory.set(currentId, []);
            if (copyStateStack) {
                const undoneItem = undoneHistory.get(oldId);
                if (undoneItem) undoneHistory.set(currentId, undoneItem);
                const historyItem = history.get(oldId);
                if (historyItem) history.set(currentId, historyItem);
            }
            newGraph.events.addNode.subscribe(token, (node : any) => {
                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    historyItem.push(createStep('add', `node::${node.id.toString()}`, transactionId.value));
                }
            });
            newGraph.events.removeNode.subscribe(token, (node : any) => {
                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    historyItem.push(createStep('rem', `node::${node.id.toString()}`, transactionId.value));
                }
                removedObjectsMap.set(`node::${node.id.toString()}`, [node, node.save()]);
            });
            newGraph.events.addConnection.subscribe(token, (conn : any) => {
                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    historyItem.push(createStep('add', `conn::${conn.id.toString()}`, transactionId.value));
                }
            });
            newGraph.events.removeConnection.subscribe(token, (conn : any) => {
                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    historyItem.push(createStep('rem', `conn::${conn.id.toString()}`, transactionId.value));
                }
                removedObjectsMap.set(`conn::${conn.id.toString()}`, conn);
            });
        }
    };

    watch(graph, (newGraph, oldGraph) => graphSwitch(newGraph, oldGraph), { flush: 'post' },
    );
    const singleStepTransaction = (mainHistory: Step[], auxiliaryHistory:Step[]) => {
        const foo : Step | undefined = mainHistory.pop();
        if (foo === undefined) return;
        suppressingHistory.value = true;
        if (foo.type === 'add') {
            foo.type = 'rem';
            if (foo.topic.startsWith('node')) {
                const node = graph.value.nodes.find((n) => n.id === foo.topic.slice(6));
                if (node !== undefined) {
                    graph.value.removeNode(node);
                }
            } else if (foo.topic.startsWith('conn')) {
                const conn = graph.value.connections.find((n) => n.id === foo.topic.slice(6));
                if (conn !== undefined) {
                    graph.value.removeConnection(conn);
                }
            } else if (foo.topic.startsWith('load')) {
                removedObjectsMap.set(`load::${graph.value.id.toString()}`, graph.value.save());
                for (let i = graph.value.connections.length - 1; i >= 0; i -= 1) {
                    graph.value.removeConnection(graph.value.connections[i]);
                }
                for (let i = graph.value.nodes.length - 1; i >= 0; i -= 1) {
                    graph.value.removeNode(graph.value.nodes[i]);
                }
            }
        } else if (foo.type === 'rem') {
            foo.type = 'add';
            if (foo.topic.startsWith('node')) {
                const nodeTuple = removedObjectsMap.get(foo.topic);
                if (nodeTuple[0] !== undefined) {
                    graph.value.addNode(nodeTuple[0]);
                    nodeTuple[0].load(nodeTuple[1]);
                }
            } else if (foo.topic.startsWith('conn')) {
                const conn = removedObjectsMap.get(foo.topic);
                if (conn !== undefined) {
                    const connAdded = graph.value.addConnection(conn.from, conn.to);
                    if (connAdded === undefined) {
                        return;
                    }
                    connAdded.id = conn.id;
                }
            } else if (foo.topic.startsWith('load')) {
                const conn = removedObjectsMap.get(foo.topic);
                if (conn !== undefined) {
                    graph.value.load(conn);
                }
            }
        }
        auxiliaryHistory.push(foo);
        if (
            mainHistory.length > 0 &&
            mainHistory[mainHistory.length - 1].transactionId === foo.transactionId
        ) singleStepTransaction(mainHistory, auxiliaryHistory);
        suppressingHistory.value = false;
    };

    commandHandler.registerCommand<ICommand<void>>('undo', {
        canExecute: () => true,
        execute: () => {
            const historyItem = history.get(currentId);
            if (historyItem && historyItem.length === 0 && (graph.value.nodes.length > 0)) {
                suppressHistoryLogging(true);
                removedObjectsMap.set(`load::${graph.value.id.toString()}`, graph.value.save());
                for (let i = graph.value.connections.length - 1; i >= 0; i -= 1) {
                    graph.value.removeConnection(graph.value.connections[i]);
                }
                for (let i = graph.value.nodes.length - 1; i >= 0; i -= 1) {
                    graph.value.removeNode(graph.value.nodes[i]);
                }
                suppressHistoryLogging(false);
                const undoneItem = undoneHistory.get(currentId);
                if (undoneItem) undoneItem.push(new Step('rem', `load::${graph.value.id.toString()}`));
            } else {
                const undoneItem = undoneHistory.get(currentId);
                if (historyItem && undoneItem) singleStepTransaction(historyItem, undoneItem);
            }
        },
    });

    commandHandler.registerCommand<ICommand<void>>('redo', {
        canExecute: () => true,
        execute: () => {
            const historyItem = history.get(currentId);
            const undoneItem = undoneHistory.get(currentId);
            if (historyItem && undoneItem) singleStepTransaction(undoneItem, historyItem);
        },
    });
    commandHandler.registerCommand<ICommand<void>>('START_TRANSACTION', {
        canExecute: () => transactionId.value === '',
        execute: () => startTransaction,
    });
    commandHandler.registerCommand<ICommand<void>>('COMMIT_TRANSACTION', {
        canExecute: () => transactionId.value !== '',
        execute: () => commitTransaction,
    });

    commandHandler.registerHotkey(['Control', 'z'], 'undo');
    commandHandler.registerHotkey(['Control', 'y'], 'redo');

    return reactive({
        max_steps: maxSteps,
        graphSwitch,
    });
}
