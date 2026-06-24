/*
 * Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import { validateCssObject, getCssString } from './cssValidation.ts';

/**
 * Class that allows for dynamic modification of css styles of nodes and their
 * parts based on the style attribute they have assigned.
 */
/* eslint-disable class-methods-use-this */
export default class BaklavaNodeStyler {
    nodeStyles = new Map();

    defaultStyle = {
        show: true,
    };

    editor = undefined;

    /**
     * Initialize Node styler instance used to manage styles of nodes.
     */
    constructor(viewPlugin) {
        this.editor = viewPlugin.editor;
        viewPlugin.hooks.renderNode.subscribe(this, ({ node, el }) => {
            // eslint-disable-next-line prefer-destructuring
            const style = this.editor.getNodeTypeStyle(node.type);
            const firstType = this.nodeStyles[style];
            if (!firstType) return { node, el };
            const title = el.querySelector('.__title');
            const content = el.querySelector('.__content');
            const selectors = { title, content, body: el };
            ['title', 'content', 'body'].forEach((attr) => {
                if (!selectors[attr]) return;
                if (!firstType[attr]) return;
                Object.entries(firstType[attr]).forEach(([p, v]) => selectors[attr].style.setProperty(p, v, 'important'));
            });
            return { node, el };
        });
    }

    /**
     * Function that reads all nodes in the specification and creates
     * dictionary of CSS visual styles. Each visual effect is assigned to one
     * KPM style. Then for each KPM style 'title' 'content' and 'body' styles
     * are extracted.
     *
     * The read node styling types are stored in 'nodeStyles' object returned by
     * this function
     * @param {*} metadata metadata containing information about styling
     * @returns read node styles
     */
    readNodeStyles(metadata) {
        this.nodeStyles = {};
        if (!metadata?.styles) return {};
        Object.entries(metadata?.styles).filter(([_, style]) => style?.nodes)
            .forEach(([styleName, style]) => {
                const io = style.nodes;
                this.nodeStyles[styleName] = { ...io };
                const entries = ['title', 'content', 'body'];
                entries.forEach((e) => {
                    if (!io[e]) return;
                    if (!validateCssObject(io[e])) {
                        throw new Error(`invalid CSS provided in property-specific styling:\n${getCssString(io[e])}`);
                    }
                });
            });
        return this.nodeStyles;
    }
}
