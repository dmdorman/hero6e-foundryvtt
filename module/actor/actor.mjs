import { PresenceAttackApplication } from "../applications/apps/presence-attack.mjs";
import { HeroRoller } from "../heroRoller/dice.mjs";
import { HEROSYS } from "../herosystem6e.mjs";
import { HeroItemCharacteristic } from "../item/HeroSystem6eTypeDataModels.mjs";
import { dehydrateAttackItem } from "../item/item-attack.mjs";
import { userInteractiveVerifyOptionallyPromptThenSpendResources } from "../item/item-resources.mjs";
import { HeroSystem6eItem, cloneToEffectiveAttackItem } from "../item/item.mjs";
import { tagObjectForPersistence } from "../migration.mjs";
import { overrideCanAct } from "../settings/settings-helpers.mjs";
import { Attack, actionToJSON } from "../utility/attack.mjs";
import { HeroObjectCacheMixin } from "../utility/cache.mjs";
import { HeroCompatibility } from "../utility/compatibility.mjs";
import { characteristicValueToDiceParts } from "../utility/damage.mjs";
import { HeroProgressBar } from "../utility/progress-bar.mjs";
import { roundFavorPlayerAwayFromZero, roundFavorPlayerTowardsZero } from "../utility/round.mjs";
import { doSuccessRoll, generateSuccessChatCard } from "../utility/success-card.mjs";
import {
    base64ToUtf8,
    getCharacteristicInfoArrayForActor,
    getPowerInfo,
    squelch,
    tokenEducatedGuess,
    utf8ToBase64,
    whisperUserTargetsForActor,
} from "../utility/util.mjs";
import { HeroSystem6eActorActiveEffects } from "./actor-active-effects.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
const FoundryVttFilePicker = foundry.applications?.apps?.FilePicker?.implementation || FilePicker;

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class HeroSystem6eActor extends HeroObjectCacheMixin(Actor) {
    static Speed2Segments = [
        [0],
        [7],
        [6, 12],
        [4, 8, 12],
        [3, 6, 9, 12],
        [3, 5, 8, 10, 12],
        [2, 4, 6, 8, 10, 12],
        [2, 4, 6, 7, 9, 11, 12],
        [2, 3, 5, 6, 8, 9, 11, 12],
        [2, 3, 4, 6, 7, 8, 10, 11, 12],
        [2, 3, 4, 5, 6, 8, 9, 10, 11, 12],
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ];

    /** @inheritdoc */
    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);

        const actorChanges = {};

        // A "fresh" create is one whose edition has not yet been determined. A compendium drag/drop
        // already carries full data (including is5e), so we must not overwrite it. Fresh creates get
        // their edition, prototype token, versioning, flags, free items, and item force-replacement set
        // up here.
        const freshCreate = this.system.is5e == undefined;
        if (freshCreate) {
            HEROSYS.log(false, "_preCreate");

            // Honor an explicit options.is5e (used by uploads/tests and drag/drop); otherwise fall back
            // to the world's DefaultEdition setting. Without this, edition-dependent costs (e.g. combat
            // skill levels) mis-detect the edition and compute the wrong point totals.
            const is5e =
                options.is5e != undefined
                    ? options.is5e
                    : game.settings.get(HEROSYS.module, "DefaultEdition") === "five";

            actorChanges.prototypeToken = {
                displayBars: CONST.TOKEN_DISPLAY_MODES.HOVER,
                displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
                sight: { enabled: true },
            };
            if (this.type !== "npc") {
                actorChanges.prototypeToken.actorLink = true;
                actorChanges.prototypeToken.disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
                actorChanges.prototypeToken.displayBars = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
            }

            actorChanges.system = { is5e, versionHeroSystem6eCreated: game.system.version };
            actorChanges.flags = {
                [game.system.id]: {
                    file: {
                        lastModifiedDate: Date.now(),
                        uploadedBy: user.name,
                        name: `[FoundryVTT actor]`,
                    },
                },
            };

            // Apply the edition immediately so the characteristic recalculation below evaluates the 5e
            // figured/calculated formulas against the correct edition.
            this.updateSource({ system: { is5e } });
        }

        // Seed missing characteristics and evaluate dependent 5e formulas. Incoming
        // characteristic values are preserved for drag/drop and imported actors.
        this._preparePreCreateCharacteristics(data, actorChanges);

        // Fold the generated setup + characteristic objects into the transient document source.
        this.updateSource(actorChanges);

        if (freshCreate) {
            // Create free stuff unless this is specifically for a quench create.
            if (!options.quenchCreate) {
                await this.addFreeStuff();
            }

            // Merge in the entire system + force-replace items so nested item system data survives.
            const items = this.items.map((i) => ({ ...i.toObject(), system: i.system }));
            this.updateSource(HeroCompatibility.forceReplace({ items }));
        }

        // For debugging purposes
        window.actor = this;
    }

    /**
     * Prepares missing baseline characteristics during actor creation.
     * @param {object} data - Raw incoming creation data payload object.
     * @param {object} actorChanges - The pending source mutation payload.
     */
    _preparePreCreateCharacteristics(data, actorChanges) {
        // Ensure native characteristics have identifiers for downstream baseInfo lookups.
        for (const [key, char] of Object.entries(this.system)) {
            if (key.match(/[A-Z]/) && char instanceof HeroItemCharacteristic && !char.XMLID) {
                actorChanges.system ??= {};
                actorChanges.system[key] = { XMLID: key, xmlTag: key };
            }
        }

        actorChanges.system ??= {};
        actorChanges.system.characteristics ??= {};
        const payloadChars = data.system?.characteristics ?? {};
        const characteristicInfo = getCharacteristicInfoArrayForActor(this);
        const payloadCharacteristicKeys = new Set();

        // Seed rulebook base plus purchased levels for characteristics missing from the payload.
        for (const info of characteristicInfo) {
            const keyLower = info.key.toLowerCase();
            if (payloadChars[keyLower]?.value !== undefined || payloadChars[keyLower]?.max !== undefined) {
                payloadCharacteristicKeys.add(keyLower);
                continue;
            }

            const characteristic = this.getCharacteristic(keyLower);

            const basePoints = characteristic?.base ?? characteristic?.baseInfo?.base ?? 0;

            // Purchased LEVELS may come from the incoming payload or the transient source.
            const rawSystemNode = data.system?.[info.key] ?? this.system?.[info.key];
            const purchasedLevels = Number(rawSystemNode?.LEVELS ?? payloadChars[keyLower]?.LEVELS ?? 0);

            const totalStartingPoints = basePoints + purchasedLevels;

            actorChanges.system.characteristics[keyLower] = {
                value: totalStartingPoints,
                max: totalStartingPoints,
            };
        }

        // Evaluate dependent formulas after primaries have been seeded.
        this._recalculateCharacteristicsByPriority(actorChanges.system.characteristics, {
            preserveCharacteristicKeys: payloadCharacteristicKeys,
        });
    }

    /**
     * Snapshot-and-restore for transient in-memory patches to this actor. Lets 5e formula passes see
     * pending values without updateSource (which flattens HeroActorCharacteristic models to plain objects).
     *
     * Performance: patching a handful of properties in place is much cheaper than the alternatives —
     * actor.clone() + prepareData re-runs the entire embedded item pipeline per recompute, and
     * updateSource rebuilds the system model. These passes run inside prepareDerivedData/_preUpdate,
     * which fire on every update and render, so the recompute must stay allocation-light. The patches
     * are applied and restored synchronously within one call frame, so no other code observes them.
     */
    _createTransientPatcher() {
        const patched = new Map();
        return {
            patch: (path, value) => {
                if (!patched.has(path)) patched.set(path, foundry.utils.getProperty(this, path));
                foundry.utils.setProperty(this, path, value);
            },
            restore: () => {
                for (const [path, value] of patched) {
                    foundry.utils.setProperty(this, path, value);
                }
            },
        };
    }

    /**
     * Recalculates seeded characteristics in primary-first order so 5e dependents see current sources.
     * @param {object} targetChars - The characteristics data object to mutate inline
     * @param {object} options
     * @param {Set<string>} options.preserveCharacteristicKeys - Characteristics supplied by the payload.
     */
    _recalculateCharacteristicsByPriority(targetChars, { preserveCharacteristicKeys = new Set() } = {}) {
        const characteristicInfo = getCharacteristicInfoArrayForActor(this);
        const { patch, restore } = this._createTransientPatcher();

        const isDependentCharacteristic = (info) =>
            this.is5e === true && !!(info.figured5eCharacteristic || info.calculated5eCharacteristic);

        const executionPasses = [
            characteristicInfo.filter((info) => !isDependentCharacteristic(info)), // Pass 1: Primaries / Baseline
            characteristicInfo.filter((info) => isDependentCharacteristic(info)), // Pass 2: Figured & Calculated Dependencies
        ];

        try {
            for (const infoList of executionPasses) {
                for (const info of infoList) {
                    const keyLower = info.key.toLowerCase();
                    if (preserveCharacteristicKeys.has(keyLower)) continue;

                    const characteristic = this.getCharacteristic(keyLower);
                    if (!characteristic) continue;

                    const currentEntry = targetChars[keyLower] ?? {};
                    const isDependent = isDependentCharacteristic(info);
                    let baseValue;

                    if (isDependent) {
                        // Own purchased LEVELS stack on the formula (bought SPD or LEAPING inches),
                        // matching prepareDerivedData and the persistence path.
                        const ownLevels = Number(this.system?.[info.key]?.LEVELS ?? 0);
                        const rawCalculatedValue =
                            (info.figured5eCharacteristic
                                ? info.figured5eCharacteristic(this)
                                : info.calculated5eCharacteristic(this)) + ownLevels;

                        // SPD floors; other figured/calculated use player-favorable rounding. This matches
                        // prepareDerivedData and the persistence path so a fresh actor doesn't disagree
                        // with its first recompute.
                        if (keyLower === "spd") {
                            baseValue = Math.floor(rawCalculatedValue);
                        } else {
                            baseValue = roundFavorPlayerAwayFromZero(rawCalculatedValue);
                        }

                        if (baseValue === 0 && characteristic.base !== undefined && characteristic.base > 0) {
                            baseValue = characteristic.base;
                        }
                    } else {
                        const basePoints = characteristic.base ?? 0;
                        const keyUpper = info.key.toUpperCase();

                        const rawSystemNode = this.system?.[info.key] ?? this.system?.[keyUpper];
                        const purchasedLevels = Number(rawSystemNode?.LEVELS ?? currentEntry.LEVELS ?? 0);

                        baseValue = currentEntry.value ?? basePoints + purchasedLevels;
                        if (baseValue === 0 && basePoints > 0) {
                            baseValue = basePoints + purchasedLevels;
                        }
                    }

                    // Value follows the recomputed max unless the characteristic is currently damaged or
                    // depleted (its prior value sits below its prior max), in which case preserve that value
                    // as a resource-pooling/damage shield. A char at full (value === max) or one whose value
                    // was never independently set adopts the freshly computed max; this is what lets a
                    // dependent seeded before its primaries (e.g. LEAPING/OCV seeded to 0 while STR/DEX
                    // were still 0) adopt its correct computed value rather than keeping the stale seed.
                    let finalValueState;
                    if (currentEntry.value === undefined || currentEntry.value === currentEntry.max) {
                        finalValueState = baseValue;
                    } else {
                        finalValueState = currentEntry.value;
                    }

                    targetChars[keyLower] = {
                        value: finalValueState,
                        max: baseValue,
                    };

                    // Make earlier pass values visible to formulas in later passes without calling
                    // updateSource during _preCreate, which runs prepareDerivedData on partially seeded data in v13.
                    patch(`system.characteristics.${keyLower}.value`, finalValueState);
                    patch(`system.characteristics.${keyLower}.max`, baseValue);
                }
            }
        } finally {
            restore();
        }
    }

    // Post-process a creation operation for a single Document instance. Post-operation events occur for all connected clients.
    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
    }

    /**
     * Prepare data for the Document. This method provides an opportunity for Document classes to define special data
     * preparation logic to compute values that don't need to be stored in the database, such as a "bloodied" hp value
     * or the total carrying weight of items. The work done by this method should be idempotent per initialization.
     * There are situations in which prepareData may be called more than once.
     *
     * By default, foundry calls the following methods in order whenever the document is created or updated.
     * 1. {@link reset} (Inherited from DataModel)
     * 2. {@link _initialize} (Inherited from DataModel)
     * 3. {@link prepareData}
     * 4. {@link foundry.abstract.TypeDataModel.prepareBaseData | TypeDataModel#prepareBaseData}
     * 5. {@link prepareBaseData}
     * 6. {@link prepareEmbeddedDocuments}
     * 7. {@link foundry.abstract.TypeDataModel.prepareDerivedData | TypeDataModel#prepareBaseData}
     * 8. {@link prepareDerivedData}
     *
     * Do NOT invoke database operations like {@link update} or {@link setFlag} within data prep, as that can cause an
     * infinite loop by re-triggering the data initialization process.
     *
     * If possible you should extend {@link prepareBaseData} and {@link prepareDerivedData} instead of this function
     * directly, but some systems with more complicated calculations may want to override this function to add extra
     * steps, such as to calculate certain item values after actor data prep.
     */
    prepareData() {
        super.prepareData();
    }

    /**
     * Re-evaluates transient 5e derived maxima after active effects have been applied.
     */
    prepareDerivedData() {
        super.prepareDerivedData();

        this._clearCachedObjectData();

        this.composeMemoizableObjectFunction("analyzeEndurance");
        this.composeMemoizableObjectFunction("getActorCharacterAndActivePoints");
        this.composeMemoizableObjectFunction("getAutomatonItems");
        this.composeMemoizableObjectFunction("getAutomatonSpecialPowers");

        // The 5e recompute below reads characteristic nodes, which may not exist yet mid-construction.
        if (!this.system?.characteristics) return;

        if (this.is5e === true) {
            const characteristicInfo = getCharacteristicInfoArrayForActor(this);

            // One effect-collection pass shared by the override + per-characteristic passes below;
            // allApplicableEffects() walks actor and item effects and prepareData runs on every
            // update/render.
            const maxChangesByKey = this._collectActiveEffectMaxChanges();
            const restoreFormulaSources = this._apply5eActiveEffectFormulaSourceOverrides(
                characteristicInfo,
                maxChangesByKey,
            );
            try {
                for (const info of characteristicInfo) {
                    const keyLower = info.key.toLowerCase();
                    const characteristic = this.getCharacteristic(keyLower);
                    if (!characteristic) continue;

                    const baseInfo = characteristic.baseInfo;
                    let calculatedValue = null;

                    // Both kinds add the characteristic's own purchased LEVELS on top of the formula
                    // base: bought SPD or extra LEAPING inches stack with the derived amount. 5e CVs
                    // (OCV/DCV/OMCV/DMCV) cannot be purchased directly, so their LEVELS are always 0
                    // and this is a no-op for them.
                    if (baseInfo?.figured5eCharacteristic) {
                        calculatedValue = baseInfo.figured5eCharacteristic(this) + (this.system[info.key]?.LEVELS ?? 0);
                    } else if (baseInfo?.calculated5eCharacteristic) {
                        calculatedValue =
                            baseInfo.calculated5eCharacteristic(this) + (this.system[info.key]?.LEVELS ?? 0);
                    }

                    if (calculatedValue !== null) {
                        let calculatedMax;

                        // 5ER p. 33: "SPD is the only Figured Characteristic that doesn't round in
                        // favor of the character" — a SPD of 2.9 is still SPD 2, so floor it; every
                        // other figured/calculated value uses player-favorable rounding. This matches
                        // the persistence path (_computeFiguredCharacteristicChanges) so a live
                        // recompute never disagrees with what an update would commit.
                        if (keyLower === "spd") {
                            calculatedMax = Math.floor(calculatedValue);
                        } else {
                            calculatedMax = roundFavorPlayerAwayFromZero(calculatedValue);
                        }

                        const node = this.system.characteristics[keyLower];
                        node.max = this._applyDirectActiveEffectChangesToDerivedMax(keyLower, calculatedMax, {
                            maxChangesByKey,
                        });
                    }
                }
            } finally {
                restoreFormulaSources();
            }
        }

        // Effects that alter a characteristic max must move the current value with it on every
        // edition (this pass replaced the deleted AE-lifecycle value→max sync); it runs after the
        // 5e recompute above so recomputed maxima are final.
        for (const keyLower of Object.keys(this.system.characteristics)) {
            this._syncCharacteristicValueWithMax(keyLower);
        }
    }

    /**
     * Keeps a characteristic's current value coherent with its (effect-adjusted) max:
     * - A value resting untouched at its stored maximum (no damage, no value-targeting effects)
     *   FOLLOWS the max in both directions — a bigger STR means a longer leap right now, not just
     *   a higher ceiling.
     * - A stored value deliberately set above the stored max (GM overfill; both sheets style it
     *   with the over-max class, and 6e has no cap at all) is user intent and must survive.
     * - Otherwise only cap DOWN (e.g. Prone halving DCV). Never raise a diverged value: for
     *   expendables (STUN/END) the gap below max is damage/spent points and raising it would
     *   silently heal them on every render, and a value below its stored source may be a
     *   value-targeting effect (e.g. the Brace maneuver's x1/2 DCV) that must not be erased.
     */
    _syncCharacteristicValueWithMax(keyLower) {
        const node = this.system.characteristics?.[keyLower];
        if (!node) return;

        const currentValue = Number(node.value);
        if (!Number.isFinite(currentValue) || !Number.isFinite(Number(node.max))) return;

        const sourceNode = this._source.system?.characteristics?.[keyLower] ?? {};
        const restingAtStoredMax =
            currentValue === Number(sourceNode.value) && Number(sourceNode.value) === Number(sourceNode.max);
        const storedOverMax = Number(sourceNode.value) > Number(sourceNode.max);

        let coherentValue;
        if (restingAtStoredMax) coherentValue = node.max;
        else if (storedOverMax) coherentValue = currentValue;
        else coherentValue = Math.min(currentValue, node.max);

        // Effects that halve the current value directly can leave a fraction behind; apply Hero
        // rounding (SPD always rounds down, 5ER p. 33).
        if (!Number.isInteger(coherentValue)) {
            coherentValue =
                keyLower === "spd" ? Math.floor(coherentValue) : roundFavorPlayerAwayFromZero(coherentValue);
        }
        if (coherentValue !== currentValue) node.value = coherentValue;
    }

    /**
     * Patches the 5e formula source primaries (DEX, EGO, STR, CON, BODY) so the dependent formulas
     * evaluated in prepareDerivedData read effect-adjusted values, per 5ER p. 105:
     *
     *   "Adjustment Powers that affect Primary Characteristics have no effect on Figured
     *    Characteristics, but do affect abilities calculated from Primary Characteristics
     *    (such as ... a character's Combat Value derived from DEX)."
     *
     * So each source primary gets two independently filtered views, fed through disjoint lever arms:
     * - Calculated dependents (OCV/DCV/OMCV/DMCV) read the characteristic's *value*
     *   (config formulas use safeCharacteristicValue). They see every non-item effect on the
     *   primary's max — adjustments included, in BOTH directions (a DRAIN DEX lowers CV; at
     *   DEX 1 or less CV is 0, 5ER p. 37).
     * - Figured dependents (PD/ED/SPD/REC/END/STUN/LEAPING) read *basePlusLevels* (base + LEVELS).
     *   They see only non-adjustment effects (a transformation or characteristic-bought-as-a-power
     *   changes figured characteristics, 5ER p. 139-40; AID/DRAIN/TRANSFER never do — the 5ER
     *   p. 105 Transfer example drains DEX "but loses no SPD").
     *
     * Item-held effects are excluded from both views: characteristic items feed dependents through
     * the item-sum path in the formulas themselves (baseSumFiguredCharacteristicsFromItems), so
     * counting their transferred effects here would double-propagate.
     */
    _apply5eActiveEffectFormulaSourceOverrides(characteristicInfo, maxChangesByKey) {
        // Source primaries per dependency kind (config.mjs behaviors tags, e.g. calculatedDEX/figuredSTR).
        const calculatedSourceKeys = new Set();
        const figuredSourceKeys = new Set();
        for (const info of characteristicInfo) {
            for (const behavior of info.behaviors ?? []) {
                const match = behavior.match(/^(figured|calculated)([A-Z]+)$/);
                if (!match) continue;
                (match[1] === "calculated" ? calculatedSourceKeys : figuredSourceKeys).add(match[2].toLowerCase());
            }
        }

        const { patch, restore } = this._createTransientPatcher();

        for (const key of new Set([...calculatedSourceKeys, ...figuredSourceKeys])) {
            const nonItemEntries = (maxChangesByKey.get(key) ?? []).filter((entry) => !entry.fromItem);
            if (nonItemEntries.length === 0) continue;

            const characteristic = this.getCharacteristic(key);
            const characteristicData = this.system.characteristics?.[key];
            if (!characteristic || !characteristicData) continue;

            const basePlusLevels = Number(characteristic.basePlusLevels ?? 0);
            if (!Number.isFinite(basePlusLevels)) {
                console.error(`${this.name}: formula source ${key} base+levels is not numeric (${basePlusLevels})`);
                continue;
            }

            // Calculated view: all non-item effects, both directions. Rebuilt from base+LEVELS plus
            // the filtered entries rather than read from the derived max, because Foundry's native
            // application already folded item-transferred effects into that max and those must only
            // flow through the item-sum path. CV formulas read the characteristic's *value*
            // (safeCharacteristicValue), so that is the property patched.
            if (calculatedSourceKeys.has(key)) {
                const calculatedSourceValue = this._applyActiveEffectChangeEntries(basePlusLevels, nonItemEntries);
                if (calculatedSourceValue !== Number(characteristic.value ?? 0)) {
                    patch(`system.characteristics.${key}.value`, calculatedSourceValue);
                }
            }

            // Figured view: non-adjustment effects only, both directions.
            if (figuredSourceKeys.has(key)) {
                const figuredEntries = nonItemEntries.filter((entry) => !entry.fromAdjustment);
                if (figuredEntries.length === 0) continue;

                const nativeKey = key.toUpperCase();
                if (!this.system[nativeKey]) {
                    console.error(`${this.name}: missing native ${nativeKey} node for formula source override`);
                    continue;
                }

                // Figured formulas read basePlusLevels = baseInfo.base(actor) + system.KEY.LEVELS.
                // The base term is a fixed config function, so LEVELS is the only patchable term:
                // setting LEVELS to (effective source - base) makes basePlusLevels read exactly the
                // effect-adjusted source value.
                const baseValue = Number(characteristic.baseInfo?.base?.(this) ?? 0);
                const figuredSourceValue = this._applyActiveEffectChangeEntries(basePlusLevels, figuredEntries);
                if (Number.isFinite(baseValue) && figuredSourceValue !== basePlusLevels) {
                    patch(`system.${nativeKey}.LEVELS`, figuredSourceValue - baseValue);
                }
            }
        }

        return restore;
    }

    /**
     * Single pass over all applicable effects collecting changes that target a characteristic max,
     * keyed by lowercase characteristic. Hot-path callers (prepareDerivedData, fullHealth) build this
     * once and hand it to the helpers below instead of re-walking actor + item effects per
     * characteristic. Reads V13 (effect.changes, numeric change.mode) and V14 (effect.system.changes,
     * string change.type) shapes and normalizes to a numeric mode.
     */
    _collectActiveEffectMaxChanges() {
        // Memoized per data-preparation cycle (prepareDerivedData resets _lazy): hot-path callers
        // (the 5e base getter, maxTitle, fullHealth) otherwise re-walk actor + item effects per access.
        const lazy = (this._lazy ??= {});
        if (lazy.maxChangesByKey) return lazy.maxChangesByKey;

        const byKey = new Map();
        for (const effect of this.allApplicableEffects()) {
            if (effect.disabled || effect.isSuppressed) continue;

            const fromStatus = effect.statuses?.size > 0;
            const fromItem = effect.parent !== this;
            const fromAdjustment = effect.flags?.[game.system.id]?.type === "adjustment";
            const effectChanges = effect.changes?.length ? effect.changes : (effect.system?.changes ?? []);
            for (const [index, change] of effectChanges.entries()) {
                const match = change.key?.match(/^system\.characteristics\.([a-z]+)\.max$/);
                if (!match) continue;

                const rawMode = change.mode ?? change.type;
                const mode =
                    typeof rawMode === "number"
                        ? rawMode
                        : CONST.ACTIVE_EFFECT_MODES[String(rawMode ?? "").toUpperCase()];

                const entries = byKey.get(match[1]) ?? [];
                entries.push({
                    change,
                    mode,
                    index,
                    priority: change.priority ?? (mode ?? 0) * 10,
                    fromStatus,
                    fromItem,
                    fromAdjustment,
                });
                byKey.set(match[1], entries);
            }
        }

        lazy.maxChangesByKey = byKey;
        return byKey;
    }

    /**
     * Applies collected active-effect change entries on top of a starting value, mirroring Foundry's
     * own AE application (modes, priority order) plus the Hero-specific rules Foundry can't express:
     * player-favorable rounding on MULTIPLY and non-stacking halved conditions.
     * @param {number} startValue - The value before effects.
     * @param {Array} entries - Entries from _collectActiveEffectMaxChanges (pre-filtered by caller).
     * @returns {number}
     */
    _applyActiveEffectChangeEntries(startValue, entries) {
        if (entries.length === 0) return startValue;

        const modes = CONST.ACTIVE_EFFECT_MODES;
        const sorted = [...entries].sort((a, b) => a.priority - b.priority || a.index - b.index);

        let value = startValue;
        // Halved conditions do not stack: a character who is both Prone and Grabbed is at 1/2 DCV,
        // not 1/4. Apply the first halving and skip the rest.
        let halvingApplied = false;
        for (const { change, mode } of sorted) {
            if (mode == null) continue;
            const delta = Number(change.value);
            if (!Number.isFinite(delta)) continue;

            switch (mode) {
                case modes.ADD:
                    value += delta;
                    break;
                case modes.MULTIPLY:
                    if (delta === 0.5) {
                        if (halvingApplied) break;
                        halvingApplied = true;
                    }
                    value = roundFavorPlayerAwayFromZero(value * delta);
                    break;
                case modes.OVERRIDE:
                    value = delta;
                    break;
                case modes.UPGRADE:
                    value = Math.max(value, delta);
                    break;
                case modes.DOWNGRADE:
                    value = Math.min(value, delta);
                    break;
            }
        }

        return value;
    }

    /**
     * Foundry applies active effects before prepareDerivedData. The 5e formula pass still needs to run
     * after that so effects on primaries can propagate to dependents, but recomputing a dependent's max
     * from its formula erases any effects that directly target that max (e.g. Prone halving DCV, or a
     * direct AID PD). This re-applies just those direct changes on top of the formula result.
     * @param {string} keyLower - Lowercase characteristic key.
     * @param {number} calculatedMax - Formula-derived max before direct active effects.
     * @param {object} [options]
     * @param {boolean} [options.includeStatusEffects] - Include status-effect changes (excluded on heal paths).
     * @param {Map} [options.maxChangesByKey] - Prebuilt _collectActiveEffectMaxChanges() result.
     * @returns {number}
     */
    _applyDirectActiveEffectChangesToDerivedMax(
        keyLower,
        calculatedMax,
        { includeStatusEffects = true, maxChangesByKey = this._collectActiveEffectMaxChanges() } = {},
    ) {
        const changes = (maxChangesByKey.get(keyLower) ?? []).filter(
            (entry) => includeStatusEffects || !entry.fromStatus,
        );
        return this._applyActiveEffectChangeEntries(calculatedMax, changes);
    }

    /**
     * Clear all cached object data.
     * @internal
     */
    _clearCachedObjectData() {
        // Clear all the rest
        this._lazy = {};
    }

    /**
     * Retrieves a characteristic node by name from the system characteristics storage layer.
     * WARNING: This is a method reflecting the old way of doing things. It is being created to funnel all characteristics access away from
     * direct property access. This will be turned into a more expensive function. As well, the concepts of value, max, etc may well go away
     * when characteristics are items.
     *
     * Get the characteristic structure.
     *
     * @param {string} characteristicName - Target property layout key
     * @returns {object|null} The underlying characteristic node structure
     */
    getCharacteristic(characteristicName) {
        if (!characteristicName) return null;
        return this.system?.characteristics?.[characteristicName.toLowerCase()] ?? null;
    }

    /**
     * WARNING: This is a method reflecting the old way of doing things. It is being created to funnel all characteristics access away from
     *          direct property access. This will be turned into a more expensive function. As well, the concepts of value, max, etc may well go away
     *          when characteristics are items.
     *
     * Update the characteristic structure with the provided tuplets.
     *
     * @param {Array<[String, {String: Number}]>} characteristicNamesPropertiesAndValues
     * @param {Object} options - options to pass into update
     *
     * @returns
     */
    async updateCharacteristics(characteristicNamesPropertiesAndValues, options) {
        if (characteristicNamesPropertiesAndValues.length === 0) {
            console.error(`${this.name}: updateCharacteristics invoked with no changes`);
        }

        const characteristicNamePropertyAndValues = {};
        for (const [characteristicName, propertyNewValueObject] of characteristicNamesPropertiesAndValues) {
            characteristicNamePropertyAndValues[`system.characteristics.${characteristicName}`] =
                propertyNewValueObject;
        }

        return this.update(characteristicNamePropertyAndValues, options);
    }

    /**
     * Toggle a configured status effect for the Actor.
     * @param {string} statusId A status effect ID defined in CONFIG.statusEffects
     * @param {object} [options={}] Additional options which modify how the effect is created
     * @param {boolean} [options.active] Force the effect to be active or inactive regardless of its current state
     * @param {boolean} [options.overlay=false] Display the toggled effect as an overlay
     * @param {object} [options.changed] The delta object tracking raw document modifications passed down from the _preUpdate lifecycle hook to evaluate pending numeric transitions before they are saved to the database.
     * @returns {Promise<ActiveEffect|boolean|undefined>} A promise which resolves to one of the following values:
     * - ActiveEffect if a new effect needed to be created
     * - true if it was already an existing active effect
     * - false if an existing effect needed to be removed
     * - undefined if no changes need to be made
     * @override
     */
    async toggleStatusEffect(statusId, { active, overlay = false, changed = {} } = {}) {
        const effectsObj = HeroSystem6eActorActiveEffects.statusEffectsObj;
        const overlayEffects = [effectsObj.deadEffect.id, effectsObj.knockedOutEffect.id, effectsObj.stunEffect.id];

        // Core treats undefined as "flip current state" (token HUD toggles); the state
        // machine below needs a concrete boolean or removal pre-deletes the effect and
        // core immediately recreates it.
        active ??= !this.statuses.has(statusId);

        // 1. Force overlay status based on config
        if (overlayEffects.includes(statusId)) overlay = true;

        // 2. Lockout rules: overlay priority is Dead > Knocked Out > Stunned, and a
        // Knocked Out character cannot also be Stunned.
        const isDead = this.statuses.has(effectsObj.deadEffect.id);
        if (isDead && active && [effectsObj.knockedOutEffect.id, effectsObj.stunEffect.id].includes(statusId)) {
            return false;
        }
        const isKnockedOut = this.statuses.has(effectsObj.knockedOutEffect.id);
        if (isKnockedOut && active && statusId === effectsObj.stunEffect.id) {
            return false;
        }

        // 3. Process the state machine transformations via immutable constants
        const incomingDead =
            statusId === effectsObj.deadEffect.id ? active : this.statuses.has(effectsObj.deadEffect.id);
        const incomingKO =
            statusId === effectsObj.knockedOutEffect.id ? active : this.statuses.has(effectsObj.knockedOutEffect.id);
        const incomingStun =
            statusId === effectsObj.stunEffect.id ? active : this.statuses.has(effectsObj.stunEffect.id);

        // Track incoming states for asleep and unconscious just like Dead/KO
        const finalAsleep =
            statusId === effectsObj.asleepEffect.id ? active : this.statuses.has(effectsObj.asleepEffect.id);
        const finalUnconscious =
            statusId === effectsObj.unconsciousEffect.id ? active : this.statuses.has(effectsObj.unconsciousEffect.id);

        // Apply conditional rules directly to determine the final immutable states
        const finalDead = incomingDead;
        const finalKO = finalDead ? false : incomingKO;
        const finalStun = finalDead || finalKO ? false : incomingStun;

        const impliesProne = finalDead || finalKO || finalUnconscious || finalAsleep;
        const finalProne = impliesProne ? true : this.statuses.has(effectsObj.proneEffect.id);

        // 4. Batch target modifications for ActiveEffects array
        const effectsToCreate = [];
        const effectsToDelete = [];

        if (finalProne && !this.statuses.has(effectsObj.proneEffect.id)) {
            effectsToCreate.push(effectsObj.proneEffect);
        }
        // Cascade removals only; the toggled status itself belongs to super.toggleStatusEffect,
        // which also owns its return value semantics.
        if (!finalStun && statusId !== effectsObj.stunEffect.id && this.statuses.has(effectsObj.stunEffect.id)) {
            const stunAE = this.effects.find((e) => e.statuses.has(effectsObj.stunEffect.id));
            if (stunAE) effectsToDelete.push(stunAE.id);
        }
        if (
            !finalKO &&
            statusId !== effectsObj.knockedOutEffect.id &&
            this.statuses.has(effectsObj.knockedOutEffect.id)
        ) {
            const koAE = this.effects.find((e) => e.statuses.has(effectsObj.knockedOutEffect.id));
            if (koAE) effectsToDelete.push(koAE.id);
        }

        if (effectsToDelete.length > 0) {
            await this.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
        }
        if (effectsToCreate.length > 0) {
            // Build from the full status definition (core's toggle pipeline) so the status'
            // `changes` (e.g. prone's DCV halving) survive the cascade.
            const createData = [];
            for (const effect of effectsToCreate) {
                const statusEffect = await ActiveEffect.implementation.fromStatusEffect(effect.id);
                createData.push(statusEffect.toObject());
            }

            await this.createEmbeddedDocuments("ActiveEffect", createData, { keepId: true });
        }

        // 5. Run canvas visual scene batch refresh routines
        if (overlayEffects.includes(statusId)) {
            // (linked=false, document=true): every token representing this actor on the viewed
            // scene — unlinked copies included — as TokenDocuments, since the tint/alpha update
            // below is a document operation and must not depend on rendered placeables.
            const tokenDocuments = this.getActiveTokens(false, true);

            if (tokenDocuments.length > 0) {
                const colors = CONFIG.HERO.statusColors;
                let updatePayload = { alpha: colors.DEFAULT_ALPHA, "texture.tint": colors.CLEAR_TINT };

                if (finalDead) {
                    updatePayload = { alpha: colors.DEAD_ALPHA, "texture.tint": colors.DEAD_TINT };
                } else if (finalKO) {
                    // The KO effect may not exist yet mid-toggle; force the pending state explicitly.
                    const isOutOfCombat = this.getKnockedOutOfCombat({
                        ...changed,
                        _forceKOActive: finalKO,
                    });

                    updatePayload = {
                        alpha: colors.DEFAULT_ALPHA,
                        "texture.tint": isOutOfCombat ? colors.KO_COMBAT_TINT : colors.KO_DEFAULT_TINT,
                    };
                } else if (finalStun) {
                    updatePayload = { alpha: colors.DEFAULT_ALPHA, "texture.tint": colors.STUNNED_TINT };
                }

                const tokenUpdates = tokenDocuments.map((tokenDocument) => ({
                    _id: tokenDocument.id,
                    ...updatePayload,
                }));
                await canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);

                if (finalDead) {
                    for (const tokenDocument of tokenDocuments) {
                        if (tokenDocument.object) {
                            await tokenDocument.object.layer._sendToBackOrBringToFront(false);
                        }
                    }
                }
            }
        }

        // 6. Fire and directly return core's promise resolution
        try {
            return await super.toggleStatusEffect(statusId, { active, overlay });
        } catch (e) {
            console.error(`HERO: Status effect toggle failed for ${statusId}`, e);
            return false;
        }
    }

    async removeActiveEffect(activeEffect) {
        console.warn("Consider using 'toggleStatusEffect'", this, activeEffect);
        if (!activeEffect) {
            console.warn("removeActiveEffect is missing a parameter", this);
        }
        const existingEffect = Array.from(this.allApplicableEffects()).find(
            (o) => o.id === activeEffect.id || o.statuses.has(activeEffect.id),
        );
        if (existingEffect) {
            if (activeEffect.id == "knockedOut") {
                // When they wakes up, their END equals their
                // current STUN total.
                const newEnd = Math.min(this.getCharacteristic("stun").value, this.getCharacteristic("end").max);

                await this.updateCharacteristics([["end", { value: newEnd }]], {});
            }

            await existingEffect.delete();
        }

        for (const token of this.getActiveTokens()) {
            if (this.statuses.has("dead")) {
                await token.document.update({ alpha: 0.3, [`texture.tint`]: `ff0000` });
                await token.layer._sendToBackOrBringToFront(false); // send to back
            } else if (this.statuses.has("knockedOut")) {
                await token.document.update({ alpha: 1, [`texture.tint`]: "ffff00" });
            } else if (this.statuses.has("stunned")) {
                await token.document.update({ alpha: 1, [`texture.tint`]: "ffff00" });
            } else {
                await token.document.update({ alpha: 1, [`texture.tint`]: null });
            }
        }
    }

    // Adding ActiveEffects seems complicated.
    // Make sure only one of the same ActiveEffect is added
    // Assumes ActiveEffect is a statusEffects.
    // TODO: Allow for a non-statusEffects ActiveEffect (like from a power)
    async addActiveEffect(activeEffect) {
        console.warn("Consider using 'toggleStatusEffect'", activeEffect);
        const newEffect = foundry.utils.deepClone(activeEffect);

        // Check for standard StatusEffects
        // statuses appears to be necessary to associate with StatusEffects
        if (activeEffect.id) {
            newEffect.statuses = [activeEffect.id];

            // Check if this ActiveEffect already exists
            const existingEffect = this.effects.find(
                (o) => o.statuses.has(activeEffect.id) && !activeEffect.id.includes("DRAIN"),
            );
            if (!existingEffect) {
                await this.createEmbeddedDocuments("ActiveEffect", [newEffect]);
            } else {
                console.warn("There was a pre-existing ActiveEffect, so the new AE was not added.");
            }
        }

        if (activeEffect.id == "knockedOut") {
            // Knocked Out overrides Stunned
            await this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect);
        }
    }

    async changeTypeDialog(options = {}) {
        const template = `systems/${HEROSYS.module}/templates/chat/actor-change-type-dialog.hbs`;
        const actor = this;
        let cardData = {
            actor,
            groupName: "typeChoice",
            choices: Actor.TYPES.filter((o) => o != "character" && o != "base").reduce(
                (a, v) => ({ ...a, [v]: v.replace("2", "") }),
                {},
            ), // base is internal type and/or keyword. BASE2 is for bases.
            chosen: actor.type,
        };
        const content = await foundryVttRenderTemplate(template, cardData);

        await foundry.applications.api.DialogV2.prompt(
            foundry.utils.mergeObject(
                {
                    window: { title: `Change ${this.name} Type` },
                    content,
                    ok: {
                        label: "Apply",
                        callback: (event, button) => button.form.elements.actorType.value,
                    },
                    submit: async (result) => {
                        if (result) await this._changeType(result);
                        else console.error(`User picked option: ${result}`);
                    },
                },
                options,
            ),
        );
    }

    async _changeType(targetType) {
        // Cannot change unlinked actor type
        if (this.token) {
            return ui.notifications.error(
                `Cannot change actor type for an unlinked actor. Try again with sidebar prototype token.`,
            );
        }

        await this.update(
            {
                type: targetType,
                system: foundry.utils.mergeObject(this.system.toObject(), { _type: targetType }),
            },
            { recursive: false },
        );
    }

    /* -------------------------------------------- */

    /**
     * Handle how changes to a Token attribute bar are applied to the Actor.
     * This allows for game systems to override this behavior and deploy special logic.
     * @param {string} attribute    The attribute path
     * @param {number} value        The target attribute value
     * @param {boolean} isDelta     Whether the number represents a relative change (true) or an absolute change (false)
     * @param {boolean} isBar       Whether the new value is part of an attribute bar, or just a direct value
     * @returns {Promise<documents.Actor>}  The updated Actor document
     */
    async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
        const current = foundry.utils.getProperty(this.system, attribute);

        // Determine the updates to make to the actor data
        let updates;
        if (isBar) {
            if (isDelta) value = HeroCompatibility.clamp(-99, Number(current.value) + value, current.max); // a negative bar is typically acceptable
            updates = { [`system.${attribute}.value`]: value };
        } else {
            if (isDelta) value = Number(current) + value;
            updates = { [`system.${attribute}`]: value };
        }
        const allowed = Hooks.call("modifyTokenAttribute", { attribute, value, isDelta, isBar }, updates);
        return allowed !== false ? this.update(updates) : this;
    }

    async _preUpdate(changed, options, userId) {
        const allowed = await super._preUpdate(changed, options, userId);
        if (allowed === false) return false;

        const systemData = changed?.system || {};
        const is5e = this.is5e === true;

        // =========================================================================
        // 1. CHARACTERISTIC & TRAIT CALCULATIONS (Alters changed payload inline)
        // =========================================================================

        // BOTH 5e and 6e vehicles must process size calculations!
        if (
            (systemData.characteristics &&
                ("size" in systemData.characteristics || "basesize" in systemData.characteristics)) ||
            this.type === "vehicle"
        ) {
            await this.applySizeEffect(changed, options, userId);
        }

        // Recompute 5e figured (SPD) and calculated (OCV/DCV/OMCV/DMCV) characteristics when their
        // source primaries change, merging the derived max/value into `changed` so they commit
        // atomically in this same write. This evaluates the config formulas by temporarily patching the
        // live actor's in-memory fields and restoring them (no updateSource), so the HeroActorCharacteristic
        // models are never flattened to plain objects mid-lifecycle. Live/display values and Active-Effect
        // driven recomputation are handled separately in prepareDerivedData().
        if (is5e) {
            this._apply5eCalculatedCharacteristics(changed);
        }

        // Inventory weight and carrying capacity corrections
        if ("items" in changed || systemData.characteristics?.str) {
            await this.applyEncumbrancePenalty(changed);
        }

        // Natural Healing tracks BODY damage against REC
        if (systemData.characteristics?.body || systemData.characteristics?.rec) {
            await this.setNaturalHealing(changed);
        }

        // =========================================================================
        // 2. AUTOMATED STATUS CONDITION & COMBAT TRACKER MANAGEMENT
        // =========================================================================
        const stunValueChanged = changed?.system?.characteristics?.stun?.value !== undefined;
        // V13 echoes the document's unchanged type into every update delta (V14 does not),
        // so only a real type mutation counts. Actors whose type has no STUN characteristic
        // (vehicles, bases) cannot be stunned or knocked out; without this guard their
        // missing STUN reads as 0 and every update would knock them out.
        const typeChanged = changed.type !== undefined && changed.type !== this.type;
        const actorTypeSupportsStun = getCharacteristicInfoArrayForActor(this).some((info) => info.key === "STUN");
        if ((stunValueChanged || typeChanged) && actorTypeSupportsStun) {
            // Grab the incoming STUN value payload, or fall back to the actor's current value
            const nextStun = changed.system?.characteristics?.stun?.value ?? this.getCharacteristic("stun")?.value ?? 0;
            const currentStun = this.getCharacteristic("stun")?.value || 0;

            // Calculate dynamic threshold parameters based on the incoming type target frame
            const currentThreshold = this.stunThreshold;
            const incomingType = changed.type ?? this.type;
            const nextThreshold = this.constructor.stunThresholdForType(incomingType);

            // RULE A: Recovering back into positive STUN -> Clear the unconscious state.
            // Post-Segment-12 recoveries never wake a KO'd character (preventRecoverFromStun).
            if (nextStun > 0) {
                if (!options.preventRecoverFromStun) {
                    if (this.statuses.has("knockedOut") || this.effects.some((e) => e.statuses.has("knockedOut"))) {
                        await this.toggleStatusEffect("knockedOut", { active: false, changed });
                    }
                    if (this.statuses.has("bleeding")) {
                        await this.toggleStatusEffect("bleeding", { active: false, changed });
                    }
                }
            }
            // RULE B: Dropping to 0 or lower STUN -> Trigger native toggle pipelines
            else if (nextStun <= 0 && currentStun > 0) {
                await this.toggleStatusEffect("knockedOut", { active: true, overlay: true, changed });
                await this.toggleStatusEffect("prone", { active: true, changed });
            }
            // RULE C: Falling below threshold, OR crossing threshold boundaries via type mutations
            else if (
                (nextStun < nextThreshold && currentStun >= currentThreshold && currentStun <= 0) ||
                (typeChanged && nextStun <= 0)
            ) {
                // Re-triggering ensures toggleStatusEffect catches the new threshold data frame
                // and shifts the texture tint smoothly between KO_DEFAULT_TINT and KO_COMBAT_TINT
                await this.toggleStatusEffect("knockedOut", { active: true, overlay: true, changed });
            }
        }

        // BODY-based death automation: pc/npc die at BODY <= -BODY.max, automatons at BODY <= 0;
        // the dead mark clears when BODY recovers above the threshold.
        if (changed?.system?.characteristics?.body?.value !== undefined && this.getCharacteristic("body")) {
            const nextBody = changed.system.characteristics.body.value ?? this.getCharacteristic("body").value ?? 0;
            const nextBodyMax = changed.system.characteristics.body.max ?? this.getCharacteristic("body").max ?? 0;
            const isAutomaton = this.type === "automaton" || this.getAutomatonItems().length > 0;

            if (isAutomaton || ["pc", "npc"].includes(this.type)) {
                const deathThreshold = isAutomaton ? 0 : -nextBodyMax;
                if (nextBody <= deathThreshold && !this.statuses.has("dead")) {
                    await this.toggleStatusEffect("dead", { active: true, overlay: true, changed });
                } else if (nextBody > deathThreshold && this.statuses.has("dead")) {
                    await this.toggleStatusEffect("dead", { active: false, changed });
                }

                // A functioning automaton is neither knocked out nor bleeding
                if (isAutomaton && nextBody > 0) {
                    for (const statusId of ["knockedOut", "bleeding"]) {
                        if (this.statuses.has(statusId)) {
                            await this.toggleStatusEffect(statusId, { active: false, changed });
                        }
                    }
                }
            }
        }

        // =========================================================================
        // 3. SCROLLING METADATA BUS (Packed into options for multi-client broadcast)
        // =========================================================================
        options.displayScrollingChanges = [];
        const chatLines = [];
        const showChangesSetting = game.settings.get(game.system.id, "ShowCombatCharacteristicChanges");
        const processScrolling = showChangesSetting === "all" || (showChangesSetting === "pc" && this.type === "pc");

        if (processScrolling) {
            // Evaluate STUN text changes
            if (changed?.system?.characteristics?.stun?.value !== undefined) {
                const curStun = this.getCharacteristic("stun")?.value || 0;
                const targetStun = changed.system.characteristics.stun.value;
                if (curStun !== targetStun) {
                    chatLines.push(`STUN from ${curStun} to ${targetStun}`);
                    options.displayScrollingChanges.push({
                        value: targetStun - curStun,
                        options: { max: this.getCharacteristic("stun")?.max || 0, fill: "0x00FF00" },
                    });
                }
            }

            // Evaluate BODY text changes
            if (changed?.system?.characteristics?.body?.value !== undefined) {
                const curBody = this.getCharacteristic("body")?.value || 0;
                const targetBody = changed.system.characteristics.body.value;
                if (curBody !== targetBody) {
                    chatLines.push(`BODY from ${curBody} to ${targetBody}`);
                    options.displayScrollingChanges.push({
                        value: targetBody - curBody,
                        options: { max: this.getCharacteristic("body")?.max || 0, fill: "0xFF1111" },
                    });
                }
            }
        }

        // Early exit if chat operations or visual updates are explicitly suppressed
        if (options.hideChatMessage || !options.render) return true;

        // Post Damage Output Messages
        const chatContent = chatLines.join("<br>");
        if (!options.quenchCreate && chatContent) {
            ChatMessage.create({
                author: game.user.id,
                whisper: whisperUserTargetsForActor(this),
                speaker: ChatMessage.getSpeaker({ actor: this }),
                content: chatContent,
            });
        }

        // Heroic Identity Conversion Announcement
        if (
            !options.quenchCreate &&
            changed.system?.heroicIdentity !== undefined &&
            this.system.heroicIdentity !== undefined &&
            changed.system.heroicIdentity !== this.system.heroicIdentity
        ) {
            const token = this.getActiveTokens()[0];
            const speaker = ChatMessage.getSpeaker({ actor: this, token });
            const tokenName = token?.name || this.name;
            speaker["alias"] = game.user.name;
            const identityContent = `<b>${tokenName}</b> ${changed.system.heroicIdentity ? "entered" : "left"} their heroic identity.`;
            ChatMessage.create({
                style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                author: game.user._id,
                content: identityContent,
                speaker: speaker,
            });
        }

        return true;
    }

    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);

        // 1. Unpack and execute computed scrolling data across all connected player displays
        if (options.displayScrollingChanges?.length && typeof this._displayScrollingChange === "function") {
            for (const change of options.displayScrollingChanges) {
                this._displayScrollingChange(change.value, change.options);
            }
        }

        // 2. Trigger canvas lighting and vision grid refreshes if sensory tracking altered
        const systemData = changed?.system || {};
        if (systemData.senses || changed.effects) {
            canvas.perception?.update({ initializeVision: true, refreshLighting: true });
        }
    }

    sizeDetails(size) {
        // An explicit size of 0 is a valid override; only fall back to the actor when no usable size is given.
        const overrideSize = parseInt(size);
        let _size = Math.max(
            0,
            Number.isNaN(overrideSize) ? parseInt(this.getCharacteristic("size")?.value || 0) : overrideSize,
        );
        if (this.type === "base2") {
            _size =
                6 +
                Math.max(
                    0,
                    Number.isNaN(overrideSize)
                        ? parseInt(this.getCharacteristic("basesize")?.value || 0)
                        : overrideSize,
                );
        }

        const values =
            this.type === "base2"
                ? {
                      length: 0,
                      width: 0,
                      height: 0,
                      volume: 0,
                      dcv: -Math.floor((_size * 2) / 3), // 5e has DCV penalty to base/vehicle. 6e has OCV bonus to attacker. Need to distinguish.
                      mass: 0,
                      str: 0, // TODO: bases don't have STR so this really shouldn't be here.
                      kbResistance: 0, // TODO: bases don't have STR so this really shouldn't be here.
                      body: 0,
                  }
                : {
                      length: 0,
                      width: 0,
                      height: 0,
                      volume: 0,
                      dcv: -Math.floor((_size * 2) / 3),
                      mass: 0,
                      str: _size * 5,
                      kbResistance: _size,
                      body: _size,
                  };
        values.description =
            _size > 0
                ? // `L${values.length}, W${values.width}, ` +
                  // `H${values.height}, V${values.volume}, ` +
                  `${values.dcv ? `DCV${values.dcv}, ` : ``}` +
                  // `Mass${values.mass}, ` +
                  `STR+${values.str}, KB-${values.kbResistance}, BODY+${values.body}`
                : "";
        return values;
    }

    // Compute figured-characteristic dependencies (e.g. 5e PD figured from STR) of changedCharKey.
    // Figured characteristics only change with actual purchases (LEVELS), so this is only invoked from
    // the LEVELS-change path — never for AID/DRAIN adjustments. Reads from `actor` (which may reflect a
    // not-yet-committed patched state), so callers can either persist the results or merge them into a
    // pending `changed` payload. Returns [characteristicKey, newValue] tuples.
    _computeFiguredCharacteristicChanges(actor, changedCharKey) {
        const changes = [];
        for (const charPowerInfo of getCharacteristicInfoArrayForActor(actor).filter((o) =>
            o.behaviors.includes(`figured${changedCharKey.toUpperCase()}`),
        )) {
            const key = charPowerInfo.key.toLocaleLowerCase();

            if (charPowerInfo.figured5eCharacteristic) {
                const levels = actor.system[charPowerInfo.key]?.LEVELS;
                if (levels == null) {
                    console.warn(`${actor.name} has ${key}.LEVELS that is ${levels}`);
                }

                // Kludge: we only need to floor SPD as everything is prerounded. If we don't round then
                //         committing to the database will kindly round to an integer for us.
                const newValue = Math.floor(charPowerInfo.figured5eCharacteristic(actor) + (levels ?? 0));
                changes.push([key, newValue]);
            }
        }
        return changes;
    }

    // Recompute 5e figured (e.g. PD) and calculated (e.g. OCV/DCV) characteristics when their source
    // primaries change, merging the derived max/value into the pending `changed` payload so they commit
    // atomically in the same write. Called from _preUpdate; only mutates `changed`, never calls update().
    // It evaluates the config formulas against the effective (post-update) primaries by temporarily
    // patching this actor's in-memory characteristic fields and restoring them in a finally, rather than
    // cloning (clone+prepareData re-runs the item pipeline and can throw mid-update on transient state)
    // or calling updateSource (which flattens the HeroActorCharacteristic models into plain objects,
    // stripping the methods the figured formulas call). The method is fully synchronous, so no other code
    // observes the transient state, and nothing persists except via the returned `changed` payload.
    _apply5eCalculatedCharacteristics(changed) {
        if (!this.is5e) return;
        const systemChanged = changed?.system;
        if (!systemChanged) return;

        const infoArray = getCharacteristicInfoArrayForActor(this);

        // Primaries whose change can drive a *calculated* dependent (e.g. dex -> ocv/dcv). Figured
        // dependents (e.g. spd) recompute only on a LEVELS change (block A) or via the Active Effect
        // path, because they derive from base+LEVELS rather than the stored value.
        const calculatedSourceKeys = new Set();
        for (const info of infoArray) {
            for (const behavior of info.behaviors) {
                const match = behavior.match(/^calculated([A-Z]+)$/);
                if (match) calculatedSourceKeys.add(match[1].toLowerCase());
            }
        }

        // Block A source: purchased LEVELS changed for a characteristic (e.g. HDC upload / edit).
        // Keep the original (schema-cased) key so we can patch system.<KEY>.LEVELS below.
        // Only an actual LEVELS change counts: payloads that merely echo the current LEVELS
        // (full-object round-trips) must not resync value/max to base+LEVELS, which would strip
        // adjustment (AID/DRAIN) results from the stored value.
        const levelsChanged = Object.keys(systemChanged)
            .filter(
                (k) =>
                    systemChanged[k]?.LEVELS != null &&
                    this.hasCharacteristic(k.toUpperCase()) &&
                    Number(systemChanged[k].LEVELS) !==
                        Number(foundry.utils.getProperty(this.system, `${k}.LEVELS`) ?? 0),
            )
            .map((k) => ({ origKey: k, key: k.toLowerCase() }));

        // Block B source: a characteristic value changed and it feeds a calculated dependent.
        const valueChangedKeys = systemChanged.characteristics
            ? Object.keys(systemChanged.characteristics).filter(
                  (k) => systemChanged.characteristics[k]?.value !== undefined,
              )
            : [];
        const relevantValueChangedKeys = valueChangedKeys.filter((k) => calculatedSourceKeys.has(k));

        if (levelsChanged.length === 0 && relevantValueChangedKeys.length === 0) return;

        const { patch, restore } = this._createTransientPatcher();

        // characteristicKey -> integer value/max to merge into `changed`.
        const results = {};

        try {
            // Apply changed LEVELS so basePlusLevels reflects the new purchase.
            for (const { origKey } of levelsChanged) {
                patch(`system.${origKey}.LEVELS`, systemChanged[origKey].LEVELS);
            }
            // Apply explicit characteristic value changes so calculated formulas read them.
            for (const k of valueChangedKeys) {
                patch(`system.characteristics.${k}.value`, systemChanged.characteristics[k].value);
            }

            // (A) LEVELS changes: sync the primary's stored max/value and recompute figured dependents
            // (e.g. SPD). Floor basePlusLevels because a 5e figured base can be fractional (SPD = 1 +
            // DEX/10) and the stored field is an integer that would otherwise round 7.5 up to 8 instead
            // of down to 7 (matches fullHealth()'s parseInt and the figured helper's Math.floor).
            for (const { key } of levelsChanged) {
                const primaryValue = Math.floor(this.getCharacteristic(key).basePlusLevels);
                results[key] = primaryValue;
                // Reflect the primary's new value so calculated formulas (which read .value) see it.
                patch(`system.characteristics.${key}.value`, primaryValue);
                patch(`system.characteristics.${key}.max`, primaryValue);
                for (const [depKey, depValue] of this._computeFiguredCharacteristicChanges(this, key)) {
                    results[depKey] = depValue;
                }
            }

            // (B) 5e calculated characteristics (OCV/DCV/OMCV/DMCV, LEAPING). Include LEVELS-changed
            // sources so a purchased DEX increase also refreshes OCV/DCV (and a STR increase refreshes
            // LEAPING).
            const calculatedTriggerKeys = new Set([
                ...relevantValueChangedKeys,
                ...levelsChanged.map((l) => l.key).filter((k) => calculatedSourceKeys.has(k)),
            ]);
            for (const changeKey of calculatedTriggerKeys) {
                for (const char of infoArray.filter((o) =>
                    o.behaviors.includes(`calculated${changeKey.toUpperCase()}`),
                )) {
                    if (char.calculated5eCharacteristic) {
                        // Purchased LEVELS stack on the formula (bought LEAPING inches; always 0 for
                        // CVs, which cannot be purchased in 5e).
                        results[char.key.toLowerCase()] =
                            char.calculated5eCharacteristic(this) + Number(this.system[char.key]?.LEVELS ?? 0);
                    }
                }
            }

            // Merge computed derived values into `changed` (dotted leaf paths) so they commit in this same
            // write and Foundry reconstructs the characteristic models on commit.
            for (const [key, value] of Object.entries(results)) {
                foundry.utils.setProperty(changed, `system.characteristics.${key}.max`, value);
                foundry.utils.setProperty(changed, `system.characteristics.${key}.value`, value);
            }
        } finally {
            // Restore the actor's in-memory state exactly as it was.
            restore();
        }
    }

    async TakeRecovery({ asAction, token, preventRecoverFromStun }) {
        if (asAction == undefined) {
            console.error(`TakeRecovery asAction is ${asAction}`, this);
        }

        if (token == undefined) {
            console.warn(`TakeRecovery token is ${token}`, this);
        }

        // RECOVERING
        // Characters use REC to regain lost STUN and expended END.
        // This is known as “Recovering” or “taking a Recovery.”
        // When a character Recovers, add their REC to their current
        // STUN and END totals (to a maximum of their full values, of
        // course). Characters get to Recover in two situations: Post-
        // Segment and when they choose to Recover as a Full Phase
        // Action.

        // RECOVERING AS AN ACTION
        // Recovering is a Full Phase Action and occurs at the end of
        // the Segment (after all other characters who have a Phase that
        // Segment have acted). A character who Recovers during a Phase
        // may do nothing else. They cannot even maintain a Constant Power
        // or perform Actions that cost no END or take no time. However,
        // they may take Zero Phase Actions at the beginning of their Phase
        // to turn off Powers, and Persistent Powers that don’t cost END
        // remain in effect.

        // If not a PC and DEAD then don't recover
        if (this.type !== "pc" && this.statuses.has("dead")) {
            if (asAction) {
                ui.notifications.error(`${this.name} is Defeated/Dead and cannot take a recovery.`);
            }
            return;
        }

        token = token || this.getActiveTokens()[0];
        const speaker = ChatMessage.getSpeaker({ actor: this, token });
        const tokenName = token?.name || this.name;

        if (!asAction && this.statuses.has("knockedOut")) {
            if (this.getCharacteristic("stun")?.value <= -31) {
                return `${tokenName} is knockedOut for "a long time" and does not get a recovery (untracked).`;
            } else if (this.getCharacteristic("stun")?.value <= -21) {
                return `${tokenName} is knockedOut and only gets a recovery once per minute (untracked).`;
            }
            // stun.value <= -11 (Post-Segment 12 only)
            // stun.value <= -0 (Every Phase and Post-Segment 12)
        }

        // Bases don't get/need a recovery
        if (this.type === "base2") {
            console.log(`${token?.name || this.name} has type ${this.type} and does not get/need a recovery.`);
            if (asAction) {
                ui.notifications.warn(
                    `${token?.name || this.name} has type ${this.type} and does not get/need a recovery.`,
                );
            }
            return `${tokenName} is a BASE and does not get a recovery.`;
        }

        // PH: FIXME: If this is not required, then we should get rid of it.
        // Catchall for no stun or end (shouldn't be needed as base type check above should be sufficient)
        if ((this.getCharacteristic("end")?.max || 0) === 0 && (this.getCharacteristic("stun")?.max || 0) === 0) {
            console.log(`${token?.name || this.name} has no STUN or END thus does not get/need a recovery.`);
            if (asAction) {
                ui.notifications.warn(
                    `${token?.name || this.name} has no STUN or END thus does not get/need a recovery.`,
                );
            }
            return `${tokenName} has no STUN or END characteristic and does not get a recovery.`;
        }

        // A character who holds their breath does not get to Recover (even on Post-Segment 12)
        if (this.statuses.has("holdingBreath")) {
            const content = `${tokenName} <i>is holding their breath</i> and does not get a recovery.`;
            if (asAction) {
                const chatData = {
                    author: game.user._id,
                    style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                    content: content,
                    speaker: speaker,
                };
                await ChatMessage.create(chatData);
            }
            return content;
        }

        // FIXME: CHARACTERISTICS TO ITEMS: Rework from here.
        const chars = this.system.characteristics;

        // Need to account for negative RECovery
        const rec = Math.max(0, chars.rec.value);

        let newStun = chars.stun.value + rec;
        let newEnd = Math.max(0, chars.end.value) + rec;

        // newEnd should not exceed newStun if current stun <=0
        if (chars.stun.value <= 0) {
            newEnd = Math.max(0, Math.min(newStun, newEnd));
        }

        if (newStun > chars.stun.max) {
            newStun = Math.max(chars.stun.max, chars.stun.value); // possible > MAX (which is OKish)
        }
        const deltaStun = newStun - chars.stun.value;

        if (newEnd > chars.end.max) {
            newEnd = Math.max(chars.end.max, chars.end.value); // possible > MAX (which is OKish)
        }

        // Ignore negative deltaEnd values.
        // It seems like END should be set to 0 when you are KO'd, but haven't found such a rule.
        const deltaEnd = Math.max(0, newEnd - chars.end.value);

        await this.updateCharacteristics(
            [
                ["stun", { value: newStun }],
                ["end", { value: newEnd }],
            ],
            { hideChatMessage: true, preventRecoverFromStun },
        );

        let content = `${tokenName} ${this.system.characteristics.stun?.value <= 0 ? "is knockedOut, " : ""}${asAction ? `<i>Takes a Recovery</i>` : "gets a recovery"}`;
        if (rec <= 0) {
            content += ` [REC=${chars.rec.value}]`;
        }
        if (deltaEnd || deltaStun) {
            if (chars.stun.value <= 0 && newStun > 0) {
                content += `, recovers from knockedOut, gaining ${deltaStun} stun and endurance set to ${newStun}.`;
            } else {
                content += `, gaining ${deltaEnd} endurance and ${deltaStun} stun.`;
            }
        } else {
            content += ".";
        }

        // ENDURANCERESERVE HACK
        if (asAction && !this.inCombat) {
            const ENDURANCERESERVE = this.items.find((item) => item.system.XMLID === "ENDURANCERESERVE");
            if (ENDURANCERESERVE) {
                const ENDURANCERESERVEREC = ENDURANCERESERVE.findModsByXmlid("ENDURANCERESERVEREC");
                const newValue = Math.min(
                    ENDURANCERESERVE.system.LEVELS,
                    ENDURANCERESERVE.system.value + parseInt(ENDURANCERESERVEREC.LEVELS),
                );
                if (newValue > ENDURANCERESERVE.system.value) {
                    const delta = newValue - ENDURANCERESERVE.system.value;
                    await ENDURANCERESERVE.update({
                        "system.value": Math.min(
                            parseInt(ENDURANCERESERVE.system.value) + ENDURANCERESERVEREC.LEVELS,
                            ENDURANCERESERVE.system.LEVELS,
                        ),
                    });
                    content += ` ${ENDURANCERESERVE.name} +${delta} END</li>`;
                }
            }
        }

        const chatData = {
            author: game.user._id,
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            content: content,
            speaker: speaker,
            whisper: [...ChatMessage.getWhisperRecipients(this.name), ...ChatMessage.getWhisperRecipients("GM")],
        };

        if (asAction) {
            await ChatMessage.create(chatData);

            // Remove stunned condition. (Part of ACTOR:_ONUPDATE?)
            // While not technically part of the rules, it is here as a convenience.
            // For example when Combat Tracker isn't being used.
            //await this.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect);
            // await this.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id, {
            //     active: true,
            // });
        }

        if (asAction && this.inCombat) {
            // While Recovering, a character is at ½ DCV
            const existingEffect = Array.from(this.temporaryEffects).find((o) => o.flags[game.system.id]?.takeRecovery);
            if (!existingEffect) {
                const activeEffect = {
                    name: "TakeRecovery",
                    img: `icons/svg/downgrade.svg`,
                    changes: [
                        {
                            key: "system.characteristics.dcv.max",
                            value: 0.5,
                            mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                        },
                    ],
                    origin: this.uuid,
                    duration: {
                        seconds: 1,
                    },
                    flags: {
                        [game.system.id]: {
                            takeRecovery: true,
                            expiresOn: "segmentStart",
                        },
                    },
                };
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            } else {
                ui.notifications.warn("Taking multiple recoveries is typically not allowed.");
            }
        }

        return content;
    }

    // Only used by _canDragLeftStart to prevent ENTANGLED tokens from moving
    canMove(uiNotice, event) {
        // Let GM move if holding ALT key
        if (event?.altKey && game.user.isGM) return true;

        let result = true;
        let badStatus = [];

        if (this.statuses.has("entangled")) {
            badStatus.push("ENTANGLED");
            result = false;
        }

        if (this.statuses.has("knockedOut")) {
            if (uiNotice) badStatus.push("KNOCKED OUT");
            result = false;
        }

        if (this.statuses.has("stunned")) {
            badStatus.push("STUNNED");
            result = false;
        }

        if (this.statuses.has("aborted")) {
            badStatus.push("ABORTED");
            result = false;
        }

        if (!result && overrideCanAct) {
            const speaker = ChatMessage.getSpeaker({
                actor: this,
            });
            speaker["alias"] = game.user.name;

            const chatData = {
                author: game.user._id,
                style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                content: `${this.name} is ${badStatus.join(", ")} and cannot move. Override key was used.`,
                whisper: whisperUserTargetsForActor(this),
                speaker,
            };
            ChatMessage.create(chatData);

            result = true;
        }

        if (!result) {
            const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
            ui.notifications.error(
                `${this.name} is ${badStatus.join(", ")} and cannot move.  Hold <b>${overrideKeyText}</b> to override. 
                ${overrideKeyText === "ControlLeft" ? `Use SPACEBAR to follow measured movement path.` : ""}`,
            );
        }

        if (result && this.statuses.has("prone")) {
            ui.notifications.warn(`${this.name} is prone`);
        }

        return result;
    }

    // Abort effect - If in combat and not our turn then this must be an abort unless holding an action
    /**
     * Is there combat and is it the actor's turn to act?
     *
     * @returns {boolean}
     */
    needsToAbortToAct() {
        const currentCombatActorId = game.combat?.combatants.find(
            (combatant) => combatant.tokenId === game.combat.current?.tokenId,
        )?.actorId;
        const thisActorsCombatTurn =
            game.combat?.active && currentCombatActorId != undefined && currentCombatActorId === this.id;
        const thisActorHoldingAnAction = this.statuses.has("holding");

        if (game.combat?.active && !thisActorsCombatTurn && !thisActorHoldingAnAction) {
            console.warn(`Is there combat and is it the actor's turn to act?`, this);
            return true;
        }

        return false;
    }

    // When stunned, knockedout, etc you cannot act
    canAct(uiNotice, event) {
        // Bases can always act (used for token attacher)
        if (this.type === "base2") return true;

        let result = true;
        let badStatus = [];

        // Is knocked out?
        if (this.statuses.has("knockedOut")) {
            if (uiNotice) badStatus.push("KNOCKED OUT");
            result = false;
        }

        // Is stunned?
        if (this.statuses.has("stunned")) {
            badStatus.push("STUNNED");
            result = false;
        }

        // Is already aborted?
        if (this.statuses.has("aborted")) {
            badStatus.push("ABORTED");
            result = false;
        }

        // Is not actor's turn to act
        // AaronWasHere 3/30/2025: Was unable to full heal Spctral Daemon LordB
        //  which tries to toggle on FLIGHT.  It was not part of the combat tracker.
        // if (this.needsToAbortToAct()) {
        //     badStatus.push("NOT THE ACTIVE COMBATANT");
        //     result = false;
        // }

        // No speed?
        if (parseInt(this.system.characteristics.spd?.value || 0) < 1) {
            if (uiNotice) badStatus.push("SPD1");
            result = false;
        }

        if (!result && overrideCanAct) {
            const speaker = ChatMessage.getSpeaker({
                actor: this,
            });
            speaker["alias"] = game.user.name;

            const chatData = {
                author: game.user._id,
                style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                content: `${this.name} is ${badStatus.join(", ")} and cannot act. Override key was used.`,
                whisper: whisperUserTargetsForActor(this),
                speaker,
            };
            ChatMessage.create(chatData);

            result = true;
        }

        if (!result && !event) {
            console.error("event missing");
        }

        if (!result) {
            const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
            ui.notifications.error(
                `${this.name} is ${badStatus.join(", ")} and cannot act.  Hold <b>${overrideKeyText}</b> to override.`,
            );
        }

        return result;
    }

    /**
     * Display changes to health as scrolling combat text.
     * Adapt the font size relative to the Actor's HP total to emphasize more significant blows.
     * @param {*} change
     * @param {*} options
     */
    _displayScrollingChange(change, options) {
        if (!change) return;
        const tokens = this.getActiveTokens();
        if (!tokens) return;
        const token = tokens[0];
        if (!token) return;
        options = options || {};

        let fontSize = 50;
        if (options.max) {
            fontSize += Math.floor((Math.abs(change) / options.max) * fontSize);
        }

        canvas.interface.createScrollingText(token.center, change.signedString(), {
            anchor: change < 0 ? CONST.TEXT_ANCHOR_POINTS.BOTTOM : CONST.TEXT_ANCHOR_POINTS.TOP,
            direction: change < 0 ? 1 : 2,
            fontSize: HeroCompatibility.clamp(fontSize, 50, 100),
            fill: options?.fill || "0xFFFFFF",
            stroke: options?.stroke || 0x00000000,
            strokeThickness: 4,
            jitter: 0.25,
        });
    }

    strDetails(str) {
        let strLiftText = "0kg";
        let strRunningThrow = 0;
        const value = Number.isFinite(Number(str)) ? Number(str) : this.system.characteristics.str?.value;

        if (value >= 105) {
            strLiftText = `${50 + Math.floor((value - 105) / 5) * 25} ktons`;
            strRunningThrow = 168 + Math.floor((value - 105) / 5) * 8;
        } else if (value >= 100) {
            strLiftText = "25 ktons";
            strRunningThrow = 160;
        } else if (value >= 95) {
            strLiftText = "12.5 ktons";
            strRunningThrow = 152;
        } else if (value >= 90) {
            strLiftText = "6.4 ktons";
            strRunningThrow = 144;
        } else if (value >= 85) {
            strLiftText = "3.2 ktons";
            strRunningThrow = 136;
        } else if (value >= 80) {
            strLiftText = "1.6 ktons";
            strRunningThrow = 128;
        } else if (value >= 75) {
            strLiftText = "800 tons";
            strRunningThrow = 120;
        } else if (value >= 70) {
            strLiftText = "400 tons";
            strRunningThrow = 112;
        } else if (value >= 65) {
            strLiftText = "200 tons";
            strRunningThrow = 104;
        } else if (value >= 60) {
            strLiftText = "100 tons";
            strRunningThrow = 96;
        } else if (value >= 55) {
            strLiftText = "50 tons";
            strRunningThrow = 88;
        } else if (value >= 50) {
            strLiftText = "25 tons";
            strRunningThrow = 80;
        } else if (value >= 45) {
            strLiftText = "12.5 tons";
            strRunningThrow = 72;
        } else if (value >= 40) {
            strLiftText = "6,400kg";
            strRunningThrow = 64;
        } else if (value >= 35) {
            strLiftText = "3,200kg";
            strRunningThrow = 56;
        } else if (value >= 30) {
            strLiftText = "1,600kg";
            strRunningThrow = 48;
        } else if (value >= 28) {
            strLiftText = "1,200kg";
            strRunningThrow = 44;
        } else if (value >= 25) {
            strLiftText = "800kg";
            strRunningThrow = 40;
        } else if (value >= 23) {
            strLiftText = "600kg";
            strRunningThrow = 36;
        } else if (value >= 20) {
            strLiftText = "400kg";
            strRunningThrow = 32;
        } else if (value >= 18) {
            strLiftText = "300kg";
            strRunningThrow = 28;
        } else if (value >= 15) {
            strLiftText = "200kg";
            strRunningThrow = 24;
        } else if (value >= 13) {
            strLiftText = "150kg";
            strRunningThrow = 20;
        } else if (value >= 10) {
            strLiftText = "100kg";
            strRunningThrow = 16;
        } else if (value >= 8) {
            strLiftText = "75kg";
            strRunningThrow = 12;
        } else if (value >= 5) {
            strLiftText = "50kg";
            strRunningThrow = 8;
        } else if (value >= 4) {
            strLiftText = "38kg";
            strRunningThrow = 6;
        } else if (value >= 3) {
            strLiftText = "25kg";
            strRunningThrow = 4;
        } else if (value >= 2) {
            strLiftText = "16kg";
            strRunningThrow = 3;
        } else if (value >= 1) {
            strLiftText = "8kg";
            strRunningThrow = 2;
        }

        // 5e allows negative strength
        if (this.system.is5e) {
            if (value < -25) {
                strLiftText = "0kg";
                strRunningThrow = 0;
            } else if (value < -23) {
                strLiftText = "0.8kg";
                strRunningThrow = 1;
            } else if (value < -20) {
                strLiftText = "1kg";
                strRunningThrow = 1;
            } else if (value < -18) {
                strLiftText = "1.6kg";
                strRunningThrow = 1;
            } else if (value < -15) {
                strLiftText = "2kg";
                strRunningThrow = 1;
            } else if (value < -13) {
                strLiftText = "3.2kg";
                strRunningThrow = 1;
            } else if (value < -10) {
                strLiftText = "4kg";
                strRunningThrow = 1;
            } else if (value < -8) {
                strLiftText = "6.4kg";
                strRunningThrow = 1;
            } else if (value < -5) {
                strLiftText = "8kg";
                strRunningThrow = 2;
            } else if (value < -3) {
                strLiftText = "12.5kg";
                strRunningThrow = 2;
            } else if (value < 0) {
                strLiftText = "16kg";
                strRunningThrow = 3;
            } else if (value < 3) {
                strLiftText = "25kg";
                strRunningThrow = 4;
            } else if (value < 5) {
                strLiftText = "37kg";
                strRunningThrow = 6;
            }
            strRunningThrow /= 2;
        }

        // Get numeric strLiftKg
        let m = strLiftText.replace(",", "").match(/(\d+)kg/);
        let strLiftKg = m ? m[1] : 0;

        m = strLiftText.replace(",", "").match(/(\d+) tons/);
        strLiftKg = m ? m[1] * 1000 : strLiftKg;

        m = strLiftText.replace(",", "").match(/(\d+) ktons/);
        strLiftKg = m ? m[1] * 1000 * 1000 : strLiftKg;

        return { strLiftText, strThrow: strRunningThrow, strLiftKg };
    }

    async applySizeEffect(changed) {
        // During _preUpdate this.system still holds the pre-update value; prefer the pending one.
        const sizeKey = this.type === "base2" ? "basesize" : "size";
        const pendingSize = changed?.system?.characteristics?.[sizeKey]?.value;
        const size = parseInt(pendingSize ?? this.system.characteristics[sizeKey]?.value ?? 0);
        const _sizeDetails = this.sizeDetails(size);

        let activeEffect =
            this.effects.find(
                (effect) => effect.name?.includes("size") && effect.flags[game.system.id]?.size === true,
            ) || {};
        if (_sizeDetails.body) {
            activeEffect.name = `size${size}`;
            activeEffect.img ??= "icons/svg/aura.svg";
            activeEffect.flags ??= {
                [game.system.id]: {
                    size: true,
                },
            };
            const changes = [];

            // FIXME: This is a DCV penalty to the base/vehicle in 5e and an OCV bonus to the attacker in 6e. Because it's
            // an OCV bonus to the attacker this isn't quite right but we always add it last so that it's not halved if
            // the defenders DCV is halved. Note that we are not affecting the attacker OCV which could be halved: this is not perfect.
            changes.push({
                key: "system.characteristics.dcv.max",
                value: _sizeDetails.dcv,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                priority: this.is5e
                    ? CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD
                    : CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE, // 6e don't allow this to be halved - see note above
            });

            changes.push({
                key: "system.characteristics.str.max",
                value: _sizeDetails.str,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
            });
            changes.push({
                key: "kbResistance",
                value: _sizeDetails.kbResistance,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
            });
            changes.push({
                key: "system.characteristics.body.max",
                value: _sizeDetails.body,
                mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
            });
            activeEffect = foundry.utils.mergeObject(activeEffect, {
                [HeroCompatibility.isV14 ? `system.changes` : `changes`]: changes,
            });

            if (activeEffect.id) {
                const updates = {
                    name: activeEffect.name,
                };
                if (HeroCompatibility.isV14) {
                    updates.system ??= {};
                    updates.system.changes = activeEffect.system.changes ?? activeEffect.changes;
                } else {
                    updates.changes = activeEffect.changes;
                }
                await activeEffect.update(updates);
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        } else {
            if (activeEffect.id) {
                await activeEffect.delete();
            }
        }
    }

    async applyEncumbrancePenalty(changed) {
        // Only 1 GM should do this
        if (!game.users.activeGM?.isSelf) return;

        // During _preUpdate this.system still holds the pre-update value; prefer the pending one.
        const strValue = Number(
            changed?.system?.characteristics?.str?.value ?? this.system.characteristics.str?.value ?? 0,
        );
        const { strLiftKg } = this.strDetails(strValue);
        const encumbrance = this.encumbrance;

        // Is actor encumbered?
        let dcvDex = 0;
        const maxStrengthPct = roundFavorPlayerTowardsZero((100 * encumbrance) / strLiftKg);
        if (maxStrengthPct >= 90) {
            dcvDex = -5;
        } else if (maxStrengthPct >= 75) {
            dcvDex = -4;
        } else if (maxStrengthPct >= 50) {
            dcvDex = -3;
        } else if (maxStrengthPct >= 25) {
            dcvDex = -2;
        } else if (maxStrengthPct >= 10) {
            dcvDex = -1;
        }

        // Penalty Skill Levels for encumbrance
        for (const pslEncumbrance of this.items.filter(
            (item) => item.pslPenaltyType === CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES.encumbrance && item.isActive,
        )) {
            dcvDex = Math.min(0, dcvDex + parseInt(pslEncumbrance.system.LEVELS));
        }

        // Movement
        let move = 0;
        switch (dcvDex) {
            case 0:
            // intentional fallthrough
            case -1:
                move = 0;
                break;
            case -2:
                move = -2;
                break;
            case -3:
                move = -4;
                break;
            case -4:
                move = -8;
                break;
            case -5:
                move = -16;
                break;
            default:
                console.error(`${this.name} has an unexpected dcvDex of ${dcvDex}`);
                break;
        }

        const name = `Encumbered ${maxStrengthPct}%`;
        const prevActiveEffects = this.effects.filter((o) => o.flags?.[game.system.id]?.encumbrance);

        // There should only be 1 encumbered effect, but with async loading we may have more
        // Use the first one, get rid of the rest
        for (let a = 1; a < prevActiveEffects.length; a++) {
            await prevActiveEffects[a].delete();
        }
        const prevActiveEffect = prevActiveEffects?.[0];
        if (dcvDex < 0 && prevActiveEffect?.flags?.[game.system.id]?.dcvDex != dcvDex) {
            let activeEffect = {
                name: name,
                id: "encumbered",
                img: `systems/${HEROSYS.module}/icons/encumbered.svg`,

                origin: this.uuid,
                flags: {
                    [game.system.id]: { dcvDex: dcvDex, encumbrance: true },
                },
            };
            const changes = [
                {
                    key: "system.characteristics.dcv.max",
                    value: dcvDex,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
                {
                    key: "system.characteristics.dex.max",
                    value: dcvDex,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
                {
                    key: "system.characteristics.running.max",
                    value: move,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
                {
                    key: "system.characteristics.swimming.max",
                    value: move,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
                {
                    key: "system.characteristics.leaping.max",
                    value: move,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
                {
                    key: "system.characteristics.flight.max",
                    value: move,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
                {
                    key: "system.characteristics.swinging.max",
                    value: move,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
                {
                    key: "system.characteristics.teleportation.max",
                    value: move,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
                {
                    key: "system.characteristics.tunneling.max",
                    value: move,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                },
            ];
            activeEffect = foundry.utils.mergeObject(activeEffect, {
                [HeroCompatibility.isV14 ? `system.changes` : `changes`]: changes,
            });

            if (prevActiveEffect) {
                //await prevActiveEffect.delete();
                await prevActiveEffect.update({
                    name: name,
                    [HeroCompatibility.isV14 ? `system.changes` : `changes`]:
                        activeEffect[HeroCompatibility.isV14 ? `system.changes` : `changes`],
                    origin: activeEffect.origin,
                    flags: activeEffect.flags,
                });
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }

            // If we have control of this token, re-acquire to update movement types
            const myToken = this.getActiveTokens()?.[0] || {};
            if (canvas.tokens.controlled.find((token) => token.id === myToken.id)) {
                myToken.release();
                myToken.control();
            }

            return;
        }

        if (dcvDex === 0 && prevActiveEffect) {
            await prevActiveEffect.delete();
        } else if (prevActiveEffect && prevActiveEffect.name !== name) {
            await prevActiveEffect.update({ name: name });
        }
        // else if (prevActiveEffect && prevActiveEffect.name != name) {
        //     await prevActiveEffect.update({ name: name });
        // }

        // At STR 0, halve the character’s Running,
        // Leaping, Swimming, Swinging, Tunneling, and
        // Flight based on muscle power (such as most types
        // of wings). The GM may require the character to
        // succeed with STR Rolls just to stand up, walk, and
        // perform similar mundane exertions.
        // At STR 0, halve the character’s DCV.
        // For every 2x mass a character has above the
        // standard human mass of 100 kg, the effects of STR
        // 0 on movement and DCV occur 5 points of STR
        // sooner.
        const massMultiplier = this.items
            .filter((item) => item.system.XMLID === "DENSITYINCREASE" && item.isActive)
            .reduce((accum, currItem) => accum + parseInt(currItem.system.LEVELS), 0);
        const minStr = massMultiplier * 5;

        const prevStr0ActiveEffect = this.effects.find((effect) => effect.flags?.[game.system.id]?.str0);
        if (strValue <= minStr && !prevStr0ActiveEffect) {
            const str0ActiveEffect = {
                name: "STR0",
                id: "STR0",
                img: `systems/${HEROSYS.module}/icons/encumbered.svg`,
                changes: [
                    {
                        key: "system.characteristics.dcv.max",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.running.max",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.leaping.max",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.swimming.max",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.swinging.max",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                    {
                        key: "system.characteristics.tunneling.max",
                        value: 0.5,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                    },
                ],
                origin: this.uuid,
                flags: {
                    [game.system.id]: {
                        str0: true,
                    },
                },
            };

            await this.createEmbeddedDocuments("ActiveEffect", [str0ActiveEffect]);
            // If we have control of this token, re-acquire to update movement types
            const myToken = this.getActiveTokens()?.[0] || {};
            if (canvas.tokens.controlled.find((token) => token.id === myToken.id)) {
                myToken.release();
                myToken.control();
            }
        } else {
            if (prevStr0ActiveEffect && strValue > minStr) {
                await prevStr0ActiveEffect.delete();
                // If we have control of this token, re-acquire to update movement types
                const myToken = this.getActiveTokens()?.[0] || {};
                if (canvas.tokens.controlled.find((token) => token.id === myToken.id)) {
                    myToken.release();
                    myToken.control();
                }
            }
        }
    }

    async fullHealth(options = {}) {
        const tDelta = 500;
        let start;
        let end;

        // Reset all items
        for (const item of this.items) {
            start = Date.now();
            await item.resetToOriginal();
            end = Date.now();
            if (end - start > tDelta) {
                console.warn(`fullHealth performance concern: ${item.name} resetToOriginal`, end - start);
            }
        }

        // Remove temporary effects
        if (!options.keepTemporaryEffects) {
            start = Date.now();
            const effectsObj = HeroSystem6eActorActiveEffects.statusEffectsObj;
            const effectIdsToDelete = [];

            // Only timed effects and status conditions: permanent effects (the durationless size
            // AE, GM-authored buffs) must survive a full heal. Statuses are checked explicitly
            // because V14's isTemporary is duration-only (V13's also counted statuses).
            for (const ae of this.effects) {
                if (ae.statuses.has(effectsObj.deadEffect.id) || ae.statuses.has(effectsObj.knockedOutEffect.id))
                    continue;
                if (!ae.isTemporary && ae.statuses.size === 0) continue;
                effectIdsToDelete.push(ae.id);
            }

            if (effectIdsToDelete.length > 0) {
                await this.deleteEmbeddedDocuments("ActiveEffect", effectIdsToDelete);
            }

            end = Date.now();
            if (end - start > tDelta) {
                console.warn("fullHealth performance concern: Remove temporary effects", end - start);
            }

            // Remove Maneuver/Martial effects
            start = Date.now();
            const maneuverEffectIds = this.appliedEffects
                .filter((ae) => ae.flags[game.system.id]?.type === "maneuverNextPhaseEffect")
                .map((ae) => ae.id);

            if (maneuverEffectIds.length > 0) {
                await this.deleteEmbeddedDocuments("ActiveEffect", maneuverEffectIds);
            }

            end = Date.now();
            if (end - start > tDelta) {
                console.warn("fullHealth performance concern: Remove Maneuver/Martial effects", end - start);
            }
        }

        // Set Characteristics MAX to CORE (or 5e calculated value)
        start = Date.now();
        const fullHealthMaxByCharacteristic = this._getFullHealthCharacteristicMaxes();
        const characteristicChangesMax = {};
        for (const [charKey, fullHealthMax] of Object.entries(fullHealthMaxByCharacteristic)) {
            if (this.system.characteristics[charKey].max !== fullHealthMax) {
                characteristicChangesMax[`system.characteristics.${charKey}.max`] = fullHealthMax;
            }
        }

        if (this._id && Object.keys(characteristicChangesMax).length > 0) {
            await this.update(characteristicChangesMax);
        } else if (!this._id && Object.keys(characteristicChangesMax).length > 0) {
            foundry.utils.mergeObject(this, characteristicChangesMax);
        }

        end = Date.now();
        if (end - start > tDelta) {
            console.warn("fullHealth performance concern: Set Characteristics MAX to CORE", end - start);
        }

        // Set Characteristics VALUE to MAX. Computed after the max update above so effects
        // (re)created during its _preUpdate (e.g. applySizeEffect) are included.
        start = Date.now();
        const fullHealthValues = this._getFullHealthCharacteristicValues(fullHealthMaxByCharacteristic);
        const characteristicChangesValue = {};
        for (const [charKey, value] of Object.entries(fullHealthValues)) {
            const characteristic = this.system.characteristics[charKey];
            if (characteristic.value !== value) {
                characteristic.value = value;
                characteristicChangesValue[`system.characteristics.${charKey}.value`] = value;
            }
        }

        if (this._id && Object.keys(characteristicChangesValue).length > 0) {
            await this.update(characteristicChangesValue);
        } else if (!this._id && Object.keys(characteristicChangesValue).length > 0) {
            foundry.utils.mergeObject(this, characteristicChangesValue);
        }

        end = Date.now();
        if (end - start > tDelta) {
            console.warn("fullHealth performance concern: Set Characteristics VALUE to MAX", end - start);
        }
    }

    /**
     * Formula/base-derived full-health max per characteristic in the actor's characteristic info
     * array; characteristics without a finite result are omitted.
     */
    _getFullHealthCharacteristicMaxes() {
        const maxes = {};
        for (const info of getCharacteristicInfoArrayForActor(this)) {
            const charKey = info.key.toLowerCase();
            const fullHealthMax = this._getFullHealthCharacteristicMax(info);
            if (Number.isFinite(fullHealthMax)) {
                maxes[charKey] = fullHealthMax;
            }
        }
        return maxes;
    }

    /**
     * Full-health value for every characteristic: the full-health max with non-status active
     * effects re-applied, so mid-session AID/DRAIN adjustments survive a full heal while status
     * overlays do not. Reads the actor's current effects, so call it after any update that
     * (re)creates effects (e.g. applySizeEffect via _preUpdate). Shared by fullHealth() and the
     * upload path so the two cannot drift.
     */
    _getFullHealthCharacteristicValues(fullHealthMaxByCharacteristic = this._getFullHealthCharacteristicMaxes()) {
        const maxChangesByKey = this._collectActiveEffectMaxChanges();
        const values = {};
        for (const charKey of Object.keys(this.system.characteristics)) {
            const baseMax = fullHealthMaxByCharacteristic[charKey] ?? this.system.characteristics[charKey].max;
            values[charKey] = parseInt(
                this._applyDirectActiveEffectChangesToDerivedMax(charKey, baseMax, {
                    includeStatusEffects: false,
                    maxChangesByKey,
                }),
            );
        }
        return values;
    }

    _getFullHealthCharacteristicMax(info) {
        const charKey = info.key.toLowerCase();
        const characteristic = this.system.characteristics?.[charKey];
        if (!characteristic) return null;

        const nativeKey = info.key.toUpperCase();
        const nativeLevels = Number(this.system?.[nativeKey]?.LEVELS ?? 0);

        if (this.is5e === true) {
            if (info.figured5eCharacteristic) {
                const rawValue = info.figured5eCharacteristic(this) + nativeLevels;
                return charKey === "spd" ? Math.floor(rawValue) : roundFavorPlayerAwayFromZero(rawValue);
            }

            if (info.calculated5eCharacteristic) {
                // Purchased LEVELS stack on the formula (bought LEAPING inches; always 0 for 5e CVs).
                return roundFavorPlayerAwayFromZero(info.calculated5eCharacteristic(this) + nativeLevels);
            }
        }

        const base = Number(info.base?.(this) ?? characteristic.base ?? 0);
        return base + nativeLevels;
    }

    async resetActor() {
        const xml = this.system._hdcXml;
        if (!xml) {
            throw new Error("Cannot reset actor without _hdcXml in system");
        } else if (this.token) {
            throw new Error("Cannot reset unlinked actor");
        }

        await this.uploadFromXml(xml, { keepExistingImage: true });
    }

    async rebuildActor() {
        const xml = this.system._hdcXml;
        if (!xml) {
            throw new Error("Cannot rebuild actor without _hdcXml in system");
        } else if (this.token) {
            throw new Error("Cannot rebuild unlinked actor");
        }

        await this.uploadFromXml(xml, { keepExistingImage: true, rebuild: true });
    }

    async restoreUnlinkedActorToMatchPrototype() {
        if (!this.token) {
            throw new Error("Cannot reset actor to match prototype without token");
        }

        // Restore characteristics to match baseActor
        await this.token.delta.restore();

        await ChatMessage.create({
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            author: game.user._id,
            speaker: ChatMessage.getSpeaker({ actor: this }),
            whisper: whisperUserTargetsForActor(this),
            content: `Restored to match prototype actor.`,
        });
    }

    // Raw base is insufficient for 5e characters
    getCharacteristicBase(key) {
        const powerInfo = getPowerInfo({ xmlid: key.toUpperCase(), actor: this, xmlTag: key.toUpperCase() });
        const base = powerInfo?.base(this) || 0;

        if (!this.system.is5e) return base;

        // TODO: Can this be combined with getCharacteristicInfoArrayForActor? See also actor-sheet.mjs changes
        const specialAutomatonPowers = this.getAutomatonSpecialPowers();
        const isAutomatonWithNoStun =
            specialAutomatonPowers.takesNoStunButLosesFunctionOnBody || specialAutomatonPowers.takesNoStun;

        const _str = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.str.max")?.value || 0),
                0,
            );
        const _con = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.con.max")?.value || 0),
                0,
            );
        const _dex = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.dex.max")?.value || 0),
                0,
            );
        const _body = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.body.max")?.value || 0),
                0,
            );
        const _ego = this.appliedEffects
            .filter(
                (o) =>
                    o.parent instanceof HeroSystem6eItem &&
                    !["DENSITYINCREASE", "GROWTH"].includes(o.parent.system.XMLID) &&
                    !o.parent.findModsByXmlid("NOFIGURED"),
            )
            .reduce(
                (partialSum, a) =>
                    partialSum +
                    parseInt(a.changes.find((o) => o.key === "system.characteristics.ego.max")?.value || 0),
                0,
            );

        // TODO: FIXME: This is, but should never be, called with this.system[characteristic] being undefined. Need to reorder the loading
        //        mechanism to ensure that we do something more similar to a load, transform, and extract pipeline so that we
        //        not invoked way too many times and way too early.
        const charBase = function (characteristicUpperCase) {
            const base =
                this.system[characteristicUpperCase]?.LEVELS +
                getPowerInfo({
                    xmlid: characteristicUpperCase,
                    actor: this,
                    xmlTag: characteristicUpperCase,
                })?.base(this);
            return base;
        };

        switch (key.toLowerCase()) {
            // Physical Defense (PD) STR/5, STR/5 and an extra /3 if the right type of automaton
            case "pd":
                return roundFavorPlayerAwayFromZero(
                    base + Math.round((charBase("STR") + _str) / 5) / (isAutomatonWithNoStun ? 3 : 1),
                );

            // Energy Defense (ED) CON/5, CON/5 and /3 if the right type of automaton
            case "ed":
                return roundFavorPlayerAwayFromZero(
                    base + Math.round((charBase("CON") + _con) / 5) / (isAutomatonWithNoStun ? 3 : 1),
                );

            // Speed (SPD) 1 + (DEX/10)   can be fractional
            case "spd":
                return base + 1 + parseFloat(parseFloat((charBase("DEX") + _dex) / 10).toFixed(1));

            // Recovery (REC) (STR/5) + (CON/5)
            case "rec":
                return base + Math.round((charBase("STR") + _str) / 5) + Math.round((charBase("CON") + _con) / 5);

            // Endurance (END) 2 x CON
            case "end":
                return base + Math.round((charBase("CON") + _con) * 2);

            // Stun (STUN) BODY+(STR/2)+(CON/2)
            case "stun":
                return (
                    base +
                    Math.round(charBase("BODY") + _body) +
                    Math.round((charBase("STR") + _str) / 2) +
                    Math.round((charBase("CON") + _con) / 2)
                );

            // Base OCV & DCV = Attacker’s DEX/3
            case "ocv":
            case "dcv":
                return Math.round((charBase("DEX") + _dex) / 3);

            //Base Ego Combat Value = EGO/3
            case "omcv":
            case "dmcv":
                return Math.round((charBase("EGO") + _ego) / 3);

            case "leaping": {
                const str = parseInt(charBase("STR") + _str);
                let value = 0;

                if (str >= 3) value = 0.5;
                if (str >= 5) value = 1;
                if (str >= 8) value = 1.5;
                if (str >= 10) value = 2;
                if (str >= 13) value = 2.5;
                if (str >= 15) value = 3;
                if (str >= 18) value = 3.5;
                if (str >= 20) value = 4;
                if (str >= 23) value = 4.5;
                if (str >= 25) value = 5;
                if (str >= 28) value = 5.5;
                if (str >= 30) value = 6;
                if (str >= 35) value = 7;
                if (str >= 40) value = 8;
                if (str >= 45) value = 9;
                if (str >= 50) value = 10;
                if (str >= 55) value = 11;
                if (str >= 60) value = 12;
                if (str >= 65) value = 13;
                if (str >= 70) value = 14;
                if (str >= 75) value = 15;
                if (str >= 80) value = 16;
                if (str >= 85) value = 17;
                if (str >= 90) value = 18;
                if (str >= 95) value = 19;
                if (str >= 100) value = 20 + Math.floor((str - 100) / 5);

                return value;
            }
        }

        return base;
    }

    hasCharacteristic(characteristic) {
        // If the actor has the baseInfo and it shouldn't be ignored for this actor type, we have the characteristic
        // otherwise we don't
        const doesNotHaveCharacteristic =
            this.system[characteristic.toUpperCase()]?.baseInfo?.ignoreForActor(this) ?? true;
        return !doesNotHaveCharacteristic;
    }

    getActiveConstantItems() {
        const results = [];
        for (const item of this.items.filter((item) => item.isActive)) {
            if (item.system.duration === CONFIG.HERO.DURATION_TYPES.CONSTANT) {
                results.push(item);
            } else {
                const NONPERSISTENT = item.modifiers.find((o) => o.XMLID === "NONPERSISTENT");
                if (NONPERSISTENT) {
                    results.push(item);
                }
            }
        }
        return results;
    }

    /*
        This isn't the same as actor.temporaryEffects (which does not include suppressed effects).
        It is subtle and identified as an issue with V14 where effect is suppressed instead of disabled/deleted
        when duration expires.
        This may require a CONFIG.ActiveEffect.expiryAction = "delete" fix at some point.
        NOTE: actorHasTemporaryEffects (herosystem6e.mjs) is a cheap non-empty check that must
        mirror this filter; keep them in sync.
    */
    getTemporaryEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => ae.isTemporary)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getConstantEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && ae.parent.system.duration === CONFIG.HERO.DURATION_TYPES.CONSTANT)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getPersistentEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && ae.parent.system.duration === CONFIG.HERO.DURATION_TYPES.PERSISTENT)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getInherentEffects() {
        return Array.from(this.allApplicableEffects())
            .filter((ae) => !ae.isTemporary && ae.parent.system.duration === CONFIG.HERO.DURATION_TYPES.INHERENT)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getMiscEffects() {
        return Array.from(this.allApplicableEffects())
            .filter(
                (ae) =>
                    !ae.isTemporary &&
                    ![
                        CONFIG.HERO.DURATION_TYPES.CONSTANT,
                        CONFIG.HERO.DURATION_TYPES.PERSISTENT,
                        CONFIG.HERO.DURATION_TYPES.INHERENT,
                    ].includes(ae.parent.system.duration),
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    async actorDescriptionToChat({ token }) {
        token ??= tokenEducatedGuess({ actor: this, token });
        let content = `${this.system.CHARACTER?.CHARACTER_INFO?.APPEARANCE || ""}`;
        const perceivable = [];
        for (let item of this.items.filter((item) => item.isActive || item.isActivatable() === false)) {
            const p = item.isPerceivable(false); // inobivous is not included
            if (p) {
                perceivable.push(
                    `<b${p === "maybe" ? ` style="color:blue" title="Inobvious requires PERCEPTION roll"` : ""}>${item.parentItem ? `${item.parentItem.name}: ` : ""}${item.name}</b> ${item.system.description}`,
                );
            }
        }
        if (perceivable.length > 0) {
            perceivable.sort();
            content += "<ul>";
            for (let p of perceivable) {
                content += `<li>${p}</li>`;
            }
            content += "</ul>";
        }

        const speaker = ChatMessage.getSpeaker({ actor: this, token });
        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: content,
            speaker: speaker,
        };
        return ChatMessage.create(chatData);
    }

    async presenceAttack({ token }) {
        return new PresenceAttackApplication({ actor: this, token }).render({ force: true });
    }

    async onCharacteristicSuccessRoll({ label, token }) {
        const charRoll = this.system.characteristics[label.toLowerCase()].roll;

        const heroRoller = new HeroRoller().makeSuccessRoll(true, charRoll, `Base ${label} roll`).addDice(3);

        const { flavor } = await doSuccessRoll(
            this,
            heroRoller,
            `${label.toUpperCase()} (${charRoll}-) characteristic roll`,
        );

        // PH: FIXME: Function doesn't consume resources
        const speaker = ChatMessage.getSpeaker({ actor: this, token });
        return generateSuccessChatCard(this, speaker, flavor, heroRoller, "");
    }

    async onCharacteristicFullRoll({ label, token }) {
        const characteristicValue = this.system.characteristics[label.toLocaleLowerCase()].value;
        const flavor = `Full ${label.toUpperCase()} Roll (${characteristicValue} ${label.toUpperCase()})`;
        await this.onCharacteristicRoll({ label, token, targetValue: characteristicValue, flavor });
    }

    async onCharacteristicCasualRoll({ label, token }) {
        const characteristicValue = this.system.characteristics[label.toLocaleLowerCase()].value;
        const halfCharacteristicValue = roundFavorPlayerAwayFromZero(
            +(Math.round(characteristicValue / 2 + "e+2") + "e-2"),
        ); //REF: https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary
        const flavor = `Casual ${label.toUpperCase()} Roll (${halfCharacteristicValue} ${label.toUpperCase()})`;
        await this.onCharacteristicRoll({ label, token, targetValue: halfCharacteristicValue, flavor });
    }

    async onCharacteristicRoll({ label, token, targetValue, flavor }) {
        const isStrengthRoll = label.toUpperCase() === "STR";
        // Strength use consumes resources. No other characteristic roll does.
        if (isStrengthRoll) {
            await this.onStrengthCharacteristicRoll({ label, token, targetValue, flavor });
        } else {
            await this._onPrimaryNonStrengthCharacteristicRoll({ label, token, targetValue, flavor });
        }
    }

    async onStrengthCharacteristicRoll({ token, targetValue, flavor }) {
        // STR should have an item for potential damage,
        // just like a strike and should consume resources
        const originalStrikeItem = this.items.find((o) => o.system.XMLID === "STRIKE");
        if (!originalStrikeItem) {
            return ui.notifications.error(`Unable to find STRIKE item for ${this.actor.name}. Cannot perform attack`);
        }

        // Create a temporary strike attack linked to a strength item.
        const { effectiveItem: effectiveAttackItem } = cloneToEffectiveAttackItem({
            originalItem: originalStrikeItem,
            effectiveRealCost: originalStrikeItem._realCost,
            pushedRealPoints: originalStrikeItem._realCost,
            effectiveStr: targetValue,
            effectiveStrPushedRealPoints: 0,
        });

        // Strength use consumes resources. No other characteristic roll does.
        const {
            error: resourceError,
            warning: resourceWarning,
            resourcesUsedDescription,
            resourcesUsedDescriptionRenderedRoll,
        } = await userInteractiveVerifyOptionallyPromptThenSpendResources(effectiveAttackItem, {});
        if (resourceError) {
            return ui.notifications.error(`${effectiveAttackItem.name} ${resourceError}`);
        } else if (resourceWarning) {
            return ui.notifications.warn(`${effectiveAttackItem.name} ${resourceWarning}`);
        }

        // NOTE: Characteristic rolls can't have +1 to their roll.
        const diceParts = characteristicValueToDiceParts(targetValue);
        const characteristicRoller = new HeroRoller()
            .makeNormalRoll()
            .addDice(diceParts.d6Count)
            .addHalfDice(diceParts.halfDieCount ? 1 : 0);

        await characteristicRoller.roll();
        const damageRenderedResult = await characteristicRoller.render();

        const action = Attack.buildActionInfo(effectiveAttackItem, [], { token });

        const cardData = {
            flavor,
            item: effectiveAttackItem,
            targetEntangle: "true",

            resourcesUsedDescription: resourcesUsedDescription
                ? `Spent ${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`
                : "",

            actor: this,

            renderedDamageRoll: damageRenderedResult,

            bodyDamage: characteristicRoller.getBodyTotal(),
            stunDamage: characteristicRoller.getStunTotal(),

            rollerJSON: characteristicRoller.toJSON(),

            itemJsonStr: dehydrateAttackItem(effectiveAttackItem),
            actionDataJSON: actionToJSON(action),

            user: game.user,
        };

        // render card
        const template = `systems/${HEROSYS.module}/templates/chat/item-damage-card.hbs`;
        const cardHtml = await foundryVttRenderTemplate(template, cardData);
        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });

        const chatData = {
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            rolls: characteristicRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    async _onPrimaryNonStrengthCharacteristicRoll({ token, targetValue, flavor }) {
        // NOTE: Characteristic rolls can't have +1 to their roll.
        const diceParts = characteristicValueToDiceParts(targetValue);
        const characteristicRoller = new HeroRoller()
            .makeBasicRoll()
            .addDice(diceParts.d6Count)
            .addHalfDice(diceParts.halfDieCount ? 1 : 0);

        await characteristicRoller.roll();

        const cardHtml = await characteristicRoller.render(flavor);

        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });

        const chatData = {
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            rolls: characteristicRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    async uploadFromXml(xml, options = {}) {
        // Is this a linked actor?  If so upload into parent.
        // if (this.uuid.includes("Scene")) {
        //     console.warn(`Tried to upload a linked actor, redirecting to parent actor`);
        //     await game.actors.get(this.id).uploadFromXml(xml, options);
        //     return;
        // }
        if (this.token) {
            ui.notifications.error(
                "Upload a linked actor is not supported. Use the prototype actor on the right sidebar.",
            );
            return;
        }

        // Captured before any mutation so an upload failure can report the actor's original state and the incoming HDC.
        const originalActorJson = this.id ? JSON.stringify(this.toObject()) : null;
        const incomingHdcXml = typeof xml === "string" ? xml : new XMLSerializer().serializeToString(xml);

        try {
            // Convert xml string to xml document (if necessary)
            if (typeof xml === "string") {
                const parser = new DOMParser();
                xml = parser.parseFromString(xml.trim(), "text/xml");
            }

            // Check for parser error
            if (xml.getElementsByTagName("parsererror")?.[0]) {
                console.error(xml.getElementsByTagName("parsererror")[0].innerText);
                ui.notifications.error(`Parser Error. Verify file is a valid HDC file`);
                return;
            }

            // Keep track of damage & charge uses, which we will apply at end of the upload
            const retainValuesOnUpload = {
                body:
                    parseInt(this.system.characteristics?.body?.max) -
                    parseInt(this.system.characteristics?.body?.value),
                stun:
                    parseInt(this.system.characteristics?.stun?.max) -
                    parseInt(this.system.characteristics?.stun?.value),
                end:
                    parseInt(this.system.characteristics?.end?.max) - parseInt(this.system.characteristics?.end?.value),
                hap: this.system.hap?.value,
                heroicIdentity: this.system.heroicIdentity ?? true,
                resources: this.items
                    .filter(
                        (item) =>
                            (item.system.chargeItemModifier &&
                                (item.system._charges !== item.system.chargesMax ||
                                    item.system._clips !== item.system.clipsMax)) ||
                            item.system.ablative > 0 ||
                            (item.system.XMLID === "ENDURANCERESERVE" && item.system.LEVELS !== item.system.value),
                    )
                    .map((o) => ({
                        id: o.id,
                        _charges: o.system._charges,
                        _clips: o.system._clips,
                        ablative: o.system.ablative,
                        value: o.system.value,
                    })),

                was5e: this.is5e,
            };

            const uploadPerformance = {
                startTime: new Date(),
                _d: new Date(),
            };

            // Convert XML into JSON
            const heroJson = {};
            HeroSystem6eActor._xmlToJsonNode(heroJson, xml.children);

            // Need count of maneuvers for progress bar (might be switching between 5/6e so an estimate)
            const powerListTentative = this.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
            const freeStuffFilter = (power) =>
                (!(power.behaviors.includes("adder") || power.behaviors.includes("modifier")) &&
                    power.type.includes("maneuver")) ||
                power.key === "PERCEPTION" || // Perception
                power.key === "__STRENGTHDAMAGE"; // Weapon placeholder (this is a dirty hack to count it so we can filter on it later)
            const freeStuffCount = powerListTentative.filter(freeStuffFilter).length;

            const root = heroJson.CHARACTER ?? heroJson.PREFAB; // Support loading a HDP as a HDC

            const xmlItemsToProcess =
                1 + // we process heroJson.CHARACTER.CHARACTERISTICS all at once so just track as 1 item.
                (root.DISADVANTAGES?.length || 0) +
                (root.EQUIPMENT?.length || 0) +
                (root.MARTIALARTS?.length || 0) +
                (root.PERKS?.length || 0) +
                (root.POWERS?.length || 0) +
                (root.SKILLS?.length || 0) +
                (root.TALENTS?.length || 0) +
                (this.type === "pc" || this.type === "npc" || this.type === "automaton" ? freeStuffCount : 0) + // Free stuff
                1 + // Validating adjustment and powers
                1 + // fullHealth
                1 + // VPP
                1 + // Images
                1 + // Final save
                1 + // Restore retained damage
                1 + // Custom adders link/assignment
                1 + // debugModelProps
                1; // Not really sure why we need an extra +1

            const uploadProgressBar = new HeroProgressBar(`${this.name}: Processing HDC file`, xmlItemsToProcess, {
                suppressUi: options.quenchUpload,
            });
            uploadPerformance.itemsToCreateEstimate = xmlItemsToProcess - 6;

            // Let GM know actor is being uploaded (unless it is a quench test; missing ID)
            if (!options.quenchUpload && this.id) {
                // Fire and forget
                ChatMessage.create({
                    style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                    author: game.user._id,
                    speaker: ChatMessage.getSpeaker({ actor: this }),
                    whisper: whisperUserTargetsForActor(this),
                    content: `<b>${game.user.name}</b> is uploading <b>${this.name}</b>`,
                });
            }

            let changes = {};

            // Character name is what's in the sheet or, if missing, what is already in the actor sheet.
            const characterName =
                root.CHARACTER_INFO.CHARACTER_NAME || options?.file?.name?.replace(/\.hdc$/i, "") || this.name;
            uploadPerformance.removeEffects = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();
            this.name = characterName;
            changes["name"] = characterName;
            uploadProgressBar.advance(`${characterName}: Name, fileInfo`, 0);

            // Flags (add them into the change set to cut down on update calls)
            changes[`flags.${game.system.id}.uploading`] = true;
            changes[`flags.${game.system.id}.file`] = {
                lastModifiedDate: options?.file?.lastModified,
                name: options?.file?.name,
                size: options?.file?.size,
                type: options?.file?.type,
                webkitRelativePath: options?.file?.webkitRelativePath,
                uploadedBy: game.user.name,
            };

            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            /// NOW LOAD THE HDC STUFF

            // Need to get the base64 image before we delete IMAGE, deepClone doesn't work as expected.
            uploadProgressBar.advance(`${this.name}: Preprocess image`, 0);
            const filename = root.IMAGE?.FileName;
            const extension = filename?.split(".").pop();
            const base64 = "data:image/" + extension + ";base64," + xml.getElementsByTagName("IMAGE")?.[0]?.textContent;

            // Keep raw XML data without IMAGE
            const xmlNoImage = foundry.utils.deepClone(xml);
            const image = xmlNoImage.getElementsByTagName("IMAGE")[0];
            image?.parentNode?.removeChild(image);
            this.system._hdcXml = new XMLSerializer().serializeToString(xmlNoImage);
            changes["system._hdcXml"] = this.system._hdcXml;

            // Heroic Action Points (always keep the value)
            changes["system.hap.value"] = retainValuesOnUpload.hap;

            // Heroic Identity
            changes["system.heroicIdentity"] = retainValuesOnUpload.heroicIdentity;

            // game system version
            this.system.versionHeroSystem6eUpload = game.system.version;
            changes["system.versionHeroSystem6eUpload"] = game.system.version;

            // is5e
            // keep track independently of item.system.is5e as targetType can reload it
            // Assume true for those super old HDC files
            uploadProgressBar.advance(`${this.name}: is5e`, 0);

            // let _is5e = true;

            // const template =
            //     heroJson.CHARACTER?.TEMPLATE?.extends ||
            //     heroJson.CHARACTER?.TEMPLATE ||
            //     heroJson.CHARACTER?.BASIC_CONFIGURATION?.TEMPLATE;

            // if (typeof template === "string") {
            //     if (template.includes("builtIn.") && !template.includes("6E.")) {
            //         // 5E
            //         _is5e = this.system.is5e = true;
            //     } else if (template.includes("builtIn.") && template.includes("6E.")) {
            //         // 6E
            //         _is5e = this.system.is5e = false;
            //     } else {
            //         console.error(`Unrecognized template ${template}`);
            //     }
            // }

            // // Update actor type
            // const targetType = template
            //     ?.match(/\.(ai|automaton|base|computer|heroic|normal|superheroic|vehicle|standardsuper)[56.]/i)?.[1]
            //     .toLowerCase()
            //     .replace("base", "base2")
            //     .replace("normal", "pc")
            //     .replace("superheroic", "pc")
            //     .replace("heroic", "pc")
            //     .replace("standardsuper", "pc"); // super old HDC

            if (this.id) {
                // Delete maneuvers (or any other existing items) that don't
                // match template prior to possibly changing is5e
                if (this.is5ePreview(root.TEMPLATE) !== this.system.is5e) {
                    const itemsToDeleteIs5e = this.items
                        .filter((i) => i.system.is5e !== this.is5ePreview(root.TEMPLATE))
                        .map((m) => m.id);
                    if (itemsToDeleteIs5e.length > 0) {
                        console.warn(`Deleting ${itemsToDeleteIs5e.length} is5e mismatches`);
                        await this.deleteEmbeddedDocuments("Item", itemsToDeleteIs5e, {
                            render: false,
                        });
                    }
                }

                // We can't delay this with the changes array because any items based on this actor needs this value.
                // Specifically compound power is a problem if we don't set is5e properly for a 5e actor.
                await this.update(
                    {
                        ...changes,
                        "system.is5e": this.is5ePreview(root.TEMPLATE),
                        "system.CHARACTER.BASIC_CONFIGURATION": root.BASIC_CONFIGURATION,
                        "system.CHARACTER.CHARACTER_INFO": root.CHARACTER_INFO,
                        "system.CHARACTER.TEMPLATE": root.TEMPLATE,
                        "system.CHARACTER.version": root.version,
                    },
                    {
                        render: true, // Need render to make sure the actor sidebar actor.name gets updated #4010
                    },
                );
                changes = {};

                if (this.is5e !== this.system.is5e) {
                    if (this.name.startsWith("_Quench")) {
                        console.error(`${this.name} is5e mismatch`);
                    }

                    // Finally update is5e
                    await this.update({ "system.is5e": this.is5e }, { render: false });
                }

                const targetType = this._templateType
                    .replace("builtIn.", "")
                    .replace("6E", "")
                    .replace(".hdt", "")
                    .toLowerCase()
                    .replace("base", "base2")
                    .replace("normal", "pc")
                    .replace("superheroic", "pc")
                    .replace("heroic", "pc")
                    .replace("standardsuper", "pc") // super old HDC
                    .replace("main", "pc") // custom template
                    .replace("competentpc", "pc"); // super old HDC

                if (targetType && this.type.replace("npc", "pc") !== targetType) {
                    if (Object.keys(game.system.documentTypes.Actor).includes(targetType)) {
                        if (HeroCompatibility.isV14) {
                            // REF: https://github.com/foundryvtt/foundryvtt/issues/13090
                            // AARON WAS HERE on 4/4/2026: Update fails, likely a foundry bug.
                            // Error: The type of a Document may only be changed if the system field
                            //        is also updated with a ForcedReplacement operator.
                            // A subsequent upload works, not ready for publish.
                            await this.update(
                                {
                                    type: targetType,
                                    system: foundry.utils.mergeObject(this.system.toObject(), { _type: targetType }),
                                },
                                { recursive: false },
                            );
                        } else {
                            await this.update(
                                {
                                    type: targetType,
                                    system: foundry.utils.mergeObject(this.system.toObject(), { _type: targetType }),
                                },
                                { recursive: false },
                            );
                        }
                    } else {
                        ui.notifications.error(`${targetType} is not a valid actor type`);
                    }
                }
            }

            // CHARACTERISTICS
            if (root?.CHARACTERISTICS) {
                const changesNormal = {};
                const changesFiguredOrCalculated = {};
                uploadProgressBar.advance(`${this.name}: CHARACTERISTICS`, 0);

                // Legacy (well current)
                for (const [key, value] of Object.entries(root.CHARACTERISTICS)) {
                    const _baseInfo = getPowerInfo({ XMLID: key, actor: this, xmlTag: key });

                    this.system[key] = new HeroItemCharacteristic(value, { parent: this });

                    if (_baseInfo?.behaviors.includes("calculated") || _baseInfo?.behaviors.includes("figured")) {
                        changesFiguredOrCalculated[`system.${key}`] = this.system[key];
                    } else {
                        changesNormal[`system.${key}`] = this.system[key];
                    }
                }
                delete root.CHARACTERISTICS;

                if (this.id) {
                    // Update normal values first
                    await this.update(changesNormal);

                    // Then any figured or calculated characteristics
                    await this.update(changesFiguredOrCalculated);
                }
            }

            if (options.rebuild) {
                uploadProgressBar.advance(`${this.name}: Deleting existing items when rebuilding`, 0);
                try {
                    const turnOffPromises = [];
                    for (const item of this.items.filter((item) => item.isActivatable())) {
                        turnOffPromises.push(item.turnOff({ silent: true }));
                    }
                    await Promise.all(turnOffPromises);
                } catch (error) {
                    console.error(`Error occurred while turning off existing items: ${error.message}`);
                }
                await this.deleteEmbeddedDocuments(
                    "Item",
                    this.items.map((o) => o.id),
                );
            }

            // NOTE don't put this into the promiseArray because we create things in here that are absolutely required by later items (e.g. strength placeholder).
            // if (this.type === "pc" || this.type === "npc" || this.type === "automaton") {
            uploadProgressBar.advance(`${this.name}: addFreeStuff`, 0);

            await this.addFreeStuff();

            uploadProgressBar.advance(`${this.name}: addFreeStuff completed`, 0);
            //}

            uploadPerformance.progressBarFreeStuff - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            // ITEMS
            uploadProgressBar.advance(`${this.name}: Evaluating items`, 0);

            let itemsToCreate = HeroSystem6eItem.parseItemsFromHeroJsonToItemDataArray(heroJson, this);

            uploadProgressBar.advance(`${this.name}: Evaluated Items`, 0);

            uploadProgressBar.advance(`${this.name}: Updating Items`, 0);

            // Working on a merge to update previously existing items.
            // Add existing item.id (if it exists), which we will use for the pending update.
            // There may be an item that was converted to equipment/power
            // Also note that system.ID is natively a string from HDC, which we coerce into INT so use == instead of ===
            itemsToCreate = itemsToCreate.map((m) =>
                foundry.utils.mergeObject(m, {
                    _id: this.items.find((i) => i.system.ID == m.system.ID)?.id,
                }),
            );
            const itemsToUpdate = itemsToCreate.filter((o) => o._id);
            itemsToCreate = itemsToCreate.filter((o) => !o._id);

            // Make sure itemsToUpdate have ADDER/MODIFIER/POWER array
            // Which allows a new HDC to remove ADDER during update, without it will never clear
            for (const itemToUpdate of itemsToUpdate) {
                itemToUpdate.system.ADDER ??= [];
                itemToUpdate.system.MODIFIER ??= [];
                itemToUpdate.system.POWER ??= [];
            }

            // If item.type is different then:
            // The type of a Document can be changed only if the system field
            // is force-replaced (==) or updated with {recursive: false}
            for (const item of itemsToUpdate) {
                const itemExisting = this.items.find((o) => o.id === item._id);
                if (itemExisting?.type !== item.type) {
                    await ui.notifications.warn(
                        `${item.name} changed from type=${itemExisting.type} to type=${item.type}`,
                    );

                    try {
                        const systemData =
                            typeof item.system?.toObject === "function" ? item.system.toObject() : item.system;
                        await itemExisting.update(
                            {
                                type: item.type,
                                system: foundry.utils.mergeObject(systemData, { _type: item.type }),
                            },
                            { recursive: false },
                        );
                    } catch (e) {
                        console.error(e);
                        ui.notifications.error(
                            `Failed to change ${item.name} from type=${itemExisting.type} to type=${item.type}`,
                        );
                    }
                }
            }

            // If a skill was previously marked as EVERYMAN, but now isn't we
            // need to remove the EVERYMAN value as for some reason HDC doesn't
            // specifically include EVERYMAN="No".  Seems like a HD bug.
            for (const item of itemsToUpdate.filter((item) => !item.system.EVERYMAN)) {
                const itemExisting = this.items.find((o) => o.id === item._id);
                if (itemExisting.system.EVERYMAN) {
                    // HDC didn't reference EVERYMAN
                    // so we will specify it as null (false)
                    // so the update below will set the expected value
                    console.warn(`Adding EVERYMAN to ${item.name} skill`);
                    item.system.EVERYMAN = null;
                }
            }

            // If a TEXT was previously defined, but now isn't we
            // need to remove it as for some reason HDC doesn't
            // specifically include it.
            for (const item of itemsToUpdate.filter((item) => !item.system.TEXT)) {
                const itemExisting = this.items.find((o) => o.id === item._id);
                if (itemExisting.system.TEXT) {
                    console.warn(`Adding TEXT to ${item.name}/${item.system.XMLID}`);
                    item.system.TEXT = "";
                }
            }

            // If it was a childItem and now isn't
            // need to remove PARENTID as HDC doesn't
            // specifically include it.
            for (const item of itemsToUpdate.filter((item) => !item.system.PARENTID)) {
                const itemExisting = this.items.find((o) => o.id === item._id);
                if (itemExisting.system.PARENTID) {
                    item.system.PARENTID = null;
                }
            }

            // update existing document, overwriting any MODIFIERS, etc
            await this.updateEmbeddedDocuments("Item", itemsToUpdate);

            uploadProgressBar.advance(`${this.name}: Updated Items`, itemsToUpdate.length);

            uploadProgressBar.advance(`${this.name}: Creating Items`, 0);

            uploadPerformance.itemsToCreateActual = itemsToCreate.length;

            uploadPerformance.preItems = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();
            if (this.id) {
                await this.createEmbeddedDocuments("Item", itemsToCreate, { render: false, renderSheet: false });
            } else {
                // Temporary actor: createEmbeddedDocuments would silently create world items.
                for (const itemData of itemsToCreate) {
                    const item = new HeroSystem6eItem(itemData, { parent: this });
                    this.items.set(item.system.ID?.toString() || item.system.XMLID, item);
                }
            }

            uploadPerformance.createItems = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();
            uploadProgressBar.advance(`${this.name}: Created Items`, itemsToCreate.length);

            uploadProgressBar.advance(`${this.name}: Processing non characteristics`, 0);
            const doLastXmlids = ["COMBAT_LEVELS", "MENTAL_COMBAT_LEVELS", "MENTALDEFENSE"];

            uploadProgressBar.advance(`${this.name}: applyActiveEffects`, 0);
            for (const item of this.items) {
                await item.setActiveEffects({ render: false });
            }

            uploadProgressBar.advance(`${this.name}: applySizeEffect`, 0);
            await this.applySizeEffect();

            uploadProgressBar.advance(`${this.name}: Processing ${doLastXmlids.length} doLastXmlids`, 0);
            await Promise.all(
                this.items.filter(
                    (item) =>
                        doLastXmlids.includes(item.system.XMLID) && !item.baseInfo?.type.includes("characteristic"),
                ),
            );

            // VPP Slots
            uploadProgressBar.advance(`${this.name}: VPP Slots auto selection`, 0);
            for (const vppItem of this.items.filter((i) => i.system.XMLID === "VPP")) {
                // If no vppSlots then pick defaults (currently always defaults)
                if (!vppItem.childItems.find((i) => i.system.CARRIED)) {
                    let vppSlottedCost = 0;
                    const vppChanges = [];
                    for (const slotItem of vppItem.childItems) {
                        if (vppSlottedCost + slotItem.realCost <= vppItem.vppPoolPoints) {
                            vppChanges.push({ _id: slotItem.id, "system.CARRIED": true });
                            vppSlottedCost += slotItem.realCost;
                        } else {
                            vppChanges.push({ _id: slotItem.id, "system.CARRIED": false });
                        }
                    }
                    await this.updateEmbeddedDocuments("Item", vppChanges);
                }
            }
            uploadProgressBar.advance(`${this.name}: VPP iSlots auto selection complete`, 1);

            // Make sure any powers with characteristic properties
            // reflect in current VALUE.
            // But we want to keep temporary effects (drains, aids, etc)
            // so players can upload new HDC files without wiping out mid session AE's.
            // Similar to retained data, were retaining (by not deleting) the temporary effects.
            uploadProgressBar.advance(`${this.name}: Full Health`, 0);
            await this.fullHealth({ keepTemporaryEffects: true });

            // Kluge to ensure characteristic values match max
            try {
                if (this.id) {
                    const changes = {};
                    for (const [key, value] of Object.entries(this._getFullHealthCharacteristicValues())) {
                        if (this.system.characteristics[key].value !== value) {
                            changes[`system.characteristics.${key}.value`] = value;
                        }
                    }
                    if (Object.keys(changes).length > 0) {
                        await this.update(changes);
                    }
                }
            } catch (e) {
                console.error(e);
            }
            uploadProgressBar.advance(`${this.name}: Full Health complete`, 1);

            // retainValuesOnUpload Charges
            uploadProgressBar.advance(`${this.name}: retainValuesOnUpload charges and ablative`, 0);
            for (const resourceData of retainValuesOnUpload.resources) {
                // Careful: the HDC ID is intially a string, but coerced to Number in dataModel thus ==
                const item = this.items.find((i) => i.id === resourceData.id);
                if (item) {
                    // Notice if charges or clips is lower than before we take the min #3302
                    await item.update({
                        "system._charges": Math.min(item.system.chargesMax, resourceData._charges),
                        "system._clips": Math.min(item.system.clipsMax, resourceData._clips),
                        "system.ablative": Math.max(item.system.ablative, resourceData.ablative),
                    });
                    if (item.system.XMLID === "ENDURANCERESERVE") {
                        await item.update({ "system.value": Math.min(item.system.value, resourceData.value) });
                    }
                } else {
                    console.warn(
                        `Unable to locate ${resourceData.NAME}/${resourceData.ALIAS} to consume charges after upload.`,
                    );
                }
            }
            uploadPerformance.postUpload = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Validating powers`);

            // Validate everything that's been imported
            this.items.forEach(async (item) => {
                const power = item.baseInfo;

                // Power needs to exist
                if (!power) {
                    await ui.notifications.error(
                        `${this.name}/${item.detailedName()} has unknown power XMLID. Please report.`,
                        { console: true, permanent: true },
                    );
                } else if (!power.behaviors) {
                    await ui.notifications.error(
                        `${this.name}/${item.detailedName()} does not have behaviors defined. Please report.`,
                        { console: true, permanent: true },
                    );
                }
            });

            uploadPerformance.validate = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Processed non characteristics`, 0);
            uploadProgressBar.advance(`${this.name}: Processed all items`, 0);

            uploadPerformance.invalidTargets = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Uploading image`, 0);

            // Images
            if (this.img.startsWith("tokenizer/") && game.modules.get("vtta-tokenizer")?.active) {
                await ui.notifications.warn(
                    `Skipping image upload, because this token (${this.name}) appears to be using tokenizer.`,
                );
            } else if (root.IMAGE) {
                //const filename = heroJson.CHARACTER.IMAGE?.FileName;
                const path = "worlds/" + game.world.id + "/tokens";
                let relativePathName = path + "/" + filename;

                // Create a directory if it doesn't already exist
                try {
                    await FoundryVttFilePicker.createDirectory("user", path);
                } catch (error) {
                    console.debug("create directory error", error);
                }

                // Set the image, uploading if not already in the file system
                try {
                    const imageFileExists = (await FoundryVttFilePicker.browse("user", path)).files.includes(
                        encodeURI(relativePathName),
                    );
                    if (!imageFileExists) {
                        //const extension = filename.split(".").pop();
                        //const base64 =
                        //"data:image/" + extension + ";base64," + xml.getElementsByTagName("IMAGE")[0].textContent;

                        await ImageHelper.uploadBase64(base64, filename, path);

                        // FORGE stuff (because users add things into their own directories)
                        if (typeof ForgeAPI !== "undefined") {
                            const forgeUser = (await ForgeAPI.status()).user;
                            relativePathName = `https://assets.forge-vtt.com/${forgeUser}/${relativePathName}`;
                        }
                    }

                    changes["img"] = relativePathName;

                    // Update any tokens images that might exist
                    for (const token of this.getActiveTokens()) {
                        await token.document.update({
                            "texture.src": relativePathName,
                        });
                    }
                } catch (e) {
                    console.error(e);
                    ui.notifications.warn(
                        `${this.name} failed to upload ${filename}. Make sure user has [Use File Browser] and [Upload New Files] permissions. Also make sure the folder isn't in [Privacy Mode] indicated with a purple background within FoundryVTT.`,
                    );
                }

                delete root.IMAGE;
            } else {
                // No image provided. Make sure we're using the default token.
                // Note we are overwriting any image that may have been there previously.
                // If they really want the image to stay, they should put it in the HDC file.
                // Prompt before overwriting token image #2831

                if (this.img !== CONST.DEFAULT_TOKEN && !options.keepExistingImage) {
                    new foundry.applications.api.DialogV2({
                        window: { title: "Choose token image" },
                        content: `
                    <p>This HDC file does not include an image.</p>
                    <p>Do you want to keep the existing token image or clear the image (${CONST.DEFAULT_TOKEN})?</p>`,
                        buttons: [
                            {
                                action: "keepImage",
                                label: "Keep Existing Image",
                                default: true,
                            },
                            {
                                action: "defaultImage",
                                label: "Clear",
                                callback: async () => {
                                    await this.update({ ["img"]: CONST.DEFAULT_TOKEN });
                                    // Update any tokens images that might exist
                                    for (const token of this.getActiveTokens()) {
                                        await token.document.update({
                                            "texture.src": CONST.DEFAULT_TOKEN,
                                        });
                                    }
                                },
                            },
                        ],
                        submit: (result) => {
                            console.log(`User picked option: ${result}`);
                        },
                    }).render({ force: true });
                }
            }

            uploadPerformance.image = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Uploaded image`);
            uploadProgressBar.advance(`${this.name}: Saving core changes`, 0);

            // Non ITEMS stuff in CHARACTER (with data model this becomes less important)
            changes = {
                ...changes,
                "system.CHARACTER": root,
                "system.versionHeroSystem6eUpload": game.system.version,
            };

            if (this.prototypeToken) {
                changes[`prototypeToken.name`] = this.name;
                changes[`prototypeToken.img`] = changes.img;
            }

            // Save all our changes (unless temporary actor/quench)
            if (this.id) {
                await this.update(changes);
            }

            uploadPerformance.nonItems = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            // Ghosts fly (or anything with RUNNING=0 and FLIGHT)
            if (this.system.characteristics?.running?.value === 0 && this.system.characteristics?.running?.base === 0) {
                for (const flight of this.items.filter((i) => i.system.XMLID === "FLIGHT")) {
                    await flight.toggle();
                }
            }

            uploadPerformance.actorPostUpload = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            // Kluge to ensure everything has a SPD.
            // For example a BASE has an implied SPD of three
            this.system.characteristics.spd ??= {
                core: 3,
            };

            uploadPerformance.postUpload2 = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.advance(`${this.name}: Saved core changes`);
            uploadProgressBar.advance(`${this.name}: Restoring retained damage`, 0);

            // Apply retained damage
            if (this.id && !options.rebuild) {
                for (const key of ["body", "stun", "end"]) {
                    if (!this.hasCharacteristic(key.toUpperCase())) continue;
                    if (retainValuesOnUpload[key] == undefined) continue;
                    if (this.system.characteristics[key] == undefined) continue;

                    this.system.characteristics[key].value -= retainValuesOnUpload[key];
                    await this.update(
                        {
                            [`system.characteristics.${key}.value`]: this.system.characteristics[key].value,
                        },
                        { render: false },
                    );
                }
            }
            uploadProgressBar.advance(`${this.name}: Restored retained damage`, 0);

            uploadProgressBar.advance(`${this.name}: Linking Custom Adders`, 0);
            await this.linkCustomAddersForUpload();
            uploadProgressBar.advance(`${this.name}: Linked Custom Adders`, 1);

            if (this.id) {
                await this.setFlag(game.system.id, "uploading", false);
                await this.setFlag(game.system.id, "uploadingError", null);
                await this.setFlag(game.system.id, "uploadingErrorContext", null);
            }
            uploadPerformance.retainedDamage = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            // If we have control of this token, reacquire to update movement types
            const myToken = this.getActiveTokens()?.[0];
            if (canvas.tokens.controlled.find((t) => t.id == myToken?.id)) {
                myToken.release();
                myToken.control();
            }
            uploadPerformance.tokenControl = new Date().getTime() - uploadPerformance._d;
            uploadPerformance._d = new Date().getTime();

            uploadProgressBar.close(`Uploaded ${this.name}`);

            // report performance concerns
            const performanceConcerns = uploadProgressBar._performance
                .filter((o) => o.delta > 500)
                .sort((a, b) => b.delta - a.delta);
            for (const concern of performanceConcerns) {
                console.warn(`uploadFromXml performance concern: ${concern.message} ${concern.delta}s`, concern);
            }

            uploadPerformance.totalTime = new Date().getTime() - uploadPerformance.startTime;

            //console.log("Upload Performance", uploadPerformance);

            // Let GM know actor was uploaded (unless it is a quench test or missing ID)
            if (!options.quenchUpload && this.id) {
                // Fire and forget
                ChatMessage.create({
                    style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                    author: game.user._id,
                    speaker: ChatMessage.getSpeaker({ actor: this }),
                    whisper: whisperUserTargetsForActor(this),
                    content: `Took ${Math.ceil(uploadPerformance.totalTime / 1000)} seconds for <b>${game.user.name}</b> to upload <b>${this.name}</b>.`,
                });
            }

            // Delete any old items that weren't updated, added or part of freeStuff
            if (this.id) {
                // Careful: the HDC ID is initially a string, but coerced to Number in dataModel thus ==
                const itemsToDelete = this.items.filter(
                    (item) =>
                        !itemsToUpdate.find((o) => item.id === o._id) &&
                        !itemsToCreate.find((p) => item.system.ID == p.system.ID) &&
                        !item.isCombatManeuver &&
                        !item.baseInfo.behaviors?.includes("non-hd"),
                );
                if (itemsToDelete.length > 0) {
                    const unorderedList =
                        `<div style="max-height:200px;overflow-y:scroll"><ul>` +
                        itemsToDelete
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((m) => `<li title='${m.system.description}'>${m.type.toUpperCase()}: ${m.name}</li>`)
                            .join("") +
                        `</ul></div>`;
                    const content = `The following items were not included in the HDC file. Do you want to delete them? ${unorderedList}`;
                    const confirmDeleteExtraItems = await foundry.applications.api.DialogV2.confirm({
                        window: { title: `${this.name}: Delete extra items?` },
                        content: content,
                    });

                    if (confirmDeleteExtraItems) {
                        console.log(
                            `Deleting ${itemsToDelete.length} items because they were not present in the HDC file.`,
                        );
                        // Toggle them off first as sometimes deleteing items with AE's don'e run the cleanup code.
                        // FoundryVTT 13 bug?
                        const turnOffPromises = [];
                        for (const item of itemsToDelete) {
                            turnOffPromises.push(item.turnOff({ silent: true }));
                        }
                        await Promise.all(turnOffPromises);
                        await this.deleteEmbeddedDocuments(
                            "Item",
                            itemsToDelete.map((o) => o.id),
                        );
                    } else {
                        // Fire and forget (no await on this ChatMessage)
                        ChatMessage.create({
                            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                            author: game.user._id,
                            speaker: ChatMessage.getSpeaker({ actor: this }),
                            content: `<b>${this.name}</b> kept a few items that were not in the HDC upload: ${unorderedList}`,
                            whisper: whisperUserTargetsForActor(this),
                        });
                    }
                }
            }

            // DataModel check
            uploadProgressBar.advance(`${this.name}: Processing debugModelProps`, 0);
            let dataModelErrorCount = 0;
            for (const item of this.items) {
                const e = item.system.debugModelProps();
                if (e) {
                    if (dataModelErrorCount++ === 0) {
                        ui.notifications.error(`${this.name}. ${e}<br>Please report`, { permanent: true });
                    } else {
                        // the console.error inside debugModelProps will log the rest
                    }
                }
            }
            uploadProgressBar.advance(`${this.name}: Processed debugModelProps`, 1);
        } catch (e) {
            console.error(e);
            ui.notifications.error(`${this.name} had errors during upload.`);
            //uploadProgressBar.close(`Upload Failed ${this.name}`);
            if (this.id) {
                await this.setFlag(
                    game.system.id,
                    "uploadingError",
                    e.stack.replace(/http(s)?:[/[a-z0-9_.-:()]+\//gi, ""),
                );

                // Diagnostic context for bug reports. base64 encode blobs so they survive copy/paste intact.
                await this.setFlag(game.system.id, "uploadingErrorContext", {
                    foundry: game.release?.display || game.version,
                    foundryBuild: game.release?.build ?? null,
                    system: game.system.version,
                    actorBase64: originalActorJson ? utf8ToBase64(originalActorJson) : null,
                    hdcBase64: incomingHdcXml ? utf8ToBase64(incomingHdcXml) : null,
                });

                // Make sure we show the error we just posted to DB.
                // Needed for when the delete extra items has an error.
                await this.setFlag(game.system.id, "uploading", true);
            }
        }
    }

    /**
     * Rebuild the actor captured in an upload-error report's `actorBase64`.
     * Returns a transient (unsaved) actor for inspection by default; pass { create: true } to persist it to the world.
     *
     * @param {string} actorBase64 - The base64 actor state from the error report.
     * @param {object} [options]
     * @param {boolean} [options.create=false] - Persist the rebuilt actor to the world instead of returning a transient one.
     * @returns {Promise<HeroSystem6eActor>|HeroSystem6eActor}
     */
    static recreateActorFromBase64(actorBase64, { create = false } = {}) {
        const data = JSON.parse(base64ToUtf8(actorBase64));
        return create ? HeroSystem6eActor.create(data) : new HeroSystem6eActor(data);
    }

    /**
     * Decode the HDC captured in an upload-error report's `hdcBase64`.
     * Returns the HDC XML string, or a parsed XMLDocument when { parse: true } (throws on a parser error).
     *
     * The class is module-scoped; from the console reach it via `game.herosystem6e.entities.HeroSystem6eActor`
     * (or `CONFIG.Actor.documentClass`). Re-run the upload to reproduce, e.g.:
     *   actor.uploadFromXml(game.herosystem6e.entities.HeroSystem6eActor.loadHdcFromBase64(hdcBase64))
     *
     * @param {string} hdcBase64 - The base64 HDC from the error report.
     * @param {object} [options]
     * @param {boolean} [options.parse=false] - Return a validated XMLDocument instead of the raw string.
     * @returns {string|XMLDocument}
     */
    static loadHdcFromBase64(hdcBase64, { parse = false } = {}) {
        const xml = base64ToUtf8(hdcBase64);
        if (!parse) return xml;

        const doc = new DOMParser().parseFromString(xml.trim(), "text/xml");
        const parserError = doc.getElementsByTagName("parsererror")?.[0];
        if (parserError) {
            throw new Error(`HDC failed to parse: ${parserError.textContent}`);
        }
        return doc;
    }

    async linkCustomAddersForUpload() {
        // CSLs
        const cslInitializationUpdates = [];
        for (const csl of this.allCslSkills) {
            const cslChangesToLink = csl.linkBasedOnCustomAdders(csl.system._source.ADDER, this.cslItems);
            if (csl._id != null) {
                cslChangesToLink._id = csl._id;
                cslInitializationUpdates.push(cslChangesToLink);
            } else {
                foundry.utils.mergeObject(csl, cslChangesToLink);
            }
        }
        if (cslInitializationUpdates.length > 0) {
            await Item.implementation.updateDocuments(cslInitializationUpdates, { parent: this });
        }

        // PSLs
        const pslInitializationUpdates = [];
        for (const psl of this.allPslSkills) {
            const pslChangesToLink = psl.linkBasedOnCustomAdders(psl.system._source.ADDER, this.pslItems);
            if (psl._id != null) {
                pslChangesToLink._id = psl._id;
                pslInitializationUpdates.push(pslChangesToLink);
            } else {
                foundry.utils.mergeObject(psl, pslChangesToLink);
            }
        }
        if (pslInitializationUpdates.length > 0) {
            await Item.implementation.updateDocuments(pslInitializationUpdates, { parent: this });
        }
    }

    /**
     * Characters get a few things for free that are not in the HDC.
     *
     * @returns
     */
    async addFreeStuff() {
        // If we have no INT then delete PERCEPTION
        const itemToDelete = [];
        const hasINT = this.hasCharacteristic("INT");
        if (!hasINT && this.items.find((item) => item.system.XMLID === "PERCEPTION")) {
            itemToDelete.push(...this.items.filter((item) => item.system.XMLID === "PERCEPTION"));
            console.warn(`Deleting PERCEPTION because ${this.name} has no INT`);
        }

        // If we have no STR then delete COMBAT MANEUVERS
        const hasSTR = this.hasCharacteristic("STR");
        if (!hasSTR & this.items.find((item) => item.isCombatManeuver)) {
            console.warn(`Deleting COMBAT MANEUVERS because ${this.name} has no STR`);
            itemToDelete.push(...this.items.filter((item) => item.isCombatManeuver));
        }

        if (itemToDelete.length > 0) {
            await this.deleteEmbeddedDocuments(
                "Item",
                itemToDelete.map((m) => m.id),
            );
        }

        // Remove any is5e FreeStuff mis-matches (happens when you upload 5e over 6e actor, or vice versa)
        const mismatchItems = this.items.filter(
            (item) => item.isFreeStuff && (item.system.is5e !== this.system.is5e || !item.baseInfo),
        );

        if (mismatchItems.length > 0) {
            console.warn(`Deleting ${mismatchItems.length} item because is5e doesn't match actor`, mismatchItems);
            await this.deleteEmbeddedDocuments(
                "Item",
                mismatchItems.map((m) => m.id),
            );
        }

        if (hasINT) {
            await this.addPerception();
        }

        await this.addUntrainedSkill();

        if (hasSTR) {
            await this.addHeroSystemManeuvers();
        }
    }

    async addUntrainedSkill() {
        const untrainedItems = this.items.filter(
            (item) => item.system.XMLID === "UNTRAINED" && item.type === "skill" && !item.system.ID,
        );

        if (untrainedItems.length > 0) {
            console.debug(`UNTRAINED already exists`);

            // Make sure we only have one
            const itemsToDelete = untrainedItems.splice(1);

            if (itemsToDelete.length > 0) {
                console.error(`Deleted ${itemsToDelete.length} UNTRAINED items`);
                await this.deleteEmbeddedDocuments(
                    "Item",
                    itemsToDelete.map((o) => o.id),
                );
            }

            return;
        }

        // Untrained Skill
        const itemDataUntrained = {
            name: "Untrained",
            type: "skill",
            system: {
                XMLID: "UNTRAINED",
                ALIAS: "Untrained",
                CHARACTERISTIC: "GENERAL",
                state: "untrained",
                LEVELS: "0",
                is5e: this.is5e,
                xmlTag: "SKILL",
                active: true,
            },
        };
        const untrainedItem = this.id
            ? await HeroSystem6eItem.create(itemDataUntrained, {
                  parent: this,
              })
            : new HeroSystem6eItem(itemDataUntrained, {
                  parent: this,
              });

        if (!this.id) {
            this.items.set(untrainedItem.system.XMLID, untrainedItem);
        }
    }

    async addPerception() {
        const perceptionItems = this.items.filter(
            (item) => item.system.XMLID === "PERCEPTION" && item.type === "skill" && !item.system.ID,
        );

        if (perceptionItems.length > 0) {
            console.debug(`PERCEPTION already exists`);

            // Make sure we only have one
            const itemsToDelete = perceptionItems.splice(1);

            if (itemsToDelete.length > 0) {
                console.error(`Deleted ${itemsToDelete.length} PERCEPTION items`);
                await this.deleteEmbeddedDocuments(
                    "Item",
                    itemsToDelete.map((o) => o.id),
                );
            }

            return;
        }

        // Perception Skill
        const itemDataPerception = {
            name: "Perception",
            type: "skill",
            system: {
                XMLID: "PERCEPTION",
                ALIAS: "Perception",
                CHARACTERISTIC: "INT",
                state: "trained",
                LEVELS: "0",
                is5e: this.is5e,
                xmlTag: "SKILL",
                active: true,
            },
        };
        const perceptionItem = this.id
            ? await HeroSystem6eItem.create(itemDataPerception, {
                  parent: this,
              })
            : new HeroSystem6eItem(itemDataPerception, {
                  parent: this,
              });

        if (!this.id) {
            this.items.set(perceptionItem.system.XMLID, perceptionItem);
        }
    }

    buildManeuverData(maneuver) {
        // AARON: As of July 5 2026 we are trying to treat combat maneuvers as much
        // like martial arts as possible. Specifically using martial arts traits like ("Target Falls")
        // in EFFECT.  If baseInfo.xml exists the we created a custom martial arts maneuver in Hero Designer
        // which mostly emulates the combat maneuver with some differences, like COST=0.  Not all combat
        // maneuvers can be easily emulated with a custom martial art, such as Haymaker or MultiAttack.

        // MARTIALARTS consists of a list of MANEUVERS, the MARTIALARTS MANEUVERS have more props than our basic ones.
        // Adding in some of those props as we may enhance/rework the basic maneuvers in the future.
        //  <MANEUVER XMLID="MANEUVER" ID="1705867725258" BASECOST="4.0" LEVELS="0" ALIAS="Block" POSITION="1"
        //  MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes"
        //  INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Block" OCV="+2"
        //  DCV="+2" DC="0" PHASE="1/2" EFFECT="Block, Abort" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0"
        //  MAXSTR="0" STRMULT="1" USEWEAPON="Yes" WEAPONEFFECT="Block, Abort">

        const itemDataAsIfMartialArt = maneuver.xml ? HeroSystem6eItem.itemDataFromXml(maneuver.xml, this) : null;

        const name = maneuver.name;
        const XMLID = maneuver.key;
        const maneuverDetails = maneuver.maneuverDesc;
        const ADDSTR = itemDataAsIfMartialArt?.system.ADDSTR ?? maneuverDetails.addStr;
        const CATEGORY = itemDataAsIfMartialArt?.system.CATEGORY;
        const CUSTOM = itemDataAsIfMartialArt?.system.CUSTOM;
        const DAMAGETYPE = itemDataAsIfMartialArt?.system.DAMAGETYPE;
        const DC = itemDataAsIfMartialArt?.system.DC ?? maneuverDetails.dc;
        const DCV = itemDataAsIfMartialArt?.system.DCV ?? maneuverDetails.dcv;
        const EFFECT = itemDataAsIfMartialArt?.system.EFFECT ?? maneuverDetails.effects;
        const MAXSTR = itemDataAsIfMartialArt?.system.MAXSTR;
        const OCV = itemDataAsIfMartialArt?.system.OCV ?? maneuverDetails.ocv;
        const PHASE = itemDataAsIfMartialArt?.system.PHASE ?? maneuverDetails.phase;
        const RANGE = itemDataAsIfMartialArt?.system.RANGE ?? maneuverDetails.range ?? 0;
        const USEWEAPON = itemDataAsIfMartialArt?.system.USEWEAPON ?? maneuverDetails.useWeapon; // "No" if unarmed or not offensive maneuver
        const WEAPONEFFECT = itemDataAsIfMartialArt?.system.WEAPONEFFECT ?? maneuverDetails.weaponEffect; // Not be present if not offensive maneuver

        const itemData = {
            name,
            type: "maneuver",
            img: itemDataAsIfMartialArt ? `systems/${game.system.id}/icons/fist.svg` : undefined,
            system: {
                active: false, // TODO: This is probably not always true. It should, however, be generated in other means.
                description: EFFECT,
                is5e: this.is5e,
                ADDSTR,
                CATEGORY,
                CUSTOM,
                DAMAGETYPE,
                DC,
                DCV,
                DISPLAY: name, // Not sure we should allow editing of basic maneuvers
                EFFECT,
                OCV,
                MAXSTR,
                PHASE,
                RANGE,
                USEWEAPON,
                WEAPONEFFECT,
                XMLID,
            },
        };

        return itemData;
    }

    async addManeuver(maneuver) {
        const itemData = this.buildManeuverData(maneuver);

        const maneuverItems = this.items.filter(
            (item) => item.system.XMLID === itemData.system.XMLID && item.isCombatManeuver && !item.system.ID,
        );
        if (maneuverItems.length > 0) {
            //console.debug(`${itemData.system.XMLID} already exists`);

            // Make sure we only have one
            const itemsToDelete = maneuverItems.splice(1);

            if (itemsToDelete.length > 0) {
                console.error(`Deleted ${itemsToDelete.length} ${itemData.system.XMLID} items`);
                await this.deleteEmbeddedDocuments(
                    "Item",
                    itemsToDelete.map((o) => o.id),
                );
            }

            return;
        }

        const item = this.id
            ? await HeroSystem6eItem.create(itemData, {
                  parent: this,
              })
            : new HeroSystem6eItem(itemData, {
                  parent: this,
              });

        // Work around if temporary actor
        if (!this.id) {
            this.items.set(item.system.XMLID, item);
        }
    }

    async addHeroSystemManeuvers() {
        // Delete all existing maneuvers
        const existingManeuverIds = this.items
            .filter((power) => power.type?.includes("maneuver"))
            .map((item) => item.id);
        if (existingManeuverIds.length) {
            // Close any open Item sheets
            Object.values(ui.windows)
                .filter((app) => app instanceof ItemSheet && existingManeuverIds.includes(app.document.id))
                .forEach((app) => app.close({ force: true }));

            // Delete all the old items (we will re-create them)
            await this.deleteEmbeddedDocuments("Item", existingManeuverIds, { render: false, renderSheet: false });
        }

        // Add the maneuvers for this system
        const powerList = this.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
        const maneuverItemsData = powerList
            .filter((power) => power.type?.includes("maneuver"))
            .map((maneuver) => this.buildManeuverData(maneuver));

        // Create based on this being a database object or not
        if (this.id) {
            return this.createEmbeddedDocuments("Item", maneuverItemsData, { render: false, renderSheet: false });
        } else {
            maneuverItemsData.forEach((itemData) => {
                const item = new HeroSystem6eItem(itemData, {
                    parent: this,
                });
                this.items.set(item.system.XMLID, item);
            });
        }
    }

    get visionMaximumDistanceInMeters() {
        // Maximum distance we can see is based on perception.  This is typically 125m+ so rarely impacts scene.
        // Only 5e INT/PERCEPTION can go below 9.  6e INT cannot go below 0.  5e INT can go below 0.
        // THE RANGE OF SENSES
        // The Range Modifier (6e, vol 2, page 7) applies to all PER Rolls with Ranged
        // Senses; this effectively restricts their Range significantly. The rules
        // don’t establish any absolute outer limit or boundary for a Ranged
        // Sense; the GM should establish the limit based on common sense
        // and the situation. As a guideline, when the Range Modifier exceeds
        // the point where it reduces a character’s PER Roll to 0 or below,
        // things become too blurry, indistinct, or obscured for the character
        // to perceive, even if he rolls a 3.
        let visionMaximumDistanceInMeters = 8;
        // TODO: Fix PERCEPTION.system.roll so we don't have to poke into INT
        //const PERCEPTION = this.actor?.items.find((i) => i.system.XMLID === "PERCEPTION");
        // TODO: This only handles the generic rules, should include telescopic vision, etc.
        if (this && this.system.characteristics.int) {
            //9 + (INT/5)
            const perRoll = 9 + roundFavorPlayerAwayFromZero(parseInt(this.system.characteristics.int.value) / 5);
            const pwr = perRoll / 2 + 2;
            visionMaximumDistanceInMeters = Math.floor(Math.max(visionMaximumDistanceInMeters, Math.pow(2, pwr)));
        }
        return visionMaximumDistanceInMeters;
    }

    static _xmlToJsonNode(json, children) {
        if (children.length === 0) return;

        for (const child of children) {
            const tagName = child.tagName;

            let jsonChild = {};
            if (child.childElementCount == 0 && child.attributes.length == 0) {
                jsonChild = child.textContent;
            }
            if (HeroSystem6eItem.ItemXmlTags.includes(child.tagName)) {
                jsonChild = [];
            } else {
                for (const attribute of child.attributes) {
                    switch (attribute.value) {
                        case "Yes":
                        case "YES":
                            jsonChild[attribute.name] = true;
                            break;
                        case "No":
                        case "NO":
                            jsonChild[attribute.name] = false;
                            break;
                        case "GENERIC_OBJECT":
                            jsonChild[attribute.name] = child.tagName.toUpperCase(); // e.g. MULTIPOWER
                            jsonChild["xmlid"] = attribute.value.trim(); // Sept 1 2025: Consider keeping the original XMLID for eventual write
                            break;
                        default:
                            jsonChild[attribute.name] = attribute.value.trim();
                    }
                }

                // There can be confusion if the item is a MODIFIER or ADDER (EXPLOSION 5e/6e and others).
                // So keep track of the tagName, which we use in getPowerInfo to help filter when there are duplicate XMLID keys.
                if (child.attributes.length > 0) {
                    try {
                        jsonChild.xmlTag = tagName;
                        jsonChild._hdcXml = new XMLSerializer().serializeToString(child); //new XMLSerializer().serializeToString(child.cloneNode());
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            if (child.children.length > 0) {
                this._xmlToJsonNode(jsonChild, child.children);
            }

            let isPartOfTemplate = false;
            let ptr = child;
            while (ptr) {
                if (ptr.tagName === "TEMPLATE") {
                    isPartOfTemplate = true;
                    break;
                }
                ptr = ptr.parentNode;
            }

            if (!isPartOfTemplate) {
                // Some super old items use RANGED, but is now called RANGE
                if (jsonChild.XMLID === "RANGED" && jsonChild.xmlTag === "ADDER") {
                    jsonChild.XMLID = "RANGE";
                    jsonChild.errors ??= [];
                    jsonChild.errors.push("RANGE renamed to RANGED");
                }

                // Items should have an XMLID
                // Some super old items are missing XMLID, which we will try to fix
                // A bit more generic
                if (
                    !jsonChild.XMLID &&
                    ["CHARACTERISTICS", ...HeroSystem6eItem.ItemXmlTags].includes(child.parentNode.tagName)
                ) {
                    const powerInfo = getPowerInfo({
                        xmlid: jsonChild.xmlTag,
                        xmlTag: jsonChild.xmlTag,
                        is5e: true,
                    });
                    if (powerInfo) {
                        if (powerInfo.key != jsonChild.xmlTag) {
                            console.error(`powerInfo.key != xmlTag`, jsonChild);
                        }
                        jsonChild.XMLID = powerInfo.key;
                        jsonChild.errors ??= [];
                        jsonChild.errors.push("Missing XMLID, using xmlTag reference");
                    }
                }

                // Super old HDC missing XMLID for power frameworks & lists (newer has XMLID=GENERIC_OBJECT)
                if (!jsonChild.XMLID && ["LIST", "VPP", "MULTIPOWER"].includes(jsonChild.xmlTag)) {
                    jsonChild.XMLID = jsonChild.xmlTag;
                }

                // Some super old items are missing OPTIONID, which we will try to fix
                if (jsonChild.OPTION && !jsonChild.OPTIONID) {
                    const powerInfo = getPowerInfo({ xmlid: jsonChild.XMLID, xmlTag: jsonChild.xmlTag, is5e: true });
                    jsonChild.OPTIONID = powerInfo?.optionIDFix?.(jsonChild) || jsonChild.OPTION.toUpperCase();
                    jsonChild.errors ??= [];
                    jsonChild.errors.push("Missing OPTIONID, using OPTION reference");
                }

                // Some super old items are missing and ID (like SCIENTIST skill enhancer)
                if (jsonChild.XMLID && !jsonChild.ID) {
                    const powerInfo = getPowerInfo({ xmlid: jsonChild.XMLID, xmlTag: jsonChild.xmlTag, is5e: true });
                    const PARENTID = child.nextElementSibling?.attributes?.PARENTID?.value;
                    if (PARENTID) {
                        jsonChild.ID = PARENTID;
                        jsonChild.errors ??= [];
                        jsonChild.errors.push("Missing ID, using PARENTID from nextElementSibling");
                    }

                    if (!jsonChild.BASECOST) {
                        // We are going to rebase this item as we have no BASECOST or likely any other properties
                        if (!powerInfo?.xml) {
                            ui.notifications.error(
                                `Unable to rebase ${jsonChild?.XMLID} because powerInfo is not available.`,
                            );
                            continue;
                        } else {
                            try {
                                jsonChild.errors ??= [];
                                const parser = new DOMParser();
                                const rebase = parser.parseFromString(powerInfo.xml.trim(), "text/xml");
                                for (const attribute of rebase.children[0].attributes) {
                                    if (!jsonChild[attribute.name]) {
                                        jsonChild[attribute.name] ??= attribute.value;
                                        jsonChild.errors.push(`${attribute.name} from config.mjs:xml`);
                                    }
                                }
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    }
                }
            }

            if (
                HeroSystem6eItem.ItemXmlChildTagsUpload.includes(child.tagName) &&
                !HeroSystem6eItem.ItemXmlTags.includes(child.parentElement?.tagName)
            ) {
                json[tagName] ??= [];
                json[tagName].push(jsonChild);
            } else if (Array.isArray(json)) {
                json.push(jsonChild);
            } else {
                json[tagName] = jsonChild;
            }
        }
    }

    async _resetCharacteristicsFromHdc() {
        const changes = {};
        for (const [key, char] of Object.entries(this.system.characteristics)) {
            const KEY = key.toUpperCase();
            if (!this.system[KEY] || !char.baseInfo) {
                continue;
            }

            const value = (this.system[KEY].LEVELS || 0) + (char.baseInfo.base?.(this) || 0);
            changes[`system.characteristics.${key.toLowerCase()}.max`] = value;
            changes[`system.characteristics.${key.toLowerCase()}.value`] = value;
        }
        await this.update(changes);
    }

    updateRollable(key) {
        console.error("Depricated updateRollable");
        const characteristic = this.system.characteristics[key];
        const charPowerEntry = getPowerInfo({
            xmlid: key.toUpperCase(),
            actor: this,
            xmlTag: key.toUpperCase(),
        });

        if (characteristic && charPowerEntry?.behaviors.includes("success")) {
            const newRoll = Math.round(9 + characteristic.value * 0.2);
            if (!this.system.is5e && characteristic.value < 0) {
                characteristic.roll = 9;
            }
            if (this.system.characteristics[key].roll !== newRoll) {
                return {
                    [`system.characteristics.${key}.roll`]: newRoll,
                };
            }
        }

        return undefined;
    }

    getActorCharacterAndActivePoints() {
        // Calculate realCost & Active Points for bought as characteristics
        let characterPointCost = 0;
        let activePoints = 0;

        let pointsDetail = {};
        let activePointsDetail = {};

        const powers = getCharacteristicInfoArrayForActor(this);
        for (const powerInfo of powers) {
            characterPointCost += parseFloat(this.system.characteristics[powerInfo.key.toLowerCase()]?.realCost || 0);
            activePoints += parseFloat(this.system.characteristics[powerInfo.key.toLowerCase()]?.activePoints || 0);
        }
        pointsDetail.characteristics = characterPointCost;
        activePointsDetail.characteristics = characterPointCost;

        // ActivePoints are the same a RealCosts for base CHARACTERISTICS
        activePoints = characterPointCost;

        // Add in costs for items
        for (const item of this.items.filter(
            (o) =>
                o.type !== "attack" &&
                o.type !== "defense" &&
                o.type !== "movement" &&
                !o.system.XMLID?.startsWith("__"), // Exclude placeholder powers
        )) {
            let _characterPointCost =
                parseFloat(item.system?.characterPointCost || item.system?.characterPointCost) || 0;
            const _activePoints = parseFloat(item.system?.activePoints) || 0;

            if (_characterPointCost !== 0) {
                // Equipment is typically purchased with money, not character points
                if ((item.parentItem?.type || item.type) !== "equipment" && item.type !== "disadvantage") {
                    characterPointCost += _characterPointCost;
                }

                if (item.type !== "disadvantage") {
                    activePoints += _activePoints;
                }

                pointsDetail[item.parentItem?.type || item.type] ??= 0;
                activePointsDetail[item.parentItem?.type || item.type] ??= 0;

                pointsDetail[item.parentItem?.type || item.type] += _characterPointCost;
                activePointsDetail[item.parentItem?.type || item.type] += _activePoints;
            }
        }

        // DISAD_POINTS: realCost
        const DISAD_POINTS = parseFloat(this.system.CHARACTER?.BASIC_CONFIGURATION?.DISAD_POINTS || 0);
        const _disadPoints = Math.min(DISAD_POINTS, pointsDetail?.disadvantage || 0);
        if (_disadPoints !== 0) {
            pointsDetail.MatchingDisads = _disadPoints;
            activePointsDetail.MatchingDisads = _disadPoints;
        }

        let realCost = characterPointCost;

        return {
            activePoints,
            characterPointCost,
            pointsDetail,
            activePointsDetail,
            realCost,
        };
    }

    get activePoints() {
        return this.getActorCharacterAndActivePoints().activePoints;
    }

    get characterPointCost() {
        return this.getActorCharacterAndActivePoints().characterPointCost;
    }

    get pointsDetail() {
        return this.getActorCharacterAndActivePoints().pointsDetail;
    }

    get activePointsDetail() {
        return this.getActorCharacterAndActivePoints().activePointsDetail;
    }

    get realCost() {
        return this.getActorCharacterAndActivePoints().realCost;
    }

    pslPenaltyItems(penaltyType) {
        return this.items.filter((item) => item.pslPenaltyType === penaltyType);
    }

    pslPenaltyValue(penaltyType) {
        const psls = this.pslPenaltyItems(penaltyType);
        const valueSum = psls.reduce(
            (accumulator, currentValue) => accumulator + parseInt(currentValue.system.LEVELS) || 0,
            0,
        );
        return valueSum;
    }

    is5ePreview(template) {
        try {
            const _template = template?.extends ?? template;
            if (_template?.includes("6")) {
                return false;
            }

            // 5e templates don't have the number 6
            if (_template?.includes("hdt") && !_template?.includes("6")) {
                return true;
            }
        } catch (e) {
            console.error(e);
            if (squelch("is5ePreview")) {
                ui.notifications.error("Error occurred while checking for 5e template.");
            }
        }

        return null;
    }

    get is5e() {
        const _template = this.system.CHARACTER?.TEMPLATE?.name;
        const _is5e = this.is5ePreview(_template);

        if (_is5e != undefined && this.system.is5e !== _is5e) {
            if (!squelch(this.id)) {
                console.error(`${this.name} is5e mismatch.  Template=${_template}`);
            }
            return _is5e;
        }

        if (this.system.is5e == null) {
            return game.settings.get(HEROSYS.module, "DefaultEdition") === "five" ? true : false;
        }

        return this.system.is5e;
    }

    get _characterPoints() {
        return this.characterPointCost;
    }

    get _characterPointsForDisplay() {
        return roundFavorPlayerTowardsZero(this._characterPoints);
    }

    get _activePoints() {
        return this.activePoints;
    }

    get _activePointsForDisplay() {
        return roundFavorPlayerTowardsZero(this._activePoints);
    }

    /**
     * Return an array of the actor's attack items that could be a match for this PSL.
     * They will either be single items or framework that contains potentially multiple items.
     *
     * @returns {HeroSystem6eItem[]}
     */
    get pslItems() {
        return this.sortedAttackItemsForCslPsl;
    }

    /**
     * Return an array of the actor's attack items that could be a match for this CSL.
     * They will either be single items or framework that contains potentially multiple items.
     *
     * @returns {HeroSystem6eItem[]}
     */
    get cslItems() {
        return this.sortedAttackItemsForCslPsl;
    }

    /**
     * Return an array of the actor's attack items that could be a match CSLs and PSLs.
     * They will either be single items or framework that contains potentially multiple items.
     *
     * @returns {HeroSystem6eItem[]}
     */
    get sortedAttackItemsForCslPsl() {
        try {
            const priorityCsl = function (item) {
                switch (item.type) {
                    case "power":
                        return 1;
                    case "equipment":
                        return 1;
                    case "martialart":
                        return 2;
                    case "maneuver":
                        return 9;
                    default:
                        return 99;
                }
            };

            const _sortCslItems = function (a, b) {
                const priorityA = priorityCsl(a);
                const priorityB = priorityCsl(b);
                return priorityA - priorityB;
            };

            return this.items
                .filter(
                    (item) =>
                        (item.rollsToHit() &&
                            (!item.baseInfo.behaviors.includes("optional-maneuver") ||
                                game.settings.get(HEROSYS.module, "optionalManeuvers")) &&
                            !item.system.XMLID.startsWith("__")) ||
                        item.system.XMLID === "HANDTOHANDATTACK" || // PH: FIXME: Not sure why we're using rollsToHit as it misses this. Might be only exception.
                        (item.baseInfo.type.includes("framework") && // CSL custom adders can specify a framework to indicate all of the framework's children are included.
                            !item.isSeparator && // Ignore separators
                            !(
                                item.system.XMLID === "LIST" &&
                                ["skill", "talent", "perk", "disadvantage"].includes(item.type)
                            )), // Ignore LISTs in the skills, talents, perks, and disads section as they can't have attacks
                )
                .sort(_sortCslItems);
        } catch (e) {
            // If baseinfo is missing the baseinfo.type causes errors. Known to occur with old manually built attacks with no XMLID.
            // Plan is to delete these invalid attacks.  For now they show in invalid actor sheet tab for reference only.
            console.error(`${this.name} has unhandled error in cslItems`);
            throw new Error("sortedAttackItemsForCslPsl failure", { cause: e });
        }
    }

    /**
     * Try to determine the template type
     */
    get _templateType() {
        // isHeroic
        // Need to be a careful as there are custom templates ('Nekhbet Vulture Child Goddess')
        // that we are unlikely able to decode heroic status.
        // NOTE: Older HD used "Main" as the template type - not sure what it means

        // CAREFUL: the template type is only loosely tied to actor.type
        // TODO: See if we can tightly couple the template to actor.type

        // Templates can extend other templates.
        // Some HDC files include custom template info that we currently ignore.

        // Generic template
        let genericTemplate;
        switch (this.type) {
            case "pc":
            case "npc":
                genericTemplate = `builtIn.Superheroic${this.is5e ? "" : "6E"}.hdt`;
                break;

            case "ai":
                genericTemplate = `builtIn.AI${this.is5e ? "" : "6E"}.hdt`;
                break;

            case "automation":
                genericTemplate = `builtIn.Automaton${this.is5e ? "" : "6E"}.hdt`;
                break;

            case "base2":
                genericTemplate = `builtIn.Base${this.is5e ? "" : "6E"}.hdt`;
                break;

            case "computer":
                genericTemplate = `builtIn.Computer${this.is5e ? "" : "6E"}.hdt`;
                break;

            case "vehicle":
                genericTemplate = `builtIn.Vehicle${this.is5e ? "" : "6E"}.hdt`;
                break;

            default:
                console.warn(`Unhandled actor type=${this.type} for template fallback`);
                genericTemplate = `builtIn.Main${this.is5e ? "" : "6E"}.hdt`;
        }

        return this.system.CHARACTER?.TEMPLATE.name ?? genericTemplate;
    }

    get _templateTypeAbreviation() {
        // Heroic or SuperHeroic
        // CAREFUL: the template type is only loosly tied to actor.type
        // TODO: See if we can tighly couple the template to actor.type

        // There are 2 types that start with A (AI, and Automaton) so distinguish between them
        switch (this._templateType) {
            case "builtIn.AI.hdt":
            case "builtIn.AI6E.hdt":
                return "ai";

            case "builtIn.Automaton.hdt":
            case "builtIn.Automaton6E.hdt":
                return "a";

            case "builtIn.Base.hdt":
            case "builtIn.Base6E.hdt":
                return "b";

            case "builtIn.CompetentNormal.hdt":
                console.warn(`Unhandled template=${this._templateType}`);
                return "";

            case "builtIn.Computer.hdt":
            case "builtIn.Computer6E.hdt":
                return "c";

            case "builtIn.Heroic.hdt":
            case "builtIn.Heroic6E.hdt":
                return "h";

            case "builtIn.Main.hdt":
            case "builtIn.Main6E.hdt":
                // Custom Template based on Main such as ZoriaAmari.HDC
                console.warn(`Unhandled template=${this._templateType}`);
                return "";

            case "builtIn.Normal.hdt":
                return "n";

            case "builtIn.Superheroic.hdt":
            case "builtIn.Superheroic6E.hdt":
                return "s";

            case "builtIn.Vehicle.hdt":
            case "builtIn.Vehicle6E.hdt":
                return "v";
        }

        console.warn(`Unhandled template=${this._templateType}`);
        return "";
    }

    get encumbrance() {
        // encumbrancePercentage
        const equipmentWeightPercentage =
            parseInt(game.settings.get(game.system.id, "equipmentWeightPercentage")) / 100.0;

        // Hero Designer appears to store WEIGHT as LBS instead of KG.
        const equipment = this.items.filter(
            (o) => o.type === "equipment" && (o.parentItem ? o.parentItem.isActive : o.isActive),
        );
        const weightLbs = equipment.reduce((a, b) => a + parseFloat(b.system?.WEIGHT || 0), 0);
        const weightKg = (weightLbs / 2.2046226218) * equipmentWeightPercentage;

        return weightKg.toFixed(1);
    }

    get netWorth() {
        const equipment = this.items.filter((o) => o.type === "equipment" && o.isActive);
        const price = equipment.reduce((a, b) => a + parseFloat(b.system.PRICE), 0);
        return price.toFixed(2);
    }

    get activeMovement() {
        const movementPowers = this.system.is5e ? CONFIG.HERO.movementPowers5e : CONFIG.HERO.movementPowers;

        let movementItems = [];
        for (const key of Object.keys(this.system.characteristics).filter((o) => movementPowers[o])) {
            const char = this.system.characteristics[key];
            if ((parseInt(char.value) || 0) > 0) {
                char._id = key;
                char.name = movementPowers[key];
                movementItems.push(char);
            }
        }
        const _activeMovement =
            movementItems.length === 0
                ? "none"
                : movementItems.find((o) => o._id === this.flags[game.system.id]?.activeMovement)?._id ||
                  movementItems[0]._id;
        return _activeMovement;
    }

    static stunThresholdForType(type) {
        return type === "pc" ? -30 : -10;
    }

    get stunThreshold() {
        return this.constructor.stunThresholdForType(this.type);
    }

    /**
     * Determine if the actor is critically unconscious and out of combat.
     * Supports evaluating incoming data changes during _preUpdate lifecycles.
     * @param {object} [changed] An optional mutation tracking payload from _preUpdate
     * @returns {boolean}
     */
    getKnockedOutOfCombat(changed = {}) {
        // 1. Check if KO is explicitly forced active, otherwise fall back to the live cache set
        const isKO = changed._forceKOActive ?? this.statuses.has("knockedOut");

        // If they are not knocked out, they are definitely not out of combat
        if (!isKO) return false;

        // 2. Fetch the incoming structural target value vs the database state value
        const stunVal = changed.system?.characteristics?.stun?.value ?? this.system.characteristics.stun?.value ?? 0;

        // 3. Return true if STUN falls below your system threshold
        return stunVal < this.stunThreshold;
    }

    // V13 and V14 have different ways of applying active effects
    applyActiveEffects(phase) {
        if (HeroCompatibility.isV14) {
            return this.applyActiveEffects14(phase);
        }
        return this.applyActiveEffects13();
    }

    // HeroSystem is unique in that we only
    // apply only one multiplier (whichever one reduces the most).
    /**
     * Apply any transformations to the Actor data which are caused by ActiveEffects.
     */
    applyActiveEffects13() {
        const overrides = {};
        this.statuses.clear();

        // Organize non-disabled effects by their application priority
        let changes = [];
        for (const effect of this.allApplicableEffects()) {
            if (!effect.active) continue;
            changes.push(
                ...effect.changes.map((change) => {
                    const c = foundry.utils.deepClone(change);
                    c.effect = effect;
                    c.priority = c.priority ?? c.mode * 10;
                    return c;
                }),
            );
            for (const statusId of effect.statuses) this.statuses.add(statusId);
        }

        // Filter out redundant multiplies, keeping lowest value
        // const mults = changes.filter((c) => c.mode === CONST.ACTIVE_EFFECT_MODES.MULTIPLY);
        // if (mults.length > 1) {
        //     const uniqueKeys = new Set();
        //     mults.forEach((obj) => {
        //         uniqueKeys.add(obj.key);
        //     });

        //     for (const key of uniqueKeys) {
        //         const multsUniqueKey = mults.filter((c) => c.key === key);
        //         if (multsUniqueKey.length > 1) {
        //             const minValue = Math.min(...multsUniqueKey.map((c) => parseFloat(c.value)));
        //             const keepMult = multsUniqueKey.find((c) => parseFloat(c.value) === minValue);
        //             // remove all multsUniqueKey and add back in the keepMult
        //             changes = changes.filter((c) => c.key !== key || c.mode !== CONST.ACTIVE_EFFECT_MODES.MULTIPLY);
        //             changes.push(keepMult);
        //         }
        //     }
        // }
        HeroSystem6eActorActiveEffects._removeRedundantHalvingActiveEffects(changes);
        changes.sort((a, b) => a.priority - b.priority);

        // Apply all changes
        for (const change of changes) {
            if (!change.key) continue;
            const changes = change.effect.apply(this, change);
            Object.assign(overrides, changes);
        }

        // Expand the set of final overrides
        this.overrides = foundry.utils.expandObject(overrides);
    }

    /**
     * Apply any transformations to the Actor data which are caused by ActiveEffects.
     * @param {string} phase The application phase under which changes are to be applied.
     */
    applyActiveEffects14(phase) {
        const ActiveEffect = foundry.documents.ActiveEffect.implementation;
        if (typeof phase !== "string") {
            phase = this._completedActiveEffectPhases.has("initial") ? "final" : "initial";
            const message =
                'Actor#applyActiveEffects must be called with a string phase identifier, with "initial"' +
                " as the first phase.";
            foundry.utils.logCompatibilityWarning(message, { since: 14, until: 16, once: true });
        } else if (!(phase in ActiveEffect.CHANGE_PHASES)) {
            const error = new Error(`"${phase}" is not a registered ActiveEffect application phase.`);
            Hooks$1.onError("Actor#applyActiveEffects", error, { log: "error" });
        }
        if (this._completedActiveEffectPhases.has(phase)) {
            const error = new Error(
                `ActiveEffect application phase "${phase}" has already completed and cannot be run again` +
                    " in this Actor's data-preparation cycle.",
            );
            Hooks$1.onError("Actor#applyActiveEffects", error, { log: "error" });
            return;
        }
        this._completedActiveEffectPhases.add(phase);

        // Organize non-disabled effects by their application priority
        /** @type {ActiveEffectChangeData[]} */
        const changes = [];
        /** @type {ActiveEffectChangeData[]} */
        const tokenChanges = [];
        for (const effect of this.allApplicableEffects()) {
            if (!effect.active) continue;
            for (const change of effect.system.changes) {
                if (change.key === "" || change.phase !== phase) continue;
                const copy = foundry.utils.deepClone(change);
                copy.effect = effect;
                if (copy.key?.startsWith("token.")) {
                    // Keep Token changes separate for later application
                    copy.key = copy.key.slice(6);
                    tokenChanges.push(copy);
                } else changes.push(copy);
            }
            if (phase === "initial") {
                for (const statusId of effect.statuses) this.statuses.add(statusId);
            }
        }
        changes.sort((a, b) => a.priority - b.priority);
        ActiveEffect._shimChanges(changes);
        HeroSystem6eActorActiveEffects._removeRedundantHalvingActiveEffects(changes);
        this.tokenActiveEffectChanges[phase] = tokenChanges;

        // Apply all changes
        const overrides = {};
        const replacementData = this.getRollData();
        for (const change of changes) {
            const result = ActiveEffect.applyChange(this, change, { replacementData });
            if (foundry.utils.isPlainObject(result)) Object.assign(overrides, result);
        }

        // Expand the set of final overrides
        foundry.utils.mergeObject(this.overrides, foundry.utils.expandObject(overrides));
    }

    /**
     * Create a new Token document, not yet saved to the database, which represents the Actor.
     * @param {object} [data={}]            Additional data, such as x, y, rotation, etc. for the created token data
     * @param {object} [options={}]         The options passed to the TokenDocument constructor
     * @returns {Promise<TokenDocument>}    The created TokenDocument instance
     */
    // async getTokenDocument(data = {}, options = {}) {
    //     const tokenData = this.prototypeToken.toObject();
    //     tokenData.actorId = this.id;

    //     if (tokenData.randomImg && !data.texture?.src) {
    //         let images = await this.getTokenImages();
    //         if (images.length > 1 && this._lastWildcard) {
    //             images = images.filter((i) => i !== this._lastWildcard);
    //         }
    //         const image = images[Math.floor(Math.random() * images.length)];
    //         tokenData.texture.src = this._lastWildcard = image;
    //     }

    //     if (!tokenData.actorLink) {
    //         if (tokenData.appendNumber) {
    //             // Count how many tokens are already linked to this actor
    //             const tokens = canvas.scene.tokens.filter((t) => t.actorId === this.id);
    //             // let n = tokens.length + 1;
    //             // tokenData.name = `${tokenData.name} (${n})`;

    //             // And make sure we don't already have this token name in this scene
    //             for (let n = tokens.length + 1; n < 100; n++) {
    //                 const sisterToken = canvas.scene.tokens.find(
    //                     (t) => t.actorId === this.id && t.name === `${tokenData.name} (${n})`,
    //                 );
    //                 if (!sisterToken) {
    //                     tokenData.name = `${tokenData.name} (${n})`;
    //                     break;
    //                 }
    //             }
    //         }

    //         if (tokenData.prependAdjective) {
    //             const adjectives = Object.values(
    //                 foundry.utils.getProperty(game.i18n.translations, CONFIG.Token.adjectivesPrefix) ||
    //                     foundry.utils.getProperty(game.i18n._fallback, CONFIG.Token.adjectivesPrefix) ||
    //                     {},
    //             );
    //             const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    //             tokenData.name = `${adjective} ${tokenData.name}`;
    //         }
    //     }

    //     foundry.utils.mergeObject(tokenData, data);
    //     const cls = getDocumentClass("Token");
    //     return new cls(tokenData, options);
    // }

    hasPhase(segmentNumber) {
        let index = Math.min(Math.max(this.system.characteristics.spd.value, 1), 12); // Security bounds
        let phases = HeroSystem6eActor.Speed2Segments[index];
        //console.log("index", segmentNumber, index, phases, phases.includes(segmentNumber), HeroSystem6eActor.__speed2Segments);
        return phases.includes(segmentNumber);
    }

    getBaseInit() {
        const characteristic = this.system?.initiativeCharacteristic || "dex";
        const initValue = this.system.characteristics[characteristic]?.value || 0;
        return parseInt(initValue);

        // if (segmentNumber != this.segmentNumber) {
        //     const characteristic = this.system?.initiativeCharacteristic || "dex";
        //     const initValue = this.system.characteristics[characteristic]?.value || 0;
        //     const r = Math.floor(Math.random(6)) + 1;
        //     this.currentInit = parseInt(initValue) + Number((r / 10).toFixed(2));
        //     this.segmentNumber = segmentNumber;
        // }
        // return this.currentInit;
    }

    get invalidItems() {
        return Array.from(this.items.invalidDocumentIds).map((id) => this.items.getInvalid(id));
    }

    // Analyze the actor and generate various statistics about it
    get analysis() {
        try {
            return { endurance: this.analyzeEndurance };
        } catch (e) {
            console.error(e);
        }
        return {};
    }

    get analyzeEndurance() {
        const activatablePowersUsingEnd = this.items.filter(
            (i) => i.isActive && i.type === "power" && i.baseInfo?.behaviors.includes("activatable") && i.end > 0,
        );
        const activatablePowerEndSum = Math.max(
            0,
            activatablePowersUsingEnd.reduce((a, c) => a + c.end, 0),
        );

        // Hacky for now, should  get estimated end for attack
        const endForAttack = Math.max(
            1,
            Math.ceil(
                this.system.characteristics.str.value /
                    (game.settings.get(HEROSYS.module, "StrEnd") === "five" ? 5 : 10),
            ),
        );

        const perPhase = 1 + activatablePowerEndSum + endForAttack;
        const perTurn = perPhase * this.system.characteristics.spd.value || 1;
        const perTurnWithRecovery = Math.max(0, perTurn - this.system.characteristics.rec.value) || 0;
        const phasesUntil0End =
            perTurnWithRecovery > 0
                ? Math.trunc(this.system.characteristics.end.value / perTurnWithRecovery, 1)
                : "infinity";
        return { perPhase, perTurn, phasesUntil0End };
    }

    async setNaturalHealing(changed) {
        const naturalBodyHealing = this.temporaryEffects.find(
            (o) => o.flags[game.system.id]?.XMLID === "naturalBodyHealing",
        );

        // During _preUpdate this.system still holds the pre-update values; prefer the pending ones.
        const pendingCharacteristics = changed?.system?.characteristics ?? {};
        const bodyValue = parseInt(pendingCharacteristics.body?.value ?? this.system.characteristics.body?.value);
        const bodyMax = parseInt(pendingCharacteristics.body?.max ?? this.system.characteristics.body?.max);
        const recValue = parseInt(pendingCharacteristics.rec?.value ?? this.system.characteristics.rec?.value);

        if (this.type === "pc" && bodyValue < bodyMax) {
            const bodyPerMonth = Math.max(1, recValue);
            const secondsPerBody = Math.floor(2.628e6 / bodyPerMonth);
            const daysForOneBody = roundFavorPlayerAwayFromZero(30 / bodyPerMonth);
            const activeEffect = {
                name: `Natural Body Healing (${bodyPerMonth}/month; ${daysForOneBody} days to get 1 body)`,
                id: "naturalBodyHealing",
                img: `systems/${HEROSYS.module}/icons/heartbeat.svg`,
                duration: {
                    seconds: secondsPerBody,
                },
                flags: {
                    [`${game.system.id}`]: {
                        XMLID: "naturalBodyHealing",
                        expiresOn: "segmentStart",
                    },
                },
            };
            if (naturalBodyHealing) {
                await naturalBodyHealing.update({
                    name: activeEffect.name,
                    "duration.seconds": activeEffect.duration.seconds,
                });
            } else {
                await this.addActiveEffect(activeEffect);
                //await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        }

        // Get rid of naturalHealing
        if (naturalBodyHealing && bodyValue && bodyValue >= bodyMax) {
            await naturalBodyHealing.delete();
        }
    }

    get allCslSkills() {
        return this.items.filter((item) => item.isCsl);
    }

    get activeCslSkills() {
        return this.allCslSkills.filter((item) => item.isActive);
    }

    get preferredAttacksForCsls() {
        let results = [];

        // Martial Arts
        results = [...results, ...this.items.filter((item) => item.isMartialManeuver)];

        // Equipment
        results = [
            ...results,
            ...this.items.filter((item) => item.type === "equipment" && item.baseInfo?.behaviors.includes("to-hit")),
        ];

        // Powers
        results = [
            ...results,
            ...this.items.filter((item) => item.type === "power" && item.baseInfo?.behaviors.includes("to-hit")),
        ];

        // Strike
        results = [...results, ...this.items.filter((item) => item.isCombatManeuver && item.system.XMLID === "STRIKE")];

        return results;
    }

    get allPslSkills() {
        return this.items.filter((item) => item.isPsl);
    }

    get activePslSkills() {
        return this.allPslSkills.filter((item) => item.isActive);
    }

    static migrateData(source) {
        // Many of these items should have been done during specific version migrations.
        // If migration is interrupted it may have been skipped.
        // SEE: migration.mjs:commitActorAndItemMigrateDataChangesByActor

        this.migrateData_XmlidCharacteristics(source);

        return super.migrateData(source);
    }

    static migrateData_XmlidCharacteristics(source) {
        // Some super old actors are missing XMLID for STUN characteristic,
        // which we will try to fix as it is critical for many calculations.
        // REF: https://github.com/dmdorman/hero6e-foundryvtt/issues/3825
        // Newly created actors don't have this issue as we create characteristics with XMLIDs.
        for (const charKey of [
            "STR",
            "DEX",
            "CON",
            "INT",
            "EGO",
            "PRE",
            "COM",
            "OCV",
            "DCV",
            "OMCV",
            "DMCV",
            "SPD",
            "PD",
            "ED",
            "REC",
            "BODY",
            "STUN",
            "LEAPING",
            "RUNNING",
            "SWIMMING",
        ]) {
            const characteristic = source?.system?.[charKey];
            if (characteristic && !characteristic.XMLID && characteristic.ALIAS === charKey) {
                characteristic.XMLID = charKey;
                tagObjectForPersistence(source);
            }
        }
    }

    /**
     * Get all items relating to special automaton powers for this actor.
     *
     * @returns
     */
    getAutomatonItems() {
        return {
            automaton: this.items.filter((item) => item.system.XMLID === "AUTOMATON"),
            noHitLocations: this.items.filter((item) => item.system.XMLID === "NOHITLOCATIONS"),
            doesNotBleed: this.items.filter((item) => item.system.XMLID === "DOESNOTBLEED"),
        };
    }

    /**
     * Provide a more processed list of special automaton powers for this actor.
     *
     * @returns
     */
    getAutomatonSpecialPowers() {
        const automatonItems = this.getAutomatonItems();

        const specialAutomatonPowers = {
            cannotBeStunned: false,
            doesNotBleed: false,
            noHitLocations: false,
            takesNoStunButLosesFunctionOnBody: false,
            takesNoStun: false,
        };

        // Examine all AUTOMATON powers. An error to have more than 1 defined.
        automatonItems.automaton.forEach((automatonItem) => {
            const automatonItemOptionId = automatonItem.system.OPTIONID;
            switch (automatonItemOptionId) {
                case "CANNOTBESTUNNED":
                    specialAutomatonPowers.cannotBeStunned = true;
                    break;

                case "NOSTUN1":
                    specialAutomatonPowers.takesNoStunButLosesFunctionOnBody = true;
                    break;

                case "NOSTUN2":
                    specialAutomatonPowers.takesNoStun = true;
                    break;

                default:
                    console.error(`Unknown AUTOMATON OPTIONID ${automatonItemOptionId}`);
            }
        });

        if (automatonItems.doesNotBleed.length > 0) {
            specialAutomatonPowers.doesNotBleed = true;
        }

        if (automatonItems.noHitLocations.length > 0) {
            specialAutomatonPowers.noHitLocations = true;
        }

        return specialAutomatonPowers;
    }
}
