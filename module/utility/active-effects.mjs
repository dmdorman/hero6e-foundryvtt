import { roundFavorPlayerAwayFromZero } from "./round.mjs";

/**
 * Shared active-effect change plumbing.
 *
 * Foundry applies effects natively (Actor#applyActiveEffects), while the 5e figured/calculated
 * recompute and the full-heal path re-apply the same changes by hand on top of a formula result.
 * Those engines must produce the same number for the same change set, so the pieces they both need
 * — reading an effect's changes, naming a change's type, Hero MULTIPLY rounding and the
 * non-stacking halving rule — live here once instead of in each engine.
 */

// Legacy V13 numeric modes (core CONST.ACTIVE_EFFECT_MODES) to their V14 string types. Reading
// change.mode on a V14 change logs a deprecation warning, so only plain legacy data lands here.
const CHANGE_TYPE_BY_LEGACY_MODE = Object.freeze({
    0: "custom",
    1: "multiply",
    2: "add",
    3: "downgrade",
    4: "upgrade",
    5: "override",
});

// Core's change types (CONST.ACTIVE_EFFECT_CHANGE_TYPES). Anything else — a `custom.N` handler, a
// typo on a hand-authored change — is not something either engine knows how to apply.
const CHANGE_TYPES = Object.freeze(["custom", "multiply", "add", "subtract", "downgrade", "upgrade", "override"]);

/**
 * An effect's change entries, whatever shape the effect is in.
 *
 * A prepared ActiveEffect document exposes `changes` as a getter onto `system.changes` (with
 * priorities defaulted and the legacy `mode` shim installed), so documents are read through
 * `changes`; raw effect data and hand-built templates may carry either.
 * @param {ActiveEffect|object} effect
 * @returns {Array<object>}
 */
export function activeEffectChanges(effect) {
    const prepared = effect?.changes;
    if (Array.isArray(prepared) && prepared.length > 0) return prepared;

    const stored = effect?.system?.changes;
    if (Array.isArray(stored)) return stored;

    return [];
}

/**
 * A change's application type as the canonical V14 lower case string, accepting V13 numeric modes
 * and any casing.
 * @param {object} change
 * @returns {string|null} null when the type is unknown (e.g. a `custom.N` handler we don't apply).
 */
export function activeEffectChangeType(change) {
    const raw = change?.type ?? change?.mode;
    if (typeof raw === "number") return CHANGE_TYPE_BY_LEGACY_MODE[raw] ?? null;

    const lowerCase = String(raw ?? "").toLowerCase();
    return CHANGE_TYPES.includes(lowerCase) ? lowerCase : null;
}

/**
 * A change's sort priority, defaulted the way core defaults it.
 *
 * Changes read off a prepared document already carry one (ActiveEffect#prepareBaseData); synthetic
 * change data must be defaulted identically or the manual engine orders its changes differently
 * than the native one.
 * @param {object} change
 * @param {string|null} [changeType] - Precomputed activeEffectChangeType(change).
 * @returns {number}
 */
export function activeEffectChangePriority(change, changeType = activeEffectChangeType(change)) {
    const priority = Number(change?.priority);
    if (Number.isFinite(priority)) return priority;

    const coreDefault = Number(foundry.documents.ActiveEffect.implementation.CHANGE_TYPES?.[changeType]?.priority);
    return Number.isFinite(coreDefault) ? coreDefault : 0;
}

/**
 * MULTIPLY applied the Hero way: a halved characteristic rounds in the player's favour.
 * @param {number} current
 * @param {number} delta
 * @returns {number}
 */
export function multiplyFavoringPlayer(current, delta) {
    return roundFavorPlayerAwayFromZero(current * delta);
}

/**
 * Drops the redundant halving changes from a change list, in place.
 *
 * Halved conditions do not stack: a character who is both Prone and Grabbed is at 1/2 DCV, not 1/4.
 * The most severe fraction wins outright (an x1/4 supersedes an x1/2 rather than compounding with
 * it), so among same-key MULTIPLY changes below x1 only the lowest survives. Multipliers of x1 or
 * more are not halvings — an x2 doubling has to stack normally and must never be deduped away.
 *
 * Survivors keep their position so the caller's priority ordering is untouched.
 * @param {Array<T>} changes - Mutated in place.
 * @param {object} [accessors] - Readers for callers whose entries wrap the change data. Spelled
 *   `changeXOf` because a destructured `valueOf` default would resolve to Object.prototype's.
 * @param {(entry: T) => string} [accessors.changeKeyOf]
 * @param {(entry: T) => string|null} [accessors.changeTypeOf]
 * @param {(entry: T) => *} [accessors.changeValueOf]
 * @template T
 */
export function removeRedundantHalvingChanges(
    changes,
    {
        changeKeyOf = (entry) => entry.key,
        changeTypeOf = (entry) => activeEffectChangeType(entry),
        changeValueOf = (entry) => entry.value,
    } = {},
) {
    const halvingOf = (entry) => {
        if (changeTypeOf(entry) !== "multiply") return null;
        const value = parseFloat(changeValueOf(entry));
        return Number.isFinite(value) && value < 1 ? value : null;
    };

    const halvingEntries = new Set();
    const halvingsByKey = new Map();
    for (const entry of changes) {
        const value = halvingOf(entry);
        if (value === null) continue;

        halvingEntries.add(entry);
        const key = changeKeyOf(entry);
        const mostSevere = halvingsByKey.get(key);
        if (!mostSevere || value < mostSevere.value) halvingsByKey.set(key, { entry, value });
    }
    if (halvingsByKey.size === 0) return;

    for (let index = changes.length - 1; index >= 0; index--) {
        const entry = changes[index];
        if (!halvingEntries.has(entry)) continue;
        if (entry !== halvingsByKey.get(changeKeyOf(entry)).entry) changes.splice(index, 1);
    }
}
