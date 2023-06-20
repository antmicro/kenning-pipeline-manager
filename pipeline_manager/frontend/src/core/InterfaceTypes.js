/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

/* eslint-disable class-methods-use-this */
export default class BaklavaInterfaceTypes {
    types = new Map();

    defaultStyle = {
        interfaceConnectionPattern: 'solid',
        interfaceConnectionColor: '#FFFFFF',
        interfaceColor: '#FFFFFF',
    };

    /**
     * Initialize Interface types instance used to manager styles of interfaces and connections
     * and validate adding connections.
     *
     * @param viewPlugin
     * @param  editor
     */
    constructor(viewPlugin, editor) {
        editor.graphEvents.checkConnection.subscribe(this, ({ from, to }, prevent) => {
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

                if (firstType !== undefined) {
                    const color = this.types[firstType].interfaceColor;
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
     * Return connection style for a given from and to interfaces.
     * It takes style of a common type of those interfaces and completes its missing values
     * with defautl ones. If there are multiple common types, a default style is returned.
     *
     * If there is no `to` interface then a style for `from` interface is returned.
     * Again with completed missing values.
     *
     * @param {Interface} from
     * @param {Interface} to
     * @returns style for a defined connection
     */
    getConnectionStyle(from, to) {
        const fromTypes = this.normalizeType(from?.type);
        const toTypes = this.normalizeType(to?.type);

        if (to === undefined && from === undefined) {
            return this.defaultStyle;
        }

        if (to === undefined) {
            const firstType = fromTypes.find((t) => this.types[t] !== undefined);
            return { ...this.defaultStyle, ...this.types[firstType] };
        }

        const commonTypes = fromTypes.filter((t) => toTypes.includes(t));
        if (Array.isArray(commonTypes) && commonTypes.length > 1) {
            return this.defaultStyle;
        }

        const firstType = commonTypes.find((t) => this.types[t] !== undefined);
        return { ...this.defaultStyle, ...this.types[firstType] };
    }

    /**
     * Function that reads all nodes in the specification and creates `NodeInterfaceType` objects
     * for their inputs' and outputs' types so that a simple validation based on those
     * types can be performed.
     *
     * The read interface types are stored in `interfaceTypes` object which is returned by
     * this function
     * @param {*} metadata metadata containing information about styling
     * @returns read interface types
     */
    readInterfaceTypes(metadata) {
        this.types = {};

        if ('interfaces' in metadata && metadata.interfaces) {
            Object.entries(metadata.interfaces).forEach(([type, io]) => {
                this.types[type] = { name: type };
                this.types[type].interfaceConnectionPattern =
                    this.defaultStyle.interfaceConnectionPattern;
                this.types[type].interfaceConnectionColor = io.interfaceConnectionColor;
                this.types[type].interfaceColor = io.interfaceColor;
            });
        }
    }
}
