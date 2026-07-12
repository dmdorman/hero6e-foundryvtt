import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { HeroCompatibility } from "../utility/compatibility.mjs";
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
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
        };
    }
}

function addOcvTraitToChanges(maneuverOcvChange) {
    if (maneuverOcvChange !== 0) {
        return {
            key: "system.characteristics.ocv.max",
            value: maneuverOcvChange,
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
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
    // V14 migrated duration.startTime to the top-level start.time field; reading
    // only the V13 shape makes the created-this-instant guard never match there
    const effectStartTime = (ae) => ae.duration?.startTime ?? ae.start?.time ?? null;
    const maneuverAes = (actor?.temporaryEffects ?? []).filter(
        (ae) =>
            ae.flags?.[game.system.id]?.type === "maneuverNextPhaseEffect" &&
            effectStartTime(ae) !== game.time.worldTime,
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
            if (maneuver?.isActive) return maneuver.toggle();
        }
        return ae.delete();
    });
    await Promise.all(expiryPromises);
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

/**
 * Activate a combat or martial maneuver
 */
export async function activateManeuver(item) {
    const effect = item.system.EFFECT?.toLowerCase();
    if (!effect) {
        return;
    }

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

    // Types of effects for this maneuver?
    const hasDodgeTrait = maneuverHasDodgeTrait(item);
    const hasBlockTrait = maneuverHasBlockTrait(item);

    // Make sure we have original Item
    const originalItem = item.id ? item : fromUuidSync(item.system._active.__originalUuid);

    let activeEffect = originalItem.effects.contents[0] || {
        flags: [],
    };

    // Dodge effect
    if (hasDodgeTrait) {
        activeEffect.name = item.name
            ? `${item.name} (${item.system.XMLID} +${dcvTrait})`
            : `${item.system.XMLID} +${dcvTrait}`;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.dodgeEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        const changes = [addDcvTraitToChanges(dcvTrait), addOcvTraitToChanges(ocvTrait)].filter(Boolean);
        activeEffect = foundry.utils.mergeObject(activeEffect, {
            [HeroCompatibility.isV14 ? `system.changes` : `changes`]: changes,
        });
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.dodgeEffect.name];
        activeEffect.duration.expiry = "combatEnd"; // V14 kluge until we implement phaseStart.  Combat:_onStartTurn should expire this.
    }

    // Block effect
    else if (hasBlockTrait) {
        activeEffect.name = item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.blockEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        const changes = [addDcvTraitToChanges(dcvTrait), addOcvTraitToChanges(ocvTrait)].filter(Boolean);
        activeEffect = foundry.utils.mergeObject(activeEffect, {
            [HeroCompatibility.isV14 ? `system.changes` : `changes`]: changes,
        });
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.blockEffect.name];
        activeEffect.duration.expiry = "combatEnd"; // V14 kluge until we implement phaseStart.  Combat:_onStartTurn should expire this.
    }

    // Other maneuvers with effects
    // Turn on any status effects that we have implemented
    else if (item.system.XMLID === "BRACE") {
        // NOTE: This effect is special and doesn't come off as the start of the next phase
        activeEffect.name = item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.braceEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        const changes = foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.braceEffect.changes);
        activeEffect = foundry.utils.mergeObject(activeEffect, {
            [HeroCompatibility.isV14 ? `system.changes` : `changes`]: changes,
        });
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.braceEffect.name];
        activeEffect.duration.expiry = "combatEnd"; // V14 kluge until we implement phaseStart.  Combat:_onStartTurn should expire this.
    } else if (item.system.XMLID === "HAYMAKER") {
        activeEffect.name = HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.name;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        const changes = foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.changes);
        activeEffect = foundry.utils.mergeObject(activeEffect, {
            [HeroCompatibility.isV14 ? `system.changes` : `changes`]: changes,
        });
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.name];
        activeEffect.duration.expiry = "combatEnd"; // V14 kluge until we implement phaseStart.  Combat:_onStartTurn should expire this.
    } else if (item.system.XMLID === "CLUBWEAPON") {
        activeEffect.name = HeroSystem6eActorActiveEffects.statusEffectsObj.clubWeaponEffect.name;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.clubWeaponEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.clubWeaponEffect.name];
        activeEffect.duration.expiry = "combatEnd"; // V14 kluge until we implement phaseStart.  Combat:_onStartTurn should expire this.
    } else if (
        item.system.XMLID === "COVER" ||
        item.system.XMLID === "HIPSHOT" ||
        item.system.XMLID === "HURRY" ||
        item.system.XMLID === "SET" ||
        item.system.XMLID === "SETANDBRACE" ||
        item.system.XMLID === "PULLINGAPUNCH"
    ) {
        console.error(`Unsupported maneuver ${item.detailedName()}`);
    } else {
        // PH: FIXME: Assume this is a martial maneuver and give it a default effect
        activeEffect.name = item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.strikeEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        const changes = [addDcvTraitToChanges(dcvTrait), addOcvTraitToChanges(ocvTrait)].filter(Boolean);
        activeEffect = foundry.utils.mergeObject(activeEffect, {
            [HeroCompatibility.isV14 ? `system.changes` : `changes`]: changes,
        });
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.strikeEffect.name];
        activeEffect.duration.expiry = "combatEnd"; // V14 kluge until we implement phaseStart.  Combat:_onStartTurn should expire this.
    }

    // Handy reference to current V13/V14 AE changes
    const _changes =
        foundry.utils.getProperty(activeEffect, HeroCompatibility.isV14 ? `system.changes` : `changes`) ?? [];

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
        if (HeroCompatibility.isV14) {
            if (activeEffect.duration?.value === Infinity) {
                activeEffect.duration.value = null;
            }
            // V14 moved the start time to the top-level start field; core migrates it
            // on create but not on the re-activation update of a reused template AE
            if (activeEffect.duration?.startTime !== undefined) {
                activeEffect.start = { time: activeEffect.duration.startTime };
            }
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
                        ...HeroSystem6eActorActiveEffects.statusEffectsObj.grabEffect,
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
                ...HeroSystem6eActorActiveEffects.statusEffectsObj.grabEffect,
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
