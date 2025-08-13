/**
 * Copyright (c) 2020-2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Module for constructing and validating the specification for the Pipeline Manager.
 *
 * Can be used by other applications to quickly form the specification
 * for the Pipeline Manager server from the browser level.
 *
 * This is the JavaScript equivalent of the Python version of SpecificationBuilder,
 * which delegates most of its operations to it, so if there are any changes to
 * the Python API, the corespoding methods will need to be adapted.
 */

import { loadPyodide } from 'pyodide';

import { assert } from '@vueuse/core';
import dataStructuresRaw from '../../dataflow_builder/data_structures.py';
import specificationBuilderRaw from '../../specification_builder.py';
import retrievePythonMethodsInfoRaw from './retrieve_python_methods_info.py';
import argumentPreparationUtilsRaw from './argument_preparation_utils.py';

import EditorManager from '../src/core/EditorManager.js';

/**
Is raised when any inconsistency in the specification generation
is spotted.
*/
class SpecificationBuilderError extends Error {
    constructor(message) {
        super(message);

        this.name = 'SpecificationBuilderError';
    }
}

/**
 * Creates a specification file and checks validity of files.
 *
 * This class allows to:
 *
 * Create and modify specification entries using simple API
 * Merge existing specifications with some consistency checks
 * Check URLs to remote resources in terms of availability
 * * Checks correctness of paths to assets from the given directory
 *
 * This class also performs very strict checking, e.g. it does not
 * allow creating duplicates.
 * In case of any errors spotted it raises a
 * SpecificationBuilderError.
 */
export class SpecificationBuilder {
    /**
     * Asynchronous constructor creates a SpecificationBuilder instance.
     *
     * @param {string} version - Specification version that we are going to use.
     * @param {string} assetsDir - Path to the assets directory.
     * @param {boolean} [checkUrls=false] - Tells if the URLs in the specification should be checked
     */
    constructor(version, { assetsDir = null, checkUrls = false } = {}) {
        // specification builder instance name for pyodide namespace
        const specBuilder = 'specBuilder';
        this.specBuilderPythonName = specBuilder;

        // method name => header, whole definition, last line
        this.generatedMethods = {};

        const addSependencies = async () => {
            await this.pyodide.loadPackage('micropip');
            const micropip = this.pyodide.pyimport('micropip');
            await micropip.install('requests');
            await micropip.install('urllib3');
        };

        const prepareNamespace = async () => {
            const namespace = this.pyodide.globals.get('dict')();
            this.pyodide.runPython(
                [
                    dataStructuresRaw,
                    specificationBuilderRaw,
                    argumentPreparationUtilsRaw,
                ].join('\n'),
                { globals: namespace });
            return namespace;
        };

        const generateMethods = () => {
            const methodsSpecs = JSON.parse(this.pyodide.runPython(
                retrievePythonMethodsInfoRaw,
                { globals: this.namespace },
            ));

            methodsSpecs.forEach(({
                name, args, defaults, returns,
            }) => {
                defaults = Array.isArray(defaults) ? defaults : [];

                // indicates whether python method's output can be stringified
                let toStringify = false;

                // gets rid of the `self` argument
                const mandatoryArgsNames = args.slice(1, args.length - defaults.length);

                // indicates whether `extends` or `default` special words appiered in python
                // methods arguments. If so, their names are replaced in optional
                // and mandatory arguments
                let replacedExtendsOptional = false;
                let replacedDefaultOptional = false;

                let idx;
                if ((idx = mandatoryArgsNames.indexOf('extends')) !== -1) mandatoryArgsNames[idx] = 'extend';
                if ((idx = mandatoryArgsNames.indexOf('default')) !== -1) mandatoryArgsNames[idx] = 'default_val';

                // result: all_args = "req_arg1, req_arg2, ..."
                let allArgs = mandatoryArgsNames.join(', ');

                // prepares optional arguments for JS method definition
                if (defaults.length !== 0) {
                    const optionalArgsNames = args.slice(args.length - defaults.length);
                    const optionalArgs = {};
                    optionalArgsNames.forEach((key, index) => {
                        optionalArgs[key] = defaults[index];
                    });

                    toStringify = 'stringify' in optionalArgs;
                    replacedExtendsOptional = 'extends' in optionalArgs;
                    replacedDefaultOptional = 'default' in optionalArgs;

                    if (replacedExtendsOptional) {
                        optionalArgs.extend = optionalArgs.extends;
                        delete optionalArgs.extends;
                    }

                    if (replacedDefaultOptional) {
                        optionalArgs.default_val = optionalArgs.default;
                        delete optionalArgs.default;
                    }

                    allArgs += (allArgs) ? ', {' : '{';
                    Object.entries(optionalArgs).forEach(([key, value]) => {
                        allArgs += `${String(key)} = ${JSON.stringify(value)}, `;
                    });

                    // result: all_args = "req_arg1, ..., {opt_arg1 = default1, ...} = {}"
                    allArgs = `${allArgs.slice(0, -2)}} = {}`;
                }

                // collects method body
                // here are addjustment of return statement and arguments names
                const methodHeaderLine = `function ${name} (${allArgs})`;
                const argsLine = `
                    let args = [...arguments]
                    let max_args_len = ${mandatoryArgsNames.length + ((defaults.length) ? 1 : 0)}`;
                const optionalArgsManipulations = `
                    if (${defaults.length} !== 0) {
                        let last_arg = args[max_args_len - 1]
                        if (last_arg !== undefined && typeof last_arg === 'object') {
                            if (${toStringify})
                                last_arg['stringify'] = true
                            if (${replacedExtendsOptional}) {
                                delete Object.assign(last_arg, {['extends']: last_arg['extend'] })['extend']
                                last_arg.extends = last_arg.extend
                                delete last_arg.extend
                            }
                            if (${replacedDefaultOptional}) {
                                last_arg.default = last_arg.default_val
                                delete last_arg.default_val
                            }
                        }
                        else if (${toStringify})
                            args.push({'stringify': true})
                    }`;
                const argsStrLine = '\nlet args_str = JSON.stringify(args)\n';
                let pythonCodeLine = `python_code = \`mandatory_args, optional_args = prepare_args('\$\{args_str\}', \$\{max_args_len${((defaults.length) ? '' : '+ 1')}\})`;
                pythonCodeLine += `\\n${specBuilder}.${name}(*mandatory_args, **optional_args)\``;
                const prefix = `${(returns) ? 'return ' : ''}${(toStringify) ? 'JSON.parse(' : ''}`;
                const suffix = `${(toStringify) ? ')' : ''};`;
                const executeReturnLine = `${prefix}this.pyodide.runPython(python_code, { globals: this.namespace })${suffix}`;

                // composes method body
                const method = `
                ${methodHeaderLine} {
                    ${argsLine}
                    ${optionalArgsManipulations}
                    ${argsStrLine}
                    ${pythonCodeLine}
                    ${executeReturnLine}
                }`;

                // assigns method to the class
                new Function(`this.${name} = ${method}`).call(this);

                this.generatedMethods[name] = {
                    header: methodHeaderLine,
                    lastLine: executeReturnLine,
                    wholeDefinition: method,
                };
            });
        };

        const constructorMain = async () => {
            this.pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
            await addSependencies();
            this.namespace = await prepareNamespace();

            // initialize Python's SpecificationBuilder
            const pythonPode = `mandatory_args = json.loads('${JSON.stringify([version, assetsDir, checkUrls])}')\n`
            + `${specBuilder} = SpecificationBuilder(*mandatory_args)`;
            this.pyodide.runPython(pythonPode, { globals: this.namespace });

            // generate methods corresponding to python specbuilder's ones
            generateMethods();

            return this;
        };

        return constructorMain();
    }

    /**
     * Creates a specification and validates it using schema.
     *
     * @param {boolean} fail_on_warnings - Tells if the specification creation should fail on warnings
     * @param {boolean} sort_spec - True if the entries in the specification should be sorted.
     * @returns {object} - Built specification, if successful
     * @throws {SpecificationBuilderError} - Raised when specification is not valid or when warnings appeared
     */
    async create_and_validate_spec({ fail_on_warning: failNnWarning = true, sort_spec = false } = {}) {
        assert(typeof this._construct_specification === 'function');
        const spec = this._construct_specification(sort_spec);

        const [res, warnings, errors] = await validate_specification(spec);

        if (Array.isArray(warnings) && warnings.length) {
            console.warn('Validation warnings:');
            warnings.forEach((warning) => console.warn(`* \t${warning}`));
        }

        if (res !== 0) throw new SpecificationBuilderError(errors);

        const line = `${this.specBuilderPythonName}.warnings`;
        const builderWarnings = this.pyodide.runPython(line, { globals: this.namespace });
        console.log(builderWarnings);

        if (failNnWarning) {
            if (builderWarnings > 0) {
                throw new SpecificationBuilderError(`Builder reported ${builderWarnings} issues, failing...`);
            }
        }
        return spec;
    }
}

/**
 * Validates specification.
 *
 * @param {object} specification - Specification json-like structure
 * @returns {[number, Array.<string>, Array.<string>]} - Triple of a status code, a warnings array,
 * and an errors array, where status code is: 0 if successful, 1 - invalid specificaion
 */
export async function validate_specification(specification) {
    const instance = EditorManager.getEditorManagerInstance();
    const { errors, warnings } = await instance.updateEditorSpecification(
        JSON.stringify(specification),
    );

    if (Array.isArray(errors) && errors.length) return ([1, warnings, errors]);

    return [0, warnings, errors];
}

/**
 * Validates graph with given associated specification.
 *
 * @param {object} dataflow - Dataflow json-like structures
 * @param {object} specification - Specification json-like structure
 * @returns {[number, Array.<string>, Array.<string>]} - Triple of a status code,
 * warnings array and an errors array, where status code is:
 * 0 if successful, 1 - invalid dataflow
 */
export async function validate_dataflow(dataflow, specification) {
    const instance = EditorManager.getEditorManagerInstance();
    let { errors, warnings } = await instance.updateEditorSpecification(JSON.stringify(specification));

    ({ errors, warnings } = await instance.loadDataflow(JSON.stringify(dataflow)));
    if (Array.isArray(errors) && errors.length) return [1, warnings, errors];
    return [0, warnings, errors];
}
