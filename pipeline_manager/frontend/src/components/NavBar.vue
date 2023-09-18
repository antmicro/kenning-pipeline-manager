<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Navigation bar of the application.
Displays user interface and main details about the Pipeline Manager status.
-->

<script>
import { markRaw } from 'vue';
import { toPng, toSvg } from 'html-to-image';
import jsonlint from 'jsonlint';
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
import SaveMenu from './SaveMenu.vue';
import BlurPanel from './BlurPanel.vue';

import InputInterface from '../interfaces/InputInterface.js';
import InputInterfaceComponent from '../interfaces/InputInterface.vue';

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
        SaveMenu,
        BlurPanel,
    },
    computed: {
        dataflowGraphName() {
            return this.editorManager.baklavaView.editor.graphName;
        },
        editorTitle() {
            if (this.graphName === undefined) {
                return this.appName;
            }
            const normalizedGraphName = this.graphName.trim();
            return normalizedGraphName === '' ? this.appName : normalizedGraphName;
        },
        hideHud() {
            return this.editorManager.baklavaView.hideHud;
        },
        settingsOpen() {
            return this.panels.settings.isOpen;
        },
        notificationsOpen() {
            return this.panels.notifications.isOpen;
        },
        paletteOpen() {
            return this.panels.palette.isOpen;
        },
        backendStatusOpen() {
            return this.panels.backendStatus.isOpen;
        },
        notificationsTooltipClasses() {
            return {
                last: !this.hideHud,
            };
        },
        backendStatusTooltipClasses() {
            return {
                last: this.hideHud && this.externalApplicationManager.backendAvailable,
            };
        },
        settingsTooltipClasses() {
            return {
                last: this.hideHud && !this.externalApplicationManager.backendAvailable,
            };
        },
    },
    watch: {
        dataflowGraphName(newValue) {
            this.graphName = newValue;

            // Resetting the save configuration
            this.saveConfiguration = {
                readonly: false,
                hideHud: false,
                position: false,
                savename: 'save',
                graphname: newValue ?? '',
            };
        },
        graphName(newValue) {
            // Resetting the save configuration
            this.saveConfiguration = {
                readonly: false,
                hideHud: false,
                position: false,
                savename: 'save',
                graphname: newValue ?? '',
            };
        },
    },
    data() {
        const editorManager = EditorManager.getEditorManagerInstance();
        const graphName = editorManager.baklavaView.editor.graphName ?? '';
        const appName = process.env.VUE_APP_EDITOR_TITLE ?? 'Pipeline Manager';

        const editorTitleInterface = new InputInterface(
            'Graph name',
            '',
        ).setPort(false);
        editorTitleInterface.componentName = 'InputInterface';
        editorTitleInterface.setComponent(markRaw(InputInterfaceComponent));

        return {
            appName,
            graphName,
            editorManager,
            editorTitleInterface,
            saveConfiguration: {
                readonly: false,
                hideHud: false,
                position: false,
                savename: 'save',
                graphname: graphName ?? '',
            },
            /* create instance of external manager to control
            connection, dataflow and specification
            */
            externalApplicationManager: new ExternalApplicationManager(),
            saveMenuShow: false,
            editTitle: false,
            notificationStore,
            // Toggleable panels and their configuration
            panels: {
                notifications: {
                    isOpen: false,
                    class: '.notifications',
                    iconRef: 'notifications',
                    showTransform: '-495px, 0px',
                    hideTransform: '0px, 0px',
                    hover: false,
                },
                palette: {
                    isOpen: true,
                    class: '.baklava-node-palette',
                    iconRef: 'palette',
                    showTransform: '0px, 0px',
                    hideTransform: '-450px, 0px',
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
         * Loads nodes' specification from text structure.
         * It first validates the specification file. If the validation is successful the
         * specification is loaded. Otherwise a proper log is printed to the user.
         *
         * @param {string} specText specification to validate and load
         */
        loadSpecification(specText) {
            let { errors, warnings } = this.editorManager.validateSpecification(specText);
            if (Array.isArray(errors) && errors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
                return;
            }
            ({ errors, warnings } = this.editorManager.updateEditorSpecification(specText));
            if (Array.isArray(warnings) && warnings.length) {
                NotificationHandler.terminalLog(
                    'warning',
                    'Issue when loading specification',
                    warnings,
                );
            }
            if (Array.isArray(errors) && errors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
            }
        },

        /**
         * Event handler that loads a specification passed by the user
         * and tries to load it into a new environment it.
         */
        loadSpecificationCallback() {
            const file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            const fileReader = new FileReader();

            fileReader.onload = () => {
                this.loadSpecification(fileReader.result);
            };

            fileReader.readAsText(file);
            document.getElementById('load-spec-button').value = '';
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
            if (this.hideHud) { return; }

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
            this.editorManager.loadDataflow(dataflow).then(({ errors, warnings }) => {
                if (Array.isArray(warnings) && warnings.length) {
                    NotificationHandler.terminalLog(
                        'warning',
                        'Issue when loading dataflow',
                        warnings,
                    );
                }
                if (Array.isArray(errors) && errors.length) {
                    const messageTitle = process.env.VUE_APP_GRAPH_DEVELOPMENT_MODE === 'true' ?
                        'Softload enabled, errors found while loading the dataflow' :
                        'Dataflow is invalid';
                    NotificationHandler.terminalLog('error', messageTitle, errors);
                }
            });
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
                    dataflow = jsonlint.parse(fileReader.result);
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
            document.getElementById('load-dataflow-button').value = '';
        },
        /**
         * Event handler that that saves a current dataflow to a `save.json` file.
         */
        saveDataflow() {
            const blob = new Blob([JSON.stringify(this.editorManager.saveDataflow(
                this.saveConfiguration.readonly,
                this.saveConfiguration.hideHud,
                this.saveConfiguration.position,
                this.saveConfiguration.graphname,
            ), null, 4)], {
                type: 'application/json',
            });

            const linkElement = document.createElement('a');
            linkElement.href = window.URL.createObjectURL(blob);
            linkElement.download = this.saveConfiguration.savename;
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

        exportToSvg() {
            // Get editor with data flow
            const nodeEditor = document.querySelector('.inner-editor');
            // Exclude node palette
            const filter = (node) => !node.classList?.contains('baklava-node-palette');

            toSvg(nodeEditor, { filter })
                .then((dataUrl) => {
                    const downloadLink = document.createElement('a');
                    downloadLink.download = 'dataflow.svg';
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
                    NotificationHandler.showToast('error', `Export to SVG failed: ${error}`);
                });
        },

        handleMouseLeave(panel) {
            if (this.hideHud) this.togglePanel(panel, true);
        },
    },
    async mounted() {
        // Create connection on page load
        if (this.externalApplicationManager.backendAvailable) {
            this.externalApplicationManager.invokeFetchAction(
                this.externalApplicationManager.initializeConnection,
            );
        }
    },
};
</script>

<!-- eslint-disable vue/no-multiple-template-root -->
<template>
    <Transition name="fade" @click.self="saveMenuShow = false">
        <BlurPanel v-show="saveMenuShow">
            <SaveMenu
                v-show="saveMenuShow"
                v-model="saveMenuShow"
                :viewModel="editorManager.baklavaView"
                :saveConfiguration="saveConfiguration"
                :saveCallback="saveDataflow"
            />
        </BlurPanel>
    </Transition>
    <div class="wrapper"
        :class="!hideHud ? 'wrapper-hud' : 'wrapper-hidden'"
        @mouseleave="() => handleMouseLeave(panels.settings)"
    >
        <div class="container">
            <div>
                <div class="logo">
                    <Logo />
                    <div class="dropdown-wrapper">
                        <DropdownItem
                            v-if="!this.externalApplicationManager.backendAvailable && !hideHud"
                            text="Load specification"
                            id="load-spec-button"
                            :eventFunction="loadSpecificationCallback"
                        />
                        <DropdownItem
                            v-if="!hideHud"
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
                            text="Save graph as file as..."
                            :eventFunction="() => {saveMenuShow = !saveMenuShow}"
                        />
                        <DropdownItem
                            type="'button'"
                            text="Export graph to PNG"
                            :eventFunction="exportToPng"
                        />
                        <DropdownItem
                            type="'button'"
                            text="Export graph to SVG"
                            :eventFunction="exportToSvg"
                        />
                        <div
                            v-if="this.externalApplicationManager.externalApplicationConnected"
                        >
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

                <div ref="palette" class="hoverbox" v-if="!hideHud">
                    <button @click="() => togglePanel(panels.palette)">
                        <Cube :active="paletteOpen" />
                    </button>
                    <div class="tooltip" v-if="paletteOpen">
                        <span>Hide node browser</span>
                    </div>
                    <div class="tooltip" v-if="!paletteOpen">
                        <span>Show node browser</span>
                    </div>
                </div>

                <div v-if="this.externalApplicationManager.backendAvailable">
                    <button
                        @click="() => requestDataflowAction('run')">
                        <Run color="white" />
                    </button>
                    <div class="tooltip">
                        <span>Run</span>
                    </div>
                </div>
                <div v-if="this.externalApplicationManager.backendAvailable">
                    <button @click="() => requestDataflowAction('validate')">
                        <Validate color="white" />
                    </button>
                    <div class="tooltip">
                        <span>Validate</span>
                    </div>
                </div>
                <div v-if="this.editorManager.editor.isInSubgraph()">
                    <button @click="() => this.editorManager.returnFromSubgraph()">
                        <Arrow rotate="down" hoverable="true" color="white" />
                    </button>
                    <div class="tooltip">
                        <span>Return from subgraph editor</span>
                    </div>
                </div>
            </div>
            <component
                v-if="editTitle"
                :is="editorTitleInterface.component"
                :intf="editorTitleInterface"
                class="editorTitleInput"
                v-model="graphName"
                v-click-outside="() => { editTitle = false }"
            />
            <span
                v-else
                class="editorTitle"
                @dblclick="editTitle = true">
                    {{ editorTitle }}
            </span>
            <div>
                <div ref="settings" class="hoverbox">
                    <button @click="() => togglePanel(panels.settings)">
                        <Cogwheel :active="settingsOpen" />
                    </button>
                    <div class="tooltip" :class="settingsTooltipClasses">
                        <span>Settings</span>
                    </div>
                </div>
                <div v-if="this.externalApplicationManager.backendAvailable" ref="backend">
                    <button @click="() => togglePanel(panels.backendStatus)">
                        <Backend
                            v-if="this.externalApplicationManager.externalApplicationConnected"
                            color="connected"
                            :active="backendStatusOpen"
                        />
                        <Backend v-else color="disconnected" :active="backendStatusOpen" />
                    </button>
                    <div class="tooltip" :class="backendStatusTooltipClasses">
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
                <div
                    ref="notifications"
                    v-if="!hideHud"
                    class="hoverbox"
                    role="button"
                    @click="() => togglePanel(panels.notifications)"
                    @pointerover="() => panels.notifications.hover = true"
                    @pointerleave="() => panels.notifications.hover = false"
                >
                    <Bell
                        v-if="this.notificationStore.notifications.length > 0"
                        color="green"
                        :hover="panels.notifications.hover"
                        class="small_svg"
                    />
                    <Bell v-else class="small_svg" :hover="panels.notifications.hover"/>
                    <div
                        class="tooltip"
                        v-if="notificationsOpen"
                        :class="notificationsTooltipClasses"
                    >
                        <span>Hide notifications</span>
                    </div>
                    <div class="tooltip" v-else :class="notificationsTooltipClasses">
                        <span>Show notifications</span>
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
$bar-height: 60px;

.wrapper {
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

.wrapper-hud {
    position: relative;
}

.wrapper-hidden {
    position: absolute;
    width: 100%;
    top: -$bar-height;
    padding-bottom: 90px;
    transition: 0.2s;

    &:hover {
        transform: translateY($bar-height);
    }
}

.container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: $bar-height;
    background-color: $gray-600;
    border: 1px solid $gray-500;
    border-left: 0;
    border-right: 0;

    .editorTitle {
        cursor: text;
        text-align: right;
    }

    .editorTitleInput {
        font-size: $fs-small;
    }

    & > div {
        display: inherit;
        align-items: center;
        height: 100%;

        & > div {
            display: flex;
            width: 3.75em;
            height: 3.75em;
            padding: 1em;
            justify-content: center;
            align-items: center;
            position: relative;
            box-sizing: border-box;

            border-left: 1px solid $gray-500;

            &:last-child {
                border-right: 1px solid $gray-500;
            }

            & > svg {
                display: block;
                width: 1.6875em;
                height: 1.6875em;
            }

            & > button > svg {
                display: block;
                width: 1.4em;
                height: 1.4em;
            }
            & > .small_svg {
                display: block;
                width: 1.4em;
                height: 1.4em;
            }

            & > .dropdown-wrapper {
                user-select: none;
                position: absolute;
                flex-direction: column;
                top: 100%;
                left: 0;
                display: none;
                background-color: #181818;
                border: 2px solid #737373;

                & > div:hover {
                    background-color: #2A2A2A;
                }
            }

            & > .backend-status {
                @extend .dropdown-wrapper;
                width: 220px;
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
                background-color: $gray-600;
                border: 1px solid $gray-200;
                padding: $spacing-s;
                left: calc(3.75em / 2);
                transform: translate(-50%, 25%);
                pointer-events: none;
                white-space: nowrap;
            }

            & > .last {
                transform: translate(-75%, 25%);
            }
            & > .first {
                transform: translate(-25%, 25%);
            }

            &.logo:hover > .dropdown-wrapper {
                display: flex;
            }

            & > .hoverbox {
            }

            &.hoverbox:hover > .tooltip {
                display: flex;
                z-index: 11;
            }
            &.hoverbox:hover ~ .small_svg {
                fill: $green;
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
