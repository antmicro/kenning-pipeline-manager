<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Navigation bar of the application.
Displays user interface and main details about the Pipeline Manager status.
-->

<script>
import { toPng } from 'html-to-image';
import Logo from '../icons/Logo.vue';
import Arrow from '../icons/Arrow.vue';
import Run from '../icons/Run.vue';
import Validate from '../icons/Validate.vue';
import Backend from '../icons/Backend.vue';
import Bell from '../icons/Bell.vue';
import Cube from '../icons/Cube.vue';
import DropdownItem from './DropdownItem.vue';
import Cogwheel from '../icons/Cogwheel.vue';
import EditorManager from '../core/EditorManager';
import NotificationHandler from '../core/notifications';
import { notificationStore } from '../core/stores';
import ExternalApplicationManager from '../core/ExternalApplicationManager';
import Notifications from './Notifications.vue';
import Settings from './Settings.vue';

export default {
    components: {
        Logo,
        Arrow,
        Run,
        Validate,
        Backend,
        Bell,
        DropdownItem,
        Notifications,
        Cogwheel,
        Settings,
        Cube,
    },
    data() {
        return {
            editorManager: EditorManager.getEditorManagerInstance(), // create instance of baklava
            /* create instance of external manager to control
            connection, dataflow and spectification
            */
            externalApplicationManager: new ExternalApplicationManager(),
            notificationStore,
            // Toggleable panels and their configuration
            panels: {
                notifications: {
                    isOpen: false,
                    class: '.notifications',
                    iconRef: 'notifications',
                    showTransform: '-495px, 0px',
                    hideTransform: '0px, 0px',
                },
                palette: {
                    isOpen: true,
                    class: '.baklava-node-palette',
                    iconRef: 'palette',
                    showTransform: '0px, 0px',
                    hideTransform: '-300px, 0px',
                },
                backendStatus: {
                    isOpen: false,
                    class: '.backend-status',
                    iconRef: 'backend',
                    showTransform: '-89%, 0px',
                    hideTransform: '-89%, -180px',
                },
                settings: {
                    isOpen: false,
                    class: '.settings-panel',
                    iconRef: 'settings',
                    showTransform: '-495px, 0px',
                    hideTransform: '0px, 0px',
                },
            },
        };
    },
    methods: {
        /**
         * Loads nodes' specification from JSON structure.
         */
        loadSpecification(specification) {
            let errors = this.editorManager.validateSpecification(specification);
            if (Array.isArray(errors) && errors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
                return;
            }
            errors = this.editorManager.updateEditorSpecification(specification);
            if (Array.isArray(errors) && errors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
                return;
            }

            NotificationHandler.showToast('info', 'Specification loaded successfully');
        },

        /**
         * Event handler that loads a specification passed by the user
         * and asks the validates it.
         * If the validation is successful it is passed to the editor that
         * renders a new environment.
         * Otherwise user is alerted with a feedback message.
         */
        loadSpecificationCallback() {
            const file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            const fileReader = new FileReader();

            fileReader.onload = () => {
                let specification = null;
                try {
                    specification = JSON.parse(fileReader.result);
                } catch (exception) {
                    if (exception instanceof SyntaxError) {
                        NotificationHandler.terminalLog(
                            'error',
                            'Not a proper JSON file',
                            exception.toString(),
                        );
                    } else {
                        NotificationHandler.terminalLog(
                            'error',
                            'Unknown error',
                            exception.toString(),
                        );
                    }
                    return;
                }
                this.loadSpecification(specification);
            };

            fileReader.readAsText(file);
        },

        /* eslint-disable no-param-reassign */
        togglePanel(panel, disable = false) {
            const panelSelector = document.querySelector(panel.class);
            const iconRef = this.$refs[panel.iconRef];

            if (disable) {
                panel.isOpen = false;
            } else {
                panel.isOpen = !panel.isOpen;
            }
            const isPanelOpen = panel.isOpen;

            if (panelSelector) {
                panelSelector.style.transition = `transform ${isPanelOpen ? '0.4' : '0.2'}s`;
                panelSelector.style.transform = `translate(${
                    isPanelOpen ? panel.showTransform : panel.hideTransform
                })`;

                iconRef.classList.toggle('open', isPanelOpen);
            }
        },

        clickOutside(event, panel) {
            const icon = this.$refs[panel.iconRef];

            const currentElement = event.target;
            if (icon.contains(currentElement) || icon === currentElement) {
                return;
            }

            this.togglePanel(panel, true);
        },

        /**
         * Loads nodes' specification from JSON structure.
         */
        loadDataflow(dataflow) {
            const errors = this.editorManager.loadDataflow(dataflow);
            if (Array.isArray(errors) && errors.length) {
                NotificationHandler.terminalLog('error', 'Dataflow is invalid', errors);
            } else {
                NotificationHandler.showToast('info', 'Dataflow loaded successfully');
            }
        },
        /**
         * Event handler that Loads a dataflow from a file.
         * It the loading is successful it is loaded as the current dataflow.
         * Otherwise the user is alerted with a feedback message.
         */
        loadDataflowCallback() {
            const file = document.getElementById('load-dataflow-button').files[0];
            if (!file) return;

            const fileReader = new FileReader();

            fileReader.onload = () => {
                let dataflow = null;
                try {
                    dataflow = JSON.parse(fileReader.result);
                } catch (exception) {
                    if (exception instanceof SyntaxError) {
                        NotificationHandler.terminalLog(
                            'error',
                            'Not a proper JSON file',
                            exception.toString(),
                        );
                    } else {
                        NotificationHandler.terminalLog(
                            'error',
                            'Unknown error',
                            exception.toString(),
                        );
                    }
                    return;
                }

                this.loadDataflow(dataflow);
            };

            fileReader.readAsText(file);
        },
        /**
         * Event handler that that saves a current dataflow to a `save.json` file.
         */
        saveDataflow() {
            const blob = new Blob([JSON.stringify(this.editorManager.saveDataflow(), null, 4)], {
                type: 'application/json',
            });
            const linkElement = document.createElement('a');
            linkElement.href = window.URL.createObjectURL(blob);
            linkElement.download = 'save';
            linkElement.click();
            NotificationHandler.showToast('info', 'Dataflow saved');
        },

        async requestDataflowAction(action) {
            if (!this.externalApplicationManager.backendAvailable) return;
            await this.externalApplicationManager.invokeFetchAction(
                this.externalApplicationManager.requestDataflowAction,
                action,
            );
        },
        async importDataflow() {
            if (!this.externalApplicationManager.backendAvailable) return;
            await this.externalApplicationManager.invokeFetchAction(
                this.externalApplicationManager.importDataflow,
            );
        },

        exportToPng() {
            // Get editor with data flow
            const nodeEditor = document.querySelector('.inner-editor');
            // Exclude node palette
            const filter = (node) => !node.classList?.contains('baklava-node-palette');

            toPng(nodeEditor, { filter })
                .then((dataUrl) => {
                    const downloadLink = document.createElement('a');
                    downloadLink.download = 'dataflow.png';
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
    },
    mounted() {
        // Create connection on page load
        if (this.externalApplicationManager.backendAvailable) {
            this.externalApplicationManager.invokeFetchAction(
                this.externalApplicationManager.initializeConnection,
            );
        }
        // Remove notifications during loadup of default settings
        NotificationHandler.setShowNotification(false);
        if (process.env.VUE_APP_SPECIFICATION_PATH !== undefined) {
            const specification = require(process.env.VUE_APP_SPECIFICATION_PATH); // eslint-disable-line global-require,max-len,import/no-dynamic-require
            this.loadSpecification(specification);
        }
        if (process.env.VUE_APP_DATAFLOW_PATH !== undefined) {
            const dataflow = require(process.env.VUE_APP_DATAFLOW_PATH); // eslint-disable-line global-require,max-len,import/no-dynamic-require
            this.loadDataflow(dataflow);
        }
        // During specification load, show option may be set to either true or false
        // We do not want to set the showNotification to hardcoded value true, but rather
        // to the value of option set in specification
        NotificationHandler.restoreShowNotification();
    },
};
</script>

<template>
    <div class="wrapper">
        <div class="container">
            <div>
                <div class="logo">
                    <Logo />
                    <Arrow color="white" rotate="left" scale="small" />
                    <div class="dropdown-wrapper">
                        <DropdownItem
                            v-if="!this.externalApplicationManager.backendAvailable"
                            text="Load specification"
                            id="load-spec-button"
                            :eventFunction="loadSpecificationCallback"
                        />
                        <DropdownItem
                            id="load-dataflow-button"
                            text="Load graph file"
                            :eventFunction="loadDataflowCallback"
                        />
                        <DropdownItem
                            type="'button'"
                            text="Save graph file"
                            :eventFunction="saveDataflow"
                        />
                        <DropdownItem
                            type="'button'"
                            text="Export graph to PNG"
                            :eventFunction="exportToPng"
                        />
                        <div v-if="this.externalApplicationManager.externalApplicationConnected">
                            <hr />
                            <DropdownItem
                                text="Load file"
                                id="request-dataflow-button"
                                :eventFunction="importDataflow"
                            />
                            <DropdownItem
                                text="Save file"
                                type="button"
                                :eventFunction="() => requestDataflowAction('export')"
                            />
                        </div>
                    </div>
                </div>

                <div ref="palette" class="open">
                    <button @click="() => togglePanel(panels.palette)">
                        <Cube />
                    </button>
                    <div class="tooltip">
                        <span>Nodes</span>
                    </div>
                </div>

                <div v-if="this.externalApplicationManager.backendAvailable">
                    <button @click="() => requestDataflowAction('run')"><Run /></button>
                    <div class="tooltip">
                        <span>Run</span>
                    </div>
                </div>
                <div v-if="this.externalApplicationManager.backendAvailable">
                    <button @click="() => requestDataflowAction('validate')">
                        <Validate />
                    </button>
                    <div class="tooltip">
                        <span>Validate</span>
                    </div>
                </div>
                <div v-if="this.editorManager.editor.isInSubgraph()">
                    <button @click="() => this.editorManager.returnFromSubgraph()">
                        <Arrow color="white" rotate="down" />
                    </button>
                    <div class="tooltip">
                        <span>Return from subgraph editor</span>
                    </div>
                </div>
            </div>
            <span> Pipeline Manager </span>
            <div>
                <div ref="settings">
                    <button @click="() => togglePanel(panels.settings)">
                        <Cogwheel />
                    </button>
                    <div class="tooltip">
                        <span>Settings</span>
                    </div>
                </div>
                <div v-if="this.externalApplicationManager.backendAvailable" ref="backend">
                    <button @click="() => togglePanel(panels.backendStatus)">
                        <Backend
                            v-if="this.externalApplicationManager.externalApplicationConnected"
                            color="connected"
                        />
                        <Backend v-else color="disconnected" />
                    </button>
                    <div class="tooltip">
                        <span>Backend status</span>
                    </div>
                    <div
                        v-click-outside="(ev) => clickOutside(ev, panels.backendStatus)"
                        class="backend-status"
                    >
                        <div>
                            <span>Client status:</span>
                            <span
                                v-if="this.externalApplicationManager.externalApplicationConnected"
                                class="connected"
                                >Connected</span
                            >
                            <span v-else class="disconnected">Disconnected</span>
                        </div>
                    </div>
                </div>
                <div ref="notifications">
                    <button @click="() => togglePanel(panels.notifications)">
                        <Bell
                            v-if="this.notificationStore.notifications.length > 0"
                            color="green"
                        />
                        <Bell v-else />
                    </button>
                    <div class="tooltip last">
                        <span>Notifications</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="progress-bar" />
        <Notifications v-click-outside="(ev) => clickOutside(ev, panels.notifications)" />
        <Settings
            v-click-outside="(ev) => clickOutside(ev, panels.settings)"
            :viewModel="editorManager.baklavaView"
        />
    </div>
</template>

<style lang="scss" scoped>
.wrapper {
    position: relative;
    z-index: 2;

    & > .progress-bar {
        position: absolute;
        height: 5px;
        bottom: 0;
        z-index: 5;
        transform: translateY(100%);
        background-color: $green;
    }
}

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
                display: none;
                background-color: $gray-600;
                border: 1px solid $gray-500;
            }

            & > .backend-status {
                @extend .dropdown-wrapper;
                width: 220px;
                height: 30px;
                display: flex;
                /* Hide backend panel and position it
                  to right border of backend icon
                */
                transform: translate(-89%, -180px);
                padding: $spacing-l;
                font-size: $fs-small;
                justify-content: space-between;
                border: none;
                transition: transform 1s;

                & > div {
                    display: flex;
                    justify-content: space-between;

                    & > .disconnected {
                        color: $red;
                    }

                    & > .connected {
                        color: $green;
                    }
                }
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
            & > .first {
                transform: translateX(-25%);
            }

            &.logo:hover > svg:last-of-type {
                rotate: 90deg;
            }

            &.logo:hover > .dropdown-wrapper {
                display: flex;
            }

            &:not(.open):hover > .tooltip {
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
