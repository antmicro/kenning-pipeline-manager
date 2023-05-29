/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Handles calculation of a SVG path a connection should have based on it's characteristic
 * (for example loopback) and style. It is handled by `ConnectionRenderer`, which
 * deals with saving the style user has chosen and delegating away the calculation to
 * suitable renderer
 */

/**
 * Defines the shift the connection should have compared to the default position based on the
 * index of the output interface bound to the connection in the node output interface array.
 * It allows to make a visual distinction between connections going to different interfaces
 * in the same node. The value of the shift is constant distance times the index of an
 * interface, adjusted for any canvas transformation
 *
 * @param ncFrom starting node reference
 * @param ncTo ending node reference
 * @param graph the graph definition
 * @param scaling number from viewPlugin defining the scaling of canvas
 * @param symmetric As default, the connections can be indexed from 0 to N-1. If this flag is
 * set to true, it will index from -(N-1)/2 to (N-1)/2
 * @returns Value the connection should shift from it's default position
 */

/* eslint-disable max-classes-per-file */
function getShift(ncFrom, ncTo, graph, scaling, symmetric = false) {
    const shiftDistance = 15;
    const fromNode = graph.findNodeById(ncFrom.nodeId);

    const outputInterfaceList = Object.values(fromNode.outputs);
    const index = outputInterfaceList.includes(ncFrom)
        ? outputInterfaceList.reverse().indexOf(ncFrom)
        : outputInterfaceList.reverse().indexOf(ncTo);
    const shiftIndex = symmetric ? index - (outputInterfaceList.length - 1) / 2 : index;
    return shiftDistance * shiftIndex * scaling;
}

/**
 * Used for loopback connections, calculates the y coordinate of a bottom point of a node
 * based on it's DOM element. If the element does not yet exists, returns 0
 *
 * @param connection BaklavaJS-defined connection
 * @param scaling number from viewPlugin defining the scaling of canvas
 * @param panning (x, y) point from viewPlugin defining the translation of canvas
 * @returns Y coordinate of a bottom of a node, adjusted for canvas transformation
 */
function nodeBottomPoint(connection, scaling, panning) {
    const { nodeId } = connection.from;
    const nodeHtml = document.getElementById(nodeId);
    const nodeBottom = nodeHtml ? nodeHtml.offsetTop + nodeHtml.offsetHeight : 0;
    return (nodeBottom + panning.y) * scaling;
}

/**
 * Utility function that calculates the x and y radius of an ellipse given center point and
 * a slope at a specified point
 *
 * @param x X coordinate of a point on an ellipse
 * @param y Y coordinate of a point on an ellipse
 * @param cx X coordinate of a center point
 * @param cy Y coordinate of a center point
 * @param slope dy/dx value on a (x, y) point
 * @returns Array of two elements: radius parallel to x axis and y axis respectively
 */
function calculateEllipseR(x, y, cx, cy, slope) {
    const rx = Math.sqrt(Math.abs((x - cx) * (x - cx) + ((x - cx) * (y - cy)) / slope));
    const ry = Math.sqrt(Math.abs((y - cy) * (y - cy) + (y - cy) * (x - cx) * slope));
    return [rx, ry];
}

class NormalizedConnection {
    /**
     * Class that makes sure that the connection is in correct order, which means that from and to
     * sockets and their coordinates are properly set.
     */
    constructor(x1, y1, x2, y2, connection) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.from = connection.from;
        if (connection.to) {
            this.to = connection.to;
            if (
                (this.from.direction === 'input' && this.to.direction === 'output') ||
                (this.from.direction === 'input' && this.to.direction === 'inout') ||
                (this.from.direction === 'inout' && this.to.direction === 'output')
            ) {
                [this.x1, this.x2, this.y1, this.y2] = [this.x2, this.x1, this.y2, this.y1];
                [this.from, this.to] = [this.to, this.from];
            }
        }
    }
}

export default class ConnectionRenderer {
    style = 'curved';

    styleMap = null;

    constructor(viewModel) {
        const graph = viewModel.displayedGraph;
        this.styleMap = new Map();
        this.styleMap.set('curved', {
            render(x1, y1, x2, y2) {
                const dx = 0.3 * Math.abs(x1 - x2);
                return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            },

            renderLoopback(x1, y1, x2, y2, connection) {
                const nc = new NormalizedConnection(x1, y1, x2, y2, connection);
                const shift = getShift(nc.from, nc.to, graph, graph.scaling) + 30 * graph.scaling;
                const bottomY = nodeBottomPoint(connection, graph.scaling, graph.panning);
                const y = bottomY + shift;

                const rightCx = nc.x1 - shift;
                const rightCy = (y + nc.y1) / 2;
                const [rightRx, rightRy] = calculateEllipseR(nc.x1, y, rightCx, rightCy, 1);

                const bottomCx = (nc.x1 + nc.x2) / 2;
                const bottomCy = bottomY;
                const [bottomRx, bottomRy] = calculateEllipseR(nc.x1, y, bottomCx, bottomCy, 1);

                const leftCx = nc.x2 + shift;
                const leftCy = (y + nc.y2) / 2;
                const [leftRx, leftRy] = calculateEllipseR(nc.x2, y, leftCx, leftCy, -1);

                return `M ${nc.x1} ${nc.y1}
                A ${rightRx} ${rightRy} 0 0 1 ${nc.x1} ${y}
                A ${bottomRx} ${bottomRy} 0 0 1 ${nc.x2} ${y}
                A ${leftRx} ${leftRy} 0 0 1 ${nc.x2} ${nc.y2}`;
            },
        });
        this.styleMap.set('orthogonal', {
            render(x1, y1, x2, y2, connection) {
                const nc = new NormalizedConnection(x1, y1, x2, y2, connection);
                const shift = getShift(nc.from, nc.to, graph, graph.scaling, true);
                const minMargin = 30;
                const middlePoint = (nc.x1 + nc.x2) / 2;

                if (connection.to) {
                    if (nc.from.direction === 'output') {
                        return `M ${nc.x1} ${nc.y1} H ${
                            shift + Math.max(nc.x1 + minMargin, middlePoint)
                        } V ${nc.y2} H ${nc.x2}`;
                    }

                    if (nc.to.direction === 'input' || nc.from.direction === 'inout') {
                        return `M ${nc.x1} ${nc.y1} H ${
                            shift + Math.min(nc.x1 - minMargin, nc.x2 - minMargin, middlePoint)
                        } V ${nc.y2} H ${nc.x2}`;
                    }
                }
                return `M ${nc.x1} ${nc.y1} H ${shift + middlePoint} V ${nc.y2} H ${nc.x2}`;
            },

            renderLoopback(x1, y1, x2, y2, connection) {
                const nc = new NormalizedConnection(x1, y1, x2, y2, connection);
                const shift = getShift(nc.from, nc.to, graph, graph.scaling) + 30 * graph.scaling;
                const bottomY = nodeBottomPoint(connection, graph.scaling, graph.panning);
                const y = bottomY + shift;

                return `M ${nc.x1} ${nc.y1}
                h ${shift}
                V ${y} H ${nc.x2 - shift} V ${nc.y2} H ${nc.x2}`;
            },
        });
    }

    /**
     * Chooses the render method based on active style and connection characteristic
     *
     * @param x1 X coordinate of input point
     * @param y1 Y coordinate of input point
     * @param x2 X coordinate of output point
     * @param y2 Y coordinate of output point
     * @param connection BaklavaJS-defined connection to render
     * @returns String defining connection path in SVG format
     */
    render(x1, y1, x2, y2, connection) {
        if (ConnectionRenderer.isLoopback(connection)) {
            return this.styleMap.get(this.style).renderLoopback(x1, y1, x2, y2, connection);
        }
        return this.styleMap.get(this.style).render(x1, y1, x2, y2, connection);
    }

    /**
     * Tests whether the connection is loopback (connects the node with itself)
     *
     * @param connection BaklavaJS-defined connection to test
     * @returns True if connection is loopback.
     */
    static isLoopback(connection) {
        // Temporary connections that are not connected to any output (.to is undefined)
        // are not loopback
        return !!connection.to && connection.from.nodeId === connection.to.nodeId;
    }
}
