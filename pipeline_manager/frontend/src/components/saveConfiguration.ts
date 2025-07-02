/*
 * Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import EditorManager from '../core/EditorManager';
import NotificationHandler from '../core/notifications';

interface SaveConfiguration {
    readonly?: boolean;
    hideHud?: boolean;
    position?: boolean;
    graph?: boolean;
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
                const prevIndex = specification.graphs.map((g: any) => g.id).indexOf(graph.id);
                const [index, remove] = prevIndex !== -1
                    ? [prevIndex, 1]
                    : [specification.graphs.length, 0];
                specification.graphs.splice(index, remove, graph);
            });
            specification.entryGraph = dataflow.entryGraph ?? dataflow.graphs[0].id;
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
    saveName: 'save',

    saveCallback() {
        const blob = new Blob([JSON.stringify(EditorManager.getEditorManagerInstance().saveDataflow(
            this.readonly,
            this.hideHud,
            this.position,
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
        this.readonly = false;
        this.hideHud = false;
        this.position = false;
        this.saveName = 'save';
    },
};
