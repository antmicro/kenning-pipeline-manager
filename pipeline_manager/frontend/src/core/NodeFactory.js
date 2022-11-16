import { Node } from "@baklavajs/core"
/**
 * Class factory that creates a class for a custom Node that is described by the arguments.
 * It can be later registered so that the user can use it and save the editor.
 * `inputs`, `properties` and `outputs` formats are described in the documentation.
 * 
 * @param {string} name Name of the block that is stored when saving
 * @param {string} displayName Name of the block displayed to the user
 * @param {*} inputs List of inputs of the block.
 * @param {*} properties List of properties of the block
 * @param {*} outputs List of outputs of the block
 * @returns Node based class
 */
export function NodeFactory(name, displayName, inputs, properties, outputs) {
    return class extends Node {

        type = name;
        name = displayName;

        constructor() {
            super();
            inputs.forEach(i => this.addInputInterface(i["name"], undefined, undefined, { "type": i["type"] }));
            properties.forEach(p => 
            {
                const propName = p["name"];
                const propType = p["type"];
                const propDef = p["default"];
                switch (propType) {
                    case "text":
                        this.addOption(propName, "InputOption", propDef);
                        break;
                    case "number":
                        this.addOption(propName, "NumberOption", propDef);
                        break;
                    case "integer":
                        this.addOption(propName, "IntegerOption", propDef);
                        break;
                    case "select":
                        const items = p["values"].map(element => ({
                            "text": element.toString(),
                            "value": element
                        }));
                        this.addOption(propName, "SelectOption", propDef,
                            undefined, { items: items });
                        break;
                    case "checkbox":
                        this.addOption(propName, "CheckboxOption", propDef);
                        break;
                    case "slider":
                        this.addOption(propName, "SliderOption", propDef,
                            undefined, { min: p["min"], max: p["max"] });
                        break;
                    case "list":
                        this.addOption(propName, "ListOption", undefined, undefined, { dtype: p["dtype"] });
                        break;
                    default:
                        console.error(propType, "- input type is not recognized.")
            }});
            outputs.forEach(o => this.addOutputInterface(o["name"], { "type": o["type"] }));
        }

        /**
         * Called for every node when editor saves its content.
         * In addition to saving a node two properties are added.
         * `isInput` states whether a socket is an input or an output.
         * `type` is a type of the socket that was passed when creating the node.
         * @returns Saved node's state
         */
        save() {
            const state = super.save();
            state.interfaces.forEach(([name, intfState]) => {
                intfState.isInput = this.getInterface(name).isInput;
                intfState.type = this.getInterface(name).type;
            });
            return state;
        }
    };
}
