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
import { backendApiUrl } from '../core/utils';
import { showToast } from '../core/notifications';
import { notificationStore } from '../core/stores';
import ExternalApplicationManager from '../core/ExternalApplicationManager';

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
            editorManager: EditorManager.getEditorManagerInstance(), // create instance of baklava
            /* create instance of external manager to control
            connection, dataflow and spectification
            */
            externalApplicationManager: new ExternalApplicationManager(),
            isNotificationPanelOpen: false, // check notification panel state (open or close)
            isBackendStatusOpen: false, // // check backend panel state (open or close)
            notificationStore,
        };
    },
    methods: {
        /**
         * Loads nodes' specification from JSON structure.
         */
        loadSpecification(specification) {
            const errors = this.editorManager.validateSpecification(specification);
            if (Array.isArray(errors) && errors.length) {
                alertBus.$emit('displayAlert', errors);
            } else {
                this.editorManager.updateEditorSpecification(specification);
                alertBus.$emit('displayAlert', 'Loaded successfully');
            }
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
                        showToast('error', `Not a proper JSON file.\n${exception}`);
                    } else {
                        showToast('error', `Unknown error.\n${exception}`);
                    }
                    return;
                }
                this.loadSpecification(specification);
            };

            fileReader.readAsText(file);
        },

        // Open or hide notificationPanel with slide animation
        toogleNavigationPanel() {
            if (this.isBackendStatusOpen) {
                this.toogleBackendStatusInfo();
            }

            this.isNotificationPanelOpen = !this.isNotificationPanelOpen;

            const negativeNotificationPanelWidth = '-495px'; // width of notification panel (negative because we want hide it on close)
            const resetNotificationPanelTransition = '0px'; // reset notification panel transition to show it

            const notificationPanel = document.querySelector('.notifications');
            if (notificationPanel) {
                if (this.isNotificationPanelOpen) {
                    notificationPanel.style.transition = 'transform 0.4s';
                    notificationPanel.style.transform = `translateX(${negativeNotificationPanelWidth})`;
                } else {
                    notificationPanel.style.transition = 'transform 0.2s';
                    notificationPanel.style.transform = `translateX(${resetNotificationPanelTransition})`;
                }

                if (this.isNotificationPanelOpen) {
                    this.$refs.notifications.classList.add('open');

                    if (this.$refs.backend) {
                        this.$refs.backend.classList.add('open');
                    }
                } else {
                    this.$refs.notifications.classList.remove('open');

                    if (this.$refs.backend) {
                        this.$refs.backend.classList.remove('open');
                    }
                }
            }
        },

        // Open or hide backendStatus info
        toogleBackendStatusInfo() {
            if (this.isNotificationPanelOpen) {
                this.toogleNavigationPanel();
            }

            this.isBackendStatusOpen = !this.isBackendStatusOpen;

            const showBackendStatusPanel = '-89%, 0'; // show backend panel and align it to right border of icon
            const hideBackendStatusPanel = '-89%, -180px'; // hide backend panel

            const backendStatus = document.querySelector('.backend-status');
            if (backendStatus) {
                if (this.isBackendStatusOpen) {
                    backendStatus.style.transition = 'transform 0.4s';
                    backendStatus.style.transform = `translate(${showBackendStatusPanel})`;

                    if (this.$refs.notifications) {
                        this.$refs.notifications.classList.add('open');
                    }
                    this.$refs.backend.classList.add('open');
                } else {
                    backendStatus.style.transition = 'transform 0.2s';
                    backendStatus.style.transform = `translate(${hideBackendStatusPanel})`;

                    if (this.$refs.notifications) {
                        this.$refs.notifications.classList.remove('open');
                    }
                    this.$refs.backend.classList.remove('open');
                }
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
                        showToast('error', `Not a proper JSON file.\n${exception}`);
                    } else {
                        showToast('error', `Unknown error.\n${exception}`);
                    }
                    return;
                }

                const errors = this.editorManager.loadDataflow(dataflow);
                if (Array.isArray(errors) && errors.length) {
                    showToast('error', errors);
                } else {
                    showToast('info', 'Dataflow loaded successfully');
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
            showToast('info', 'Dataflow saved');
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
    },
    mounted() {
        // Create connection on page load
        if (this.externalApplicationManager.backendAvailable) {
            this.externalApplicationManager.invokeFetchAction(
                this.externalApplicationManager.initializeConnection,
            );
        }
        if (process.env.VUE_APP_SPECIFICATION_PATH !== undefined) {
            const specification = require(process.env.VUE_APP_SPECIFICATION_PATH); // eslint-disable-line global-require,max-len,import/no-dynamic-require
            this.loadSpecification(specification);
        }
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
                            :eventFunction="loadDataflow"
                        />
                        <DropdownItem
                            type="'button'"
                            text="Save graph file"
                            :eventFunction="saveDataflow"
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
            </div>
            <span> Pipeline Manager </span>
            <div>
                <div v-if="this.externalApplicationManager.backendAvailable" ref="backend">
                    <button @click="toogleBackendStatusInfo">
                        <Backend />
                    </button>
                    <div class="tooltip">
                        <span>Backend status</span>
                    </div>
                    <div class="backend-status">
                        <div>
                            <span>Client status:</span>
                            <span
                                v-if="this.externalApplicationManager.externalApplicationConnected"
                                class="connected"
                                >Connected</span
                            >
                            <span v-else class="disconnected">Disconnected</span>
                        </div>
                        <button v-if="this.externalApplicationManager.externalApplicationConnected">
                            Disconnect
                        </button>
                        <button v-else>Connect</button>
                    </div>
                </div>
                <div ref="notifications">
                    <button @click="toogleNavigationPanel">
                        <Bell />
                    </button>
                    <div class="tooltip last">
                        <span>Notifications</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="progress-bar" />
    </div>
</template>

<style lang="scss" scoped>
.wrapper {
    position: relative;
    z-index: 1;

    & > .progress-bar {
        position: absolute;
        height: 5px;
        bottom: 0;
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
                z-index: 1;
                display: none;
                background-color: $gray-600;
                border: 1px solid $gray-500;
            }

            & > .backend-status {
                @extend .dropdown-wrapper;
                width: 220px;
                height: 80px;
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

                & > button {
                    background-color: $gray-500;
                    padding: $spacing-m;
                    border-radius: 15px;
                    color: $white;
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
