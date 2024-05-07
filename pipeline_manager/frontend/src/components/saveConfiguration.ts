/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import EditorManager from '../core/EditorManager';
import NotificationHandler from '../core/notifications';

interface SaveConfiguration {
    readonly?: boolean;
    hideHud?: boolean;
    position?: boolean;
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
    saveName: 'specification',

    saveCallback() {
        const blob = new Blob(
            [
                JSON.stringify(
                    EditorManager.getEditorManagerInstance().saveSpecification(),
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
