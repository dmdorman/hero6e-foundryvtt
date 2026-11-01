/**
 * Shared assertion helpers for characteristic tests.
 *
 * Tests read characteristics through one path: `charNode`, which calls
 * `HeroSystem6eActor.getCharacteristic()`. Tests never touch
 * `actor.system.characteristics` directly. That keeps the storage shape in one place,
 * so the shape can change without a rewrite of 600-plus assertions.
 *
 * Movement modes go through `assertHasMovementMode` and `assertLacksMovementMode`, which call
 * `actor.hasMovementCharacteristic`. Characteristic labels go through `assertHasChar` and
 * `assertLacksChar`, which call `actor.hasCharacteristic`. Movement modes leave characteristic storage
 * later. Route them through the movement helpers now, so a test does not change then.
 *
 * One helper asserts one thing. No helper loops over names, so a caller registers one test per name
 * and a failure names the characteristic label or movement mode that answered wrong.
 *
 * Quench hands each batch its own `assert`. Bind it once per batch with
 * `createCharacteristicAssertions(assert)`, then call the returned helpers.
 *
 *   const { describe, it, assert } = context;
 *   const chars = createCharacteristicAssertions(assert);
 *   chars.assertCharField(actor, "str", "max", 11);
 *
 * A "name" is a characteristic label or a movement mode. A helper that reads or writes a node takes
 * either. `assertHasChar` and `assertLacksChar` take a characteristic label, and
 * `assertHasMovementMode` and `assertLacksMovementMode` take a movement mode.
 *
 * Names accept any case. `hasCharacteristic` uppercases, `getCharacteristic`
 * lowercases. Helpers normalize and report the canonical uppercase form.
 */

import { FrozenSet } from "../utility/freeze-helpers.mjs";
import { getCharacteristicInfoArrayForActor } from "../utility/util.mjs";

/** Words for a name that names a characteristic. Used in thrown messages. */
const CHARACTERISTIC_NAME = "characteristic label";

/** Words for a name that names a movement mode. Used in thrown messages. */
const MOVEMENT_MODE_NAME = "movement mode";

/** Words for a parameter that accepts either kind. Used in thrown messages. */
const EITHER_NAME = "characteristic label or movement mode";

/** Fields a test may assert on a characteristic node. */
const ASSERTABLE_FIELDS = new FrozenSet([
    "value",
    "max",
    "base",
    "basePlusLevels",
    "levels",
    "realCost",
    "characteristicMax",
    "roll",
]);

/**
 * Read the actor's characteristic node. Use to get `max`, `value`, and the other fields.
 *
 * A movement mode whose node the schema builds, such as RUNNING, reads through here too.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {object|undefined} The node, or undefined when absent.
 */
export function charNode(actor, name) {
    requireName(name, "charNode", EITHER_NAME);

    if (!actor) {
        throw new Error(`charNode: missing actor for "${canonical(name)}"`);
    }

    return actor.getCharacteristic(name);
}

/**
 * Read the current value of a characteristic, or of a movement mode that has a node.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {number|undefined} The value, or undefined when the node is absent.
 */
export function charValue(actor, name) {
    return charNode(actor, name)?.value;
}

/**
 * Read the maximum of a characteristic, or of a movement mode that has a node.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {number|undefined} The max, or undefined when the node is absent.
 */
export function charMax(actor, name) {
    return charNode(actor, name)?.max;
}

/**
 * List the names this actor type may use.
 *
 * Reads the config permission set, not node storage. A name here means the actor type may hold that
 * characteristic or move that way. It does not mean the actor bought it.
 *
 * Movement modes appear beside characteristics. The movement tables key each mode by its
 * characteristic name, so RUNNING answers here next to STR.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 *
 * @returns {string[]} Uppercase names.
 */
export function usableNames(actor) {
    if (!actor) {
        throw new Error("usableNames: missing actor");
    }

    return getCharacteristicInfoArrayForActor(actor).map((info) => canonical(info.key));
}

/**
 * Bind every assertion helper to a Quench `assert`.
 *
 * @param {object} assert The `assert` from the Quench batch context.
 *
 * @returns {object} The bound helpers.
 */
export function createCharacteristicAssertions(assert) {
    if (!assert) {
        throw new Error("createCharacteristicAssertions: pass the assert from the Quench batch context");
    }

    /**
     * Assert the actor has this characteristic.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} label Characteristic label. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertHasChar(actor, label, message) {
        requireName(label, "assertHasChar", CHARACTERISTIC_NAME);
        const has = actor.hasCharacteristic(label);
        assert.isTrue(has, message ?? `${tag(actor, label)}: expected the actor to have this characteristic`);
    }

    /**
     * Assert the actor does not have this characteristic.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} label Characteristic label. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertLacksChar(actor, label, message) {
        requireName(label, "assertLacksChar", CHARACTERISTIC_NAME);
        const has = actor.hasCharacteristic(label);
        assert.isFalse(has, message ?? `${tag(actor, label)}: expected the actor to lack this characteristic`);
    }

    /**
     * Assert the actor has this movement mode.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} mode Movement mode. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertHasMovementMode(actor, mode, message) {
        requireName(mode, "assertHasMovementMode", MOVEMENT_MODE_NAME);
        const has = actor.hasMovementCharacteristic(mode);
        assert.isTrue(has, message ?? `${tag(actor, mode)}: expected the actor to have this movement mode`);
    }

    /**
     * Assert the actor does not have this movement mode.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} mode Movement mode. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertLacksMovementMode(actor, mode, message) {
        requireName(mode, "assertLacksMovementMode", MOVEMENT_MODE_NAME);
        const has = actor.hasMovementCharacteristic(mode);
        assert.isFalse(has, message ?? `${tag(actor, mode)}: expected the actor to lack this movement mode`);
    }

    /**
     * Assert one field on one characteristic node.
     *
     * Pass a movement mode for a mode the schema builds a node for, such as LEAPING. Assert
     * possession through a movement helper. This helper reads the node, and every actor type stores a
     * node for every name.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} name Characteristic label or movement mode. Any case.
     * @param {string} field Field name. Must be in ASSERTABLE_FIELDS.
     * @param {number|null} expected Expected value.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertCharField(actor, name, field, expected, message) {
        if (!ASSERTABLE_FIELDS.has(field)) {
            throw new Error(
                `assertCharField: unknown field "${field}" for ${canonical(name)}. ` +
                    `Assertable fields: ${[...ASSERTABLE_FIELDS].join(", ")}.`,
            );
        }
        const node = charNode(actor, name);

        if (node === undefined || node === null) {
            assert.fail(`${tag(actor, name)}: no characteristic node. Assert possession first.`);
            return; // Chai throws above. The guard keeps the read safe if a caller swaps in a non-throwing assert.
        }

        assert.equal(node[field], expected, message ?? `${tag(actor, name)}.${field}`);
    }

    /**
     * Assert the actor's usable name set matches exactly.
     *
     * The set holds characteristic labels and movement modes. Fails on a missing name and on an
     * unexpected extra name.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string[]} expectedNames The complete expected set.
     */
    function assertExactUsableSet(actor, expectedNames) {
        const expected = [...new Set(expectedNames.map(canonical))].sort();
        const actual = [...new Set(usableNames(actor))].sort();

        const missing = expected.filter((name) => !actual.includes(name));
        const extra = actual.filter((name) => !expected.includes(name));

        if (missing.length > 0 || extra.length > 0) {
            const parts = [];

            if (missing.length > 0) {
                parts.push(`missing [${missing.join(", ")}]`);
            }

            if (extra.length > 0) {
                parts.push(`unexpected [${extra.join(", ")}]`);
            }

            assert.fail(`${tag(actor, "usable set")}: expected exactly [${expected.join(", ")}]; ${parts.join("; ")}`);
        }
    }

    /**
     * Write one characteristic field through the update funnel.
     *
     * Never assigns to the model. A direct write skips `_preUpdate`, so a test can
     * reach a state the app cannot produce.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} name Characteristic label or movement mode. Any case.
     * @param {number} value Value to write.
     * @param {object} [options]
     * @param {string} [options.field] Field to write. Defaults to `value`.
     * @param {object} [options.updateOptions] Options forwarded to `actor.update`.
     *
     * @returns {Promise<HeroSystem6eActor>} The updated actor.
     */
    async function setChar(actor, name, value, { field = "value", updateOptions = {} } = {}) {
        requireName(name, "setChar", EITHER_NAME);

        if (!ASSERTABLE_FIELDS.has(field)) {
            throw new Error(`setChar: unknown field "${field}" for ${canonical(name)}`);
        }

        if (!actor) {
            throw new Error(`setChar: missing actor for ${canonical(name)}`);
        }

        return actor.updateCharacteristics([[name.toLowerCase(), { [field]: value }]], updateOptions);
    }

    /**
     * Write several characteristic values in one update.
     *
     *   await chars.setChars(actor, { stun: -5, end: 10 });
     *
     * @param {HeroSystem6eActor} actor
     * @param {Object<string, number>} values Maps a characteristic label or movement mode to its value.
     * @param {object} [options]
     * @param {string} [options.field] Field to write for every name. Defaults to `value`.
     * @param {object} [options.updateOptions] Options forwarded to `actor.update`.
     *
     * @returns {Promise<HeroSystem6eActor>} The updated actor.
     */
    async function setChars(actor, values, { field = "value", updateOptions = {} } = {}) {
        const tuplets = Object.entries(values).map(([name, value]) => [name.toLowerCase(), { [field]: value }]);
        if (tuplets.length === 0) {
            throw new Error("setChars: pass at least one characteristic");
        }
        return actor.updateCharacteristics(tuplets, updateOptions);
    }

    return {
        charNode,
        charValue,
        charMax,
        usableNames,
        assertHasChar,
        assertLacksChar,
        assertCharField,
        assertHasMovementMode,
        assertLacksMovementMode,
        assertExactUsableSet,
        setChar,
        setChars,
    };
}

/**
 * Canonical form of a characteristic label or movement mode, for messages.
 *
 * @param {string} name
 *
 * @returns {string}
 */
function canonical(name) {
    return String(name).toUpperCase();
}

/**
 * Prefix a failure message with the actor type and edition.
 *
 * @param {HeroSystem6eActor} actor
 * @param {string} name Characteristic label or movement mode.
 *
 * @returns {string}
 */
function tag(actor, name) {
    const type = actor?.type ?? "unknown";
    const edition = actor?.is5e === true ? "5e" : "6e";
    return `[${type} ${edition}] ${canonical(name)}`;
}

/**
 * Reject a missing or blank name before it reads the wrong node.
 *
 * @param {string} name Characteristic label or movement mode.
 * @param {string} caller Name shown in the thrown message.
 * @param {string} kind What the name names. Pass CHARACTERISTIC_NAME or MOVEMENT_MODE_NAME.
 */
function requireName(name, caller, kind) {
    if (typeof name !== "string" || name.trim() === "") {
        throw new Error(`${caller}: ${kind} must be a non-empty string, got ${JSON.stringify(name)}`);
    }
}
