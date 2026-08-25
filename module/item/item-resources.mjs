import { HeroRoller, DICE_SO_NICE_CUSTOM_SETS } from "../heroRoller/dice.mjs";
import { HEROSYS } from "../herosystem6e.mjs";
import { clamp } from "../utility/round.mjs";
import { whisperUserTargetsForActor } from "../utility/util.mjs";

/**
 * Multistage helper function useful for most item activations.
 * 1. Make sure the actor associated with the item has enough resources to activate the item.
 * 2. Return an error if actor does not have enough resources.
 *    a. If the item doesn't have enough charges it is an error.
 *    b. If the item uses an endurance battery and doesn't have enough END it is an error.
 *    c. If the user can use STUN in place of END prompt them for permission to do so. Return a warning if they don't want to use STUN.
 * 3. If there are enough resources, spend the resources and return full information.
 *
 * @param {HeroSystem6eItem} item
 * @param {Object} options
 * @param {boolean} [options.noResourceUse] - true to not consume resources but still indicate how many would have been consumed
 * @param {boolean} [options.forceStunUsage] - true to force STUN to be used if there is insufficient END
 * @param {number} [options.effectiveStr] - strength used for END calculations
 * @param {number} [options.boostableChargesToUse] - number of boostable charges to use
 * @param {number} [options.hthAttackItems] - pseudo strength items to use
 *
 * @returns Object - discriminated union based on error or warning being falsy/truthy
 */
export async function userInteractiveVerifyOptionallyPromptThenSpendResources(item, options) {
    const useResources = !options.noResourceUse;
    const resourceUsingItems = [
        item,
        ...(item.system._active.linkedEnd || []).map((linkedEndInfo) => linkedEndInfo.item),
        ...(item.system._active.linkedAssociated || []).map((linkedAssociatedInfo) => linkedAssociatedInfo.item),

        // PH: FIXME: This should probably be recursive as these linked items could have linked endurance
        // only items or linked items of their own (presumably).
        ...(item.system._active.linked || []).map((linkedInfo) => linkedInfo.item),
    ];

    // What resources are required to activate this power?
    // PH: FIXME: How should the options be applied? We generally design them to be applied against item. Should they equally apply
    //            to additional resource consuming linked items?
    const resourcesRequired = calculateRequiredResourcesToUse(resourceUsingItems, options);

    const actor = item.actor;
    const actorEndurance = actor.system.characteristics.end?.value || 0;

    // PH: FIXME: This needs to be reworked. Have kludged it with totalEnd.
    // PH: FIXME: Need to check if we're supposed to apply STUN for each individual power
    // Does the actor have enough endurance available?
    // NOTE: This only supports 1 endurance reserve and won't work with 2 powers drawing from separate endurance reserves.
    let actualStunDamage = 0;
    let actualStunRoller = null;
    if (useResources && resourcesRequired.totalEnd > Math.max(0, actorEndurance)) {
        // Automation or other actor without STUN?
        const hasSTUN = actor.hasCharacteristic("STUN");
        if (!hasSTUN) {
            return {
                error: `${item.detailedName()} needs ${resourcesRequired.totalEnd} END but ${actor.name} only has ${actorEndurance} END. This actor cannot use STUN for END`,
            };
        }

        // Is the actor willing to use STUN to make up for the lack of END?
        const potentialStunCost = calculateRequiredStunDiceForLackOfEnd(actor, resourcesRequired.totalEnd);

        if (!options.forceStunUsage) {
            const confirmed = await foundry.applications.api.DialogV2.confirm({
                window: { title: "USING STUN FOR ENDURANCE" },
                content: `<p><b>${item.name}</b> requires ${resourcesRequired.totalEnd} END. <b>${actor.name}</b> has ${actorEndurance} END.
                                Do you want to take ${potentialStunCost.stunDice}d6 STUN damage to make up for the lack of END?</p>`,
            });
            if (!confirmed) {
                return {
                    warning: `${item.detailedName()} needs ${resourcesRequired.totalEnd} END but ${actor.name} only has ${actorEndurance} END. The player is not spending STUN to make up the difference`,
                };
            }
        }

        ({ damage: actualStunDamage, roller: actualStunRoller } = await rollStunForEnd(potentialStunCost.stunDice));

        resourcesRequired.totalEnd = potentialStunCost.endSpentAboveZero;
    }

    // Does the actor have enough charges available?
    // PH: FIXME: This has changed the error format by including the item(s). Need to modify all callers once everything else in this function has been changed.
    if (useResources && resourcesRequired.totalCharges > 0) {
        const chargeUsingItemsWithInsufficientCharges = resourcesRequired.individualResourceUsage
            .filter((usage) => {
                const startingCharges = usage.item.system.numCharges;

                return usage.charges > startingCharges;
            })
            .filter((resource) => resource.charges > 0);
        const errorItemList = chargeUsingItemsWithInsufficientCharges.reduce(
            (error, current) =>
                error +
                `${error ? " " : ""}${current.item.detailedName()} does not have ${current.charges} charge${current.charges > 1 ? "s" : ""} remaining`,
            "",
        );
        if (errorItemList) {
            return {
                error: errorItemList,
            };
        }
    }

    // Does the actor's reserve have enough END available?
    // NOTE: This doesn't support multiple endurance reserves (but HD doesn't either)
    const enduranceReserve = actor.items.find((item) => item.system.XMLID === "ENDURANCERESERVE");
    if (useResources && resourcesRequired.totalReserveEnd > 0) {
        const reserveEnd = parseInt(enduranceReserve?.system.value || 0);

        if (enduranceReserve) {
            if (resourcesRequired.totalReserveEnd > reserveEnd) {
                return {
                    error: `${item.detailedName()} needs ${resourcesRequired.totalReserveEnd} END but ${enduranceReserve.name} only has ${reserveEnd} END`,
                };
            }
        } else {
            return {
                error: `${item.detailedName()} needs an endurance reserve to spend END but none found`,
            };
        }
    }

    // PH: FIXME: fix this up (charge spending items should be an array)
    // The actor is now committed to spending the resources to activate the power
    const { resourcesUsedDescription, resourcesUsedDescriptionRenderedRoll } = await spendResourcesToUse(
        item,
        resourcesRequired,
        actualStunDamage,
        actualStunRoller,
        enduranceReserve,
        !useResources,
    );

    // Let users know what resources were not consumed only if there were any to be consumed
    if (!useResources && resourcesUsedDescription) {
        const speaker = ChatMessage.getSpeaker({
            actor: actor,
            token: options.token,
        });
        //speaker.alias = item.actor.name;
        const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: `${game.user.name} is using ${overrideKeyText} to override using ${resourcesUsedDescription} for <b>${item.name}</b>${resourcesUsedDescriptionRenderedRoll}`,
            whisper: whisperUserTargetsForActor(this),
            speaker,
        };
        await ChatMessage.create(chatData);
    }

    return {
        resourcesRequired,

        // Provide a wordy description of what was used. Indicate if resource use was overridden except if no would have been used.
        resourcesUsedDescription: useResources
            ? `${resourcesUsedDescription}`
            : resourcesUsedDescription
              ? `${resourcesUsedDescription} overridden with override key`
              : resourcesUsedDescription,
        resourcesUsedDescriptionRenderedRoll,
    };
}

/**
 * @typedef {Object} HeroSystemIndividualItemResourcesToUse
 * @property {HeroSystem6eItem} item - Item the other properties relate to.
 * @property {number} end - Endurance consumed from actor's END characteristic.
 * @property {number} reserveEnd - Endurance consumed from the item's associated endurance reserve.
 * @property {number} charges - Charges consumed from the item.
 *
 */
/**
 * @typedef {Object} HeroSystemItemResourcesToUse
 * @property {number} totalEnd - Total endurance consumed from actor's END characteristic.
 * @property {number} totalReserveEnd - Total endurance consumed from the item's associated endurance reserve.
 * @property {number} totalCharges - Total charges consumed from the item.
 *
 * @property {Array<HeroSystemIndividualItemResourcesToUse>} individualResourceUsage - Total charges consumed from the item.
 *
 */

/**
 * Calculate the total expendable cost to use this item and any linked resource consuming items
 *
 * @param {Array<HeroSystem6eItem>} resourceUsingItems - Array of items which may consume resources
 * @param {Object} options
 *
 * @returns HeroSystemItemResourcesToUse
 */
export function calculateRequiredResourcesToUse(resourceUsingItems, options) {
    const individualResourceUsage = resourceUsingItems.map((item) =>
        calculateRequiredResourcesToUseForSingleItem(item, options),
    );

    return {
        totalEnd: sum(individualResourceUsage.map((itemResourceUsage) => itemResourceUsage.end)),
        totalCharges: sum(individualResourceUsage.map((itemResourceUsage) => itemResourceUsage.charges)),
        totalReserveEnd: sum(individualResourceUsage.map((itemResourceUsage) => itemResourceUsage.reserveEnd)),

        individualResourceUsage: individualResourceUsage,
    };
}

function sum(arrayOfNumbers) {
    return arrayOfNumbers.reduce((a, b) => a + b, 0);
}

/**
 * Calculate the total reserve endurance to use this item
 *
 * @param {HeroSystem6eItem} item
 * @param {Object} options
 *
 * @returns HeroSystemIndividualItemResourcesToUse
 */
function calculateRequiredResourcesToUseForSingleItem(item, options) {
    const chargesRequired = calculateRequiredCharges(item, options.boostableChargesToUse || 0);
    const reserveEndRequired = calculateRequiredReserveEndurance(item);
    const endRequired = calculateRequiredEnd(item, parseInt(options.effectiveStr) || 0);

    return {
        item: item,
        end: endRequired,
        reserveEnd: reserveEndRequired,
        charges: chargesRequired,
    };
}

/**
 * Calculate the total expendable charges, with boostable charges, to use this item
 *
 * @param {HeroSystem6eItem} item
 * @param {number} boostableChargesToUse
 *
 * @returns number
 */
function calculateRequiredCharges(item, boostableChargesToUse) {
    const startingCharges = item.system.numCharges;
    const maximumCharges = item.system.chargesMax || 0;
    let chargesToUse = 0;

    // Strength purchased as a power never costs resources. Strength only consumes resources when used. Internally, strength used for damage, is
    // tracked via a different XMLID ("__STRENGTHDAMAGE"). We don't distinguish the "I'm lifting something" case.
    // As well, we don't yet track strength resources used per phase (as they're supposed to be capped modulo exceptions like autofire).
    if (item.system.XMLID === "STR") {
        return 0;
    }

    // Does this item use charges?
    if (maximumCharges > 0) {
        // Maximum of 4
        const boostableChargesUsed = clamp(boostableChargesToUse, 0, Math.min(startingCharges - 1, 4));
        chargesToUse = 1 + boostableChargesUsed;
    }

    // How many applications?
    chargesToUse *= item.system._active.autofire?.shots || 1;

    return chargesToUse;
}

/**
 * Calculate the total expendable endurance to use this item
 *
 * @param {HeroSystem6eItem} item
 *
 * @returns number
 */
function calculateRequiredEnd(item) {
    let endToUse = 0;

    if (game.settings.get(HEROSYS.module, "use endurance")) {
        // If this item uses an endurance reserve, can it optionally draw from actor's endurance?
        if (item.system.USE_END_RESERVE && item.findModsByXmlid("ENDRESERVEOREND")) {
            ui.notifications.error(
                `Selecting to draw from END or END RESERVE not supported for ${item.detailedName()}. Please report.`,
            );
        }

        // If this item uses an endurance reserve, does it also draw from actor's endurance?
        if (item.system.USE_END_RESERVE && !item.findModsByXmlid("DOUBLEENDCOST")) {
            return 0;
        }

        // Strength purchased as a power never costs resources. Strength only consumes resources when used. Internally, strength used for damage, is
        // tracked via a different XMLID ("__STRENGTHDAMAGE"). We don't distinguish the "I'm lifting something" case.
        // As well, we don't yet track strength resources used per phase (as they're supposed to be capped modulo exceptions like autofire).
        if (item.system.XMLID === "STR") {
            return 0;
        }

        // Pushing uses 1 END per pushed CP
        const endPerShot = (item.end || 0) + (item.system._active.pushedRealPoints || 0);

        // How many shots?
        endToUse = endPerShot * (item.system._active.autofire?.shots || 1);
    }

    return endToUse;
}

/**
 * Calculate the total expendable endurance from a reserve to use this item
 *
 * @param {HeroSystem6eItem} item
 *
 * @returns number
 */
function calculateRequiredReserveEndurance(item) {
    let reserveEndToUse = 0;

    if (item.system.USE_END_RESERVE && game.settings.get(HEROSYS.module, "use endurance")) {
        // TODO: Lack of support for ENDRESERVEOREND is coded in calculateRequiredEnd
        // Strength purchased as a power never costs resources. Strength only consumes resources when used. Internally, strength used for damage, is
        // tracked via a different XMLID ("__STRENGTHDAMAGE"). We don't distinguish the "I'm lifting something" case.
        // As well, we don't yet track strength resources used per phase (as they're supposed to be capped modulo exceptions like autofire).
        if (item.system.XMLID === "STR") {
            return 0;
        }

        // Pushing uses 1 END per pushed CP
        const endPerShot = (item.end || 0) + (item.system._active.pushedRealPoints || 0);

        // How many shots?
        reserveEndToUse = endPerShot * (item.system._active.autofire?.shots || 1);
    }

    return reserveEndToUse;
}

/**
 * How many STUN dice are required for the actor spend enduranceToUse endurance
 *
 * @param {HeroSystem6eActor} actor
 * @param {number} enduranceToUse
 * @returns
 */
function calculateRequiredStunDiceForLackOfEnd(actor, enduranceToUse) {
    const actorEnd = actor.system.characteristics.end.value;
    let endSpentAboveZero = 0;
    let stunDice = 0;

    if (enduranceToUse > 0 && actorEnd - enduranceToUse < 0) {
        // 1d6 STUN for each 2 END spent beyond 0 END - always round up
        endSpentAboveZero = Math.max(actorEnd, 0);
        stunDice = Math.ceil(Math.abs(enduranceToUse - endSpentAboveZero) / 2);
    }

    return {
        endSpentAboveZero,
        stunDice,
    };
}

/**
 * Roll STUN damage
 *
 * @param {number} stunDice
 * @returns {Object} damage and roller
 */

async function rollStunForEnd(stunDice) {
    const stunForEndHeroRoller = new HeroRoller()
        .setPurpose(DICE_SO_NICE_CUSTOM_SETS.STUN_FOR_END)
        .makeBasicRoll()
        .addDice(stunDice, "STUN for END");

    await stunForEndHeroRoller.roll();

    const damage = stunForEndHeroRoller.getBasicTotal();

    return {
        damage,
        roller: stunForEndHeroRoller,
    };
}

/**
 * Parse the automation setting for the system. Return what should be automated for
 * this actor type.
 *
 * none: "No Automation",
 * npcOnly: "NPCs Only (end, stun, body)",
 * pcEndOnly: "PCs (end) and NPCs (end, stun, body)",
 * all: "PCs and NPCs (end, stun, body)"
 *
 * @typedef {Object} HeroSystem6eActorAutomation
 * @param {boolean} endurance - Automate END use/tracking
 * @param {boolean} stun - Automate STUN use/tracking
 * @param {boolean} body - Automate BODY use/tracking
 */
/**
 * @param {HeroSystem6eActor} actor
 * @returns {HeroSystem6eActorAutomation}
 */

export function actorAutomation(actor) {
    const automation = game.settings.get(HEROSYS.module, "automation");

    return {
        endurance:
            automation === "all" ||
            (automation === "npcOnly" && actor.type == "npc") ||
            (automation === "pcEndOnly" && actor.type === "pc"),
        stun: automation === "all" || (automation === "npcOnly" && actor.type == "npc"),
        body: automation === "all" || (automation === "npcOnly" && actor.type == "npc"),
    };
}
/**
 * Spend all resources (END, STUN, charges) provided. Assumes numbers are possible.
 *
 * @param {HeroSystem6eItem} item
 * @param {HeroSystemItemResourcesToUse} resourcesRequired
 * @param {number} stunToSpend
 * @param {HeroRoller} stunToSpendRoller
 * @param {HeroSystem6eItem} enduranceReserve
 * @param {boolean} noResourceUse - true if you would like to simulate the resources being used without using them (aka dry run)
 * @returns {Object}
 */

async function spendResourcesToUse(
    item,
    resourcesRequired,
    stunToSpend,
    stunToSpendRoller,
    enduranceReserve,
    noResourceUse,
) {
    const endToSpend = resourcesRequired.totalEnd;
    const reserveEndToSpend = resourcesRequired.totalReserveEnd;
    const chargesToSpend = resourcesRequired.totalCharges;

    const actor = item.actor;
    const expectedAutomation = actorAutomation(actor);
    const canSpendResources = !noResourceUse;
    const canSpendEndurance =
        canSpendResources &&
        actor.inCombat && // TODO: Not sure if we should have this or not. We had it in toggle() but not elsewhere.
        expectedAutomation.endurance;
    const canSpendStun = canSpendResources && expectedAutomation.stun;
    const canSpendCharges = canSpendResources;
    let resourcesUsedDescriptions = [];
    let resourcesUsedDescriptionRenderedRoll = "";

    // TODO: Spending charges should be against the individual item it relates to. While it doesn't generally matter for END
    //       as that comes from a single pool, END reserve and charges can come from different items. Right now, we assuming
    //       only a single END reserve and system END but we do support charges being spent from multiple items.
    // Deduct reserve END
    if (reserveEndToSpend) {
        if (enduranceReserve) {
            const reserveEnd = parseInt(enduranceReserve?.system.value || 0);
            const actorNewEndurance = reserveEnd - reserveEndToSpend;

            resourcesUsedDescriptions.push(`${reserveEndToSpend} END from Endurance Reserve`);

            if (canSpendEndurance) {
                await enduranceReserve.update({
                    "system.value": actorNewEndurance,
                    "system.description": enduranceReserve.system.description,
                });
            }
        }
    }

    // Deduct actor END
    if (endToSpend || stunToSpend) {
        const actorStun = actor.system.characteristics.stun.value;
        const actorEndurance = actor.system.characteristics.end.value;
        const actorNewEndurance = actorEndurance - endToSpend;
        const actorChanges = {};

        if (stunToSpend > 0) {
            resourcesUsedDescriptions.push(`
                <span>
                    ${endToSpend} END and ${stunToSpend} STUN
                    <i class="fal fa-circle-info" data-tooltip="<b>USING STUN FOR ENDURANCE</b><br>
                    A character at 0 END who still wishes to perform Actions
                    may use STUN as END. The character takes 1d6 STUN
                    damage (with no defense) for every 2 END (or fraction thereof)
                    expended. Yes, characters can Knock themselves out this way.
                    "></i>
                </span>
                `);

            resourcesUsedDescriptionRenderedRoll = await stunToSpendRoller.render();

            if (canSpendStun) {
                await ui.notifications.warn(`${actor.name} used ${stunToSpend} STUN for ENDURANCE.`);

                // NOTE: Can have a negative END for reasons other than spending END (e.g. drains), however, spend END on
                //       an attack can't lower it beyond its starting value or 0 (whichever is smaller).
                actorChanges["system.characteristics.stun.value"] = actorStun - stunToSpend;
            }
        } else {
            resourcesUsedDescriptions.push(`${endToSpend} END`);
        }

        if (canSpendEndurance) {
            actorChanges["system.characteristics.end.value"] = actorNewEndurance;

            await actor.update(actorChanges);
        }
    }

    // Spend charges
    if (chargesToSpend > 0) {
        resourcesRequired.individualResourceUsage
            .filter((usage) => usage.charges > 0)
            .forEach(async (usage) => {
                const chargesToSpend = usage.charges;

                resourcesUsedDescriptions.push(`${chargesToSpend} charge${chargesToSpend > 1 ? "s" : ""}`);

                if (canSpendCharges) {
                    const startingCharges = usage.item.system.numCharges;

                    await usage.item.system.setChargesAndSave(startingCharges - chargesToSpend);
                }
            });
    }

    let resourcesUsedDescription = "No END Or Charges"; // Catch all for 0 END from any sources and 0 CHARGES.
    if (resourcesUsedDescriptions.length > 0) {
        // Turn array of descriptions into a single string
        if (resourcesUsedDescriptions.length === 1) {
            resourcesUsedDescription = resourcesUsedDescriptions[0];
        } else if (resourcesUsedDescriptions.length === 2) {
            resourcesUsedDescription = `${resourcesUsedDescriptions[0]} and ${resourcesUsedDescriptions[1]}`;
        } else {
            resourcesUsedDescription = `${resourcesUsedDescriptions[0]}, ${resourcesUsedDescriptions[1]}, and ${resourcesUsedDescriptions[2]}`;
        }

        // Make a tooltip for the resource usage including all individual item usage
        const resourceBreakdownByItem = resourcesRequired.individualResourceUsage
            .map(
                (itemResources) =>
                    `${itemResources.item.detailedName()} required ${itemResources.end} END, ${itemResources.reserveEnd} END from endurance reserve, and ${itemResources.charges} charge${itemResources.charges !== 1 ? "s" : ""}`,
            )
            .join("\n");
        resourcesUsedDescription = `<span title="${resourceBreakdownByItem}">${resourcesUsedDescription}</span>`;
    }

    return {
        resourcesUsedDescription,
        resourcesUsedDescriptionRenderedRoll,
    };
}
