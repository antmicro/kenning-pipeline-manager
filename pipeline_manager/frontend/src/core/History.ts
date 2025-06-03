/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable max-classes-per-file */
import {
    reactive, Ref, ref, watch,
} from 'vue';
import { Graph } from '@baklavajs/core';

import { v4 as uuidv4 } from 'uuid';

import {
    ICommandHandler, ICommand,
} from '@baklavajs/renderer-vue';

import { applySidePositions } from './interfaceParser.js';
import { configurationState } from './nodeCreation/ConfigurationState.ts';

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    add(graph: Ref<Graph>) {
        throw new Error(`Method add has thrown an error for topic: ${this.topic}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    remove(graph: Ref<Graph>) {
        throw new Error(`Method remove has thrown an error for topic: ${this.topic}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    edit(graph: Ref<Graph>) {
        throw new Error(`Method edit has thrown an error for topic: ${this.topic}`);
    }
}

class NodeStep extends Step {
    nodeTuple: Array<any> = [];

    constructor(type: string, topic: any, tid: string = uuidv4()) {
        if (tid === '') tid = uuidv4(); // eslint-disable-line no-param-reassign
        super(type, topic, tid);
    }

    add(graph: Ref<Graph>) {
        if (this.nodeTuple[0] !== undefined) {
            const n = graph.value.addNode(this.nodeTuple[0]);
            n.load(this.nodeTuple[1]);
        }
    }

    remove(graph: Ref<Graph>) {
        const node : any = graph.value.nodes.find((n) => n.id === this.topic);
        if (node !== undefined) {
            this.nodeTuple = [node, node.save()];
            graph.value.removeNode(node);
        }
    }

    edit(graph: Ref<Graph>) {
        if (this.nodeTuple[0] !== undefined) {
            // save node connections
            const interfaces = [
                ...Object.values(this.nodeTuple[0].inputs),
                ...Object.values(this.nodeTuple[0].outputs),
            ];
            const connections = graph.value.connections.filter(
                (c) => interfaces.includes(c.from) || interfaces.includes(c.to),
            );

            // remove the current version of the node
            graph.value.removeNode(this.nodeTuple[0]);

            // save the current version and load the previous save
            const n = graph.value.addNode(this.nodeTuple[0]);
            const save = this.nodeTuple[1];
            this.nodeTuple = [this.nodeTuple[0], this.nodeTuple[0].save()];
            n.load(save);

            // restore connections
            connections.forEach((conn) => {
                graph.value.addConnection(conn.from, conn.to);
            });
        }
    }
}

class ConnectionStep extends Step {
    conn: any = undefined;

    constructor(type: string, topic: any, tid: string = uuidv4()) {
        if (tid === '') tid = uuidv4(); // eslint-disable-line no-param-reassign
        super(type, topic, tid);
    }

    add(graph: Ref<Graph>) {
        if (this.conn !== undefined) {
            // The object of the interfaces itself has changed and despite
            // having all the same fields, it will not assign the connection
            // correctly. That's why it is necessary to extract the nodeId
            // from what we have and find the interface in said node manually

            const fromNode = graph.value.findNodeById(this.conn.from.nodeId);
            const toNode = graph.value.findNodeById(this.conn.to.nodeId);
            if (!fromNode || !toNode) return;

            const from = [
                ...Object.values(fromNode.inputs),
                ...Object.values(fromNode.outputs),
            ].filter(
                (iface) => iface.port,
            ).find((iface) => iface.id === this.conn.from.id);

            const to = [
                ...Object.values(toNode.inputs),
                ...Object.values(toNode.outputs),
            ].filter(
                (iface) => iface.port,
            ).find((iface) => iface.id === this.conn.to.id);

            if (!from || !to) return;

            const connAdded = graph.value.addConnection(from, to);
            if (connAdded === undefined) {
                return;
            }
            connAdded.id = this.conn.id;
        }
    }

    remove(graph: Ref<Graph>) {
        const conn = graph.value.connections.find((n) => n.id === this.topic);
        if (conn !== undefined) {
            this.conn = conn;
            graph.value.removeConnection(conn);
        }
    }
}

class AnchorStep extends Step {
    anchor: any = undefined;

    constructor(type: string, topic: any, tid: string = uuidv4()) {
        if (tid === '') tid = uuidv4(); // eslint-disable-line no-param-reassign
        super(type, topic, tid);
    }

    add(graph: Ref<Graph>) {
        if (this.anchor !== undefined) {
            const conn = graph.value.connections.find(
                (n) => n.from.id === this.anchor[0].from.id &&
                n.to.id === this.anchor[0].to.id &&
                n.id === this.anchor[0].id,
            );
            if (conn !== undefined) if ((<any>conn).anchors === undefined) (<any>conn).anchors = [];
            (<any>conn).anchors.splice(
                this.anchor[2], 0, this.anchor[1],
            );
        }
    }

    remove(graph: Ref<Graph>) {
        if (this.anchor !== undefined) {
            const conn = graph.value.connections.find(
                (n) => n.from === this.anchor[0].from && n.to === this.anchor[0].to,
            );
            if (conn !== undefined) (<any>conn).anchors.splice(this.anchor[2], 1);
        }
    }
}

export function suppressHistoryLogging(value: boolean) {
    suppressingHistory.value = value;
}

export function startTransaction(id: string = uuidv4()) {
    if (transactionId.value !== '') return undefined;
    transactionId.value = id;
    return id;
}

export function commitTransaction() {
    transactionId.value = '';
}

export function useHistory(graph: Ref<any>, commandHandler: ICommandHandler): IHistory {
    const token = Symbol('CustomHistoryToken');
    const maxSteps = 200;
    const history: Map<string, Step[]> = new Map<string, Step[]>();
    const undoneHistory: Map<string, Step[]> = new Map<string, Step[]>();
    let currentId = 'ThisShouldNotAppearInHistoryMaps';
    let oldId = 'ThisShouldNotAppearInHistoryMaps';

    const unsubscribeFromGraphEvents = (g: any, tok : symbol) => {
        g.events.addNode.unsubscribe(tok);
        g.events.removeNode.unsubscribe(tok);
        g.events.editNode.unsubscribe(tok);
        g.events.addConnection.unsubscribe(tok);
        g.events.removeConnection.unsubscribe(tok);
        g.events.addAnchor.unsubscribe(tok);
        g.events.removeAnchor.unsubscribe(tok);
    };

    // Switch all the events to any new graph that's displayed
    const graphSwitch = (newGraph : any, oldGraph: any, copyStateStack = false) => {
        if (oldGraph) {
            unsubscribeFromGraphEvents(oldGraph, token);
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
                // Suppressing node that are being created as its hard
                // to keep the history trace consistent
                if (configurationState.nodeData?.name === node.type) return;

                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    historyItem.push(new NodeStep('add', node.id.toString(), transactionId.value));
                    undoneHistory.set(newGraph.id, []);
                }
            });
            newGraph.events.removeNode.subscribe(token, (node : any) => {
                if (!suppressingHistory.value) {
                    // Suppressing node that are being created as its hard
                    // to keep the history trace consistent
                    if (configurationState.nodeData?.name === node.type) return;

                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    const step = new NodeStep('rem', node.id.toString(), transactionId.value);
                    historyItem.push(step);
                    step.nodeTuple = [node, node.save()];
                    undoneHistory.set(newGraph.id, []);
                }
            });
            newGraph.events.editNode.subscribe(token, (node : any) => {
                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    const step = new NodeStep('edit', node.id.toString(), transactionId.value);
                    historyItem.push(step);
                    step.nodeTuple = [node, node.save()];
                    undoneHistory.set(newGraph.id, []);
                }
            });
            newGraph.events.addConnection.subscribe(token, (conn : any) => {
                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    historyItem.push(new ConnectionStep('add', conn.id.toString(), transactionId.value));
                    undoneHistory.set(newGraph.id, []);
                }
            });
            newGraph.events.removeConnection.subscribe(token, (conn : any) => {
                if (!suppressingHistory.value) {
                    const inTransaction = transactionId.value !== '';
                    if (!inTransaction) startTransaction();
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    (conn.anchors ?? []).slice().reverse().forEach((anchor: any) => {
                        newGraph.events.removeAnchor.emit([conn, conn.anchors.indexOf(anchor)]);
                    });
                    const step = new ConnectionStep('rem', conn.id.toString(), transactionId.value);
                    historyItem.push(step);
                    step.conn = conn;
                    undoneHistory.set(newGraph.id, []);
                    if (!inTransaction) commitTransaction();
                }
            });
            newGraph.events.addAnchor.subscribe(token, (tuple: any) => {
                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    const idx = Math.trunc((tuple[1] - 1) / 3);
                    const conn = tuple[0];
                    const step = new AnchorStep('add', conn.anchors[idx].id.toString(), transactionId.value);
                    historyItem.push(step);
                    step.anchor = [conn, conn.anchors[idx], idx];
                    undoneHistory.set(newGraph.id, []);
                }
            });
            newGraph.events.removeAnchor.subscribe(token, (tuple: any) => {
                if (!suppressingHistory.value) {
                    const historyItem = history.get(newGraph.id);
                    if (!historyItem) return;
                    const idx = tuple[1];
                    const conn = tuple[0];
                    const step = new AnchorStep('rem', conn.anchors[idx].id.toString(), transactionId.value);
                    historyItem.push(step);
                    step.anchor = [conn, conn.anchors[idx], idx];
                    undoneHistory.set(newGraph.id, []);
                }
            });
        }
    };

    watch(graph, (newGraph, oldGraph) => graphSwitch(newGraph, oldGraph), { flush: 'post', immediate: true });

    const singleStepTransaction = (mainHistory: Step[], auxiliaryHistory:Step[]) => {
        const step : Step | undefined = mainHistory.pop();
        if (step === undefined) return;
        suppressingHistory.value = true;
        if (step.type === 'add') {
            step.type = 'rem';
            step.remove(graph);
        } else if (step.type === 'rem') {
            step.type = 'add';
            step.add(graph);
        } else if (step.type === 'edit') {
            step.type = 'edit';
            step.edit(graph);
        }
        auxiliaryHistory.push(step);
        if (
            mainHistory.length > 0 &&
            mainHistory[mainHistory.length - 1].transactionId === step.transactionId
        ) singleStepTransaction(mainHistory, auxiliaryHistory);
        suppressingHistory.value = false;
        graph.value.selectedNodes.splice(0, graph.value.selectedNodes.length);
    };

    commandHandler.registerCommand<ICommand<void>>('undo', {
        canExecute: () => true,
        execute: () => {
            const historyItem = history.get(currentId);
            if (historyItem && historyItem.length !== 0) {
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
            if (historyItem && undoneItem && undoneItem.length !== 0) {
                singleStepTransaction(undoneItem, historyItem);
            }
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
        unsubscribeFromGraphEvents,
    });
}
