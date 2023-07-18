import { reactive, Ref, ref, watch, unref,computed } from "vue";
import { Graph } from "@baklavajs/core";

import {
    ICommandHandler, ICommand, Commands
} from "@baklavajs/renderer-vue";

export const UNDO_COMMAND = "UNDO";

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
export var currentlyInTransaction: Ref<Boolean> = ref(false);
export function setTransaction(value: Boolean) {
    currentlyInTransaction.value = value;
};

export function useHistory(graph: Ref<Graph>, commandHandler: ICommandHandler): IHistory {
    const token = Symbol("CustomHistoryToken");
    const max_steps: number = 200;
    const history: Step[] = [];
    const undoneHistory: Step[] = [];
    const removedObjectsMap : Map<string, any> = new Map<string, any>();
    graph = ref(graph);

    // TODO(jbylicki): This is broken, it will watch loop itself forever
    // despite it being very simmilar to how the internal implementation functions
    // or not trigger when subgraph changes the graph. Removing the ref above will
    // result in the mentioned infinite loop. Hilariously, exactly the same watch works
    // fine inside of baklava with the same argument and called with seemingly the same object.

    // Switch all the watching to new graph events
    watch(graph,
        async (newGraph, oldGraph) => {
            if (oldGraph) {
                oldGraph.events.addNode.unsubscribe(token);
                oldGraph.events.removeNode.unsubscribe(token);
                oldGraph.events.addConnection.unsubscribe(token);
                oldGraph.events.removeConnection.unsubscribe(token);
            }
            if (newGraph) {
                newGraph.events.addNode.subscribe(token, (node : any) => {
                    if(!currentlyInTransaction.value) {
                        history.push(new Step("add", "node::"+node.id.toString()));
                    }
                });
                newGraph.events.removeNode.subscribe(token, (node : any) => {
                    if(!currentlyInTransaction.value) {
                        history.push(new Step("rem", "node::"+node.id.toString()));
                    }
                    removedObjectsMap.set("node::"+node.id.toString(),[node,node.save()]);
                });
                newGraph.events.addConnection.subscribe(token, (conn : any) => {
                    if(!currentlyInTransaction.value) {
                        history.push(new Step("add", "conn::"+conn.id.toString()));
                    }
                });
                newGraph.events.removeConnection.subscribe(token, (conn : any) => {
                    if(!currentlyInTransaction.value) {
                        history.push(new Step("rem", "conn::"+conn.id.toString()));
                    }
                    removedObjectsMap.set("conn::"+conn.id.toString(),conn);
                });
            }
            console.log("Watch triggered on graph change");
            console.log(newGraph);
        },
        { immediate: true, deep: false },
    );

    const singleStepTransaction = (main_history: Step[], auxiliary_history:Step[]) => {
            var foo : Step | undefined = main_history.pop();
            if(foo === undefined)
                return;

            currentlyInTransaction.value = true;
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
                
            }
            auxiliary_history.push(foo);
            currentlyInTransaction.value = false;
    };
    
    commandHandler.registerCommand<ICommand<void>>("undo", {
        canExecute: ()=>true,
        execute: () => {
            singleStepTransaction(history,undoneHistory);
        },
    });

    commandHandler.registerCommand<ICommand<void>>("redo", {
        canExecute: ()=>true,
        execute: () => {
            singleStepTransaction(undoneHistory,history);
        },
    });

    commandHandler.registerHotkey(["Control", "z"], "undo");
    commandHandler.registerHotkey(["Control", "y"], "redo");

    return reactive({
        max_steps
    });
}
