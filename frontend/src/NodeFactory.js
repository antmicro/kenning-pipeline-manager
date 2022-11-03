import { NodeBuilder } from "@baklavajs/core";

export function NodeFactory(name, displayName, inputs, properties, outputs) {
    const newNode = new NodeBuilder(name).setName(displayName);
    const createProperty = (keywords) => {
        const propName = keywords["name"];
        const propType = keywords["type"];
        const propDef = keywords["default"];
        switch (propType) {
            case "text":
                newNode.addOption(propName, "InputOption", propDef);
                break;
            case "number":
                newNode.addOption(propName, "NumberOption", propDef);
                break;
            case "integer":
                newNode.addOption(propName, "IntegerOption", propDef);
                break;
            case "select":
                const items = keywords["values"].map(element => ({
                    "text": element.toString(),
                    "value": element
                }))
                newNode.addOption(propName, "SelectOption", propDef,
                    undefined, { items: items });
                break;
            case "checkbox":
                newNode.addOption(propName, "CheckboxOption", propDef);
                break;
            case "slider":
                newNode.addOption(propName, "SliderOption", propDef,
                    undefined, { min: keywords["min"], max: keywords["max"] });
                break;
            default:
                console.error(propType, "- input type is not recognized.")
        }
    }

    inputs.forEach(i => newNode.addInputInterface(i["name"], undefined, undefined, { "type": i["type"] }));
    properties.forEach(p => createProperty(p));
    outputs.forEach(o => newNode.addOutputInterface(o["name"], { "type": o["type"] }));

    return newNode.build();
}
