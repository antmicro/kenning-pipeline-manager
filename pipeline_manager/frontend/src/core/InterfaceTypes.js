/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import { computed } from 'vue';

/* eslint-disable class-methods-use-this */
export default class BaklavaInterfaceTypes {
    viewPlugin;

    editor;

    types = new Map();

    constructor(viewPlugin, editor) {
        this.viewPlugin = viewPlugin;
        this.editor = editor;
        this.connections = computed(() => this.viewPlugin.displayedGraph.connections);

        this.editor.graphEvents.checkConnection.subscribe(this, ({ from, to }, prevent) => {
            const fromTypes = this.normalizeType(from.type);
            const toTypes = this.normalizeType(to.type);

            const commonTypes = fromTypes.filter((t) => toTypes.includes(t));

            if (Array.isArray(commonTypes) && commonTypes.length) {
                return;
            }

            return prevent(); // eslint-disable-line consistent-return
        });

        viewPlugin.hooks.renderInterface.subscribe(this, ({ intf, el }) => {
            if (intf.type) {
                const types = this.normalizeType(intf.type);
                const firstType = types.find((t) => this.types[t]?.interfaceColor !== undefined);
                const color = this.types[firstType].interfaceColor;

                if (color !== undefined) {
                    el.querySelector('.__port').style.backgroundColor = color; // eslint-disable-line no-param-reassign
                }
            }

            return { intf, el };
        });
    }

    normalizeType(type) {
        return typeof type === 'string' || type instanceof String ? [type] : type;
    }

    /**
     * Function that reads all nodes in the specification and creates `NodeInterfaceType` objects
     * for their inputs' and outputs' types so that a simple validation based on those
     * types can be performed.
     *
     * The read interface types are stored in `interfaceTypes` object which is returned by
     * this function
     * @param {*} nodes nodes of the specification
     * @param {*} metadata metadata containing information about styling
     * @returns read interface types
     */
    readInterfaceTypes(nodes, metadata) {
        this.types = {};

        nodes.forEach((node) => {
            [...node.interfaces].forEach((io) => {
                if (!Object.prototype.hasOwnProperty.call(this.types, io.type)) {
                    this.types[io.type] = { name: io.type };

                    if ('interfaces' in metadata && io.type in metadata.interfaces) {
                        this.types[io.type].interfaceConnectionPattern =
                            metadata.interfaces[io.type].interfaceConnectionPattern ?? 'solid';
                        this.types[io.type].interfaceConnectionColor =
                            metadata.interfaces[io.type].interfaceConnectionColor ?? '#FFFFFF';
                        this.types[io.type].interfaceColor =
                            metadata.interfaces[io.type].interfaceColor;
                    }
                }
            });
        });
    }
}
