/**
 * Shared assertion helpers for characteristic tests.
 *
 * Tests read characteristics through one path: `getCharacteristicFromActor`, which calls
 * `HeroSystem6eActor.getCharacteristic()`. Tests never touch
 * `actor.system.characteristics` directly. That keeps the storage shape in one place,
 * so the shape can change without a rewrite of 600-plus assertions.
 *
 * A write takes a property object, so one call writes several properties of one name, the way
 * `HeroSystem6eActor.updateCharacteristics` does. Every property is named in the call. No helper
 * supplies one.
 *
 * Movement modes go through `assertHasMovementMode` and `assertDoesNotHaveMovementMode`, which call
 * `actor.hasMovementCharacteristic`. Characteristics go through `assertHasCharacteristic` and
 * `assertDoesNotHaveCharacteristic`, which call `actor.hasCharacteristic`. Movement modes leave
 * characteristic storage
 * later. Route them through the movement helpers now, so a test does not change then.
 *
 * Cost totals go through `assertActorTotal`. A total sums every characteristic at once, so it names
 * nothing but the actor.
 *
 * One helper asserts one thing. No helper loops over names, so a caller registers one test per name
 * and a failure names the characteristic label or movement mode that answered wrong.
 *
 * Quench hands each batch its own `assert`. Bind it once per batch with
 * `createCharacteristicAssertions(assert)`, then call the returned helpers. The bound set carries
 * every helper in this file, so a bound suite needs no second import.
 *
 *   const { describe, it, assert } = context;
 *   const characteristicAssertions = createCharacteristicAssertions(assert);
 *   characteristicAssertions.assertCharacteristicProperty(actor, "str", "max", 11);
 *   await characteristicAssertions.updateCharacteristicPropertiesOnActor(actor, "dex", { max: 15 });
 *
 * A "name" is a characteristic label or a movement mode. A helper that reads or writes a node takes
 * either. `assertHasCharacteristic` and `assertDoesNotHaveCharacteristic` take a characteristic label,
 * and `assertHasMovementMode` and `assertDoesNotHaveMovementMode` take a movement mode.
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

/** Properties a test may assert on a characteristic node. */
const ASSERTABLE_CHARACTERISTIC_PROPERTIES = new FrozenSet([
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
const ASSERTABLE_ACTOR_TOTAL_PROPERTIES = new FrozenSet(["realCost", "activePoints"]);

/**
 * Read the actor's characteristic node. Use to get `max`, `value`, and the other properties.
 *
 * A movement mode whose node the schema builds, such as RUNNING, reads through here too.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {object|undefined} The node, or undefined when absent.
 */
export function getCharacteristicFromActor(actor, name) {
    requireName(name, "getCharacteristicFromActor", EITHER_NAME);

    if (!actor) {
        throw new Error(`getCharacteristicFromActor: missing actor for "${name}"`);
    }

    requireKnownName(actor.system?.characteristics, "getCharacteristicFromActor", name);
    return actor.getCharacteristic(name);
}

/**
 * Read the node as the database stores it, with no active effects applied.
 *
 * Use this only to check what a write persisted. Every other read goes through
 * `getCharacteristicFromActor`, which answers with the value the app plays.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {object|undefined} The stored node, or undefined when absent.
 */
export function getStoredCharacteristicFromActor(actor, name) {
    requireName(name, "getStoredCharacteristicFromActor", EITHER_NAME);

    if (!actor) {
        throw new Error(`getStoredCharacteristicFromActor: missing actor for "${name}"`);
    }

    requireKnownName(actor.system?.characteristics, "getStoredCharacteristicFromActor", name);
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
export function getCharacteristicValueFromActor(actor, name) {
    return getCharacteristicFromActor(actor, name)?.value;
}

/**
 * Read the maximum of a characteristic, or of a movement mode that has a node.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {number|undefined} The max, or undefined when the node is absent.
 */
export function getCharacteristicMaxFromActor(actor, name) {
    return getCharacteristicFromActor(actor, name)?.max;
}

/**
 * Write characteristic properties on an unsaved actor, in place.
 *
 * A fixture built with `new HeroSystem6eActor()` has no id, so `actor.update()` cannot persist to
 * it. Seed the properties before the fixture adds items, then read them back with
 * `getCharacteristicFromActor`. Pass a saved actor and this helper refuses: use
 * `updateCharacteristicPropertiesOnActor`, which runs the update funnel.
 *
 * @param {HeroSystem6eActor} actor Unsaved actor to seed.
 * @param {string} name Characteristic label or movement mode. Any case.
 * @param {Object<string, number>} properties Property name mapped to the value to write, for
 *                    example `{ max: 15 }`. Name every property. At least one is required.
 */
export function setCharacteristicPropertiesOnUnsavedActor(actor, name, properties) {
    requireName(name, "setCharacteristicPropertiesOnUnsavedActor", EITHER_NAME);
    requireProperties("setCharacteristicPropertiesOnUnsavedActor", name, properties);

    if (!actor) {
        throw new Error(`setCharacteristicPropertiesOnUnsavedActor: missing actor for ${name}`);
    }

    if (actor.id) {
        throw new Error(
            `setCharacteristicPropertiesOnUnsavedActor: ${actor.name} is saved. ` +
                "Use updateCharacteristicPropertiesOnActor, which runs the update funnel.",
        );
    }

    const node = actor.system?.characteristics?.[name.toLowerCase()];

    if (!node) {
        throw new Error(`setCharacteristicPropertiesOnUnsavedActor: ${actor.name} has no "${name}" node to seed`);
    }

    for (const [property, value] of Object.entries(properties)) {
        node[property] = value;
    }
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
export function getUsableNamesFromActor(actor) {
    if (!actor) {
        throw new Error("getUsableNamesFromActor: missing actor");
    }

    return getCharacteristicInfoArrayForActor(actor).map((info) => info.key.toUpperCase());
}

/**
 * Ask whether this actor has a characteristic or may move that way.
 *
 * The one door to `Actor#hasCharacteristic`. Keep the question here, so a semantics change lands in
 * one place. A "yes" answers permission, not purchase: every actor type stores a node for every
 * label, so a stored node proves nothing. Read a value with `getCharacteristicValueFromActor` to
 * learn what the actor bought.
 *
 * @param {HeroSystem6eActor} actor Actor to ask.
 * @param {string} name Characteristic label or movement mode. Any case.
 *
 * @returns {boolean} True when the actor has the name.
 */
export function actorHasCharacteristic(actor, name) {
    requireName(name, "actorHasCharacteristic", EITHER_NAME);

    if (!actor) {
        throw new Error(`actorHasCharacteristic: missing actor for ${name}`);
    }

    return actor.hasCharacteristic(name);
}

/**
 * Write characteristic properties through the update funnel.
 *
 * Never assigns to the model. A direct write skips `_preUpdate`, so a test can
 * reach a state the app cannot produce.
 *
 * @param {HeroSystem6eActor} actor
 * @param {string} name Characteristic label or movement mode. Any case.
 * @param {Object<string, number>} properties Property name mapped to the value to write, for
 *                    example `{ max: 15 }`. Name every property. At least one is required.
 * @param {object} [updateOptions] Options forwarded to `actor.update`. Omit it for the Foundry
 *                    defaults.
 *
 * @returns {Promise<HeroSystem6eActor>} The updated actor.
 */
export async function updateCharacteristicPropertiesOnActor(actor, name, properties, updateOptions) {
    requireName(name, "updateCharacteristicPropertiesOnActor", EITHER_NAME);
    requireProperties("updateCharacteristicPropertiesOnActor", name, properties);

    if (!actor) {
        throw new Error(`updateCharacteristicPropertiesOnActor: missing actor for ${name}`);
    }

    requireKnownName(actor.system?.characteristics, "updateCharacteristicPropertiesOnActor", name);

    return actor.updateCharacteristics([[name.toLowerCase(), properties]], updateOptions);
}

/**
 * Write several characteristics in one update.
 *
 * Each entry names one characteristic and the properties to write on it, so one call can move the
 * max of one name and the value of another.
 *
 *   await updateMultipleCharacteristicsOnActor(actor, { stun: { value: -5 }, end: { value: 10 } });
 *
 * @param {HeroSystem6eActor} actor
 * @param {Object<string, Object<string, number>>} characteristics Characteristic label or movement
 *                    mode mapped to the properties to write on it. Name every property. At least one
 *                    characteristic with at least one property is required.
 * @param {object} [updateOptions] Options forwarded to `actor.update`. Omit it for the Foundry
 *                    defaults.
 *
 * @returns {Promise<HeroSystem6eActor>} The updated actor.
 */
export async function updateMultipleCharacteristicsOnActor(actor, characteristics, updateOptions) {
    if (!actor) {
        throw new Error("updateMultipleCharacteristicsOnActor: missing actor");
    }

    const tuplets = Object.entries(characteristics).map(([name, properties]) => {
        requireName(name, "updateMultipleCharacteristicsOnActor", EITHER_NAME);
        requireProperties("updateMultipleCharacteristicsOnActor", name, properties);
        requireKnownName(actor.system?.characteristics, "updateMultipleCharacteristicsOnActor", name);

        return [name.toLowerCase(), properties];
    });

    if (tuplets.length === 0) {
        throw new Error("updateMultipleCharacteristicsOnActor: pass at least one characteristic");
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
     * @param {string} characteristic Characteristic label. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertHasCharacteristic(actor, characteristic, message) {
        requireName(characteristic, "assertHasCharacteristic", CHARACTERISTIC_NAME);
        const has = actor.hasCharacteristic(characteristic);
        assert.isTrue(
            has,
            message ?? `${actor.detailedName()} ${characteristic}: expected the actor to have this characteristic`,
        );
    }

    /**
     * Assert the actor does not have this characteristic.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} characteristic Characteristic label. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertDoesNotHaveCharacteristic(actor, characteristic, message) {
        requireName(characteristic, "assertDoesNotHaveCharacteristic", CHARACTERISTIC_NAME);
        const has = actor.hasCharacteristic(characteristic);
        assert.isFalse(
            has,
            message ?? `${actor.detailedName()} ${characteristic}: expected the actor not to have this characteristic`,
        );
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
        assert.isTrue(has, message ?? `${actor.detailedName()} ${mode}: expected the actor to have this movement mode`);
    }

    /**
     * Assert the actor does not have this movement mode.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} mode Movement mode. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertDoesNotHaveMovementMode(actor, mode, message) {
        requireName(mode, "assertDoesNotHaveMovementMode", MOVEMENT_MODE_NAME);
        const has = actor.hasMovementCharacteristic(mode);
        assert.isFalse(
            has,
            message ?? `${actor.detailedName()} ${mode}: expected the actor not to have this movement mode`,
        );
    }

    /**
     * Assert one property on one characteristic node.
     *
     * Pass a movement mode for a mode the schema builds a node for, such as LEAPING. Assert
     * possession through a movement helper. This helper reads the node, and every actor type stores a
     * node for every name.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} name Characteristic label or movement mode. Any case.
     * @param {string} property Property name. Must be in ASSERTABLE_CHARACTERISTIC_PROPERTIES.
     * @param {number|null} expected Expected value.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertCharacteristicProperty(actor, name, property, expected, message) {
        if (!ASSERTABLE_CHARACTERISTIC_PROPERTIES.has(property)) {
            throw new Error(
                `assertCharacteristicProperty: unknown property "${property}" for ${name}. ` +
                    `Assertable properties: ${[...ASSERTABLE_CHARACTERISTIC_PROPERTIES].join(", ")}.`,
            );
        }
        const node = getCharacteristicFromActor(actor, name);

        if (node === undefined || node === null) {
            assert.fail(`${actor.detailedName()} ${name}: no characteristic node. Assert possession first.`);
            return; // Chai throws above. The guard keeps the read safe if a caller swaps in a non-throwing assert.
        }

        assert.equal(node[property], expected, message ?? `${actor.detailedName()} ${name}.${property}`);
    }

    /**
     * Assert one actor-level cost total.
     *
     * A total sums every characteristic at once, so it carries no name. Assert a total beside the
     * per-name claims, so a cost change reports both the name that moved and the sum it changed.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} property Total name. Must be in ASSERTABLE_ACTOR_TOTAL_PROPERTIES.
     * @param {number} expected Expected value.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertActorTotal(actor, property, expected, message) {
        if (!ASSERTABLE_ACTOR_TOTAL_PROPERTIES.has(property)) {
            throw new Error(
                `assertActorTotal: unknown total "${property}". Assertable totals: ${[...ASSERTABLE_ACTOR_TOTAL_PROPERTIES].join(", ")}.`,
            );
        }

        if (!actor) {
            throw new Error(`assertActorTotal: missing actor for "${property}"`);
        }

        assert.equal(actor[property], expected, message ?? `${actor.name}: expected ${property} ${expected}`);
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
        const actual = [...new Set(getUsableNamesFromActor(actor))].sort();

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

            assert.fail(
                `${actor.detailedName()} usable set: expected exactly [${expected.join(", ")}]; ${parts.join("; ")}`,
            );
        }
    }

    return {
        getCharacteristicFromActor,
        getStoredCharacteristicFromActor,
        getCharacteristicValueFromActor,
        getCharacteristicMaxFromActor,
        setCharacteristicPropertiesOnUnsavedActor,
        getUsableNamesFromActor,
        actorHasCharacteristic,
        assertHasCharacteristic,
        assertDoesNotHaveCharacteristic,
        assertCharacteristicProperty,
        assertActorTotal,
        assertHasMovementMode,
        assertDoesNotHaveMovementMode,
        assertExactUsableSet,
        updateCharacteristicPropertiesOnActor,
        updateMultipleCharacteristicsOnActor,
    };
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
 * Reject a property object that holds nothing, or holds a property no test may assert.
 *
 * @param {string} caller Name shown in the thrown message.
 * @param {string} name Characteristic label or movement mode the properties belong to.
 * @param {object} properties Property name mapped to its value.
 */
function requireProperties(caller, name, properties) {
    const keys = Object.keys(properties ?? {});

    if (keys.length === 0) {
        throw new Error(
            `${caller}: ${name} needs at least one property, such as { value: 15 }. ` +
                `Assertable properties: ${[...ASSERTABLE_CHARACTERISTIC_PROPERTIES].join(", ")}.`,
        );
    }

    const unknown = keys.filter((property) => !ASSERTABLE_CHARACTERISTIC_PROPERTIES.has(property));

    if (unknown.length > 0) {
        throw new Error(
            `${caller}: unknown properties ${unknown.join(", ")} for ${name}. ` +
                `Assertable properties: ${[...ASSERTABLE_CHARACTERISTIC_PROPERTIES].join(", ")}.`,
        );
    }
}

/**
 * Refuse a name the model has no node for.
 *
 * Every actor type and both editions store a node for the same 30 names, so a miss means a typo, not a
 * characteristic the actor lacks. Ask `actorHasCharacteristic` the ownership question.
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
