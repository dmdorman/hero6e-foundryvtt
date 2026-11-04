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
 * Cost totals go through `assertActorTotal`. A total sums every characteristic at once, so it names
 * nothing but the actor.
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
 * A name must be a string. Case does not matter: `hasCharacteristic` uppercases and
 * `getCharacteristic` lowercases. This module keeps no name helper, so a non-string fails loudly.
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

/** Actor-level cost totals a test may assert. These sums carry no characteristic label. */
const ASSERTABLE_TOTAL_FIELDS = new FrozenSet(["realCost", "activePoints"]);

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
        throw new Error(`charNode: missing actor for "${name}"`);
    }

    requireKnownName(actor.system?.characteristics, "charNode", name);
    return actor.getCharacteristic(name);
}

/**
 * Read the node as the database stores it, with no active effects applied.
 *
 * Use this only to check what a write persisted. Every other read goes through `charNode`, which
 * answers with the value the app plays.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {object|undefined} The stored node, or undefined when absent.
 */
export function charSourceNode(actor, name) {
    requireName(name, "charSourceNode", EITHER_NAME);

    if (!actor) {
        throw new Error(`charSourceNode: missing actor for "${name}"`);
    }

    requireKnownName(actor.system?.characteristics, "charSourceNode", name);
    return actor._source?.system?.characteristics?.[name.toLowerCase()];
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
 * Write one characteristic field on an unsaved actor, in place.
 *
 * A fixture built with `new HeroSystem6eActor()` has no id, so `actor.update()` cannot persist to
 * it. Seed the value before the fixture adds items, then read it back with `charNode`. Pass a saved
 * actor and this helper refuses: use `setChar`, which runs the update funnel.
 *
 * @param {HeroSystem6eActor} actor Unsaved actor to seed.
 * @param {string} name Characteristic label or movement mode. Any case.
 * @param {number} value Value to write.
 * @param {object} [options]
 * @param {string} [options.field] Field to write. Defaults to `value`.
 */
export function seedChar(actor, name, value, { field = "value" } = {}) {
    requireName(name, "seedChar", EITHER_NAME);

    if (!ASSERTABLE_FIELDS.has(field)) {
        throw new Error(`seedChar: unknown field "${field}" for ${name}`);
    }

    if (!actor) {
        throw new Error(`seedChar: missing actor for ${name}`);
    }

    if (actor.id) {
        throw new Error(`seedChar: ${actor.name} is saved. Use setChar, which runs the update funnel.`);
    }

    const node = actor.system?.characteristics?.[name.toLowerCase()];

    if (!node) {
        throw new Error(`seedChar: ${actor.name} has no "${name}" node to seed`);
    }

    node[field] = value;
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

    return getCharacteristicInfoArrayForActor(actor).map((info) => info.key.toUpperCase());
}

/**
 * Ask whether this actor type may hold a characteristic or move that way.
 *
 * The one door to `Actor#hasCharacteristic`. Keep the question here, so a semantics change lands in
 * one place. A "yes" answers permission, not purchase: every actor type stores a node for every
 * label, so a stored node proves nothing. Read a value with `charValue` to learn what the actor bought.
 *
 * @param {HeroSystem6eActor} actor Actor to ask.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {boolean} True when the actor type may hold the name.
 */
export function hasChar(actor, name) {
    requireName(name, "hasChar", EITHER_NAME);

    if (!actor) {
        throw new Error(`hasChar: missing actor for ${name}`);
    }

    return actor.hasCharacteristic(name);
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
export async function setChar(actor, name, value, { field = "value", updateOptions = {} } = {}) {
    requireName(name, "setChar", EITHER_NAME);

    if (!ASSERTABLE_FIELDS.has(field)) {
        throw new Error(`setChar: unknown field "${field}" for ${name}`);
    }

    if (!actor) {
        throw new Error(`setChar: missing actor for ${name}`);
    }

    requireKnownName(actor.system?.characteristics, "setChar", name);
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
export async function setChars(actor, values, { field = "value", updateOptions = {} } = {}) {
    if (!ASSERTABLE_FIELDS.has(field)) {
        throw new Error(`setChars: unknown field "${field}". Assertable fields: ${[...ASSERTABLE_FIELDS].join(", ")}.`);
    }

    if (!actor) {
        throw new Error("setChars: missing actor");
    }

    for (const name of Object.keys(values)) {
        requireName(name, "setChars", EITHER_NAME);
        requireKnownName(actor.system?.characteristics, "setChars", name);
    }

    const tuplets = Object.entries(values).map(([name, value]) => [name.toLowerCase(), { [field]: value }]);

    if (tuplets.length === 0) {
        throw new Error("setChars: pass at least one characteristic");
    }

    return actor.updateCharacteristics(tuplets, updateOptions);
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
                `assertCharField: unknown field "${field}" for ${name}. ` +
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
     * Assert one actor-level cost total.
     *
     * A total sums every characteristic at once, so it carries no name. Assert a total beside the
     * per-name claims, so a cost change reports both the name that moved and the sum it changed.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} field Total name. Must be in ASSERTABLE_TOTAL_FIELDS.
     * @param {number} expected Expected value.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertActorTotal(actor, field, expected, message) {
        if (!ASSERTABLE_TOTAL_FIELDS.has(field)) {
            throw new Error(
                `assertActorTotal: unknown total "${field}". Assertable totals: ${[...ASSERTABLE_TOTAL_FIELDS].join(", ")}.`,
            );
        }

        if (!actor) {
            throw new Error(`assertActorTotal: missing actor for "${field}"`);
        }

        assert.equal(actor[field], expected, message ?? `${actor.name}: expected ${field} ${expected}`);
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
        const expected = [...new Set(expectedNames.map((one) => one.toUpperCase()))].sort();
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

    return {
        charNode,
        charSourceNode,
        charValue,
        charMax,
        seedChar,
        usableNames,
        assertHasChar,
        assertLacksChar,
        assertCharField,
        assertActorTotal,
        assertHasMovementMode,
        assertLacksMovementMode,
        assertExactUsableSet,
        setChar,
        setChars,
    };
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
    return `[${type} ${edition}] ${name}`;
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

/**
 * Refuse a name the model has no node for.
 *
 * Every actor type and both editions store a node for the same 30 names, so a miss means a typo, not a
 * characteristic the actor lacks. Ask `hasChar` the ownership question.
 *
 * @param {object|undefined} nodes Characteristic map, from `actor.system.characteristics`.
 * @param {string} caller Name shown in the thrown message.
 * @param {string} name Name to check. Any case.
 */
function requireKnownName(nodes, caller, name) {
    const key = name.toLowerCase();
    const known = Object.keys(nodes ?? {});

    if (known.includes(key)) {
        return;
    }

    const close = known.filter((one) => one.startsWith(key.slice(0, 2))).slice(0, 5);
    const hint = close.length === 0 ? "none" : close.map((one) => one.toUpperCase()).join(", ");
    throw new Error(`${caller}: "${name}" is not a characteristic or movement mode. Closest: ${hint}.`);
}
