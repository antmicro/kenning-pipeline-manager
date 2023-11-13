<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Navigation bar of the application.
Displays user interface and main details about the Pipeline Manager status.
-->

<script>
import { markRaw, ref } from 'vue';
import { toPng, toSvg } from 'html-to-image';
import jsonlint from 'jsonlint';
import { useViewModel } from '@baklavajs/renderer-vue';
import Logo from '../icons/Logo.vue';
import Arrow from '../icons/Arrow.vue';
import Run from '../icons/Run.vue';
import Validate from '../icons/Validate.vue';
import Backend from '../icons/Backend.vue';
import Bell from '../icons/Bell.vue';
import Cube from '../icons/Cube.vue';
import StopDataflow from '../icons/StopDataflow.vue';
import DropdownItem from './DropdownItem.vue';
import Cogwheel from '../icons/Cogwheel.vue';
import Magnifier from '../icons/Magnifier.vue';
import EditorManager from '../core/EditorManager';
import NotificationHandler from '../core/notifications';
import { notificationStore } from '../core/stores';
import getExternalApplicationManager from '../core/communication/ExternalApplicationManager';
import Notifications from './Notifications.vue';
import Settings from './Settings.vue';
import SaveMenu from './SaveMenu.vue';
import BlurPanel from './BlurPanel.vue';

import InputInterface from '../interfaces/InputInterface.js';
import InputInterfaceComponent from '../interfaces/InputInterface.vue';
import {
    startTransaction, commitTransaction,
} from '../core/History.ts';

export default {
    components: {
        Logo,
        Arrow,
        Run,
        StopDataflow,
        Validate,
        Backend,
        Bell,
        DropdownItem,
        Notifications,
        Magnifier,
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
        readonly() {
            return this.editorManager.baklavaView.editor.readonly;
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
            };
        },
        graphName(newValue) {
            this.editorManager.updateSubgraphName(newValue);

            // Resetting the save configuration
            this.saveConfiguration = {
                readonly: false,
                hideHud: false,
                position: false,
                savename: 'save',
            };
        },
        searchEditorNodesQuery(newValue) {
            const { viewModel } = useViewModel();
            if (newValue === '') {
                viewModel.value.editor.searchQuery = undefined;
                return;
            }
            viewModel.value.editor.searchQuery = newValue.toLowerCase();
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

        const searchEditorNodesQuery = ref('');

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
            },
            /* create instance of external manager to control
            connection, dataflow and specification
            */
            externalApplicationManager: getExternalApplicationManager(),
            saveMenuShow: false,
            editTitle: false,
            notificationStore,
            showSearch: false,
            searchEditorNodesQuery,
            hoverInfo: {
                isHovered: false,
                hoveredPanel: undefined,
            },
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
                nodesearch: {
                    isOpen: false,
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

        createNewGraphCallback() {
            startTransaction();
            this.editorManager.editor.deepCleanEditor(false);
            commitTransaction();
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

            fileReader.onload = async () => {
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

                await this.externalApplicationManager.notifyAboutChange('graph_on_change', {
                    dataflow,
                });

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
            await this.externalApplicationManager.requestDataflowAction(action);
        },
        importDataflow() {
            if (!this.externalApplicationManager.backendAvailable) return;
            const file = document.getElementById('request-dataflow-button').files[0];
            if (!file) return;

            const fileReader = new FileReader();
            fileReader.onload = async () => {
                await this.externalApplicationManager.importDataflow(fileReader.result);
            };
            fileReader.readAsText(file);
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

        onClickNodeSearch() {
            this.togglePanel(this.panels.nodesearch);
            if (this.panels.nodesearch.isOpen) {
                this.$nextTick(() => this.$refs.searchbarInput.focus());
            }
        },

        handleMouseLeave(panel) {
            if (this.hideHud) this.togglePanel(panel, true);
        },

        updateHoverInfo(name) {
            this.hoverInfo.hoveredPanel = name;
            this.hoverInfo.isHovered = true;
        },

        resetHoverInfo(name) {
            if (this.hoverInfo.hoveredPanel === name) {
                this.hoverInfo.hoveredPanel = undefined;
                this.hoverInfo.isHovered = false;
            }
        },

        isHovered(name) {
            return this.hoverInfo.hoveredPanel === name && this.hoverInfo.isHovered;
        },
    },
    async mounted() {
        // Create connection on page load
        if (this.externalApplicationManager.backendAvailable) {
            this.externalApplicationManager.initializeConnection();
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
                <div
                    class="logo"
                    @pointerover="() => updateHoverInfo('logo')"
                    @pointerleave="() => resetHoverInfo('logo')"
                >
                    <Logo :hover="isHovered('logo')" />
                    <div class="dropdown-wrapper">
                        <DropdownItem
                            v-if="this.editorManager.specificationLoaded"
                            id="create-new-graph-button"
                            text="Create new graph"
                            type="'button'"
                            :eventFunction="createNewGraphCallback"
                        />
                        <DropdownItem
                            v-if="!this.externalApplicationManager.backendAvailable && !hideHud"
                            text="Load specification"
                            id="load-spec-button"
                            :eventFunction="loadSpecificationCallback"
                        />
                        <DropdownItem
                            v-if="!hideHud && this.editorManager.specificationLoaded"
                            id="load-dataflow-button"
                            text="Load graph file"
                            :eventFunction="loadDataflowCallback"
                        />
                        <DropdownItem
                            v-if="this.editorManager.specificationLoaded"
                            type="'button'"
                            text="Save graph file"
                            :eventFunction="saveDataflow"
                        />
                        <DropdownItem
                            v-if="this.editorManager.specificationLoaded"
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

                <div
                    ref="palette"
                    v-if="!hideHud && !readonly"
                    class="hoverbox"
                    role="button"
                    @click="() => togglePanel(panels.palette)"
                    @pointerover="() => updateHoverInfo('palette')"
                    @pointerleave="() => resetHoverInfo('palette')"
                >
                    <Cube :hover="isHovered('palette')" class="small_svg"/>
                    <div class="tooltip" v-if="paletteOpen">
                        <span>Hide node browser</span>
                    </div>
                    <div class="tooltip" v-if="!paletteOpen">
                        <span>Show node browser</span>
                    </div>
                </div>

                <div
                    class="hoverbox"
                    v-if="this.externalApplicationManager.backendAvailable"
                    @click="() => requestDataflowAction('run')"
                    @pointerover="() => updateHoverInfo('run')"
                    @pointerleave="() => resetHoverInfo('run')"
                >
                    <button>
                        <Run :hover="isHovered('run')" />
                    </button>
                    <div class="tooltip">
                        <span>Run</span>
                    </div>
                </div>
                <div
                    class="hoverbox"
                    v-if="this.externalApplicationManager.backendAvailable"
                    @click="() => requestDataflowAction('stop')"
                    @pointerover="() => updateHoverInfo('stop')"
                    @pointerleave="() => resetHoverInfo('stop')"
                >
                    <button>
                        <StopDataflow :hover="isHovered('stop')" color="white" />
                    </button>
                    <div class="tooltip">
                        <span>Stop</span>
                    </div>
                </div>
                <div
                    class="hoverbox"
                    v-if="this.externalApplicationManager.backendAvailable"
                    @click="() => requestDataflowAction('validate')"
                    @pointerover="() => updateHoverInfo('validate')"
                    @pointerleave="() => resetHoverInfo('validate')"
                >
                    <button>
                        <Validate :hover="isHovered('validate')" />
                    </button>
                    <div class="tooltip">
                        <span>Validate</span>
                    </div>
                </div>
                <div v-if="this.editorManager.editor.isInSubgraph()">
                    <button @click="() => this.editorManager.returnFromSubgraph()">
                        <Arrow rotate="down" :hoverable="true" color="white" />
                    </button>
                    <div class="tooltip">
                        <span>Return from subgraph editor</span>
                    </div>
                </div>
            </div>
            <component
                v-if="editTitle && !panels.nodesearch.isOpen"
                :is="editorTitleInterface.component"
                :intf="editorTitleInterface"
                class="editorTitleInput"
                v-model="graphName"
                v-click-outside="() => { editTitle = false }"
            />
            <span
                v-if="!editTitle && !panels.nodesearch.isOpen"
                class="editorTitle"
                @dblclick="editTitle = true">
                    {{ editorTitle }}
            </span>
            <div
                @pointerleave="()=> panels.nodesearch.isOpen =
                    panels.nodesearch.isOpen && searchEditorNodesQuery != ''
                "
            >
                <div
                    ref="searchbar"
                    class="searchbar hoverbox"
                    role="button"
                    @pointerover="() => updateHoverInfo('search')"
                    @pointerleave="() => resetHoverInfo('search')"
                    @click="onClickNodeSearch"
                >
                    <Magnifier :hover="isHovered('search')" class="small_svg"/>
                    <div
                        class="tooltip"
                        :class="settingsTooltipClasses"
                        v-if="!panels.nodesearch.isOpen"
                    >
                        <span>Show node search bar</span>
                    </div>
                    <div class="tooltip" :class="settingsTooltipClasses" v-else>
                        <span>Hide node search bar</span>
                    </div>
                </div>
                <div
                    ref="searchbar"
                    class="searchbar"
                    v-show="panels.nodesearch.isOpen"
                >
                    <input
                        ref="searchbarInput"
                        class="search-editor-nodes"
                        v-model="searchEditorNodesQuery"
                        placeholder="Search for nodes in the editor"
                    />
                </div>
                <div
                    ref="settings"
                    class="hoverbox"
                    role="button"
                    @click="() => togglePanel(panels.settings)"
                    @pointerover="() => updateHoverInfo('settings')"
                    @pointerleave="() => resetHoverInfo('settings')"
                >
                    <Cogwheel :hover="isHovered('settings')" class="small_svg" />
                    <div
                        class="tooltip"
                        :class="settingsTooltipClasses"
                        v-if="!panels.settings.isOpen"
                    >
                        <span>Show settings</span>
                    </div>
                    <div class="tooltip" :class="settingsTooltipClasses" v-else>
                        <span>Hide settings</span>
                    </div>
                </div>
                <div
                    ref="backend"
                    class="hoverbox"
                    v-if="this.externalApplicationManager.backendAvailable"
                    @click="() => togglePanel(panels.backendStatus)"
                    @pointerover="() => updateHoverInfo('backendStatus')"
                    @pointerleave="() => resetHoverInfo('backendStatus')"
                >
                    <button>
                        <Backend
                            v-if="this.externalApplicationManager.externalApplicationConnected"
                            color="connected"
                            :active="backendStatusOpen"
                            :hover="isHovered('backendStatus')"
                        />
                        <Backend
                            v-else color="disconnected"
                            :active="backendStatusOpen"
                            :hover="isHovered('backendStatus')"
                        />
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
                    @pointerover="() => updateHoverInfo('notifications')"
                    @pointerleave="() => resetHoverInfo('notifications')"
                >
                    <Bell
                        v-if="this.notificationStore.notifications.length > 0"
                        color="green"
                        :hover="isHovered('notifications')"
                        class="small_svg"
                    />
                    <Bell v-else class="small_svg" :hover="isHovered('notifications')"/>
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
        position: fixed;
        left: 50vw;
        transform: translate(-50%, 0);
    }

    .editorTitleInput {
        font-size: $fs-small;
        position: fixed;
        left: 50vw;
        transform: translate(-50%, 0);
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
                width: 1.2em;
                height: 1.2em;
            }
            & > .smaller_svg {
                display: block;
                width: 1em;
                height: 1em;
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

            &.hoverbox:hover {
                cursor: pointer;
            }

            &.hoverbox:hover > .tooltip {
                display: flex;
                z-index: 11;
            }
            &.hoverbox:hover ~ .small_svg {
                fill: $green;
            }

            &.searchbar {
                width: auto;
                padding: 0.1em;

                & > .search-editor-nodes {
                    background-color: #181818;
                    flex: 1;
                    height: 100%;
                    width: calc(3.75em * 6);
                    color: $white;
                    border: none;
                    padding: 0em 1em;
                    background-color: $gray-600;

                    &:focus {
                        outline: 1px solid $green;
                    }

                    &::placeholder {
                        opacity: 0.5;
                    }
                }

                & > svg {
                    width: 1.2em;
                    height: 1.2em;
                    padding: 1em;
                }
            }
            &.searchbar:hover > .tooltip {
                display: flex;
                z-index: 11;
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
