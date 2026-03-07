import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { dehydrateAttackItem } from "./item-attack.mjs";
import { calculateVelocityInSystemUnits } from "../heroRuler.mjs";
import { roundFavorPlayerTowardsZero } from "../utility/round.mjs";

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
            mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
        };
    }
}

function addOcvTraitToChanges(maneuverOcvChange) {
    if (maneuverOcvChange !== 0) {
        return {
            key: "system.characteristics.ocv.max",
            value: maneuverOcvChange,
            mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
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
        const v = calculateVelocityInSystemUnits(item.actor, null, null);
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

    const activeEffect = originalItem.effects.contents[0] || {
        changes: [],
        flags: [],
    };

    // Dodge effect
    if (hasDodgeTrait) {
        activeEffect.name = item.name
            ? `${item.name} (${item.system.XMLID} +${dcvTrait})`
            : `${item.system.XMLID} +${dcvTrait}`;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.dodgeEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        activeEffect.changes = [addDcvTraitToChanges(dcvTrait), addOcvTraitToChanges(ocvTrait)].filter(Boolean);
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.dodgeEffect.name];
    }

    // Block effect
    else if (hasBlockTrait) {
        activeEffect.name = item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.blockEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        activeEffect.changes = [addDcvTraitToChanges(dcvTrait), addOcvTraitToChanges(ocvTrait)].filter(Boolean);
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.blockEffect.name];
    }

    // Other maneuvers with effects
    // Turn on any status effects that we have implemented
    else if (item.system.XMLID === "BRACE") {
        // NOTE: This effect is special and doesn't come off as the start of the next phase
        activeEffect.name = item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.braceEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        activeEffect.changes = foundry.utils.deepClone(
            HeroSystem6eActorActiveEffects.statusEffectsObj.braceEffect.changes,
        );
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.braceEffect.name];
    } else if (item.system.XMLID === "HAYMAKER") {
        activeEffect.name = HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.name;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        activeEffect.changes = foundry.utils.deepClone(
            HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.changes,
        );
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.name];
    } else if (item.system.XMLID === "CLUBWEAPON") {
        activeEffect.name = HeroSystem6eActorActiveEffects.statusEffectsObj.clubWeaponEffect.name;
        activeEffect.img = HeroSystem6eActorActiveEffects.statusEffectsObj.clubWeaponEffect.img;
        activeEffect.flags = buildManeuverNextPhaseFlags(item);
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.clubWeaponEffect.name];
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
        activeEffect.changes = [addDcvTraitToChanges(dcvTrait), addOcvTraitToChanges(ocvTrait)].filter(Boolean);
        activeEffect.duration ??= {};
        activeEffect.duration.startTime = game.time.worldTime;
        activeEffect.statuses = [HeroSystem6eActorActiveEffects.statusEffectsObj.strikeEffect.name];
    }

    if (activeEffect.name && activeEffect.changes.length > 0) {
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
 * For maneuvers that require a hit we may require some status changes in addition or instead of damage.
 *
 * @param {*} item
 * @param {*} action
 * @returns
 */
export async function doManeuverEffects(item, action) {
    const newActiveEffects = [];
    const hasAttackerFallsTrait = maneuverHasAttackerFallsTrait(item);
    const hasGrabTrait = maneuverHasGrabTrait(item);
    const hasTargetFallsTrait = maneuverHasTargetFallsTrait(item);

    // Add prone effects (attacker and target)
    if (hasTargetFallsTrait) {
        const currentTargets = action.system.currentTargets || [];
        currentTargets.forEach((targetedToken) => {
            // NOTE: A targetedToken can be a PrototypeToken or a TokenDocument.
            const actor = targetedToken.actor;
            newActiveEffects.push(actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect));
        });
    }

    if (hasAttackerFallsTrait) {
        newActiveEffects.push(item.actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect));
    }

    if (hasGrabTrait) {
        const currentTargets = action.system.currentTargets || [];

        // The attacker gets the grabbed state
        newActiveEffects.push(
            item.actor.addActiveEffect({
                ...HeroSystem6eActorActiveEffects.statusEffectsObj.grabEffect,
                name: `Grabbing ${currentTargets.map((o) => o.name).join(" + ")}`,
                flags: { [game.id]: { targetIds: currentTargets.map((o) => o.id) } },
            }),
        );

        // The defender/target gets the grabbed state

        currentTargets.forEach((targetedToken) => {
            // NOTE: A targetedToken can be a PrototypeToken or a TokenDocument.
            const actor = targetedToken.actor;
            newActiveEffects.push(
                actor.addActiveEffect({
                    ...HeroSystem6eActorActiveEffects.statusEffectsObj.grabEffect,
                    name: `Grabbed by ${item.actor.name}`,
                    flags: { [game.system.id]: { grabberById: item.actor.id } },
                }),
            );
        });
    }

    return Promise.all(newActiveEffects);
}
