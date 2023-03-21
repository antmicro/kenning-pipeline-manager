<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<script>
import Logo from '../icons/Logo.vue';
import Arrow from '../icons/Arrow.vue';
import Run from '../icons/Run.vue';
import Validate from '../icons/Validate.vue';
import Backend from '../icons/Backend.vue';
import Bell from '../icons/Bell.vue';
import DropdownItem from './DropdownItem.vue';
import EditorManager from '../core/EditorManager';
import { alertBus } from '../core/bus';
import { backendApiUrl, HTTPCodes } from '../core/utils';

export default {
    components: {
        Logo,
        Arrow,
        Run,
        Validate,
        Backend,
        Bell,
        DropdownItem,
    },
    data() {
        return {
            editorManager: EditorManager.getEditorManagerInstance(),
            externalApplicationConnected: false,
            backendAvailable: backendApiUrl !== null,
            isNotificationPanelOpen: false,
        };
    },
    methods: {
        // Open or show notificationPanel with slide animation
        toogleNavigationPanel() {
            this.isNotificationPanelOpen = !this.isNotificationPanelOpen;

            const negativeNotificationPanelWidth = '-495px'; // width of notification panel (negative because we want hide it on close)
            const resetNotificationPanelTransition = '0px'; // reset notification panel transition to show it

            const notificationPanel = document.querySelector('.notifications');
            if (notificationPanel) {
                notificationPanel.style.transform = `translateX(${
                    this.isNotificationPanelOpen
                        ? negativeNotificationPanelWidth
                        : resetNotificationPanelTransition
                })`;
            }
        },
        /**
         * Event handler that Loads a dataflow from a file.
         * It the loading is successful it is loaded as the current dataflow.
         * Otherwise the user is alerted with a feedback message.
         */
        loadDataflow() {
            const file = document.getElementById('load-dataflow-button').files[0];
            if (!file) return;
            const fileReader = new FileReader();
            fileReader.onload = () => {
                let dataflow = null;
                try {
                    dataflow = JSON.parse(fileReader.result);
                } catch (exception) {
                    if (exception instanceof SyntaxError) {
                        alertBus.$emit('displayAlert', `Not a proper JSON file.\n${exception}`);
                    } else {
                        alertBus.$emit('displayAlert', `Unknown error.\n${exception}`);
                    }
                    return;
                }
                const errors = this.editorManager.loadDataflow(dataflow);
                if (Array.isArray(errors) && errors.length) {
                    alertBus.$emit('displayAlert', errors);
                } else {
                    alertBus.$emit('displayAlert', 'Dataflow loaded successfully');
                }
            };
            fileReader.readAsText(file);
        },
        /**
         * Event handler that that saves a current dataflow to a `save.json` file.
         */
        saveDataflow() {
            const blob = new Blob([JSON.stringify(this.editorManager.saveDataflow())], {
                type: 'application/json',
            });
            const linkElement = document.createElement('a');
            linkElement.href = window.URL.createObjectURL(blob);
            linkElement.download = 'save';
            linkElement.click();
            alertBus.$emit('displayAlert', 'Dataflow saved');
        },
        /**
         * Event handler that loads a file and asks the backend to delegate this operation
         * to the external application to parse it into the Pipeline Manager format
         * so that it can be loaded into the editor.
         * It the validation is successful it is loaded as the current dataflow.
         * Otherwise the user is alerted with a feedback message.
         */
        async importDataflow() {
            const file = document.getElementById('request-dataflow-button').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('external_application_dataflow', file);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': backendApiUrl,
                    'Access-Control-Allow-Headers':
                        'Origin, X-Requested-With, Content-Type, Accept',
                },
            };

            const response = await fetch(`${backendApiUrl}/import_dataflow`, requestOptions);
            const data = await response.text();
            let message = 'Imported dataflow';

            if (response.status === HTTPCodes.OK) {
                const errors = this.editorManager.loadDataflow(JSON.parse(data));
                if (Array.isArray(errors) && errors.length) {
                    message = errors;
                }
            } else if (response.status === HTTPCodes.ServiceUnavailable) {
                // Service Unavailable, which means
                // that the external application was disconnected
                message = data;
                this.externalApplicationConnected = false;
            } else if (response.status === HTTPCodes.BadRequest) {
                message = data;
            }
            alertBus.$emit('displayAlert', message);
        },
        /**
         * Event handler that loads a current dataflow from the editor and sends a request
         * to the backend based on the action argument.
         * The user is alerted with a feedback message.
         */
        async requestDataflowAction(action) {
            const dataflow = JSON.stringify(this.editorManager.saveDataflow());
            if (!dataflow) return;

            const formData = new FormData();
            formData.append('dataflow', dataflow);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': backendApiUrl,
                    'Access-Control-Allow-Headers':
                        'Origin, X-Requested-With, Content-Type, Accept',
                },
            };

            if (action === 'run') {
                alertBus.$emit('displayAlert', 'Running dataflow', true);
            }

            const response = await fetch(
                `${backendApiUrl}/dataflow_action_request/${action}`,
                requestOptions,
            );
            const data = await response.text();

            alertBus.$emit('displayAlert', data);
            if (response.status === HTTPCodes.ServiceUnavailable) {
                // Service Unavailable, which means
                // that the external application was disconnected
                this.externalApplicationConnected = false;
            }
        },
    },
};
</script>

<template>
    <div class="container">
        <div>
            <div class="logo">
                <Logo />
                <Arrow color="white" rotate="left" scale="small" />
                <div class="dropdown-wrapper">
                    <DropdownItem id="'load-dataflow-button'" text="Load" :onClick="loadDataflow" />
                    <DropdownItem type="'button'" text="Save" :onClick="saveDataflow" />
                    <hr />
                    <DropdownItem
                        text="Load visualization graph"
                        id="request-dataflow-button"
                        :onClick="importDataflow"
                    />
                    <DropdownItem
                        text="Save visualization graph"
                        type="'button'"
                        :onClick="() => requestDataflowAction('export')"
                    />
                </div>
            </div>

            <div>
                <Arrow />
                <div class="tooltip">
                    <span>Undo</span>
                </div>
            </div>
            <div>
                <Arrow rotate="right" />
                <div class="tooltip">
                    <span>Redo</span>
                </div>
            </div>
            <div>
                <button @click="() => requestDataflowAction('run')"><Run /></button>
                <div class="tooltip">
                    <span>Run</span>
                </div>
            </div>
            <div>
                <button @click="() => requestDataflowAction('validate')"><Validate /></button>
                <div class="tooltip">
                    <span>Validate</span>
                </div>
            </div>
        </div>
        <span> Running dataflow </span>
        <div>
            <div>
                <Backend />
                <div class="tooltip">
                    <span>Backend status</span>
                </div>
            </div>
            <div>
                <button @click="toogleNavigationPanel">
                    <Bell />
                </button>
                <div class="tooltip last">
                    <span>Notifications</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
@import '../../styles/variables.scss';

.container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 60px;
    padding: 0 $spacing-l;
    background-color: $gray-600;

    & > div {
        display: inherit;
        align-items: center;
        gap: $spacing-xxl;
        height: 100%;

        & > div {
            display: inherit;
            align-items: inherit;
            gap: $spacing-xs;
            position: relative;
            height: 100%;

            & > .dropdown-wrapper {
                width: max-content;
                position: absolute;
                flex-direction: column;
                margin: 0 $spacing-s;
                padding: $spacing-xs 0;
                top: 100%;
                width: fit-content;
                left: -20px;
                z-index: 1;
                display: none;
                background-color: $gray-600;
                border: 1px solid $gray-500;
            }

            & > .tooltip {
                @extend .dropdown-wrapper;
                border-radius: 15px;
                padding: $spacing-s;
                left: 0;
                transform: translateX(-50%);
            }

            & > .last {
                transform: translateX(-75%);
            }

            &.logo:hover > svg:last-of-type {
                rotate: 90deg;
            }

            &:hover > .dropdown-wrapper {
                display: flex;
            }
        }
    }
}

span {
    font-size: $fs-small;
    color: $white;
    user-select: none;
}
</style>
