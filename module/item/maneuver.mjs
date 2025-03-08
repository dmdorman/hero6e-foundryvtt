import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";

/**
 * Maneuvers have some rules of their own that should be considered.
 *
 * @param {*} actor
 * @param {*} item
 */
export async function enforceManeuverLimits(actor, item) {
    // const maneuverItems = actor.items.filter((e) => ["maneuver", "martialart"].includes(e.type));

    await item.update({ "system.active": !item.system.active });

    // PH: FIXME: Not sure this is correct
    //     if (item.system.active) {
    //         if (item.name === "Block") {
    //             for (const maneuver of maneuverItems) {
    //                 if (maneuver.system.active && maneuver.name !== "Block") {
    //                     await maneuver.update({ "system.active": false });
    //                 }
    //             }
    //         } else {
    //             const block = maneuverItems.find((maneuver) => maneuver.name === "Block");
    //             if (block && block?.system?.active) {
    //                 await block.update({ "system.active": false });
    //             }
    //         }
    //     }
}

// FIXME: DCV should only be effective against HTH attacks unless it's a Dodge
function addDcvTraitToChanges(maneuverDcvChange) {
    if (maneuverDcvChange !== 0) {
        return {
            key: "system.characteristics.dcv.value",
            value: maneuverDcvChange,
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        };
    }
}

function addOcvTraitToChanges(maneuverOcvChange) {
    if (maneuverOcvChange !== 0) {
        return {
            key: "system.characteristics.ocv.value",
            value: maneuverOcvChange,
            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        };
    }
}

function buildManeuverNextPhaseFlags(item) {
    return { type: "maneuverNextPhaseEffect", itemUuid: item.uuid, toggle: item.isActivatable() };
}

/**
 * Things which have the "abort" trait in their effect can be aborted to.
 * @returns {boolean}
 */
export function maneuverCanBeAbortedTo(item) {
    const maneuverHasAbortTrait = item.system.EFFECT?.toLowerCase().indexOf("abort") > -1;
    return maneuverHasAbortTrait;
}

/**
 * Activate a combat or martial maneuver
 */
export async function activateManeuver(item) {
    const effect = item.system.EFFECT?.toLowerCase();
    if (!effect) {
        return;
    }

    // PH: FIXME: This could be simplified as it's really just an effect + the same modifiers
    const newActiveEffects = [];

    // FIXME: These are supposed to be for HTH only and not apply to ranged combat by default
    const maneuverDcvTrait = parseInt(item.system.DCV === "--" ? 0 : item.system.DCV || 0);
    const maneuverOcvTrait = parseInt(item.system.OCV === "--" ? 0 : item.system.OCV || 0);

    // Enable the effect if there is one
    const maneuverHasDodgeTrait = effect.indexOf("dodge") > -1;
    const maneuverHasBlockTrait = effect.indexOf("block") > -1;

    // Dodge effect
    if (maneuverHasDodgeTrait) {
        const dodgeStatusEffect = foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.dodgeEffect);
        dodgeStatusEffect.name = item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`;
        dodgeStatusEffect.flags = buildManeuverNextPhaseFlags(item);
        dodgeStatusEffect.changes = [
            addDcvTraitToChanges(maneuverDcvTrait),
            addOcvTraitToChanges(maneuverOcvTrait),
        ].filter(Boolean);
        newActiveEffects.push(item.actor.addActiveEffect(dodgeStatusEffect));
    }

    // Block effect
    else if (maneuverHasBlockTrait) {
        const blockStatusEffect = foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.blockEffect);
        blockStatusEffect.name = item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`;
        blockStatusEffect.flags = buildManeuverNextPhaseFlags(item);
        blockStatusEffect.changes = [
            addDcvTraitToChanges(maneuverDcvTrait),
            addOcvTraitToChanges(maneuverOcvTrait),
        ].filter(Boolean);
        newActiveEffects.push(item.actor.addActiveEffect(blockStatusEffect));
    }

    // Other maneuvers with effects
    // Turn on any status effects that we have implemented
    else if (item.system.XMLID === "BRACE") {
        // NOTE: This effect is special and doesn't come off as the start of the next phase
        newActiveEffects.push(item.actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.braceEffect));
    } else if (item.system.XMLID === "HAYMAKER") {
        newActiveEffects.push(
            item.actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect),
        );
    } else if (
        item.system.XMLID === "COVER" ||
        item.system.XMLID === "HIPSHOT" ||
        item.system.XMLID === "HURRY" ||
        item.system.XMLID === "SET" ||
        item.system.XMLID === "SETANDBRACE" ||
        item.system.XMLID === "PULLINGAPUNCH"
    ) {
        console.error(`Unsupported maneuver ${item.name}/${item.system.XMLID}`);
    } else {
        // PH: FIXME: Assume this is a martial maneuver and give it a default effect
        const maneuverEffect = foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.strikeEffect);
        maneuverEffect.flags = buildManeuverNextPhaseFlags(item);
        maneuverEffect.name = item.name ? `${item.name} (${item.system.XMLID})` : `${item.system.XMLID}`;
        maneuverEffect.changes = [
            addDcvTraitToChanges(maneuverDcvTrait),
            addOcvTraitToChanges(maneuverOcvTrait),
        ].filter(Boolean);

        newActiveEffects.push(item.actor.createEmbeddedDocuments("ActiveEffect", [maneuverEffect]));
    }

    return Promise.all(newActiveEffects);
}

/**
 * Deactivate a combat or martial maneuver
 */
export async function deactivateManeuver(item) {
    const removedEffects = [];

    const effect = item.system.EFFECT?.toLowerCase();
    if (effect) {
        const maneuverHasDodgeTrait = effect.indexOf("dodge") > -1;
        const maneuverHasBlockTrait = effect.indexOf("block") > -1;

        if (maneuverHasDodgeTrait) {
            removedEffects.push(
                item.actor.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.dodgeEffect),
            );
        }

        if (maneuverHasBlockTrait) {
            removedEffects.push(
                item.actor.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.blockEffect),
            );
        }
    }

    // Turn off any status effects that we have implemented
    if (item.system.XMLID === "BRACE") {
        removedEffects.push(item.actor.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.braceEffect));
    } else if (item.system.XMLID === "HAYMAKER") {
        removedEffects.push(
            item.actor.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect),
        );
    }

    return Promise.all(removedEffects);
}

export async function doManeuverEffects(item, action) {
    const newActiveEffects = [];

    const effect = item.system.EFFECT?.toLowerCase();
    if (effect) {
        const maneuverHasTargetFallsTrait = effect.indexOf("target falls") > -1;
        const maneuverHasAttackerFallsTrait = effect.indexOf("you fall") > -1;

        // Add prone effects (attacker and target)
        if (maneuverHasTargetFallsTrait) {
            const currentTargets = action.system.currentTargets;
            currentTargets.forEach((targetedToken) => {
                const actor = HeroSystem6eActor.get(targetedToken.document.actorId);
                newActiveEffects.push(
                    actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect),
                );
            });
        }

        if (maneuverHasAttackerFallsTrait) {
            newActiveEffects.push(
                item.actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect),
            );
        }
    }

    return Promise.all(newActiveEffects);
}
