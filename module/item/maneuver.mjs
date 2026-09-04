import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { activeEffectChanges } from "../utility/active-effects.mjs";
import { activeSingleTrackerCombatFor, isQuenchTestRunning } from "../utility/util.mjs";
import { roundFavorPlayerTowardsZero } from "../utility/round.mjs";
import { calculateVelocityInSystemUnits } from "../utility/units.mjs";
import { dehydrateAttackItem, rehydrateAttackItem } from "./item-attack.mjs";

/**
 * Maneuvers have some rules of their own that should be considered.
 *
 * @param {*} actor
 * @param {*} item
 */
export async function enforceManeuverLimits() {
    //actor, item) {
    // const maneuverItems = actor.items.filter((e) => ["maneuver", "martialart"].includes(e.type));
    // AARON commented this out on 11/23/2025 as it messes with active.
    // This isn't enforcing any maneuver limits!
    // TODO: I don't believe you can set, brace, and haymaker, etc. so that is what we should be enforcing.
    //await item.update({ "system.active": !item.system.active });
}

// FIXME: DCV should only be effective against HTH attacks unless it's a Dodge
function addDcvTraitToChanges(maneuverDcvChange) {
    if (maneuverDcvChange !== 0) {
        return {
            key: "system.characteristics.dcv.max",
            value: maneuverDcvChange,
            type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
        };
    }
}

function addOcvTraitToChanges(maneuverOcvChange) {
    if (maneuverOcvChange !== 0) {
        return {
            key: "system.characteristics.ocv.max",
            value: maneuverOcvChange,
            type: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
        };
    }
}

/**
 * Create flags that will allow us to expire effects on the next phase. If the item is an
 * original item then the item uuid will suffice otherwise the dehydrated item and actor uuid needs to be used
 *
 * @param {*} item
 * @returns
 */
function buildManeuverNextPhaseFlags(item) {
    return buildManeuverFlags(item, "maneuverNextPhaseEffect");
}

/**
 * Create flags that will allow us to expire effects on the next phase. If the item is an
 * original item then the item uuid will suffice otherwise the dehydrated item and actor uuid needs to be used
 *
 * @param {*} item
 * @returns
 */
// function buildManeuverNextSegmentFlags(item) {
//     return buildManeuverFlags(item, "maneuverNextSegementEffect");
// }

/**
 * Create flags that will allow us to expire effects on the next phase. If the item is an
 * original item then the item uuid will suffice otherwise the dehydrated item and actor uuid needs to be used
 *
 * @param {*} item
 * @param {string} type
 * @returns
 */
function buildManeuverFlags(item, type) {
    return {
        [game.system.id]: {
            type: type,
            itemUuid: item.uuid,
            toggle: item.isActivatable(),
            dehydratedManeuverItem: dehydrateAttackItem(item),
            dehydratedManeuverActorUuid: item.actor.uuid,
        },
    };
}

/**
 * Expires maneuver effects that last "until the character's next Phase" (Dodge, Block,
 * Brace, …) at the start of that Phase. Toggleable maneuvers are switched off through
 * their item so activation state stays in sync; loose effects are deleted. Effects
 * created at the current world time are kept — they were declared this instant.
 * Mirrors the legacy stack's _onStartTurn cleanup (combat.mjs) for the single stack.
 * @param {Actor} actor
 */
export async function expireManeuverNextPhaseEffects(actor) {
    const maneuverAes = (actor?.temporaryEffects ?? []).filter(
        (ae) =>
            ae.flags?.[game.system.id]?.type === "maneuverNextPhaseEffect" && ae.start?.time !== game.time.worldTime,
    );

    const expiryPromises = maneuverAes.map((ae) => {
        const flags = ae.flags[game.system.id];
        if (flags?.toggle) {
            let maneuver = null;
            try {
                maneuver =
                    fromUuidSync(flags.itemUuid) ||
                    rehydrateAttackItem(flags.dehydratedManeuverItem, fromUuidSync(flags.dehydratedManeuverActorUuid))
                        .item;
            } catch (e) {
                console.warn(`Unable to resolve maneuver item for expiring effect ${ae.name}`, e);
            }
            if (maneuver?.isActive) return maneuver.toggle({ token: actor?.getActiveTokens()[0]?.document });
        }
        return ae.delete();
    });
    await Promise.all(expiryPromises);
}

/**
 * Ends an active Haymaker wind-up wherever its state lives: the status effect
 * may sit on the actor directly (token HUD toggles and some attack paths) or
 * ride on the HAYMAKER maneuver item's phase effect — cover both stores so no
 * -5 DCV lingers and the item's activation state stays in sync.
 * @param {Actor} actor
 * @param {object} [options]
 * @param {TokenDocument} [options.token] - Token for the item toggle; defaults to the actor's first active token
 */
export async function endHaymakerManeuver(actor, { token } = {}) {
    if (!actor) return;
    const haymakerEffect = actor.effects.find((e) => e.statuses.has("haymaker"));
    if (haymakerEffect) await haymakerEffect.delete();
    const haymakerItem = actor.items.find((i) => i.system?.XMLID === "HAYMAKER" && i.isActive);
    if (haymakerItem) await haymakerItem.toggle({ token: token ?? actor.getActiveTokens()[0]?.document });
}

/**
 * Things which have the "abort" trait in their effect can be aborted to.
 * @returns {boolean}
 */
export function maneuverCanBeAbortedTo(item) {
    const maneuverHasAbortTrait = item.system.EFFECT?.toLowerCase().indexOf("abort") > -1;
    return !!maneuverHasAbortTrait;
}

/**
 * Toggling an abortable maneuver (Dodge, Martial Dodge, …) outside the actor's
 * own Phase in a live combat IS Aborting — offer to declare it through the
 * combat engine so the Phase cost and lockout are recorded. Confirm
 * first: an out-of-turn toggle may just be pre-staging, and Cancel keeps the
 * maneuver active without an Abort.
 * @param {HeroSystem6eItem} item - The maneuver that was just activated
 */
export async function promptOutOfTurnAbortForManeuver(item) {
    try {
        const actor = item.actor;
        if (!actor || !maneuverCanBeAbortedTo(item)) return;
        if (isQuenchTestRunning()) return;

        // Live single-tracker combats only, and outside this actor's own turn
        const active = activeSingleTrackerCombatFor(actor);
        if (!active) return;
        const { combat, combatant } = active;
        // The abort flow toggles the defense maneuver as part of declaring —
        // that toggle must not re-prompt. Read the latch off the combat's
        // constructor: importing combat-single here would create a cycle.
        if (combat.constructor?._abortFlowActive) return;
        if (combat.combatant?.actor === actor) return;
        if (!combatant?.isOwner || combatant.abortEffect) return;

        const proceed = await foundry.applications.api.DialogV2.confirm({
            window: { title: `Abort — ${actor.name}` },
            content: `<p>${actor.name} is activating <b>${item.name}</b> outside their Phase. Abort to it?</p>
                <p class="hint">Aborting consumes their next Phase — or their Held Action, if holding. Cancel keeps ${item.name} active without declaring an Abort (e.g. pre-staging).</p>`,
            rejectClose: false,
        });
        if (!proceed) return;

        // The maneuver is already active, so no statusId — the item carries its
        // own CV effects; declareAbort records the cost, card, and ledger entry
        await combat.declareAbort(combatant, { toAction: item.name, statusId: null });
    } catch (e) {
        console.error(`Out-of-turn abort prompt failed`, e);
    }
}

/**
 * Things which have the "Attacker Falls" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasAttackerFallsTrait(item) {
    const maneuverHasAttackerFallsTrait = item.system.EFFECT?.search(/you fall/i) > -1;
    return !!maneuverHasAttackerFallsTrait;
}

/**
 * Things which have the "Crush" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasBindTrait(item) {
    const maneuverHasBindTrait = item.system.EFFECT?.search(/bind/i) > -1;
    return maneuverHasBindTrait;
}

/**
 * Things which have the "block" trait in their effect. Need to be careful that we're not triggering on
 * the "Must Follow Block" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasBlockTrait(item) {
    const maneuverHasBlockTrait =
        item.system.EFFECT?.search(/block/i) > -1 && !(item.system.EFFECT?.search(/follow block/i) > -1);
    return maneuverHasBlockTrait;
}

/**
 * Things which have the "Crush" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasCrushTrait(item) {
    const maneuverHasCrushTrait = item.system.EFFECT?.search(/crush/i) > -1;
    return maneuverHasCrushTrait;
}

/**
 * Things which have the "disarm" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasDisarmTrait(item) {
    const maneuverHasDisarmTrait = item.system.EFFECT?.search(/disarm/i) > -1;
    return !!maneuverHasDisarmTrait;
}

/**
 * Things which have the "dodge" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasDodgeTrait(item) {
    const maneuverHasDodgeTrait = item.system.EFFECT?.search(/dodge/i) > -1;
    return !!maneuverHasDodgeTrait;
}

/**
 * Things which have the "flash dc" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasFlashEffectTrait(item) {
    const maneuverHasFlashTrait = item.system.EFFECT?.search(/\[FLASHDC\]/i) > -1;
    return !!maneuverHasFlashTrait;
}

/**
 * Things which have the "grab" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasGrabTrait(item) {
    const maneuverHasGrabTrait = item.system.EFFECT?.search(/grab/i) > -1;
    return !!maneuverHasGrabTrait;
}

/**
 * Things which have the "killing" damage trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasKillingDamageTrait(item) {
    const maneuverHasKillingTrait = item.system.EFFECT?.search(/\[KILLINGDC\]/i) > -1;
    return !!maneuverHasKillingTrait;
}

/**
 * Things which have the "NND" damage trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasNoNormalDefenseDamageTrait(item) {
    const maneuverHasNNDTrait = item.system.EFFECT?.search(/\[NNDDC\]/i) > -1;
    return !!maneuverHasNNDTrait;
}

/**
 * Things which have the "normal" damage trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasNormalDamageTrait(item) {
    const maneuverHasNormalTrait = item.system.EFFECT?.search(/\[NORMALDC\]/i) > -1;
    return !!maneuverHasNormalTrait;
}

/**
 * Things which have the "Target Falls" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasTargetFallsTrait(item) {
    const maneuverHasTargetFallsTrait = item.system.EFFECT?.search(/target falls/i) > -1;
    return !!maneuverHasTargetFallsTrait;
}

/**
 * Things which have the "to resist Shove" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasRootTrait(item) {
    const maneuverHasRootTrait = item.system.EFFECT?.search(/to resist Shove/i) > -1;
    return !!maneuverHasRootTrait;
}

/**
 * Things which have the "shove" trait in their effect. Need to be careful that we're not triggering on
 * the "to resist Shove" (i.e. maneuverHasRootTrait) trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasShoveTrait(item) {
    const maneuverHasShoveTrait =
        item.system.EFFECT?.search(/shove/i) > -1 && !(item.system.EFFECT?.search(/to resist Shove/i) > -1);
    return maneuverHasShoveTrait;
}

/**
 * Things which have the "Strike" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasStrikeTrait(item) {
    const maneuverHasStrikeTrait = item.system.EFFECT?.search(/strike/i) > -1;
    return !!maneuverHasStrikeTrait;
}

/**
 * Things which have the "velocity" trait in their effect.
 * @returns {boolean}
 */
export function maneuverHasVelocityTrait(item) {
    const maneuverHasVelocityTrait = item.system.EFFECT?.search(/v\/(\d+)/i) > -1;
    return !!maneuverHasVelocityTrait;
}

// Maneuvers we recognize but have not implemented status effects for yet
const UNSUPPORTED_MANEUVER_EFFECT_XMLIDS = ["COVER", "HIPSHOT", "HURRY", "SET", "SETANDBRACE", "PULLINGAPUNCH"];

// Shared field recipes for MANEUVER_EFFECT_SPECS
const nameWithXmlid = (item) => (item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`);
const statusName = (_item, status) => status.name;
const traitChanges = (_item, _status, { dcvTrait, ocvTrait }) =>
    [addDcvTraitToChanges(dcvTrait), addOcvTraitToChanges(ocvTrait)].filter(Boolean);
const statusChanges = (_item, status) => foundry.utils.deepClone(activeEffectChanges(status));

/**
 * Declarative specs for the status effect each maneuver activation turns on.
 * Evaluated top to bottom — order reproduces the precedence of the old
 * if/else-if chain (trait matches before XMLID matches). An entry without a
 * `changes` recipe leaves the effect's changes untouched; an `unsupported`
 * entry warns instead of building an effect.
 */
const MANEUVER_EFFECT_SPECS = [
    {
        // Trait match rather than XMLID so custom/martial dodges qualify too
        match: (item) => maneuverHasDodgeTrait(item),
        statusKey: "dodgeEffect",
        name: (item, _status, { dcvTrait }) =>
            item.name ? `${item.name} (${item.system.XMLID} +${dcvTrait})` : `${item.system.XMLID} +${dcvTrait}`,
        changes: traitChanges,
    },
    {
        // Trait match rather than XMLID so custom/martial blocks qualify too
        match: (item) => maneuverHasBlockTrait(item),
        statusKey: "blockEffect",
        name: nameWithXmlid,
        changes: traitChanges,
    },
    {
        // NOTE: This effect is special and doesn't come off as the start of the next phase
        match: (item) => item.system.XMLID === "BRACE",
        statusKey: "braceEffect",
        name: nameWithXmlid,
        changes: statusChanges,
    },
    {
        match: (item) => item.system.XMLID === "HAYMAKER",
        statusKey: "haymakerEffect",
        name: statusName,
        changes: statusChanges,
    },
    {
        match: (item) => item.system.XMLID === "CLUBWEAPON",
        statusKey: "clubWeaponEffect",
        name: statusName,
    },
    {
        match: (item) => UNSUPPORTED_MANEUVER_EFFECT_XMLIDS.includes(item.system.XMLID),
        unsupported: true,
    },
    {
        // PH: FIXME: Assume this is a martial maneuver and give it a default effect
        match: () => true,
        statusKey: "strikeEffect",
        name: nameWithXmlid,
        changes: traitChanges,
    },
];

/**
 * Apply a spec's fields, plus the fields every maneuver effect shares, onto
 * the (possibly reused) active effect.
 */
function buildManeuverActiveEffect(activeEffect, item, spec, traits) {
    const status = HeroSystem6eActorActiveEffects.statusEffectsObj[spec.statusKey];
    activeEffect.name = spec.name(item, status, traits);
    activeEffect.img = status.img;
    activeEffect.flags = buildManeuverNextPhaseFlags(item);
    if (spec.changes) {
        activeEffect = foundry.utils.mergeObject(activeEffect, {
            "system.changes": spec.changes(item, status, traits),
        });
    }
    activeEffect.duration ??= {};
    activeEffect.start = ActiveEffect.getEffectStart();
    // The status ID, not the localized name — the condition system only recognizes registered ids
    activeEffect.statuses = [status.id];
    activeEffect.duration.expiry = "combatEnd"; // V14 kluge until we implement phaseStart.  Combat:_onStartTurn should expire this.
    return activeEffect;
}

/**
 * Activate a combat or martial maneuver
 */
export async function activateManeuver(item) {
    const effect = item.system.EFFECT?.toLowerCase();
    if (!effect) {
        return;
    }

    // Every activation path funnels through here (toggle, sheet roll, attack
    // flow), so this is the one reliable spot to offer the out-of-turn Abort.
    // Deliberately not awaited: cards and effect creation must not block on
    // the confirmation dialog.
    promptOutOfTurnAbortForManeuver(item);

    // FIXME: These are supposed to be for HTH or ranged combat only except for dodge.
    const dcvTrait = parseInt(item.system.DCV === "--" ? 0 : item.system.DCV || 0);
    let ocvTrait = parseInt(item.system.OCV === "--" ? 0 : item.system.OCV || 0);

    // Velocity calc?
    if (isNaN(ocvTrait) && item.system.OCV.includes("v/")) {
        const match = item.system.OCV.match(/([-+]*)v\/(\d+)/);
        const v = calculateVelocityInSystemUnits(item.actor);
        const sign = match[1];
        const divisor = parseInt(match[2]);
        ocvTrait = roundFavorPlayerTowardsZero(v / divisor) * (sign === "-" ? -1 : 1);
    }

    // Catch All
    if (isNaN(ocvTrait)) {
        console.error(`unhandled item.system.OCV`, item.system.OCV);
        ocvTrait = 0;
    }

    // Make sure we have original Item
    const originalItem = item.id ? item : fromUuidSync(item.system._active.__originalUuid);

    let activeEffect = originalItem.effects.contents[0] || {
        flags: [],
    };

    // Turn on any status effects that we have implemented
    const spec = MANEUVER_EFFECT_SPECS.find((s) => s.match(item));
    if (spec.unsupported) {
        console.error(`Unsupported maneuver ${item.detailedName()}`);
    } else {
        activeEffect = buildManeuverActiveEffect(activeEffect, item, spec, { dcvTrait, ocvTrait });
    }

    // The effect may be a reused document or a plain template object
    const _changes = activeEffectChanges(activeEffect);

    if (activeEffect.name && _changes.length > 0) {
        // There is no need to keep track of OCV/DCV changes when not in combat
        if (item.actor) {
            if (item.actor.inCombat === false) {
                return ui.notifications.info(
                    `${item.name} effects were not automated because ${item.actor.name} is not in combat.`,
                );
            }
        }

        // TODO: You can only have 1 combat effect applied at any time.
        // If there is already a combat effect then either the player is trying to cheat
        // or the previous combat effect did not properly expire.
        // I don't believe we have a way to tell if there is a current martial or maneuver effect.
        // Should add something to flags/system so we can check.

        // v14 throws error if effect.duration.value is not an integer.
        // Value = Infinity fails SchemaField validation.
        // We can replace Infinity with null and get this to work.
        // Appears to be a FoundryVTT V14 build 363 bug.
        if (activeEffect.duration?.value === Infinity) {
            activeEffect.duration.value = null;
        }
        if (activeEffect.update) {
            await activeEffect.update({ ...activeEffect, _id: undefined });
        } else {
            if (originalItem.id) {
                await originalItem.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            } else {
                console.error(`originalItem has no id, something is very wrong here`, originalItem);
            }
        }
    }
}

/**
 * For maneuvers that require a hit, we apply tactical status effects in addition to or instead of damage.
 * Prioritizes absolute database parity and simple execution paths by processing documents sequentially.
 *
 * @param {Item} item - The maneuver item initiating the action.
 * @param {Object} action - The action payload tracking target and execution metadata.
 * @returns {Promise<void>}
 */
export async function doManeuverEffects(item, action, targetToken) {
    const attackerActor = item.actor;

    // Guard Clause: If there is no initiating actor, notify the console/UI and terminate execution immediately
    if (!attackerActor) {
        const errorMsg = `HERO: Cannot process maneuver effects because the item "${item.name}" lacks a valid actor reference.`;
        ui.notifications?.error(errorMsg);
        console.error(errorMsg);
        return;
    }

    const hasAttackerFallsTrait = maneuverHasAttackerFallsTrait(item);
    const hasGrabTrait = maneuverHasGrabTrait(item);
    const hasTargetFallsTrait = maneuverHasTargetFallsTrait(item);

    const currentTargets = action.system.currentTargets || [];
    if (currentTargets.length === 0 && targetToken) {
        currentTargets.push(targetToken);
    }
    const validTargets = currentTargets.filter((t) => !!t.actor);

    // --- 1. PROCESS ALL TARGETED DEFENDERS SEQUENTIALLY ---
    if (hasTargetFallsTrait || hasGrabTrait) {
        for (const targetedToken of validTargets) {
            const defenderActor = targetedToken.actor;

            if (hasGrabTrait) {
                await defenderActor.createEmbeddedDocuments("ActiveEffect", [
                    {
                        // deepClone: freeze on statusEffectsObj is shallow and document construction takes ownership of system/changes
                        ...foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.grabEffect),
                        name: `Grabbed by ${attackerActor.name}`,
                        flags: {
                            [game.system.id]: {
                                grabberById: attackerActor.id,
                                grabberByUuid: attackerActor.uuid,
                            },
                        },
                    },
                ]);
            }

            if (hasTargetFallsTrait) {
                await defenderActor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
                    active: true,
                });
                // TODO: Offer actor an ACROBATICS skill roll to negate the prone effect
                // Acrobatics allows -3 to negate prone for target, breakfall at -1 per 2d6 to
                // halve damage but not prevent prone, per UMA p112 and 5ER p400.
                // They can also make a half roll on acrobatics to retain full DCV but remain prone.
            }
        }
    }

    // --- 2. PROCESS THE ATTACKER ---
    if (hasGrabTrait && validTargets.length > 0) {
        await attackerActor.createEmbeddedDocuments("ActiveEffect", [
            {
                ...foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.grabEffect),
                name: `Grabbing ${validTargets.map((t) => t.name).join(" + ")}`,
                flags: {
                    [game.system.id]: {
                        targetIds: validTargets.map((t) => t.id),
                        targetUuids: validTargets.map((t) => t.actor.uuid),
                    },
                },
            },
        ]);
    }

    if (hasAttackerFallsTrait) {
        await attackerActor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
            active: true,
        });
    }
}
