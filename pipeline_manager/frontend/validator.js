import EditorManager from './src/core/EditorManager.js';
import fs from 'fs';

if (process.argv.length >= 3) {
    fs.readFile(process.argv[2], async function (err, spec) {
        const instance = EditorManager.getEditorManagerInstance();

        let { errors, warnings } = instance.updateEditorSpecification(spec.toString());
        if (Array.isArray(warnings) && warnings.length) {
            console.log('Specification warnings:')
            console.log(warnings);
        }
        if (Array.isArray(errors) && errors.length) {
            console.log('Specification invalid, errors:')
            console.log(errors);
            return;
        }
        console.log('Specification valid.\n');

        if (process.argv.length >= 4) {
            fs.readFile(process.argv[3], async function (err, dataflow) {
                ({ errors, warnings } = await instance.loadDataflow(JSON.parse(dataflow.toString())));
                if (Array.isArray(warnings) && warnings.length) {
                    console.log('Dataflow warnings:')
                    console.log(warnings);
                }
                if (Array.isArray(errors) && errors.length) {
                    console.log('Dataflow invalid, errors:')
                    console.log(errors);
                    return;
                }
                console.log('Dataflow valid.\n');
            });
        }
    });
} else {
    console.log(
        'Pass specification path and optionally dataflow path\n\n' +
        'Example:\n' +
        'node validator.js <specification_path.json> <dataflow_path.json>'
    )
}
