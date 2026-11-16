/*
 * Copyright (c) 2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * An error that combines multiple errors into a single one.
 *
 * Regular `new Error(\`... ${other}\`)` wrappers stringify the errors they are
 * built from, which discards their tracebacks. This class instead keeps a
 * reference to every combined error, so the traceback of each of them is
 * preserved and can be rendered together with the summary message.
 *
 * It is a plain `Error`, so all existing `instanceof Error` / `.message`
 * handling keeps working.
 */
export default class CombinedError extends Error {
    /**
     * @param {string} message - summary message describing the combined error
     * @param {(Error | string)[]} errors - the errors being combined
     */
    constructor(message, errors = []) {
        super(message);
        this.name = 'CombinedError';
        if (process.env.NODE_ENV === 'development') {
            // Keep the original errors (with their stacks) instead of stringifying them.
            this.errors = errors.map((error) => {
                if (error instanceof Error) return error;
                return new Error(String(error));
            });
        } else {
            this.errors = errors.map((error) => {
                if (error instanceof Error) return error.message;
                return error;
            });
        }
    }

    /**
     * The summary message followed by the full traceback of every combined
     * error, so no traceback information is lost when the error is rendered.
     * Nested CombinedErrors are expanded recursively.
     *
     * @returns {string} the combined error text
     */
    get fullMessage() {
        if (this.errors.length === 0) return this.message;
        const render = (process.env.NODE_ENV === 'development') ? (error) => (
            error instanceof CombinedError
                ? error.fullMessage
                : error.message
        ) : (error) => error;
        return [this.message, ...this.errors.map(render)].join('\n    ');
    }
}
