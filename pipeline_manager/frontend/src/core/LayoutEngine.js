/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */
export default class LayoutEngine {

    computeLayout(dataflow) {
        const graph = this.dataflowToGraph(dataflow);
        const layout = this._computeLayout(graph);
        return this.graphToDataflow(layout);
    }

    dataflowToGraph(dataflow) {
        return dataflow
    }

    _computeLayout(graph) {
        return graph
    }

    graphToDataflow(graph) {
        return graph
    }
}