/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */
export default class LayoutManager {

    computeLayout(dataflow) {
        const graph = this.dataflowToGraph(dataflow);
        const layout = this._computeLayout(graph);
        return this.graphToDataflow(layout, dataflow);
    }

    dataflowToGraph(dataflow) {
        const interfaceToNodeId = new Map();
        dataflow.graph.nodes.forEach(node => {
            Object.values(node.inputs).forEach(intf => 
                interfaceToNodeId.set(intf.id, node.id)
            );
            Object.values(node.outputs).forEach(intf =>
                interfaceToNodeId.set(intf.id, node.id)
            )
        });

        const nodes = dataflow.graph.nodes.map(node => ({
            id: node.id,
            width: Math.min(node.width, 300),
            height: 300 // TODO
        }))
        const connections = dataflow.graph.connections.map(connection => ({
            id: connection.id,
            from: interfaceToNodeId.get(connection.from),
            to: interfaceToNodeId.get(connection.to),
        }))
        return {nodes, connections};
    }

    _computeLayout(graph) {
        // Placeholder
        const {nodes, connections} = graph;
        return {connections, nodes: nodes.map(node => ({
            id: node.id,
            width: node.width,
            hight: node.height,
            position: {x: 0, y: 0}
        }))}
    }

    graphToDataflow(graph, dataflow) {
        const idToPosition = new Map();
        graph.nodes.forEach(node => idToPosition.set(node.id, node.position))
        dataflow.graph.nodes = dataflow.graph.nodes.map(node => ({...node, position: idToPosition.get(node.id)}))
        return dataflow;
    }
}
