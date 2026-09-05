import { activateManeuver, doManeuverEffects, endHaymakerManeuver, maneuverHasBlockTrait } from "./maneuver.mjs";

import { HEROSYS } from "../herosystem6e.mjs";
import { filterIgnoreCompoundAndFrameworkItems } from "../config.mjs";

import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { performAdjustment } from "../actor/actor-adjustment.mjs";
import { getOffHandDefenseDcv } from "../actor/actor-utils.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";

import { ItemAttackFormApplicationV2 } from "../applications/item/item-attack-application-v2.mjs";

import { ItemAttackClubWeaponApplicationV2 } from "../applications/item/item-attack-application-club-weapon.mjs";

import {
    HeroSystem6eItem,
    doCharacteristicRollCheck,
    itemPostHitActionString,
    rollAblativeActivationCheck,
} from "../item/item.mjs";
import { isActivatedForThisUse } from "./item-requires-roll.mjs";

import { overrideCanAct } from "../settings/settings-helpers.mjs";

import { DICE_SO_NICE_CUSTOM_SETS, HeroRoller } from "../heroRoller/dice.mjs";
import { renderAdjustmentChatCards } from "../utility/adjustment.mjs";
import { Attack, actionFromJSON, actionToJSON } from "../utility/attack.mjs";
import {
    calculateDicePartsForItem,
    calculateStrengthMinimumForItem,
    combatSkillLevelsForAttack,
} from "../utility/damage.mjs";
import { activeEffectChanges } from "../utility/active-effects.mjs";
import { getActorDefensesVsAttack, getConditionalDefenses, getItemDefenseVsAttack } from "../utility/defense.mjs";
import { calculateDistanceBetween, calculateRangePenaltyFromDistanceInMetres } from "../utility/range.mjs";
import { roundFavorPlayerAwayFromZero, roundFavorPlayerTowardsZero } from "../utility/round.mjs";
import {
    calculateVelocityInSystemUnits,
    currentSceneUsesHexGrid,
    getGridSizeInMeters,
    getRoundedDownDistanceInSystemUnits,
    getSystemDisplayUnits,
} from "../utility/units.mjs";
import {
    activeSingleTrackerCombatFor,
    getPowerInfo,
    getTokenUuid,
    tokenEducatedGuess,
    whisperUserTargetsForActor,
} from "../utility/util.mjs";
import { userInteractiveVerifyOptionallyPromptThenSpendResources } from "./item-resources.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export async function chatListeners(_html) {
    const html = $(_html); // v13 compatibility
    html.on("click", "button.roll-damage", this._onRollDamage.bind(this));
    html.on("click", "button.apply-damage", this._onApplyDamage.bind(this));
    html.on("click", "button.generic-roller-apply-damage", this._onGenericRollerApplyDamage.bind(this));
    html.on("click", "button.rollAoe-damage", this._onRollAoeDamage.bind(this));
    html.on("click", "button.roll-knockback", this._onRollKnockback.bind(this));
    html.on("click", "button.roll-breakfall", this._onRollBreakfall.bind(this));
    html.on("click", "button.roll-mindscan", this._onRollMindScan.bind(this));
    html.on("click", "button.roll-mindscan-ego", this._onRollMindScanEffectRoll.bind(this));
    html.on("click", "div.adjustment-summary", this._onAdjustmentToolipExpandCollapse.bind(this));
    html.on("click", "i.modal-damage-card, span.modal-damage-card", this._onModalDamageCard.bind(this));
    html.on("click", "button.roll-powerToRemove", this._onRollPowerToRemove.bind(this));
    html.on("click", `button[data-action="spendHaps"]`, this._onSpendHaps.bind(this));
}

export async function onMessageRendered(html) {
    //[data-visibility="gm"]
    if (!game.user.isGM) {
        html.find(`[data-visibility="gm"]`).remove();
    }
    if (game.user.isGM) {
        html.find(`[data-visibility="redacted"]`).remove();
        html.find(`[data-visibility="!gm"]`).remove();
    }

    // visibility based on actor owner
    let element = html.find("div [data-visibility]");
    if (element) {
        let actorId = element.data("visibility");
        if (actorId) {
            let actor = game.actors.get(actorId);
            if (actor && !actor.isOwner) {
                element.remove();
            }
        }
    }
}

/**
 * Serialize an item to a plain source object, stripping the self-referential maneuver flag from
 * its ActiveEffects.
 *
 * A maneuver item carries an ActiveEffect whose flags include `dehydratedManeuverItem` - a full
 * dehydration of the item itself (see buildManeuverFlags in maneuver.mjs). Because that effect
 * lives on the item, serializing the item re-embeds that dehydrated copy, which embeds its own
 * effects' dehydrated copy, and so on. Every time the maneuver is (re)activated the effect is
 * rewritten with a fresh dehydration of the (now larger) item, so the blob roughly doubles each
 * time until it reaches tens of MB and JSON.stringify throws "RangeError: Invalid string length".
 * The dehydrated item never needs this redundant self-copy, so drop it to break the recursion.
 *
 * @param {HeroSystem6eItem} item
 * @returns {Object} plain item source
 */
function dehydrateItemSource(item) {
    const obj = item.toObject(false);

    for (const effect of obj.effects ?? []) {
        const systemFlags = effect.flags?.[game.system.id];
        if (systemFlags && "dehydratedManeuverItem" in systemFlags) {
            delete systemFlags.dehydratedManeuverItem;
        }
    }

    return obj;
}

/**
 * Turn an item into JSON.
 * Reverse the process with rehydrateAttackItem
 * @param {HeroSystem6eItem} item - what should be dehydrated
 */
export function dehydrateAttackItem(item) {
    const dehydratedObj = {};
    dehydratedObj.item = dehydrateItemSource(item);

    // If there is a base attack item, dehydrate it
    if (item.system._active.__baseAttackItem) {
        dehydratedObj.__baseAttackItem = dehydrateItemSource(item.system._active.__baseAttackItem);
        dehydratedObj.item.system._active.__baseAttackItem = null;
    }

    // If there is a strength item, dehydrate it
    if (item.system._active.effectiveStrItem) {
        dehydratedObj.effectiveStrItem = dehydrateItemSource(item.system._active.effectiveStrItem);
        dehydratedObj.item.system._active.effectiveStrItem = null;
    }

    // If there is a weapon for maneuvers, dehydrate it
    if (item.system._active.maWeaponItem) {
        dehydratedObj.maWeaponItem = dehydrateItemSource(item.system._active.maWeaponItem);
        dehydratedObj.item.system._active.maWeaponItem = null;
    }

    // If there are linked endurance items, then we need to dehydrate them as well.
    if (item.system._active.linkedEnd && item.system._active.linkedEnd.length > 0) {
        dehydratedObj.linkedEnd = item.system._active.linkedEnd.map((linkedEndItem) => {
            return {
                item: dehydrateItemSource(linkedEndItem.item),
                uuid: linkedEndItem.uuid,
            };
        });
        dehydratedObj.item.system._active.linkedEnd = null;
    }

    // If there are linked associated items, then we need to dehydrate them as well.
    if (item.system._active.linkedAssociated && item.system._active.linkedAssociated.length > 0) {
        dehydratedObj.linkedAssociated = item.system._active.linkedAssociated.map((linkedAssociatedItem) => {
            return {
                item: dehydrateItemSource(linkedAssociatedItem.item),
                uuid: linkedAssociatedItem.uuid,
            };
        });
        dehydratedObj.item.system._active.linkedAssociated = null;
    }

    // If there are linked items, then we need to dehydrate them as well.
    if (item.system._active.linked && item.system._active.linked.length > 0) {
        dehydratedObj.linked = item.system._active.linked.map((linkedItem) => {
            return {
                item: dehydrateItemSource(linkedItem.item),
                uuid: linkedItem.uuid,
            };
        });
        dehydratedObj.item.system._active.linked = null;
    }

    const stringifiedItem = JSON.stringify(dehydratedObj);
    return stringifiedItem;
}

/**
 * Rehydrates a JSON object created by dehydrateAttackItem
 * @param {Object} rollInfo
 */
export function rehydrateActorAndAttackItem(rollInfo) {
    const actor = fromUuidSync(rollInfo.actorUuid);

    return rehydrateAttackItem(rollInfo.itemJsonStr, actor);
}

/**
 * Rehydrates a JSON object created by dehydrateAttackItem
 * @param {string} itemJsonStr
 * @param {*} actor
 */
export function rehydrateAttackItem(itemJsonStr, actor) {
    const obj = JSON.parse(itemJsonStr);

    const item = HeroSystem6eItem.fromSource(obj.item, {
        parent: actor,
    });

    // fromSource can come up without the transient _active state; restore the
    // dehydrated copy (it carries __originalUuid/effectiveStr) so the effective-
    // item getters and resource math see the declared state
    item.system._active ??= obj.item.system?._active ?? {};

    // If there is a base attack item, then we need to rehydrate it.
    if (obj.__baseAttackItem) {
        item.system._active.__baseAttackItem = HeroSystem6eItem.fromSource(obj.__baseAttackItem, {
            parent: actor,
        });
    }

    // If there is a strength item, then we need to rehydrate it.
    if (obj.effectiveStrItem) {
        item.system._active.effectiveStrItem = HeroSystem6eItem.fromSource(obj.effectiveStrItem, {
            parent: actor,
        });
    }

    // If there is a maneuver item, then we need to rehydrate it.
    if (obj.maWeaponItem) {
        item.system._active.maWeaponItem = HeroSystem6eItem.fromSource(obj.maWeaponItem, {
            parent: actor,
        });
    }

    // If there are linked endurance items, then we need to rehydrate them as well.
    if (obj.linkedEnd) {
        obj.linkedEnd.forEach((linkedEndItemData) => {
            linkedEndItemData.item = HeroSystem6eItem.fromSource(linkedEndItemData.item, {
                parent: actor,
            });
        });
        item.system._active.linkedEnd = obj.linkedEnd;
    }

    // If there are linked associated items, then we need to rehydrate them as well.
    if (obj.linkedAssociated) {
        obj.linkedAssociated.forEach((linkedEndItemData) => {
            linkedEndItemData.item = HeroSystem6eItem.fromSource(linkedEndItemData.item, {
                parent: actor,
            });
        });
        item.system._active.linkedAssociated = obj.linkedAssociated;
    }

    // If there are linked items, then we need to rehydrate them as well.
    if (obj.linked) {
        obj.linked.forEach((linkedItemData) => {
            linkedItemData.item = HeroSystem6eItem.fromSource(linkedItemData.item, {
                parent: actor,
            });
        });
        item.system._active.linked = obj.linked;
    }

    return { actor, item };
}

/**
 * Dialog box for collectActionDataBeforeToHitOptions. The action doesn't have to be an attack (such as
 * the Block maneuver).
 */
export async function collectActionDataBeforeToHitOptions(item, options = {}) {
    const actor = item.actor;
    const token = options.token ?? tokenEducatedGuess({ token: options.token, actor: actor });

    // Is our token from a different scene?
    // If so bail as range and other calculations may be incorrect.
    if (token && token.parent?.constructor.name === "Scene" && token.parent.id !== canvas.scene.id) {
        return ui.notifications.error(
            `${token.actor.name} was opened on scene <b>${token.parent.name}</b>. 
            Close this actor sheet and reopen it so the proper token can be determined for range and other calculations.`,
        );
    }

    const data = {
        originalItem: item,
        actor: actor,
        token: token,
        state: null,
        str: item.actor.system.characteristics.str?.value,
    };

    // Uses Tk
    const tkItems = item.actor.items.filter((o) => o.system.XMLID == "TELEKINESIS");
    let tkStr = 0;
    for (const item of tkItems) {
        tkStr += parseInt(item.system.LEVELS) || 0;
    }
    if (item.system.usesTk) {
        if (item.system.usesStrength) {
            data.str += tkStr;
        } else {
            data.str = tkStr;
        }
    }

    // Maneuvers and Martial attacks may include velocity
    // [NORMALDC] +v/5 Strike, FMove
    if ((item.system.effect || "").match(/v\/\d+/)) {
        data.showVelocity = true;
        data.velocity = calculateVelocityInSystemUnits(item.actor);
        data.velocitySystemUnits = getSystemDisplayUnits(item.is5e);
    }

    if (item.system.XMLID === "CLUBWEAPON") {
        data.nextApplication = ItemAttackFormApplicationV2;
        await new ItemAttackClubWeaponApplicationV2(data).render(true);
    } else {
        await new ItemAttackFormApplicationV2(data).render(true);
    }
}

export async function getTargetArray(formData) {
    let targetArray = Array.from(game.user.targets);

    // Make sure player who rolled attack is still the same
    if (formData.userId && formData.userId !== game.user.id && game.users.get(formData.userId)) {
        // GM or someone else intervened.  Likely an AOE template placement confirmation.
        // Need to check if they are the same targets
        const userTargetArray = Array.from(game.users.get(formData.userId).targets);
        if (
            JSON.stringify(targetArray.map((o) => o.document.id)) !==
            JSON.stringify(userTargetArray.map((o) => o.document.id))
        ) {
            let html = `<table><tr><th width="50%">${game.user.name}</th><th width="50%">${game.users.get(formData.userId).name}</th></tr><tr><td><ol>`;
            for (const target of targetArray) {
                html += `<li style="text-align:left">${target.name}</li>`;
            }
            html += "</ol></td><td><ol>";
            for (const target of userTargetArray) {
                html += `<li style="text-align:left">${target.name}</li>`;
            }
            html += "</ol></td></tr></table>";
            targetArray = await foundry.applications.api.DialogV2.wait({
                window: { title: `Pick target list` },
                content: html,
                buttons: [
                    {
                        action: "gm",
                        label: game.user.name,
                        default: true,
                        callback: () => targetArray,
                    },
                    {
                        action: "user",
                        label: game.users.get(formData.userId).name,
                        callback: () => userTargetArray,
                    },
                ],
            });
        }
    }

    return targetArray;
}

/**
 * Whether the actor has a Haymaker resolution pending in a single-tracker combat —
 * its -5 DCV effect must persist until the landing segment ends.
 * @param {Actor} actor
 * @returns {boolean}
 */
function findScheduledHaymaker(actor) {
    const active = activeSingleTrackerCombatFor(actor);
    if (!active) return null;
    return active.combat.hasDelayedAction(active.combatant, "haymaker") ? active : null;
}

function hasScheduledHaymaker(actor) {
    return findScheduledHaymaker(actor) !== null;
}

/**
 * The declaration payload a delayed attack's resolution card replays from.
 * Only plain values survive the flag round-trip — the replay recomputes the
 * rest. The attack item is often a TEMPORARY effective clone whose uuid
 * resolves to nothing later; dehydrate it (the regions' pattern) so the replay
 * can always rebuild it, and keep the original DB item's uuid as a fallback.
 * @param {Item} item
 * @param {object} formData - The attack dialog's inputs
 * @param {object} options
 * @param {boolean} options.prepaid - Whether resources and rolls were spent at declaration
 * @returns {object}
 */
function buildDelayedActionData(item, formData, { prepaid }) {
    const sanitizedFormData = {};
    for (const [key, value] of Object.entries(formData ?? {})) {
        if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
            sanitizedFormData[key] = value;
        }
    }
    let itemJson = null;
    try {
        // dehydrateAttackItem already returns a JSON string
        itemJson = dehydrateAttackItem(item);
    } catch (e) {
        console.error(`Unable to dehydrate ${item.name} for its delayed resolution`, e);
    }
    return {
        formData: sanitizedFormData,
        targetTokenIds: Array.from(game.user.targets).map((t) => t.id),
        userId: game.user.id,
        itemJson,
        originalItemUuid: item.system?._active?.__originalUuid ?? null,
        actorUuid: item.actor?.uuid ?? null,
        prepaid,
    };
}

/**
 * Under the single tracker, a declared Haymaker doesn't launch until the very
 * end of the NEXT Segment (6E2 68-69; 5ER 389): nothing is rolled now. The
 * declaration is stored on the schedule and the landing card offers the actual
 * attack roll — with the maneuver still active, so its +4 DC and -5 DCV apply.
 * Unlike Extra Time, END is paid in the segment the attack LAUNCHES, so the
 * replay spends resources normally.
 * @param {Item} item
 * @param {object} formData - The attack dialog's inputs
 * @returns {Promise<boolean>} True when the attack was intercepted and scheduled
 */
async function scheduleHaymakerDeclaration(item, formData) {
    const actor = item?.actor;
    if (!actor) return false;
    const active = activeSingleTrackerCombatFor(actor);
    if (!active) return false;
    const { combat } = active;

    const currentAbs = combat.round * 12 + combat.segment;
    await combat.scheduleDelayedAction(
        actor,
        {
            kind: "haymaker",
            label: "their Haymaker",
            resolveAbs: currentAbs + 1,
            priority: null,
            commit: false,
            actionData: buildDelayedActionData(item, formData, { prepaid: false }),
        },
        item,
    );
    return true;
}

/**
 * Under the single tracker, an attack with the Extra Time Limitation begins
 * activating now but is ROLLED when it goes off (6E1 377-378): resources and
 * activation/RSR rolls are paid up front per RAW (lost on interruption), the
 * dialog's inputs and targets are stored on the schedule, and the resolution
 * card offers the actual attack roll.
 * @param {Item} item
 * @param {object} formData - The attack dialog's inputs
 * @returns {Promise<boolean>} True when the attack was intercepted (scheduled
 *   or consumed by a failed up-front activation)
 */
async function scheduleExtraTimeAttackDeclaration(item, formData) {
    const actor = item?.actor;
    if (!actor) return false;
    const active = activeSingleTrackerCombatFor(actor);
    if (!active) return false;
    const { combat, combatant: schedulingCombatant } = active;
    const plan = combat.extraTimePlan(actor, item) ?? combat.extraTimePlan(actor, item.effectiveAttackItem);
    if (!plan) return false;

    // Dedupe BEFORE paying: the item shows no active state while the schedule is
    // pending, so a second click would otherwise double-spend and double-schedule
    const itemUuid = item?.uuid ?? null;
    const pending = [...(combat.delayedActionsFor?.(schedulingCombatant) ?? [])].some(
        ([, record]) => record.label === plan.label || (itemUuid && record.itemUuid === itemUuid),
    );
    if (pending) {
        ui.notifications.warn(`${item.name} is already being activated.`);
        return true;
    }

    // RAW: END is committed when the activation begins and stays spent if it is
    // interrupted; activation/RSR rolls happen now too. The dialog's formData
    // carries effective STR / boostable charges — without it the spend undercharges
    const { error, warning } = await userInteractiveVerifyOptionallyPromptThenSpendResources(item, formData ?? {});
    if (error) {
        ui.notifications.error(`${item.name} ${error}`);
        return true;
    }
    if (warning) {
        ui.notifications.warn(`${item.name} ${warning}`);
        return true;
    }
    // The replay skips ALL RSR on prepaid, so both rolls happen here (the roll
    // site checks base and effective items separately — mirror that)
    if (!(await isActivatedForThisUse(item, {}))) return true; // attempt failed; resources stay spent
    const sameEffective =
        item.system._active?.__originalUuid === item.effectiveAttackItem?.system?._active?.__originalUuid;
    if (!sameEffective && item.effectiveAttackItem && !(await isActivatedForThisUse(item.effectiveAttackItem, {}))) {
        return true; // attempt failed; resources stay spent
    }

    await combat.scheduleDelayedAction(
        actor,
        {
            ...plan,
            kind: "attack",
            actionData: buildDelayedActionData(item, formData, { prepaid: true }),
        },
        item,
    );
    return true;
}

export async function processActionToHit(item, formData, options = {}) {
    const targetArray = await getTargetArray(formData);
    const action = Attack.buildActionInfo(item, targetArray, { ...formData, ...options });
    if (!action) {
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    // Can haymaker anything except for maneuvers because it is a maneuver itself. The strike manuever is the 1 exception.
    const haymakerManeuverActive = item.actor?.items.find(
        (anItem) => anItem.isCombatManeuver && anItem.system.XMLID === "HAYMAKER" && anItem.isActive,
    );
    if (haymakerManeuverActive) {
        if (item.isMartialManeuver || (item.isCombatManeuver && item.system.XMLID !== "STRIKE")) {
            return ui.notifications.error("Haymaker cannot be combined with another maneuver except Strike.", {
                localize: true,
            });
        }
    }

    // PH: FIXME: Need to not pass in formData and move the interesting stuff into action

    // A Haymaker launches at the very end of the NEXT Segment (6E2 68-69):
    // nothing is rolled now — the landing card offers the attack roll while the
    // maneuver (and its +4 DC / -5 DCV) stays active
    if (!formData?.delayedResolution && !options?.delayedResolution) {
        if (haymakerManeuverActive) {
            const scheduled = findScheduledHaymaker(item.actor);
            if (scheduled) {
                // A Haymaker is already winding up: performing any other attack
                // ruins it (6E2 69) — cancel the schedule (its teardown ends the
                // maneuver) and roll this attack normally
                await scheduled.combat.cancelHaymaker(scheduled.combatant.id);
            } else {
                try {
                    if (await scheduleHaymakerDeclaration(item, formData)) return;
                } catch (e) {
                    console.error(e);
                }
            }
        }
        // Extra Time attacks (6E1 377-378): the activation begins now — resources
        // and activation rolls are paid up front — but the attack itself is rolled
        // when the power goes off
        try {
            if (await scheduleExtraTimeAttackDeclaration(item, formData)) return;
        } catch (e) {
            console.error(e);
        }
    }

    // Manual targeting resolves an AoE per-target via the single-target path, not the origin roll.
    if (item.effectiveAttackItem.getAoeModifier() && !formData.aoeManualTargeting) {
        await doAoeActionToHit(action, formData, options);
    } else {
        await doSingleTargetActionToHit(action, formData, options);
    }

    // turn off haymaker — the wind-up is over once the attack has rolled. A still-
    // SCHEDULED landing keeps its maneuver active (this path is the mid-wait case
    // of some other attack being fired, or the landing replay after its record
    // was consumed).
    if (!hasScheduledHaymaker(item?.actor)) {
        await endHaymakerManeuver(item?.actor);
    }
}

/**
 * Compute and add range penalties based on the range, attack item, and actor into the provided attackHeroRoller
 *
 * @param {Number} distance
 * @param {HeroSystem6eItem} attackItem
 * @param {HeroSystem6eActor} actor
 * @param {HeroRoller} attackHeroRoller
 *
 * @returns Number - Remaining range penalty. Should be a number that is negative or 0.
 */
export function addRangeIntoToHitRoll(distance, attackItem, actor, attackHeroRoller) {
    // PH: FIXME: This is different between AoE and single target. Can we combine?
    const baseRangePenalty = -calculateRangePenaltyFromDistanceInMetres(distance, actor);
    let remainingRangePenalty = baseRangePenalty;

    if (attackItem.effectiveAttackItem.system.range === CONFIG.HERO.RANGE_TYPES.SELF) {
        // TODO: Should not be able to use this on anyone else. Should add this check well before here (in to hit dialog).
    }

    // TODO: Should consider if the target's range exceeds the power's range or not and display some kind of warning
    //       in case the system has calculated it incorrectly. Should add this check well before here (in to hit dialog).

    const noRangeModifiers = !!attackItem.effectiveAttackItem.findModsByXmlid("NORANGEMODIFIER");
    const normalRange = !!attackItem.effectiveAttackItem.findModsByXmlid("NORMALRANGE");

    // There are no range penalties if this is a line of sight power or it has been bought with
    // no range modifiers.
    if (!(
        attackItem.effectiveAttackItem.system.range === CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT ||
        attackItem.effectiveAttackItem.system.range === CONFIG.HERO.RANGE_TYPES.SPECIAL ||
        noRangeModifiers ||
        normalRange
    )) {
        attackHeroRoller.addNumber(
            baseRangePenalty,
            `Range penalty (${getRoundedDownDistanceInSystemUnits(distance, attackItem.actor.is5e)}${getSystemDisplayUnits(attackItem.actor.is5e)})`,
        );

        // PENALTY_SKILL_LEVELS (range)
        // PH: FIXME: PSLs for maneuver and PSLs for a weapon. What kind of stacking is possible?
        for (const pslItem of attackItem.effectiveAttackItem.psls(CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES.range)) {
            // Requires A Roll? Only include if successful.
            // PH: FIXME: This should store the active state until the next phase? DCV and DC should,
            //            presumably, also not be active for the next phase.
            // if (!(await isActivatedForThisUse(pslItem, {}))) {
            //     continue;
            // }

            const pslOffsets = Math.min(parseInt(pslItem.system.LEVELS), -remainingRangePenalty);
            remainingRangePenalty += pslOffsets;
            attackHeroRoller.addNumber(
                pslOffsets,
                "Penalty Skill Levels",
                `${pslItem.name} ${pslItem.system.LEVELS.signedString()} offset`,
            );
        }

        // Some maneuvers have a built in RANGE value (like a range PSL). These are only possible from the maneuver item.
        const maneuverRangeOffset = parseInt(attackItem.system.RANGE || 0);
        const maneuverRangeOffsets = Math.min(maneuverRangeOffset, -remainingRangePenalty);
        remainingRangePenalty += maneuverRangeOffsets;
        attackHeroRoller.addNumber(
            maneuverRangeOffsets,
            "Maneuver bonus",
            `${attackItem.name} RANGE ${maneuverRangeOffset.signedString()}`,
        );

        // Brace (+2 OCV only to offset the Range Modifier)
        const braceManeuver = attackItem.actor.items.find(
            (item) => item.type == "maneuver" && item.name === "Brace" && item.isActive,
        );
        if (braceManeuver) {
            const braceRangeOffset = braceManeuver.system.RANGE;
            const braceOffsets = Math.min(braceRangeOffset, -remainingRangePenalty);
            remainingRangePenalty += braceOffsets;
            attackHeroRoller.addNumber(
                braceOffsets,
                "Brace modifier",
                `Brace maneuver ${braceRangeOffset.signedString()} offset`,
            );
        }

        // If we have half range penalty modifier, the halving, as with all Hero System calculations, must happen after all additions and subtractions.
        const hasHalfRangePenalty = !!attackItem.findModsByXmlid("HALFRANGEMODIFIER");
        if (hasHalfRangePenalty) {
            // Round in favour of the player (given the range penalty is a negative or 0 that means rounding up)
            const halvedRangePenaltyOffset = Math.abs(
                remainingRangePenalty - roundFavorPlayerTowardsZero(remainingRangePenalty / 2),
            );

            attackHeroRoller.addNumber(
                halvedRangePenaltyOffset,
                "Half range modifier",
                `Range penalty halved: ${remainingRangePenalty} -> ${remainingRangePenalty + halvedRangePenaltyOffset}`,
            );

            remainingRangePenalty += halvedRangePenaltyOffset;
        }
    }

    return remainingRangePenalty;
}

/**
 * Add CSL modifiers that are associated with the attack. This means that we ignore CSLs that are solely defensive.
 *
 * @param {*} action
 * @param {HeroRoller} attackHeroRoller
 */
export async function addAttackCslsIntoToHitRoll(action, attackHeroRoller, _item) {
    const item = _item ?? action.system.currentItem;

    const skillLevelMods = {};
    for (const csl of combatSkillLevelsForAttack(item).details) {
        // Requires A Roll? Only include if successful.
        // PH: FIXME: This should store the active state until the next phase? DCV and DC should,
        //            presumably, also not be active for the next phase.
        if (!(await isActivatedForThisUse(csl.item, {}))) {
            continue;
        }

        const id = csl.item.id;
        skillLevelMods[id] = skillLevelMods[id] ?? { ocv: 0, omcv: 0, dcvHth: 0, dcvRanged: 0, dmcv: 0, dc: 0 };
        const cvMod = skillLevelMods[id];
        action.system.item[id] = csl.item;

        cvMod.dc += csl.dc;
        cvMod.ocv += csl.ocv;
        cvMod.omcv += csl.omcv;
        cvMod.dcvHth += csl.dcvHth;
        cvMod.dcvRanged += csl.dcvRanged;
        cvMod.dmcv += csl.dmcv;
    }

    const cvModifiers = action.current.cvModifiers;
    Object.keys(skillLevelMods).forEach((key) => {
        const cvMod = Attack.makeCvModifierFromItem(
            action.system.item[key],
            action.system,
            skillLevelMods[key].ocv,
            skillLevelMods[key].omcv,
            0, // NOTE: Can't make CSLs into DCV modifiers at the to-hit phase. Done elsewhere.
            0, // NOTE: Can't make CSLs into DMCV modifiers at the to-hit phase. Done elsewhere.
            0, // NOTE:  Can't make CSLs into DC additions at the to-hit phase. Done elsewhere.
        );
        cvModifiers.push(cvMod);
    });

    cvModifiers.forEach((cvModifier) => {
        if (cvModifier.cvMod.ocv) {
            attackHeroRoller.addNumber(cvModifier.cvMod.ocv, cvModifier.name);
        }

        if (cvModifier.cvMod.omcv) {
            attackHeroRoller.addNumber(cvModifier.cvMod.omcv, cvModifier.name);
        }
    });

    Attack.makeActionActiveEffects(action);
}

async function addAttackHitLocationsIntoToHitRoll(item, attackHeroRoller, options) {
    let remainingAimOcvPenalty = 0;

    if (
        game.settings.get(HEROSYS.module, "hit locations") !== "noHitLocations" &&
        options.aim &&
        options.aim !== "none"
    ) {
        const aimTargetLocation =
            game.settings.get(HEROSYS.module, "hitLocTracking") === "all" && options.aimSide !== "none"
                ? `${options.aimSide} ${options.aim}`
                : options.aim;

        // Figure out the OCV penalty for the hit location or special hit locations.
        const locationAimOcvPenalty = CONFIG.HERO.hitLocations[options.aim]?.ocvMod || 0;
        remainingAimOcvPenalty = locationAimOcvPenalty;
        if (remainingAimOcvPenalty) {
            attackHeroRoller.addNumber(remainingAimOcvPenalty, `Placed Shot: ${aimTargetLocation}`);
        }

        // Penalty Skill Levels
        // PH: FIXME: need to consider both the item and the effectiveAttackItem
        for (const psl of item.psls(CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES.location)) {
            // Requires A Roll? Only include if successful.
            // PH: FIXME: This should store the active state until the next phase? DCV and DC should,
            //            presumably, also not be active for the next phase.
            if (!(await isActivatedForThisUse(psl, {}))) {
                continue;
            }

            const pslHitLocationMaxOffset = psl.system.LEVELS;
            const pslHitLocationOffset = Math.min(pslHitLocationMaxOffset, -remainingAimOcvPenalty);
            remainingAimOcvPenalty += pslHitLocationOffset;
            attackHeroRoller.addNumber(
                pslHitLocationOffset,
                psl.name,
                pslHitLocationOffset === 0
                    ? `${pslHitLocationMaxOffset} max placed shot offset -> ${pslHitLocationOffset} actual offset`
                    : "",
            );
        }
    }

    return remainingAimOcvPenalty;
}

export async function doAoeActionToHit(action, options) {
    if (!action) {
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    const item = action.system.currentItem;
    const actor = action.system.actor;
    const token = action.system.attackerToken;
    if (!token) {
        return ui.notifications.error(`Unable to find a token on this scene associated with ${actor.name}.`);
    }

    // Paranoia setting = HIGH. Can be removed if we feel the need.
    const tokenId = token.id || token.document.id;
    const storedTokenId = action.system.attackerToken.id || action.system.attackerToken.document.id;
    if (tokenId !== storedTokenId) {
        console.error(
            `Token stored for attacker in action is not the same as the educated guess!`,
            tokenId,
            storedTokenId,
        );
    }

    const hitCharacteristic = actor.system.characteristics.ocv.value;
    const setManeuver = item.actor.items.find(
        (item) => item.type == "maneuver" && item.name === "Set" && item.isActive,
    );

    const attackHeroRoller = new HeroRoller()
        .makeSuccessRoll()
        .addNumber(11, "Base to hit")
        .addNumber(hitCharacteristic, item.system.attacksWith, undefined, { showZero: true })
        .addNumber(parseInt(options.ocvMod) || 0, "OCV modifier")
        .addNumber(parseInt(options.omcvMod) || 0, "OMCV modifier")
        .addNumber(setManeuver?.system.ocv || 0, "Set Maneuver");

    const aoeTemplate = item.effectiveAttackItem.getAoeTemplateForBaseItem;
    if (!aoeTemplate) {
        return ui.notifications.error(`Attack AoE template was not found.`);
    }

    const distance = calculateDistanceBetween(aoeTemplate, token).distance;
    let dcvTargetNumber = 0;
    if (distance > (actor.system.is5e ? 1 : 2)) {
        dcvTargetNumber = 3;
    }

    // Range modifiers
    addRangeIntoToHitRoll(distance, item, actor, attackHeroRoller);

    // Combat Skill Levels
    await addAttackCslsIntoToHitRoll(action, attackHeroRoller);

    // This is the actual roll to hit. In order to provide for a die roll
    // that indicates the upper bound of DCV hit, we have added the base (11) and the OCV, and subtracted the mods
    // and lastly we subtract the die roll. The value returned is the maximum DCV hit
    // (so we can be sneaky and not tell the target's DCV out loud).
    attackHeroRoller.addDice(-3);

    await attackHeroRoller.roll();
    const autoSuccess = attackHeroRoller.getAutoSuccess();
    const hitRollTotal = attackHeroRoller.getSuccessTotal();
    const renderedRollResult = await attackHeroRoller.render();

    let hitRollText = `AoE origin successfully HITS a DCV of ${hitRollTotal}`;

    if (autoSuccess !== undefined) {
        if (autoSuccess) {
            hitRollText = "AoE origin automatically HITS any DCV";
        } else {
            hitRollText = "AoE origin automatically MISSES any DCV";
        }
    } else if (hitRollTotal < dcvTargetNumber) {
        const missBy = dcvTargetNumber - hitRollTotal;

        const facingHeroRoller = new HeroRoller().makeBasicRoll().addDice(1);
        await facingHeroRoller.roll();
        const facingRollResult = facingHeroRoller.getBasicTotal();

        const moveDistance = roundFavorPlayerTowardsZero(
            Math.min(distance / 2, item.actor.system.is5e ? missBy : missBy * 2),
        );

        hitRollText = `AoE origin <b class="announce-failure">MISSED by ${missBy}</b>. Move AoE origin ${
            moveDistance + getSystemDisplayUnits(item.actor.is5e)
        } in the <b>${facingRollResult}</b> direction.`;
    }

    // May need this to confirm targets based on user
    options.userId = game.user.id;

    const cardData = {
        HerosysModule: HEROSYS.module,
        // dice rolls
        renderedHitRoll: renderedRollResult,
        hitRollText: hitRollText,
        hitRollValue: hitRollTotal,

        // data for damage card
        actor,

        item,
        itemJsonStr: dehydrateAttackItem(item),

        actionData: actionToJSON(action),

        ...options,

        // misc
        tags: attackHeroRoller.tags(),
        attackTags: getAttackTags(item),
        formData: JSON.stringify(options),
        dcvTargetNumber,
        buttonText: "Confirm AOE placement<br>and selected targets (SHIFT-T to unselect)",
    };

    const template = `systems/${HEROSYS.module}/templates/chat/item-toHitAoe-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: actor, token });

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: attackHeroRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
}

/**
 * Figure in all defensive calculations to determine what the defender's defensive CV is against
 * this particular attack.
 *
 * @param {Object} defendingTarget - Actor being attacked
 * @param {HeroSystem6eActor} attackingActor - Actor that is attacking
 * @param {HeroSystem6eItem} attackItem
 */
function determineDefensiveCombatValueAgainstAttack(defendingTarget, attackingActor, attackItem) {
    const defensiveTags = [];
    const defensiveCharacteristic = attackItem.system.defendsWith;
    const defendingActor = defendingTarget.actor;
    let targetDefenseValue = roundFavorPlayerAwayFromZero(
        defendingActor?.system.characteristics[defensiveCharacteristic]?.value,
    );

    // PH: FIXME: Defensive tags are probably now needed for CSLs and DCV 0 vs 3

    // Bases have no DCV.  DCV=3; 0 if adjacent
    if (isNaN(targetDefenseValue) || defendingActor.type === "base2") {
        const attackerToken = attackingActor.token || attackingActor.getActiveTokens()[0];
        if (!defendingActor || calculateDistanceBetween(attackerToken, defendingTarget).distance > 2) {
            targetDefenseValue = 3;
        } else {
            targetDefenseValue = 0;
        }
    }

    const defendsWith = attackItem.system.defendsWith;
    const attackIsRanged = attackItem.isRanged;

    // Does the defender have any CSLs that apply vs this attack?
    let defensiveCslLevels = 0;
    if (defendingActor) {
        for (const csl of defendingActor.activeCslSkills) {
            let levelsForThisCsl = 0;
            for (const levelUse of csl.system.csl) {
                // Check if the CSL applies defense. Note the special case for the 5e "DCV" defense and "TWODCV" because
                // we only support dcvHth and dcvRanged as the single string.
                if (
                    (defendsWith === "dcv" && csl.system.OPTIONID === "DCV") || // +1 DCV for everything
                    (defendsWith === "dcv" &&
                        csl.system.OPTIONID === "TWODCV" &&
                        csl.csl5eCslDcvOcvTypes.find(
                            (type) =>
                                (type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.hth && !attackIsRanged) ||
                                (type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.range && attackIsRanged),
                        )) || // +1 TWODCV for HTH when hth attack or Ranged when ranged attack
                    (defendsWith === "dcv" && levelUse === "dcvHth" && !attackIsRanged) ||
                    (defendsWith === "dcv" && levelUse === "dcvRanged" && attackIsRanged) ||
                    (defendsWith === "dmcv" && levelUse === "dmcv") ||
                    (defendsWith === "dmcv" &&
                        csl.system.OPTIONID === "TWODCV" &&
                        csl.csl5eCslDcvOcvTypes.find((type) => type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.mental))
                ) {
                    levelsForThisCsl += 1;
                }
            }

            if (levelsForThisCsl) {
                defensiveCslLevels += levelsForThisCsl;
                defensiveTags.push({
                    name: `${csl.name} ${levelsForThisCsl.signedString()} ${defendsWith.toUpperCase()}`,
                    value: levelsForThisCsl,
                    title: `${csl.name} ${levelsForThisCsl.signedString()} ${defendsWith.toUpperCase()}`,
                });
            }
        }
    }
    targetDefenseValue += defensiveCslLevels;

    // Does the character have an Off Hand Defense activated and this a hand-to-hand attack?
    if (defendingActor && defendsWith === "dcv" && !attackIsRanged) {
        const offHandDcvBonus = getOffHandDefenseDcv(defendingActor);
        if (offHandDcvBonus > 0) {
            const offHandDefenseName = `${defendingActor.is5e ? "WF: Off Hand" : "Off Hand Defense"}`;
            const tagString = `${offHandDefenseName} ${offHandDcvBonus.signedString()} HTH DCV`;
            defensiveTags.push({
                name: tagString,
                value: offHandDcvBonus,
                title: tagString,
            });
        }
        targetDefenseValue += offHandDcvBonus;
    }

    return { targetDefenseValue, defensiveTags };
}

/// ChatMessage showing Attack To Hit
/// opened after selecting 'Roll to Hit'
/// uses ../templates/chat/item-toHit-card.hbs
/// manages die rolls and display of hit/miss results
/// At this point the user has _committed_ to the attack that they
/// chose with the die-roll icon and adjusted with the Attack Options
/// menu.
/// There was a die roll, and we display the attack to hit results.
async function doSingleTargetActionToHit(action, options) {
    if (!action) {
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    const item = action.system.currentItem;
    const actor = action.system.actor;
    const token = action.system.attackerToken;
    const targets = action.system.currentTargets;
    options.token ??= token;

    // STR 0 character must succeed with
    // a STR Roll in order to perform any Action that uses STR, such
    // as aiming an attack, pulling a trigger, or using a Power with the
    // Gestures Limitation.
    // Not all token types (base) will have STR
    if (actor && actor.hasCharacteristic("STR") && (item.system.usesStrength || item.findModsByXmlid("GESTURES"))) {
        if (parseInt(actor.system.characteristics.str.value) <= 0) {
            if (
                !(await doCharacteristicRollCheck(
                    actor,
                    "str",
                    `Actions that use STR or GESTURES require STR roll when at 0 STR`,
                ))
            ) {
                await ui.notifications.warn(
                    `${actor.name} failed STR 0 roll. Action with ${item.detailedName()} failed.`,
                );
                return;
            }
        }
    }

    // PRE 0
    // At PRE 0, a character must attempt an PRE Roll to take any
    // offensive action, or to remain in the face of anything even
    // remotely threatening.
    // Not all token types (base) will have PRE
    if (actor && actor.hasCharacteristic("PRE") && parseInt(actor.system.characteristics.pre.value) <= 0) {
        if (
            !(await doCharacteristicRollCheck(
                actor,
                "pre",
                `Offensive actions when at PRE 0 requires PRE roll, failure typically results in actor avoiding threats`,
            ))
        ) {
            await ui.notifications.warn(`${actor.name} failed PRE 0 roll. Action with ${item.name} failed.`);
            return;
        }
    }

    // Make sure there are enough resources and consume them
    const {
        error: resourceError,
        warning: resourceWarning,
        resourcesRequired,
        resourcesUsedDescription,
        resourcesUsedDescriptionRenderedRoll,
    } = await userInteractiveVerifyOptionallyPromptThenSpendResources(item, {
        ...options,
        // A delayed Extra Time resolution paid its resources at declaration
        // (prepaid); a delayed Haymaker pays HERE — in the segment it launches
        ...{ noResourceUse: overrideCanAct || !!options.prepaid },
    });
    if (resourceError) {
        return ui.notifications.error(`${item.name} ${resourceError}`);
    } else if (resourceWarning) {
        return ui.notifications.warn(`${item.name} ${resourceWarning}`);
    }

    // Does base item Requires A Rolls — a delayed Extra Time resolution already
    // rolled this when the activation began
    const attackItemRSR =
        options.prepaid ||
        (await isActivatedForThisUse(item, {
            resourcesUsedDescription: `${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`,
        }));
    if (!attackItemRSR) {
        return;
    }

    // Requires A Roll (base and effective attack items might both require rolls)
    const attackItemAndEffectiveItemAreSame =
        item.system._active?.__originalUuid === item.effectiveAttackItem.system._active?.__originalUuid;
    const effectiveAttackItemRSR =
        !attackItemAndEffectiveItemAreSame &&
        (options.prepaid ||
            (await isActivatedForThisUse(item.effectiveAttackItem, {
                resourcesUsedDescription: `${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`,
            })));
    if (!attackItemAndEffectiveItemAreSame && !effectiveAttackItemRSR) {
        return;
    }

    const itemData = item.effectiveAttackItem.system;

    const hitCharacteristic = Math.max(0, actor.system.characteristics[itemData.attacksWith]?.value);
    if (!actor.hasCharacteristic(itemData.attacksWith.toUpperCase())) {
        ui.notifications.warn(
            `<b>${item.actor.name}</b> does not have <b>${itemData.attacksWith.toUpperCase()}</b>. ${item.actor.type === "base2" ? `Consider creating a COMPUTER` : ``}`,
        );
    }

    const toHitChar = CONFIG.HERO.defendsWith[itemData.defendsWith];

    const adjustment = item.effectiveAttackItem.isAdjustment;
    const senseAffecting = item.effectiveAttackItem.isSenseAffecting;

    // TODO: Much of this looks similar to the AOE stuff above. Any way to combine?
    // -------------------------------------------------
    // attack roll
    // -------------------------------------------------
    const setManeuver = actor.items.find((o) => o.type == "maneuver" && o.name === "Set" && o.isActive);

    let stunForEndHeroRoller = null;

    const attackHeroRoller = new HeroRoller()
        .makeSuccessRoll()
        .addNumber(11, "Base to hit")
        .addNumber(hitCharacteristic, itemData.attacksWith, undefined, { showZero: true })
        .addNumber(parseInt(options.ocvMod) || 0, "OCV modifier")
        .addNumber(parseInt(options.omcvMod) || 0, "OMCV modifier")
        .addNumber(setManeuver?.system.ocv || 0, "Set Maneuver");

    // Spreading attack +1 OCV for -1 DC
    if (options.spread) {
        attackHeroRoller.addNumber(parseInt(options.spread), "Spread modifier");
    }

    const isAoE = item.effectiveAttackItem.getAoeModifier();
    // Manual targeting has no placed template; resolve against the selected tokens, not an origin.
    const manualAoeTargeting = !!isAoE && !!options.aoeManualTargeting;
    const aoeTemplate = isAoE && !manualAoeTargeting ? item.effectiveAttackItem.getAoeTemplateForBaseItem : null;
    if (isAoE && !manualAoeTargeting && !aoeTemplate) {
        return ui.notifications.error(`Attack AOE template was not found.`);
    }

    // Combat Skill Levels
    await addAttackCslsIntoToHitRoll(action, attackHeroRoller);

    // Mind Scan
    if (parseInt(options.mindScanMinds)) {
        attackHeroRoller.addNumber(parseInt(options.mindScanMinds), "Number Of Minds");
    }
    if (parseInt(options.mindScanFamiliar)) {
        attackHeroRoller.addNumber(parseInt(options.mindScanFamiliar), "Mind Familiarity");
    }

    // STRMINIMUM
    // PH: FIXME: Need to consider all the STR minima for both the item and the effectiveAttackItem.
    const strMinimumModifier = item.effectiveAttackItem.findModsByXmlid("STRMINIMUM");
    if (strMinimumModifier) {
        const strMinimumValue = calculateStrengthMinimumForItem(item.effectiveAttackItem, strMinimumModifier);
        const extraStr = Math.max(0, parseInt(actor.system.characteristics.str.value)) - strMinimumValue;
        if (extraStr < 0) {
            attackHeroRoller.addNumber(Math.floor(extraStr / 5), strMinimumModifier.ALIAS);
        }
    }

    // Called shot penalties
    const itemUsesHitLocations = !item.effectiveAttackItem.system.noHitLocations;
    if (itemUsesHitLocations) {
        await addAttackHitLocationsIntoToHitRoll(item.effectiveAttackItem, attackHeroRoller, options);
    }

    const aoeModifier = item.effectiveAttackItem.getAoeModifier();
    const explosion = item.effectiveAttackItem.hasExplosionAdvantage();
    const SELECTIVETARGET = aoeModifier?.ADDER ? aoeModifier.ADDER.find((o) => o.XMLID === "SELECTIVETARGET") : null;
    const NONSELECTIVETARGET = aoeModifier?.ADDER
        ? aoeModifier.ADDER.find((o) => o.XMLID === "NONSELECTIVETARGET")
        : null;

    // Manual targeting rolls to-hit per target instead of auto-hitting everything in the area.
    const aoeAlwaysHit = aoeModifier && !manualAoeTargeting && !(SELECTIVETARGET || NONSELECTIVETARGET);

    let targetData = [];
    const targetIds = [];
    let targetsArray = Array.from(targets);

    if (targetsArray.length === 0 && item?.system.XMLID === "MINDSCAN") {
        targetsArray = canvas.tokens.controlled;
    }

    // Sort by distance from the template origin (absent under manual targeting).
    if (explosion && aoeTemplate) {
        targetsArray.sort(function (a, b) {
            const distanceA = calculateDistanceBetween(aoeTemplate, a).distance;
            const distanceB = calculateDistanceBetween(aoeTemplate, b).distance;
            return distanceA - distanceB;
        });
    }

    // At least one target (even if it is bogus) so we get the dice roll
    if (targetsArray.length === 0) {
        targetsArray.push({});
    }

    // Make attacks against all targets
    for (const target of targetsArray) {
        const { targetDefenseValue, defensiveTags } = determineDefensiveCombatValueAgainstAttack(
            target,
            actor,
            item.effectiveAttackItem,
        );

        // Mind scan typically has just 1 target, but could have more. Use same roll for all targets.
        const targetHeroRoller = aoeAlwaysHit || options.mindScanMinds ? attackHeroRoller : attackHeroRoller.clone();
        let toHitRollTotal = 0;
        let autoSuccess = false;
        let hit = "Miss";
        let by;

        if (aoeAlwaysHit) {
            hit = "Hit";
            by = "AOE auto";
        } else {
            // TODO: Autofire against multiple targets should have increasing difficulty

            // Pick the appropriate target based on the attack type. For AoE it's the base of the AoE template for
            // a single target attack it's the actual target.
            const targetForDistance = isAoE && aoeTemplate ? aoeTemplate : target;
            const distance = token ? calculateDistanceBetween(token, targetForDistance).distance : 0;

            // Range modifiers
            addRangeIntoToHitRoll(distance, item, actor, targetHeroRoller);

            // This is the actual roll to hit. In order to provide for a die roll
            // that indicates the upper bound of DCV hit, we have added the base (11) and the OCV, and subtracted the mods
            // and lastly we subtract the die roll. The value returned is the maximum DCV hit
            // (so we can be sneaky and not tell the target's DCV out loud).
            targetHeroRoller.addDice(-3);

            // TODO: FIXME: This should not be looking at internals. When mind scan can only affect 1 target, remove.
            if (typeof targetHeroRoller._successRolledValue === "undefined") {
                //TODO: add a methods to check if roll has been made.
                await targetHeroRoller.makeSuccessRoll(true, targetDefenseValue).roll();
            }
            autoSuccess = targetHeroRoller.getAutoSuccess();
            toHitRollTotal = targetHeroRoller.getSuccessTotal();
            const margin = targetDefenseValue - toHitRollTotal;

            if (autoSuccess !== undefined) {
                if (autoSuccess) {
                    hit = "Auto Hit";
                } else {
                    hit = "Auto Miss";
                }
            } else if (margin <= 0) {
                hit = "Hit";
            }

            by = Math.abs(toHitRollTotal - targetDefenseValue);
        }

        if (aoeModifier) {
            // Distance from aoeTemplate origin to target/token center
            if (aoeTemplate && target.id) {
                const distanceInMetres = calculateDistanceBetween(aoeTemplate, target).distance;
                by += ` (${getRoundedDownDistanceInSystemUnits(distanceInMetres, item.actor.is5e)}${getSystemDisplayUnits(
                    item.actor.is5e,
                )} from template origin)`;
            }
        }

        targetData.push({
            id: target.id,
            uuid: target.document?.uuid,
            name: `${target.name || "No Target Selected"}${options.targetEntangle ? " [ENTANGLE]" : ""}`,
            aoeAlwaysHit: aoeAlwaysHit,
            explosion: explosion,
            toHitChar: toHitChar,
            toHitRollTotal: toHitRollTotal,
            autoSuccess: autoSuccess,
            hitRollText: `${hit} a ${toHitChar} of ${toHitRollTotal}`,
            value: targetDefenseValue,
            defensiveTags: defensiveTags,
            result: { hit: hit, by: by.toString() },
            roller: options.mindScanMinds
                ? targetsArray[0].id === target.id
                    ? targetHeroRoller
                    : null
                : targetHeroRoller,
            renderedRoll: await targetHeroRoller.render(),
            img: target.document?.texture.src,
            tags: targetHeroRoller.tags(),
        });

        // Keep track of which tokens were hit so we can apply damage later,
        // Assume beneficial adjustment powers always hits
        if (
            hit === "Hit" ||
            hit === "Auto Hit" ||
            item.system.XMLID == "AID" ||
            item.system.XMLID === "HEALING" ||
            item.system.XMLID === "SUCCOR"
        ) {
            targetIds.push(target.id);
        }
    }

    // AUTOFIRE
    // PH: FIXME: Consider autofire on both base and effective attack items. Are they multiplicitive?
    if (item.effectiveAttackItem.system._active.autofire?.shots > 1) {
        const autoFireShots = item.effectiveAttackItem.system._active.autofire.shots;

        // Autofire check for multiple hits on single target
        if (targetData.length === 1) {
            const singleTarget = Array.from(targets)[0] || { id: null };
            const toHitRollTotal = targetData[0].toHitRollTotal;
            const firstShotResult = targetData[0].result.hit;
            const autoSuccess = targetData[0].autoSuccess;
            const aoeAlwaysHit = targetData[0].aoeAlwaysHit;

            const firstShotRenderedRoll = targetData[0].renderedRoll;
            const firstShotRoller = targetData[0].roller;

            targetData = [];

            for (let shot = 0; shot < autoFireShots; shot++) {
                const autofireShotRollTotal = toHitRollTotal - shot * 2;

                const hitRollText = `Autofire ${
                    shot + 1
                }/${autoFireShots}<br>${firstShotResult} a ${toHitChar} of ${autofireShotRollTotal}`;

                const value = singleTarget.id
                    ? singleTarget.actor.system.characteristics[toHitChar.toLowerCase()].value
                    : 3;
                let hit = "Miss";
                let by = Math.abs(autofireShotRollTotal - value);

                if (aoeAlwaysHit) {
                    hit = "Hit";
                    by = "AOE auto";
                } else if (autoSuccess !== undefined) {
                    if (autoSuccess) {
                        hit = "Auto Hit";
                    } else {
                        hit = "Auto Miss";
                    }
                } else if (value <= autofireShotRollTotal) {
                    hit = "Hit";
                }

                targetData.push({
                    id: singleTarget.id,
                    uuid: singleTarget.document?.uuid,
                    name: singleTarget.name,
                    aoeAlwaysHit: aoeAlwaysHit,
                    toHitChar: toHitChar,
                    toHitRollTotal: autofireShotRollTotal,
                    autoSuccess: autoSuccess,
                    hitRollText: hitRollText,
                    value: value,
                    result: { hit: hit, by: by.toString() },
                    roller: shot ? undefined : firstShotRoller,
                    renderedRoll: firstShotRenderedRoll, // TODO: Should perhaps adjust and rerender?
                    img: singleTarget.document?.texture?.src,
                    tags: attackHeroRoller.tags(),
                });
            }
        }
    }

    // PH: FIXME: Is this even possible? If not remove it.
    if (!item) {
        const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });
        speaker["alias"] = item.actor.name;

        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: `${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`,
            whisper: ChatMessage.getWhisperRecipients("GM"),
            speaker,
        };

        await ChatMessage.create(chatData);
        return;
    }

    // Block (which is a repeatable abort) has a different to-hit behavior
    const isBlockManeuver = maneuverHasBlockTrait(item);
    if (isBlockManeuver) {
        if (targetData.length === 1) {
            const hitRollTotal = targetData[0].toHitRollTotal;
            const hitRollText = `Block roll of ${hitRollTotal} vs. OCV of pending attack`;
            targetData[0].hitRollText = hitRollText;
        } else {
            return ui.notifications.error(`Block requires a target.`);
        }
    }

    // The act of making the attack can cause effects for maneuvers related to OCV and DCV
    // PH: FIXME: They are figured into the to-hit modal's ocv and dcv already
    if (["maneuver", "martialart"].includes(item.type)) {
        activateManeuver(item);
    }

    // this doesn't work because we create data-item-id="{{item.uuid}}" for the button. However, item is now something that has no uuid.
    // move all these fields to action?

    const cardData = {
        // dice rolls
        velocity: options.velocity,

        // data for damage card
        attackerActorId: actor.id,
        attackerActorUuid: actor.uuid,
        actorId: actor.id,
        actorUuid: actor.uuid,
        attackerTokenId: token?.id,
        attackerTokenUuid: getTokenUuid(token),
        tokenId: token?.id,
        tokenUuid: getTokenUuid(token),
        actionData: actionToJSON(action),

        //item,
        itemImg: item.img,
        itemName: item.name,
        itemAttackDefenseVs: item.attackDefenseVs,
        itemJsonStr: dehydrateAttackItem(item), // PH: FIXME: Can remove some things like item etc because they're in the actionData.
        originalUuid: item.id || foundry.utils.parseUuid(item.system._active?.__originalUuid)?.id,

        adjustment,
        senseAffecting,
        ...options,
        targetData,
        targetIds,

        // endurance
        useEnd: resourcesRequired.totalEnd,
        resourcesUsedDescription: `${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`,

        // misc
        tags: attackHeroRoller.tags(),
        attackTags: getAttackTags(item),
        maxMinds: CONFIG.HERO.mindScanChoices
            .find((o) => o.key === parseInt(options.mindScanMinds))
            ?.label.match(/[\d,]+/)?.[0],
        //action,
        inActiveCombat: token?.inCombat,
        _itemPostHitActionString: itemPostHitActionString(item),
        hapsEnabled: game.settings.get(game.system.id, "HAP"),
    };
    options.rolledResult = targetData;

    // Use new All In One for most stuff.
    // MINDSCAN not working.
    // JOINT BREAK not working because it does KILLING not a STRIKE
    // Review CHOKE and martial NNDs.
    const allInOneToHitDamageApply =
        (item.attackDefenseVs !== "MD" || item.system.XMLID === "EGOATTACK") &&
        !(item.attackDefenseVs === "NND" && item.isKilling);

    // render card
    const template = isBlockManeuver
        ? `systems/${HEROSYS.module}/templates/chat/item-toHit-block-card.hbs`
        : allInOneToHitDamageApply
          ? `systems/${HEROSYS.module}/templates/chat/item-all-in-one-tohit-apply-card.hbs`
          : `systems/${HEROSYS.module}/templates/chat/item-toHit-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);

    const speaker = ChatMessage.getSpeaker({ actor: actor, token });

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: targetData
            .map((target) => target.roller?.rawRolls())
            .flat()
            .concat(stunForEndHeroRoller?.rawRolls())
            .filter(Boolean),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
        flags: {
            [game.system.id]: {
                ...cardData,
                token: cardData.token?.document?.toObject() ?? cardData.token?.toObject(),
            },
        },
    };

    const message = await ChatMessage.create(chatData);
    if (!message) {
        throw new Error(`[HeroSystem6e] ChatMessage was not created!`);
    }
}

export function getAttackTags(item) {
    // Attack Tags
    const attackTags = [];

    if (!item) return attackTags;

    // Provide the name of the original item in the tags.
    let originalItemTag;
    if (item.system.ALIAS || item.system.XMLID) {
        originalItemTag = { name: `${item.system.ALIAS || item.system.XMLID}`, title: `${item.system.XMLID}` };
        attackTags.push(originalItemTag);
    }

    // Use the effective item to figure out what this attack really is.
    const effectiveAttackItem = item.effectiveAttackItem;

    // Provide the name of the actual attack item in the tag if it is different from the original item. However,
    // make sure we ignore internal placeholders.
    if (
        (effectiveAttackItem.system.ALIAS || effectiveAttackItem.system.XMLID) &&
        effectiveAttackItem.system.XMLID !== "__STRENGTHDAMAGE"
    ) {
        const baseAttackItemTag = {
            name: `${effectiveAttackItem.system.ALIAS || effectiveAttackItem.system.XMLID}`,
            title: `${effectiveAttackItem.system.XMLID}`,
        };
        if (baseAttackItemTag.name !== originalItemTag?.name && baseAttackItemTag.title !== originalItemTag?.title) {
            attackTags.push(baseAttackItemTag);
        }
    }

    // What are we attacking against?
    if (effectiveAttackItem.attackDefenseVs?.length > 1) {
        attackTags.push({
            name: effectiveAttackItem.attackDefenseVs,
        });
    }

    if (effectiveAttackItem.doesKillingDamage) {
        attackTags.push({ name: `killing` });
    }

    // Item adders
    if (effectiveAttackItem.adders) {
        for (const adder of effectiveAttackItem.adders) {
            switch (adder.XMLID) {
                case "MINUSONEPIP":
                case "PLUSONEHALFDIE":
                case "PLUSONEPIP":
                    break;

                case "MULTIPLECLASSES":
                    attackTags.push({
                        name: `${adder.ALIAS}`,
                        title: `${adder.XMLID}`,
                    });
                    break;

                default:
                    attackTags.push({
                        name: `${adder.ALIAS || adder.XMLID}`,
                        title: `${adder.OPTION_ALIAS || adder.XMLID || ""}`,
                    });
            }
        }
    }

    // USESTANDARDEFFECT
    if (effectiveAttackItem.system.USESTANDARDEFFECT) {
        attackTags.push({
            name: `Standard Effect`,
            title: `USESTANDARDEFFECT`,
        });
    }

    // STUN/BODY/EFFECT Only
    if (
        effectiveAttackItem.system.stunBodyDamage &&
        effectiveAttackItem.system.stunBodyDamage !== CONFIG.HERO.stunBodyDamages.stunbody
    ) {
        attackTags.push({
            name: effectiveAttackItem.system.stunBodyDamage,
            title: effectiveAttackItem.system.stunBodyDamage,
        });
    }

    // FLASH
    if (effectiveAttackItem.system.XMLID === "FLASH") {
        attackTags.push({ name: effectiveAttackItem.system.OPTION_ALIAS, title: effectiveAttackItem.system.OPTIONID });
        for (const adder of effectiveAttackItem.adders) {
            attackTags.push({ name: adder.ALIAS, title: adder.XMLID });
        }
    }

    // ADJUSTMENT should include what we are adjusting
    if (effectiveAttackItem.isAdjustment) {
        const { valid, reducesArray, enhancesArray } = effectiveAttackItem.splitAdjustmentSourceAndTarget();
        if (!valid) {
            attackTags.push({ name: effectiveAttackItem.system.INPUT });
        } else {
            for (const adjustTarget of reducesArray) {
                attackTags.push({ name: `-${adjustTarget}` });
            }
            for (const adjustTarget of enhancesArray) {
                attackTags.push({ name: `+${adjustTarget}` });
            }
        }
    }

    // AoE
    const aoeParameters = effectiveAttackItem.aoeAttackParameters;
    if (aoeParameters) {
        // 6e explosion is a modifier to AOE. In 5e EXPLOSION is a mod to itself so
        // for 5e (i.e. here), show 2 tags.
        const systemDisplayUnits = getSystemDisplayUnits(effectiveAttackItem.is5e);

        if (aoeParameters.isExplosion) {
            // 5e has ability to change falloff. 6e is purely based on the size of the AoE.
            const dcFalloff = aoeParameters.dcFalloff;
            attackTags.push({
                name: "Explosion",
                title: dcFalloff ? `Explosion falloff -1 DC/${dcFalloff}${systemDisplayUnits}` : "Explosion",
            });
        }

        attackTags.push({
            name: `${aoeParameters.type} (${aoeParameters.value}${systemDisplayUnits})`,
            title: `${aoeParameters.XMLID}`,
        });
    }

    // item modifiers
    for (const mod of effectiveAttackItem.system.MODIFIER || []) {
        switch (mod.XMLID) {
            case "AVAD":
            case "AVLD":
                attackTags.push({
                    name: `${mod.ALIAS || mod.XMLID}`,
                    title: `${mod.XMLID} versus ${mod.INPUT}`,
                });
                break;

            case "AUTOFIRE":
                {
                    const autoFireShots = parseInt(mod.OPTION_ALIAS.match(/\d+/));
                    attackTags.push({
                        name: `${mod.ALIAS || mod.XMLID}(${autoFireShots})`,
                        title: `${mod.OPTION_ALIAS || ""}`,
                    });
                }
                break;

            case "STRMINIMUM": {
                const strMinimum = calculateStrengthMinimumForItem(effectiveAttackItem, mod);
                attackTags.push({
                    name: `${strMinimum} ${mod.ALIAS || mod.XMLID}`,
                    title: `${mod.XMLID}`,
                });
                break;
            }

            case "LIMITEDPOWER":
                attackTags.push({
                    name: `${mod.OPTION_ALIAS}`,
                    title: `${mod.OPTIONID}\n${mod.ALIAS}\n${mod.XMLID}`,
                });
                break;

            case "EXPLOSION":
            case "AOE":
                // Intentionally show nothing for these two cases as we are getting it above with the AoE section
                break;

            default: {
                const _name = `${mod.ALIAS || mod.XMLID} ${parseInt(mod.LEVELS || 0) ? mod.LEVELS : ""}`.trim();
                if (!attackTags.find((tag) => tag.name?.toLowerCase() === _name.toLowerCase())) {
                    attackTags.push({
                        name: _name,
                        title: `${mod.OPTION_ALIAS || mod.XMLID}`,
                    });
                }
            }
        }

        // item modifier adders
        for (const adder of mod.ADDER || []) {
            switch (adder.XMLID) {
                case "CONTINUING":
                    attackTags.push({
                        name: `${adder.ALIAS || adder.XMLID} ${adder.OPTION_ALIAS || ""}`.trim(),
                        title: `${adder.ALIAS || ""} ${adder.OPTIONID || ""}`.trim(),
                    });
                    break;

                case "CONTINUOUSCONCENTRATION":
                    attackTags.push({
                        name: `Continuous`,
                        title: `${adder.ALIAS || ""}`,
                    });
                    break;

                default:
                    attackTags.push({
                        name: `${adder.ALIAS || adder.XMLID}`,
                        title: `${adder.OPTION_ALIAS || ""}`,
                    });
            }
        }
    }

    // ABORT
    //if (maneuverCanBeAbortedTo(effectText)) {
    if (item.maneuverHasTrait("ABORT")) {
        attackTags.push({
            name: `ABORT`,
            title: `You can abort to maneuver`,
        });
    }

    // BIND
    if (item.maneuverHasTrait("BIND")) {
        attackTags.push({
            name: `BIND`,
            title: `Bind enemy weapon`,
        });
    }

    // BLOCK
    if (item.maneuverHasTrait("BLOCK")) {
        attackTags.push({
            name: `BLOCK`,
            title: `Block instead of Strike. Abort is free.`,
        });
    }

    // DISABLE
    if (item.maneuverHasTrait("DISABLE")) {
        attackTags.push({
            name: `DISABLE`,
            title: `Disable a limb`,
        });
    }
    // DISARM
    if (item.maneuverHasTrait("DISARM")) {
        // Remove any previous DISARM as it is likely very generic
        const disarmIndex = attackTags.findIndex((tag) => tag.name === "DISARM");
        if (disarmIndex > -1) {
            attackTags.splice(disarmIndex, 1);
        }

        attackTags.push({
            name: `DISARM`,
            title: `Knock an opponent's weapon out of his grasp.`,
        });

        // This does no damage, remove PD attackTag
        const pdIndex = attackTags.findIndex((tag) => tag.name === "PD");
        if (pdIndex > -1) {
            attackTags.splice(pdIndex, 1);
        }
    }

    // DODGE
    if (item.maneuverHasTrait("DODGE")) {
        attackTags.push({
            name: `DODGE`,
            title: `Dodge instead of Strike. Abort is free.`,
        });
    }

    // FALL
    //if (maneuverHasAttackerFallsTrait(effectiveAttackItem)) {
    if (item.maneuverHasTrait("YOU FALL")) {
        attackTags.push({
            name: `YOU FALL`,
            title: `Attacker automatically falls down.`,
        });
    }
    //if (maneuverHasTargetFallsTrait(effectiveAttackItem)) {
    if (item.maneuverHasTrait("TARGET FALLS")) {
        attackTags.push({
            name: `TARGET FALLS`,
            title: `Target falls prone as if thrown`,
        });
    }

    // FLASH
    // TODO: Find purchasable HDC files to see how they format special FLASH senses.
    //       In Maneuver listings, this Basis is indicated by
    //       use of the phrase, "[Sense] Group Flash __d6"
    //       You can buy additional sense groups, but unclear how that is formatted.
    if (item.maneuverHasTrait("[FLASHDC]")) {
        const senseGroup = effectiveAttackItem.system.INPUT || item.system.INPUT;
        attackTags.push({
            name: `${senseGroup ? `${senseGroup} Group Flash` : "Flash"}`,
            title: `Disrupts senses`,
        });
    }

    // FMOVE
    if (item.maneuverHasTrait("FMOVE")) {
        attackTags.push({
            name: `FMOVE`,
            title: `Can attack after Full Move`,
        });
    }

    // FOLLOW
    if (item.maneuverHasTrait("MUST FOLLOW")) {
        const extractMustFollowTarget = function (effectText) {
            if (!effectText) return null;

            const match = effectText.match(/Must\s+Follow\s+([^,]+)/i);
            return match ? match[1].trim() : null;
        };

        const mustFollowTarget = extractMustFollowTarget(item.system.WEAPONEFFECT || item.system.EFFECT);

        attackTags.push({
            name: `Must Follow ${mustFollowTarget?.toUpperCase()}`,
            title: `This maneuver must follow a successful ${mustFollowTarget}`,
        });
    }

    // GRAB OPPONENT
    if (item.maneuverHasTrait("GRAB")) {
        const extractGrabTarget = function (effectText) {
            if (!effectText) return null;

            // Match "Must Follow " case-insensitively, then capture all characters up to the next comma or string end
            const regex = /Grab\s+([^,;]+)/i;
            const match = effectText.match(regex);

            // If a match is found, return the trimmed capturing group contents
            return match ? match[1].trim() : null;
        };
        const grabTarget = extractGrabTarget(item.system.WEAPONEFFECT || item.system.EFFECT);
        attackTags.push({
            name: `GRAB ${grabTarget?.toUpperCase()}`,
            title: `Grab a target. If successful you may squeeze, slam or throw.`,
        });
    }

    // GRAB WEAPON
    if (item.maneuverHasTrait("GRAB WEAPON")) {
        attackTags.push({
            name: `GRAB WEAPON`,
            title: `Grab a target. If successful you may attempt to disarm them.`,
        });
    }

    // HALF MOVE REQUIRED
    if (item.maneuverHasTrait("HALF MOVE REQUIRED")) {
        attackTags.push({
            name: `HALF MOVE REQUIRED`,
            title: `This maneuver must follow a half move`,
        });
    }

    // K-DAMAGE (this is killing damage and shown elsewhere)

    // LASTING RESTRICTION (these are OCV/DCV penalties and shown elsewhere)

    // N-DAMAGE (this is normal damage and shown elsewhere)

    // NND DMG
    if (item.maneuverHasTrait("[NNDDC]")) {
        // Remove any previous NND as it is likely very generic
        const nndIndex = attackTags.findIndex((tag) => tag.name === "NND");
        if (nndIndex > -1) {
            attackTags.splice(nndIndex, 1);
        }

        attackTags.push({
            name: `NND`,
            title: `No Normal Defense`,
        });
    }

    // ONE LIMB (should be included in GRAB)

    // PRONE (careful the TRIP maneuver has a poorly constructed generic effect, which we are changing)
    // HeroSystem's Trip maneuver is generically described as "Knock a target to the ground, making him Prone"
    // This causes PRONE to mistakenly match, a migration fixes this using
    // the proper trait of "Target Falls".
    if (item.maneuverHasTrait("PRONE") && item.system.XMLID !== "TRIP") {
        attackTags.push({
            name: `PRONE`,
            title: `Target is required to be prone before maneuver can be used`,
        });
    }

    // REQUIRES BOTH HANDS
    if (item.maneuverHasTrait("BOTH HANDS")) {
        attackTags.push({
            name: `PRONE`,
            title: `Must have both hands free before using this maneuver`,
        });
    }

    // REQUIRES OBJECT/CONDITION (not sure how to implement)

    // RESPONSE (Need example of this one, likely does not match, does nothing)
    if (item.maneuverHasTrait("CAN ONLY BE USED AFTER")) {
        const extractResponseTarget = function (effectText) {
            if (!effectText) return null;

            // Match "Must Follow " case-insensitively, then capture all characters up to the next comma or string end
            const regex = /Can\sOnly\sBe\sUsed\sAfter\sSuccessful\s+([^,]+)/i;
            const match = effectText.match(regex);

            // If a match is found, return the trimmed capturing group contents
            return match ? match[1].trim() : null;
        };

        const responseTarget = extractResponseTarget(item.system.WEAPONEFFECT || item.system.EFFECT);
        attackTags.push({
            name: `Can Only Be Used After ${responseTarget?.toUpperCase()}`,
            title: `Can only be used following a successful ${responseTarget?.toUpperCase()} maneuver`,
        });
    }

    // STRIKE (this is standard damage and shown elsewhere)

    // TAKE FULL DMG  (not sure how to implement)
    if (item.maneuverHasTrait("ATTACKER TAKES")) {
        const extractAttackerDamageModifier = function (effectText) {
            if (!effectText) return null;

            const match = effectText.match(/attacker\s+takes\s+([^,]+?)(?=\s*damage|$)/i);
            return match ? match[1].trim() : null;
        };

        const attackerDamageModifier = extractAttackerDamageModifier(item.system.WEAPONEFFECT || item.system.EFFECT);
        attackTags.push({
            name: `Attacker Takes ${attackerDamageModifier} Damage`,
            title: `Attacker takes damage if collision takes place`,
        });
    }

    // TAKE HALF DMG  (see TAKE FULL DMG)

    // THROW (implemented as Target Falls)

    // TIME+ (not sure how to implement)

    // UNBALANCING  (not sure how to implement)

    // V/6  (not sure how to implement)

    // V/10  (not sure how to implement)

    // SNAP SHOT, Lets character duck back behind cover (not in HSMartialArts so not sure how to implement)

    // SUPPRESSION FIRE, Continuous fire through an area, must be Autofire (not in HSMartialArts so not sure how to implement)

    // Remove any duplicates. Like with FLASH #2629
    const deDupedAttackTags = Array.from(
        new Set(attackTags.map((o) => o.name)).map((name) => attackTags.find((p) => p.name === name)),
    );

    return deDupedAttackTags;
}

export async function _onRollAoeDamage(event) {
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.
    const toHitData = { ...button.dataset };
    const action = actionFromJSON(toHitData.actionData);
    return doSingleTargetActionToHit(action, JSON.parse(toHitData.formData));
}

export async function _onRollKnockback(event) {
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.

    const kbOptions = { ...button.dataset };
    const { item } = rehydrateActorAndAttackItem(kbOptions);
    if (!kbOptions.targetTokenId) {
        console.warn(`No targetTokenId provided for knockback roll.`);
        // We can likely proceed using kbOptions.actorUuid to find the token,
        // but it is better to use a specific tokenId.
    }
    const token = tokenEducatedGuess({ tokenId: kbOptions.targetTokenId, actor: fromUuidSync(kbOptions.actorUuid) });
    const knockbackResultTotal = kbOptions.knockbackResultTotal;
    if (!item || !token || !knockbackResultTotal) {
        return ui.notifications.error(`Knockback details are not available.`);
    }

    // A character who’s Knocked Back into a surface or object
    // perpendicular to the path of his Knockback (such as a wall)
    // takes 1d6 Normal Damage for every 2m of Knockback rolled,
    // to a maximum of the PD + BODY of the structure he hit.
    // If a Knocked Back character doesn’t impact some
    // upright surface, he simply hits the ground. He takes 1d6 Normal
    // Damage for every 4m he was Knocked Back. The target winds
    // up prone at the location where his Knockback travel stops.

    const html = `
        <p>
            A character takes 1d6 damage for every ${getRoundedDownDistanceInSystemUnits(
                2,
                token.actor.is5e,
            )}${getSystemDisplayUnits(token.actor.is5e)} they are knocked into a solid object,
            to a maximum of the PD + BODY of the object hit.
        </p>
        <p>
            A character takes 1d6 damage for every ${getRoundedDownDistanceInSystemUnits(
                4,
                token.actor.is5e,
            )}${getSystemDisplayUnits(token.actor.is5e)} they are knocked back if no object intervenes. <strong>This is the default value below</strong>.
        </p>
        <p>
            The character typically winds up prone.
        </p>
        <div class="form-group">
            <label>KB damage dice</label>
            <input type="text" name="knockbackDice" value="${Math.max(
                0,
                Math.floor(knockbackResultTotal / 2),
            )}" data-dtype="Number" />
        </div>
        <p>
            NOTE: Don't forget to move the token to the appropriate location as KB movement is not automated.
        </p>
    `;

    await foundry.applications.api.DialogV2.wait({
        window: { title: `Confirm Knockback details` },
        position: { width: 400 },
        content: html,
        buttons: [
            {
                action: "normal",
                label: "Roll & Apply",
                default: true,
                callback: async (event, button) => {
                    const dice = button.form.elements.knockbackDice.value;
                    await _rollApplyKnockback(token, parseInt(dice));
                },
            },
            {
                action: "cancel",
                label: "Cancel",
            },
        ],
    });
}

// Fisher-Yates Shuffle
function fisherYatesShuffle(array) {
    let currentIndex = array.length,
        randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
}

export async function _onRollPowerToRemove(event) {
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.

    const targetToken = await fromUuid(button.dataset.targetTokenUuid);
    if (!targetToken) {
        return ui.notifications.error(`Target token not found.`);
    }

    const actor = targetToken.actor;
    if (!actor) {
        return ui.notifications.error(`${targetToken.name} token does not have an actor.`);
    }

    if (!actor.isOwner) {
        return ui.notifications.error(`You do not have permission to modify ${targetToken.name}.`);
    }

    if (actor.linked) {
        return ui.notifications.error(`${targetToken.name} is linked. Unlink the token to use this feature.`);
    }

    // You can't remove automation from an automaton.
    const unremoveablePowerXmlids = ["AUTOMATON"];

    // TODO: consider things that aren't carried (VPP). An inactive power should probably still be considered and is.
    // TODO: Compound powers should not allow parts of the power to be removed presumably.
    const choices = actor.items
        .filter((item) => item.type === "power" && !unremoveablePowerXmlids.includes(item.system.XMLID))
        .map((power) => {
            return {
                key: power.id,
                label: `${power.name}${!power.name.toUpperCase().includes(power.system.XMLID.toUpperCase()) ? ` (${power.system.XMLID})` : ``}`,
            };
        });

    // NOTE: For STR and SPD dropping to 0, it isn't excluded by the RAW, but is probably not what they want since it can effectively
    //       cripple the automaton.
    if (actor.system.characteristics.str.value > 10) {
        choices.push({ key: "STR", label: "10 STR" });
    }
    if (actor.system.characteristics.spd.value > 1) {
        choices.push({ key: "SPD", label: "1 SPD" });
    }

    if (choices.length === 0) {
        return ui.notifications.warn(`${targetToken.name} has no obvious removable powers or characteristics.`);
    }

    fisherYatesShuffle(choices);

    const template = `systems/${HEROSYS.module}/templates/attack/remove-power-from-automaton.hbs`;
    const content = await renderTemplate(template, { choices });

    const powerToRemoveId = await foundry.applications.api.DialogV2.prompt({
        window: { title: `Remove power from ${targetToken.name}` },
        content,
        ok: {
            label: "Remove Power",
            callback: (event, button) => button.form.elements.powerToRemove.value,
        },
    });

    // If the user has just closed the dialog without selecting something, we're done.
    if (powerToRemoveId == null) {
        return;
    }

    let chatContent = null;
    if (powerToRemoveId === "STR") {
        event.target.textContent = "Removed 10 STR";
        event.target.style.color = "darkgray";
        chatContent = "Removed 10 STR";
        await actor.update({
            "system.characteristics.str.value": actor.system.characteristics.str.value - 10,
            "system.characteristics.str.max": actor.system.characteristics.str.max - 10,
        });
    } else if (powerToRemoveId === "SPD") {
        event.target.textContent = "Removed 1 SPD";
        event.target.style.color = "darkgray";
        chatContent = "Removed 1 SPD";
        await actor.update({
            "system.characteristics.spd.value": actor.system.characteristics.spd.value - 1,
            "system.characteristics.spd.max": actor.system.characteristics.spd.max - 1,
        });
    } else {
        const item = actor.items.get(powerToRemoveId);
        if (item) {
            const messageId = event.target.closest(`li[data-message-id]`).dataset.messageId;
            const message = ChatMessage.get(messageId);
            if (message) {
                const parsedMessageContent = document.createElement("div");
                parsedMessageContent.innerHTML = message.content;
                const button = parsedMessageContent.querySelector(`button.roll-powerToRemove`);
                if (button) {
                    button.textContent = `Removed ${item.name}`;
                    button.style.color = "darkgray";
                    await message.update({ content: parsedMessageContent.innerHTML });
                }
                chatContent = `Removed power ${item.name}`;
            } else {
                console.error(`Could not find chat message for power removal button.`);
            }

            await item.delete();
        } else {
            return ui.notifications.error(`Selected power not found.`);
        }
    }

    if (chatContent) {
        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            author: game.user._id,
            content: chatContent,
            speaker: ChatMessage.getSpeaker({ actor, token: targetToken }),
            whisper: whisperUserTargetsForActor(actor),
        };
        await ChatMessage.create(chatData);
    }
}

export async function _onSpendHaps(event) {
    event.preventDefault();
    const button = event.currentTarget;
    button.blur();

    if (!game.settings.get(game.system.id, "HAP")) {
        return ui.notifications.error("Heroic Action Points (HAP) are not enabled");
    }

    const targetContainer = button.closest(`[data-target-token-uuid]`);
    const targetTokenUuid = targetContainer?.dataset.targetTokenUuid;
    // Older cards rendered this button for targetless rolls, which have no uuid
    const targetToken = targetTokenUuid ? await fromUuid(targetTokenUuid) : null;
    const targetActor = targetToken?.actor;
    if (!targetActor) {
        return ui.notifications.warn("HAP cannot be spent on an attack roll without a target.");
    }

    // Get message
    const messageId = button.closest(`li[data-message-id]`).dataset.messageId;
    const message = game.messages.get(messageId);
    if (!message) throw new Error("Chat message context not found.");

    const attackerTokenUuid = message.getFlag(game.system.id, "attackerTokenUuid");
    const attackerToken = attackerTokenUuid ? await fromUuid(attackerTokenUuid) : null;
    let attackerActor = attackerToken?.actor;

    // Older cards (and tokenless attackers) may lack the token uuid; fall back to the actor uuid.
    if (!attackerActor) {
        const attackerActorUuid =
            message.getFlag(game.system.id, "attackerActorUuid") ?? message.getFlag(game.system.id, "actorUuid");
        attackerActor = attackerActorUuid ? await fromUuid(attackerActorUuid) : null;
    }

    if (!attackerActor) throw new Error("Attacker actor not found.");

    // 2. Validate HAP currency locally on the client
    const hapsToSpend = parseInt(button.dataset.by || "1");
    const currentHaps = attackerActor.system.hap.value ?? 0;

    if (currentHaps < hapsToSpend) {
        return ui.notifications.warn(`${attackerToken?.name ?? attackerActor.name} does not have enough HAPs.`);
    }

    await attackerActor.update({
        "system.hap.value": currentHaps - hapsToSpend,
    });

    // 7. Prepare the uniform payload packet
    const socketPayload = {
        operation: "spendHapUpdateCard",
        userId: game.user.id,
        messageId: messageId,
        targetTokenUuid: targetTokenUuid,
        hapsToSpend: hapsToSpend,
        targetActorName: targetActor.name,
    };

    // 8. Execute or Emit based on permissions
    if (game.user.isGM) {
        // GM client runs the shared logic directly
        await processHapCardUpdate(socketPayload);
    } else {
        // Player client fires the packet across the network to the GM
        game.socket.emit(`system.${game.system.id}`, socketPayload);
    }
}

export async function processHapCardUpdate({ messageId, targetTokenUuid, hapsToSpend, targetActorName }) {
    const message = ChatMessage.get(messageId);
    if (!message) {
        console.error(`Message not found: ${messageId}`);
        return;
    }

    // 1. Pull the data cleanly using v14 getFlag methods
    const targetDataArray = message.getFlag(game.system.id, "targetData") || [];
    const targetIds = message.getFlag(game.system.id, "targetIds") || [];

    // 2. Use map to safely modify the targeted element without corrupting the array structure
    let targetFound = false;
    const updatedTargetData = targetDataArray.map((target) => {
        if (target.uuid === targetTokenUuid) {
            targetFound = true;
            return {
                ...target,
                result: { ...target.result, hit: "hit", by: 0 },
                hitRollText: `HAP ${hapsToSpend}`,
            };
        }
        return target;
    });

    if (!targetFound) {
        console.error("Target missing from message flag tracking index.");
        return;
    }

    const newTargetId = foundry.utils.parseUuid(targetTokenUuid)?.id;

    const templateData = {
        ...message.flags[game.system.id],
        targetData: updatedTargetData,
    };

    // 4. Re-render the HTML template block
    const newContent = await renderTemplate(
        `systems/${HEROSYS.module}/templates/chat/item-all-in-one-tohit-apply-card.hbs`,
        templateData,
    );

    // 5. Securely update both the text interface and the persistent database flags
    await message.update({
        content: newContent,
        [`flags.${game.system.id}.targetData`]: updatedTargetData,
        [`flags.${game.system.id}.targetIds`]: [...targetIds, newTargetId],
    });

    ui.notifications.info(`${targetActorName} spent ${hapsToSpend} HAP to convert a Miss into a Hit!`);
}

async function createTemporaryKnockbackItem(actor, knockbackDice) {
    const knockbackAttackXml = `
            <POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="${knockbackDice}" ALIAS="Knockback" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                <MODIFIER XMLID="NOKB" ID="1716671836182" BASECOST="-0.25" LEVELS="0" ALIAS="No Knockback" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                </MODIFIER>
            </POWER>
        `;
    const knockbackAttackItem = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(knockbackAttackXml, actor), {
        parent: actor,
    });
    knockbackAttackItem.name ??= "KNOCKBACK";

    return knockbackAttackItem;
}

/**
 * Roll and Apply Knockback
 * @param {HeroSystem6eToken} token
 * @param {number} knockbackDice
 */
async function _rollApplyKnockback(token, knockbackDice) {
    const actor = token.actor;

    const damageRoller = new HeroRoller()
        .setPurpose(DICE_SO_NICE_CUSTOM_SETS.KNOCKBACK)
        .addDice(parseInt(knockbackDice), "Knockback")
        .makeNormalRoll();
    await damageRoller.roll();

    const damageRenderedResult = await damageRoller.render();

    // Bogus knockback attack item
    const knockbackAttackItem = await createTemporaryKnockbackItem(actor, damageRoller.getBaseTotal());

    const { ignoreDefenseIds, conditionalDefenses } = await getConditionalDefenses(token, knockbackAttackItem, null);

    let defense = "";

    // New Defense Stuff
    let {
        defenseValue,
        resistantValue,
        impenetrableValue,
        damageReductionValue,
        damageNegationValue,
        knockbackResistanceValue,
        defenseTags,
    } = getActorDefensesVsAttack(token.actor, knockbackAttackItem, { ignoreDefenseIds });

    if (damageNegationValue > 0) {
        defense += "Damage Negation " + damageNegationValue + "DC(s); ";
    }

    defense = defense + defenseValue + " normal; " + resistantValue + " resistant";

    if (damageReductionValue > 0) {
        defense += "; damage reduction " + damageReductionValue + "%";
    }

    let damageData = {};
    damageData.defenseValue = defenseValue;
    damageData.resistantValue = resistantValue;
    damageData.impenetrableValue = impenetrableValue;
    damageData.damageReductionValue = damageReductionValue;
    damageData.damageNegationValue = damageNegationValue;
    damageData.knockbackResistanceValue = knockbackResistanceValue;
    damageData.defenseAvad =
        defenseValue +
        resistantValue +
        impenetrableValue +
        damageReductionValue +
        damageNegationValue +
        knockbackResistanceValue;
    damageData.targetToken = token;

    // VULNERABILITY
    ({
        vulnStunMultiplier: damageData.vulnStunMultiplier,
        vulnBodyMultiplier: damageData.vulnBodyMultiplier,
        vulnDesc: damageData.VulnDesc,
    } = determineVulerabilityToAttack(conditionalDefenses, ignoreDefenseIds));

    const damageDetail = await _calcDamage(damageRoller, knockbackAttackItem, damageData);
    damageDetail.effects = `${damageDetail.effects || ""} Prone`.replace("; ", "").trim();

    const specialAutomatonPowers = token.actor.getAutomatonSpecialPowers();
    if (specialAutomatonPowers.takesNoStunButLosesFunctionOnBody || specialAutomatonPowers.takesNoStun) {
        defenseTags.push({
            name: "TAKES NO STUN",
            value: "immune",
            resistant: false,
            title: "Ignore the STUN damage from any attack",
        });
        damageDetail.effects = damageDetail.effects + "; Takes No STUN";
        damageDetail.stun = 0;
    }

    const cardData = {
        item: knockbackAttackItem,
        actor: actor,
        itemJsonStr: dehydrateAttackItem(knockbackAttackItem),

        // Incoming Damage Information
        incomingDamageSummary: damageRoller.getTotalSummary(),
        incomingAnnotatedDamageTerms: damageRoller.getAnnotatedTermsSummary(),

        // dice rolls
        roller: damageRoller,
        renderedDamageRoll: damageRenderedResult,
        renderedStunMultiplierRoll: damageDetail.renderedStunMultiplierRoll,
        knockbackRoll: damageDetail.knockbackRoller,

        // body
        bodyDamage: damageDetail.bodyDamage,
        bodyDamageEffective: damageDetail.body,

        // stun
        stunDamage: damageDetail.stunDamage,
        stunDamageEffective: damageDetail.stun,
        hasRenderedDamageRoll: true,
        stunMultiplier: damageDetail.stunMultiplier,
        hasStunMultiplierRoll: damageDetail.hasStunMultiplierRoll,

        // damage info
        damageString: damageRoller.getTotalSummary(),
        useHitLoc: damageDetail.useHitLoc,
        hitLocText: damageDetail.hitLocText,
        damageBreakdown: damageDetail.damageBreakdown,

        // effects
        effects: damageDetail.effects,

        // defense
        defense: defense,
        damageNegationValue: damageNegationValue,

        // knockback
        knockbackMessage: damageDetail.knockbackMessage,
        useKnockBack: damageDetail.useKnockBack,
        knockbackRenderedResult: damageDetail.knockbackRenderedResult,
        knockbackTags: damageDetail.knockbackTags,
        knockbackResultTotal: damageDetail.knockbackResultTotal,
        isKnockBack: true,

        // misc
        tags: defenseTags,
        targetToken: token,
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-damage-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: actor, token });

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: damageRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);

    // none: "No Automation",
    // npcOnly: "NPCs Only (end, stun, body)",
    // pcEndOnly: "PCs (end) and NPCs (end, stun, body)",
    // all: "PCs and NPCs (end, stun, body)"
    const automation = game.settings.get(HEROSYS.module, "automation");
    if (automation === "all" || (automation === "npcOnly" && token.actor.type === "npc")) {
        const changes = {};

        if (damageDetail.stun !== 0) {
            changes["system.characteristics.stun.value"] =
                token.actor.system.characteristics.stun.value - damageDetail.stun;
        }
        if (damageDetail.body !== 0) {
            changes["system.characteristics.body.value"] =
                token.actor.system.characteristics.body.value - damageDetail.body;
        }

        await token.actor.update(changes);
    }

    // Token falls prone
    await token.actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
        active: true,
    });
}

export async function rollEffect(item) {
    const { diceParts } = calculateDicePartsForItem(item, {});

    const effectRoller = new HeroRoller()
        .modifyTo5e(item.actor.system.is5e)
        .makeEffectRoll()
        .addDice(diceParts.d6Count >= 1 ? diceParts.d6Count : 0)
        .addHalfDice(diceParts.halfDieCount >= 1 ? diceParts.halfDieCount : 0)
        .addDiceMinus1(diceParts.d6Less1DieCount >= 1 ? diceParts.d6Less1DieCount : 0)
        .addNumber(diceParts.constant);
    await effectRoller.roll();

    const cardHtml = await effectRoller.render(`${item.name} Effect Roll`);

    const speaker = ChatMessage.getSpeaker();
    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: effectRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
}

export async function rollLuck(item) {
    const { diceParts } = calculateDicePartsForItem(item, {});

    const luckRoller = new HeroRoller().makeLuckRoll().addDice(diceParts.d6Count);
    await luckRoller.roll();

    const cardHtml = await luckRoller.render(`${item.name} Luck Roll`);

    const speaker = ChatMessage.getSpeaker();
    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: luckRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
}

export async function rollUnluck(item) {
    const { diceParts } = calculateDicePartsForItem(item, {});

    const unluckRoller = new HeroRoller().makeUnluckRoll().addDice(diceParts.d6Count);
    await unluckRoller.roll();

    const cardHtml = await unluckRoller.render(`${item.name} Unluck Roll`);

    const speaker = ChatMessage.getSpeaker();
    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: unluckRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
}

/**
 * Event handler for when the Roll Damage button is clicked. Should only roll damage. The effects of damage
 * are calculated later in the sequence when the apply buttons are pushed.
 *
 * @param {Event} event
 * @returns
 */
export async function _onRollDamage(event) {
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.

    const messageId = button.closest(`li[data-message-id]`).dataset.messageId;
    const message = game.messages.get(messageId);
    if (!message) throw new Error("Chat message context not found.");

    const toHitData = foundry.utils.mergeObject({ ...button.dataset }, message.flags[game.system.id]);

    // PH: FIXME: This is now included in the action data and this can be cleaned up
    let { actor, item } = rehydrateActorAndAttackItem(toHitData);
    item ??= rehydrateAttackItem(message.getFlag(game.system.id, "itemJsonStr"), actor).item;
    actor ??= await fromUuid(message.getFlag(game.system.id, "attackerActorUuid"));

    if (!item || !actor) {
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    // Squeeze overrides from GRAB workflow
    if (toHitData.grabAction === "squeeze") {
        item = actor.items.find((i) => i.system.XMLID === "STRIKE");
        if (!item) {
            throw new Error(`Unable to find STRIKE`);
        }
    }

    const action = actionFromJSON(toHitData.actionData);
    if (!action?.current.attackerTokenUuid) {
        console.warn("expecting action.current.attackerTokenUuid");
    }
    const token = action.system.attackerToken ?? tokenEducatedGuess({ action, actor });
    const hthAttackItems = (action.hthAttackItems || []).map((hthAttack) => fromUuidSync(hthAttack.uuid));
    toHitData.hthAttackItems = hthAttackItems;

    const haymakerManeuverActiveItem = actor.items.find(
        (item) =>
            item.isCombatManeuver &&
            item.system.XMLID === "HAYMAKER" &&
            (item.isActive || item.actor?.statuses.has("haymaker") || action.system.statuses.includes("haymaker")),
    );

    // Coerce type to boolean
    toHitData.targetEntangle =
        toHitData.targetEntangle === true || toHitData.targetEntangle?.match(/true/i) ? true : false;

    const isAdjustment = item.effectiveAttackItem.isAdjustment;
    const isSenseAffecting = item.effectiveAttackItem.isSenseAffecting;
    const isKilling = item.effectiveAttackItem.doesKillingDamage;
    const isEntangle = item.effectiveAttackItem.isEntangle;
    const isGrab = item.maneuverHasTrait("GRAB");
    const isEffectBasedAttack = item.effectiveAttackItem.isEffectBased;
    const isNormalAttack =
        !isEntangle && !isSenseAffecting && !isAdjustment && !isEffectBasedAttack && !isKilling && !isGrab;
    const isKillingAttack = !isEntangle && !isSenseAffecting && !isAdjustment && !isEffectBasedAttack && isKilling;

    const increasedMultiplierLevels = parseInt(
        item.effectiveAttackItem.findModsByXmlid("INCREASEDSTUNMULTIPLIER")?.LEVELS || 0,
    );
    const decreasedMultiplierLevels = parseInt(
        item.effectiveAttackItem.findModsByXmlid("DECREASEDSTUNMULTIPLIER")?.LEVELS || 0,
    );

    const useStandardEffect = !!item.effectiveAttackItem.system.USESTANDARDEFFECT;

    const { diceParts, tags } = calculateDicePartsForItem(item, {
        isAction: true,
        ...toHitData,
        ...{ haymakerManeuverActiveItem },
    });

    const includeHitLocation =
        game.settings.get(HEROSYS.module, "hit locations") !== "noHitLocations" &&
        !item.effectiveAttackItem.system.noHitLocations;

    const customStunMultiplierSetting = game.settings.get(
        game.system.id,
        "NonStandardStunMultiplierForKillingAttackBackingSetting",
    );

    const damageRoller = new HeroRoller()
        .modifyTo5e(actor.system.is5e)
        .makeNormalRoll(isNormalAttack)
        .makeKillingRoll(
            isKillingAttack,
            customStunMultiplierSetting.d6Count ||
                customStunMultiplierSetting.d6Less1DieCount ||
                customStunMultiplierSetting.halfDieCount ||
                customStunMultiplierSetting.constant
                ? customStunMultiplierSetting
                : undefined,
        )
        .makeAdjustmentRoll(isAdjustment)
        .makeFlashRoll(isSenseAffecting)
        .makeEntangleRoll(isEntangle || isGrab)
        .makeEffectRoll(isEffectBasedAttack)
        .addStunMultiplier(increasedMultiplierLevels - decreasedMultiplierLevels)
        .addDice(diceParts.d6Count >= 1 ? diceParts.d6Count : 0)
        .addHalfDice(diceParts.halfDieCount >= 1 ? diceParts.halfDieCount : 0)
        .addDiceMinus1(diceParts.d6Less1DieCount >= 1 ? diceParts.d6Less1DieCount : 0)
        .addNumber(diceParts.constant)
        .modifyToStandardEffect(useStandardEffect)
        .modifyToDoNoBody(
            isNormalAttack &&
                (item.effectiveAttackItem.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.stunonly ||
                    item.effectiveAttackItem.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.effectonly),
        )
        .addToHitLocation(
            includeHitLocation,
            toHitData.aim,
            includeHitLocation && game.settings.get(HEROSYS.module, "hitLocTracking") === "all",
            toHitData.aim === "none" ? "none" : toHitData.aimSide, // Can't just select a side to hit as that doesn't have a penalty
        );

    await damageRoller.roll();

    // Build list of who to target
    const targetTokens = [];
    const targetIdsArray =
        toHitData.targetIds.constructor.name === "Array" ? toHitData.targetIds : toHitData.targetIds.split(",");
    for (const id of targetIdsArray) {
        const tokenDocument = canvas.scene.tokens.get(id);
        if (tokenDocument) {
            const entangleAE = tokenDocument.actor?.appliedEffects?.find(
                (o) => o.flags[game.system.id]?.XMLID === "ENTANGLE",
            );
            const targetToken = {
                tokenId: id,
                tokenUuid: tokenDocument.uuid,
                name: tokenDocument.name,
                subTarget:
                    toHitData.targetEntangle && entangleAE
                        ? `${tokenDocument.name} [${entangleAE.flags[game.system.id]?.XMLID}]`
                        : null,
                targetEntangle: !!toHitData.targetEntangle,
            };

            targetTokens.push(targetToken);
        }
    }

    // Kludge for SIMPLIFIED HEALING
    const isSimpleHealing =
        item.effectiveAttackItem.system.XMLID === "HEALING" && item.system.INPUT.match(/simplified/i);

    const damageRenderedResult = isSimpleHealing
        ? await (await damageRoller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL)).render()
        : await damageRoller.render();

    const cardData = {
        user: game.user,

        item: item,
        itemJsonStr: toHitData.itemJsonStr, // PH: FIXME: Would be nice to just have this in action data that is always passed through
        actor: item.actor,

        nonDmgEffect: isAdjustment || isEffectBasedAttack || item.baseInfo?.nonDmgEffect,
        isSenseAffecting,

        // dice rolls
        renderedDamageRoll: damageRenderedResult,
        rollerJSON: damageRoller.toJSON(),

        // hit locations
        useHitLoc: damageRoller.hitLocationValid(),
        hitLocText: `${damageRoller.getHitLocation().fullName} (${damageRoller.getHitLocation().num})`,

        // misc
        targetIds: toHitData.targetIds,
        tags: tags,

        attackTags: getAttackTags(item),
        targetTokens: targetTokens,
        actionDataJSON: actionToJSON(action),
        possibleGrabActions: ["squeeze", "slam", "throw"],
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/item-damage-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: damageRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
        flags: {
            [game.system.id]: message.flags[game.system.id],
        },
    };

    await ChatMessage.create(chatData);

    // turn off haymaker — a scheduled delayed resolution keeps the -5 DCV until it lands
    if (!hasScheduledHaymaker(actor)) {
        await endHaymakerManeuver(actor);
    }

    return;
}

export async function _onRollBreakfall(event) {
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.

    const targetToken = tokenEducatedGuess({
        tokenId: button.dataset.targetTokenId,
    });

    const targetActor = targetToken.actor;
    if (!targetActor) {
        throw new Error("Target actor details are no longer available.");
    }

    // If knockbackResultTotal exists then this is vs KB, if not then stand up from prone.
    const knockbackResultTotal = button.dataset.knockbackResultTotal ?? 0;

    const breakFallItem = targetActor.items.find((o) => o.system.XMLID === "BREAKFALL" && o.isActive);
    if (!breakFallItem) {
        throw new Error("Breakfall item not found.");
    }

    // Indicate button has already been used
    try {
        const messageId = event.target.closest(`li[data-message-id]`).dataset.messageId;
        const message = ChatMessage.get(messageId);
        if (message) {
            const parsedMessageContent = document.createElement("div");
            parsedMessageContent.innerHTML = message.content;
            const button = parsedMessageContent.querySelector(`button.roll-breakfall`);
            if (button) {
                button.style.color = "darkgray";
                console.log(`emit updateChatMessage`);
                if (game.user.isGM) {
                    await message.update({ content: parsedMessageContent.innerHTML });
                } else {
                    game.socket.emit(`system.${game.system.id}`, {
                        operation: "updateChatMessage",
                        userId: game.user.id,
                        messageId: messageId,
                        content: parsedMessageContent.innerHTML,
                        //actor: targetActor,
                        //token: targetToken,
                    });
                }
            }
        }
    } catch (e) {
        // Likely permissions issue, need to sockets it
        console.error(e);
    }

    const speaker = ChatMessage.getSpeaker({ actor: targetActor, token: targetToken });

    // Make sure there are enough resources and consume them
    const {
        error: resourceError,
        warning: resourceWarning,
        resourcesUsedDescription,
        resourcesUsedDescriptionRenderedRoll,
    } = await userInteractiveVerifyOptionallyPromptThenSpendResources(breakFallItem, {
        noResourceUse: overrideCanAct,
    });
    if (resourceError || resourceWarning) {
        const chatData = {
            author: game.user._id,
            content: `${breakFallItem.name} ${resourceError || resourceWarning}`,
            speaker,
        };

        ChatMessage.create(chatData);
    } else {
        // We have confirmed we have enough resources and spent them, now we need to roll the breakfall
        const skillRoller = new HeroRoller().addDice(3);
        let successValue = 0;
        const tags = foundry.utils.deepClone(breakFallItem.system.tags);
        for (const tag of tags) {
            successValue = successValue + tag.value;
        }

        // 5e has -1 for each 2" (ignoring fractions)
        // 6e has -1 for each 4m or fraction thereof
        const kbPenalty = targetActor.is5e
            ? -Math.floor(knockbackResultTotal / 2)
            : -Math.ceil(knockbackResultTotal / 2);
        if (kbPenalty !== 0) {
            tags.push({
                value: kbPenalty,
                name: "KB Penalty",
                title: `KB Penalty -1 per ${targetActor.is5e ? `2"` : `4m or fraction thereof`} of KB`,
            });
            successValue += kbPenalty;
        }

        await skillRoller.makeSuccessRoll(true, successValue).roll();

        const succeeded = skillRoller.getSuccess();
        const autoSuccess = skillRoller.getAutoSuccess();
        const total = skillRoller.getSuccessTotal();
        const margin = successValue - total;

        const successFlavor =
            button.dataset.knockbackResultTotal == undefined
                ? "You stand up and regain control as a <b>Zero Phase</b> action."
                : "Regained control after Knockback (not possible if Knocked Back into something). No longer prone.";
        const failFlavor =
            button.dataset.knockbackResultTotal == undefined
                ? "You stand up and regain control as a <b>Half Phase</b> action."
                : "Failed to regain control. Remains prone.";

        const flavor = `${breakFallItem.name.toUpperCase()}
                        ${breakFallItem.system.INPUT && !breakFallItem.name.match(new RegExp(breakFallItem.system.INPUT, "i")) ? `: ${breakFallItem.system.INPUT}` : ``}
                        (${successValue}-) roll
                        <b class="${succeeded ? "announce-success" : "announce-failure"}">
                        ${succeeded ? "succeeded" : "failed"} by ${
                            autoSuccess === undefined ? `${Math.abs(margin)}` : `rolling ${total}`
                        }</b>. ${succeeded ? successFlavor : failFlavor}`;
        const rollHtml = await skillRoller.render(flavor);

        // render card
        const cardData = {
            tags: tags.map((tag) => {
                return { ...tag, value: tag.value.signedString() };
            }),
            rolls: skillRoller.rawRolls(),
            renderedRoll: rollHtml,
            resourcesUsedDescription: resourcesUsedDescription
                ? `Spent ${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`
                : "",
            user: game.user._id,
            speaker: speaker,
        };
        const template = `systems/${HEROSYS.module}/templates/chat/skill-success-roll-card.hbs`;
        const cardHtml = await renderTemplate(template, cardData);

        const chatData = {
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            rolls: skillRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };
        ChatMessage.create(chatData);

        // Need to be bit careful to only remove prone.
        // Intentionally don't apply prone on BREAKFALL failure as the prone status may have manually been changed.
        if (succeeded) {
            await targetActor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
                active: false,
            });
        }
    }
}

export async function _onRollMindScan(event) {
    console.log(event);
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.
    const toHitData = { ...button.dataset };

    // PH: FIXME: This is now included in the action data and this can be cleaned up
    const { actor, item } = rehydrateActorAndAttackItem(toHitData);

    if (!item || !actor) {
        return ui.notifications.error(`Mind scan details are no longer available.`);
    }

    // We may need to use selected token
    if (toHitData.target === "Selected") {
        if (canvas.tokens.controlled.length === 0) {
            return ui.notifications.error(`You must select a valid token for ${item.name}.`);
        }

        if (canvas.tokens.controlled.length > 1) {
            return ui.notifications.error(`You must select exactly 1 token for ${item.name}.`);
        }

        toHitData.target = canvas.tokens.controlled[0].id;
    }

    // Look through all the scenes to find this token
    const token = game.scenes
        .find((s) => s.tokens.find((t) => t.id === toHitData.target))
        ?.tokens.find((t) => t.id === toHitData.target);
    if (!token && toHitData.target) {
        await ui.notifications.error(`Token details are no longer available.`);
        return;
    }
    if (token?.actor.id === item.actor.id) {
        await ui.notifications.error(
            `${token.name} is not a valid target for ${item.name}.  You can't MINDSCAN yourself.`,
        );
        return;
    }

    const data = {
        targetTokenId: toHitData.target,
        targetName: token?.name,

        item,
        itemJsonStr: toHitData.itemJsonStr,
        actor: item.actor,
    };

    const template = `systems/${HEROSYS.module}/templates/attack/item-mindscan-target-card.hbs`;
    const content = await renderTemplate(template, data);
    const chatData = {
        author: game.user._id,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        content,
        speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    };

    await ChatMessage.create(chatData);
}

export async function _onRollMindScanEffectRoll(event) {
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.
    const toHitData = { ...button.dataset };

    // PH: FIXME: This is now included in the action data and this can be cleaned up
    const { actor, item } = rehydrateActorAndAttackItem(toHitData);

    if (!item || !actor) {
        return ui.notifications.error(`Mind scan details are no longer available.`);
    }

    // Look through all the scenes to find this token
    const token = game.scenes
        .find((s) => s.tokens.find((t) => t.id === toHitData.target))
        ?.tokens.find((t) => t.id === toHitData.target);
    if (!token) {
        return ui.notifications.error(`Token details are no longer available.`);
    }

    const targetsEgo = parseInt(token.actor.system.characteristics.ego?.value);
    const egoAdder = parseInt(button.innerHTML.match(/\d+/)) || 0;
    const targetEgo = targetsEgo + egoAdder;

    const adjustment = item.effectiveAttackItem.isAdjustment;
    const senseAffecting = item.effectiveAttackItem.isSenseAffecting;

    const useStandardEffect = item.effectiveAttackItem.system.USESTANDARDEFFECT || false;

    const { diceParts, tags } = calculateDicePartsForItem(item, {
        isAction: true,
        ...toHitData,
    });

    const mindScanRoller = new HeroRoller()
        .modifyTo5e(actor.system.is5e)
        .makeEffectRoll()
        .addDice(diceParts.d6Count >= 1 ? diceParts.d6Count : 0)
        .addHalfDice(diceParts.halfDieCount >= 1 ? diceParts.halfDieCount : 0)
        .addDiceMinus1(diceParts.d6Less1DieCount >= 1 ? diceParts.d6Less1DieCount : 0)
        .addNumber(diceParts.constant)
        .modifyToStandardEffect(useStandardEffect);

    await mindScanRoller.roll();

    const damageRenderedResult = await mindScanRoller.render();

    // Conditional defense not implemented yet
    const ignoreDefenseIds = [];

    // -------------------------------------------------
    // determine active defenses
    // -------------------------------------------------
    let defense = "";
    const {
        defenseValue,
        resistantValue,
        impenetrableValue,
        damageReductionValue,
        damageNegationValue,
        knockbackResistanceValue,
        defenseTags,
    } = getActorDefensesVsAttack(token.actor, item.effectiveAttackItem, { ignoreDefenseIds });
    if (damageNegationValue > 0) {
        defense += "Damage Negation " + damageNegationValue + "DC(s); ";
    }

    defense = defense + defenseValue + " normal; " + resistantValue + " resistant";

    if (damageReductionValue > 0) {
        defense += "; damage reduction " + damageReductionValue + "%";
    }

    const damageData = {};
    damageData.defenseValue = defenseValue;
    damageData.resistantValue = resistantValue;
    damageData.impenetrableValue = impenetrableValue;
    damageData.damageReductionValue = damageReductionValue;
    damageData.damageNegationValue = damageNegationValue;
    damageData.knockbackResistanceValue = knockbackResistanceValue;
    damageData.defenseAvad =
        defenseValue +
        resistantValue +
        impenetrableValue +
        damageReductionValue +
        damageNegationValue +
        knockbackResistanceValue;
    damageData.targetToken = token;

    const damageDetail = await _calcDamage(mindScanRoller, item, damageData);

    const cardData = {
        item: item,
        adjustment,
        senseAffecting,
        targetsEgo,
        egoAdder,
        targetEgo,
        success: damageDetail.effect >= targetEgo,
        buttonText: button.innerHTML.trim(),
        buttonTitle: button.title.replace(/\n/g, " ").trim(),
        defense,
        defenseTags,

        // dice rolls
        renderedDamageRoll: damageRenderedResult,
        renderedStunMultiplierRoll: damageDetail.renderedStunMultiplierRoll,
        roller: mindScanRoller.toJSON(),

        // effect
        effectDamage: damageDetail.effect,

        // misc
        targetIds: toHitData.targetIds,
        tags: tags,

        attackTags: getAttackTags(item),
        targetToken: token,
        user: game.user,
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/attack/item-mindscan-damage-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: mindScanRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
    return;
}

/**
 * Event handler for apply damage for the generic roller
 */
export async function _onGenericRollerApplyDamage(event) {
    const button = event.currentTarget;
    const damageData = { ...button.dataset };

    // Since this is coming through the generic damage roll user flow there may or may not be a real actor attached.
    const actor = damageData.actorUuid
        ? fromUuidSync(damageData.actorUuid)
        : new HeroSystem6eActor({
              name: `Generic Actor`,
              type: "npc",
          });

    const item = rehydrateAttackItem(damageData.itemJsonStr, actor).item;

    actor.system.is5e = item.system.is5e;

    if (!damageData.actorUuid) {
        actor.items.set(item.system.XMLID, item);
    }

    return _onApplyDamage(event, actor, item);
}

/**
 *
 * @param {HeroSystem6eItem[]} conditionalDefenses
 * @param {string[]} ignoreDefenseIds
 *
 * @returns {Object} - BODY multiplier, STUN multiplier, and array of vulnerability descriptions
 */
function determineVulerabilityToAttack(conditionalDefenses, ignoreDefenseIds) {
    const vulnDesc = [];
    let vulnStunMultiplier = 1;
    let vulnBodyMultiplier = 1;

    for (const vuln of conditionalDefenses.filter(
        (o) => o.system.XMLID === "VULNERABILITY" && !ignoreDefenseIds.includes(o.id),
    )) {
        vulnDesc.push(vuln.conditionalDefenseShortDescription);

        // There can only be 1 vulnerability modifier (or if blank a default HALFSTUN)
        const modifier = vuln.modifiers[0];
        if (modifier) {
            switch (modifier.OPTIONID) {
                case "HALFSTUN":
                    vulnStunMultiplier += 0.5;
                    break;
                case "TWICESTUN":
                    vulnStunMultiplier += 1;
                    break;
                case "HALFBODY":
                    vulnBodyMultiplier += 0.5;
                    break;
                case "TWICEBODY":
                    vulnBodyMultiplier += 1;
                    break;
                case "HALFEFFECT":
                    vulnStunMultiplier += 0.5;
                    vulnBodyMultiplier += 0.5;
                    break;
                case "TWICEEFFECT":
                    vulnStunMultiplier += 1;
                    vulnBodyMultiplier += 1;
                    break;

                default:
                    console.warn(`Unhandled VULNERABILITY ${modifier.modifier.OPTIONID}`, vuln);
            }
        } else {
            // Default VULNERABILITY is 1.5x STUN
            vulnStunMultiplier += 0.5;
        }
    }

    return { vulnBodyMultiplier, vulnStunMultiplier, vulnDesc };
}

/**
 * Event handler for when the Apply Damage button is clicked on item-damage-card.hbs Notice the chatListeners function in this file.
 */
export async function _onApplyDamage(event, actorParam, itemParam) {
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.

    const damageData = { ...button.dataset };
    const targetTokens = JSON.parse(damageData.targetTokens);
    const action = actionFromJSON(damageData.actionData);

    const actor = actorParam || fromUuidSync(damageData.actorUuid);

    const item = itemParam || rehydrateAttackItem(damageData.itemJsonStr, actorParam || actor).item;

    if (targetTokens.length === 0) {
        // Check to make sure we have a selected token
        if (canvas.tokens.controlled.length == 0) {
            return ui.notifications.warn(`You must select at least one token before applying damage.`);
        }

        for (const token of canvas.tokens.controlled) {
            await _onApplyDamageToSpecificToken(item, damageData, action, {
                tokenId: token.id,
                targetTokenUuid: token.document.uuid,
                name: token.name,
                subTarget: null,
                targetEntangle: undefined,
            });
        }
    } else {
        // Apply to all provided targets
        for (const targetToken of targetTokens) {
            await _onApplyDamageToSpecificToken(item, damageData, action, targetToken);

            // If entangle is transparent to damage, damage actor too
            if (targetToken.targetEntangle) {
                const token = canvas.scene.tokens.get(targetToken.tokenId);
                const ae = token.actor?.appliedEffects.find((o) => o.flags[game.system.id]?.XMLID === "ENTANGLE");
                if (ae) {
                    const { item: entangle } = rehydrateAttackItem(
                        ae.flags[game.system.id].dehydratedEntangleItem,
                        fromUuidSync(ae.flags[game.system.id].dehydratedEntangleActorUuid),
                    );
                    if (!entangle) {
                        console.error(ae);
                        return ui.notifications.error(`Entangle details are no longer available.`);
                    }
                    if (entangle.findModsByXmlid("TAKESNODAMAGE") || entangle.findModsByXmlid("BOTHDAMAGE")) {
                        await _onApplyDamageToSpecificToken(item, damageData, action, {
                            ...targetToken,
                            targetEntangle: false,
                        });
                    }
                }
            }
        }
    }

    // change font color to indicate this button has already been pressed
    $(button).css("color", "#A9A9A9");
}

export async function _onApplyDamageToSpecificToken(item, _damageData, action, targetData) {
    const damageData = foundry.utils.deepClone(_damageData);
    const targetToken =
        fromUuidSync(targetData.targetTokenUuid) ?? tokenEducatedGuess({ tokenId: targetData?.tokenId }); // canvas.scene.tokens.get(targetToken.tokenId);
    if (!targetToken) {
        return ui.notifications.warn(`You must select at least one token before applying damage.`);
    }

    if (!targetToken.actor) {
        return ui.notifications.error(
            `Actor for ${targetToken.name} is missing.  Unable to apply damage.  You will have to create a new actor & token.`,
        );
    }

    if (!item) {
        // This typically happens when the attack id stored in the damage card no longer exists on the actor.
        // For example if the attack item was deleted or the HDC was uploaded again.
        console.warn(damageData.itemId);
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    // Remove haymaker status — a scheduled delayed resolution keeps it until it lands
    if (!hasScheduledHaymaker(item.actor)) {
        await endHaymakerManeuver(item.actor);
    }

    const damageRoller = HeroRoller.fromJSON(damageData.roller);

    const explosion = item.effectiveAttackItem.hasExplosionAdvantage();
    if (explosion) {
        const aoeTemplate = item.effectiveAttackItem.getAoeTemplateForBaseItem;

        if (aoeTemplate) {
            // Distance from center
            if (
                game.scenes.current?.grid.type === CONST.GRID_TYPES.SQUARE &&
                game.settings.get("core", "gridDiagonals") !== CONST.GRID_DIAGONALS.EXACT
            ) {
                ui.notifications.warn(
                    'The Core FoundryVTT setting, "Square Grid Diagonals", needs to be "Exact (√2)" for correct measurement and behavior for this scene because it has square grid.',
                );
            }

            // Explosion
            // Simple rules is to remove the hightest dice term for each
            // hex distance from center. Works fine when radius = dice,
            // but that isn't always the case.

            let distance;
            let pct;

            // 5e distance measurements are not the same as 6e which just uses euclidian measurements. If the game
            // is being played with 5e measurements use them to figure the distance correctly.
            const hexTemplates = game.settings.get(HEROSYS.module, "HexTemplates");
            const hexGrid = currentSceneUsesHexGrid();

            // Unclear why we need this (token vs prototypetoken?, different code paths?)
            // https://github.com/dmdorman/hero6e-foundryvtt/issues/3725
            const targetTokenCenter = targetToken.center ?? targetToken.object.center;
            if (targetToken.object?.center) {
                console.warn(`targetToken.object.center was unexpected`);
            }

            // Region shape sizes are in pixels.
            const shape = aoeTemplate.shapes?.[0];
            const templateSizeInMeters =
                ((shape?.radius ?? shape?.length ?? 0) / canvas.grid.size) * getGridSizeInMeters();

            if (!templateSizeInMeters) {
                console.warn(`Unable to determine AoE template size, applying full effect`, aoeTemplate);
            }

            if (hexTemplates && hexGrid) {
                const gridSizeInMeters = getGridSizeInMeters();
                distance = calculateDistanceBetween(aoeTemplate, targetTokenCenter).gridSpaces * gridSizeInMeters;

                // NOTE: The template is half a hex (1m) smaller since the centre hex counts as 1" (see _spawnAreaOfEffect)
                pct = templateSizeInMeters ? distance / (templateSizeInMeters + 1) : 0;
            } else {
                distance = calculateDistanceBetween(aoeTemplate, targetTokenCenter).distance;
                pct = templateSizeInMeters ? distance / templateSizeInMeters : 0;
            }

            // Remove highest N terms
            // TODO: We could improve this by dropping part terms for situations where we have >5AP/die
            const originalNumberOfTerms = damageRoller.getFullBaseTerms().base.length;
            const termsToRemove = Math.floor(pct * originalNumberOfTerms);
            damageRoller.removeNHighestRankTerms(termsToRemove);
        } else {
            ui.notifications.warn(
                `No Area Of Effect template was found, will apply FULL EFFECT to ${targetData.name}.`,
            );
        }
    }

    // This the raw damage received by the target before any defenses (i.e. after explosion and other range effects).
    // You probably don't want to use it - use damageRoller instead.
    const baseDamageRoller = damageRoller.clone();

    const automation = game.settings.get(HEROSYS.module, "automation");

    // Maneuvers can include effects beyond damage
    if (["maneuver", "martialart"].includes(item.type)) {
        await doManeuverEffects(item, action, targetToken);
    }

    if (item.effectiveAttackItem.isEntangle) {
        return _onApplyEntangleToSpecificToken(item, targetToken, damageRoller, action);
    }

    // Target an ENTANGLE?
    const entangleAE = targetToken.actor.appliedEffects.find((o) => o.flags[game.system.id]?.XMLID === "ENTANGLE");
    if (entangleAE) {
        // Targeting ENTANGLE based on attack-application checkbox
        let targetEntangle = targetData.targetEntangle;

        // If they clicked "Apply Damage" then prompt
        // WHAT? if (damageRoller.getType === HeroRoller.ROLL_TYPE.ENTANGLE) {
        if (damageRoller.getType() !== HeroRoller.ROLL_TYPE.ENTANGLE && targetEntangle === undefined) {
            targetEntangle = await foundry.applications.api.DialogV2.wait({
                window: { title: `Confirm Target` },
                content: `Target ${targetToken.name} or the ENTANGLE effecting ${targetToken.name}?`,
                buttons: [
                    {
                        action: "token",
                        label: `${targetToken.name}`,
                        default: true,
                        callback: () => false,
                    },
                    {
                        action: "entangle",
                        label: `ENTANGLE`,
                        callback: () => true,
                    },
                ],
            });
        }

        if (targetEntangle && entangleAE) {
            return _onApplyDamageToEntangle(item, targetToken, damageRoller, entangleAE, action);
        }
    }

    if (damageRoller.getHitLocation().item) {
        return ui.notifications.error(`Damaging FOCI is not currently supported.`);
    }

    // Attack Verses Alternate Defense (6e) or NND (5e)
    let avad = item.effectiveAttackItem.findModsByXmlid("AVAD") || item.effectiveAttackItem.findModsByXmlid("NND");

    // Martial Arts also have NNDs which are special AVAD and always/usually PD
    if (!avad && item.system.EFFECT?.includes("NND")) {
        const pdXml = getPowerInfo({ xmlid: "PD", xmlTag: "PD", actor: targetToken.actor });
        avad = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(pdXml.xml, targetToken.actor), {
            parent: targetToken.actor,
        });
        avad.system.LEVELS = 1;

        // Massive Kludge: MANEUVERS don't have INPUT but some of the rest of the code includes check for that
        item.system.INPUT = "PD";
        avad.INPUT = "PD";
    }

    // Try to make sure we have a PD/ED/MD type for AVAD
    if (avad && !avad.INPUT && item.effectiveAttackItem.system.INPUT) {
        avad.INPUT = item.effectiveAttackItem.system.INPUT;
    }

    // Check for conditional defenses
    const { ignoreDefenseIds, conditionalDefenses } = await getConditionalDefenses(
        targetToken,
        item.effectiveAttackItem,
        avad,
    );

    // If we had conditional defenses and showed the UI to select them, but canceled, getConditionalDefenses returns null values
    if (ignoreDefenseIds === null) {
        return;
    }

    // Some defenses require a roll not just to activate, but on each use: 6e EVERYPHASE, 5e ACTIVATIONROLL, 5e SECTIONAL_DEFENSES, and 5e & 6e ABLATIVE
    const activatableDefenses = targetToken.actor.items
        .filter(
            (o) =>
                o.isActive &&
                (o.findModsByXmlid("EVERYPHASE") ||
                    o.findModsByXmlid("ACTIVATIONROLL") ||
                    o.findModsByXmlid("SECTIONAL_DEFENSES") ||
                    o.findModsByXmlid("ABLATIVE")) &&
                o.baseInfo.behaviors.includes("defense"),
        )
        .filter((defense) => !ignoreDefenseIds.includes(defense.id))
        .filter(
            (defense) =>
                getItemDefenseVsAttack(defense, item.effectiveAttackItem, {
                    attackDefenseVs: item.effectiveAttackItem.attackDefenseVs,
                }) !== null,
        );

    for (const defense of activatableDefenses) {
        const rar =
            defense.findModsByXmlid("EVERYPHASE") ||
            defense.findModsByXmlid("ACTIVATIONROLL") ||
            defense.findModsByXmlid("SECTIONAL_DEFENSES");
        let rarSuccess = true;
        if (rar) {
            rarSuccess = await isActivatedForThisUse(defense, {
                hitLocationNum: damageRoller.hitLocationValid() ? damageRoller.getHitLocation().num : null,
            });
        }

        const ablative = defense.findModsByXmlid("ABLATIVE");
        let ablativeActivated = true;
        if (rarSuccess && ablative) {
            ablativeActivated = await rollAblativeActivationCheck(defense);
        }

        if (!rarSuccess || !ablativeActivated) {
            ignoreDefenseIds.push(defense.id);
        }
    }

    // -------------------------------------------------
    // determine active defenses
    // -------------------------------------------------
    let defense = "";

    // New Defense Stuff
    const { defenseValue, resistantValue, impenetrableValue, damageReductionValue, damageNegationValue, defenseTags } =
        getActorDefensesVsAttack(targetToken.actor, item.effectiveAttackItem, { ignoreDefenseIds });

    if (damageNegationValue > 0) {
        defense += "Damage Negation " + damageNegationValue + "DC(s); ";
    }

    defense = defense + defenseValue + " normal; " + resistantValue + " resistant";

    if (damageReductionValue > 0) {
        defense += "; damage reduction " + damageReductionValue + "%";
    }

    damageData.defenseValue = defenseValue;
    damageData.resistantValue = resistantValue;
    damageData.impenetrableValue = impenetrableValue;
    damageData.damageReductionValue = damageReductionValue;
    damageData.damageNegationValue = damageNegationValue;
    damageData.defenseAvad =
        defenseValue + resistantValue + impenetrableValue + damageReductionValue + damageNegationValue;
    damageData.targetToken = targetToken;

    // VULNERABILITY
    ({
        vulnStunMultiplier: damageData.vulnStunMultiplier,
        vulnBodyMultiplier: damageData.vulnBodyMultiplier,
        vulnDesc: damageData.VulnDesc,
    } = determineVulerabilityToAttack(conditionalDefenses, ignoreDefenseIds));

    // AVAD All or Nothing
    if (avad) {
        const nnd = avad.adders.find((o) => o.XMLID === "NND"); // Check for ALIAS="All Or Nothing" shouldn't be necessary
        if (nnd && damageData.defenseAvad > 0) {
            // render card
            const speaker = ChatMessage.getSpeaker({ actor: item.actor, token: targetToken });
            const chatData = {
                author: game.user._id,
                content: `${item.name} did no damage to ${targetToken.name}.`,
                speaker: speaker,
            };

            await ChatMessage.create(chatData);
            return;
        }
    }

    damageRoller.removeNDC(damageData.damageNegationValue);

    // We need to recalculate damage to account for possible Damage Negation
    const damageDetail = await _calcDamage(damageRoller, item, damageData);

    const isTransform = item.effectiveAttackItem.isTransform;
    const isAdjustment = item.effectiveAttackItem.isAdjustment;
    const isSenseAffecting = item.effectiveAttackItem.isSenseAffecting;

    if (isTransform) {
        return _onApplyTransformationToSpecificToken(item, targetToken, damageDetail, defense, defenseTags, action);
    } else if (isAdjustment) {
        return _onApplyAdjustmentToSpecificToken(item, targetToken, damageDetail, defense, defenseTags, action);
    } else if (isSenseAffecting) {
        return _onApplySenseAffectingToSpecificToken(item, targetToken, damageDetail, damageRoller, action);
    }

    // Ablate defenses in the defenseTags, if appropriate.
    // PH: FIXME: Need to consider damage before damage negation for ablative? Check rules.
    await ablateDefenses(
        item,
        { stun: damageDetail.stunDamage, body: damageDetail.bodyDamage },
        defenseTags,
        targetToken,
    );

    // AUTOMATION immune to mental powers
    if (item.effectiveAttackItem.system.class === "mental" && targetToken?.actor?.type === "automaton") {
        defenseTags.push({
            name: "AUTOMATON",
            value: "immune",
            resistant: false,
            title: "Automations are immune to mental powers",
        });
        damageDetail.stun = 0;
        damageDetail.body = 0;
    }

    // A number of actor types (Base, Vehicle) don't have STUN. Other actor types (e.g. automaton, npc, pc) sometimes don't have
    // STUN. Consider these cases and eliminate the STUN portion of things if it's one of these cases but provide information why.
    const specialAutomatonPowers = targetToken.actor.getAutomatonSpecialPowers();
    const hasStunCharacteristic = targetToken.actor.hasCharacteristic("STUN");
    if (damageDetail.stun > 0) {
        if (specialAutomatonPowers.takesNoStunButLosesFunctionOnBody) {
            defenseTags.push({
                name: "TAKES NO STUN",
                value: "immune",
                resistant: false,
                title: "Automaton ignores the STUN damage from any attack; loses abilities when takes BODY",
            });

            damageDetail.effects = damageDetail.effects + "Takes No STUN (loses abilities when takes BODY); ";
            damageDetail.stun = 0;
        } else if (specialAutomatonPowers.takesNoStun) {
            defenseTags.push({
                name: "TAKES NO STUN",
                value: "immune",
                resistant: false,
                title: "Automaton ignores the STUN damage from any attack",
            });

            damageDetail.effects = damageDetail.effects + "Takes No STUN; ";
            damageDetail.stun = 0;
        } else if (!hasStunCharacteristic) {
            // Vehicle and Bases have no STUN characteristic
            defenseTags.push({
                name: "TAKES NO STUN",
                value: "immune",
                resistant: false,
                title: "Actor type ignores the STUN damage from any attack",
            });

            damageDetail.effects = damageDetail.effects + "Takes No STUN; ";
            damageDetail.stun = 0;
        }
    }

    // Could they be stunned?
    // See if there was any STUN done (i.e. 0 STUN attack can't STUN someone with zero or negative CON)
    // See if token has CON.  Notice we check raw actor type from config, not current actor props as
    // this token may have originally been a PC, and changed to a BASE.
    // check if target is stunned.  Must have CON.
    const hasCon = targetToken.actor.hasCharacteristic("CON");
    if (damageDetail.stun > 0 && game.settings.get(HEROSYS.module, "stunned") && hasCon) {
        // determine if target was Stunned
        if (
            damageDetail.stun > targetToken.actor.system.characteristics.con.value &&
            !specialAutomatonPowers.cannotBeStunned
        ) {
            damageDetail.effects = damageDetail.effects + "inflicts Stunned; ";

            // none: "No Automation",
            // npcOnly: "NPCs Only (end, stun, body)",
            // pcEndOnly: "PCs (end) and NPCs (end, stun, body)",
            // all: "PCs and NPCs (end, stun, body)"
            if (automation === "all" || (automation === "npcOnly" && targetToken.actor.type === "npc")) {
                await targetToken.actor.toggleStatusEffect(
                    HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id,
                    {
                        overlay: false, // Would like to know if they are prone, and the contrast isn't great.
                        active: true,
                    },
                );
            }
        }
    }

    const damageRenderedResult = await damageRoller.render();

    // Attack may have additional effects, such as those from martial arts
    let effectsFinal = foundry.utils.deepClone(damageDetail.effects);
    if (item.effectiveAttackItem.system.effect) {
        for (const effect of item.effectiveAttackItem.system.effect.split(",")) {
            // Do not include [NORMALDC] strike and similar
            if (effect.indexOf("[") == -1 && !effect.match(/strike/i)) {
                effectsFinal += effect;
            }
        }
    }
    effectsFinal = effectsFinal.replace(/; $/, "");

    // Mind Control
    if (item.effectiveAttackItem.system.XMLID === "MINDCONTROL") {
        const targetActorEgo = targetToken.actor?.system.characteristics?.ego?.value;
        if (targetActorEgo !== undefined) {
            if (damageDetail.stunDamage >= targetActorEgo + 30) {
                effectsFinal += `EGO+30: Target will perform actions they are violently opposed to doing. Target will believe statements that contradict strongly held personal beliefs or principles (such as Psychological Complications) or that contradict reality under direct observation.`;
            } else if (damageDetail.stunDamage >= targetActorEgo + 20) {
                effectsFinal += `EGO+20: Target will perform actions they are normally against doing. Target will believe any statement that doesn't contradict strongly held personal beliefs or principles (such as Psychological Complications).`;
            } else if (damageDetail.stunDamage >= targetActorEgo + 10) {
                effectsFinal += `EGO+10: Target will perform actions they wouldn't mind doing. Target will believe any statement that doesn't contradict reality under direct observation.`;
            } else if (damageDetail.stunDamage >= targetActorEgo) {
                effectsFinal += `EGO+0: Target will perform actions they are inclined to perform anyway. Target believes any statement which doesn't contradict prior knowledge.`;
            } else {
                effectsFinal += `No effect.`;
            }
        }
    }

    const cardData = {
        item: item,
        actor: item.actor,
        itemJsonStr: dehydrateAttackItem(item),

        // Incoming Damage Information
        incomingDamageSummary: baseDamageRoller.getTotalSummary(),
        incomingAnnotatedDamageTerms: baseDamageRoller.getAnnotatedTermsSummary(),

        // dice rolls
        roller: damageRoller,
        renderedDamageRoll: damageRenderedResult,
        renderedStunMultiplierRoll: damageDetail.renderedStunMultiplierRoll,
        knockbackRoll: damageDetail.knockbackRoller,

        // body
        bodyDamage: damageDetail.bodyDamage,
        bodyDamageEffective: damageDetail.body,

        // stun
        stunDamage: damageDetail.stunDamage,
        stunDamageEffective: damageDetail.stun,
        hasRenderedDamageRoll: true,
        stunMultiplier: damageDetail.stunMultiplier,
        hasStunMultiplierRoll: damageDetail.hasStunMultiplierRoll,

        // damage info
        damageString: baseDamageRoller.getTotalSummary(),
        useHitLoc: damageDetail.useHitLoc,
        hitLocText: damageDetail.hitLocText,
        damageBreakdown: damageDetail.damageBreakdown,

        // effects
        effects: effectsFinal,

        // defense
        defense: defense,
        damageNegationValue: damageNegationValue,
        ignoreDefenseIdsJson: JSON.stringify(ignoreDefenseIds),

        // knockback
        knockbackMessage: damageDetail.knockbackMessage,
        useKnockBack: damageDetail.useKnockBack,
        knockbackRenderedResult: damageDetail.knockbackRenderedResult,
        knockbackTags: damageDetail.knockbackTags,
        knockbackResultTotal: damageDetail.knockbackResultTotal,
        knockbackResultTotalWithShrinking: damageDetail.knockbackResultTotal + damageDetail.shrinkingKB,
        canBreakFall:
            !damageDetail.preKnockBackProneStatus &&
            (targetToken?.document ?? targetToken).actor.items.find(
                (o) => o.system.XMLID === "BREAKFALL" && o.isActive,
            ),

        // misc
        tags: defenseTags.filter((o) => !o.options?.knockback),
        attackTags: getAttackTags(item),
        attackerToken: tokenEducatedGuess({ action, actor: item.actor }),
        targetTokenDocument: targetToken?.document ?? targetToken,
        actionData: actionToJSON(action),
        showRemovePowerFromAutomaton: specialAutomatonPowers.takesNoStunButLosesFunctionOnBody && damageDetail.body > 0,
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-damage-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: item.actor, token: targetToken });

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        rolls: damageDetail.knockbackRoller?.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    // none: "No Automation",
    // npcOnly: "NPCs Only (end, stun, body)",
    // pcEndOnly: "PCs (end) and NPCs (end, stun, body)",
    // all: "PCs and NPCs (end, stun, body)"
    if (automation === "all" || (automation === "npcOnly" && targetToken.actor.type === "npc")) {
        const changes = {
            "system.characteristics.body.value":
                targetToken.actor.system.characteristics.body.value - damageDetail.body,
        };

        // See if token has STUN.  Notice we check raw actor type from config, not current actor props as
        // this token may have originally been a PC, and changed to a BASE.
        const hasSTUN = targetToken.actor.hasCharacteristic("STUN");
        if (hasSTUN) {
            changes["system.characteristics.stun.value"] =
                targetToken.actor.system.characteristics.stun?.value - damageDetail.stun;
        }

        await targetToken.actor.update(changes);
    }

    const damageChatMessage = ChatMessage.create(chatData);

    // Absorption happens after damage is taken unless the GM allows it. This system doesn't allow GM choice.
    const absorptionItems = targetToken.actor.items.filter(
        (item) => item.system.XMLID === "ABSORPTION" && item.isActive,
    );
    if (absorptionItems) {
        await _performAbsorptionForToken(targetToken, absorptionItems, damageDetail, item);
    }

    return damageChatMessage;
}

/**
 * Ablate defenses. These must be done in order of "weakest" (ya that's the books' term) first. If a defense gets
 * pierced then provide a chat card to indicate that it was and adjust the ablative defense to track number of times
 * the defense has been pierced.
 *
 * @param {HeroSystem6eItem} attackItem
 * @param {Object} remainingDamage - used and consumed by this function.
 * @param {number} remainingDamage.stun
 * @param {number} remainingDamage.body
 * @param {Object[]} defenseTags
 */
async function ablateDefenses(attackItem, remainingDamage, defenseTags, targetToken) {
    // Were one or more of the activated defenses ablative? If so, check if they get ablated.
    // Ablative defenses must apply first with the lowest ablative defense first.
    const ablativeDefenseObjs = foundry.utils
        .deepClone(defenseTags)
        .map((defenseTag) => {
            return {
                item: targetToken.actor.items.find((item) => item.id === defenseTag.defenseItemId),
                defenseTag: defenseTag,
            };
        })
        .filter((defenseObj) => defenseObj.item?.findModsByXmlid("ABLATIVE"))
        .sort((defenseA, defenseB) => {
            // If the defense level is the same, consider ablative defenses that can be exeeded by BODY or STUN
            // to be the "weaker" defense when compared to ablative defenses of the name nominal defensive value
            // that can be exceed by only BODY and thus should come first per FRed pg. 115 despite no explicit calling it out.
            if (defenseA.defenseTag.value === defenseB.defenseTag.value) {
                const defenseABodyAndStun = defenseA.item.ablativeType;
                const defenseBBodyAndStun = defenseB.item.ablativeType;

                if (defenseABodyAndStun === "BODYORSTUN" && defenseBBodyAndStun !== "BODYORSTUN") {
                    // A is weaker.
                    return -1;
                } else if (defenseABodyAndStun !== "BODYORSTUN" && defenseBBodyAndStun === "BODYORSTUN") {
                    // B is weaker.
                    return 1;
                }
            }

            // Otherwise just sort based on defense value
            return defenseA.defenseTag.value - defenseB.defenseTag.value;
        });

    for (const ablativeDefenseObj of ablativeDefenseObjs) {
        const defenseTags = getItemDefenseVsAttack(ablativeDefenseObj.item, attackItem, {});
        const ablativeDefense = foundry.utils
            .deepClone(defenseTags)
            .filter((defenseTag) => defenseTag.operation === "add")
            .reduce((accum, defenseTag) => accum + defenseTag.value, 0);
        const ablationType = ablativeDefenseObj.item.ablativeType;

        // PH: FIXME: Need to handle all the damage tag operations properly. Need to extract a function for that.
        // PH: FIXME: Doesn't handle AP and the like which should effectively reduce the defense of the object.

        // Did the remaining damage exceed this item's capacity to absorb damage? If so, ablate it.
        if (
            (ablationType === "BODYONLY" && remainingDamage.body > ablativeDefense) ||
            (ablationType === "BODYORSTUN" &&
                (remainingDamage.body > ablativeDefense || remainingDamage.stun > ablativeDefense))
        ) {
            await ablativeDefenseObj.item.update({
                "system.ablative": ablativeDefenseObj.item.system.ablative + 1,
            });

            const speaker = ChatMessage.getSpeaker({ actor: ablativeDefenseObj.item.actor });

            const chatData = {
                author: game.user._id,
                content: `${ablativeDefenseObj.item.name} ablative defense exceeded by attack from ${attackItem.name}.`,
                speaker: speaker,
            };

            await ChatMessage.create(chatData);
        }

        remainingDamage.stun = Math.max(0, remainingDamage.stun - ablativeDefense);
        remainingDamage.body = Math.max(0, remainingDamage.body - ablativeDefense);
    }
}

export async function _onApplyEntangleToSpecificToken(item, token, originalRoll) {
    const entangleDefense = item.effectiveAttackItem.baseInfo.defense(item);
    let body = originalRoll.getEntangleTotal();

    if (body <= 0) {
        const cardData = {
            item: item,

            // Incoming Damage Information
            incomingDamageSummary: originalRoll.getTotalSummary(),
            incomingAnnotatedDamageTerms: originalRoll.getAnnotatedTermsSummary(),

            // dice rolls
            roller: originalRoll,

            // damage info
            effects: `${token.name} is not affected by the 0 BODY entangle.`,

            // misc
            attackTags: getAttackTags(item),
            targetToken: token,
        };

        // render card
        const template = `systems/${HEROSYS.module}/templates/chat/apply-entangle-card.hbs`;
        const cardHtml = await renderTemplate(template, cardData);
        const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });

        const chatData = {
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        ChatMessage.create(chatData);
        return;
    }

    // Entangle Active Effect
    // Get current or a base Entangle Effect
    // If a character is affected by more than one Entangle, use the
    // highest BODY and the highest PD and ED for all the Entangles,
    // then add +1 BODY for each additional Entangle.
    // NOTE: Having a normal ENTANGLE combined with a MENTAL PARALYSIS is unusual, not not sure this code works properly in those cases.
    const prevEntangle = token.actor.effects.find((o) => o.statuses.has("entangled"));
    const prevBody = parseInt(prevEntangle?.changes?.find((o) => o.key === "body")?.value) || 0;
    if (prevEntangle) {
        entangleDefense.rPD = Math.max(
            entangleDefense.rPD,
            parseInt(prevEntangle.flags[game.system.id]?.entangleDefense?.rPD) || 0,
        );
        entangleDefense.rED = Math.max(
            entangleDefense.rED,
            parseInt(prevEntangle.flags[game.system.id]?.entangleDefense?.rED) || 0,
        );
        entangleDefense.rMD = Math.max(
            entangleDefense.rMD,
            parseInt(prevEntangle.flags[game.system.id]?.entangleDefense?.rMD) || 0,
        );
        entangleDefense.string = `${
            entangleDefense.mentalEntangle
                ? `${entangleDefense.rMD} rMD`
                : `${entangleDefense.rPD} rPD/${entangleDefense.rED} rED`
        }`;
        body = Math.max(body, prevBody) + 1;
    }
    const changes = foundry.utils.deepClone(
        activeEffectChanges(HeroSystem6eActorActiveEffects.statusEffectsObj.entangledEffect),
    );
    changes.push({
        key: "body",
        value: body,
        type: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
    });
    const activeEffect = {
        id: "entangled",
        img: HeroSystem6eActorActiveEffects.statusEffectsObj.entangledEffect.img,
        system: { changes },
        name: `${item.system.XMLID} ${body} BODY ${entangleDefense.string}`,
        description: item.system.description,
        showIcon: 2, // always
        flags: {
            [game.system.id]: {
                entangleDefense,
                XMLID: item.system.XMLID,
                source: item.actor.name,
                dehydratedEntangleItem: dehydrateAttackItem(item),
                dehydratedEntangleActorUuid: item.actor.uuid,
            },
        },
        origin: item.effectiveAttackItem.uuid, // PH: FIXME: effective items don't have uuids.
    };

    if (prevEntangle) {
        await prevEntangle.update({
            name: activeEffect.name,
            flags: activeEffect.flags,
            "system.changes": changes,
            origin: activeEffect.origin,
        });
    } else {
        await token.actor.addActiveEffect(activeEffect);
    }

    const cardData = {
        item: item,

        // Incoming Damage Information
        incomingDamageSummary: originalRoll.getTotalSummary(),
        incomingAnnotatedDamageTerms: originalRoll.getAnnotatedTermsSummary(),

        // dice rolls
        roller: originalRoll,

        // damage info
        effects: `${token.name} is entangled. The entangle has ${body} BODY ${entangleDefense.string}. ${
            prevEntangle ? `This entangle augmented a previous ${prevBody} body entangle.` : ""
        }`,

        // misc
        attackTags: getAttackTags(item),
        targetToken: token,
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-entangle-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    ChatMessage.create(chatData);
}

export async function _onApplyDamageToEntangle(attackItem, token, originalRoll, entangleAE, action) {
    // Get fully functional ActiveEffect that we can damage (update)

    // targetEntangle should belong to token
    if (entangleAE.parent?.id !== token.actor?.id) {
        return ui.notifications.error(`Unable to locate <b>${entangleAE.name}</b> on <b>${token.name}</b>.`);
    }

    // Make sure this is an ENTANGLE
    entangleAE.flags[game.system.id] ??= {};
    if (entangleAE.flags[game.system.id].XMLID !== "ENTANGLE") {
        return ui.notifications.error(
            `Damaging ${entangleAE.flags[game.system.id]?.XMLID} is not currently supported.`,
        );
    }

    // We don't support adjustment powers on entangles
    // TODO: Add drian body support for entangles
    if (attackItem.isAdjustment) {
        ui.notifications.error(
            `An entangle (${fromUuidSync(entangleAE.origin)?.name || entangleAE.name}) is not a supported target for an adjustment power (${attackItem.name}).`,
        );
        return;
    }

    let defense;
    let defenseType;
    switch (attackItem.attackDefenseVs) {
        case "PD":
            defense = entangleAE.flags[game.system.id]?.entangleDefense.rPD;
            defenseType = "rPD";
            break;
        case "ED":
            defense = entangleAE.flags[game.system.id]?.entangleDefense.rED;
            defenseType = "rED";
            break;
        case "MD":
            defense = entangleAE.flags[game.system.id]?.entangleDefense.rMD;
            defenseType = "rPMD";
            break;
    }

    if (!defense) {
        return ui.notifications.error(
            `Unable to determine appropriate defenses for ${entangleAE.name} vs ${attackItem.name}.`,
        );
    }

    const bodyChangeIdx = entangleAE.changes.findIndex((o) => o.key === "body");
    const body = entangleAE.changes[bodyChangeIdx]?.value;
    if (!body) {
        return ui.notifications.error(`Unable to determine BODY for ${entangleAE.name} vs ${attackItem.name}.`);
    }

    const defenseTags = [
        {
            name: defenseType,
            value: defense,
            resistant: true,
            title: `Entangle ${defenseType}`,
        },
        {
            name: "body",
            value: body,
            title: `Entangle Body`,
        },
    ];

    const bodyDamage = Math.max(0, originalRoll.getBodyTotal() - defense);
    const stunDamage = Math.max(0, originalRoll.getStunTotal() - defense);
    let effectsFinal;
    if (bodyDamage > 0) {
        if (bodyDamage < body) {
            const newBody = body - bodyDamage;
            const name = `${entangleAE.flags[game.system.id]?.XMLID} ${newBody} BODY ${entangleAE.flags[game.system.id]?.entangleDefense.string}`;
            entangleAE.update({ name });
            const entangleChanges = entangleAE.system.changes;
            entangleChanges[bodyChangeIdx].value = newBody;
            entangleAE.update({ "system.changes": entangleChanges });
            effectsFinal = `Entangle has ${newBody} BODY remaining.`;
        } else {
            await entangleAE.parent.removeActiveEffect(entangleAE);
            effectsFinal = `Entangle was destroyed.`;
        }
    }

    const cardData = {
        item: attackItem,
        actor: attackItem.actor,
        itemJsonStr: dehydrateAttackItem(attackItem),

        // Incoming Damage Information
        incomingDamageSummary: originalRoll.getTotalSummary(),
        incomingAnnotatedDamageTerms: originalRoll.getAnnotatedTermsSummary(),

        // dice rolls
        roller: originalRoll,

        // body
        bodyDamageEffective: bodyDamage,

        // stun
        stunDamageEffective: stunDamage,

        // effects
        effects: effectsFinal,

        // defense
        defense: `${defense} resistant`,

        // misc
        tags: defenseTags,
        targetEntangle: true,
        attackTags: getAttackTags(attackItem),
        attackerToken: tokenEducatedGuess({ action, actor: attackItem.actor }),
        targetToken: token,
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-damage-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: attackItem.actor, token });

    const chatData = {
        style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    ChatMessage.create(chatData);
}

async function _performAbsorptionForToken(token, absorptionItems, damageDetail, damageItem) {
    const attackType = damageItem.attackDefenseVs;

    // I don't think ABSORPTION works with AVAD is valid.
    // When a character purchases Absorption,
    // he specifies whether it works versus energy or
    // physical attacks.
    // Also the attack must do BODY damage.

    // Match attack against absorption type. If we match we can do some absorption.
    for (const absorptionItem of absorptionItems) {
        if (
            ((absorptionItem.system.OPTIONID === "PHYSICAL" && attackType === "PD") ||
                (absorptionItem.system.OPTIONID === "ENERGY" && attackType === "ED")) &&
            damageItem.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.stunbody
        ) {
            const actor = absorptionItem.actor;
            let maxAbsorption;
            if (actor.system.is5e) {
                const { diceParts } = calculateDicePartsForItem(absorptionItem, {});

                // Absorption allowed based on a roll with the usual requirements
                const absorptionRoller = new HeroRoller()
                    .makeAdjustmentRoll()
                    .addDice(diceParts.d6Count)
                    .addHalfDice(diceParts.halfDieCount)
                    .addDiceMinus1(diceParts.d6Less1DieCount)
                    .addNumber(diceParts.constant);

                if (diceParts.d6Count + diceParts.halfDieCount + diceParts.d6Less1DieCount + diceParts.constant) {
                    await absorptionRoller.roll();
                    maxAbsorption = absorptionRoller.getAdjustmentTotal();
                } else {
                    maxAbsorption = 0;
                }

                // Present the roll.
                const cardHtml = await absorptionRoller.render(`${attackType} attack vs ${absorptionItem.name}`);

                const speaker = ChatMessage.getSpeaker({
                    actor: actor,
                    token,
                });

                const chatData = {
                    style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                    rolls: absorptionRoller.rawRolls(),
                    author: game.user._id,
                    content: cardHtml,
                    speaker: speaker,
                };

                await ChatMessage.create(chatData);
            } else {
                maxAbsorption = parseInt(absorptionItem.system.LEVELS);
            }

            console.warn("TODO: Not tracking per segment absorption max");

            const activePointsAbsorbing = Math.min(maxAbsorption, damageDetail.bodyDamage);

            // Apply the absorption
            await _onApplyAdjustmentToSpecificToken(
                absorptionItem,
                token,
                {
                    stunDamage: activePointsAbsorbing,
                    stun: activePointsAbsorbing,
                },
                "Absorption - No Defense",
            );
        }
    }
}

async function _onApplyTransformationToSpecificToken(transformationItem, token, damageDetail, defense, defenseTags) {
    console.log("_onApplyTransformationToSpecificToken", transformationItem, token, damageDetail, defense, defenseTags);
    ui.notifications.warn("TRANSFORM damage & defenses are not yet implemented.");
}

export async function _onApplyAdjustmentToSpecificToken(
    adjustmentItem,
    token,
    damageDetail,
    defense,
    defenseTags,
    action,
) {
    if (
        adjustmentItem.effectiveAttackItem.actor.id === token.actor.id &&
        ["DISPEL", "DRAIN", "SUPPRESS", "TRANSFER"].includes(adjustmentItem.effectiveAttackItem.system.XMLID)
    ) {
        await ui.notifications.warn(
            `${adjustmentItem.effectiveAttackItem.detailedName()} attacker/source (${adjustmentItem.effectiveAttackItem.actor.name}) and defender/target (${token.actor.name}) are the same.`,
        );
    }

    // Where is the adjustment taking from/giving to?
    const { valid, reducesArray, enhancesArray } = adjustmentItem.effectiveAttackItem.splitAdjustmentSourceAndTarget();
    const adjustableItems = token.actor.items.filter(
        (o) => o.type === "power" && o.baseInfo && filterIgnoreCompoundAndFrameworkItems(o),
    );
    if (!valid && adjustableItems.length > 0) {
        // Show a list of powers from target token
        if (game.settings.get(game.system.id, "alphaTesting")) {
            let html = "<table>";
            for (const item of adjustableItems) {
                html += `<tr>`;
                html += `<td><input type="checkbox" id="${item.id}" data-dtype="Boolean" /></td>`;
                html += `<td style="text-align: left"><b>${item.name}</b>: ${item.system.description}</td>`;
                html += `</tr>`;
            }
            html += `</table>`;

            const checked =
                (await foundry.applications.api.DialogV2.wait({
                    window: { title: `Pick power to adjust` },
                    content: html,
                    buttons: [
                        {
                            action: "normal",
                            label: "Apply",
                            default: true,
                            callback: (event, button) => Array.from(button.form.querySelectorAll("input:checked")),
                        },
                        {
                            action: "cancel",
                            label: "Cancel",
                            callback: () => [],
                        },
                    ],
                })) || [];

            // When !valid the populated array holds the unparseable INPUT tokens; replace them with the
            // picks. Cancelling clears them too so the invalid-target error below aborts the adjustment.
            const targetArray =
                reducesArray.length > 0 ? reducesArray : enhancesArray.length > 0 ? enhancesArray : null;
            if (targetArray) {
                targetArray.length = 0;
                for (const checkedElement of checked) {
                    targetArray.push(checkedElement.id);
                }
            }
            if ((reducesArray?.length || 0) + (enhancesArray?.length || 0) === 0) {
                return ui.notifications.error(
                    `${adjustmentItem.effectiveAttackItem.actor.name} has an invalid adjustment sources/targets provided for ${
                        adjustmentItem.effectiveAttackItem.system.ALIAS || adjustmentItem.effectiveAttackItem.name
                    }. Compute effects manually.`,
                    { permanent: true },
                );
            } else {
                console.log(reducesArray, enhancesArray);
            }
        } else {
            return ui.notifications.error(
                `${adjustmentItem.effectiveAttackItem.actor.name} has an invalid adjustment sources/targets provided for ${
                    adjustmentItem.effectiveAttackItem.system.ALIAS || adjustmentItem.effectiveAttackItem.name
                }. Compute effects manually.`,
                { permanent: true },
            );
        }
    }

    const adjustmentItemTags = getAttackTags(adjustmentItem.effectiveAttackItem);

    const rawActivePointsEffectBeforeDefense = damageDetail.stunDamage;
    const activePointsEffectAfterDefense = damageDetail.stun;

    // DRAIN
    const reductionChatMessages = [];
    for (const reduce of reducesArray) {
        reductionChatMessages.push(
            await performAdjustment(
                adjustmentItem.effectiveAttackItem,
                reduce,
                -activePointsEffectAfterDefense,
                defense,
                damageDetail.effects,
                false,
                token,
                action,
            ),
        );
    }
    if (reductionChatMessages.length > 0) {
        await renderAdjustmentChatCards(reductionChatMessages, adjustmentItemTags, defenseTags);
    }

    // AID
    const enhancementChatMessages = [];
    for (const enhance of enhancesArray) {
        const simplifiedHealing =
            adjustmentItem.effectiveAttackItem.system.XMLID === "HEALING" && enhance.match(/simplified/i);

        if (simplifiedHealing) {
            // STUN
            enhancementChatMessages.push(
                await performAdjustment(
                    adjustmentItem.effectiveAttackItem,
                    "STUN",
                    rawActivePointsEffectBeforeDefense,
                    "None - Beneficial",
                    "",
                    false,
                    token,
                    action,
                ),
            );
            // BODY
            enhancementChatMessages.push(
                await performAdjustment(
                    adjustmentItem.effectiveAttackItem,
                    "BODY",
                    damageDetail.bodyDamage,
                    "None - Beneficial",
                    "",
                    false,
                    token,
                    action,
                ),
            );
            adjustmentItemTags.push({
                name: "SIMPLIFIED",
                title: "Body of roll heals body.  Stun of roll heals stun.",
            });
        } else {
            enhancementChatMessages.push(
                await performAdjustment(
                    adjustmentItem.effectiveAttackItem,
                    enhance,
                    adjustmentItem.effectiveAttackItem.system.XMLID === "TRANSFER"
                        ? activePointsEffectAfterDefense
                        : simplifiedHealing && enhance === "BODY"
                          ? damageDetail.bodyDamage
                          : rawActivePointsEffectBeforeDefense,
                    "None - Beneficial",
                    "",
                    false,
                    adjustmentItem.effectiveAttackItem.system.XMLID !== "TRANSFER"
                        ? token
                        : adjustmentItem.effectiveAttackItem.actor
                              .getActiveTokens()
                              ?.find((t) => t.id === action?.current?.attackerTokenUuid) ||
                              adjustmentItem.effectiveAttackItem.actor.getActiveTokens?.[0],
                    action,
                ),
            );
            adjustmentItemTags.push({ name: enhance });
        }
    }
    if (enhancementChatMessages.length > 0) {
        await renderAdjustmentChatCards(
            enhancementChatMessages,
            adjustmentItemTags,
            [], // don't show any defense tags as this is an enhancement adjustment
        );
    }
}

async function _onApplySenseAffectingToSpecificToken(
    senseAffectingItem,
    targetToken,
    damageDetail,
    damageRoller,
    action,
) {
    const defenseTags = [];

    // We currently only support sense groups, not individual senses
    const senseGroups = [
        {
            XMLID: "HEARINGGROUP",
            statusEffect: HeroSystem6eActorActiveEffects.statusEffectsObj.hearingSenseDisabledEffect,
        },
        {
            XMLID: "MENTALGROUP",
            statusEffect: HeroSystem6eActorActiveEffects.statusEffectsObj.mentalSenseDisabledEffect,
        },
        { XMLID: "RADIOGROUP", statusEffect: HeroSystem6eActorActiveEffects.statusEffectsObj.radioSenseDisabledEffect },
        { XMLID: "SIGHTGROUP", statusEffect: HeroSystem6eActorActiveEffects.statusEffectsObj.sightSenseDisabledEffect },
        {
            XMLID: "SMELLGROUP",
            statusEffect: HeroSystem6eActorActiveEffects.statusEffectsObj.smellTasteSenseDisabledEffect,
        },
        { XMLID: "TOUCHGROUP", statusEffect: HeroSystem6eActorActiveEffects.statusEffectsObj.touchSenseDisabledEffect },
    ];

    // Target groups are we attacking
    const targetGroups = [
        senseAffectingItem.effectiveAttackItem.system.OPTIONID || senseAffectingItem.effectiveAttackItem.system.INPUT,
    ];
    targetGroups.push(...senseAffectingItem.adders.map((a) => a.XMLID));
    for (const adder of targetGroups) {
        let adder2 = adder;

        // Martial Flash MANEUVER is for the entire GROUP
        if (senseAffectingItem.effectiveAttackItem.system.XMLID === "MANEUVER") {
            adder2 =
                senseGroups.find((o) =>
                    o.XMLID.match(new RegExp(senseAffectingItem.effectiveAttackItem.system.INPUT, "i")),
                )?.XMLID || adder2;
        }

        // Single sense kluge
        if (adder2.match(/normal/i) && !adder2.includes("GROUP")) {
            adder2 =
                senseGroups.find((o) => o.XMLID.match(new RegExp(adder2.toUpperCase().replace("NORMAL", ""), "i")))
                    ?.XMLID || adder2;
            console.warn(`KLUGE: using ${adder2} instead of ${adder}`);
        }

        const senseGroup = senseGroups.find((sg) => sg.XMLID === adder2);
        if (senseGroup) {
            senseGroup.bodyDamage = damageDetail.bodyDamage;
        } else {
            console.warn(`Unable to find senseGroup ${adder2}`);
        }
    }

    // FLASHDEFENSE
    for (const flashDefense of targetToken.actor.items.filter((o) => o.system.XMLID === "FLASHDEFENSE" && o.isActive)) {
        if (
            senseAffectingItem.effectiveAttackItem.system.OPTIONID === flashDefense.system.OPTIONID ||
            flashDefense.system.OPTIONID.includes(senseAffectingItem.effectiveAttackItem.system.INPUT?.toUpperCase())
        ) {
            const value = parseInt(flashDefense.system.LEVELS || 0);
            const senseGroup = senseGroups.find((sg) => sg.XMLID === flashDefense.system.OPTIONID);
            if (senseGroup) {
                senseGroup.defenseItems ??= [];
                senseGroup.defenseItems.push(flashDefense);
                senseGroup.bodyDamage = Math.max(0, (senseGroup.bodyDamage || 0) - value);
                senseGroup.defenseValue = (senseGroup.defenseValue || 0) + value;

                defenseTags.push({
                    value: value,
                    name: flashDefense.system.OPTIONID,
                    title: flashDefense.name,
                });
            } else {
                ui.notifications.error(`Unsupported flash defense [${flashDefense.system.OPTIONID}]`);
                continue;
            }
        }
    }

    // Create new ActiveEffects in one DB call
    const newActiveEffects = [];
    for (const senseGroup of senseGroups) {
        if (senseGroup.bodyDamage > 0) {
            const newActiveEffect = {
                // deepClone: the status templates are shared and shallow-frozen; document construction takes ownership
                ...foundry.utils.deepClone(senseGroup.statusEffect),
                name: `${senseAffectingItem.effectiveAttackItem.system.XMLID.replace("MANEUVER", senseAffectingItem.system.ALIAS)} ${senseGroup.XMLID}`,
                duration: {
                    seconds: senseGroup.bodyDamage,
                },
                flags: {
                    [game.system.id]: {
                        bodyDamage: senseGroup.bodyDamage,
                        XMLID: senseAffectingItem.system.XMLID,
                        source: tokenEducatedGuess({
                            actor: senseAffectingItem.actor,
                            action,
                        })?.name,
                        expiresOn: "segmentEnd",
                    },
                },
            };
            newActiveEffects.push(newActiveEffect);
        }
    }
    await targetToken.actor.createEmbeddedDocuments("ActiveEffect", newActiveEffects);

    const cardData = {
        item: senseAffectingItem,
        senseGroups: senseGroups.filter((sg) => sg.defenseItems || sg.bodyDamage > 0),

        // Incoming Damage Information
        incomingDamageSummary: damageRoller.getTotalSummary(),
        incomingAnnotatedDamageTerms: damageRoller.getAnnotatedTermsSummary(),

        // body
        damageDetail,

        // misc
        targetToken: targetToken,
        tags: defenseTags,
        attackTags: getAttackTags(senseAffectingItem),
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-sense-affecting-card.hbs`;
    const cardHtml = await renderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: senseAffectingItem.actor });

    const chatData = {
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
    return;
}

/**
 *
 * @param {HeroRoller} damageRoller
 * @param {*} item
 * @param {*} options
 * @returns
 */
async function _calcDamage(damageRoller, item, options) {
    let damageDetail = {};
    const itemData = item.effectiveAttackItem.system;

    const isAdjustment = item.effectiveAttackItem.isAdjustment;
    const isSenseAffectingPower = item.effectiveAttackItem.isSenseAffecting;
    const isEntangle = item.effectiveAttackItem.isEntangle;
    const isBodyBasedEffectRollItem = item.effectiveAttackItem.isBodyBasedEffect;
    const isStunBasedEffectRollItem = item.effectiveAttackItem.isStunBasedEffect;
    const isKillingAttack = item.effectiveAttackItem.doesKillingDamage;

    let body;
    let stun;
    let effect = 0;
    let bodyForPenetrating = 0;
    let effects = "";

    // Track the arithmetic so the apply card can show how the final numbers were derived.
    // Only meaningful for the standard STUN/BODY damage path.
    const damageBreakdown = { stun: [], body: [] };
    const showDamageBreakdown =
        !isAdjustment &&
        !isSenseAffectingPower &&
        !isEntangle &&
        !isBodyBasedEffectRollItem &&
        !isStunBasedEffectRollItem;

    if (isAdjustment) {
        // kludge for SIMPLIFIED HEALING
        if (item.effectiveAttackItem.system.XMLID === "HEALING" && item.system.INPUT.match(/simplified/i)) {
            // PH: FIXME: Didn't we already do this in the damage roll?
            const shr = await damageRoller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL);
            body = shr.getBodyTotal();
            stun = shr.getStunTotal();
        } else {
            body = 0;
            stun = damageRoller.getAdjustmentTotal();
            bodyForPenetrating = (
                await damageRoller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL)
            ).getBodyTotal();
        }
    } else if (isSenseAffectingPower) {
        body = damageRoller.getFlashTotal();
        stun = 0;
        bodyForPenetrating = 0;
    } else if (isEntangle) {
        body = damageRoller.getEntangleTotal();
        stun = 0;
        bodyForPenetrating = 0;
    } else if (isBodyBasedEffectRollItem) {
        body = damageRoller.getEffectTotal();
        stun = 0;
        bodyForPenetrating = 0;
    } else if (isStunBasedEffectRollItem) {
        body = 0;
        stun = damageRoller.getEffectTotal();
        bodyForPenetrating = 0;
    } else {
        body = damageRoller.getBodyTotal();
        stun = damageRoller.getStunTotal();

        // TODO: Doesn't handle a 1 point killing attack which is explicitly called out as doing 1 penetrating BODY.
        if (isKillingAttack) {
            bodyForPenetrating = (
                await damageRoller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL)
            ).getBodyTotal();
        } else {
            bodyForPenetrating = body;
        }

        // Knocked out targets take double STUN damage from attacks
        const targetActor = (game.scenes.current?.tokens.get(options.targetTokenId) || options.targetToken)?.actor;
        if (targetActor?.statuses.has("knockedOut")) {
            const preStun = stun;
            stun *= 2;
            effects += `Knocked Out x2 STUN (${preStun}x2=${stun});`;
            damageBreakdown.stun.push(`x2 (knocked out) = ${stun}`);
        }
    }

    const noHitLocationsPower = !!item.effectiveAttackItem.system.noHitLocations;
    const useHitLocations =
        game.settings.get(HEROSYS.module, "hit locations") !== "noHitLocations" && !noHitLocationsPower;
    const hasStunMultiplierRoll = isKillingAttack && !useHitLocations;

    const stunMultiplier = hasStunMultiplierRoll ? damageRoller.getStunMultiplier() : 1;

    // TODO: FIXME: This calculation is buggy as it doesn't consider:
    //       multiple levels of penetrating vs hardened/impenetrable
    //       or the fact that there is no impenetrable in 5e which uses hardened instead.
    // Penetrating
    const penetratingBody = item.effectiveAttackItem.system.penetrating
        ? Math.max(0, bodyForPenetrating - (options.impenetrableValue || 0))
        : 0;

    // get hit location
    let hitLocation = "None";
    let useHitLoc = false;

    if (useHitLocations) {
        useHitLoc = true;

        if (game.settings.get(HEROSYS.module, "hitLocTracking") === "all") {
            hitLocation = damageRoller.getHitLocation().fullName;
        } else {
            hitLocation = damageRoller.getHitLocation().name;
        }
    }

    if (item.effectiveAttackItem.system.EFFECT) {
        effects += `${item.effectiveAttackItem.system._effect || item.effectiveAttackItem.system.effect}; `;
    }

    // VULNERABILITY (multiplier is 1 when no vulnerability applies)
    if (options.vulnStunMultiplier > 1) {
        const preStun = stun;
        stun = Math.floor(stun * options.vulnStunMultiplier);
        effects += `${options.VulnDesc.join("/")} x${options.vulnStunMultiplier} STUN (${preStun}x${options.vulnStunMultiplier}=${stun});`;
    }
    if (options.vulnBodyMultiplier > 1) {
        const preBody = body;
        body = Math.floor(body * options.vulnBodyMultiplier);
        effects += `${options.VulnDesc.join("/")} x${options.vulnBodyMultiplier} BODY (${preBody}x${options.vulnBodyMultiplier}=${body});`;
    }
    // for (const desc of options.VulnDesc || []) {
    //     effects += ` ${desc};`;
    // }

    let bodyDamage = body;
    let stunDamage = stun;

    // Splits an attack into two equal parts for the purpose of
    // determining BODY damage and applying it to the target’s
    // defenses (though it’s still resolved with one Attack Roll and
    // treated as a single attack).
    // This is super awkward with the current system.
    // kludge: Apply body defense twice.
    let REDUCEDPENETRATION = item.effectiveAttackItem.findModsByXmlid("REDUCEDPENETRATION");
    if (REDUCEDPENETRATION) {
        if (isKillingAttack) {
            body = Math.max(0, body - (options.resistantValue || 0));
        }
        body = Math.max(0, body - (options.defenseValue || 0));
    }

    // Should we figure out the effective BODY for knockback calculations (i.e. was there DOESKB?)
    const doesKB = item.effectiveAttackItem.findModsByXmlid("DOESKB");
    let bodyForKbCalculations = body;
    if (doesKB) {
        // BODY for KB purposes is calculated based on a normal attack type.
        const clonedNormalizedRoller = await damageRoller
            .clone()
            .modifyToDoBody()
            .cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL);
        bodyForKbCalculations = clonedNormalizedRoller.modifyToDoNoBody(false).getBodyTotal();
    }

    // determine knockback
    const {
        useKnockback,
        knockbackMessage,
        knockbackRenderedResult,
        knockbackTags,
        knockbackRoller,
        knockbackResultTotal,
        shrinkingKB,
        preKnockBackProneStatus,
    } = await _calcKnockback(bodyForKbCalculations, item, options, itemData.knockbackMultiplier);

    // -------------------------------------------------
    // determine effective damage
    // -------------------------------------------------
    const stunDefense = (options.defenseValue || 0) + (options.resistantValue || 0);
    const bodyDefense = isKillingAttack ? options.resistantValue || 0 : stunDefense;
    const preDefenseStun = stun;
    const preDefenseBody = body;

    stun = stun - stunDefense;
    body = body - bodyDefense;

    stun = roundFavorPlayerTowardsZero(stun < 0 ? 0 : stun);
    body = roundFavorPlayerTowardsZero(body < 0 ? 0 : body);

    if (showDamageBreakdown) {
        damageBreakdown.stun.push(`${preDefenseStun} - ${stunDefense} defense = ${stun}`);
        damageBreakdown.body.push(
            `${preDefenseBody} - ${bodyDefense}${isKillingAttack ? " resistant" : ""} defense = ${body}`,
        );
    }

    let hitLocText = "";
    if (useHitLocations) {
        const hitLocationBodyMultiplier = damageRoller.getHitLocation().bodyMultiplier;
        const hitLocationStunMultiplier = damageRoller.getHitLocation().stunMultiplier;

        if (isKillingAttack) {
            // Killing attacks apply hit location multiplier after resistant damage protection has been subtracted
            // Location : [x Stun, x N Stun, x Body, OCV modifier]
            body = roundFavorPlayerTowardsZero(body * hitLocationBodyMultiplier);

            if (showDamageBreakdown) {
                // The location STUNx replaced the STUNx roll when the damage was rolled
                damageBreakdown.stun.unshift(
                    `${damageRoller.getBodyTotal()} BODY x${hitLocationStunMultiplier} (${hitLocation} STUNx) = ${damageRoller.getStunTotal()}`,
                );
                damageBreakdown.body.push(`x${hitLocationBodyMultiplier} (${hitLocation}) = ${body}`);
            }
        } else {
            // stun attacks apply N STUN hit location and BODY multiplier after defenses have been subtracted
            stun = roundFavorPlayerTowardsZero(stun * hitLocationStunMultiplier);
            body = roundFavorPlayerTowardsZero(body * hitLocationBodyMultiplier);

            if (showDamageBreakdown) {
                damageBreakdown.stun.push(`x${hitLocationStunMultiplier} (${hitLocation}) = ${stun}`);
                damageBreakdown.body.push(`x${hitLocationBodyMultiplier} (${hitLocation}) = ${body}`);
            }
        }
        if (damageRoller.getHitLocation().item || damageRoller.getHitLocation().activeEffect) {
            hitLocText = `Hit ${hitLocation}`;
        } else {
            hitLocText = `Hit ${hitLocation} (x${hitLocationBodyMultiplier} BODY x${hitLocationStunMultiplier} STUN)`;
        }
    } else if (hasStunMultiplierRoll && showDamageBreakdown) {
        damageBreakdown.stun.unshift(
            `${damageRoller.getBodyTotal()} BODY x${stunMultiplier} (STUNx roll) = ${damageRoller.getStunTotal()}`,
        );
    }

    // apply damage reduction
    if (options.damageReductionValue > 0) {
        stun = roundFavorPlayerTowardsZero(stun * (1 - options.damageReductionValue / 100));
        body = roundFavorPlayerTowardsZero(body * (1 - options.damageReductionValue / 100));

        if (showDamageBreakdown) {
            damageBreakdown.stun.push(`x${100 - options.damageReductionValue}% (damage reduction) = ${stun}`);
            damageBreakdown.body.push(`x${100 - options.damageReductionValue}% (damage reduction) = ${body}`);
        }
    }

    // Penetrating attack minimum damage
    if (isKillingAttack && penetratingBody > body) {
        body = penetratingBody;
        effects += "penetrating damage; ";
        if (showDamageBreakdown) {
            damageBreakdown.body.push(`${body} (penetrating minimum)`);
        }
    } else if (!isKillingAttack && penetratingBody > stun) {
        stun = penetratingBody;
        effects += "penetrating damage; ";
        if (showDamageBreakdown) {
            damageBreakdown.stun.push(`${stun} (penetrating minimum)`);
        }
    }

    // minimum damage rule (needs to be last)
    if (stun < body && !isSenseAffectingPower) {
        stun = body;
        if (showDamageBreakdown) {
            damageBreakdown.stun.push(`${stun} (minimum damage: STUN at least equals BODY)`);
        }
        effects +=
            `minimum damage invoked <i class="fal fa-circle-info" data-tooltip="` +
            `<b>MINIMUM DAMAGE FROM INJURIES</b><br>` +
            `Characters take at least 1 STUN for every 1 point of BODY
                 damage that gets through their defenses.` +
            `"></i>; `;
    }

    // Special effects that change damage?
    if (item.effectiveAttackItem.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.stunonly) {
        body = 0;
        if (showDamageBreakdown) {
            damageBreakdown.body.push(`0 (STUN only attack)`);
        }
    } else if (item.effectiveAttackItem.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.bodyonly) {
        stun = 0;
        if (showDamageBreakdown) {
            damageBreakdown.stun.push(`0 (BODY only attack)`);
        }
    } else if (item.effectiveAttackItem.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.effectonly) {
        if (isBodyBasedEffectRollItem) {
            effect = body;
            stun = 0;
            body = 0;
        } else if (isStunBasedEffectRollItem) {
            effect = stun;
            stun = 0;
            body = 0;
        }
    }

    stun = roundFavorPlayerTowardsZero(stun);
    body = roundFavorPlayerTowardsZero(body);

    damageDetail.body = body;
    damageDetail.stun = stun;
    damageDetail.damageBreakdown = showDamageBreakdown
        ? { stun: damageBreakdown.stun.join("\n"), body: damageBreakdown.body.join("\n") }
        : null;
    damageDetail.effects = effects;
    damageDetail.stunDamage = stunDamage;
    damageDetail.bodyDamage = bodyDamage;
    damageDetail.stunMultiplier = stunMultiplier;
    damageDetail.hasStunMultiplierRoll = hasStunMultiplierRoll;
    damageDetail.useHitLoc = useHitLoc;
    damageDetail.hitLocText = hitLocText;
    damageDetail.hitLocation = hitLocation;

    damageDetail.effect = effect;

    damageDetail.knockbackMessage = knockbackMessage;
    damageDetail.useKnockBack = useKnockback;
    damageDetail.knockbackRenderedResult = knockbackRenderedResult;
    damageDetail.knockbackTags = knockbackTags;
    damageDetail.knockbackRoller = knockbackRoller;
    damageDetail.knockbackResultTotal = knockbackResultTotal;
    damageDetail.shrinkingKB = shrinkingKB;
    damageDetail.preKnockBackProneStatus = preKnockBackProneStatus;

    return damageDetail;
}

async function _calcKnockback(bodyForKbCalculations, item, options, knockbackMultiplier) {
    let useKnockback = false;
    let knockbackMessage = "";
    let knockbackRenderedResult = null;
    let knockbackTags = [];
    let knockbackRoller = null;
    let knockbackResultTotal = null;
    let knockbackResistanceValue = 0;
    let shrinkingKB = 0;

    // Get poossible actor
    const actor = options?.targetToken?.actor;
    const preKnockBackProneStatus = actor.statuses.has("prone");

    // BASEs do not experience KB
    const isBase = actor?.type === "base2";

    // KBRESISTANCE or other related power that reduces knockback
    if (actor) {
        const knockbackAttackItem = await createTemporaryKnockbackItem(actor, 1);
        const { defenseTags } = getActorDefensesVsAttack(actor, knockbackAttackItem, { attackDefenseVs: "KB" });
        knockbackTags = [...knockbackTags, ...defenseTags];
        for (const tag of defenseTags) {
            knockbackResistanceValue += Math.max(0, tag.value); // SHRINKING only applies to distance not to damage
        }
    }

    // Should we actually roll for knockback?
    // - Is knockback enabled in the system?
    // - Bases don't take knockback - is the target a base?
    // - Does this attack do knockback and was there effective knockback BODY?
    if (
        game.settings.get(HEROSYS.module, "knockback") &&
        !isBase &&
        knockbackMultiplier > 0 &&
        bodyForKbCalculations > 0
    ) {
        useKnockback = true;

        let knockbackDice = 2;

        const actor = options?.targetToken?.actor;

        // Target is in the air -1d6
        // TODO: This is perhaps not the right check as they could just have the movement radio on. Consider a flying status
        //       when more than 0m off the ground? This same effect should also be considered for gliding.
        const activeMovement = options.targetToken?.actor?.flags?.[game.system.id]?.activeMovement;
        if (["flight", "gliding"].includes(activeMovement)) {
            // Double check to make sure FLIGHT or GLIDING is still on
            if (
                options.targetToken.actor.items.find(
                    (o) => o.system.XMLID === activeMovement.toUpperCase() && o.isActive,
                )
            ) {
                knockbackDice -= 1;
                knockbackTags.push({
                    value: "-1d6KB",
                    name: "target is in the air",
                    title: `Knockback Modifier ${options.targetToken?.actor?.flags?.[game.system.id]?.activeMovement}`,
                });
            } else {
                console.warn(`${activeMovement} selected but that power is not active.`);
            }
        }

        // Target Roll With A Punch -1d6
        const targetRolledWithAPunch = options.targetToken?.actor?.items.find(
            (o) => o.system.XMLID === "ROLLWITHAPUNCH",
        );
        if (targetRolledWithAPunch && targetRolledWithAPunch.isActive) {
            knockbackDice -= 1;
            knockbackTags.push({
                value: "-1d6KB",
                name: "Roll With A Punch",
                title: `Knockback Modifier\nRoll With A Punch`,
            });
        }

        // TODO: Target is in zero gravity -1d6

        // Target is underwater +1d6
        if (actor?.statuses?.has("underwater")) {
            knockbackDice += 1;
            knockbackTags.push({
                value: "+1d6KB",
                name: "target is underwater",
                title: "Knockback Modifier",
            });
        }

        // Target is using Clinging +1d6
        const clinging = options.targetToken?.actor?.items.find((o) => o.system.XMLID === "CLINGING");
        if (clinging && clinging.isActive) {
            knockbackDice += 1;
            knockbackTags.push({
                value: "+1d6KB",
                name: "Clinging",
                title: `Knockback Modifier\n${clinging.name}`,
            });
        }

        // Attack did Killing Damage +1d6
        if (item.effectiveAttackItem.doesKillingDamage) {
            knockbackDice += 1;
            knockbackTags.push({
                value: "+1d6KB",
                name: "attack did Killing Damage",
                title: "Knockback Modifier",
            });
        }

        // Attack used a Martial Maneuver +1d6
        if (["martialart", "martial"].includes(item.type)) {
            knockbackDice += 1;
            knockbackTags.push({
                value: "+1d6KB",
                name: "attack used a Martial Maneuver",
                title: "Knockback Modifier",
            });
        }

        if (knockbackMultiplier !== 1) {
            knockbackTags.push({
                value: `${knockbackMultiplier}x to base KB`,
                name: "attack has Knockback Multiplier",
                title: "Knockback Multiplier",
            });
        }

        // Calculate the knockback considering:
        // - the knockback multiplier is a calculation to the attacker's advantage (so round up)
        knockbackRoller = new HeroRoller()
            .setPurpose(DICE_SO_NICE_CUSTOM_SETS.KNOCKBACK)
            .makeBasicRoll()
            .addNumber(
                roundFavorPlayerAwayFromZero(bodyForKbCalculations * knockbackMultiplier),
                `Max potential knockback (${bodyForKbCalculations} BODY x ${knockbackMultiplier})`,
            )
            .addNumber(-parseInt(knockbackResistanceValue), "Knockback resistance")
            .addDice(-Math.max(0, knockbackDice));
        await knockbackRoller.roll();

        knockbackResultTotal = Math.round(knockbackRoller.getBasicTotal());

        knockbackRenderedResult = await knockbackRoller.render();

        // SHRINKING
        if (actor) {
            for (const shrinkItem of actor.items.filter((i) => i.system.XMLID === "SHRINKING" && i.isActive)) {
                shrinkingKB += (parseInt(shrinkItem.system.LEVELS) || 0) * 3;
            }
        }

        if (knockbackResultTotal + shrinkingKB < 0) {
            knockbackMessage = "No Knockback";
        } else if (knockbackResultTotal + shrinkingKB == 0) {
            knockbackMessage = "Inflicts Knockdown";
        } else {
            // If the result is positive, the target is Knocked Back 1" or 2m times the result
            knockbackMessage = `Knocked Back ${
                (knockbackResultTotal + shrinkingKB) * (actor?.is5e ? 1 : 2)
            }${getSystemDisplayUnits(actor?.is5e)}`;
        }

        if (knockbackResultTotal + shrinkingKB >= 0) {
            await actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
                active: true,
            });
        }
    }

    return {
        useKnockback,
        knockbackMessage,
        knockbackRenderedResult,
        knockbackTags,
        knockbackRoller,
        knockbackResultTotal,
        shrinkingKB,
        preKnockBackProneStatus,
    };
}

export async function _onAdjustmentToolipExpandCollapse(event) {
    const divSummary = $(event.currentTarget);
    const icon = divSummary.children("i.adjustment-tooltip").first();
    const tooltipDiv = icon.siblings("div.adjustment-tooltip").first();
    if (!tooltipDiv) {
        console.warn(`_onAdjustmentToolipExpandCollapse missing div`);
        return;
    }
    console.log(tooltipDiv);
    const display = tooltipDiv.css("display");
    if (display === "none") {
        tooltipDiv.css("display", "block");
        icon.addClass("fa-circle-caret-down");
        icon.removeClass("fa-circle-caret-right");
    } else {
        tooltipDiv.css("display", "none");

        icon.addClass("fa-circle-caret-right");
        icon.removeClass("fa-circle-caret-down");
    }
}

export async function _onModalDamageCard(event) {
    const target = $(event.currentTarget);

    let content = target.closest(".message-content").clone();
    content.find(".modal-damage-card").remove();
    content = content.html();

    const dialog = new foundry.applications.api.DialogV2({
        window: { title: `Modal Damage` },
        content,
        buttons: [
            {
                action: "cancel",
                label: "Close",
            },
        ],
    });

    // DialogV2 wraps content in a <form> and only honors the `render` option via its static
    // wait/prompt/confirm helpers, so wire the listener ourselves. The cloned card's buttons
    // would otherwise submit (and close) the dialog; force them to type="button" so their
    // delegated chat handlers run instead.
    dialog.addEventListener("render", () => {
        for (const button of dialog.element.querySelectorAll(".dialog-content button")) {
            button.setAttribute("type", "button");
        }
        this.chatListeners(dialog.element);
    });

    await dialog.render({ force: true });
}
