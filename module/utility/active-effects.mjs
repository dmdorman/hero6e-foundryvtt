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

// Core defaults a change's priority from its type in ActiveEffect#prepareBaseData, so changes read
// off a prepared document already carry one. Synthetic change data must be defaulted identically or
// the manual engine orders its changes differently than the native one.
const DEFAULT_PRIORITY_BY_CHANGE_TYPE = Object.freeze({
    custom: 0,
    multiply: 10,
    add: 20,
    subtract: 20,
    downgrade: 30,
    upgrade: 40,
    override: 50,
});

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
    return lowerCase in DEFAULT_PRIORITY_BY_CHANGE_TYPE ? lowerCase : null;
}

/**
 * A change's sort priority, defaulted the way core defaults it.
 * @param {object} change
 * @param {string|null} [changeType] - Precomputed activeEffectChangeType(change).
 * @returns {number}
 */
export function activeEffectChangePriority(change, changeType = activeEffectChangeType(change)) {
    const priority = Number(change?.priority);
    if (Number.isFinite(priority)) return priority;
    return DEFAULT_PRIORITY_BY_CHANGE_TYPE[changeType] ?? 0;
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
 * @param {object} [accessors] - Readers for callers whose entries wrap the change data.
 * @param {(entry: T) => string} [accessors.keyOf]
 * @param {(entry: T) => string|null} [accessors.typeOf]
 * @param {(entry: T) => *} [accessors.valueOf]
 * @template T
 */
export function removeRedundantHalvingChanges(
    changes,
    {
        keyOf = (entry) => entry.key,
        typeOf = (entry) => activeEffectChangeType(entry),
        valueOf = (entry) => entry.value,
    } = {},
) {
    const halvingsByKey = new Map();
    for (const entry of changes) {
        if (typeOf(entry) !== "multiply") continue;

        const value = parseFloat(valueOf(entry));
        if (!Number.isFinite(value) || value >= 1) continue;

        const key = keyOf(entry);
        const mostSevere = halvingsByKey.get(key);
        if (!mostSevere || value < mostSevere.value) halvingsByKey.set(key, { entry, value });
    }
    if (halvingsByKey.size === 0) return;

    for (let index = changes.length - 1; index >= 0; index--) {
        const entry = changes[index];
        const mostSevere = halvingsByKey.get(keyOf(entry));
        if (!mostSevere || entry === mostSevere.entry) continue;
        if (typeOf(entry) !== "multiply") continue;

        const value = parseFloat(valueOf(entry));
        if (Number.isFinite(value) && value < 1) changes.splice(index, 1);
    }
}
