/**
 * Shared assertion helpers for characteristic tests.
 *
 * Tests read characteristics through one path: `charNode`, which calls
 * `HeroSystem6eActor.getCharacteristic()`. Tests never touch
 * `actor.system.characteristics` directly. That keeps the storage shape in one place,
 * so the shape can change without a rewrite of 600-plus assertions.
 *
 * Movement labels go through `assertHasMovementMode`, `assertLacksMovementMode`, and
 * `assertHasMovementMatrix`, which call `actor.hasMovementCharacteristic`. Characteristic labels go
 * through `assertHasChar`, `assertLacksChar`, and `assertHasCharacteristicMatrix`, which call
 * `actor.hasCharacteristic`. Movement modes leave characteristic storage later. Route them through the
 * movement helpers now, so a test does not change then.
 *
 * Quench hands each batch its own `assert`. Bind it once per batch with
 * `createCharacteristicAssertions(assert)`, then call the returned helpers.
 *
 *   const { describe, it, assert } = context;
 *   const chars = createCharacteristicAssertions(assert);
 *   chars.assertCharField(actor, "str", "max", 11);
 *
 * Labels accept any case. `hasCharacteristic` uppercases, `getCharacteristic`
 * lowercases. Helpers normalize and report the canonical uppercase label.
 */

import { FrozenSet } from "../utility/freeze-helpers.mjs";
import { getCharacteristicInfoArrayForActor } from "../utility/util.mjs";

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
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} label Characteristic label. Any case.
 *
 * @returns {object|undefined} The node, or undefined when absent.
 */
export function charNode(actor, label) {
    requireLabel(label, "charNode");
    if (!actor) {
        throw new Error(`charNode: missing actor for "${canonical(label)}"`);
    }
    return actor.getCharacteristic(label);
}

/**
 * Read the current value of a characteristic.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} label Characteristic label. Any case.
 *
 * @returns {number|undefined} The value, or undefined when the node is absent.
 */
export function charValue(actor, label) {
    return charNode(actor, label)?.value;
}

/**
 * Read the maximum of a characteristic.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 * @param {string} label Characteristic label. Any case.
 *
 * @returns {number|undefined} The max, or undefined when the node is absent.
 */
export function charMax(actor, label) {
    return charNode(actor, label)?.max;
}

/**
 * List the characteristic labels this actor type may use.
 *
 * Reads the config permission set, not node storage. A label here means the actor type
 * may hold that characteristic. It does not mean the actor bought it.
 *
 * @param {HeroSystem6eActor} actor Actor to read from.
 *
 * @returns {string[]} Uppercase labels.
 */
export function charLabels(actor) {
    if (!actor) {
        throw new Error("charLabels: missing actor");
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
        requireLabel(label, "assertHasChar");
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
        requireLabel(label, "assertLacksChar");
        const has = actor.hasCharacteristic(label);
        assert.isFalse(has, message ?? `${tag(actor, label)}: expected the actor to lack this characteristic`);
    }

    /**
     * Assert the actor has this movement mode.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} label Movement label. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertHasMovementMode(actor, label, message) {
        requireLabel(label, "assertHasMovementMode");
        const has = actor.hasMovementCharacteristic(label);
        assert.isTrue(has, message ?? `${tag(actor, label)}: expected the actor to have this movement mode`);
    }

    /**
     * Assert the actor does not have this movement mode.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} label Movement label. Any case.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertLacksMovementMode(actor, label, message) {
        requireLabel(label, "assertLacksMovementMode");
        const has = actor.hasMovementCharacteristic(label);
        assert.isFalse(has, message ?? `${tag(actor, label)}: expected the actor to lack this movement mode`);
    }

    /**
     * Assert which movement modes an actor has.
     *
     * @param {HeroSystem6eActor} actor
     * @param {object} matrix
     * @param {string[]} [matrix.has] Movement labels the actor must have.
     * @param {string[]} [matrix.lacks] Movement labels the actor must not have.
     */
    function assertHasMovementMatrix(actor, { has = [], lacks = [] } = {}) {
        for (const label of has) assertHasMovementMode(actor, label);
        for (const label of lacks) assertLacksMovementMode(actor, label);
    }

    /**
     * Assert one field on one characteristic node.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} label Characteristic label. Any case.
     * @param {string} field Field name. Must be in ASSERTABLE_FIELDS.
     * @param {number|null} expected Expected value.
     * @param {string} [message] Overrides the generated failure message.
     */
    function assertCharField(actor, label, field, expected, message) {
        if (!ASSERTABLE_FIELDS.has(field)) {
            throw new Error(
                `assertCharField: unknown field "${field}" for ${canonical(label)}. ` +
                    `Assertable fields: ${[...ASSERTABLE_FIELDS].join(", ")}.`,
            );
        }
        const node = charNode(actor, label);
        if (node === undefined || node === null) {
            assert.fail(`${tag(actor, label)}: no characteristic node. Assert the characteristic first.`);
            return; // Chai throws above. The guard keeps the read safe if a caller swaps in a non-throwing assert.
        }
        assert.equal(node[field], expected, message ?? `${tag(actor, label)}.${field}`);
    }

    /**
     * Assert several fields on one characteristic node.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} label Characteristic label. Any case.
     * @param {object} expectedFields Map of field name to expected value.
     */
    function assertCharFields(actor, label, expectedFields) {
        for (const [field, expected] of Object.entries(expectedFields)) {
            assertCharField(actor, label, field, expected);
        }
    }

    /**
     * Assert fields across many characteristics of an actor.
     *
     * Drives whole-scenario coverage from one table:
     *
     *   chars.assertCharTable(actor, {
     *       str: { max: 11, realCost: 1 },
     *       dex: { max: 12, realCost: 6 },
     *   });
     *
     * @param {HeroSystem6eActor} actor
     * @param {Object<string, object>} table Maps label to a field expectation object.
     */
    function assertCharTable(actor, table) {
        for (const [label, expectedFields] of Object.entries(table)) {
            assertCharFields(actor, label, expectedFields);
        }
    }

    /**
     * Assert which characteristics an actor has.
     *
     * @param {HeroSystem6eActor} actor
     * @param {object} matrix
     * @param {string[]} [matrix.has] Labels the actor must have.
     * @param {string[]} [matrix.lacks] Labels the actor must not have.
     */
    function assertHasCharacteristicMatrix(actor, { has = [], lacks = [] } = {}) {
        for (const label of has) assertHasChar(actor, label);
        for (const label of lacks) assertLacksChar(actor, label);
    }

    /**
     * Assert the actor's usable characteristic set matches exactly.
     *
     * Fails on a missing label and on an unexpected extra label.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string[]} expectedLabels The complete expected set.
     */
    function assertExactCharSet(actor, expectedLabels) {
        const expected = [...new Set(expectedLabels.map(canonical))].sort();
        const actual = [...new Set(charLabels(actor))].sort();

        const missing = expected.filter((label) => !actual.includes(label));
        const extra = actual.filter((label) => !expected.includes(label));

        if (missing.length > 0 || extra.length > 0) {
            const parts = [];
            if (missing.length > 0) parts.push(`missing [${missing.join(", ")}]`);
            if (extra.length > 0) parts.push(`unexpected [${extra.join(", ")}]`);
            assert.fail(
                `${tag(actor, "characteristics")}: expected exactly [${expected.join(", ")}]; ${parts.join("; ")}`,
            );
        }
    }

    /**
     * Write one characteristic field through the update funnel.
     *
     * Never assigns to the model. A direct write skips `_preUpdate`, so a test can
     * reach a state the app cannot produce.
     *
     * @param {HeroSystem6eActor} actor
     * @param {string} label Characteristic label. Any case.
     * @param {number} value Value to write.
     * @param {object} [options]
     * @param {string} [options.field] Field to write. Defaults to `value`.
     * @param {object} [options.updateOptions] Options forwarded to `actor.update`.
     *
     * @returns {Promise<HeroSystem6eActor>} The updated actor.
     */
    async function setChar(actor, label, value, { field = "value", updateOptions = {} } = {}) {
        requireLabel(label, "setChar");
        if (!ASSERTABLE_FIELDS.has(field)) {
            throw new Error(`setChar: unknown field "${field}" for ${canonical(label)}`);
        }
        if (!actor) {
            throw new Error(`setChar: missing actor for ${canonical(label)}`);
        }
        return actor.updateCharacteristics([[label.toLowerCase(), { [field]: value }]], updateOptions);
    }

    /**
     * Write several characteristic values in one update.
     *
     *   await chars.setChars(actor, { stun: -5, end: 10 });
     *
     * @param {HeroSystem6eActor} actor
     * @param {Object<string, number>} values Maps label to the value to write.
     * @param {object} [options]
     * @param {string} [options.field] Field to write for every label. Defaults to `value`.
     * @param {object} [options.updateOptions] Options forwarded to `actor.update`.
     *
     * @returns {Promise<HeroSystem6eActor>} The updated actor.
     */
    async function setChars(actor, values, { field = "value", updateOptions = {} } = {}) {
        const tuplets = Object.entries(values).map(([label, value]) => [label.toLowerCase(), { [field]: value }]);
        if (tuplets.length === 0) {
            throw new Error("setChars: pass at least one characteristic");
        }
        return actor.updateCharacteristics(tuplets, updateOptions);
    }

    return {
        charNode,
        charValue,
        charMax,
        charLabels,
        assertHasChar,
        assertLacksChar,
        assertCharField,
        assertCharFields,
        assertCharTable,
        assertHasMovementMode,
        assertLacksMovementMode,
        assertHasMovementMatrix,
        assertHasCharacteristicMatrix,
        assertExactCharSet,
        setChar,
        setChars,
    };
}

/**
 * Canonical label for messages.
 *
 * @param {string} label
 *
 * @returns {string}
 */
function canonical(label) {
    return String(label).toUpperCase();
}

/**
 * Prefix a failure message with the actor type and edition.
 *
 * @param {HeroSystem6eActor} actor
 * @param {string} label
 *
 * @returns {string}
 */
function tag(actor, label) {
    const type = actor?.type ?? "unknown";
    const edition = actor?.is5e === true ? "5e" : "6e";
    return `[${type} ${edition}] ${canonical(label)}`;
}

/**
 * Reject a missing or blank label before it reads the wrong node.
 *
 * @param {string} label
 * @param {string} caller Name shown in the thrown message.
 */
function requireLabel(label, caller) {
    if (typeof label !== "string" || label.trim() === "") {
        throw new Error(`${caller}: characteristic label must be a non-empty string, got ${JSON.stringify(label)}`);
    }
}
