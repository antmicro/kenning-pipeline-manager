/*
 * Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { toPng, toSvg } from 'html-to-image';
import EditorManager from '../core/EditorManager';
import NotificationHandler from '../core/notifications';
import { brokenImage } from '../../../resources/broken_image.js';

interface SaveConfiguration {
    readonly?: boolean;
    hideHud?: boolean;
    position?: boolean;
    graph?: boolean;
    graphName?: string | null;
    saveName: string;

    saveCallback: () => void;
    saveCallbackCustomFormat?: (blob: string) => void;

    reset(): void;
}

const saveBlob = (blob: Blob, filename: string) => {
    const linkElement = document.createElement('a');
    linkElement.href = window.URL.createObjectURL(blob);
    linkElement.download = filename;
    linkElement.click();
};

export const saveSpecificationConfiguration: SaveConfiguration = {
    graph: false,
    saveName: 'specification',

    saveCallback() {
        const editorManager = EditorManager.getEditorManagerInstance();
        const specification = editorManager.saveSpecification();
        if (this.graph) {
            specification.graphs ??= [];
            const dataflow = editorManager.saveDataflow();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dataflow.graphs.forEach((graph: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const prevIndex = specification.graphs.map((g: any) => g.id).indexOf(graph.id);
                const [index, remove] = prevIndex !== -1
                    ? [prevIndex, 1]
                    : [specification.graphs.length, 0];
                specification.graphs.splice(index, remove, graph);
            });
            specification.entryGraph = dataflow.entryGraph ?? dataflow.graphs[0].id;

            Object.entries(dataflow.metadata).forEach(([key, value]) => {
                if (value !== undefined) {
                    specification.metadata[key] = value;
                }
            });
        }

        const blob = new Blob(
            [
                JSON.stringify(
                    specification,
                    null,
                    4,
                ),
            ],
            { type: 'application/json' },
        );
        saveBlob(blob, this.saveName);
        NotificationHandler.showToast('info', 'Specification saved');
    },

    reset() {
        this.saveName = 'specification';
    },
};

export const saveGraphConfiguration: SaveConfiguration = {
    readonly: false,
    hideHud: false,
    position: false,
    graphName: null,
    saveName: 'save',

    saveCallback() {
        const blob = new Blob([JSON.stringify(EditorManager.getEditorManagerInstance().saveDataflow(
            this.readonly,
            this.hideHud,
            this.position,
            this.graphName,
        ), null, 4)], {
            type: 'application/json',
        });
        saveBlob(blob, this.saveName);
        NotificationHandler.showToast('info', 'Dataflow saved');
    },

    saveCallbackCustomFormat(blob: string) {
        const saveElement = document.createElement('a');
        let mimeType;
        if (typeof blob === 'string') {
            mimeType = 'application/octet-stream';
            saveElement.href = `data:${mimeType};base64,${blob}`;
        } else {
            mimeType = 'application/json';
            saveElement.href = window.URL.createObjectURL(
                new Blob(
                    [JSON.stringify(blob)],
                    { type: mimeType }),
            );
        }
        saveElement.download = this.saveName;
        saveElement.click();
        NotificationHandler.showToast('info', `File saved successfully: ${this.saveName}`);
    },

    reset() {
        const dataflow = EditorManager.getEditorManagerInstance().saveDataflow();
        const graphName: string | null | undefined = (dataflow.entryGraph
            ? (dataflow.graphs
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .find((dataflowGraph: any) => dataflowGraph.id === dataflow.entryGraph)
                ?.name)
            : dataflow.graphs[0]?.name) ?? null;

        this.readonly = false;
        this.hideHud = false;
        this.position = false;
        this.graphName = graphName;
        this.saveName = 'save';
    },
};

export const exportGraph = {
    width: 1920,
    height: 1080,
    maxWidth: 16384,
    maxHeight: 16384,
    saveName: 'dataflow',

    exportCallback() {
        // Get editor with data flow
        const nodeEditor: HTMLElement = document.querySelector('.inner-editor')!;
        // Exclude node palette
        const filter = (node: any) => !node.classList?.contains('baklava-node-palette');

        if (this.width < 0) {
            NotificationHandler.showToast('error', `Negative width. The image could not be saved.`);
            return;
        }
        if (this.height < 0) {
            NotificationHandler.showToast('error', `Negative height. The image could not be saved.`);
            return;
        }
        if (this.width > this.maxWidth) {
            NotificationHandler.showToast('warning', `Invalid width. The maximum value ${this.maxWidth} was used instead.`);
            this.width = this.maxWidth;
        }
        if (this.height > this.maxHeight) {
            NotificationHandler.showToast('warning', `Invalid height. The maximum value ${this.maxHeight} was used instead.`);
            this.height = this.maxHeight;
        }

        toPng(nodeEditor, {
            filter,
            imagePlaceholder: brokenImage,
            canvasWidth: this.width,
            canvasHeight: this.height,
        })
            .then((dataUrl) => {
                const downloadLink = document.createElement('a');
                downloadLink.download = this.saveName;
                downloadLink.href = dataUrl;
                downloadLink.dataset.downloadurl = [
                    dataUrl,
                    downloadLink.download,
                    downloadLink.href,
                ].join(':');
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            })
            .catch((error) => {
                NotificationHandler.showToast('error', `Export to PNG failed: ${error}`);
            });
    },

    reset() {
        this.width = 1920;
        this.height = 1080;
        this.saveName = 'save';
    },
};
