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
 * index of the `from` interface and `to` interface bound to the connection in the nodes.
 * It allows to make a visual distinction between connections going to different interfaces
 * in the same node. The value of the shift is constant distance times the index of an
 * interface, adjusted for any canvas transformation
 * This funnction is symmetrical.
 *
 * @param ncFrom from node reference
 * @param ncTo to node reference
 * @param graph the graph definition
 * @param scaling number from viewModel defining the scaling of canvas
 * @returns Value the connection should shift from it's default position
 */

/* eslint-disable max-classes-per-file */
function getShift(ncFrom, ncTo, graph, scaling) {
    const shiftDistance = 15;
    const fromNode = graph.findNodeById(ncFrom.nodeId);
    const toNode = graph.findNodeById(ncTo.nodeId);

    const fromNodeNeighbours = [
        ...Object.values(fromNode.inputs),
        ...Object.values(fromNode.outputs),
    ].filter((c) => c.connectionSide === ncFrom.connectionSide && c.port);
    const toNodeNeighbours = [
        ...Object.values(toNode.inputs),
        ...Object.values(toNode.outputs),
    ].filter((c) => c.connectionSide === ncTo.connectionSide && c.port);

    const fromIndex = fromNodeNeighbours.indexOf(ncFrom);
    const toIndex = toNodeNeighbours.indexOf(ncTo);

    const shiftIndex =
        (fromIndex + toIndex - toNodeNeighbours.length + fromNodeNeighbours.length - 2) / 2;
    return shiftDistance * shiftIndex * scaling;
}

/**
 * Used for loopback connections, calculates the y coordinate of a bottom point of a node
 * based on it's DOM element. If the element does not yet exists, returns 0
 *
 * @param connection BaklavaJS-defined connection
 * @param scaling number from viewModel defining the scaling of canvas
 * @param panning (x, y) point from viewModel defining the translation of canvas
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
        this.styleMap = new Map();
        this.styleMap.set('curved', {
            render(x1, y1, x2, y2, connection) {
                const nc = new NormalizedConnection(x1, y1, x2, y2, connection);
                const dx = 0.3 * Math.abs(nc.x1 - nc.x2);

                if (nc.to) {
                    if (nc.from.connectionSide === 'right' && nc.to.connectionSide === 'left') {
                        return `M ${nc.x1} ${nc.y1} C ${nc.x1 + dx} ${nc.y1}, ${nc.x2 - dx} ${
                            nc.y2
                        }, ${nc.x2} ${nc.y2}`;
                    }
                    if (nc.from.connectionSide === 'left' && nc.to.connectionSide === 'right') {
                        return `M ${nc.x1} ${nc.y1} C ${nc.x1 - dx} ${nc.y1}, ${nc.x2 + dx} ${
                            nc.y2
                        }, ${nc.x2} ${nc.y2}`;
                    }
                    if (nc.from.connectionSide === 'right' && nc.to.connectionSide === 'right') {
                        const rightmost = Math.max(nc.x1 + dx, nc.x2 + dx);
                        return `M ${nc.x1} ${nc.y1} C ${rightmost} ${nc.y1}, ${rightmost} ${nc.y2}, ${nc.x2} ${nc.y2}`;
                    }
                    if (nc.from.connectionSide === 'left' && nc.to.connectionSide === 'left') {
                        const leftmost = Math.min(nc.x1 - dx, nc.x2 - dx);
                        return `M ${nc.x1} ${nc.y1} C ${leftmost} ${nc.y1}, ${leftmost} ${nc.y2}, ${nc.x2} ${nc.y2}`;
                    }
                }

                if (nc.from.connectionSide === 'right') {
                    return `M ${nc.x1} ${nc.y1} C ${nc.x1 + dx} ${nc.y1}, ${nc.x2 - dx} ${nc.y2}, ${
                        nc.x2
                    } ${nc.y2}`;
                }
                if (nc.from.connectionSide === 'left') {
                    return `M ${nc.x1} ${nc.y1} C ${nc.x1 - dx} ${nc.y1}, ${nc.x2 + dx} ${nc.y2}, ${
                        nc.x2
                    } ${nc.y2}`;
                }

                // unreachable, added to make eslint happy
                return undefined;
            },
            renderLoopback(x1, y1, x2, y2, connection) {
                const graph = viewModel.displayedGraph;
                const nc = new NormalizedConnection(x1, y1, x2, y2, connection);
                const sideMargin = 30 * graph.scaling;

                if (nc.from.connectionSide === 'left' && nc.to.connectionSide === 'left') {
                    const leftRx = sideMargin;
                    const leftRy = Math.abs(nc.y1 - nc.y2) / 2;
                    const renderingSide = nc.y1 > nc.y2 ? 1 : 0;

                    return `M ${nc.x1} ${nc.y1}
                    A ${leftRx} ${leftRy} 0 0 ${renderingSide} ${nc.x2} ${nc.y2}`;
                }
                if (nc.from.connectionSide === 'right' && nc.to.connectionSide === 'right') {
                    const leftRx = sideMargin;
                    const leftRy = Math.abs(nc.y1 - nc.y2) / 2;
                    const renderingSide = nc.y1 > nc.y2 ? 0 : 1;

                    return `M ${nc.x1} ${nc.y1}
                    A ${leftRx} ${leftRy} 0 0 ${renderingSide} ${nc.x2} ${nc.y2}`;
                }

                const shift = getShift(nc.from, nc.to, graph, graph.scaling) + 30 * graph.scaling;

                const leftx = nc.from.connectionSide === 'left' ? nc.x1 : nc.x2;
                const rightx = nc.to.connectionSide === 'right' ? nc.x2 : nc.x1;

                const lefty = nc.from.connectionSide === 'left' ? nc.y1 : nc.y2;
                const righty = nc.to.connectionSide === 'right' ? nc.y2 : nc.y1;
                const bottomY = nodeBottomPoint(connection, graph.scaling, graph.panning);

                const y = bottomY + shift;

                const rightCx = rightx - shift;
                const rightCy = (y + righty) / 2;
                const [rightRx, rightRy] = calculateEllipseR(rightx, y, rightCx, rightCy, 1);

                const bottomCx = (rightx + leftx) / 2;
                const bottomCy = bottomY;
                const [bottomRx, bottomRy] = calculateEllipseR(rightx, y, bottomCx, bottomCy, 1);

                const leftCx = leftx + shift;
                const leftCy = (y + lefty) / 2;
                const [leftRx, leftRy] = calculateEllipseR(leftx, y, leftCx, leftCy, -1);

                return `M ${rightx} ${righty}
                A ${rightRx} ${rightRy} 0 0 1 ${rightx} ${y}
                A ${bottomRx} ${bottomRy} 0 0 1 ${leftx} ${y}
                A ${leftRx} ${leftRy} 0 0 1 ${leftx} ${lefty}`;
            },
        });
        this.styleMap.set('orthogonal', {
            render(x1, y1, x2, y2, connection) {
                const graph = viewModel.displayedGraph;
                const nc = new NormalizedConnection(x1, y1, x2, y2, connection);
                const minMargin = 30 * graph.scaling;
                const middlePoint = (nc.x1 + nc.x2) / 2;
                if (connection.to) {
                    const shift = getShift(nc.from, nc.to, graph, graph.scaling);
                    if (nc.from.connectionSide === 'right' && nc.to.connectionSide === 'left') {
                        return `M ${nc.x1} ${nc.y1} H ${
                            shift + Math.max(nc.x1 + minMargin, middlePoint)
                        } V ${nc.y2} H ${nc.x2}`;
                    }
                    if (nc.from.connectionSide === 'left' && nc.to.connectionSide === 'right') {
                        return `M ${nc.x2} ${nc.y2} H ${
                            shift + Math.max(nc.x2 + minMargin, middlePoint)
                        } V ${nc.y1} H ${nc.x1}`;
                    }
                    if (nc.from.connectionSide === 'right' && nc.to.connectionSide === 'right') {
                        return `M ${nc.x1} ${nc.y1} H ${
                            shift + Math.max(nc.x1 + minMargin, nc.x2 + minMargin, middlePoint)
                        } V ${nc.y2} H ${nc.x2}`;
                    }
                    if (nc.from.connectionSide === 'left' && nc.to.connectionSide === 'left') {
                        return `M ${nc.x1} ${nc.y1} H ${
                            shift + Math.min(nc.x1 - minMargin, nc.x2 - minMargin, middlePoint)
                        } V ${nc.y2} H ${nc.x2}`;
                    }
                }
                return `M ${nc.x1} ${nc.y1} H ${middlePoint} V ${nc.y2} H ${nc.x2}`;
            },
            renderLoopback(x1, y1, x2, y2, connection) {
                const graph = viewModel.displayedGraph;
                const nc = new NormalizedConnection(x1, y1, x2, y2, connection);
                const shift = getShift(nc.from, nc.to, graph, graph.scaling) + 30 * graph.scaling;
                const bottomY = nodeBottomPoint(connection, graph.scaling, graph.panning);
                const y = bottomY + shift;

                if (nc.from.connectionSide === 'right' && nc.to.connectionSide === 'left') {
                    return `M ${nc.x1} ${nc.y1}
                    h ${shift}
                    V ${y} H ${nc.x2 - shift} V ${nc.y2} H ${nc.x2}`;
                }
                if (nc.from.connectionSide === 'left' && nc.to.connectionSide === 'right') {
                    return `M ${nc.x2} ${nc.y2}
                    h ${shift}
                    V ${y} H ${nc.x1 - shift} V ${nc.y1} H ${nc.x1}`;
                }
                if (nc.from.connectionSide === 'right' && nc.to.connectionSide === 'right') {
                    return `M ${nc.x2} ${nc.y2}
                    h ${shift}
                    V ${nc.y1} H ${nc.x1}`;
                }
                if (nc.from.connectionSide === 'left' && nc.to.connectionSide === 'left') {
                    return `M ${nc.x2} ${nc.y2}
                    h ${-shift}
                    V ${nc.y1} H ${nc.x1}`;
                }
                // unreachable, added to make eslint happy
                return undefined;
            },
        });
    }

    /**
     * Chooses the render method based on active style and connection characteristic
     *
     * @param x1 X coordinate of from interface
     * @param y1 Y coordinate of from interface
     * @param x2 X coordinate of to interface
     * @param y2 Y coordinate of to interface
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
