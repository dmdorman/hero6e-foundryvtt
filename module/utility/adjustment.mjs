import { HEROSYS } from "../herosystem6e.mjs";
import { getPowerInfo } from "./util.mjs";
import { RoundFavorPlayerUp } from "./round.mjs";

/**
 * Return the full list of possible powers and characteristics. No skills, talents, or perks.
 */
export function adjustmentSourcesPermissive(actor, is5e) {
    let choices = {};

    if (is5e !== false && is5e !== true && is5e !== undefined) {
        console.error("bad paramater", is5e);
        return choices;
    }

    const powerList = is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    const powers = powerList.filter(
        (power) => !power.type?.includes("skill") && !power.type?.includes("perk") && !power.type?.includes("talent"),
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

export function determineMaxAdjustment(item) {
    const reallyBigInteger = 1000000;

    // Certain adjustment powers have no fixed limit. Give them a large integer.
    if (
        item.system.XMLID !== "ABSORPTION" &&
        item.system.XMLID !== "AID" &&
        item.system.XMLID !== "SUCCOR" &&
        item.system.XMLID !== "TRANSFER"
    ) {
        return reallyBigInteger;
    }

    if (item.actor.system.is5e) {
        // Max pips in a roll is starting max base.
        let maxAdjustment = item.system.dice * 6;

        const extraDice = item.system.extraDice;
        switch (extraDice) {
            case "pip":
                maxAdjustment = maxAdjustment + 1;
                break;
            case "half":
                maxAdjustment = maxAdjustment + 3;
                break;
            case "one-pip":
                maxAdjustment = maxAdjustment + 5;
                break;
            default:
                break;
        }

        // Add INCREASEDMAX if available.
        const increaseMax = item.system.ADDER?.find((adder) => adder.XMLID === "INCREASEDMAX");
        maxAdjustment = maxAdjustment + (parseInt(increaseMax?.LEVELS) || 0);

        return maxAdjustment;
    } else {
        if (item.system.XMLID === "ABSORPTION") {
            let maxAdjustment = item.system.LEVELS * 2;

            const increasedMax = item.system.MODIFIER?.find((mod) => mod.XMLID === "INCREASEDMAX");
            if (increasedMax) {
                // Each level is 2x
                maxAdjustment = maxAdjustment * Math.pow(2, parseInt(increasedMax.LEVELS));
            }
            return maxAdjustment;
        }

        let maxAdjustment = item.system.dice * 6;

        const extraDice = item.system.extraDice;
        switch (extraDice) {
            case "pip":
                maxAdjustment = maxAdjustment + 1;
                break;
            case "half":
                maxAdjustment = maxAdjustment + 3;
                break;
            case "one-pip":
                maxAdjustment = maxAdjustment + 5;
                break;
            default:
                break;
        }

        return maxAdjustment;
    }
}

export function determineCostPerActivePoint(targetCharacteristic, targetPower, targetActor) {
    // TODO: Not sure we need to use the characteristic here...
    const powerInfo = getPowerInfo({
        xmlid: targetCharacteristic.toUpperCase(),
        actor: targetActor,
    });

    return (
        (targetPower
            ? parseFloat(targetPower.system.activePoints / targetPower.system.value)
            : parseFloat(powerInfo?.cost || powerInfo?.costPerLevel)) *
        defensivePowerAdjustmentMultiplier(targetCharacteristic.toUpperCase(), targetActor, targetActor?.is5e)
    );
}

function _findExistingMatchingEffect(item, potentialCharacteristic, powerTargetName, targetSystem) {
    // Caution: The item may no longer exist.
    return targetSystem.effects.find(
        (effect) =>
            effect.origin === item.uuid &&
            effect.flags.target[0] === (potentialCharacteristic || powerTargetName?.uuid),
    );
}

function _createAEChangeBlock(targetCharOrPower, targetSystem) {
    // TODO: Calculate this earlier so we don't have the logic in here
    return {
        key:
            targetSystem.system.characteristics?.[targetCharOrPower] != null
                ? `system.characteristics.${targetCharOrPower}.max`
                : "system.max",
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

    let durationInSeconds = 12;
    switch (durationOptionId) {
        case "TURN": // Not a real OPTIONID from HD
            durationInSeconds = 12;
            break;
        case "MINUTE":
            durationInSeconds = 60;
            break;
        case "FIVEMINUTES":
            durationInSeconds = 60 * 5;
            break;
        case "20MINUTES":
            durationInSeconds = 60 * 20;
            break;
        case "HOUR":
            durationInSeconds = 60 * 60;
            break;
        case "6HOURS":
            durationInSeconds = 60 * 60 * 6;
            break;
        case "DAY":
            durationInSeconds = 60 * 60 * 24;
            break;
        case "WEEK":
            durationInSeconds = 604800;
            break;
        case "MONTH":
            durationInSeconds = 2.628e6;
            break;
        case "SEASON":
            durationInSeconds = 2.628e6 * 3;
            break;
        case "YEAR":
            durationInSeconds = 3.154e7;
            break;
        case "FIVEYEARS":
            durationInSeconds = 3.154e7 * 5;
            break;
        case "TWENTYFIVEYEARS":
            durationInSeconds = 3.154e7 * 25;
            break;
        case "CENTURY":
            durationInSeconds = 3.154e7 * 100;
            break;
        default:
            console.error(
                `DELAYEDRETURNRATE for ${item.name}/${item.system.XMLID} has unhandled option ID ${durationOptionId}`,
            );
            break;
    }

    return durationInSeconds;
}

function _createNewAdjustmentEffect(
    item,
    potentialCharacteristic, // TODO: By this point we should know which it is.
    powerTargetName,
    rawActivePointsDamage,
    targetActor,
    targetSystem,
) {
    // Create new ActiveEffect
    // TODO: Add a document field
    const activeEffect = {
        name: `${item.system.XMLID || "undefined"} 0 ${
            (potentialCharacteristic || powerTargetName?.name)?.toUpperCase() // TODO: This will need to change for multiple effects
        } (0 AP) [by ${item.actor.name || "undefined"}]`,
        id: `${item.system.XMLID}.${item.id}.${
            potentialCharacteristic || powerTargetName?.name // TODO: This will need to change for multiple effects
        }`,
        icon: item.img,
        changes: [_createAEChangeBlock(potentialCharacteristic, targetSystem)],
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
            target: [potentialCharacteristic || powerTargetName?.uuid],
            key: potentialCharacteristic,
        },
        origin: item.uuid,

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
    item,
    nameOfCharOrPower,
    thisAttackRawActivePointsDamage,
    defenseDescription,
    effectsDescription,
    isFade,
    targetActor,
) {
    const isHealing = item.system.XMLID === "HEALING";
    const isOnlyToStartingValues = item.findModsByXmlid("ONLYTOSTARTING") || isHealing;

    const targetUpperCaseName = nameOfCharOrPower.toUpperCase();
    const potentialCharacteristic = nameOfCharOrPower.toLowerCase();

    // Search the target for this power.
    // TODO: will return first matching power. How can we distinguish without making users
    //       setup the item for a specific? Will likely need to provide a dialog. That gets
    //       us into the thorny question of what powers have been discovered.
    const targetPower = targetActor.items.find((item) => item.system.XMLID === targetUpperCaseName);

    // Find a matching characteristic. Because movement powers are unfortunately setup as
    // characteristics and always exist as properties, we need to check that they actually
    // have been bought or naturally exist (core > 0).
    const targetCharacteristic =
        targetActor.system.characteristics?.[potentialCharacteristic]?.core > 0
            ? targetActor.system.characteristics?.[potentialCharacteristic]
            : undefined;

    // Do we have a target?
    if (!targetCharacteristic && !targetPower) {
        return;
    }

    // Characteristics target an actor, and powers target an item
    const targetSystem = targetCharacteristic != null ? targetActor : targetPower;

    const targetValuePath =
        targetCharacteristic != null ? `system.characteristics.${potentialCharacteristic}.value` : `system.value`;

    const targetStartingValue = targetCharacteristic != null ? targetCharacteristic.value : targetPower.system.value;
    const targetStartingMax = targetCharacteristic != null ? targetCharacteristic.max : targetPower.system.max;
    const targetStartingCore = targetCharacteristic != null ? targetCharacteristic.core : targetPower.system.core;

    // Check for previous adjustment (i.e ActiveEffect) from same power against this target
    // and calculate the total effect
    const existingEffect = _findExistingMatchingEffect(item, potentialCharacteristic, targetPower, targetSystem);

    const activeEffect =
        existingEffect ||
        _createNewAdjustmentEffect(
            item,
            potentialCharacteristic,
            targetPower,
            thisAttackRawActivePointsDamage,
            targetActor,
            targetSystem,
        );

    // Healing doesn't fade
    if (existingEffect && isFade && isHealing) {
        const deletePromise = existingEffect.delete();

        const chatCard = _generateAdjustmentChatCard(
            item,
            existingEffect.flags.adjustmentActivePoints,
            0,
            0,
            0,
            0,
            defenseDescription,
            effectsDescription,
            potentialCharacteristic,
            true,
            true,
            targetActor,
        );

        await deletePromise;

        return chatCard;
    }

    // Healing is not cumulative. All else is.
    let thisAttackEffectiveAdjustmentActivePoints = isHealing
        ? thisAttackRawActivePointsDamage - activeEffect.flags.adjustmentActivePoints
        : thisAttackRawActivePointsDamage;
    const thisAttackActivePointEffectLostDueToNotExceeding = isHealing ? activeEffect.flags.adjustmentActivePoints : 0;
    let thisAttackActivePointAdjustmentLostDueToMax;
    const totalActivePointsStartingEffect =
        activeEffect.flags.adjustmentActivePoints + thisAttackEffectiveAdjustmentActivePoints;

    // TODO: This should be based on the targeted actor ... why is it not?
    // TODO: The code below might not work correctly with non integer costs per active point
    const costPerActivePoint = determineCostPerActivePoint(potentialCharacteristic, targetPower, targetActor);

    // Clamp max adjustment to the max allowed by the power.
    // TODO: Combined effects may not exceed the largest source's maximum for a single target. Similar strange variation of this rule for healing.
    if (totalActivePointsStartingEffect < 0) {
        // Healing may not exceed the core (starting value)
        let thisAttackActivePointsToUse = isOnlyToStartingValues
            ? Math.max(
                  thisAttackEffectiveAdjustmentActivePoints,
                  Math.min(targetStartingValue - targetStartingCore, 0) * costPerActivePoint,
              )
            : totalActivePointsStartingEffect;

        // Healing should not accumulate part points.
        if (isHealing) {
            thisAttackActivePointsToUse -= thisAttackActivePointsToUse % costPerActivePoint;
        }

        const max = Math.max(thisAttackActivePointsToUse, -determineMaxAdjustment(item));

        thisAttackActivePointAdjustmentLostDueToMax = isOnlyToStartingValues
            ? thisAttackRawActivePointsDamage - max - thisAttackActivePointEffectLostDueToNotExceeding
            : totalActivePointsStartingEffect - max;
        thisAttackEffectiveAdjustmentActivePoints = max;
    } else {
        const totalAdjustmentBeforeMin =
            thisAttackEffectiveAdjustmentActivePoints + activeEffect.flags.adjustmentActivePoints;
        const min = Math.min(totalAdjustmentBeforeMin, determineMaxAdjustment(item));

        thisAttackActivePointAdjustmentLostDueToMax =
            totalAdjustmentBeforeMin - min - thisAttackActivePointEffectLostDueToNotExceeding;
        thisAttackEffectiveAdjustmentActivePoints = min;
    }

    // New effect total.
    const totalAdjustmentNewActivePoints = isOnlyToStartingValues
        ? thisAttackEffectiveAdjustmentActivePoints + activeEffect.flags.adjustmentActivePoints
        : thisAttackEffectiveAdjustmentActivePoints;

    // Determine how many points of total effect there are based on the cost.
    const totalActivePointsThatShouldBeAffected = Math.trunc(totalAdjustmentNewActivePoints / costPerActivePoint);
    const totalActivePointAffectedDifference =
        totalActivePointsThatShouldBeAffected -
        Math.trunc(activeEffect.flags.adjustmentActivePoints / costPerActivePoint);

    // Shortcut here in case we have 0 adjustment done for performance. This will stop
    // active effects with 0 AP being created and unnecessary AE and characteristic no-op updates.
    if (totalAdjustmentNewActivePoints - activeEffect.flags.adjustmentActivePoints === 0) {
        return _generateAdjustmentChatCard(
            item,
            thisAttackRawActivePointsDamage,
            totalActivePointAffectedDifference,
            totalAdjustmentNewActivePoints,
            thisAttackActivePointAdjustmentLostDueToMax,
            thisAttackActivePointEffectLostDueToNotExceeding,
            defenseDescription,
            effectsDescription,
            potentialCharacteristic,
            isFade,
            false,
            targetActor,
        );
    }

    // Calculate the effect's change to the maximum. Only healing does not change the maximum.
    if (!isOnlyToStartingValues) {
        activeEffect.changes[0].value = parseInt(activeEffect.changes[0].value) - totalActivePointAffectedDifference;
    }

    // If this is 5e then some characteristics are calculated (not figured) based on
    // those. We only need to worry about 2: DEX -> OCV & DCV and EGO -> OMCV & DMCV.
    // These 2 characteristics are always at indices 2 and 3

    // TODO: This really only works when there is 1 effect happening to the characteristic.
    //       To fix would require separate boost tracking along with fractional boosts or
    //       not tracking the changes to OCV and DCV as active effects but have them recalculated
    //       as the characteristic max and value are changing.
    if (targetActor.system.is5e && activeEffect.changes[1]) {
        const newCalculatedValue = RoundFavorPlayerUp((targetStartingMax - totalActivePointAffectedDifference) / 3);
        const oldCalculatedValue = RoundFavorPlayerUp(targetStartingMax / 3);

        activeEffect.changes[1].value =
            parseInt(activeEffect.changes[1].value) + (newCalculatedValue - oldCalculatedValue);

        activeEffect.changes[2].value =
            parseInt(activeEffect.changes[2].value) + (newCalculatedValue - oldCalculatedValue);
    }

    // Update the effect max value(s)
    activeEffect.name = `${item.system.XMLID || "undefined"} ${Math.abs(totalActivePointsThatShouldBeAffected)} ${(
        potentialCharacteristic || targetPower?.name
    )?.toUpperCase()} (${Math.abs(totalAdjustmentNewActivePoints)} AP) [by ${item.actor.name || "undefined"}]`;

    activeEffect.flags.affectedPoints = totalActivePointsThatShouldBeAffected;
    activeEffect.flags.adjustmentActivePoints = totalAdjustmentNewActivePoints;

    const promises = [];

    const isEffectFinished = activeEffect.flags.adjustmentActivePoints === 0 && isFade;
    if (isEffectFinished) {
        promises.push(activeEffect.delete());
    } else if (!existingEffect) {
        promises.push(targetSystem.addActiveEffect(activeEffect));
    } else {
        promises.push(
            activeEffect.update({
                name: activeEffect.name,
                changes: activeEffect.changes,
                flags: activeEffect.flags,
            }),
        );
    }

    // Calculate the effect value(s)
    const newValue =
        totalActivePointAffectedDifference > 0
            ? Math.max(
                  targetStartingValue - totalActivePointAffectedDifference, // New value if we just subtract the difference
                  targetStartingMax - totalActivePointAffectedDifference, // New max value
              )
            : targetStartingValue - totalActivePointAffectedDifference;
    const changes = {
        [targetValuePath]: newValue,
    };

    if (targetActor.system.is5e && activeEffect.flags.target[1]) {
        const newCalculatedValue = RoundFavorPlayerUp((targetStartingMax - totalActivePointAffectedDifference) / 3);
        const oldCalculatedValue = RoundFavorPlayerUp(targetStartingMax / 3);
        const char1Value = targetActor.system.characteristics[activeEffect.flags.target[1]].value;
        const char2Value = targetActor.system.characteristics[activeEffect.flags.target[2]].value;

        changes[`system.characteristics.${activeEffect.flags.target[1]}.value`] =
            char1Value + (newCalculatedValue - oldCalculatedValue);
        changes[`system.characteristics.${activeEffect.flags.target[2]}.value`] =
            char2Value + (newCalculatedValue - oldCalculatedValue);
    }

    // Update the effect value(s)
    promises.push(targetSystem.update(changes));

    await Promise.all(promises);

    return _generateAdjustmentChatCard(
        item,
        thisAttackRawActivePointsDamage,
        totalActivePointAffectedDifference,
        totalAdjustmentNewActivePoints,
        thisAttackActivePointAdjustmentLostDueToMax,
        thisAttackActivePointEffectLostDueToNotExceeding,
        defenseDescription,
        effectsDescription,
        potentialCharacteristic,
        isFade,
        isEffectFinished,
        targetActor,
    );
}

function _generateAdjustmentChatCard(
    item,
    activePointDamage,
    activePointAffectedDifference,
    totalActivePointEffect,
    activePointEffectLostDueToMax,
    activePointEffectLostDueToNotExceeding,
    defenseDescription,
    effectsDescription,
    targetCharOrPower,
    isFade,
    isEffectFinished,
    targetActor,
) {
    const cardData = {
        item: item,

        defenseDescription: defenseDescription,
        effectsDescription: effectsDescription,

        adjustment: {
            adjustmentDamageRaw: activePointDamage,
            adjustmentDamageThisApplication: activePointAffectedDifference,
            adjustmentTarget: targetCharOrPower.toUpperCase(),
            adjustmentTotalActivePointEffect: totalActivePointEffect,
            activePointEffectLostDueToMax,
            activePointEffectLostDueToNotExceeding,
            isFade,
            targetActor: targetActor,
            targetToken: targetActor?.getActiveTokens()?.[0],
        },

        isEffectFinished,

        targetActor: targetActor,
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
    cardOrCards = cardOrCards.filter((card) => card);

    if (cardOrCards.length === 0) return;

    const cardData = {
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
        user: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    return ChatMessage.create(chatData);
}
