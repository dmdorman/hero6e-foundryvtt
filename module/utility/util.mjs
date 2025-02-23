import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
//import { HeroSystem6eActor } from "../actor/actor.mjs";
import { performAdjustment, renderAdjustmentChatCards } from "./adjustment.mjs";

export function getPowerInfo(options) {
    const xmlid =
        options.xmlid ||
        options.item?.XMLID ||
        options.item?.system?.XMLID ||
        options.item?.system?.xmlid ||
        options.item?.system?.id;

    const actor = options?.actor || options?.item?.actor;

    // Legacy init of an item (we now include xmlTag during upload process)
    try {
        if (!options?.xmlTag && !options?.xmlid) {
            if (options?.item?.system?.xmlTag) {
                // Excellent we have a positive source for xmlTag!
                options.xmlTag = options.item.system.xmlTag;
            } else if (options?.item?.xmlTag) {
                // Excellent we have a positive source for xmlTag!
                options.xmlTag = options.item.xmlTag;
            } else if (options?.item?.system?.XMLID === "FOCUS") {
                options.xmlTag = "MODIFIER";
            } else if (["power", "equipment"].includes(options?.item?.type)) {
                options.xmlTag = "POWER";
            } else if (options?.item?.type === "skill") {
                options.xmlTag = "SKILL";
            } else if (options?.item?.type === "talent") {
                options.xmlTag = "TALENT";
            } else if (options?.item?.type === "complication" || options?.item?.type === "disadvantage") {
                options.xmlTag = "DISAD";
            } else if (options?.item?.type === "perk") {
                if (options.item.system.XMLID === "WELL_CONNECTED") {
                    options.xmlTag = "WELL_CONNECTED"; // PERK ENHANCER
                } else {
                    options.xmlTag = "PERK";
                }
            } else if (options?.item?.system?.XMLID === "HANDTOHANDATTACK" && options.item.type === "attack") {
                options.xmlTag = "POWER";
            }
        }
    } catch (e) {
        console.error(e);
    }

    // Determine is5e
    let is5e = actor?.is5e;
    if (is5e === undefined) {
        is5e = options.item?.system?.is5e;
    }
    if (is5e === undefined) {
        is5e = options.is5e;
    }
    if (is5e === undefined) {
        // This has a problem if we're passed in an XMLID for a power as we don't know the actor so we don't know if it's 5e or 6e
        const DefaultEdition = game.settings.get(HEROSYS.module, "DefaultEdition");
        if (DefaultEdition === "five") {
            is5e = true;
        } else {
            is5e = false;
        }
    }

    const powerList = is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;

    // ENHANCEDPERCEPTION is a POWER and an ADDER, we can pass in xmlTag to get the right one
    let powerInfo = powerList.filter(
        (o) => o.key === xmlid && (!options?.xmlTag || !o.xmlTag || o.xmlTag === options?.xmlTag),
    );

    if (powerInfo.length > 1) {
        if (!window.warnGetPowerInfo?.includes(xmlid)) {
            console.warn(
                `${actor?.name}/${options.item?.name}/${options.item?.system?.XMLID}/${xmlid}: Multiple powerInfo results. Costs may be incorrect, but shouldn't break core functionality. Uploading the HDC file again may resolve this issue.`,
                powerInfo,
                options,
            );
            window.warnGetPowerInfo ??= [];
            window.warnGetPowerInfo.push(xmlid);
        }
    }
    powerInfo = powerInfo?.[0];

    if (!powerInfo) {
        powerInfo = powerList.find((o) => o.key === xmlid);
        if (powerInfo) {
            if (powerInfo.type.some((t) => ["movement", "skill", "characteristic"].includes(t))) {
                // console.debug(
                //     `${actor?.name}/${options.item?.name}/${options.item?.system?.XMLID}/${xmlid}: Was looking for xmlTag=${options.xmlTag} but got ${powerInfo.xmlTag}. Costs may be incorrect, but shouldn't break core functionality. Uploading the HDC file again should resolve this issue.`,
                //     powerInfo,
                //     options,
                // );
            } else {
                console.warn(
                    `${actor?.name}/${options.item?.name}/${options.item?.system?.XMLID}/${xmlid}: Was looking for xmlTag=${options.xmlTag} but got ${powerInfo.xmlTag}. Costs may be incorrect, but shouldn't break core functionality. Uploading the HDC file again should resolve this issue.`,
                    powerInfo,
                    options,
                );
            }
        }
    }

    // TODO: Why are we modifying the power entries from config here?
    if (powerInfo) {
        powerInfo.xmlid = xmlid;
        if (powerInfo.XMLID !== xmlid) {
            //console.warn(`XMLID mismatch ${xmlid}`, powerInfo);  // OCV?
            powerInfo.XMLID = xmlid;
        }
    }

    // LowerCase
    // TODO: Make powers correct and remove this
    if (powerInfo?.duration) powerInfo.duration = powerInfo.duration.toLowerCase();

    return powerInfo;
}

export function getModifierInfo(options) {
    const xmlid =
        options.xmlid || options.item?.system?.XMLID || options.item?.system?.xmlid || options.item?.system?.id;

    // Determine is5e
    let is5e = options?.actor?.is5e;
    if (is5e === undefined) {
        is5e = options.item?.actor?.is5e;
    }
    if (is5e === undefined) {
        is5e = options.item?.is5e;
    }

    if (typeof is5e === "undefined") {
        // This has a problem if we're passed in an XMLID for a power as we don't know the actor so we don't know if it's 5e or 6e
        console.warn(`Unable to determine edition of ${xmlid} for ${options.item?.name}. Assuming 6e.`);
    }

    let modifierOverrideInfo = CONFIG.HERO.ModifierOverride[xmlid];
    if (!modifierOverrideInfo || is5e) {
        modifierOverrideInfo = {
            ...modifierOverrideInfo,
            ...CONFIG.HERO.ModifierOverride5e[xmlid],
        };
    }

    if (Object.entries(modifierOverrideInfo).length == 0) {
        modifierOverrideInfo = getPowerInfo(options);
    } else {
        console.warn(
            `${options.item?.actor?.name}/${options.item?.name}/${options.item?.system?.XMLID}/${xmlid}: modifierOverrideInfo using older format`,
            xmlid,
            options,
        );
    }

    return modifierOverrideInfo;
}

function _isNonIgnoredCharacteristicsAndMovementPowerForActor(actor) {
    return (power) =>
        (power.type?.includes("characteristic") || power.type?.includes("movement")) &&
        !power.ignoreFor?.includes(actor?.type) &&
        (!power.onlyFor || power.onlyFor.includes(actor?.type)) &&
        !power.key.match(/^CUSTOM[0-9]+.*/); // Ignore CUSTOM characteristics until supported.
}

export function getCharacteristicInfoArrayForActor(actor) {
    const isCharOrMovePowerForActor = _isNonIgnoredCharacteristicsAndMovementPowerForActor(actor);
    const powerList = actor?.system?.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;

    let powers = powerList.filter(isCharOrMovePowerForActor);
    const AUTOMATON = !!actor.items.find(
        (power) =>
            power.system.XMLID === "AUTOMATON" &&
            (power.system.OPTION === "NOSTUN1" || power.system.OPTION === "NOSTUN2"),
    );
    if (AUTOMATON && powers.find((o) => o.key === "STUN")) {
        if (["pc", "npc"].includes(actor.type)) {
            console.debug(`${actor.name} has the wrong actor type ${actor.type}`, actor);
        }

        // TODO: change actor type to AUTOMATON or whatever is appropriate?
        powers = powers.filter((o) => o.key !== "STUN");
    }

    return powers;
}

/**
 *
 * @param {HeroSystem6eActor} actor
 * @returns User[]
 */
export function whisperUserTargetsForActor(actor) {
    if (!actor) return [];
    const ownerIds = [];
    for (const [key, value] of Object.entries(actor?.ownership)) {
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
                if (aeActor && !effects.find((o) => o.id === ae.id && o.target === ae.target)) {
                    effects.push(ae);
                }
            } else {
                // This is likely a core effect, CSL, stunned, etc
                if (ae.target.id === actor.id) {
                    effects.push(ae);
                }
            }
        }
    }
    return effects;
}

/// Check the actor for any effects that should expire, and expire them.
export async function expireEffects(actor) {
    // if (actor.inCombat) {
    //     console.log(`%c ExpireEffects ${actor.name} ${game.time.worldTime}`, "background: #229; color: #bada55");
    // }

    let temporaryEffects = [];

    // Were looking for active effects that we own.
    // if (actor.inCombat) {
    //     temporaryEffects = await getTemporaryEffectsOwnedByActorInCombat(actor);
    // } else {
    temporaryEffects = actor.temporaryEffects;
    //}

    let adjustmentChatMessages = [];
    for (const ae of temporaryEffects) {
        // Determine XMLID, ITEM, ACTOR
        // let origin = await fromUuid(ae.origin);
        // let item =
        //     origin instanceof HeroSystem6eItem ? origin : ae.parent instanceof HeroSystem6eItem ? ae.parent : null;
        // let aeActor =
        //     (origin instanceof HeroSystem6eActor ? origin : item?.actor) ||
        //     actor ||
        //     ae.parent instanceof HeroSystem6eActor
        //         ? ae.parent
        //         : null;
        // let XMLID = ae.flags.XMLID || item?.system?.XMLID;

        // let powerInfo = getPowerInfo({
        //     actor: aeActor,
        //     xmlid: XMLID,
        //     item: item,
        // });

        // if (
        //     !powerInfo &&
        //     ae.statuses.size === 0 &&
        //     game.settings.get(game.system.id, "alphaTesting") &&
        //     ae.duration?.seconds < 3.154e7 * 100
        // ) {
        //     //return ui.notifications.warn(`Unable to determine XMLID for ${ae.name} active effect.`);
        //     // TakeRecovery has no XMLID, not sure why we HAVE to have one, just expire the effect.
        //     console.warn(`Unable to determine XMLID for ${ae.name} active effect.`);
        // }

        // Sanity Check
        if (ae._prepareDuration().remaining > 0 && !ae.duration.startTime) {
            console.warn(
                `${actor.name}/${ae.name} has ${ae._prepareDuration().remaining}s remaining.  It has no duration.startTime and will likely never expire.`,
                ae,
            );
            if (ae.parent instanceof HeroSystem6eItem) {
                console.error(
                    `${actor.name}/${ae.parent.name}/${ae.parent.system.XMLID}/${ae.name} is a temporary effect associated with an item. This is super unusual. Try uploading the HDC file again.  If that doesn't resolve the issue then this could be a coding error and should be reported.`,
                    ae,
                );
            }
            //await ae.update({ [`duration.startTime`]: game.time.worldTime });
        }

        // With Simple Calendar you can move time ahead in large steps.
        // Need to loop as multiple fades may be required.
        //let d = ae._prepareDuration();
        while (ae._prepareDuration().remaining <= 0) {
            // What is this effect related to?
            if (ae.flags.type === "adjustment") {
                // Fade by up to 5 Active Points
                let _fade;
                if (ae.flags.adjustmentActivePoints >= 0) {
                    _fade = 5; //Math.min(ae.flags.adjustmentActivePoints, 5);
                } else {
                    _fade = -5; //Math.max(ae.flags.adjustmentActivePoints, -5);
                }

                const origin = fromUuidSync(ae.origin);
                const item =
                    origin instanceof HeroSystem6eItem
                        ? origin
                        : ae.parent instanceof HeroSystem6eItem
                          ? ae.parent
                          : null;

                if (item) {
                    adjustmentChatMessages.push(
                        await performAdjustment(
                            item,
                            ae.flags.target[0], // nameOfCharOrPower
                            -_fade, // thisAttackRawActivePointsDamage
                            "None - Effect Fade", // defenseDescription
                            "", // effectsDescription
                            true, // isFade
                            ae.target || actor, // token
                            null, // action
                            ae,
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
                if (ae.flags.adjustmentActivePoints === 0 || ae.flags.XMLID === "HEALING") {
                    break;
                }
            } else if (ae.flags.XMLID === "naturalBodyHealing") {
                let bodyValue = parseInt((ae.target || actor).system.characteristics.body.value);
                let bodyMax = parseInt((ae.target || actor).system.characteristics.body.max);
                bodyValue = Math.min(bodyValue + 1, bodyMax);

                await (ae.target || actor).update({
                    "system.characteristics.body.value": bodyValue,
                });

                if (bodyValue === bodyMax) {
                    ae.delete();
                    break;
                }
            } else {
                // Default is to delete the expired AE (like prone?, I think NOT)
                //if (powerInfo) {  // Why do we care about powerInfo?
                //await ae.delete();
                break;
                //}
            }

            // Add duration to startTime (if ae wasn't deleted)
            if (ae.parent?.temporaryEffects.find((o) => o.id === ae.id)) {
                // Sanity delete
                if (ae.flags.adjustmentActivePoints === 0) {
                    console.error(`Sanity deleting ${ae.name}. Shouldn't need to do this.`);
                    await ae.delete();
                    break;
                }

                // Make sure we don't add duration twice
                if (ae.updateDuration().remaining <= 0) {
                    ae.duration.startTime += ae.duration.seconds;
                    await ae.update({ duration: ae.duration });
                }
            } else {
                console.log(`${ae.name} expired`);
                break;
            }
        }
    }
    await renderAdjustmentChatCards(adjustmentChatMessages);
}

/**
 * A number of HDC advantages and powers have very similar OPTIONID values.
 *
 * @param {string} optionId
 * @returns {number} Should be >= 0 unless there is an error.
 */
export function hdcTimeOptionIdToSeconds(durationOptionId) {
    let seconds = 12;

    switch (durationOptionId) {
        case "EXTRAPHASE":
            // TODO: This is not correct as it depends on speed and what segment we're on.
            seconds = 2;
            break;

        case "1TURN":
        case "TURN":
            seconds = 12;
            break;

        case "MINUTE":
            seconds = 60;
            break;

        case "FIVEMINUTES":
            seconds = 60 * 5;
            break;

        case "20MINUTES":
        case "TWENTYMINUTES":
            seconds = 60 * 20;
            break;

        case "HOUR":
            seconds = 60 * 60;
            break;

        case "6HOURS":
        case "SIXHOURS":
            seconds = 60 * 60 * 6;
            break;

        case "DAY":
        case "ONEDAY":
            seconds = 60 * 60 * 24;
            break;

        case "WEEK":
        case "ONEWEEK":
            seconds = 60 * 60 * 24 * 7;
            break;

        case "MONTH":
        case "ONEMONTH":
            seconds = 60 * 60 * 24 * 30;
            break;

        case "SEASON":
        case "ONESEASON":
            seconds = 60 * 60 * 24 * 90;
            break;

        case "YEAR":
        case "ONEYEAR":
            seconds = 60 * 60 * 24 * 365;
            break;

        case "FIVEYEARS":
            seconds = 60 * 60 * 24 * 365 * 5;
            break;

        case "TWENTYFIVEYEARS":
            seconds = 60 * 60 * 24 * 365 * 25;
            break;

        case "ONECENTURY":
            seconds = 60 * 60 * 24 * 365 * 100;
            break;

        default:
            console.warn(`Unhandled duration ${durationOptionId}`);
            seconds = -1;
            break;
    }

    return seconds;
}

export function toHHMMSS(secs) {
    var sec_num = parseInt(secs, 10);
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor(sec_num / 60) % 60;
    var seconds = sec_num % 60;

    return [hours, minutes, seconds]
        .map((v) => (v < 10 ? "0" + v : v))
        .filter((v, i) => v !== "00" || i > 0)
        .join(":");
}
