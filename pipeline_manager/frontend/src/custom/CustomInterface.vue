<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Interface that is used to display inputs, outputs and properties of a node.

The custom implementations introduces wrapper functions that prevent the user
from creating and deleting connections or altering nodes' values if the editor is read-only.

The rendering is split across four components, one per interface kind:
`InterfaceBus` (bus), `InterfacePort` (normal interface),
`InterfacePositioned` (custom shape / positioned interface) and
`InterfaceProperty` (properties). This component keeps the shared state and
the root element, and picks the right one for the given interface.
-->

<template>
    <div
        :id="intf.id"
        ref="el"
        class="baklava-node-interface"
        :class="newClasses(intf)"
    >
        <InterfaceBus
            v-if="intf.port && intf.bus?.type"
            :intf="intf"
            :temporaryConnection="temporaryConnection"
            :nodeWidth="width"
            :highlighted="highlighted"
            :picked="picked"
            :hide-port="hidePort"
            :is-exposed="isExposed"
            :hovered="hovered"
            :edit-external-name="editExternalName"
            :input-external-name="inputExternalName"
            :external-name-input-incorrect="externalNameInputIncorrect"
            :temp-bus-intf-offset="tempBusIntfOffset"
            :new-classes="newClasses"
            :start-hover-wrapper="startHoverWrapper"
            :end-hover-wrapper="endHoverWrapper"
            :on-mouse-down="onMouseDown"
            :external-name-focus-out-callback="externalNameFocusOutCallback"
            :external-name-input-callback="externalNameInputCallback"
            :enable-external-name-edit="enableExternalNameEdit"
            :set-input-external-name="setInputExternalName"
        />
        <InterfacePort
            v-if="intf.port && !intf.bus?.size && !hidePort && !positioned"
            :intf="intf"
            :highlighted="highlighted"
            :picked="picked"
            :is-exposed="isExposed"
            :hovered="hovered"
            :edit-external-name="editExternalName"
            :input-external-name="inputExternalName"
            :external-name-input-incorrect="externalNameInputIncorrect"
            :display-arrow="displayArrow"
            :arrow-rotation="arrowRotation"
            :start-hover-wrapper="startHoverWrapper"
            :end-hover-wrapper="endHoverWrapper"
            :on-mouse-down="onMouseDown"
            :external-name-focus-out-callback="externalNameFocusOutCallback"
            :external-name-input-callback="externalNameInputCallback"
            :enable-external-name-edit="enableExternalNameEdit"
            :set-input-external-name="setInputExternalName"
        />
        <InterfacePositioned
            v-if="intf.port && !intf.bus?.size && !hidePort && positioned"
            :intf="intf"
            :highlighted="highlighted"
            :picked="picked"
            :is-exposed="isExposed"
            :hovered="hovered"
            :edit-external-name="editExternalName"
            :input-external-name="inputExternalName"
            :external-name-input-incorrect="externalNameInputIncorrect"
            :display-arrow="displayArrow"
            :arrow-rotation="arrowRotation"
            :start-hover-wrapper="startHoverWrapper"
            :end-hover-wrapper="endHoverWrapper"
            :on-mouse-down="onMouseDown"
            :external-name-focus-out-callback="externalNameFocusOutCallback"
            :external-name-input-callback="externalNameInputCallback"
            :enable-external-name-edit="enableExternalNameEdit"
            :set-input-external-name="setInputExternalName"
        />
        <InterfaceProperty
            :intf="intf"
            :node="node"
            :positioned="positioned"
            :hiddenName="hiddenName"
            :show-component="showComponent"
            :tabindex-value="tabindexValue"
            :is-exposed="isExposed"
            :property-hovered="hovered"
            :edit-external-name="editExternalName"
            :input-external-name="inputExternalName"
            :external-name-input-incorrect="externalNameInputIncorrect"
            :sidebar="sidebar"
            :start-property-hover="startPropertyHover"
            :end-property-hover="endPropertyHover"
            :external-name-focus-out-callback="externalNameFocusOutCallback"
            :external-name-input-callback="externalNameInputCallback"
            :enable-external-name-edit="enableExternalNameEdit"
            :set-input-external-name="setInputExternalName"
        />
    </div>
</template>

<script>
import {
    defineComponent, ref, computed,
} from 'vue';
import { useElementSize } from '@vueuse/core';
import {
    Components, useViewModel, useGraph,
} from '@baklavajs/renderer-vue';
import doubleClick from '../core/doubleClick';
import { useTemporaryConnection } from './temporaryConnection';
import InterfaceBus from './InterfaceBus.vue';
import InterfacePort from './InterfacePort.vue';
import InterfacePositioned from './InterfacePositioned.vue';
import InterfaceProperty from './InterfaceProperty.vue';

export default defineComponent({
    extends: Components.NodeInterface,
    components: {
        InterfaceBus,
        InterfacePort,
        InterfacePositioned,
        InterfaceProperty,
    },
    props: {
        highlighted: Boolean,
        picked: Boolean,
        positioned: { default: false, required: false },
        hiddenName: { default: false, required: false },
        switchSides: {},
        toggleGroup: { default: () => {}, required: false },
        updateDynamicInterfaces: { default: () => {}, required: false },
        sidebar: { default: false, required: false },
        hidePort: { default: false, required: false },
        tabindexValue: { default: -1, required: false },
    },
    setup(props) {
        const {
            el, isConnected, showComponent, openSidebar,
        } =
            Components.NodeInterface.setup(props);

        const { width } = useElementSize(el);

        const { viewModel } = useViewModel();
        const { graph } = useGraph();
        const { hoveredOver, temporaryConnection } = props.sidebar ?
            { hoveredOver: null, temporaryConnection: null } : useTemporaryConnection();

        const isPositionedInterface = props.intf.isPositioned();

        props.intf.events.beforeSetValue.unsubscribe(props.intf);
        props.intf.events.beforeSetValue.subscribe(props.intf, (value, prevent) => {
            if (viewModel.value.editor.readonly) {
                prevent();
            }

            if (
                (props.intf.min !== undefined && value < props.intf.min) ||
                (props.intf.max !== undefined && value > props.intf.max)
            ) {
                prevent();
            }
        });
        if (props.intf.isGrouped()) {
            props.toggleGroup(props.intf);
            props.intf.events.setValue.unsubscribe(props.intf);
            props.intf.events.setValue.subscribe(props.intf, () => props.toggleGroup(props.intf));
        }

        if (props.intf.dynamicCounter) {
            props.updateDynamicInterfaces(props.intf);
            props.intf.events.setValue.unsubscribe(props.intf);
            props.intf.events.setValue.subscribe(props.intf, () =>
                props.updateDynamicInterfaces(props.intf),
            );
        }

        const hovered = ref(false);
        const startHoverWrapper = (_) => {
            hovered.value = true;
            if (!viewModel.value.editor.readonly) {
                hoveredOver(props.intf);
            }
        };

        const endHoverWrapper = () => {
            hovered.value = false;
            if (!viewModel.value.editor.readonly) {
                hoveredOver(undefined);
            }
        };

        const propertyHovered = ref(false);
        const startPropertyHover = () => {
            propertyHovered.value = true;
        };

        const endPropertyHover = () => {
            propertyHovered.value = false;
        };

        /* eslint-disable vue/no-mutating-props,no-param-reassign */
        const onMouseDown = doubleClick(700, () => {
            const isNotBigBus = !props.intf.isTwoSidedBus();
            if (!viewModel.value.editor.readonly && isNotBigBus && !props.positioned) {
                props.switchSides(props.intf);
                hoveredOver(undefined);
            }
        });

        const displayArrow = props.intf.port && props.intf.direction !== 'inout';
        const arrowRotation = computed(() => {
            if (props.intf.direction === 'input') {
                if (props.intf.side === 'left') {
                    return 'right';
                }
                if (props.intf.side === 'right') {
                    return 'down';
                }
                if (props.intf.side === 'top') {
                    return 'left';
                }
                if (props.intf.side === 'bottom') {
                    return 'up';
                }
            }
            if (props.intf.direction === 'output') {
                if (props.intf.side === 'left') {
                    return 'down';
                }
                if (props.intf.side === 'right') {
                    return 'right';
                }
                if (props.intf.side === 'top') {
                    return 'up';
                }
                if (props.intf.side === 'bottom') {
                    return 'left';
                }
            }
            return 'down';
        });

        const newClasses = (intf) => ({
            // intf may be a plain bus stub, which never carries a two-sided bus
            '--input': intf.side === 'left' && intf.bus?.type !== 'twoSided' && !props.positioned,
            '--output': intf.side === 'right' && intf.bus?.type !== 'twoSided' && !props.positioned,
            '--connected': intf.connectionCount > 0,
            '--positioned': props.positioned,
        });

        const isExposed = computed(() =>
            props.intf.externalName !== undefined,
        );

        // External name editing
        const editExternalName = ref(false);
        const externalNameInputIncorrect = ref(false);
        const externalNames = [];

        const inputExternalName = ref(props.intf.externalName);

        /**
         * Update the list of external names of the interfaces in the current graph.
         */
        const updateExternalNames = () => {
            externalNames.splice(0, externalNames.length);
            externalNames.push(...graph.value.obtainExposedNames());
            externalNames.splice(externalNames.indexOf(props.intf.externalName), 1);
        };

        const enableExternalNameEdit = (e) => {
            // Get the list of external names of the interfaces in the subgraph
            updateExternalNames();

            editExternalName.value = true;
            e.preventDefault();

            externalNameInputIncorrect.value = graph.value.isIncorrectExternalName(
                props.intf.externalName,
                externalNames,
            );
        };

        const setInputExternalName = (value) => {
            inputExternalName.value = value;
        };

        const externalNameInputCallback = (e) => {
            externalNameInputIncorrect.value = graph.value.isIncorrectExternalName(
                e.target.value,
                externalNames,
            );
        };

        const externalNameFocusOutCallback = () => {
            editExternalName.value = false;
            externalNameInputIncorrect.value = false;
            if (inputExternalName.value === props.intf.externalName) return;

            const newExternalName = graph.value.resolveNewExposedName(inputExternalName.value);
            inputExternalName.value = newExternalName;

            viewModel.value.editor.exposeInterface(
                graph.value.id,
                props.intf,
                newExternalName,
            );
        };

        return {
            arrowRotation,
            displayArrow,
            editExternalName,
            el,
            enableExternalNameEdit,
            endHoverWrapper,
            externalNameInputIncorrect,
            externalNameInputCallback,
            externalNameFocusOutCallback,
            hovered,
            isConnected,
            inputExternalName,
            newClasses,
            onMouseDown,
            openSidebar,
            showComponent,
            isExposed,
            isPositionedInterface,
            startHoverWrapper,
            propertyHovered,
            startPropertyHover,
            endPropertyHover,
            setInputExternalName,
            temporaryConnection,
            width,
        };
    },
});
</script>
