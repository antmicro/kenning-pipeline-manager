/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export default class BaseLayoutEngine {
    availableAlgorithms = [];

    // Base layout is an abstract class
    constructor() {
        if (this.constructor === BaseLayoutEngine) {
            throw new Error("Can't initialize base class instance"); // eslint-disable-line quotes
        }
    }

    chooseAlgorithm(algorithm) {
        if (!this.availableAlgorithms.includes(algorithm)) {
            throw new Error(
                `Could not find ${algorithm} in ${this.constructor.name} engine.
                Available algorithms: ${this.availableAlgorithms}`,
            );
        }
        this.activeAlgorithm = algorithm;
    }

    /* eslint-disable class-methods-use-this */
    /* eslint-disable no-unused-vars */
    async calculate(graph) {
        throw new Error('Method calculate() must be implemented by layout engine');
    }
}
