import { reactive, Ref, ref, watch } from "vue";
import { Graph } from "@baklavajs/core";

import {
    ICommandHandler, ICommand
} from "@baklavajs/renderer-vue";


export interface IHistory {
    max_steps: number;
};

export class Step {
    type: string;
    topic: any;
    constructor(type: string, topic: any) {
        this.type = type
        this.topic = topic;
    }
}
export var suppressingHistory: Ref<Boolean> = ref(false);
export function suppressHistoryLogging(value: Boolean) {
    suppressingHistory.value = value;
};

export function useHistory(graph: Ref<Graph>, commandHandler: ICommandHandler): IHistory {
    const token = Symbol("CustomHistoryToken");
    const max_steps: number = 200;
    const history: Map<string, Step[]> = new Map<string, Step[]>();
    const undoneHistory: Map<string, Step[]> = new Map<string, Step[]>();
    const removedObjectsMap : Map<string, any> = new Map<string, any>();
    var currentId = "ThisShouldNotAppearInHistoryMaps";
    var oldId = "ThisShouldNotAppearInHistoryMaps";

    // Switch all the events to any new graph that's displayed
    const graphSwitch = (newGraph : any, oldGraph: any, copyStateStack: Boolean = false) => {
        if (oldGraph) {
            oldGraph.events.addNode.unsubscribe(token);
            oldGraph.events.removeNode.unsubscribe(token);
            oldGraph.events.addConnection.unsubscribe(token);
            oldGraph.events.removeConnection.unsubscribe(token);
        }
        if (newGraph) {
            oldId = currentId;
            currentId = newGraph.id;
            if(history.get(currentId ) === undefined)
                history.set(currentId ,[]);
            if(undoneHistory.get(currentId ) === undefined)
                undoneHistory.set(currentId ,[]);
            if(copyStateStack) {
                undoneHistory.set(currentId, undoneHistory.get(oldId)!);
                history.set(currentId, history.get(oldId)!);
            }
            newGraph.events.addNode.subscribe(token, (node : any) => {
                if(!suppressingHistory.value) {
                    history.get(newGraph.id)!.push(new Step("add", "node::"+node.id.toString()));
                }
            });
            newGraph.events.removeNode.subscribe(token, (node : any) => {
                if(!suppressingHistory.value) {
                    history.get(newGraph.id)!.push(new Step("rem", "node::"+node.id.toString()));
                }
                removedObjectsMap.set("node::"+node.id.toString(),[node,node.save()]);
            });
            newGraph.events.addConnection.subscribe(token, (conn : any) => {
                if(!suppressingHistory.value) {
                    history.get(newGraph.id)!.push(new Step("add", "conn::"+conn.id.toString()));
                }
            });
            newGraph.events.removeConnection.subscribe(token, (conn : any) => {
                if(!suppressingHistory.value) {
                    history.get(newGraph.id)!.push(new Step("rem", "conn::"+conn.id.toString()));
                }
                removedObjectsMap.set("conn::"+conn.id.toString(),conn);
            });
        }
    };

    watch(graph, (newGraph, oldGraph) => graphSwitch(newGraph, oldGraph),
        { flush: "post" },
    );
    const singleStepTransaction = (main_history: Step[], auxiliary_history:Step[]) => {
            var foo : Step | undefined = main_history.pop();
            if(foo === undefined) return;
            suppressingHistory.value = true;
            if(foo.type === "add") {
                foo.type = "rem"
                if(foo.topic.startsWith("node")) {
                    const node = graph.value.nodes.find((n) => n.id === foo!.topic.slice(6));
                    if(node !== undefined) {
                        graph.value.removeNode(node!); 
                    } 
                }
                else if(foo.topic.startsWith("conn")) {
                    const conn = graph.value.connections.find((n) => n.id === foo!.topic.slice(6));
                    if(conn !== undefined) {
                        graph.value.removeConnection(conn!); 
                    } 
                }
                else if(foo.topic.startsWith("load")) {
                    removedObjectsMap.set("load::"+graph.value.id.toString(), graph.value.save());
                    for (let i = graph.value.connections.length - 1; i >= 0; i -= 1) {
                        graph.value.removeConnection(graph.value.connections[i]);
                    }
                    for (let i = graph.value.nodes.length - 1; i >= 0; i -= 1) {
                        graph.value.removeNode(graph.value.nodes[i]);
                    }
                }
            }
            else if(foo.type === "rem") {
                foo.type = "add"
                if(foo.topic.startsWith("node")) {
                    const nodeTuple = removedObjectsMap.get(foo.topic);
                    if(nodeTuple[0] !== undefined) {
                        graph.value.addNode(nodeTuple[0]!); 
                        nodeTuple[0].load(nodeTuple[1]);
                    } 
                }
                else if(foo.topic.startsWith("conn")) {
                    const conn = removedObjectsMap.get(foo.topic);
                    if(conn !== undefined) {
                        var conn_added = graph.value.addConnection(conn.from, conn.to);
                        if(conn_added === undefined) {
                            return;
                        }
                        conn_added!.id = conn.id;
                    } 
                }
                else if(foo.topic.startsWith("load")) {
                    const conn = removedObjectsMap.get(foo.topic);
                    if(conn !== undefined) {
                        graph.value.load(conn);
                    } 
                }
                
            }
            auxiliary_history.push(foo);
            suppressingHistory.value = false;
    };
    
    commandHandler.registerCommand<ICommand<void>>("undo", {
        canExecute: ()=>true,
        execute: () => {
            if(history.get(currentId)!.length === 0 && (graph.value.nodes.length > 0)) {
                suppressHistoryLogging(true);
                removedObjectsMap.set("load::"+graph.value.id.toString(), graph.value.save());
                for (let i = graph.value.connections.length - 1; i >= 0; i -= 1) {
                    graph.value.removeConnection(graph.value.connections[i]);
                }
                for (let i = graph.value.nodes.length - 1; i >= 0; i -= 1) {
                    graph.value.removeNode(graph.value.nodes[i]);
                }
                suppressHistoryLogging(false);
                undoneHistory.get(currentId)!.push(new Step("rem", "load::"+graph.value.id.toString()));
            }
            else
                singleStepTransaction(history.get(currentId)!,undoneHistory.get(currentId)!);
        },
    });

    commandHandler.registerCommand<ICommand<void>>("redo", {
        canExecute: ()=>true,
        execute: () => {
            singleStepTransaction(undoneHistory.get(currentId)!,history.get(currentId)!);
        },
    });

    commandHandler.registerHotkey(["Control", "z"], "undo");
    commandHandler.registerHotkey(["Control", "y"], "redo");

    return reactive({
        max_steps,
        graphSwitch
    });
}
