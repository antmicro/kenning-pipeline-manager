/*
 * Copyright (c) 2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

/**
 * Composable that implements editing of an interface's external name:
 * it owns the editor state, validates the name against the other exposed
 * names of the current graph and commits the name via the editor.
 */

import { ref } from 'vue';
import { useViewModel, useGraph } from '@baklavajs/renderer-vue';

/**
 * Composable for external name editing.
 *
 * @param {CustomNodeInterface} intf - The interface whose external name is managed.
 * @returns {{
 *   editExternalName: import('vue').Ref<boolean>,
 *   enableExternalNameEdit: (e: MouseEvent) => void,
 *   externalNameFocusOutCallback: () => void,
 *   externalNameInputIncorrect: import('vue').Ref<boolean>,
 *   inputExternalName: import('vue').Ref<string>,
 *   onExternalNameInput: (e: Event) => void
 * }}
 */
export default function useExternalName(intf) {
    const { viewModel } = useViewModel();
    const { graph } = useGraph();

    const editExternalName = ref(false);
    const externalNameInputIncorrect = ref(false);
    const externalNames = [];

    const inputExternalName = ref(intf.externalName);

    /**
     * Update the list of external names of the interfaces in the current graph.
     */
    const updateExternalNames = () => {
        externalNames.splice(0, externalNames.length);
        externalNames.push(...graph.value.obtainExposedNames());
        externalNames.splice(externalNames.indexOf(intf.externalName), 1);
    };

    /**
     * Enables editing of the external name and validates current name.
     *
     * @param {MouseEvent} e - The click event that triggered editing.
     */
    const enableExternalNameEdit = (e) => {
        // Get the list of external names of the interfaces in the subgraph
        updateExternalNames();

        editExternalName.value = true;
        e.preventDefault();

        externalNameInputIncorrect.value = graph.value.isIncorrectExternalName(
            intf.externalName,
            externalNames,
        );
    };

    /**
     * Sets the current input value for external name.
     *
     * @param {string} value - The new external name input value.
     */
    const setInputExternalName = (value) => {
        inputExternalName.value = value;
    };

    /**
     * Validates the external name input on change.
     *
     * @param {Event} e - Input event with target value.
     */
    const externalNameInputCallback = (e) => {
        externalNameInputIncorrect.value = graph.value.isIncorrectExternalName(
            e.target.value,
            externalNames,
        );
    };

    /**
     * Handles focus out from external name input, commits changes if needed.
     */
    const externalNameFocusOutCallback = () => {
        editExternalName.value = false;
        externalNameInputIncorrect.value = false;
        if (inputExternalName.value === intf.externalName) return;

        const newExternalName = graph.value.resolveNewExposedName(inputExternalName.value);
        inputExternalName.value = newExternalName;

        viewModel.value.editor.exposeInterface(
            graph.value.id,
            intf,
            newExternalName,
        );
    };

    /**
     * Handles input event for external name field.
     *
     * @param {Event} e - Input event.
     */
    const onExternalNameInput = (e) => {
        setInputExternalName(e.target.value);
        externalNameInputCallback(e);
    };

    return {
        editExternalName,
        enableExternalNameEdit,
        externalNameFocusOutCallback,
        externalNameInputIncorrect,
        inputExternalName,
        onExternalNameInput,
    };
}
