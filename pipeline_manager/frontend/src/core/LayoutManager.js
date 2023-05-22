/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export default class LayoutManager {

    layoutEngine = undefined;

    availableEngines = {
        // TODO
    }

    registerEngine(engine) {
        this.layoutEngine = new this.availableEngines[engine]();
    }

    async computeLayout(dataflow) {
        const graph = this.dataflowToGraph(dataflow);
        const layout = await this._computeLayout(graph);
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

    async _computeLayout(graph) {
        return await this.layoutEngine.calculate(graph)
    }

    graphToDataflow(graph, dataflow) {
        const idToPosition = new Map();
        graph.nodes.forEach(node => idToPosition.set(node.id, node.position))
        dataflow.graph.nodes = dataflow.graph.nodes.map(node => ({...node, position: idToPosition.get(node.id)}))
        return dataflow;
    }
}
