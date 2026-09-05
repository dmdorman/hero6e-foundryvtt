import { HEROSYS } from "../herosystem6e.mjs";
import { filterIgnoreCompoundAndFrameworkItems } from "../config.mjs";
import { getPowerInfo } from "./util.mjs";
import { calculateDicePartsForItem } from "./damage.mjs";

const { renderTemplate } = foundry.applications.handlebars;

/**
 * Actor items an adjustment power can legally target.
 */
export function isAdjustmentTargetItem(item) {
    return item.type === "power" && filterIgnoreCompoundAndFrameworkItems(item);
}

/**
 * Return the full list of possible powers and characteristics. No skills, talents, or perks.
 */
export function adjustmentSourcesPermissive({ actor, is5e, item }) {
    let choices = {};

    // Do we really have to have actor? I think we can proceed without it.
    // if (!actor) {
    //     console.warn(` ${item?.name} [${item?.uuid}] missing Actor`, item);
    //     return choices;
    // }

    is5e ??= actor?.is5e;
    is5e ??= item?.is5e;

    const powerList = is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    const powers = powerList.filter(
        (power) =>
            !power.type?.includes("skill") &&
            !power.type?.includes("perk") &&
            !power.type?.includes("talent") &&
            !power.type?.includes("framework") &&
            !power.type?.includes("compound") &&
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
        if (defensivePowerAdjustmentMultiplier({ XMLID: key, actor, is5e }) > 1) {
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

export function adjustmentSourcesStrict({ actor }) {
    let choices = {};

    if (!actor) return choices;

    const powerList = actor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    const powers = powerList.filter(
        (power) =>
            (power.type.includes("characteristic") || power.type.includes("movement")) &&
            !power.ignoreForActor?.(actor),
    );

    // Attack powers
    for (const item of actor.items.filter(isAdjustmentTargetItem)) {
        powers.push({ key: item.system.XMLID });
    }

    for (const power of powers) {
        let key = power.key;
        choices[key.toUpperCase()] = key.toUpperCase();
    }

    // Add * to defensive powers
    for (let key of Object.keys(choices)) {
        if (defensivePowerAdjustmentMultiplier({ XMLID: key, actor }) > 1) {
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

export function defensivePowerAdjustmentMultiplier({ XMLID, actor, is5e }) {
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

    if (item.actor?.is5e) {
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
        defensivePowerAdjustmentMultiplier({
            XMLID: targetCharacteristic.toUpperCase(),
            actor: targetActor,
            is5e: targetActor?.is5e,
        })
    );
}

export function determineCostPerActivePoint(targetCharacteristic, targetPower, targetActor) {
    if (!targetCharacteristic && !targetPower) {
        console.error(`Missing targetCharacteristic & targetPower`, targetActor);
    }

    const characteristic = targetActor.system?.[targetCharacteristic?.toUpperCase()];

    // Simplified Healing
    if (targetPower?.XMLID === "HEALING" && targetPower?.system.INPUT.match(/simplified/i)) {
        return 1;
    }

    return targetPower
        ? parseFloat(targetPower.activePoints / targetPower.system.LEVELS)
        : parseFloat(
              characteristic?.baseInfo.cost?.(characteristic) ||
                  characteristic?.baseInfo.costPerLevel?.(characteristic) ||
                  0,
          );
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

        activePoints: cardOrCards[0].adjustment?.adjustmentDamageRaw,
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
