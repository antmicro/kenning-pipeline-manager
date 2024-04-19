<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Navigation bar of the application.
Displays user interface and main details about the Pipeline Manager status.
-->

<script>
import { markRaw, ref, provide } from 'vue';
import { toPng, toSvg } from 'html-to-image';
import jsonlint from 'jsonlint';
import { useViewModel } from '@baklavajs/renderer-vue';
import { api as fullscreen } from 'vue-fullscreen';
import Logo from '../icons/Logo.vue';
import Arrow from '../icons/Arrow.vue';
import Expand from '../icons/Expand.vue';
import Collapse from '../icons/Collapse.vue';
import Run from '../icons/Run.vue';
import Validate from '../icons/Validate.vue';
import Backend from '../icons/Backend.vue';
import Bell from '../icons/Bell.vue';
import Cube from '../icons/Cube.vue';
import CassetteStop from '../icons/CassetteStop.vue';
import DropdownItem from './DropdownItem.vue';
import Cogwheel from '../icons/Cogwheel.vue';
import Magnifier from '../icons/Magnifier.vue';
import EditorManager from '../core/EditorManager';
import NotificationHandler from '../core/notifications';
import { notificationStore } from '../core/stores';
import runInfo from '../core/communication/runInformation';
import getExternalApplicationManager from '../core/communication/ExternalApplicationManager';
import Notifications from './Notifications.vue';
import Settings from './Settings.vue';
import {
    ParentMenu, SaveMenu, NodeConfigurationMenu, PropertyConfigurationMenu,
    InterfaceConfigurationMenu,
} from './menu';
import { menuState } from '../core/nodeCreation/ConfigurationState.ts';
import BlurPanel from './BlurPanel.vue';
import CustomSidebar from '../custom/CustomSidebar.vue';
import { saveSpecificationConfiguration, saveGraphConfiguration } from './saveConfiguration.ts';

import icons from '../icons';

import InputInterface from '../interfaces/InputInterface.js';
import { brokenImage } from '../../../resources/broken_image.js';
import {
    startTransaction, commitTransaction,
} from '../core/History.ts';

/* eslint-disable no-param-reassign */
export default {
    components: {
        Logo,
        Arrow,
        Run,
        CassetteStop,
        Validate,
        Backend,
        Bell,
        DropdownItem,
        Expand,
        Collapse,
        Notifications,
        Magnifier,
        Cogwheel,
        Settings,
        Cube,
        ParentMenu,
        SaveMenu,
        NodeConfigurationMenu,
        PropertyConfigurationMenu,
        InterfaceConfigurationMenu,
        BlurPanel,
        CustomSidebar,
    },
    emits: ['setLoad'],
    computed: {
        dataflowGraphName() {
            return this.editorManager.editor.graphName;
        },
        editorTitle() {
            if (this.graphName === undefined) {
                return this.appName;
            }
            const normalizedGraphName = this.graphName.trim();
            return normalizedGraphName === '' ? this.appName : normalizedGraphName;
        },
        preview() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('preview')) {
                return urlParams.get('preview') === 'true';
            }
            return false;
        },
        hideHud() {
            return this.editorManager.editor.hideHud;
        },
        readonly() {
            return this.editorManager.editor.readonly;
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
        navbarItems() {
            const { navbarItems } = this.editorManager.baklavaView;
            navbarItems.forEach((item) => {
                // If there is no such icon then assets are checked and used as a fallback
                if (icons[item.iconName] === undefined) {
                    item.icon = markRaw(icons.Placeholder);
                    item.iconName = this.editorManager.baklavaView.cache[`./${item.iconName}`];
                } else {
                    item.icon = markRaw(icons[item.iconName]);
                }
            });
            return navbarItems;
        },
        leftButtonsQuantity() {
            return 2 + (
                (this.externalApplicationManager.backendAvailable) ? this.navbarItems.length : 0
            ) + (
                (this.editorManager.editor.isInSubgraph()) ? 1 : 0
            );
        },
        rightButtonsQuantity() {
            return 3 + ((this.externalApplicationManager.backendAvailable) ? 1 : 0);
        },
        isNavBarCompressed() {
            return (
                this.isMounted &&
                this.windowWidth <
                (this.leftButtonsQuantity + this.rightButtonsQuantity) * this.buttonWidth
                + this.searchbarWidthMultiplcity * this.buttonWidth // searchbar width
                + 0.5 * this.buttonWidth // offset
            );
        },
        mobileClasses() {
            return { 'compressed-mobile': this.isNavBarCompressed };
        },
        nodesearchInputStyles() {
            return {
                width: `${this.searchbarWidthMultiplcity * this.buttonWidth}px`,
            };
        },
        leftContainerStyles() {
            if (this.isNavBarCompressed) {
                return { 'flex-grow': this.leftButtonsQuantity };
            }
            return {};
        },
        rightContainerStyles() {
            if (this.isNavBarCompressed) {
                return {
                    'flex-grow': this.rightButtonsQuantity,
                    'justify-content': 'right',
                };
            }
            return { 'justify-content': 'right' };
        },
        activeNavbarItems() {
            return this.activeNavbarItemsNames;
        },
    },
    watch: {
        dataflowGraphName(newValue) {
            this.graphName = newValue;

            // Resetting the save configurations
            saveSpecificationConfiguration.reset();
            saveGraphConfiguration.reset();
        },
        graphName(newValue) {
            this.editorManager.updateSubgraphName(newValue);

            // Resetting the save configurations
            saveSpecificationConfiguration.reset();
            saveGraphConfiguration.reset();
        },
        searchEditorNodesQuery(newValue) {
            const { viewModel } = useViewModel();
            if (newValue === '') {
                viewModel.value.editor.searchQuery = undefined;
                return;
            }
            viewModel.value.editor.searchQuery = newValue.toLowerCase();
        },
        navbarItems(newValue) {
            // Setup initial navbarItems
            this.activeNavbarItemsNames = newValue.map((item) => item.procedureName);
        },
    },
    data() {
        const editorManager = EditorManager.getEditorManagerInstance();
        const graphName = editorManager.baklavaView.editor.graphName ?? '';
        const appName = process.env.VUE_APP_EDITOR_TITLE ?? 'Pipeline Manager';

        const editorTitleInterface = new InputInterface(
            'Graph name',
            '',
        );

        const searchEditorNodesQuery = ref('');
        // Setup custom hook, which is executed when procedure starts or stops running
        runInfo.setHook(this.updateActiveNavbarItems);

        // Mock hoveredOver to suppress warning when creating Side Panel
        // hoveredOver over is needed only for temporary connections, which are not used here
        provide('hoveredOver', () => {});

        return {
            appName,
            graphName,
            editorManager,
            editorTitleInterface,
            /* Object used to pass information to ParentMenu component about
                saving configuration. If any option is set to undefined then
                it will be not displayed in the ParentMenu.
            */
            menuState,
            /* create instance of external manager to control
            connection, dataflow and specification
            */
            externalApplicationManager: getExternalApplicationManager(),
            activeNavbarItemsNames: [],
            saveConfiguration: saveGraphConfiguration,
            saveGraphConfiguration,
            saveSpecificationConfiguration,
            saveMenuShow: false,
            editTitle: false,
            notificationStore,
            showSearch: false,
            crossIcon: markRaw(icons.Cross),
            searchEditorNodesQuery,
            navbarGuard: false,
            isMounted: false,
            windowWidth: 0,
            buttonWidth: 0,
            searchbarWidthMultiplcity: 4,
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
                    isOpen: !this.$isMobile,
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
                fullscreen: {
                    isOpen: fullscreen.isFullscreen,
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
         * @param {string} specText specification to validate and load.
         * @returns {Promise} result after validation and loading.
         */
        async loadSpecification(specText) {
            const validationErrors = EditorManager.validateSpecification(specText);
            if (Array.isArray(validationErrors) && validationErrors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', validationErrors);
                return Promise.resolve();
            }
            return this.editorManager.updateEditorSpecification(specText)
                .then(({ errors, warnings }) => {
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
                });
        },

        createNewGraphCallback() {
            startTransaction();
            this.editorManager.editor.deepCleanEditor(false);
            commitTransaction();
        },

        createNewNodeCallback() {
            this.menuState.configurationMenu.visible = !this.menuState.configurationMenu.visible;
            this.menuState.configurationMenu.addNode = true;
        },

        /**
         * Event handler that loads a specification passed by the user
         * and tries to load it into a new environment it.
         */
        loadSpecificationCallback() {
            const file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            this.$emit('setLoad', true);
            const resolve = () => this.$emit('setLoad', false);

            const fileReader = new FileReader();

            fileReader.onload = () => {
                this.loadSpecification(fileReader.result).then(resolve);
            };

            fileReader.readAsText(file);
            document.getElementById('load-spec-button').value = '';
        },

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

        /**
         * Toggle fullscreen mode.
         *
         * For iframe, the allow="fullscreen" attribute must be set.
         */
        toggleFullscreen() {
            if (!fullscreen.isEnabled) {
                NotificationHandler.showToast('error', 'Fullscreen is not supported');
                return;
            }
            fullscreen.toggle();
        },

        clickOutside(event, panel) {
            const icon = this.$refs[panel.iconRef];
            if (!icon) return;

            const currentElement = event.target;
            if (currentElement instanceof Node && (icon.contains(currentElement)
                                                   || icon === currentElement)) {
                return;
            }

            this.togglePanel(panel, true);
        },

        /**
         * Loads nodes' specification from JSON structure.
         *
         * @param {string} specText specification to validate and load.
         * @returns {Promise} result after validation and loading.
         */
        async loadDataflow(dataflow) {
            return this.editorManager.loadDataflow(dataflow).then(({ errors, warnings }) => {
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

            this.$emit('setLoad', true);
            const resolve = () => this.$emit('setLoad', false);

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
                    resolve();
                    return;
                }

                await this.externalApplicationManager.notifyAboutChange('graph_on_change', {
                    dataflow,
                });

                this.loadDataflow(dataflow).then(resolve);
            };

            fileReader.readAsText(file);
            document.getElementById('load-dataflow-button').value = '';
        },

        async requestDataflowAction(actionItem) {
            if (!this.externalApplicationManager.backendAvailable) return;
            if (
                this.isInProgress(actionItem.procedureName) &&
                this.isStoppable(actionItem.procedureName)
            ) {
                await this.externalApplicationManager.requestDataflowStop(actionItem.procedureName);
                return;
            }
            const activeAction = this.activeNavbarItemsNames.includes(actionItem.procedureName);
            if (activeAction && !this.isInProgress(actionItem.procedureName)) {
                await this.externalApplicationManager.requestDataflowAction(
                    actionItem.procedureName,
                );
            } else if (activeAction) {
                NotificationHandler.terminalLog('warning', `${actionItem.name} cannot be stopped`);
            }
        },

        async requestDataflowExport(prompt = true) {
            if (!this.externalApplicationManager.backendAvailable) return;
            const result = await this.externalApplicationManager.requestDataflowExport();

            if (result !== false) {
                // Copy the saveConfiguration object to prevent changing the original object
                this.saveConfiguration = { ...saveGraphConfiguration };
                this.saveConfiguration.saveName = (
                    result.filename ?? saveGraphConfiguration.saveName);
                if (prompt) {
                    this.saveConfiguration.readonly = undefined;
                    this.saveConfiguration.hideHud = undefined;
                    this.saveConfiguration.position = undefined;
                    this.saveConfiguration.saveCallback =
                        () => {
                            this.saveConfiguration.saveCallbackCustomFormat(
                                result.content,
                            );
                            this.saveConfiguration = saveGraphConfiguration;
                        };
                    this.saveMenuShow = true;
                } else {
                    this.saveConfiguration.saveCallbackCustomFormat(
                        result.content,
                    );
                }
            }
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

            toPng(nodeEditor, { filter, imagePlaceholder: brokenImage })
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
            toSvg(nodeEditor, { filter, imagePlaceholder: brokenImage })
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

        openNavbar() {
            this.navbarGuard = true;
            this.$refs.navbar.classList.add('isHovered');
        },

        handleMouseLeave(ev) {
            if (!this.$refs.navbar.classList.contains('isHovered')) return;
            // check if event targets UI, if not hide NavBar
            if (
                (this.hideHud || this.$isMobile) &&
                !this.editorManager.baklavaView.displayedGraph.sidebar.visible &&
                !ev.target.closest('.baklava-node-palette')) {
                // Ignore first event to prevent NavBar from hiding when side bar is opened
                if (this.navbarGuard) {
                    this.navbarGuard = false;
                } else {
                    this.togglePanel(this.panels.palette, true);
                    this.$refs.navbar.classList.remove('isHovered');
                }
            }
        },

        updateHoverInfo(name, isRunnable = false) {
            if (!isRunnable || this.activeNavbarItemsNames.includes(name) ||
                this.isInProgress(name)) {
                this.hoverInfo.hoveredPanel = name;
                this.hoverInfo.isHovered = true;
            }
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

        isInProgress(procedure) {
            return runInfo.get(procedure).inProgress;
        },

        isStoppable(procedure) {
            return this.externalApplicationManager
                .appCapabilities.stoppable_methods?.includes(procedure) ?? true;
        },

        getNavbarActionTooltip(actionItem) {
            if (
                this.isStoppable(actionItem.procedureName) &&
                this.isInProgress(actionItem.procedureName)
            ) {
                if (actionItem.stopName !== undefined) return actionItem.stopName;
                return `Stop ${actionItem.name}`;
            }
            return actionItem.name;
        },

        updateActiveNavbarItems() {
            const { navbarItems } = this;
            let activeItems = new Set(navbarItems.map((item) => item.procedureName));
            navbarItems.filter((item) => this.isInProgress(item.procedureName)).forEach((item) => {
                // Intersection of current activeItems and items allowToRunInParallelWith
                activeItems = new Set(
                    (item.allowToRunInParallelWith ?? []).filter((name) => activeItems.has(name)),
                ).add(item.procedureName);
            });
            this.activeNavbarItemsNames = Array.from(activeItems);
        },
        returnFromSubgraph() {
            this.editorManager.returnFromSubgraph();
            this.resetHoverInfo('subgraphReturn');
        },
    },
    async mounted() {
        this.isMounted = true;
        this.buttonWidth = this.$refs.palette.offsetWidth;
        this.windowWidth = window.innerWidth;

        window.addEventListener('resize', () => {
            this.windowWidth = window.innerWidth;
            if (this.$refs.palette) this.buttonWidth = this.$refs.palette.offsetWidth;
        });

        // Listen for fullscreen change
        document.addEventListener('fullscreenchange', () => {
            this.panels.fullscreen.isOpen = !fullscreen.isFullscreen;
        });

        // Create connection on page load
        if (this.externalApplicationManager.backendAvailable) {
            this.externalApplicationManager.startStatusInterval();
        }
    },
};
</script>

<!-- eslint-disable vue/no-multiple-template-root -->
<template>
    <Transition name="fade" @click.self="saveMenuShow = false">
        <BlurPanel v-show="saveMenuShow">
            <ParentMenu
                v-show="saveMenuShow"
                v-model="saveMenuShow"
                :title="'Save configuration'"
            >
                <SaveMenu
                    :saveConfiguration="saveConfiguration"
                    v-model="saveMenuShow"
                />
            </ParentMenu>
        </BlurPanel>
    </Transition>
    <Transition name="fade" @click.self="menuState.configurationMenu.visible = false">
        <BlurPanel v-show="menuState.configurationMenu.visible">
            <ParentMenu
                v-if="menuState.configurationMenu.visible"
                v-model="menuState.configurationMenu.visible"
                :title="'Node configuration'"
            >
                <NodeConfigurationMenu/>
            </ParentMenu>
        </BlurPanel>
    </Transition>
    <Transition name="fade" @click.self="menuState.propertyMenu = false">
        <BlurPanel v-show="menuState.propertyMenu">
            <ParentMenu
                v-if="menuState.propertyMenu"
                v-model="menuState.propertyMenu"
                :title="'Add property'"
            >
                <PropertyConfigurationMenu/>
            </ParentMenu>
        </BlurPanel>
    </Transition>
    <Transition name="fade" @click.self="menuState.interfaceMenu = false">
        <BlurPanel v-show="menuState.interfaceMenu">
            <ParentMenu
                v-if="menuState.interfaceMenu"
                v-model="menuState.interfaceMenu"
                :title="'Add interface'"
            >
                <InterfaceConfigurationMenu/>
            </ParentMenu>
        </BlurPanel>
    </Transition>

    <div class="wrapper"
        v-click-outside="(ev) => handleMouseLeave(ev)"
    >
        <div ref="navbar" class="wrapper prevent-select"
            v-show="!preview"
            :class="(!hideHud && !$isMobile) ? 'wrapper-hud' : 'wrapper-hidden'"
            @pointerenter="$event.target.classList.add('isHovered')"
        >
            <div class="container">
                <div :style="leftContainerStyles">
                    <div
                        :class="['logo', mobileClasses]"
                        @pointerover="() => updateHoverInfo('logo')"
                        @pointerleave="() => resetHoverInfo('logo')"
                    >
                        <Logo :hover="isHovered('logo')" />
                        <div class="dropdown-wrapper">
                            <template
                                v-if="this.editorManager.specificationLoaded"
                            >
                                <DropdownItem
                                    id="create-new-graph-button"
                                    v-if="!readonly"
                                    text="Create new graph"
                                    type="'button'"
                                    :eventFunction="createNewGraphCallback"
                                />

                                <DropdownItem
                                    id="create-new-node-button"
                                    v-if="!readonly"
                                    text="Create new node"
                                    type="'button'"
                                    :eventFunction="createNewNodeCallback"
                                />

                                <!-- eslint-disable-next-line max-len -->
                                <template v-if="this.externalApplicationManager.externalApplicationConnected">
                                    <hr />
                                    <DropdownItem
                                        text="Load file"
                                        id="request-dataflow-button"
                                        :eventFunction="importDataflow"
                                    />
                                    <DropdownItem
                                        text="Save file"
                                        type="button"
                                        :eventFunction="(async () => requestDataflowExport(false))"
                                    />
                                    <DropdownItem
                                        text="Save file as..."
                                        type="button"
                                        :eventFunction="(async () => requestDataflowExport(true))"
                                    />
                                </template>
                                <hr />
                            </template>

                            <template
                                v-if="!this.externalApplicationManager.backendAvailable && !hideHud"
                            >
                                <DropdownItem
                                    text="Load specification"
                                    id="load-spec-button"
                                    :eventFunction="loadSpecificationCallback"
                                />
                                <DropdownItem
                                    v-if="this.editorManager.specificationLoaded"
                                    text="Save specification as..."
                                    type="'button'"
                                    :eventFunction="() => {
                                        saveMenuShow = !saveMenuShow
                                        saveConfiguration = saveSpecificationConfiguration
                                    }"
                                />
                                <hr />
                            </template>

                            <template v-if="this.editorManager.specificationLoaded">
                                <DropdownItem
                                    v-if="!hideHud"
                                    id="load-dataflow-button"
                                    text="Load graph file"
                                    :eventFunction="loadDataflowCallback"
                                />
                                <DropdownItem
                                    type="'button'"
                                    text="Save graph file"
                                    :eventFunction="() => saveGraphConfiguration.saveCallback()"
                                />
                                <DropdownItem
                                    type="'button'"
                                    text="Save graph as file as..."
                                    :eventFunction="() => {
                                        saveMenuShow = !saveMenuShow
                                        saveConfiguration = saveGraphConfiguration
                                    }"
                                />
                                <hr />
                            </template>

                            <DropdownItem
                                type="'button'"
                                text="Export graph to PNG"
                                :eventFunction="exportToPng"
                            />
                            <DropdownItem
                                type="'button'"
                                text="Export graph to HTML-based SVG"
                                :eventFunction="exportToSvg"
                            />
                        </div>
                    </div>

                    <div
                        ref="palette"
                        v-if="!hideHud && !readonly"
                        :class="['hoverbox', mobileClasses]"
                        role="button"
                        @click="() => togglePanel(panels.palette)"
                        @pointerover="() => updateHoverInfo('palette')"
                        @pointerleave="() => resetHoverInfo('palette')"
                    >
                        <Cube :hover="isHovered('palette')" class="small_svg"/>
                        <div :class="['tooltip', mobileClasses]">
                            <span v-if="paletteOpen">Hide node browser</span>
                            <span v-else>Show node browser</span>
                        </div>
                    </div>

                    <template v-if="this.externalApplicationManager.backendAvailable">
                        <div
                            v-for="actionItem in navbarItems"
                            :key="actionItem.name"
                            :id="`navbar-button-${actionItem.procedureName}`"
                            :class="[
                                (
                                    (activeNavbarItems.includes(actionItem.procedureName)
                                    || isInProgress(actionItem.procedureName))
                                    ? 'hoverbox' : 'box'
                                ),
                                mobileClasses, {
                                'button-in-progress': isInProgress(actionItem.procedureName),
                            }]"
                            role="button"
                            @click="(async () => requestDataflowAction(actionItem))"
                            @pointerover="() => updateHoverInfo(actionItem.procedureName, true)"
                            @pointerleave="() => resetHoverInfo(actionItem.procedureName)"
                        >
                            <!-- imgURI is used for Placeholder Icon to retrieve the image -->
                            <CassetteStop
                                v-if="
                                    isStoppable(actionItem.procedureName)
                                    && isInProgress(actionItem.procedureName)
                                "
                                class="small_svg"
                                :hover="isHovered(actionItem.procedureName)"
                            />
                            <component
                                v-else
                                class="small_svg"
                                :is="actionItem.icon"
                                :hover="isHovered(actionItem.procedureName)"
                                :imgURI="actionItem.iconName"
                            />
                            <div class="progress-bar" />
                            <div :class="['tooltip', mobileClasses]">
                                <span>
                                    {{ getNavbarActionTooltip(actionItem) }}
                                </span>
                            </div>
                        </div>
                    </template>
                    <div
                        v-if="this.editorManager.editor.isInSubgraph()"
                        :class="['hoverbox', mobileClasses]"
                        role="button"
                        @click="returnFromSubgraph"
                        @pointerover="() => updateHoverInfo('subgraphReturn')"
                        @pointerleave="() => resetHoverInfo('subgraphReturn')"
                    >
                        <Arrow
                            rotate="down"
                            :hover="isHovered('subgraphReturn')"
                            color="white"
                            class="small_svg"
                        />
                        <div :class="['tooltip', mobileClasses]">
                            <span>Return from subgraph editor</span>
                        </div>
                    </div>
                </div>
                <component
                    v-if="editTitle && !panels.nodesearch.isOpen"
                    :is="editorTitleInterface.component"
                    :intf="editorTitleInterface"
                    :class="['editorTitleInput', mobileClasses]"
                    v-model="graphName"
                    v-click-outside="() => { editTitle = false }"
                />
                <span
                    v-if="!editTitle && !panels.nodesearch.isOpen"
                    :class="['editorTitle', mobileClasses]"
                    @dblclick="editTitle = !readonly">
                        {{ editorTitle }}
                </span>
                <div :style="rightContainerStyles">
                    <div
                        ref="searchbar"
                        :class="['hoverbox', mobileClasses]"
                        role="button"
                        @pointerover="() => updateHoverInfo('search')"
                        @pointerleave="() => {
                            resetHoverInfo('search');
                        }"
                        @click="onClickNodeSearch"
                        v-click-outside="() => panels.nodesearch.isOpen =
                            searchEditorNodesQuery != ''"
                    >
                        <Magnifier
                            :hover="isHovered('search')"
                            class="small_svg"
                        />
                        <div :class="['tooltip', mobileClasses, settingsTooltipClasses]">
                            <span v-if="!panels.nodesearch.isOpen">Show node search bar</span>
                            <span v-else>Hide node search bar</span>
                        </div>
                    </div>
                    <div
                        v-show="panels.nodesearch.isOpen"
                        :style="nodesearchInputStyles"
                        :class="['search-editor-nodes', mobileClasses]"
                    >
                        <input
                            ref="searchbarInput"
                            v-model="searchEditorNodesQuery"
                            placeholder="Search for nodes"
                        />
                    </div>
                    <div
                        ref="fullscreen"
                        :class="['hoverbox', mobileClasses]"
                        role="button"
                        @click="toggleFullscreen"
                        @pointerover="() => updateHoverInfo('Fullscreen')"
                        @pointerleave="() => resetHoverInfo('Fullscreen')"
                    >
                        <Expand
                            :hover="isHovered('Fullscreen')"
                            class="small_svg"
                            v-if="!panels.fullscreen.isOpen"
                        />
                        <Collapse :hover="isHovered('Fullscreen')" class="small_svg" v-else />
                        <div :class="['tooltip', mobileClasses, settingsTooltipClasses]">
                            <span v-if="!panels.fullscreen.isOpen">Enable fullscreen</span>
                            <span v-else>Disable fullscreen</span>
                        </div>
                    </div>
                    <div
                        ref="settings"
                        :class="['hoverbox', mobileClasses]"
                        role="button"
                        @click="() => togglePanel(panels.settings)"
                        @pointerover="() => updateHoverInfo('settings')"
                        @pointerleave="() => resetHoverInfo('settings')"
                        v-click-outside="() => panels.settings.isOpen = false"
                    >
                        <Cogwheel :hover="isHovered('settings')" class="small_svg" />
                        <div :class="['tooltip', mobileClasses, settingsTooltipClasses]">
                            <span v-if="!panels.settings.isOpen">Show settings</span>
                            <span v-else>Hide settings</span>
                        </div>
                    </div>
                    <div
                        ref="backend"
                        :class="['hoverbox', mobileClasses]"
                        v-if="this.externalApplicationManager.backendAvailable"
                        @click="() => togglePanel(panels.backendStatus)"
                        @pointerover="() => updateHoverInfo('backendStatus')"
                        @pointerleave="() => resetHoverInfo('backendStatus')"
                    >
                        <Backend
                            v-if="this.externalApplicationManager.externalApplicationConnected"
                            color="connected"
                            class="small_svg"
                            :active="backendStatusOpen"
                            :hover="isHovered('backendStatus')"
                        />
                        <Backend
                            v-else color="disconnected"
                            class="small_svg"
                            :active="backendStatusOpen"
                            :hover="isHovered('backendStatus')"
                        />
                        <div :class="['tooltip', mobileClasses, backendStatusTooltipClasses]">
                            <span>Backend status</span>
                        </div>
                        <div
                            v-click-outside="(ev) => clickOutside(ev, panels.backendStatus)"
                            class="backend-status"
                        >
                            <div>
                                <span>Client status:</span>
                                <!-- eslint-disable-next-line max-len -->
                                <span v-if="this.externalApplicationManager.externalApplicationConnected"
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
                        :class="['hoverbox', mobileClasses]"
                        role="button"
                        @click="() => togglePanel(panels.notifications)"
                        @pointerover="() => updateHoverInfo('notifications')"
                        @pointerleave="() => resetHoverInfo('notifications')"
                    >
                        <Bell
                            id="navbar-bell"
                            :color="
                                (this.notificationStore.notifications.length > 0) ?
                                'green' : 'gray'
                            "
                            :hover="isHovered('notifications')"
                            class="small_svg"
                        />
                        <div
                            v-if="notificationsOpen"
                            :class="['tooltip', mobileClasses, notificationsTooltipClasses]"
                        >
                            <span>Hide notifications</span>
                        </div>
                        <div
                            v-else :class="['tooltip', mobileClasses, notificationsTooltipClasses]"
                        >
                            <span>Show notifications</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="progress-bar" />
        </div>
        <Notifications v-click-outside="(ev) => clickOutside(ev, panels.notifications)" />
        <Settings
            v-click-outside="(ev) => clickOutside(ev, panels.settings)"
            :viewModel="editorManager.baklavaView"
        />
        <CustomSidebar
            @sidebar-open="openNavbar"
        />
    </div>
</template>

<style lang="scss" scoped>
.wrapper {
    z-index: 5;
}

.wrapper-hud {
    position: relative;
}

.wrapper-hidden {
    $navbar-padding-bottom: calc($navbar-height * 1.5);
    position: absolute;
    width: 100%;
    top: -$navbar-height;
    padding-bottom: $navbar-padding-bottom;
    transition: 0.2s;

    &.isHovered {
        transform: translateY($navbar-height);
        padding-bottom: 0;
    }

    &:not(.isHovered) > .progress-bar {
        bottom: calc($navbar-padding-bottom + 1px);
    }
}

.container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: $navbar-height;
    background-color: $gray-600;
    border: 1px solid $gray-500;
    border-left: 0;
    border-right: 0;

    .editorTitle {
        width: auto;
        text-wrap: wrap;
        flex-grow: 1;

        cursor: text;
        text-align: center;
        padding: 0 $spacing-s;

        &.compressed-mobile {
            display: none;
        }
    }

    .editorTitleInput {
        font-size: $fs-small;
        padding: 0 $spacing-s;
        flex-grow: 1;

        &.compressed-mobile {
            display: none;
        }
    }

    .progress-bar {
        position: absolute;
        height: calc(60px * 0.2);
        left: 0;
        bottom: 0;
        border-radius: 3px;
        z-index: 5;
        background-color: $green;

        &.animate {
            animation: pulse ease-in-out 2s infinite;

            @keyframes pulse {
                0% {
                    left: 0;
                    width: 0;
                }
                50% {
                    width: 100%;
                    left: 0;
                }
                100% {
                    left: 100%;
                    width: 0%;
                }
            }
        }
    }

    & > div {
        display: inherit;
        flex-grow: 1;

        & > div {
            flex-grow: 0;
            display: flex;
            width: 3.75em;
            height: 3.75em;

            justify-content: center;
            align-items: center;
            position: relative;
            box-sizing: border-box;
            border-left: 1px solid $gray-500;

            // If the navbar is compressed, the navbar button should shrink
            &.compressed-mobile {
                width: auto;
                flex-grow: 1;
                max-width: 3.75em;
            }

            &:last-child {
                border-right: 1px solid $gray-500;
            }

            & > svg {
                display: block;
                width: 1.6875em;
                height: 1.6875em;
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
            & > .small_svg_stop {
                position: absolute;
                width: 0.8em;
                height: 0.8em;
                top: 8%;
                right: 8%;
                stroke: $gray-100;
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

                &.last {
                    transform: translate(-75%, 25%);
                }
                &.first {
                    transform: translate(-25%, 25%);
                }
            }

            &.logo:hover > .dropdown-wrapper {
                display: flex;
            }

            &.box, &.hoverbox {
                & > .small_svg {
                    fill: $white;
                }

                &:hover {
                    & > .tooltip {
                        &:not(.compressed-mobile) {
                            display: flex;
                            z-index: 11;
                        }
                    }
                }
            }
            &.hoverbox:hover {
                cursor: pointer;

                & > .small_svg {
                    fill: $green;
                }

                & > .small_svg_stop {
                    stroke: $red-dark;
                }
            }
            &.box > .small_svg {
                filter: brightness(50%);
            }

            &.search-editor-nodes {
                max-width: calc(3.75em * 4);

                & > input {
                    width: 100%;
                    height: 100%;
                    padding: 0 0.5em;

                    color: $white;
                    border: none;
                    background-color: $gray-600;

                    &:focus {
                        outline: 1px solid $green;
                        z-index: 12;
                    }

                    &::placeholder {
                        opacity: 0.5;
                    }
                }

                // on smaller screens display search bellow NavBar
                &.compressed-mobile {
                    position: absolute;
                    top: calc($navbar-height + 1px);
                    max-width: 40vw;

                    border: 1px solid $gray-500;
                    box-sizing: border-box;
                }
            }
        }
    }
}

span {
    font-size: $fs-small;
    color: $white;
    user-select: none;
}

.prevent-select {
    -webkit-user-select: none; /* Safari */
    -ms-user-select: none; /* IE 10 and IE 11 */
    user-select: none; /* Standard syntax */
}
</style>
