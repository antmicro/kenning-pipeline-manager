import EditorManager from './src/core/EditorManager.js';
import fs from 'fs';

console.warn = function() {}; // Supressing baklavajs logging

fs.readFile(process.argv[2], async function (err, spec) {
    const instance = EditorManager.getEditorManagerInstance();

    let validationError = instance.validateSpecification(spec.toString());
    if (Array.isArray(validationError) && validationError.length) {
        console.log('Specification errors:')
        validationError.forEach((error) => console.log(`* \t\x1b[31m${error}\x1b[0m`))
        console.log('\x1b[31mSpecification invalid.\x1b[0m');
        return;
    }

    let { errors, warnings } = instance.updateEditorSpecification(spec.toString());
    if (Array.isArray(warnings) && warnings.length) {
        console.log('Specification warnings:')
        warnings.forEach((warning) => console.log(`* \t\x1b[33m${warning}\x1b[0m`))
    }
    if (Array.isArray(errors) && errors.length) {
        console.log('Specification errors:')
        errors.forEach((error) => console.log(`* \t\x1b[31m${error}\x1b[0m`))
        console.log('\x1b[31mSpecification invalid.\x1b[0m');
        return;
    }
    console.log('\x1b[32mSpecification valid.\x1b[0m');

    if (process.argv.length >= 4) {
        console.log('\n-----\n')
        fs.readFile(process.argv[3], async function (err, dataflow) {

            ({ errors, warnings } = await instance.loadDataflow(dataflow.toString()));
            if (Array.isArray(warnings) && warnings.length) {
                console.log('Dataflow warnings:')
                warnings.forEach((warning) => console.log(`* \t\x1b[33m${warning}\x1b[0m`))
            }
            if (Array.isArray(errors) && errors.length) {
                console.log('Dataflow errors:')
                errors.forEach((error) => console.log(`* \t\x1b[31m${error}\x1b[0m`))
                console.log('\x1b[31mDataflow invalid.\x1b[0m');

                return;
            }
            console.log('\x1b[32mDataflow valid.\x1b[0m');
        });
    }
});
