/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable max-classes-per-file */

/**
 * Class with information about ran procedure.
 */
class RunInfo {
    procedureName;

    /** @private */
    private pr_inProgress = false;

    /**
     * @param procedureName Name of the procedure
     */
    constructor(procedureName: string) {
        this.procedureName = procedureName;
    }

    /**
     * Finds progress bar affiliated with run.
     * If cannot be found, throws Error.
     */
    get progressBar() {
        const progressBar = document.querySelector<HTMLDivElement>(
            `#navbar-button-${this.procedureName} > .progress-bar`,
        );
        return progressBar;
    }

    /**
     * Specifies if run is in progress.
     */
    get inProgress() {
        return this.pr_inProgress;
    }

    set inProgress(value) {
        const { progressBar } = this;
        if (progressBar) {
            if (!value) progressBar.classList.remove('animate');
            progressBar.style.width = '0%';
        }
        this.pr_inProgress = value;
    }
}

/**
 * @template K key type
 * @template V value type
 * @extends {Map<K,V>}
 *
 * Map automatically creating values if key is not found.
 */
class DefaultMap<K, V> extends Map<K, V> {
    defaultFactory;

    constructor(defaultFactory: (key: K) => V) {
        super();
        this.defaultFactory = defaultFactory;
    }

    get(key: K): V {
        if (!super.has(key)) {
            super.set(key, this.defaultFactory(key));
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return super.get(key)!;
    }
}

export default new DefaultMap<string, RunInfo>((key) => new RunInfo(key));
