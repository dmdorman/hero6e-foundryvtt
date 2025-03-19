import { HEROSYS } from "../herosystem6e.mjs";
import { getPowerInfo, hdcTimeOptionIdToSeconds } from "./util.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";
import { calculateDicePartsForItem } from "./damage.mjs";

/**
 * Return the full list of possible powers and characteristics. No skills, talents, or perks.
 */
export function adjustmentSourcesPermissive(actor, is5e) {
    let choices = {};

    if (!actor) {
        console.error("Missing Actor");
        return choices;
    }

    if (is5e === undefined) is5e = actor.is5e;

    // if (is5e !== false && is5e !== true && is5e !== undefined) {
    //     console.error("bad paramater", is5e);
    //     return choices;
    // }

    const powerList = is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    const powers = powerList.filter(
        (power) =>
            !power.type?.includes("skill") &&
            !power.type?.includes("perk") &&
            !power.type?.includes("talent") &&
            power?.xmlTag !== "ADDER" &&
            power?.xmlTag !== "DISAD" &&
            power?.xmlTag !== "MODIFIER",
    );

    for (const power of powers) {
        let key = power.key;
        choices[key.toUpperCase()] = key.toUpperCase();
    }

    // Add * to defensive powers
    for (let key of Object.keys(choices)) {
        if (defensivePowerAdjustmentMultiplier(key, actor, is5e) > 1) {
            choices[key] += "*";
        }
    }

    choices[""] = "<none>";
    choices = Object.keys(choices)
        .sort()
        .reduce((obj, key) => {
            obj[key] = choices[key];
            return obj;
        }, {});

    return choices;
}

export function adjustmentSourcesStrict(actor) {
    let choices = {};

    if (!actor) return choices;

    const powerList = actor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    const powers = powerList.filter(
        (power) =>
            (power.type?.includes("characteristic") || power.type?.includes("movement")) &&
            !power.ignoreFor?.includes(actor.type) &&
            !power.ignoreFor?.includes(actor.system.is5e ? "5e" : "6e") &&
            (!power.onlyFor || power.onlyFor.includes(actor.type)),
    );

    // Attack powers
    for (const item of actor.items.filter((item) => item.type === "power" && item.system.XMLID !== "MULTIPOWER")) {
        powers.push({ key: item.system.XMLID });
    }

    for (const power of powers) {
        let key = power.key;
        choices[key.toUpperCase()] = key.toUpperCase();
    }

    // Add * to defensive powers
    for (let key of Object.keys(choices)) {
        if (defensivePowerAdjustmentMultiplier(key, actor) > 1) {
            choices[key] += "*";
        }
    }

    choices[""] = "<none>";
    choices = Object.keys(choices)
        .sort()
        .reduce((obj, key) => {
            obj[key] = choices[key];
            return obj;
        }, {});

    return choices;
}

// 5e (pg 114) indicates PD, ED, and defensive powers
const defensiveCharacteristics5e = ["PD", "ED"];

// 6e (V1 pg 135)
const defensiveCharacteristics6e = ["CON", "DCV", "DMCV", "PD", "ED", "REC", "END", "BODY", "STUN"];

export function defensivePowerAdjustmentMultiplier(XMLID, actor, is5e) {
    if (!XMLID) return 1;

    if (is5e !== false && is5e !== true && is5e !== undefined) {
        console.error("bad paramater", is5e);
        return 1;
    }

    let configPowerInfo = getPowerInfo({
        xmlid: XMLID,
        actor: actor,
        is5e: is5e,
        xmlTag: "POWER",
    });
    if (!configPowerInfo) {
        if (actor) {
            configPowerInfo = getPowerInfo({
                xmlid: actor.items.find((o) => o.name.toUpperCase() === XMLID)?.system?.XMLID,
                actor: actor,
                is5e: is5e,
            });
        }
        if (!configPowerInfo) return 1;
    }

    const defenseCharacteristics = is5e ? defensiveCharacteristics5e : defensiveCharacteristics6e;
    if (defenseCharacteristics.includes(XMLID)) {
        return 2;
    }

    if (configPowerInfo.type?.includes("defense")) return 2;

    return 1;
}

export function determineMaxAdjustment(item, simplifiedHealing, potentialCharacteristic) {
    const reallyBigInteger = 1000000;

    // Certain adjustment powers have no fixed limit. Give them a large integer.
    if (
        item.system.XMLID !== "ABSORPTION" &&
        item.system.XMLID !== "AID" &&
        item.system.XMLID !== "SUCCOR" &&
        item.system.XMLID !== "TRANSFER" &&
        item.system.XMLID !== "HEALING"
    ) {
        return reallyBigInteger;
    }

    const { diceParts } = calculateDicePartsForItem(item, {});

    if (item.actor.is5e) {
        // INCREASEDMAX, if available.
        const increaseMax = parseInt(item.system.ADDER?.find((adder) => adder.XMLID === "INCREASEDMAX")?.LEVELS || 0);

        // Max pips in a roll is starting max base.
        const maxAdjustment5e =
            6 * diceParts.d6Count +
            5 * diceParts.d6Less1DieCount +
            3 * diceParts.halfDieCount +
            1 * diceParts.constant +
            increaseMax;

        return maxAdjustment5e;
    } else {
        if (item.system.XMLID === "ABSORPTION") {
            let maxAdjustment6ea = item.system.LEVELS * 2;

            const increasedMax = item.system.MODIFIER?.find((mod) => mod.XMLID === "INCREASEDMAX");
            if (increasedMax) {
                // Each level is 2x
                maxAdjustment6ea = maxAdjustment6ea * Math.pow(2, parseInt(increasedMax.LEVELS));
            }
            return maxAdjustment6ea;
        }

        // Max pips in a roll is starting max base.
        let maxAdjustment6e =
            6 * diceParts.d6Count + 5 * diceParts.d6Less1DieCount + 3 * diceParts.halfDieCount + 1 * diceParts.constant;

        if (simplifiedHealing && potentialCharacteristic.toUpperCase() === "BODY") {
            maxAdjustment6e = Math.floor(maxAdjustment6e / 3);
        }

        return maxAdjustment6e;
    }
}

export function determineCostPerActivePointWithDefenseMultipler(targetCharacteristic, targetPower, targetActor) {
    return (
        determineCostPerActivePoint(targetCharacteristic, targetPower, targetActor) *
        defensivePowerAdjustmentMultiplier(targetCharacteristic.toUpperCase(), targetActor, targetActor?.is5e)
    );
}

export function determineCostPerActivePoint(targetCharacteristic, targetPower, targetActor) {
    // TODO: Not sure we need to use the characteristic here...
    const powerInfo =
        targetPower?.baseInfo ||
        getPowerInfo({
            xmlid: targetCharacteristic.toUpperCase(),
            actor: targetActor,
        });

    // Simplified Healing
    if (powerInfo.XMLID === "HEALING" && targetPower.system.INPUT.match(/simplified/i)) {
        return 1;
    }

    return targetPower
        ? parseFloat(targetPower.system.activePoints / targetPower.system.LEVELS)
        : parseFloat(powerInfo?.cost || powerInfo?.costPerLevel(targetActor) || 0);
}

function _findExistingMatchingEffect(item, potentialCharacteristic, targetSystem, activePoints) {
    // We will find an existing effect with our item that does not have our potentialCharacteristic.
    // Goal is to reuse a single AE for items that have multiple adjustment targets.
    // const costPerActivePoint = determineCostPerActivePointWithDefenseMultipler(
    //     potentialCharacteristic,
    //     null,
    //     targetSystem,
    // );
    const _change = _createAEChangeBlock(potentialCharacteristic, targetSystem);
    return targetSystem.effects.find(
        (effect) =>
            effect.origin === item.uuid && // Make sure the effect.origin is the same item
            effect.flags.createTime === game.time.worldTime && // Only reuse this effect if created on the same worldTime, otherwise create a new effect to properly handle fades
            //effect.changes.find((c) => c.key === _change.key) && // Make sure the key exists in changes
            (effect.flags.XMLID === "HEALING" || !effect.changes.find((c) => c.key === _change.key)) && // Reuse this AE for healing, unless two applications of the same key
            //effect.flags.initialCostPerActivePoint === costPerActivePoint && // Costs should match
            effect.flags.XMLID === item.system.XMLID && // XMLID's should match
            effect.flags.activePoints === activePoints, // AP should match, so fade matches
        //effect.flags.target[0] === (powerTargetName?.uuid || potentialCharacteristic), //&&
        //parseInt(effect.changes?.[0].value || 0) >= 0,
    );
}

function _createAEChangeBlock(targetCharOrPower, targetSystem, item) {
    // TODO: Calculate this earlier so we don't have the logic in here

    let key =
        targetSystem.system.characteristics?.[targetCharOrPower.toLowerCase()] != null
            ? `system.characteristics.${targetCharOrPower.toLowerCase()}.max`
            : targetSystem?.system?.XMLID?.toLowerCase() || "system.max";

    // It would be nice to show the HEALING max values, but we really don't want them added
    if (item?.system.XMLID === "HEALING") {
        key = targetCharOrPower.toLowerCase();
    }

    if (key === "system.max") {
        console.error(`Unknown key for active effect`);
    }

    return {
        key,
        value: 0,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
    };
}

function _determineEffectDurationInSeconds(item, rawActivePointsDamage) {
    let durationOptionId;

    // Healing restores permanently. It, however, does have a lockout period.
    if (item.system.XMLID === "HEALING") {
        durationOptionId = item.findModsByXmlid("DECREASEDREUSE")?.OPTIONID || "DAY";
    } else {
        // DELAYEDRETURNRATE (loss for TRANSFER and all other adjustments) and DELAYEDRETURNRATE2 (gain for TRANSFER)
        const dRR = item.findModsByXmlid("DELAYEDRETURNRATE");
        const dRR2 = item.findModsByXmlid("DELAYEDRETURNRATE2");
        const delayedReturnRate = rawActivePointsDamage > 0 ? dRR : item.system.XMLID === "TRANSFER" ? dRR2 : dRR;
        durationOptionId = delayedReturnRate ? delayedReturnRate.OPTIONID : "TURN";
    }

    let seconds = hdcTimeOptionIdToSeconds(durationOptionId);
    if (seconds < 0) {
        console.error(`optionID for ${item.detailedName()} has unhandled option ID ${durationOptionId}`);
        seconds = 12;
    }

    return seconds;
}

function _createNewAdjustmentEffect(
    item,
    potentialCharacteristic, // TODO: By this point we should know which it is.
    targetPower,
    rawActivePointsDamage,
    targetActor,
    targetSystem,
    action,
) {
    // Create new ActiveEffect
    // TODO: Add a document field

    // Educated guess for token
    const itemTokenName =
        canvas.tokens.get(action?.current?.attackerTokenId)?.name ||
        item.actor?.getActiveTokens().find((t) => canvas.tokens.controlled.find((c) => c.id === t.id))?.name ||
        item.actor?.getActiveTokens()?.[0]?.name ||
        item.actor?.name ||
        "undefined";

    const activeEffect = {
        name: `${item.system.XMLID || "undefined"} 0 ${
            (targetPower?.name || potentialCharacteristic)?.toUpperCase() // TODO: This will need to change for multiple effects
        } (0 AP) [by ${itemTokenName}]`,
        // id: `${item.system.XMLID}.${item.id}.${
        //     targetPower?.name || potentialCharacteristic // TODO: This will need to change for multiple effects
        // }`,
        img: item.img,
        changes: [], //[_createAEChangeBlock(potentialCharacteristic, targetSystem)],
        duration: {
            seconds: _determineEffectDurationInSeconds(item, rawActivePointsDamage),
        },
        flags: {
            type: "adjustment",
            version: 3,
            adjustmentActivePoints: 0,
            affectedPoints: 0,
            XMLID: item.system.XMLID,
            source: targetActor.name,
            target: [targetPower?.uuid || potentialCharacteristic],
            key: targetPower?.system?.XMLID || potentialCharacteristic,
            itemTokenName,
            attackerTokenId: action?.current?.attackerTokenId,
            createTime: game.time.worldTime,
            initialCostPerActivePoint: determineCostPerActivePoint(potentialCharacteristic, null, targetSystem),

            // changes: [
            //     {
            //         source: item.uuid,
            //         seconds: _determineEffectDurationInSeconds(item, rawActivePointsDamage),
            //         adjustmentActivePoints: 0,
            //     },
            // ],
        },
        origin: item.uuid,
        description: item.system.description, // Issues with core FoundryVTT where description doesn't show, nor is editable.
        transfer: true,
        disabled: false,
    };

    // If this is 5e then some characteristics are entirely calculated based on
    // those. We only need to worry about 2 (DEX -> OCV & DCV and EGO -> OMCV & DMCV)
    // as figured characteristics aren't adjusted.
    if (targetActor.system.is5e) {
        if (potentialCharacteristic === "dex") {
            activeEffect.changes.push(_createAEChangeBlock("ocv", targetSystem));
            activeEffect.flags.target.push("ocv");

            activeEffect.changes.push(_createAEChangeBlock("dcv", targetSystem));
            activeEffect.flags.target.push("dcv");
        } else if (potentialCharacteristic === "ego") {
            activeEffect.changes.push(_createAEChangeBlock("omcv", targetSystem));
            activeEffect.flags.target.push("omcv");

            activeEffect.changes.push(_createAEChangeBlock("dmcv", targetSystem));
            activeEffect.flags.target.push("dmcv");
        }
    }

    return activeEffect;
}

export async function performAdjustment(
    attackItem,
    nameOfCharOrPower,
    thisAttackActivePointsEffect, // Amount of AP to change (fade or initial value)
    defenseDescription,
    effectsDescription,
    isFade,
    targetToken,
    action,
    existingEffect,
) {
    // if (thisAttackActivePointsEffect === 0) {
    //     console.warn("Why are we calling this with a 0 adjustment?  Power Defense absorbed it all?");
    // }

    const thisAttackActivePointsEffectRaw = thisAttackActivePointsEffect;

    // for backward compatibility
    const targetActor = targetToken.actor || targetToken;
    const attackerToken = fromUuidSync(action?.current?.attackerTokenId) || attackItem.actor?.getActiveTokens()?.[0];

    const isHealing = attackItem.system.XMLID === "HEALING";
    let targetUpperCaseName = nameOfCharOrPower.toUpperCase();
    let potentialCharacteristic = nameOfCharOrPower.toLowerCase();
    const simplifiedHealing =
        attackItem.system.INPUT.match(/simplified/i) &&
        ["BODY", "STUN"].includes(potentialCharacteristic.toUpperCase());
    //const isOnlyToStartingValues = item.findModsByXmlid("ONLYTOSTARTING") || isHealing;

    // 5e conversions for Calculated Characteristics
    // Adjustment Powers
    // that affect Primary Characteristics have no effect
    // on Figured Characteristics, but do affect abilities
    // calculated from Primary Characteristics (such as
    // the lifting capacity of and damage caused by STR,
    // a character’s Combat Value derived from DEX, and
    // so forth).
    if (targetActor.is5e) {
        switch (potentialCharacteristic.toLowerCase()) {
            case "ocv":
            case "dcv":
                console.warn(`${potentialCharacteristic.toUpperCase()} is invalid for a 5e actor, using DEX instead.`);
                potentialCharacteristic = nameOfCharOrPower = "dex";
                targetUpperCaseName = nameOfCharOrPower.toUpperCase();
                break;
            case "omcv":
            case "dmcv":
                console.warn(`${potentialCharacteristic.toUpperCase()} is invalid for a 5e actor, using EGO instead.`);
                potentialCharacteristic = nameOfCharOrPower = "ego";
                targetUpperCaseName = nameOfCharOrPower.toUpperCase();
                break;
        }
    }

    // Find a matching characteristic. Because movement powers are unfortunately setup as
    // characteristics and always exist as properties, we need to check that they actually
    // have been bought or naturally exist (core > 0).
    const targetCharacteristic =
        targetActor.system.characteristics?.[potentialCharacteristic]?.core > 0
            ? targetActor.system.characteristics?.[potentialCharacteristic]
            : undefined;

    // Search the target for this power.
    // TODO: will return first matching power. How can we distinguish without making users
    //       setup the item for a specific? Will likely need to provide a dialog. That gets
    //       us into the thorny question of what powers have been discovered.
    let targetPower;
    if (!targetCharacteristic) {
        // targetPower = targetActor.items.find(
        //     (item) => item.system.XMLID === targetUpperCaseName || item.id === nameOfCharOrPower,
        // );
        // Get the power with the highest adjustedLevels
        targetPower = targetActor.items
            .filter((item) => item.system.XMLID === targetUpperCaseName || item.id === nameOfCharOrPower)
            .sort((a, b) => b.adjustedLevels - a.adjustedLevels)?.[0];
        // if (targetPower) {
        //     // Sometimes we pass an item.id, make sure we output item.name
        //     nameOfCharOrPower = item.name;
        //     targetUpperCaseName = nameOfCharOrPower.toUpperCase();
        // }
    }

    // Do we have a target?
    if (!targetCharacteristic && !targetPower) {
        await ui.notifications.warn(
            `${nameOfCharOrPower} is an invalid target for the adjustment power ${attackItem.name}. Perhaps ${targetActor.name} does not have that characteristic or power.`,
        );
        return;
    }

    // Characteristics target an actor, and powers target an item
    const targetSystem = targetCharacteristic != null ? targetActor : targetPower;

    // Halve AP, min 1 for defenses
    let _multiplier = defensivePowerAdjustmentMultiplier(
        potentialCharacteristic.toUpperCase(),
        targetActor,
        targetActor?.is5e,
    );
    if (simplifiedHealing) {
        _multiplier = 1;
    }
    if (_multiplier !== 1 && !isFade) {
        if (thisAttackActivePointsEffect >= 0) {
            thisAttackActivePointsEffect = Math.max(
                thisAttackActivePointsEffect === 0 ? 0 : 1,
                Math.trunc(thisAttackActivePointsEffect / _multiplier),
            );
        } else {
            thisAttackActivePointsEffect = Math.min(
                thisAttackActivePointsEffect === 0 ? 0 : -1,
                Math.trunc(thisAttackActivePointsEffect / _multiplier),
            );
        }
    }

    // const targetValuePath =
    //     targetCharacteristic != null ? `system.characteristics.${potentialCharacteristic}.value` : `system.value`;

    // const targetStartingValue = targetCharacteristic != null ? targetCharacteristic.value : targetPower.system.value;
    // const targetStartingMax = targetCharacteristic != null ? targetCharacteristic.max : targetPower.system.max;
    //const targetStartingCore = targetCharacteristic != null ? targetCharacteristic.core : targetPower.system.core;

    existingEffect =
        existingEffect ||
        _findExistingMatchingEffect(attackItem, potentialCharacteristic, targetSystem, thisAttackActivePointsEffect);

    const activeEffect =
        existingEffect ||
        _createNewAdjustmentEffect(
            attackItem,
            targetUpperCaseName,
            targetPower,
            thisAttackActivePointsEffect,
            targetActor,
            targetSystem,
            attackerToken,
            action,
        );

    const maximumEffectActivePoints = determineMaxAdjustment(attackItem, simplifiedHealing, potentialCharacteristic);
    //let totalActivePointAffectedDifference = 0;
    let adjustmentDamageThisApplication = 0;
    let adjustmentDamageThisApplicationArray = [];
    let thisAttackActivePointAdjustmentNotAppliedDueToMax = 0;
    let thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing = 0;
    let isEffectFinished = false;
    const previousChanges = foundry.utils.deepClone(existingEffect?.changes);
    let totalEffectActivePointsForXmlid = 0;
    const costPerActivePoint = simplifiedHealing
        ? 1
        : determineCostPerActivePoint(potentialCharacteristic, null, targetActor);

    // Healing is special
    if (isHealing) {
        // Healing doesn't fade (just expires)
        if (existingEffect && isFade && isHealing) {
            //const deletePromise = existingEffect.delete();

            const chatCard = _generateAdjustmentChatCard({
                attackItem,
                thisAttackActivePointsEffectRaw, //existingEffect.flags.adjustmentActivePoints,
                totalPointsDifference: 0,
                totalEffectActivePointsForXmlid: 0,
                thisAttackActivePointAdjustmentNotAppliedDueToMax: 0,
                thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing: 0,
                defenseDescription,
                effectsDescription,
                targetUpperCaseName,
                isFade: true,
                isEffectFinished: true,
                targetActor,
                targetToken,
                simplifiedHealing,
                attackerToken,
            });

            await existingEffect.delete();
            // await deletePromise;

            return chatCard;
        }

        thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing = thisAttackActivePointsEffect;
        const changeTemp = _createAEChangeBlock(potentialCharacteristic, targetSystem, attackItem);
        const char = changeTemp.key; //.match(/([a-z]+)\.max/)?.[1];
        changeTemp.mode = CONST.ACTIVE_EFFECT_MODES.CUSTOM;

        // Determine Effective Active Points for this attack
        const _previousActivePointsForThisXmlid = targetActor.temporaryEffects
            .filter((ae) => ae.flags.XMLID === "HEALING")
            .reduce(
                (a, c) =>
                    a +
                    (c.changes.find((cc) => cc.key === changeTemp.key) ? parseInt(c.flags.adjustmentActivePoints) : 0),
                0,
            );

        // Subtract pervious AP as repeated healing is only effective if you exceed previous AP
        const _adjustmentActivePoints = Math.max(0, thisAttackActivePointsEffect - _previousActivePointsForThisXmlid);
        // thisAttackActivePointsEffect = thisAttackActivePointsEffect - (activeEffect.flags.adjustmentActivePoints || 0);
        thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing -= _adjustmentActivePoints;

        const prevChange = activeEffect.changes.find((c) => c.key == changeTemp.key);
        const prevValue = parseInt(prevChange?.value) || 0;
        const targetHealValue = Math.floor(thisAttackActivePointsEffect / costPerActivePoint);

        const actorValue = targetActor.system.characteristics[char].value;
        const actorMax = targetActor.system.characteristics[char].max;
        //const value = Math.max(1, Math.floor(_adjustmentActivePoints / costPerActivePoint));
        const value = Math.max(targetHealValue - prevValue);
        const newActorValue = Math.min(actorMax, actorValue + value);
        adjustmentDamageThisApplication = Math.max(0, newActorValue - actorValue);

        if (prevValue > 0) {
            thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing =
                Math.min(prevValue, targetHealValue) * costPerActivePoint;
        }

        // Shortcut here in case we have 0 adjustment done for performance. This will stop
        // active effects with 0 AP being created and unnecessary AE and characteristic no-op updates.
        if (_adjustmentActivePoints <= 0 && adjustmentDamageThisApplication === 0) {
            return _generateAdjustmentChatCard({
                attackItem,
                thisAttackActivePointsEffectRaw,
                thisAttackActivePointsEffect,
                adjustmentDamageThisApplication, //totalActivePointAffectedDifference,
                totalEffectActivePointsForXmlid: 0,
                thisAttackActivePointAdjustmentNotAppliedDueToMax,
                thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing,
                defenseDescription,
                effectsDescription,
                targetUpperCaseName, //potentialCharacteristic,
                isFade,
                isEffectFinished,
                targetActor,
                targetToken,
                maximumEffectActivePoints,
                attackerToken,
            });
        }

        if (adjustmentDamageThisApplication !== 0) {
            await targetActor.update({ [`system.characteristics.${char}.value`]: newActorValue });

            // Update or create change
            if (prevChange) {
                prevChange.value = parseInt(prevChange.value) + value;
                const _idx = activeEffect.changes.findIndex((c) => c.key === prevChange.key);
                activeEffect.changes[_idx] = prevChange;
            } else {
                changeTemp.value = value;
                activeEffect.changes.push(changeTemp);
            }

            activeEffect.flags.adjustmentActivePoints = Math.max(
                activeEffect.flags.adjustmentActivePoints,
                thisAttackActivePointsEffect,
            );
            totalEffectActivePointsForXmlid = activeEffect.flags.adjustmentActivePoints;
        }
    }

    if (isFade) {
        if (!existingEffect.changes?.[0]) {
            console.error("Fade failed", existingEffect);
        }

        // Clamp fade (always 5) to not exceed adjustmentActivePoints
        let maximumActivePointsFade = 5;
        if (existingEffect.flags.adjustmentActivePoints >= 0) {
            // AID fade
            maximumActivePointsFade = Math.max(
                -existingEffect.flags.adjustmentActivePoints,
                thisAttackActivePointsEffect,
            );
        } else {
            // DRAIN fade/recovery
            maximumActivePointsFade = Math.min(
                -existingEffect.flags.adjustmentActivePoints,
                thisAttackActivePointsEffect,
            );
        }

        //const _adjustmentActivePoints = existingEffect.flags.adjustmentActivePoints;
        existingEffect.flags.adjustmentActivePoints += maximumActivePointsFade;

        // Sanity check
        // if (activeEffect.flags.XMLID === "AID" && existingEffect.flags.adjustmentActivePoints < 0) {
        //     console.error("AID has negative adjustmentActivePoints");
        //     debugger;
        // }
        // if (activeEffect.flags.XMLID === "DRAIN" && existingEffect.flags.adjustmentActivePoints > 0) {
        //     console.error("DRAIN has positive adjustmentActivePoints");
        //     debugger;
        // }

        adjustmentDamageThisApplication = parseInt(existingEffect.changes[0].value);
        adjustmentDamageThisApplicationArray = existingEffect.changes.map((ae) => parseInt(ae.value) || 0);

        // Rough estimate of changes (recalc is more accurate and perhaps should be included here)
        let i = 0;
        for (const change of activeEffect.changes) {
            const char = change.key.match(/([a-z]+)\.max/)?.[1];
            const costPerActivePoint2 = determineCostPerActivePoint(char, null, targetActor);
            change.value = Math.trunc(activeEffect.flags.adjustmentActivePoints / costPerActivePoint2);
            adjustmentDamageThisApplicationArray[i] =
                existingEffect.changes[i].value - adjustmentDamageThisApplicationArray[i];
            i++;
        }
        adjustmentDamageThisApplication = existingEffect.changes[0].value - adjustmentDamageThisApplication;

        if (activeEffect.flags.adjustmentActivePoints === 0 && !CONFIG.debug.adjustmentFadeKeep) {
            isEffectFinished = true;
            await existingEffect.update({ changes: existingEffect.changes });
            await updateCharacteristicValue(activeEffect, { targetSystem, previousChanges });
            await existingEffect.delete();
            const chatCard = _generateAdjustmentChatCard({
                attackItem,
                thisAttackActivePointsEffectRaw,
                adjustmentDamageThisApplication, //totalActivePointAffectedDifference,
                totalEffectActivePointsForXmlid,
                thisAttackActivePointAdjustmentNotAppliedDueToMax,
                thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing,
                defenseDescription,
                effectsDescription,
                targetUpperCaseName, //potentialCharacteristic,
                isFade,
                isEffectFinished,
                targetActor,
                targetToken,
                attackerToken,
            });
            return chatCard;
        } else {
            updateEffectName(existingEffect);
            await existingEffect.update({
                name: existingEffect.name,
                changes: existingEffect.changes,
                flags: existingEffect.flags,
                "duration.startTime": existingEffect.duration.startTime + existingEffect.duration.seconds,
            });
        }
    }

    if (!isHealing && !isFade) {
        // Note that costPerActivePoint is different between fade/recovery and initial adjustment (which uses defense multiplier)
        //const costPerActivePoint = determineCostPerActivePoint(potentialCharacteristic, null, targetActor);
        // const costPerActivePointWithDefenseMultipler = determineCostPerActivePointWithDefenseMultipler(
        //     potentialCharacteristic,
        //     null,
        //     targetActor,
        // );
        // const _multiplier = defensivePowerAdjustmentMultiplier(
        //     potentialCharacteristic.toUpperCase(),
        //     targetActor,
        //     targetActor?.is5e,
        // );

        // Halve AP, min 1
        // GM_Champion (he/him) — Dec 28 2024 https://discord.com/channels/609528652878839828/609529601600782378/1322714156025122878
        // Minimum 1 character point.
        // There is no effect until 40, but you track the points drained until they reach 40.
        // It's like a measuring cup - the drain takes out a little water at a time, which eventually adds up to one full mark on the cup.
        //
        //  GM_Champion (he/him) https://discord.com/channels/609528652878839828/609529601600782378/1322742128312582196
        // The book answer for you is 6e1 p.138, right column, top paragraph, final sentence, "...and the remainder can be added to by another use of the Power later on, potentially taking effect."
        // if (_multiplier !== 1) {
        //     if (thisAttackActivePointsEffect > 0) {
        //         thisAttackActivePointsEffect = Math.max(1, Math.trunc(thisAttackActivePointsEffect / _multiplier));
        //     } else if (thisAttackActivePointsEffect < 0) {
        //         thisAttackActivePointsEffect = Math.min(-1, Math.trunc(thisAttackActivePointsEffect / _multiplier));
        //     }
        // }

        // Positive Adjustment
        if (thisAttackActivePointsEffect > 0) {
            const change = _createAEChangeBlock(potentialCharacteristic, targetSystem);

            // Determine Effective Active Points for this attack
            const previousActivePointsForThisXmlid = targetActor.temporaryEffects.reduce(
                (a, c) => a + (c.changes.find((cc) => cc.key === change.key) ? c.flags.adjustmentActivePoints : 0),
                0,
            );

            const previousPointsForThisChangeKey = targetActor.temporaryEffects.reduce(
                (a, c) => a + parseInt(c.changes.find((cc) => cc.key === change.key)?.value || 0),
                0,
            );

            // Max Effect for this attack
            const thisAttackMaxActivePoints =
                previousActivePointsForThisXmlid > maximumEffectActivePoints
                    ? 0
                    : Math.min(maximumEffectActivePoints - previousActivePointsForThisXmlid);
            activeEffect.flags.adjustmentActivePoints = Math.min(
                thisAttackMaxActivePoints,
                thisAttackActivePointsEffect,
            );
            const finalAp = previousActivePointsForThisXmlid + activeEffect.flags.adjustmentActivePoints;
            const targetValue = costPerActivePoint ? Math.trunc(finalAp / costPerActivePoint) : 0;

            change.value = targetValue - previousPointsForThisChangeKey;
            activeEffect.changes.push(change);

            thisAttackActivePointAdjustmentNotAppliedDueToMax =
                thisAttackActivePointsEffect - activeEffect.flags.adjustmentActivePoints;

            //totalActivePointAffectedDifference = activeEffect.flags.adjustmentActivePoints;
            adjustmentDamageThisApplication = change.value;
        }

        // Negative Adjustment
        else if (thisAttackActivePointsEffect < 0) {
            const change = _createAEChangeBlock(potentialCharacteristic, targetSystem);
            const previousActivePointsForThisXmlid = targetActor.temporaryEffects.reduce(
                (a, c) => a + (c.changes.find((cc) => cc.key === change.key) ? c.flags.adjustmentActivePoints : 0),
                0,
            );
            activeEffect.flags.adjustmentActivePoints = thisAttackActivePointsEffect;
            const finalAp =
                activeEffect.flags.adjustmentActivePoints + (previousActivePointsForThisXmlid % costPerActivePoint);
            const targetValue = costPerActivePoint ? Math.trunc(finalAp / costPerActivePoint) : 0;
            change.value = targetValue;
            activeEffect.changes.push(change);

            thisAttackActivePointAdjustmentNotAppliedDueToMax = 0;
            //totalActivePointAffectedDifference = activeEffect.flags.adjustmentActivePoints;
            adjustmentDamageThisApplication = change.value; //activeEffect.changes[0].value;
        }
    }

    // Add new activeEffect
    if (!existingEffect && activeEffect.flags.adjustmentActivePoints !== 0) {
        updateEffectName(activeEffect);
        const createdEffects = await targetActor.createEmbeddedDocuments("ActiveEffect", [activeEffect]);

        if (!createdEffects[0].duration.startTime) {
            console.warn(
                `${targetSystem?.name}: ${createdEffects[0].name} has no duration.startTime and will likely never expire.`,
                createdEffects[0],
            );
        }

        if (!isHealing) {
            await recalcEffectBasedOnTotalApForXmlid(createdEffects[0]);
        }

        updateEffectName(createdEffects[0]);
        await createdEffects[0].update({ name: createdEffects[0].name });
    } else if (activeEffect.flags.adjustmentActivePoints !== 0) {
        // Were likely adding a second change row
        updateEffectName(activeEffect);
        await activeEffect.update({
            name: activeEffect.name,
            changes: activeEffect.changes,
            flags: activeEffect.flags,
        });
    } else {
        console.warn("ActiveEffect not created because adjustmentActivePoints=0");
    }

    if (!isHealing) {
        await updateCharacteristicValue(activeEffect, { targetSystem, previousChanges });
    }

    if (isFade && !isHealing) {
        await recalcEffectBasedOnTotalApForXmlid(activeEffect, isFade);
    }

    // Healing is not cumulative but all else is. Healing cannot harm when lower than an existing effect.

    // let thisAttackEffectiveAdjustmentActivePoints = isHealing
    //     ? Math.min(thisAttackRawActivePointsEffect - activeEffect.flags.adjustmentActivePoints, 0)
    //     : thisAttackRawActivePointsEffect;
    // const thisAttackActivePointEffectNotAppliedDueToNotExceeding = isHealing
    //     ? Math.max(activeEffect.flags.adjustmentActivePoints, thisAttackRawActivePointsEffect)
    //     : 0;
    // //let thisAttackActivePointAdjustmentNotAppliedDueToMax;
    // const totalActivePointsStartingEffect =
    //     activeEffect.flags.adjustmentActivePoints + thisAttackEffectiveAdjustmentActivePoints;

    // Clamp max adjustment to the max allowed by the power.
    // TODO: Combined effects may not exceed the largest source's maximum for a single target. Similar strange variation of this rule for healing.
    // if (totalActivePointsStartingEffect < 0) {
    //     // Healing may not exceed the core (starting value)
    //     let thisAttackActivePointsToUse = isOnlyToStartingValues
    //         ? Math.max(
    //               thisAttackEffectiveAdjustmentActivePoints,
    //               Math.min(targetStartingValue - targetStartingCore, 0) * costPerActivePoint,
    //           )
    //         : totalActivePointsStartingEffect;

    //     // Real Steel purchased BODY as a power, so you can indeed exceed core values.
    //     // let thisAttackActivePointsToUse = isOnlyToStartingValues
    //     //     ? Math.max(
    //     //           thisAttackEffectiveAdjustmentActivePoints,
    //     //           Math.min(targetStartingValue - targetStartingMax, 0) * costPerActivePoint,
    //     //       )
    //     //     : totalActivePointsStartingEffect;

    //     // Healing should not accumulate part points.
    //     if (isHealing) {
    //         thisAttackActivePointsToUse -= thisAttackActivePointsToUse % costPerActivePoint;
    //     }

    //     const max = Math.max(thisAttackActivePointsToUse, -determineMaxAdjustment(item));

    //     thisAttackActivePointAdjustmentNotAppliedDueToMax = isOnlyToStartingValues
    //         ? thisAttackRawActivePointsEffect - max - thisAttackActivePointEffectNotAppliedDueToNotExceeding
    //         : totalActivePointsStartingEffect - max;
    //     thisAttackEffectiveAdjustmentActivePoints = max;
    // } else {
    //     const totalAdjustmentBeforeMin =
    //         thisAttackEffectiveAdjustmentActivePoints + activeEffect.flags.adjustmentActivePoints;
    //     const min = Math.min(totalAdjustmentBeforeMin, determineMaxAdjustment(item));

    //     thisAttackActivePointAdjustmentNotAppliedDueToMax =
    //         totalAdjustmentBeforeMin - min - thisAttackActivePointEffectNotAppliedDueToNotExceeding;
    //     thisAttackEffectiveAdjustmentActivePoints = min;
    // }

    // New effect total.
    // const maximumEffectActivePoints = isOnlyToStartingValues
    //     ? thisAttackEffectiveAdjustmentActivePoints + activeEffect.flags.adjustmentActivePoints
    //     : thisAttackEffectiveAdjustmentActivePoints;

    // Determine how many points of total effect there are based on the cost.
    //const maximumEffectValue = Math.trunc(maximumEffectActivePoints / costPerActivePoint);
    // const totalActivePointAffectedDifference =
    //     maximumEffectValue - Math.trunc(activeEffect.flags.adjustmentActivePoints / costPerActivePoint);

    // Shortcut here in case we have 0 adjustment done for performance. This will stop
    // active effects with 0 AP being created and unnecessary AE and characteristic no-op updates.
    // if (maximumEffectActivePoints - activeEffect.flags.adjustmentActivePoints === 0) {
    //     return _generateAdjustmentChatCard(
    //         item,
    //         thisAttackActivePointsEffect,
    //         totalActivePointAffectedDifference,
    //         maximumEffectActivePoints,
    //         thisAttackActivePointAdjustmentNotAppliedDueToMax,
    //         thisAttackActivePointEffectNotAppliedDueToNotExceeding,
    //         defenseDescription,
    //         effectsDescription,
    //         potentialCharacteristic,
    //         isFade,
    //         false,
    //         targetActor,
    //     );
    // }

    // Calculate the effect's change to the maximum. Only healing does not change the maximum.
    // if (!isOnlyToStartingValues) {
    //     activeEffect.changes[0].value = parseInt(activeEffect.changes[0].value) - totalActivePointAffectedDifference;
    // }

    // If this is 5e then some characteristics are calculated (not figured) based on
    // those. We only need to worry about 2: DEX -> OCV & DCV and EGO -> OMCV & DMCV.
    // These 2 characteristics are always at indices 2 and 3

    // TODO: This really only works when there is 1 effect happening to the characteristic.
    //       To fix would require separate boost tracking along with fractional boosts or
    //       not tracking the changes to OCV and DCV as active effects but have them recalculated
    //       as the characteristic max and value are changing.
    // if (targetActor.system.is5e && activeEffect.changes[1]) {
    //     const newCalculatedValue = RoundFavorPlayerUp((targetStartingMax - totalActivePointAffectedDifference) / 3);
    //     const oldCalculatedValue = RoundFavorPlayerUp(targetStartingMax / 3);

    //     activeEffect.changes[1].value =
    //         parseInt(activeEffect.changes[1].value) + (newCalculatedValue - oldCalculatedValue);

    //     activeEffect.changes[2].value =
    //         parseInt(activeEffect.changes[2].value) + (newCalculatedValue - oldCalculatedValue);
    // }

    // Educated guess for token
    // const itemTokenName =
    //     canvas.tokens.get(action?.current?.attackerTokenId)?.name ||
    //     item.actor?.getActiveTokens().find((t) => canvas.tokens.controlled.find((c) => c.id === t.id))?.name ||
    //     item.actor?.getActiveTokens()?.[0]?.name ||
    //     item.actor?.name ||
    //     "undefined";

    // Update the effect max value(s)
    // activeEffect.name = `${item.system.XMLID || "undefined"} ${Math.abs(maximumEffectValue)} ${(
    //     targetPower?.name || potentialCharacteristic
    // )?.toUpperCase()} (${Math.abs(maximumEffectActivePoints)} AP) [by ${itemTokenName}]`;

    // activeEffect.flags.affectedPoints = maximumEffectValue;
    // activeEffect.flags.adjustmentActivePoints = maximumEffectActivePoints;

    const promises = [];

    // const isEffectFinished = activeEffect.flags.adjustmentActivePoints === 0 && isFade;
    // if (isEffectFinished) {
    //     promises.push(activeEffect.delete());
    // } else if (!existingEffect) {
    //     //promises.push(targetSystem.addActiveEffect(activeEffect));
    //     promises.push(targetSystem.createEmbeddedDocuments("ActiveEffect", [activeEffect]));
    // } else {
    //     promises.push(
    //         activeEffect.update({
    //             name: activeEffect.name,
    //             changes: activeEffect.changes,
    //             flags: activeEffect.flags,
    //             system: activeEffect.system,
    //         }),
    //     );
    // }

    // Calculate the effect value(s)
    // const newValue =
    //     totalActivePointAffectedDifference > 0
    //         ? Math.max(
    //               targetStartingValue - totalActivePointAffectedDifference, // New value if we just subtract the difference
    //               targetStartingMax - totalActivePointAffectedDifference, // New max value
    //           )
    //         : targetStartingValue - totalActivePointAffectedDifference;
    // const changes = {
    //     [targetValuePath]: newValue,
    // };

    // if (targetActor.system.is5e && activeEffect.flags.target[1]) {
    //     const newCalculatedValue = RoundFavorPlayerUp((targetStartingMax - totalActivePointAffectedDifference) / 3);
    //     const oldCalculatedValue = RoundFavorPlayerUp(targetStartingMax / 3);
    //     const char1Value = targetActor.system.characteristics[activeEffect.flags.target[1]].value;
    //     const char2Value = targetActor.system.characteristics[activeEffect.flags.target[2]].value;

    //     changes[`system.characteristics.${activeEffect.flags.target[1]}.value`] =
    //         char1Value + (newCalculatedValue - oldCalculatedValue);
    //     changes[`system.characteristics.${activeEffect.flags.target[2]}.value`] =
    //         char2Value + (newCalculatedValue - oldCalculatedValue);
    // }

    // Update the effect value(s)
    //await targetSystem.update(changes);

    await Promise.all(promises);

    // Use effects to get items?
    const _key = _createAEChangeBlock(potentialCharacteristic, targetSystem).key;
    // const totalEffectActivePointsForXmlid = Array.from(targetActor.temporaryEffects).reduce(
    //     (accum, curr) =>
    //         accum +
    //         curr.changes.reduce(
    //             (a2, c2) =>
    //                 a2 +
    //                 (c2.key === _key &&
    //                 curr.flags.XMLID === activeEffect.flags.XMLID &&
    //                 curr.flags.type === "adjustment" &&
    //                 curr.flags.key === activeEffect.flags.key
    //                     ? parseInt(c2.value)
    //                     : 0),
    //             0,
    //         ),
    //     0,
    // );

    // Sanity check for totalPointsDifference
    // We may have changed it during recalcEffectBasedOnTotalApForXmlid
    //if (!isHealing) {
    // TODO: put this back in, but it is wrong as is
    // const _totalPointsDifference = activeEffect.changes.find((c) => c.key === _key)?.value;
    // if (adjustmentDamageThisApplication != _totalPointsDifference) {
    //     adjustmentDamageThisApplication = _totalPointsDifference;
    //     console.warn(`_totalPointsDifference`);
    // }

    totalEffectActivePointsForXmlid = Array.from(targetActor.temporaryEffects)
        .filter(
            (ae) =>
                ae.changes.find((c) => c.key === _key && parseInt(c.value) !== 0) &&
                //ae.flags.XMLID === activeEffect.flags.XMLID &&
                ae.flags.type === "adjustment" &&
                ae.flags.XMLID !== "HEALING" &&
                ae.flags.key === activeEffect.flags.key,
        )
        .reduce((accum, curr) => accum + curr.flags.adjustmentActivePoints, 0);
    //}

    // Sanity check
    // if (activeEffect.flags.XMLID === "AID" && activeEffect.changes[0]?.value < 0) {
    //     console.error("AID has negative change.value");
    //     debugger;
    // }
    // if (activeEffect.flags.XMLID === "DRAIN" && activeEffect.changes[0]?.value > 0) {
    //     console.error("DRAIN has positive change.value");
    //     debugger;
    // }

    if (adjustmentDamageThisApplicationArray.length > 1) {
        console.log("need adjustmentCard per change");
        const cards = [];
        for (let i = 0; i < adjustmentDamageThisApplicationArray.length; i++) {
            // specific values for each change
            const _targetUpperCaseName = (
                activeEffect.changes[i].key.match(/([a-z]+)\.max/)?.[1] || activeEffect.changes[i].key
            ).toUpperCase();
            const _costPerActivePoint = simplifiedHealing
                ? 1
                : determineCostPerActivePoint(_targetUpperCaseName, null, targetActor);

            const card = _generateAdjustmentChatCard({
                attackItem,
                thisAttackActivePointsEffectRaw,
                thisAttackActivePointsEffect,
                adjustmentDamageThisApplication: adjustmentDamageThisApplicationArray[i],
                totalEffectActivePointsForXmlid,
                thisAttackActivePointAdjustmentNotAppliedDueToMax,
                thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing,
                defenseDescription,
                effectsDescription,
                targetUpperCaseName: _targetUpperCaseName,
                isFade,
                isEffectFinished,
                targetActor,
                costPerActivePoint: _costPerActivePoint,
                targetToken,
                maximumEffectActivePoints,
                attackerToken,
            });
            cards.push(card);
        }
        return cards;
    }

    return _generateAdjustmentChatCard({
        attackItem,
        thisAttackActivePointsEffectRaw,
        thisAttackActivePointsEffect,
        adjustmentDamageThisApplication,
        totalEffectActivePointsForXmlid,
        thisAttackActivePointAdjustmentNotAppliedDueToMax,
        thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing,
        defenseDescription,
        effectsDescription,
        targetUpperCaseName,
        isFade,
        isEffectFinished,
        targetActor,
        costPerActivePoint,
        targetToken,
        maximumEffectActivePoints,
        attackerToken,
    });
}

/// When one of multiple AE's are faded, the rounding of AP to VALUE may change.
async function recalcEffectBasedOnTotalApForXmlid(activeEffect, isFade) {
    const targetActor = activeEffect.parent;
    const costPerActivePoint = determineCostPerActivePoint(activeEffect.flags.key, null, targetActor);
    // if (costPerActivePoint != activeEffect.flags.initialCostPerActivePoint) {
    //     console.warn(`recalcEffectBasedOnTotalApForXmlid costPerActivePoint discrepancy`);
    //     debugger;
    // }
    if (costPerActivePoint === 1) return;
    // if (!costPerActivePoint) {
    //     console.error(`costPerActivePoint error`);
    //     debugger;
    //     return;
    // }

    let _ap = 0;
    let _value = 0;
    try {
        // use effects instead of temporaryEffects because of item AE transfer
        for (const ae of Array.from(targetActor.effects)
            .filter(
                (ae) =>
                    !ae.disabled &&
                    ae.changes?.[0]?.key === activeEffect.changes[0].key &&
                    ae.flags.type === "adjustment",
            )
            .sort((a, b) => (a.flags.createTime || 0) - (b.flags.createTime || 0))) {
            _ap += ae.flags.adjustmentActivePoints;
            const _targetValue = Math.trunc(_ap / costPerActivePoint) - _value;

            if (parseInt(ae.changes[0].value) !== _targetValue) {
                const msg = `updating AE change value from ${ae.changes[0].value} to ${_targetValue} because sumAP=${_ap} and costPerActivePoint=${costPerActivePoint}.  ${_ap}/${costPerActivePoint} = ${_ap / costPerActivePoint}.  There is already a ${_value} value from other effects.`;
                if (isFade) {
                    console.warn(msg);
                } else {
                    console.error(msg);
                    //debugger;
                }

                const previousChanges = foundry.utils.deepClone(ae.changes);
                ae.changes[0].value = _targetValue;
                // if (_targetValue === 0 && !CONFIG.debug.adjustmentFadeKeep) {
                //     await ae.delete();
                //     console.log(`${ae.name} deleted`);
                // } else {
                const char = ae.changes[0].key.match(/([a-z]+)\.max/)?.[1];
                const startingActorMax = foundry.utils.getProperty(targetActor, `system.characteristics.${char}.max`);

                updateEffectName(ae);
                await ae.update({ name: ae.name, changes: ae.changes });

                // Apparently we sometimes need to delay to let all the async's catch up
                const delay = (ms) => new Promise((res) => setTimeout(res, ms || 100));
                for (let i = 0; i < 50; i++) {
                    if (
                        foundry.utils.getProperty(targetActor, `system.characteristics.${char}.max`) !==
                        startingActorMax
                    )
                        break;
                    await delay();
                    console.log(`recalc delay ${i}. Waiting for system.characteristics.${char}.max to change`);
                }

                await updateCharacteristicValue(ae, { previousChanges });
                //}
            }

            _value += _targetValue;
        }
    } catch (e) {
        console.error(e);
    }
}

// Update characteristic VALUE, not to exceed MAX
async function updateCharacteristicValue(activeEffect, { targetSystem, previousChanges = [] }) {
    if (activeEffect.parent) {
        targetSystem = activeEffect.parent;
    }

    if (targetSystem instanceof HeroSystem6eActor) {
        for (const change of activeEffect.changes) {
            const char = change.key.match(/([a-z]+)\.max/)?.[1];
            if (char) {
                const targetStartingValue = foundry.utils.getProperty(
                    targetSystem,
                    `system.characteristics.${char}.value`,
                );
                const targetStartingMax = foundry.utils.getProperty(targetSystem, `system.characteristics.${char}.max`);
                const prevChangeValue = previousChanges.find((c) => c.key === change.key)?.value || 0;
                const totalPointsDifference = change.value - prevChangeValue;
                const newValue = Math.min(
                    targetStartingValue + totalPointsDifference,
                    targetStartingMax, // + totalPointsDifference,
                );
                // if (previousChanges.length > 0) {
                //     debugger;
                // }
                await targetSystem.update({ [`system.characteristics.${char}.value`]: newValue });
                // console.log(
                //     `characteristices ${char}.value = ${targetStartingValue} ${char}.max = ${targetStartingMax}`,
                // );
                // console.log(`Updated characteristices ${char}.value from ${targetStartingValue} to ${newValue}`);

                if (CONFIG.debug.adjustmentFadeKeep) {
                    const delay = (ms) => new Promise((res) => setTimeout(res, ms || 100));
                    for (let i = 0; i < 50; i++) {
                        if (
                            foundry.utils.getProperty(targetSystem, `system.characteristics.${char}.value`) === newValue
                        )
                            break;
                        await delay();
                    }
                }
            } else {
                console.error(`Unhandled characteristis `);
                //debugger;
            }
        }
        // const targetStartingValue = targetSystem.characteristics[targetValuePath];
        // const newValue = Math.min(
        //     targetStartingValue + totalPointsDifference,
        //     targetStartingMax + totalPointsDifference,
        // );
        // const changes = { [targetValuePath]: newValue };
        // await targetSystem.update(changes);
        // console.log(`Updated characteristices`);
    }
    // else {
    //     console.error(`Unhandled targetSystem`);
    //     debugger;
    // }
}

function updateEffectName(activeEffect) {
    //const item = fromUuidSync(activeEffect.origin);
    let _array = [];
    for (const c of activeEffect.changes) {
        const _name =
            c.key.match(/([a-z]+)\.max/)?.[1].replace("system", activeEffect.flags.key) || c.key.match(/[a-z]+/)?.[0];
        if (!_name) {
            _array.push({
                name: activeEffect.flags.key.toUpperCase(),
                value: activeEffect.flags.XMLID,
            });
            break;
        }
        let _value = (parseInt(c.value) || 0).signedString();
        if (_value === "+0" && activeEffect.flags.adjustmentActivePoints < 0) {
            _value = "-0";
        }
        // if ((parseInt(_value) || 0) === 0 && activeEffect.flags.XMLID === "HEALING") {
        //     _value = activeEffect.flags.XMLID;
        // }
        const valItem = _array.find((o) => o.value === _value);
        if (valItem) {
            valItem.name += `/${_name.toUpperCase()}`;
        } else {
            _array.push({ name: _name.toUpperCase(), value: _value });
        }
    }

    let xmlidSlug = `${_array.map((o) => `${o.value} ${o.name}`).join(",")}`;
    if (activeEffect.flags.XMLID === "HEALING") {
        const attackItem = fromUuidSync(activeEffect.origin);
        const simplifiedHealing = attackItem.system.INPUT.match(/simplified/i); //&&
        //["BODY", "STUN"].includes(potentialCharacteristic.toUpperCase());

        xmlidSlug = `HEALING ${simplifiedHealing ? "SIMPLIFIED " : ""}${xmlidSlug.replace(/\+/g, "").replace(/-/g, "")}`;
    }
    // activeEffect.changes.length > 1
    //     ? `${activeEffect.flags.adjustmentActivePoints >= 0 ? "+" : "-"}${item?.name || "MULTIPLE"}`
    //     : `${(parseInt(activeEffect.changes?.[0].value) || 0).signedString()} ${activeEffect.flags.key?.toUpperCase()}`;
    activeEffect.name =
        `${CONFIG.debug.adjustmentFadeKeep && activeEffect.flags?.createTime ? `${activeEffect.flags.createTime} ` : ""}` +
        `${xmlidSlug} (${Math.abs(activeEffect.flags.adjustmentActivePoints)} AP) ` +
        `[by ${activeEffect.flags.itemTokenName}]`;
    // +(activeEffect.updateDuration ? `~${activeEffect.updateDuration().remaining}s remain` : "");
}

function _generateAdjustmentChatCard(
    {
        attackItem,
        thisAttackActivePointsEffectRaw,
        thisAttackActivePointsEffect,
        adjustmentDamageThisApplication,
        totalEffectActivePointsForXmlid,
        thisAttackActivePointAdjustmentNotAppliedDueToMax,
        thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing,
        defenseDescription,
        effectsDescription,
        targetUpperCaseName,
        isFade,
        isEffectFinished,
        targetActor,
        costPerActivePoint,
        targetToken,
        maximumEffectActivePoints,
        simplifiedHealing,
        attackerToken,
    },
    // item,
    // activePointDamage,
    // activePointAffectedDifference,
    // totalActivePointEffect,
    // activePointEffectNotAppliedDueToMax,
    // activePointEffectNotAppliedDueToNotExceeding,
    // defenseDescription,
    // effectsDescription,
    // targetCharOrPower,
    // isFade,
    // isEffectFinished,
    // targetActor,
) {
    const cardData = {
        item: attackItem,
        defenseDescription,
        effectsDescription,
        adjustment: {
            adjustmentDamageRaw: Math.abs(thisAttackActivePointsEffectRaw),
            thisAttackActivePointsEffect: Math.abs(thisAttackActivePointsEffect),
            adjustmentDamageThisApplication,
            adjustmentTarget: targetUpperCaseName,
            adjustmentTotalActivePointEffect: totalEffectActivePointsForXmlid,
            thisAttackActivePointAdjustmentNotAppliedDueToMax,
            thisAttackActivePointEffectNotAppliedDueToNotExceedingHealing,
            isFade,
            targetActor: targetActor,
            targetToken: targetToken || targetActor?.getActiveTokens()?.[0],
            attackerToken,
            isEffectFinished,
            costPerActivePoint,
            maximumEffectActivePoints,
            simplifiedHealing,
            attackItem,
        },
        isFade,
        //isEffectFinished,
        targetActor,
        targetToken,
        attackerToken,
    };

    return cardData;
}

/**
 *
 * Renders and creates a number of related adjustment chat messages for the same target
 *
 * @param {*} cardOrCards
 * @returns {Promise<void>}
 */
export async function renderAdjustmentChatCards(cardOrCards, adjustmentItemTags, defenseTags) {
    if (!Array.isArray(cardOrCards)) {
        cardOrCards = [cardOrCards];
    }

    // Filter out any invalid cards
    cardOrCards = cardOrCards.filter((card) => card).flat(); // Fades with multiple changes, so flat

    if (cardOrCards.length === 0) return;

    const cardData = {
        ...cardOrCards[0],
        item: cardOrCards[0].item,

        defenseDescription: cardOrCards[0].defenseDescription,
        defenseTags,

        activePoints: cardOrCards[0].adjustment.adjustmentDamageRaw,
        effectsDescription: cardOrCards[0].effectsDescription,
        isEffectFinished: cardOrCards[cardOrCards.length - 1].isEffectFinished,
        targetActor: cardOrCards[0].targetActor,
        adjustments: cardOrCards.map((card) => {
            return card.adjustment;
        }),

        adjustmentItemTags,
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-adjustment-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({
        actor: cardOrCards[0].targetActor,
    });

    const chatData = {
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    return ChatMessage.create(chatData);
}
