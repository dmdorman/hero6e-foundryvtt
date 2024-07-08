import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";
import { performAdjustment, renderAdjustmentChatCards } from "./adjustment.mjs";

export function modifyRollEquation(equation, value) {
    if (!value) {
        return equation;
    }

    if (value != 0) {
        let sign = " + ";
        if (value < 0) {
            sign = " - ";
        }
        equation = equation + sign + Math.abs(value);
    }

    return equation;
}

export function getPowerInfo(options) {
    const xmlid =
        options.xmlid ||
        options.item?.XMLID ||
        options.item?.system?.XMLID ||
        options.item?.system?.xmlid ||
        options.item?.system?.id;

    const actor = options?.actor || options?.item?.actor;

    // perhaps is5e is in item (compendium)
    let is5e = actor?.system?.is5e;
    if (is5e === undefined) {
        is5e = options.item?.system?.is5e;
    }
    if (is5e === undefined) {
        is5e = options.is5e;
    }
    if (is5e === undefined) {
        // This has a problem if we're passed in an XMLID for a power as we don't know the actor so we don't know if it's 5e or 6e
        const DefaultEdition = game.settings.get(
            HEROSYS.module,
            "DefaultEdition",
        );
        if (DefaultEdition === "five") {
            is5e = true;
        } else {
            is5e = false;
        }
    }

    const powerList = is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    let powerInfo = powerList.find((o) => o.key === xmlid);

    // TODO: Why are we modifying the power entries from config here?
    if (powerInfo) {
        powerInfo.xmlid = xmlid;
        powerInfo.XMLID = xmlid;
    }

    // LowerCase
    // TODO: Make powers correct and remove this
    if (powerInfo?.duration)
        powerInfo.duration = powerInfo.duration.toLowerCase();

    return powerInfo;
}

export function getModifierInfo(options) {
    const xmlid =
        options.xmlid ||
        options.item?.system?.XMLID ||
        options.item?.system?.xmlid ||
        options.item?.system?.id;

    const actor = options?.actor || options?.item?.actor;
    if (!actor) {
        // This has a problem if we're passed in an XMLID for a power as we don't know the actor so we don't know if it's 5e or 6e
        console.warn(
            `${xmlid} for ${options.item?.name} has no actor provided. Assuming 6e.`,
        );
    }

    let modifierOverrideInfo = CONFIG.HERO.ModifierOverride[xmlid];
    if (!modifierOverrideInfo || actor?.system?.is5e) {
        modifierOverrideInfo = {
            ...modifierOverrideInfo,
            ...CONFIG.HERO.ModifierOverride5e[xmlid],
        };
    }

    if (Object.entries(modifierOverrideInfo).length == 0) {
        modifierOverrideInfo = getPowerInfo(options);
    } else {
        console.warn("modifierOverrideInfo using older format", xmlid);
    }

    return modifierOverrideInfo;
}

function _isNonIgnoredCharacteristicsAndMovementPowerForActor(actor) {
    return (power) =>
        (power.type?.includes("characteristic") ||
            power.type?.includes("movement")) &&
        !power.ignoreFor?.includes(actor?.type) &&
        (!power.onlyFor || power.onlyFor.includes(actor?.type)) &&
        !power.key.match(/^CUSTOM[0-9]+.*/); // Ignore CUSTOM characteristics until supported.
}

export function getCharacteristicInfoArrayForActor(actor) {
    const isCharOrMovePowerForActor =
        _isNonIgnoredCharacteristicsAndMovementPowerForActor(actor);
    const powerList = actor?.system?.is5e
        ? CONFIG.HERO.powers5e
        : CONFIG.HERO.powers6e;

    const powers = powerList.filter(isCharOrMovePowerForActor);

    return powers;
}

/**
 *
 * @param {HeroSystem6eActor} actor
 * @returns User[]
 */
export function whisperUserTargetsForActor(actor) {
    const ownerIds = [];
    for (const [key, value] of Object.entries(actor.ownership)) {
        if (value === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
            ownerIds.push(key);
        }
    }
    const whisperUserTargets = [];
    for (const user of game.users) {
        if (ownerIds.includes(user.id)) {
            whisperUserTargets.push(user);
        }
    }
    return whisperUserTargets; // a list of User Ids
}

export async function getTemporaryEffectsOwnedByActorInCombat(actor) {
    let effects = [];
    for (const c of game.combat.combatants) {
        for (const ae of c.actor.temporaryEffects) {
            const origin = await fromUuid(ae.origin);
            const item = origin instanceof HeroSystem6eItem ? origin : null;
            if (item) {
                const aeActor = item?.actor?.id === actor?.id;
                // There are likely multiple combatants with the same actor based on SPD, only add once
                if (
                    aeActor &&
                    !effects.find(
                        (o) => o.id === ae.id && o.target === ae.target,
                    )
                ) {
                    effects.push(ae);
                }
            } else {
                // This is likely a core effect, CSL, stunned, etc
                if (ae.target.id === actor.id) {
                    console.log(ae);
                    effects.push(ae);
                }
            }
        }
    }
    return effects;
}

/// Check the actor for any effects that should expire, and expire them.
export async function expireEffects(actor) {
    let temporaryEffects = [];

    // Were looking for active effects that we own.
    if (actor.inCombat) {
        temporaryEffects = await getTemporaryEffectsOwnedByActorInCombat(actor);
    } else {
        temporaryEffects = actor.temporaryEffects;
    }

    let adjustmentChatMessages = [];
    for (const ae of temporaryEffects) {
        // Determine XMLID, ITEM, ACTOR
        let origin = await fromUuid(ae.origin);
        let item = origin instanceof HeroSystem6eItem ? origin : null;
        let aeActor =
            origin instanceof HeroSystem6eActor ? origin : item?.actor || actor;
        let XMLID = ae.flags.XMLID || item?.system?.XMLID;

        let powerInfo = getPowerInfo({
            actor: aeActor,
            xmlid: XMLID,
            item: item,
        });

        if (
            !powerInfo &&
            ae.statuses.size === 0 &&
            game.settings.get(game.system.id, "alphaTesting") &&
            ae.duration?.seconds < 3.154e7 * 100
        ) {
            return ui.notifications.warn(
                `Unable to determine XMLID for ${ae.name} active effect.`,
            );
        }

        // With Simple Calendar you can move time ahead in large steps.
        // Need to loop as multiple fades may be required.
        let d = ae._prepareDuration();
        while (d.remaining != null && d.remaining <= 0) {
            // Add duration to startTime
            ae.duration.startTime += d.duration;
            d = ae._prepareDuration();
            await ae.update({ duration: ae.duration });

            // What is this effect related to?
            if (ae.flags.type === "adjustment") {
                // Fade by 5 Active Points
                let _fade;
                if (ae.flags.adjustmentActivePoints < 0) {
                    _fade = Math.max(ae.flags.adjustmentActivePoints, -5);
                } else {
                    _fade = Math.min(ae.flags.adjustmentActivePoints, 5);
                }

                if (item) {
                    adjustmentChatMessages.push(
                        await performAdjustment(
                            item,
                            ae.flags.target[0],
                            -_fade,
                            "None - Effect Fade",
                            "",
                            true,
                            ae.target || actor,
                        ),
                    );
                } else {
                    // The item must have been deleted which makes it impossible to properly adjust the
                    // adjustment power. Just delete it and soldier on.
                    ui.notifications.warn(
                        `The originating item ${ae.origin} of adjustment ${ae.name} appears to have been deleted. Deleting adjustment's active effect.`,
                    );
                    ae.delete();
                    break;
                }

                // TODO: FIXME: Dirty hack. If the amount remaining in the active effect is 0 we know that
                // performAdjustment has deleted the active effect. In this case exit the loop so that
                // we don't keep operating on an old view of a deleted active effect.
                // Healing doesn't fade. The lockout just ends which guarantees a deleted effect.
                if (
                    ae.flags.adjustmentActivePoints === 0 ||
                    ae.flags.XMLID === "HEALING"
                ) {
                    break;
                }
            } else if (ae.flags.XMLID === "naturalBodyHealing") {
                let bodyValue = parseInt(
                    (ae.target || actor).system.characteristics.body.value,
                );
                let bodyMax = parseInt(
                    (ae.target || actor).system.characteristics.body.max,
                );
                bodyValue = Math.min(bodyValue + 1, bodyMax);

                await (ae.target || actor).update({
                    "system.characteristics.body.value": bodyValue,
                });

                if (bodyValue === bodyMax) {
                    ae.delete();
                    break;
                }
            } else {
                // Default is to delete the expired AE
                if (powerInfo) {
                    await ae.delete();
                    break;
                }
            }
        }
    }
    await renderAdjustmentChatCards(adjustmentChatMessages);
}
