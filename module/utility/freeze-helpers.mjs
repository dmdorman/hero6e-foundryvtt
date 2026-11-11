/**
 * Helpers that stop data from changing once it is built.
 *
 * Use `FrozenSet` for a set of fixed members.
 * Use `freezeDeep` for nested objects.
 */

/**
 * You can't just Object.freeze a Set. Here's a pale substitute that won't let you do stuff with a runtime error.
 */
export class FrozenSet extends Set {
    constructor(iterable) {
        super(iterable);

        this.add = function add() {
            throw new TypeError("Cannot add to a frozen Set");
        };

        // Object.freeze locks the Set object structure itself
        Object.freeze(this);
    }

    delete() {
        throw new TypeError("Cannot delete from a frozen Set");
    }

    clear() {
        throw new TypeError("Cannot clear a frozen Set");
    }
}

/**
 * Freeze a value, and every object inside it.
 *
 * A table that a test can edit is a contract that can change mid-run. One stray write points the
 * rest of the suite at the wrong row and blames the actor. `Object.freeze` covers the container
 * only, so recurse before freezing. Modules are strict mode, so a write to frozen data throws.
 *
 * Strings, numbers, and null need nothing. A function keeps its own properties: pass it to
 * `freezeDeep` only when you mean to freeze those too.
 *
 * @param {object|Array} value Value to freeze.
 *
 * @returns {object|Array} The same value, frozen.
 */
export function freezeDeep(value) {
    for (const child of Object.values(value)) {
        if (typeof child === "object" && child !== null) {
            freezeDeep(child);
        }
    }

    return Object.freeze(value);
}
