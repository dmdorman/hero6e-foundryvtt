import { HEROSYS } from "../herosystem6e.mjs";
import { getPowerInfo, getCharacteristicInfoArrayForActor, whisperUserTargetsForActor } from "../utility/util.mjs";
import { getActorDefensesVsAttack, getConditionalDefenses, getItemDefenseVsAttack } from "../utility/defense.mjs";
import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { RoundFavorPlayerDown, RoundFavorPlayerUp } from "../utility/round.mjs";
import {
    calculateDicePartsForItem,
    calculateStrengthMinimumForItem,
    combatSkillLevelsForAttack,
    penaltySkillLevelsForAttack,
} from "../utility/damage.mjs";
import { performAdjustment, renderAdjustmentChatCards } from "../utility/adjustment.mjs";
import { getRoundedDownDistanceInSystemUnits, getSystemDisplayUnits } from "../utility/units.mjs";
import { HeroSystem6eItem, requiresASkillRollCheck, RequiresACharacteristicRollCheck } from "../item/item.mjs";
import { ItemAttackFormApplication, getAoeTemplateForItem } from "../item/item-attack-application.mjs";
import { DICE_SO_NICE_CUSTOM_SETS, HeroRoller } from "../utility/dice.mjs";
import { clamp } from "../utility/compatibility.mjs";
import { calculateVelocityInSystemUnits } from "../heroRuler.mjs";
import { Attack, actionFromJSON, actionToJSON } from "../utility/attack.mjs";
import { calculateDistanceBetween, calculateRangePenaltyFromDistanceInMetres } from "../utility/range.mjs";
import { overrideCanAct } from "../settings/settings-helpers.mjs";
import { activateManeuver, doManeuverEffects, maneuverHasBlockTrait } from "./maneuver.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;

export async function chatListeners(_html) {
    const html = $(_html); // v13 compatibility
    html.on("click", "button.roll-damage", this._onRollDamage.bind(this));
    html.on("click", "button.apply-damage", this._onApplyDamage.bind(this));
    html.on("click", "button.generic-roller-apply-damage", this._onGenericRollerApplyDamage.bind(this));
    html.on("click", "button.rollAoe-damage", this._onRollAoeDamage.bind(this));
    html.on("click", "button.roll-knockback", this._onRollKnockback.bind(this));
    html.on("click", "button.roll-mindscan", this._onRollMindScan.bind(this));
    html.on("click", "button.roll-mindscan-ego", this._onRollMindScanEffectRoll.bind(this));
    html.on("click", "div.adjustment-summary", this._onAdjustmentToolipExpandCollapse.bind(this));
    html.on("click", "i.modal-damage-card, span.modal-damage-card", this._onModalDamageCard.bind(this));
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

function isBodyBasedEffectRoll(item) {
    return item.system.XMLID === "TRANSFORM";
}

function isStunBasedEffectRoll(item) {
    return (
        item.system.XMLID === "MENTALILLUSIONS" ||
        item.system.XMLID === "MINDCONTROL" ||
        item.system.XMLID === "MINDSCAN" ||
        item.system.XMLID === "TELEPATHY"
    );
}

const newDehydrateRehydrateApproach = true;

// PH: FIXME: Should we be looking to override the existing Item JSON functions for this functionality?
/**
 * Turn an item into JSON.
 * Reverse the process with rehydrateAttackItem
 * @param {HeroSystem6eItem} item - what should be dehydrated
 */
export function dehydrateAttackItem(item) {
    if (!newDehydrateRehydrateApproach) {
        const dehydratedItem = item.toObject(false);

        // If there is a strength item, dehydrate it
        if (item.system._active.effectiveStrItem) {
            dehydratedItem.system._active.effectiveStrItem = item.system._active.effectiveStrItem.toObject(false);
        }

        // If there is a weapon for maneuvers, dehydrate it
        if (item.system._active.maWeaponItem) {
            dehydratedItem.system._active.maWeaponItem = item.system._active.maWeaponItem.toObject(false);
        }

        // If there are linked endurance items, then we need to dehydrate them as well.
        if (item.system._active.linkedEnd && dehydratedItem.system._active.linkedEnd.length > 0) {
            dehydratedItem.system._active.linkedEnd = item.system._active.linkedEnd.map((linkedEndItem) => {
                return {
                    item: linkedEndItem.item.toObject(false),
                    uuid: linkedEndItem.uuid,
                };
            });
        }

        // If there are linked associated items, then we need to dehydrate them as well.
        if (item.system._active.linkedAssociated && dehydratedItem.system._active.linkedAssociated.length > 0) {
            dehydratedItem.system._active.linkedAssociated = item.system._active.linkedAssociated.map(
                (linkedAssociatedItem) => {
                    return {
                        item: linkedAssociatedItem.item.toObject(false),
                        uuid: linkedAssociatedItem.uuid,
                    };
                },
            );
        }

        // If there are linked items, then we need to dehydrate them as well.
        if (dehydratedItem.system._active.linked && dehydratedItem.system._active.linked.length > 0) {
            dehydratedItem.system._active.linked = item.system._active.linked.map((linkedItem) => {
                return {
                    item: linkedItem.item.toObject(false),
                    uuid: linkedItem.uuid,
                };
            });
        }

        const stringifiedItem = JSON.stringify(dehydratedItem);
        return stringifiedItem;
    } else {
        const dehydratedObj = {};

        // PH: FIXME: Should need to make a copy first so we don't destroy item.
        // const copiedItem = foundry.utils.deepClone(item); <--- doesn't actually handle stuff like we want
        // const copiedItem = JSON.parse(JSON.stringify(item)); <--- won't work
        dehydratedObj.item = item.toObject(false);

        // If there is a strength item, dehydrate it
        if (item.system._active.effectiveStrItem) {
            dehydratedObj.effectiveStrItem = item.system._active.effectiveStrItem.toObject(false);
            dehydratedObj.item.system._active.effectiveStrItem = null;
        }

        // If there is a weapon for maneuvers, dehydrate it
        if (item.system._active.maWeaponItem) {
            dehydratedObj.maWeaponItem = item.system._active.maWeaponItem.toObject(false);
            dehydratedObj.item.system._active.maWeaponItem = null;
        }

        // If there are linked endurance items, then we need to dehydrate them as well.
        if (item.system._active.linkedEnd && item.system._active.linkedEnd.length > 0) {
            dehydratedObj.linkedEnd = item.system._active.linkedEnd.map((linkedEndItem) => {
                return {
                    item: linkedEndItem.item.toObject(false),
                    uuid: linkedEndItem.uuid,
                };
            });
            dehydratedObj.item.system._active.linkedEnd = null;
        }

        // If there are linked associated items, then we need to dehydrate them as well.
        if (item.system._active.linkedAssociated && item.system._active.linkedAssociated.length > 0) {
            dehydratedObj.linkedAssociated = item.system._active.linkedAssociated.map((linkedAssociatedItem) => {
                return {
                    item: linkedAssociatedItem.item.toObject(false),
                    uuid: linkedAssociatedItem.uuid,
                };
            });
            dehydratedObj.item.system._active.linkedAssociated = null;
        }

        // If there are linked items, then we need to dehydrate them as well.
        if (item.system._active.linked && item.system._active.linked.length > 0) {
            dehydratedObj.linked = item.system._active.linked.map((linkedItem) => {
                return {
                    item: linkedItem.item.toObject(false),
                    uuid: linkedItem.uuid,
                };
            });
            dehydratedObj.item.system._active.linked = null;
        }

        const stringifiedItem = JSON.stringify(dehydratedObj);
        return stringifiedItem;
    }
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
    if (!newDehydrateRehydrateApproach) {
        const item = HeroSystem6eItem.fromSource(JSON.parse(itemJsonStr), {
            parent: actor,
        });

        // If there is a strength item, then we need to rehydrate it.
        if (item.system._active.effectiveStrItem) {
            item.system._active.effectiveStrItem = HeroSystem6eItem.fromSource(item.system._active.effectiveStrItem, {
                parent: actor,
            });
        }

        // If there is a maneuver item, then we need to rehydrate it.
        if (item.system._active.maWeaponItem) {
            item.system._active.maWeaponItem = HeroSystem6eItem.fromSource(item.system._active.maWeaponItem, {
                parent: actor,
            });
        }

        // If there are linked endurance items, then we need to rehydrate them as well.
        if (item.system._active.linkedEnd && item.system._active.linkedEnd.length > 0) {
            item.system._active.linkedEnd.forEach((linkedEndItemData) => {
                linkedEndItemData.item = HeroSystem6eItem.fromSource(linkedEndItemData.item, {
                    parent: actor,
                });
            });
        }

        // If there are linked associated items, then we need to rehydrate them as well.
        if (item.system._active.linkedAssociated && item.system._active.linkedAssociated.length > 0) {
            item.system._active.linkedAssociated.forEach((linkedEndItemData) => {
                linkedEndItemData.item = HeroSystem6eItem.fromSource(linkedEndItemData.item, {
                    parent: actor,
                });
            });
        }

        // If there are linked items, then we need to rehydrate them as well.
        if (item.system._active.linked && item.system._active.linked.length > 0) {
            item.system._active.linked.forEach((linkedItemData) => {
                linkedItemData.item = HeroSystem6eItem.fromSource(linkedItemData.item, {
                    parent: actor,
                });
            });
        }

        return { actor, item };
    } else {
        const obj = JSON.parse(itemJsonStr);

        const item = HeroSystem6eItem.fromSource(obj.item, {
            parent: actor,
        });

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
}

/**
 * Dialog box for collectActionDataBeforeToHitOptions. The action doesn't have to be an attack (such as
 * the Block maneuver).
 */
export async function collectActionDataBeforeToHitOptions(item, options = {}) {
    const actor = item.actor;
    const token = getTokenEducatedGuess({ token: options.token, actor: actor });
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
    if ((item.system.EFFECT || "").match(/v\/\d+/)) {
        // Educated guess for token
        const token2 =
            actor.getActiveTokens().find((t) => canvas.tokens.controlled.find((c) => c.id === t.id)) ||
            actor.getActiveTokens()[0];
        if (token.id !== token2.id) {
            console.error("token mismatch");
        }

        data.showVelocity = true;
        data.velocity = calculateVelocityInSystemUnits(item.actor, token2);
        data.velocitySystemUnits = getSystemDisplayUnits(item.is5e);
    }

    await new ItemAttackFormApplication(data).render(true);
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
            targetArray = await Dialog.wait({
                title: `Pick target list`,
                content: html,
                buttons: {
                    gm: {
                        label: game.user.name,
                        callback: async function () {
                            return targetArray;
                        },
                    },
                    user: {
                        label: game.users.get(formData.userId).name,
                        callback: async function () {
                            return userTargetArray;
                        },
                    },
                },
            });
        }
    }

    return targetArray;
}

export async function processActionToHit(item, formData) {
    const targetArray = await getTargetArray(formData);
    const action = Attack.getActionInfo(item, targetArray, formData);
    if (!action) {
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    const haymakerManeuverActive = item.actor?.items.find(
        (anItem) => anItem.type === "maneuver" && anItem.system.XMLID === "HAYMAKER" && anItem.system.active,
    );
    if (haymakerManeuverActive) {
        // Can haymaker anything except for maneuvers because it is a maneuver itself. The strike manuever is the 1 exception.
        if (item.type === "martialart" || (item.type === "maneuver" && item.system.XMLID !== "STRIKE")) {
            return ui.notifications.warn("Haymaker cannot be combined with another maneuver except Strike.", {
                localize: true,
            });
        }
    }

    // PH: FIXME: Need to not pass in formData and move the interesting stuff into action
    if (item.getAoeModifier()) {
        await doAoeActionToHit(action, formData);
    } else {
        await doSingleTargetActionToHit(action, formData);
    }

    // turn off haymaker
    await item?.actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.id, {
        active: false,
    });
}

export async function doAoeActionToHit(action, options) {
    if (!action) {
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    const item = action.system.currentItem;
    const actor = action.system.actor;
    // const token = action.system.attackerToken;
    // PH: FIXME: Why are we building a token from the action? It's in the action already.
    const token = getTokenEducatedGuess({ action, actor });
    if (!token) {
        return ui.notifications.error(`Unable to find a token on this scene associated with ${actor.name}.`);
    }

    // Paranoia setting = HIGH. Can be removed if we feel the need.
    const tokenId = token.id || token.document.id;
    const storedTokenId = action.system.attackerToken.id || action.system.attackerToken.document.id;
    if (tokenId === storedTokenId) {
        console.error(
            `Token stored for attacker in action is not the same as the educated guess!`,
            action.system.attackerToken,
            token,
        );
    }

    const aoeTemplate = getAoeTemplateForItem(item);
    if (!aoeTemplate) {
        return ui.notifications.error(`Attack AOE template was not found.`);
    }

    const distance = calculateDistanceBetween(aoeTemplate, token).distance;
    let dcvTargetNumber = 0;
    if (distance > (actor.system.is5e ? 1 : 2)) {
        dcvTargetNumber = 3;
    }

    const hitCharacteristic = actor.system.characteristics.ocv.value;
    const setManeuver = item.actor.items.find(
        (item) => item.type == "maneuver" && item.name === "Set" && item.isActive,
    );

    const attackHeroRoller = new HeroRoller()
        .makeSuccessRoll()
        .addNumber(11, "Base to hit")
        .addNumber(hitCharacteristic, item.system.uses)
        .addNumber(parseInt(options.ocvMod) || 0, "OCV modifier")
        .addNumber(parseInt(options.omcvMod) || 0, "OMCV modifier")
        .addNumber(-parseInt(setManeuver?.baseInfo?.maneuverDesc?.ocv || 0), "Set Maneuver");

    if (item.system.range === CONFIG.HERO.RANGE_TYPES.SELF) {
        // TODO: Should not be able to use this on anyone else. Should add a check.
    }

    // TODO: Should consider if the target's range exceeds the power's range or not and display some kind of warning
    //       in case the system has calculated it incorrectly.

    const noRangeModifiers = !!item.findModsByXmlid("NORANGEMODIFIER");
    const normalRange = !!item.findModsByXmlid("NORMALRANGE");

    // There are no range penalties if this is a line of sight power or it has been bought with
    // no range modifiers.
    if (
        !(
            item.system.range === CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT ||
            item.system.range === CONFIG.HERO.RANGE_TYPES.SPECIAL ||
            noRangeModifiers ||
            normalRange
        )
    ) {
        const rangePenalty = -calculateRangePenaltyFromDistanceInMetres(distance, actor);

        // PENALTY_SKILL_LEVELS (range)
        // const pslRange = penaltySkillLevelsForAttack(item).find(
        //     (o) => o.system.penalty === "range" && o.system.checked,
        // );
        for (const pslItem of item.pslRangePenaltyOffsetItems) {
            const pslValue = Math.min(parseInt(pslItem.system.LEVELS), -rangePenalty);
            if (pslValue !== 0) {
                attackHeroRoller.addNumber(pslValue, "Penalty Skill Levels"); //pslItem.detailedName());
            }
        }

        if (rangePenalty) {
            attackHeroRoller.addNumber(
                rangePenalty,
                `Range penalty (${getRoundedDownDistanceInSystemUnits(distance, item.actor)}${getSystemDisplayUnits(item.actor.is5e)})`,
            );
        }

        // Brace (+2 OCV only to offset the Range Modifier)
        const braceManeuver = item.actor.items.find(
            (item) => item.type == "maneuver" && item.name === "Brace" && item.isActive,
        );
        if (braceManeuver) {
            const brace = Math.min(-rangePenalty, braceManeuver.baseInfo?.maneuverDesc?.ocv);
            if (brace > 0) {
                attackHeroRoller.addNumber(brace, "Brace modifier");
            }
        }
    }

    let dcv = parseInt(item.system.dcv || 0);

    const cvModifiers = action.current.cvModifiers;

    // Combat Skill Levels
    const skillLevelMods = {};
    for (const csl of combatSkillLevelsForAttack(item)) {
        const id = csl.skill.id;
        skillLevelMods[id] = skillLevelMods[id] ?? { ocv: 0, dcv: 0, dc: 0 };
        const cvMod = skillLevelMods[id];
        action.system.item[id] = csl.skill;

        cvMod.dc += csl.dc;
        if (csl.ocv || csl.omcv > 0) {
            cvMod.ocv += csl.ocv || csl.omcv;
        }
        dcv += csl.dcv;
        cvMod.dcv += csl.dcv;
    }

    let dmcv = parseInt(item.system.dmcv || 0);
    if (dmcv != 0) {
        // Make sure we don't already have this activeEffect
        let prevActiveEffect = Array.from(item.actor.allApplicableEffects()).find((o) => o.origin === item.uuid);
        if (!prevActiveEffect) {
            // Estimate of how many seconds the DCV penalty lasts (until next phase).
            // In combat.js#_onStartTurn we remove this AE for exact timing.
            let seconds = Math.ceil(12 / parseInt(item.actor.system.characteristics.spd.value));
            let _dcvText = "DMCV";
            let _dcvValue = dmcv;

            const activeEffect = {
                label: `${item.name} ${_dcvValue.signedStringHero()} ${_dcvText}`,
                icon: dcv < 0 ? "icons/svg/downgrade.svg" : "icons/svg/upgrade.svg",
                changes: [
                    {
                        key: `system.characteristics.${_dcvText.toLowerCase()}.value`,
                        value: _dcvValue,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                ],
                origin: item.uuid,
                duration: {
                    seconds: seconds,
                },
                flags: {
                    [game.system.id]: {
                        nextPhase: true,
                    },
                },
            };
            await item.actor.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
        }
    }

    Object.keys(skillLevelMods).forEach((key) => {
        const cvMod = Attack.makeCvModifierFromItem(
            action.system.item[key],
            action.system,
            skillLevelMods[key].ocv,
            skillLevelMods[key].dcv,
            skillLevelMods[key].dc,
        );
        cvModifiers.push(cvMod);
    });

    cvModifiers.forEach((cvModifier) => {
        if (cvModifier.cvMod.ocv) {
            attackHeroRoller.addNumber(cvModifier.cvMod.ocv, cvModifier.name);
        }
    });
    Attack.makeActionActiveEffects(action);

    // This is the actual roll to hit. In order to provide for a die roll
    // that indicates the upper bound of DCV hit, we have added the base (11) and the OCV, and subtracted the mods
    // and lastly we subtract the die roll. The value returned is the maximum DCV hit
    // (so we can be sneaky and not tell the target's DCV out loud).
    attackHeroRoller.addDice(-3);

    await attackHeroRoller.roll();
    const autoSuccess = attackHeroRoller.getAutoSuccess();
    const hitRollTotal = attackHeroRoller.getSuccessTotal();
    const renderedRollResult = await attackHeroRoller.render();

    let hitRollText = "AOE origin successfully HITS a DCV of " + hitRollTotal;

    if (autoSuccess !== undefined) {
        if (autoSuccess) {
            hitRollText = "AOE origin automatically HITS any DCV";
        } else {
            hitRollText = "AOE origin automatically MISSES any DCV";
        }
    } else if (hitRollTotal < dcvTargetNumber) {
        const missBy = dcvTargetNumber - hitRollTotal;

        const facingHeroRoller = new HeroRoller().makeBasicRoll().addDice(1);
        await facingHeroRoller.roll();
        const facingRollResult = facingHeroRoller.getBasicTotal();

        const moveDistance = RoundFavorPlayerDown(Math.min(distance / 2, item.actor.system.is5e ? missBy : missBy * 2));
        hitRollText = `AOE origin MISSED by ${missBy}. Move AOE origin ${
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
    const cardHtml = await foundryVttRenderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
    //speaker.alias = actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
        rolls: attackHeroRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
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
    if (actor && actor.system.characteristics.str && (item.system.usesStrength || item.findModsByXmlid("GESTURES"))) {
        if (parseInt(actor.system.characteristics.str.value) <= 0) {
            if (
                !(await RequiresACharacteristicRollCheck(
                    actor,
                    "str",
                    `Actions that use STR or GESTURES require STR roll when at 0 STR`,
                ))
            ) {
                await ui.notifications.warn(`${actor.name} failed STR 0 roll. Action with ${item.name} failed.`);
                return;
            }
        }
    }

    // PRE 0
    // At PRE 0, a character must attempt an PRE Roll to take any
    // offensive action, or to remain in the face of anything even
    // remotely threatening.
    // Not all token types (base) will have PRE
    if (actor && actor.system.characteristics.pre && parseInt(actor.system.characteristics.pre.value) <= 0) {
        if (
            !(await RequiresACharacteristicRollCheck(
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
        ...{ noResourceUse: overrideCanAct },
    });
    if (resourceError) {
        return ui.notifications.error(`${item.name} ${resourceError}`);
    } else if (resourceWarning) {
        return ui.notifications.warn(`${item.name} ${resourceWarning}`);
    }

    // Requires A Roll
    if (!(await requiresASkillRollCheck(item, { showUI: true, resourcesRequired, resourcesUsedDescription }))) {
        return;
    }

    const itemData = item.system;

    const hitCharacteristic = Math.max(0, actor.system.characteristics[itemData.uses]?.value);
    if (!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === itemData.uses.toUpperCase())) {
        ui.notifications.warn(
            `<b>${item.actor.name}</b> does not have <b>${itemData.uses.toUpperCase()}</b>. ${item.actor.type === "base2" ? `Consider creating a COMPUTER` : ``}`,
        );
    }

    const toHitChar = CONFIG.HERO.defendsWith[itemData.targets];

    const adjustment = getPowerInfo({
        item: item,
    })?.type?.includes("adjustment");
    const senseAffecting = item.isSenseAffecting();

    // TODO: Much of this looks similar to the AOE stuff above. Any way to combine?
    // -------------------------------------------------
    // attack roll
    // -------------------------------------------------
    const setManeuver = actor.items.find((o) => o.type == "maneuver" && o.name === "Set" && o.isActive);

    let stunForEndHeroRoller = null;

    const attackHeroRoller = new HeroRoller()
        .makeSuccessRoll()
        .addNumber(11, "Base to hit")
        .addNumber(hitCharacteristic, itemData.uses)
        .addNumber(parseInt(options.ocvMod) || 0, "OCV modifier")
        .addNumber(parseInt(options.omcvMod) || 0, "OMCV modifier")
        .addNumber(-parseInt(setManeuver?.baseInfo?.maneuverDesc?.ocv || 0), "Set Maneuver");

    if (item.system.range === CONFIG.HERO.RANGE_TYPES.SELF) {
        // TODO: Should not be able to use this on anyone else. Should add a check.
    }

    // TODO: Should consider if the target's range exceeds the power's range or not and display some kind of warning
    //       in case the system has calculated it incorrectly.

    const noRangeModifiers = !!item.findModsByXmlid("NORANGEMODIFIER");
    const normalRange = !!item.findModsByXmlid("NORMALRANGE");

    // Mind Scan
    if (parseInt(options.mindScanMinds)) {
        attackHeroRoller.addNumber(parseInt(options.mindScanMinds), "Number Of Minds");
    }
    if (parseInt(options.mindScanFamiliar)) {
        attackHeroRoller.addNumber(parseInt(options.mindScanFamiliar), "Mind Familiarity");
    }

    // There are no range penalties if this is a line of sight power or it has been bought with
    // no range modifiers.
    if (
        targets.length > 0 &&
        !(
            item.system.range === CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT ||
            item.system.range === CONFIG.HERO.RANGE_TYPES.SPECIAL ||
            noRangeModifiers ||
            normalRange
        )
    ) {
        if (!token) {
            // We can still proceed without a token for our actor.  We just don't know the range to our potential target.
            ui.notifications.warn(`${actor.name} has no token in this scene.  Range penalties will be ignored.`);
        }

        const isAoE = item.getAoeModifier();
        const aoeTemplate = isAoE ? getAoeTemplateForItem(item) : null;
        if (isAoE && !aoeTemplate) {
            return ui.notifications.error(`Attack AOE template was not found.`);
        }

        // Pick the appropriate target based on the attack type. For AoE it's the base of the AoE template for
        // a single target attack it's the actual target.
        const target = isAoE ? aoeTemplate : targets[0];
        const distance = token ? calculateDistanceBetween(token, target).distance : 0;
        const rangePenalty = -calculateRangePenaltyFromDistanceInMetres(distance, actor);

        // PENALTY_SKILL_LEVELS (range)
        // const pslRange = penaltySkillLevelsForAttack(item).find(
        //     (o) => o.system.penalty === "range" && o.system.checked,
        // );
        for (const pslItem of item.pslRangePenaltyOffsetItems) {
            const pslValue = Math.min(parseInt(pslItem.system.LEVELS), -rangePenalty);
            if (pslValue !== 0) {
                attackHeroRoller.addNumber(pslValue, "Penalty Skill Levels"); //pslItem.detailedName());
            }
        }

        if (rangePenalty) {
            attackHeroRoller.addNumber(
                rangePenalty,
                `Range penalty (${getRoundedDownDistanceInSystemUnits(distance, item.actor)}${getSystemDisplayUnits(item.actor.is5e)})`,
            );
        }

        // Brace (+2 OCV only to offset the Range Modifier)
        const braceManeuver = item.actor.items.find((o) => o.type == "maneuver" && o.name === "Brace" && o.isActive);
        if (braceManeuver) {
            const brace = Math.min(-rangePenalty, braceManeuver.baseInfo?.maneuverDesc?.ocv);
            if (brace > 0) {
                attackHeroRoller.addNumber(brace, braceManeuver.name);
            }
        }
    }

    let dcv = parseInt(item.system.dcv || 0);

    const cvModifiers = action.current.cvModifiers;

    // Combat Skill Levels
    const skillLevelMods = {};
    for (const csl of combatSkillLevelsForAttack(item)) {
        // Requires A Roll
        if (!(await requiresASkillRollCheck(csl.item))) {
            continue;
        }
        const id = csl.skill.id;
        skillLevelMods[id] = skillLevelMods[id] ?? { ocv: 0, dcv: 0, dc: 0 };
        const cvMod = skillLevelMods[id];
        action.system.item[id] = csl.skill;

        cvMod.dc += csl.dc;
        if (csl.ocv || csl.omcv > 0) {
            cvMod.ocv += csl.ocv || csl.omcv;
            //heroRoller.addNumber(csl.ocv || csl.omcv, csl.item.name);
        }
        dcv += csl.dcv;
        cvMod.dcv += csl.dcv;
    }

    const dmcv = parseInt(item.system.dmcv || 0);
    if (dmcv != 0) {
        // Make sure we don't already have this activeEffect
        let prevActiveEffect = Array.from(item.actor.allApplicableEffects()).find((o) => o.origin === item.uuid);
        if (!prevActiveEffect) {
            // Estimate of how many seconds the DCV penalty lasts (until next phase).
            // In combat.js#_onStartTurn we remove this AE for exact timing.
            let seconds = Math.ceil(12 / parseInt(item.actor.system.characteristics.spd.value));
            let _dcvText = "DMCV";
            let _dcvValue = dmcv;

            const activeEffect = {
                label: `${item.name} ${_dcvValue.signedStringHero()} ${_dcvText}`,
                icon: dcv < 0 ? "icons/svg/downgrade.svg" : "icons/svg/upgrade.svg",
                changes: [
                    {
                        key: `system.characteristics.${_dcvText.toLowerCase()}.value`,
                        value: _dcvValue,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                ],
                origin: item.uuid,
                duration: {
                    seconds: seconds,
                },
                flags: {
                    [game.system.id]: {
                        nextPhase: true,
                    },
                },
            };
            await item.actor.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
        }
    }

    Object.keys(skillLevelMods).forEach((key) => {
        const cvMod = Attack.makeCvModifierFromItem(
            action.system.item[key],
            action.system,
            skillLevelMods[key].ocv,
            skillLevelMods[key].dcv,
            skillLevelMods[key].dc,
        );
        cvModifiers.push(cvMod);
    });
    // Haymaker -5 DCV
    const haymakerManeuver = actor.items.find((o) => o.type == "maneuver" && o.name === "Haymaker" && o.isActive);
    if (haymakerManeuver) {
        dcv -= 5;
    }

    // STRMINIMUM
    const strMinimumModifier = item.findModsByXmlid("STRMINIMUM");
    if (strMinimumModifier) {
        const strMinimumValue = calculateStrengthMinimumForItem(item, strMinimumModifier);
        const extraStr = Math.max(0, parseInt(actor.system.characteristics.str.value)) - strMinimumValue;
        if (extraStr < 0) {
            attackHeroRoller.addNumber(Math.floor(extraStr / 5), strMinimumModifier.ALIAS);
        }
    }

    cvModifiers.forEach((cvModifier) => {
        if (cvModifier.cvMod.ocv) {
            attackHeroRoller.addNumber(cvModifier.cvMod.ocv, cvModifier.name);
        }
    });
    Attack.makeActionActiveEffects(action);

    // [x Stun, x N Stun, x Body, OCV modifier]
    const noHitLocationsPower = !!item.system.noHitLocations;
    if (
        game.settings.get(HEROSYS.module, "hit locations") &&
        options.aim &&
        options.aim !== "none" &&
        !noHitLocationsPower
    ) {
        const aimTargetLocation =
            game.settings.get(HEROSYS.module, "hitLocTracking") === "all" && options.aimSide !== "none"
                ? `${options.aimSide} ${options.aim}`
                : options.aim;

        // Figure out the OCV penalty for the hit location or special hit locations.
        const aimOcvPenalty = CONFIG.HERO.hitLocations[options.aim]?.ocvMod || 0;
        if (aimOcvPenalty) {
            attackHeroRoller.addNumber(aimOcvPenalty, aimTargetLocation);
        }

        // Penalty Skill Levels
        if (options.usePsl) {
            const pslHit = penaltySkillLevelsForAttack(item).find(
                (o) => o.system.penalty === "hitLocation" && o.system.checked,
            );
            if (pslHit) {
                let pslValue = Math.min(pslHit.system.LEVELS, Math.abs(aimOcvPenalty));
                attackHeroRoller.addNumber(pslValue, pslHit.name);
            }
        }
    }

    // This is the actual roll to hit. In order to provide for a die roll
    // that indicates the upper bound of DCV hit, we have added the base (11) and the OCV, and subtracted the mods
    // and lastly we subtract the die roll. The value returned is the maximum DCV hit
    // (so we can be sneaky and not tell the target's DCV out loud).
    attackHeroRoller.addDice(-3);

    const aoeModifier = item.getAoeModifier();
    const aoeTemplate = aoeModifier ? getAoeTemplateForItem(item) : null;
    const explosion = item.hasExplosionAdvantage();
    const SELECTIVETARGET = aoeModifier?.ADDER ? aoeModifier.ADDER.find((o) => o.XMLID === "SELECTIVETARGET") : null;
    const NONSELECTIVETARGET = aoeModifier?.ADDER
        ? aoeModifier.ADDER.find((o) => o.XMLID === "NONSELECTIVETARGET")
        : null;

    const aoeAlwaysHit = aoeModifier && !(SELECTIVETARGET || NONSELECTIVETARGET);

    let targetData = [];
    const targetIds = [];
    let targetsArray = Array.from(targets);

    if (targetsArray.length === 0 && item?.system.XMLID === "MINDSCAN") {
        targetsArray = canvas.tokens.controlled;
    }

    // If AOE then sort by distance from center
    if (explosion) {
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
        let targetDefenseValue = RoundFavorPlayerUp(
            target.actor?.system.characteristics[toHitChar.toLowerCase()]?.value,
        );

        // Bases have no DCV.  DCV=3; 0 if adjacent
        // Mind Scan defers DMCV so use 3 for now
        if (isNaN(targetDefenseValue) || target.actor.type === "base2") {
            const _token = actor.token || actor.getActiveTokens()[0];
            if (!target.actor || calculateDistanceBetween(_token, target).distance > 2) {
                targetDefenseValue = 3;
            } else {
                targetDefenseValue = 0;
            }
        }

        // Mind scan typically has just 1 target, but could have more. Use same roll for all targets.
        const targetHeroRoller = aoeAlwaysHit || options.mindScanMinds ? attackHeroRoller : attackHeroRoller.clone();
        let toHitRollTotal = 0;
        let by = 0;
        let autoSuccess = false;

        let hit = "Miss";
        if (aoeAlwaysHit) {
            hit = "Hit";
            by = "AOE auto";
        } else {
            // TODO: Autofire against multiple targets should have increasing difficulty

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
                const distanceInMetres = calculateDistanceBetween(aoeTemplate, target.getCenterPoint()).distance;
                by += ` (${getRoundedDownDistanceInSystemUnits(distanceInMetres, item.actor)}${getSystemDisplayUnits(
                    item.actor.is5e,
                )} from template origin)`;
            }
        }

        if (target.id) {
            // Don't bother to track a bogus target created so we get dice no nice rolls when no target selected.
            targetData.push({
                id: target.id,
                name: `${target.name || "No Target Selected"}${options.targetEntangle ? " [ENTANGLE]" : ""}`,
                aoeAlwaysHit: aoeAlwaysHit,
                explosion: explosion,
                toHitChar: toHitChar,
                toHitRollTotal: toHitRollTotal,
                autoSuccess: autoSuccess,
                hitRollText: `${hit} a ${toHitChar} of ${toHitRollTotal}`,
                value: targetDefenseValue,
                result: { hit: hit, by: by.toString() },
                roller: options.mindScanMinds
                    ? targetsArray[0].id === target.id
                        ? targetHeroRoller
                        : null
                    : targetHeroRoller,
                renderedRoll: await targetHeroRoller.render(),
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
    }

    // AUTOFIRE
    const autofire = item.findModsByXmlid("AUTOFIRE");
    if (autofire) {
        const autoFireShots = autofire ? parseInt(autofire.OPTION_ALIAS.match(/\d+/)) : 0;

        // Autofire check for multiple hits on single target
        if (targetData.length === 1) {
            const singleTarget = Array.from(targets)[0];
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
                }/${autofire.OPTION_ALIAS.toLowerCase()}<br>${firstShotResult} a ${toHitChar} of ${autofireShotRollTotal}`;

                const value = singleTarget.actor.system.characteristics[toHitChar.toLowerCase()].value;
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
                });
            }
        }
    }

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
        toHitRollTotal: targetData?.[0]?.toHitRollTotal,

        // data for damage card
        actor,
        token,

        actionData: actionToJSON(action),

        item,
        itemJsonStr: dehydrateAttackItem(item), // PH: FIXME: Can remove some things like item etc because they're in the actionData.
        originalUuid: item.id || fromUuidSync(item.system._active.__originalUuid).id,

        adjustment,
        senseAffecting,
        ...options,
        targetData: targetData,
        targetIds: targetIds,

        // endurance
        useEnd: resourcesRequired.totalEnd,
        resourcesUsedDescription: `${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`,

        // misc
        tags: attackHeroRoller.tags(),
        attackTags: getAttackTags(item),
        maxMinds: CONFIG.HERO.mindScanChoices
            .find((o) => o.key === parseInt(options.mindScanMinds))
            ?.label.match(/[\d,]+/)?.[0],
        action,
        inActiveCombat: token?.inCombat,
    };
    options.rolledResult = targetData;

    // render card
    const template = isBlockManeuver
        ? `systems/${HEROSYS.module}/templates/chat/item-toHit-block-card.hbs`
        : `systems/${HEROSYS.module}/templates/chat/item-toHit-card.hbs`;
    const cardHtml = await foundryVttRenderTemplate(template, cardData);

    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
    //speaker.alias = actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC,
        rolls: targetData
            .map((target) => target.roller?.rawRolls())
            .flat()
            .concat(stunForEndHeroRoller?.rawRolls())
            .filter(Boolean),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);
    return;
}

function getAttackTags(item) {
    // Attack Tags
    let attackTags = [];

    if (!item) return attackTags;

    // Provide the name of the original item in the tags.
    let originalItemTag;
    if (item.system.ALIAS || item.system.XMLID) {
        originalItemTag = { name: `${item.system.ALIAS || item.system.XMLID}`, title: `${item.system.XMLID}` };
        attackTags.push(originalItemTag);
    }

    // Use the effective item to figure out what this attack really is.
    const baseAttackItem = item.baseInfo.baseEffectDicePartsBundle(item, {}).baseAttackItem;

    // Provide the name of the actual attack item in the tag if it is different from the original item. However,
    // make sure we ignore internal placeholders.
    if (
        (baseAttackItem.system.ALIAS || baseAttackItem.system.XMLID) &&
        baseAttackItem.system.XMLID !== "__STRENGTHDAMAGE"
    ) {
        const baseAttackItemTag = {
            name: `${baseAttackItem.system.ALIAS || baseAttackItem.system.XMLID}`,
            title: `${baseAttackItem.system.XMLID}`,
        };
        if (baseAttackItemTag.name !== originalItemTag?.name && baseAttackItemTag.title !== originalItemTag?.title) {
            attackTags.push(baseAttackItemTag);
        }
    }

    // Only add in class (which we should probably rename/deprecate) when we don't already have it from the ALIAS/XMLID
    if (!attackTags.find((tag) => tag.name?.toLowerCase() === baseAttackItem.system.class?.toLowerCase())) {
        attackTags.push({
            name: baseAttackItem.system.class || baseAttackItem.name,
            title: baseAttackItem.system.XMLID,
        });
    }

    if (baseAttackItem.doesKillingDamage) {
        attackTags.push({ name: `killing` });
    }

    // Item adders
    if (baseAttackItem.adders) {
        for (const adder of baseAttackItem.adders) {
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
    if (baseAttackItem.system.USESTANDARDEFFECT) {
        attackTags.push({
            name: `Standard Effect`,
            title: `USESTANDARDEFFECT`,
        });
    }

    // STUN/BODY/EFFECT Only
    if (
        baseAttackItem.system.stunBodyDamage &&
        baseAttackItem.system.stunBodyDamage !== CONFIG.HERO.stunBodyDamages.stunbody
    ) {
        attackTags.push({
            name: baseAttackItem.system.stunBodyDamage,
            title: baseAttackItem.system.stunBodyDamage,
        });
    }

    // FLASH
    if (baseAttackItem.system.XMLID === "FLASH") {
        attackTags.push({ name: baseAttackItem.system.OPTION_ALIAS, title: baseAttackItem.system.OPTIONID });
        for (const adder of baseAttackItem.adders) {
            attackTags.push({ name: adder.ALIAS, title: adder.XMLID });
        }
    }

    // ADJUSTMENT should include what we are adjusting
    if (baseAttackItem.baseInfo.type.includes("adjustment")) {
        const { valid, reducesArray, enhancesArray } = baseAttackItem.splitAdjustmentSourceAndTarget();
        if (!valid) {
            attackTags.push({ name: baseAttackItem.system.INPUT });
        } else {
            for (const adjustTarget of reducesArray) {
                attackTags.push({ name: `-${adjustTarget}` });
            }
            for (const adjustTarget of enhancesArray) {
                attackTags.push({ name: `+${adjustTarget}` });
            }
        }
    }

    // item modifiers
    for (const mod of baseAttackItem.system.MODIFIER || []) {
        switch (mod.XMLID) {
            case "AUTOFIRE":
                {
                    const autoFireShots = parseInt(mod.OPTION_ALIAS.match(/\d+/));
                    attackTags.push({
                        name: `${mod.ALIAS || mod.XMLID}(${autoFireShots})`,
                        title: `${mod.OPTION_ALIAS || ""}`,
                    });
                }
                break;

            case "EXPLOSION":
                // 6e explosion is a modifier to AOE. In 5e EXPLOSION is a mod to itself so
                // for 5e (i.e. here), show 2 tags.
                attackTags.push({
                    name: `${mod.ALIAS}`,
                    title: `${mod.XMLID}`,
                });

            // Intentionally Fall Through to AOE to show the size of the attack
            case "AOE":
                // TODO: This needs to be corrected as the names are not consistent.
                attackTags.push({
                    name: `${mod.OPTION_ALIAS}(${mod.LEVELS})`,
                    title: `${mod.XMLID}`,
                });
                break;

            case "STRMINIMUM": {
                const strMinimum = parseInt(mod.OPTION_ALIAS.match(/\d+/)?.[0] || 0);
                attackTags.push({
                    name: `${strMinimum} ${mod.ALIAS || mod.XMLID}`,
                    title: `${mod.XMLID}`,
                });
                break;
            }

            case "AVAD": {
                attackTags.push({
                    name: `${mod.ALIAS || mod.XMLID}`,
                    title: `${mod.XMLID}\n${mod.INPUT}`,
                });
                break;
            }

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

    // MartialArts NND
    if (baseAttackItem.system.EFFECT?.includes("NNDDC")) {
        attackTags.push({
            name: `NND`,
            title: `No Normal Defense`,
        });
    }

    // Martial FLASH
    if (baseAttackItem.system.EFFECT?.includes("FLASHDC")) {
        attackTags.push({
            name: `Flash`,
            title: baseAttackItem.name,
        });
        attackTags.push({
            name: baseAttackItem.system.INPUT,
            title: baseAttackItem.name,
        });
    }

    // Remove any duplicates.  Like with FLASH #2629
    attackTags = Array.from(
        new Set(attackTags.map((o) => o.name)).map((name) => attackTags.find((p) => p.name === name)),
    );

    return attackTags;
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
    const token = getTokenEducatedGuess({ tokenId: kbOptions.targetTokenId });
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
    <form autocomplete="off">
        <p>
            A character takes 1d6 damage for every ${getRoundedDownDistanceInSystemUnits(
                2,
                item.actor,
            )}${getSystemDisplayUnits(item.actor.system.is5e)} they are knocked into a solid object, 
            to a maximum of the PD + BODY of the object hit.
        </p>
        <p>
            A character takes 1d6 damage for every ${getRoundedDownDistanceInSystemUnits(
                4,
                item.actor,
            )}${getSystemDisplayUnits(item.actor.system.is5e)} they are knocked back if no object intervenes. <strong>This is the default value below</strong>.
        </p>
        <p>
            The character typically winds up prone.
        </p>
        
        <p>
            <div class="form-group">
                <label>KB damage dice</label>
                <input type="text" name="knockbackDice" value="${Math.max(
                    0,
                    Math.floor(knockbackResultTotal / 2),
                )}" data-dtype="Number" />
            </div>
        </p>

        <p>
            NOTE: Don't forget to move the token to the appropriate location as KB movement is not automated. 
        </p>
    </form>
    `;

    await new Promise((resolve) => {
        const data = {
            title: `Confirm Knockback details`,
            content: html,
            buttons: {
                normal: {
                    label: "Roll & Apply",
                    callback: async function (html) {
                        const dice = html.find("input")[0].value;
                        await _rollApplyKnockback(token, parseInt(dice));
                    },
                },
                cancel: {
                    label: "Cancel",
                },
            },
            default: "normal",
            close: () => resolve({ cancelled: true }),
        };
        new Dialog(data, null).render(true);
    });
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
    await knockbackAttackItem._postUpload();
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
    for (const vuln of conditionalDefenses.filter(
        (o) => o.system.XMLID === "VULNERABILITY" && !ignoreDefenseIds.includes(o.id),
    )) {
        damageData.VulnDesc ??= [];
        damageData.VulnDesc.push(vuln.conditionalDefenseShortDescription);
        if (vuln.system.MODIFIER) {
            for (const modifier of vuln.system.MODIFIER || []) {
                switch (modifier.OPTIONID) {
                    case "HALFSTUN":
                        damageData.vulnStunMultiplier ??= 1;
                        damageData.vulnStunMultiplier += 0.5;
                        break;
                    case "TWICESTUN":
                        damageData.vulnStunMultiplier ??= 1;
                        damageData.vulnStunMultiplier += 1;
                        break;
                    case "HALFBODY":
                        damageData.vulnBodyMultiplier ??= 1;
                        damageData.vulnBodyMultiplier += 0.5;
                        break;
                    case "TWICEBODY":
                        damageData.vulnBodyMultiplier ??= 1;
                        damageData.vulnBodyMultiplier += 1;
                        break;
                    case "HALFEFFECT":
                        damageData.vulnStunMultiplier ??= 1;
                        damageData.vulnStunMultiplier += 0.5;
                        damageData.vulnBodyMultiplier ??= 1;
                        damageData.vulnBodyMultiplier += 0.5;
                        break;
                    case "TWICEEFFECT":
                        damageData.vulnStunMultiplier ??= 1;
                        damageData.vulnStunMultiplier += 1;
                        damageData.vulnBodyMultiplier ??= 1;
                        damageData.vulnBodyMultiplier += 1;
                        break;

                    default:
                        console.warn(`Unhandled VULNERABILITY ${modifier.modifier.OPTIONID}`, vuln);
                }
            }
        } else {
            // DEFAULT VULNERABILITY isi 1.5 STUN
            damageData.vulnStunMultiplier = 1.5;
        }
    }

    const damageDetail = await _calcDamage(damageRoller, knockbackAttackItem, damageData);
    damageDetail.effects = `${damageDetail.effects || ""} Prone`.replace("; ", "").trim();

    const CANNOTBESTUNNED = token.actor.items.find((o) => o.system.XMLID === "AUTOMATON");
    if (CANNOTBESTUNNED) {
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
    const cardHtml = await foundryVttRenderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
    //speaker.alias = actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
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
        let changes = {};
        if (damageDetail.stun != 0) {
            changes["system.characteristics.stun.value"] =
                token.actor.system.characteristics.stun.value - damageDetail.stun;
        }
        if (damageDetail.body != 0) {
            changes["system.characteristics.body.value"] =
                token.actor.system.characteristics.body.value - damageDetail.body;
        }
        await token.actor.update(changes);
    }

    // Token falls prone
    //token.actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect);
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
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
        rolls: effectRoller.rawRolls(),
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
    const toHitData = { ...button.dataset };

    // PH: FIXME: This is now included in the action data and this can be cleaned up
    const { actor, item } = rehydrateActorAndAttackItem(toHitData);

    if (!item || !actor) {
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    const action = actionFromJSON(toHitData.actionData);
    if (!action?.current.attackerTokenId) {
        console.warn("expecting action.current.attackerTokenId");
    }
    const token = getTokenEducatedGuess({ action, actor: item.actor });
    const hthAttackItems = (action.hthAttackItems || []).map((hthAttack) => fromUuidSync(hthAttack.uuid));
    toHitData.hthAttackItems = hthAttackItems;

    const haymakerManeuverActiveItem = item.actor?.items.find(
        (item) =>
            item.type === "maneuver" &&
            item.system.XMLID === "HAYMAKER" &&
            (item.system.active || item.actor?.statuses.has("haymaker") || action.system.statuses.includes("haymaker")),
    );

    // Coerce type to boolean
    toHitData.targetEntangle =
        toHitData.targetEntangle === true || toHitData.targetEntangle.match(/true/i) ? true : false;

    const isAdjustment = !!getPowerInfo({
        item: item,
    })?.type?.includes("adjustment");
    // Sense affecting power or maneuver with FLASHDC
    const isSenseAffecting = item.isSenseAffecting();
    const isKilling = item.doesKillingDamage;
    const isEntangle = item.system.XMLID === "ENTANGLE";
    const isNormalAttack = !isEntangle && !isSenseAffecting && !isAdjustment && !isKilling;
    const isKillingAttack = !isEntangle && !isSenseAffecting && !isAdjustment && isKilling;
    const isEffectBasedAttack = isBodyBasedEffectRoll(item) || isStunBasedEffectRoll(item);

    const increasedMultiplierLevels = parseInt(item.findModsByXmlid("INCREASEDSTUNMULTIPLIER")?.LEVELS || 0);
    const decreasedMultiplierLevels = parseInt(item.findModsByXmlid("DECREASEDSTUNMULTIPLIER")?.LEVELS || 0);

    const useStandardEffect = item.system.USESTANDARDEFFECT || false;

    const { diceParts, tags } = calculateDicePartsForItem(item, {
        isAction: true,
        ...toHitData,
        ...{ haymakerManeuverActiveItem },
    });

    const includeHitLocation = game.settings.get(HEROSYS.module, "hit locations") && !item.system.noHitLocations;

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
        .makeEntangleRoll(isEntangle)
        .makeEffectRoll(isEffectBasedAttack)
        .addStunMultiplier(increasedMultiplierLevels - decreasedMultiplierLevels)
        .addDice(diceParts.d6Count >= 1 ? diceParts.d6Count : 0)
        .addHalfDice(diceParts.halfDieCount >= 1 ? diceParts.halfDieCount : 0)
        .addDiceMinus1(diceParts.d6Less1DieCount >= 1 ? diceParts.d6Less1DieCount : 0)
        .addNumber(diceParts.constant)
        .modifyToStandardEffect(useStandardEffect)
        .modifyToNoBody(
            isNormalAttack &&
                (item.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.stunonly ||
                    item.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.effectonly),
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
    for (const id of toHitData.targetIds.split(",")) {
        const token = canvas.scene.tokens.get(id);
        if (token) {
            const entangleAE = token.actor?.temporaryEffects?.find(
                (o) => o.flags[game.system.id]?.XMLID === "ENTANGLE",
            );
            const targetToken = {
                tokenId: id,
                name: token.name,
                subTarget:
                    toHitData.targetEntangle && entangleAE
                        ? `${token.name} [${entangleAE.flags[game.system.id]?.XMLID}]`
                        : null,
                targetEntangle: !!toHitData.targetEntangle,
            };

            targetTokens.push(targetToken);
        }
    }

    // Kludge for SIMPLIFIED HEALING
    const isSimpleHealing = item.system.XMLID === "HEALING" && item.system.INPUT.match(/simplified/i);

    const damageRenderedResult = isSimpleHealing
        ? await (await damageRoller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL)).render()
        : await damageRoller.render();

    // // PERSONALIMMUNITY
    // // NOTE: We may want to reintroduce this code (CHANGE ENVIRONMENT or large scale MENTAL) at some point.
    // // However at the moment AOE is the primary mechanism to target multiple tokens.
    // // const PERSONALIMMUNITY = item.findModsByXmlid("PERSONALIMMUNITY");
    // // if (PERSONALIMMUNITY && targetTokens) {
    // //     targetTokens = targetTokens.filter((o) => o.token.actor.id !== actor.id);
    // // }

    const cardData = {
        user: game.user,

        item: item,
        itemJsonStr: toHitData.itemJsonStr, // PH: FIXME: Would be nice to just have this in action data that is always passed through
        actor: item.actor,

        nonDmgEffect:
            isAdjustment || isBodyBasedEffectRoll(item) || isStunBasedEffectRoll(item) || item.baseInfo?.nonDmgEffect,
        isSenseAffecting,

        // dice rolls
        renderedDamageRoll: damageRenderedResult,
        rollerJSON: damageRoller.toJSON(),

        // hit locations
        useHitLoc: damageRoller.hitLocationValid(),
        hitLocText: damageRoller.getHitLocation().fullName,

        // misc
        targetIds: toHitData.targetIds,
        tags: tags,

        attackTags: getAttackTags(item),
        targetTokens: targetTokens,
        actionDataJSON: actionToJSON(action),
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/item-damage-card.hbs`;
    const cardHtml = await foundryVttRenderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });
    //speaker.alias = item.actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
        rolls: damageRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);

    // turn off haymaker
    await actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.haymakerEffect.id, {
        active: false,
    });

    return;
}

export async function _onRollMindScan(event) {
    console.log(event);
    const button = event.currentTarget;
    button.blur(); // The button remains highlighted for some reason; kludge to fix.
    const toHitData = { ...button.dataset };
    const item = HeroSystem6eItem.fromSource(JSON.parse(toHitData.itemJsonStr), {
        parent: fromUuidSync(toHitData.actorUuid),
    });

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

    // Look thru all the scenes to find this token
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

    const template2 = `systems/${HEROSYS.module}/templates/attack/item-mindscan-target-card.hbs`;
    const content = await foundryVttRenderTemplate(template2, data);
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
    const item = HeroSystem6eItem.fromSource(JSON.parse(toHitData.itemJsonStr), {
        parent: fromUuidSync(toHitData.actorUuid),
    });
    const actor = item?.actor;

    if (!actor) {
        return ui.notifications.error(`Attack details are no longer available.`);
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

    const adjustment = item.baseInfo?.type?.includes("adjustment");
    const senseAffecting = item.isSenseAffecting();

    const useStandardEffect = item.system.USESTANDARDEFFECT || false;

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
    } = getActorDefensesVsAttack(token.actor, item, { ignoreDefenseIds });
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
    const cardHtml = await foundryVttRenderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });
    //speaker.alias = item.actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
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
    await actor._postUpload();

    if (!damageData.actorUuid) {
        actor.items.set(item.system.XMLID, item);
    }

    return _onApplyDamage(event, actor, item);
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
                const ae = token.actor?.temporaryEffects.find((o) => o.flags[game.system.id]?.XMLID === "ENTANGLE");
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

export async function _onApplyDamageToSpecificToken(item, _damageData, action, targetToken) {
    const damageData = foundry.utils.deepClone(_damageData);
    const token = getTokenEducatedGuess({ tokenId: targetToken?.tokenId }); // canvas.scene.tokens.get(targetToken.tokenId);
    if (!token) {
        return ui.notifications.warn(`You must select at least one token before applying damage.`);
    }

    if (!token.actor) {
        return ui.notifications.error(
            `Actor for ${token.name} is missing.  Unable to apply damage.  You will have to create a new actor & token.`,
        );
    }

    if (!item) {
        // This typically happens when the attack id stored in the damage card no longer exists on the actor.
        // For example if the attack item was deleted or the HDC was uploaded again.
        console.warn(damageData.itemId);
        return ui.notifications.error(`Attack details are no longer available.`);
    }

    // Remove haymaker status
    const haymakerAe = item.actor?.effects.find((effect) => effect.statuses.has("haymaker"));
    if (haymakerAe) {
        await item.actor.removeActiveEffect(haymakerAe);
    }

    const damageRoller = HeroRoller.fromJSON(damageData.roller);

    const explosion = item.hasExplosionAdvantage();
    if (explosion) {
        const aoeTemplate = getAoeTemplateForItem(item);

        if (aoeTemplate) {
            // Distance from center
            if (
                game.scenes.current.grid.type === CONST.GRID_TYPES.SQUARE &&
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
            const HexTemplates = game.settings.get(HEROSYS.module, "HexTemplates");
            const hexGrid = !(
                game.scenes.current.grid.type === CONST.GRID_TYPES.GRIDLESS ||
                game.scenes.current.grid.type === CONST.GRID_TYPES.SQUARE
            );

            if (HexTemplates && hexGrid) {
                const gridSizeInMeters = game.scenes.current.grid.distance;
                distance = calculateDistanceBetween(aoeTemplate, token.object.center).gridSpaces * gridSizeInMeters;

                // NOTE: The grid size is half a hex smaller since the centre hex counts as 1" so template is 1m smaller (see item-attack-application.mjs)
                pct = distance / (aoeTemplate.distance + 1);
            } else {
                distance = calculateDistanceBetween(aoeTemplate, token.object.center).distance;
                pct = distance / aoeTemplate.distance;
            }

            // Remove highest N terms
            // TODO: We could improve this by dropping part terms for situations where we have >5AP/die
            const originalNumberOfTerms = damageRoller.getFullBaseTerms().base.length;
            const termsToRemove = Math.floor(pct * originalNumberOfTerms);
            damageRoller.removeNHighestRankTerms(termsToRemove);
        } else {
            ui.notifications.warn(
                `No Area Of Effect template was found, will apply FULL EFFECT to ${targetToken.name}.`,
            );
        }
    }

    // This the raw damage received by the target before any defenses (i.e. after explosion and other range effects).
    // You probably don't want to use it - use damageRoller instead.
    const baseDamageRoller = damageRoller.clone();

    const automation = game.settings.get(HEROSYS.module, "automation");

    // Maneuvers can include effects beyond damage
    if (["maneuver", "martialart"].includes(item.type)) {
        await doManeuverEffects(item, action);
    }

    if (item.system.XMLID === "ENTANGLE") {
        return _onApplyEntangleToSpecificToken(item, token, damageRoller, action);
    }

    // Target ENTANGLE
    const entangleAE = token.actor.temporaryEffects.find((o) => o.flags[game.system.id]?.XMLID === "ENTANGLE");
    if (entangleAE) {
        // Targeting ENTANGLE based on attack-application checkbox
        let targetEntangle = targetToken.targetEntangle;

        // If they clicked "Apply Damage" then prompt
        // WHAT? if (damageRoller.getType === HeroRoller.ROLL_TYPE.ENTANGLE) {
        if (damageRoller.getType() !== HeroRoller.ROLL_TYPE.ENTANGLE && targetEntangle === undefined) {
            targetEntangle = await Dialog.wait({
                title: `Confirm Target`,
                content: `Target ${token.name} or the ENTANGLE effecting ${token.name}?`,
                buttons: {
                    token: {
                        label: `${token.name}`,
                        callback: async function () {
                            return false;
                        },
                    },
                    entangle: {
                        label: `ENTANGLE`,
                        callback: async function () {
                            return true;
                        },
                    },
                },
            });
        }

        if (targetEntangle && entangleAE) {
            return _onApplyDamageToEntangle(item, token, damageRoller, entangleAE, action);
        }
    }

    if (damageRoller.getHitLocation().item) {
        return ui.notifications.error(`Damaging FOCI is not currently supported.`);
    }

    // Attack Verses Alternate Defense (6e) or NND (5e)
    let avad = item.findModsByXmlid("AVAD") || item.findModsByXmlid("NND");

    // Martial Arts also have NND's which are special AVAD and always/usually PD
    if (!avad && item.system.EFFECT?.includes("NND")) {
        const pdXml = getPowerInfo({ xmlid: "PD", actor: token.actor });
        avad = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(pdXml.xml, token.actor), {
            parent: token.actor,
        });
        avad.system.LEVELS = 1;
        avad._postUpload();

        // Massive Kludge: MANEUVERS don't have INPUT but some of the rest of the code includes check for that
        item.system.INPUT = "PD";
    }

    // Try to make sure we have a PD/ED/MD type for AVAD
    if (avad && !avad.INPUT && item.system.INPUT) {
        avad.INPUT = item.system.INPUT;
    }

    // Check for conditional defenses
    const { ignoreDefenseIds, conditionalDefenses } = await getConditionalDefenses(token, item, avad);

    // If we had conditional defenses and showed the UI to select them, but canceled, getConditionalDefenses returns null values
    if (ignoreDefenseIds === null) {
        return;
    }

    // Some defenses require a roll not just to activate, but on each use: 6e EVERYPHASE & 5e ACTIVATIONROLL
    const defenseEveryPhase = token.actor.items.filter(
        (o) =>
            o.isActive &&
            (o.findModsByXmlid("EVERYPHASE") || o.findModsByXmlid("ACTIVATIONROLL")) &&
            o.baseInfo.behaviors.includes("defense"),
    );

    for (const defense of defenseEveryPhase) {
        if (!ignoreDefenseIds.includes(defense.id)) {
            if (getItemDefenseVsAttack(defense, item, { attackDefenseVs: item.attackDefenseVs }) !== null) {
                const success = await requiresASkillRollCheck(defense);
                if (!success) {
                    ignoreDefenseIds.push(defense.id);
                }
            } else {
                console.log(`requiresASkillRollCheck was not made for ${defense.name}`, defense, item);
            }
        }
    }

    // -------------------------------------------------
    // determine active defenses
    // -------------------------------------------------
    let defense = "";

    // New Defense Stuff
    const { defenseValue, resistantValue, impenetrableValue, damageReductionValue, damageNegationValue, defenseTags } =
        getActorDefensesVsAttack(token.actor, item, { ignoreDefenseIds });

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
    damageData.targetToken = token;

    // VULNERABILITY
    for (const vuln of conditionalDefenses.filter(
        (o) => o.system.XMLID === "VULNERABILITY" && !ignoreDefenseIds.includes(o.id),
    )) {
        damageData.VulnDesc ??= [];
        damageData.VulnDesc.push(vuln.conditionalDefenseShortDescription);
        if (vuln.system.MODIFIER) {
            for (const modifier of vuln.system.MODIFIER || []) {
                switch (modifier.OPTIONID) {
                    case "HALFSTUN":
                        damageData.vulnStunMultiplier ??= 1;
                        damageData.vulnStunMultiplier += 0.5;
                        break;
                    case "TWICESTUN":
                        damageData.vulnStunMultiplier ??= 1;
                        damageData.vulnStunMultiplier += 1;
                        break;
                    case "HALFBODY":
                        damageData.vulnBodyMultiplier ??= 1;
                        damageData.vulnBodyMultiplier += 0.5;
                        break;
                    case "TWICEBODY":
                        damageData.vulnBodyMultiplier ??= 1;
                        damageData.vulnBodyMultiplier += 1;
                        break;
                    case "HALFEFFECT":
                        damageData.vulnStunMultiplier ??= 1;
                        damageData.vulnStunMultiplier += 0.5;
                        damageData.vulnBodyMultiplier ??= 1;
                        damageData.vulnBodyMultiplier += 0.5;
                        break;
                    case "TWICEEFFECT":
                        damageData.vulnStunMultiplier ??= 1;
                        damageData.vulnStunMultiplier += 1;
                        damageData.vulnBodyMultiplier ??= 1;
                        damageData.vulnBodyMultiplier += 1;
                        break;

                    default:
                        console.warn(`Unhandled VULNERABILITY ${modifier.modifier.OPTIONID}`, vuln);
                }
            }
        } else {
            // DEFAULT VULNERABILITY isi 1.5 STUN
            damageData.vulnStunMultiplier = 1.5;
        }
    }

    // AVAD All or Nothing
    if (avad) {
        const nnd = avad.adders.find((o) => o.XMLID === "NND"); // Check for ALIAS="All Or Nothing" shouldn't be necessary
        if (nnd && damageData.defenseAvad > 0) {
            // render card
            let speaker = ChatMessage.getSpeaker({ actor: item.actor });

            const chatData = {
                author: game.user._id,
                content: `${item.name} did no damage.`,
                speaker: speaker,
            };

            await ChatMessage.create(chatData);
            return;
        }
    }

    damageRoller.removeNDC(damageData.damageNegationValue);

    // We need to recalculate damage to account for possible Damage Negation
    const damageDetail = await _calcDamage(damageRoller, item, damageData);

    const isTransform =
        getPowerInfo({
            item: item,
        })?.XMLID === "TRANSFORM";
    const isAdjustment = !!getPowerInfo({
        item: item,
    })?.type?.includes("adjustment");
    const isSenseAffecting = item.isSenseAffecting();

    if (isTransform) {
        return _onApplyTransformationToSpecificToken(item, token, damageDetail, defense, defenseTags, action);
    } else if (isAdjustment) {
        return _onApplyAdjustmentToSpecificToken(item, token, damageDetail, defense, defenseTags, action);
    } else if (isSenseAffecting) {
        return _onApplySenseAffectingToSpecificToken(item, token, damageDetail);
    }

    // AUTOMATION immune to mental powers
    if (item.system.class === "mental" && token?.actor?.type === "automaton") {
        defenseTags.push({
            name: "AUTOMATON",
            value: "immune",
            resistant: false,
            title: "Automations are immune to mental powers",
        });
        damageDetail.stun = 0;
        damageDetail.body = 0;
    }

    // AUTOMATION powers related to STUN
    const CANNOTBESTUNNED = token.actor.items.find(
        (o) => o.system.XMLID === "AUTOMATON" && o.system.OPTION === "CANNOTBESTUNNED",
    );
    const NOSTUN1 = token.actor.items.find((o) => o.system.XMLID === "AUTOMATON" && o.system.OPTION === "NOSTUN1"); // AUTOMATION Takes No STUN (loses abilities when takes BODY)
    const NOSTUN2 = token.actor.items.find((o) => o.system.XMLID === "AUTOMATON" && o.system.OPTION === "NOSTUN2"); //Takes No STUN
    if (NOSTUN1 && damageDetail.stun > 0) {
        defenseTags.push({
            name: "TAKES NO STUN",
            value: "immune",
            resistant: false,
            title: "Ignore the STUN damage from any attack; loses abilities when takes BODY",
        });
        damageDetail.effects = damageDetail.effects + "Takes No STUN (loses abilities when takes BODY); ";
        damageDetail.stun = 0;
    }
    if (NOSTUN2 && damageDetail.stun > 0) {
        defenseTags.push({
            name: "TAKES NO STUN",
            value: "immune",
            resistant: false,
            title: "Ignore the STUN damage from any attack",
        });
        damageDetail.effects = damageDetail.effects + "Takes No STUN; ";
        damageDetail.stun = 0;
    }

    // See if token has CON.  Notice we check raw actor type from config, not current actor props as
    // this token may have originally been a PC, and changed to a BASE.
    const hasCON = getCharacteristicInfoArrayForActor(token.actor).find((o) => o.key === "CON");

    // check if target is stunned.  Must have CON
    if (game.settings.get(HEROSYS.module, "stunned") && hasCON) {
        // determine if target was Stunned
        if (damageDetail.stun > token.actor.system.characteristics.con.value && !CANNOTBESTUNNED) {
            damageDetail.effects = damageDetail.effects + "inflicts Stunned; ";

            // none: "No Automation",
            // npcOnly: "NPCs Only (end, stun, body)",
            // pcEndOnly: "PCs (end) and NPCs (end, stun, body)",
            // all: "PCs and NPCs (end, stun, body)"
            if (automation === "all" || (automation === "npcOnly" && token.actor.type === "npc")) {
                //token.actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect);
                await token.actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect.id, {
                    overlay: false, // Would like to know if they are prone, and the contrast isn't great.
                    active: true,
                });
            }
        }
    }

    const damageRenderedResult = await damageRoller.render();

    // Attack may have additional effects, such as those from martial arts
    let effectsFinal = foundry.utils.deepClone(damageDetail.effects);
    if (item.system.effect) {
        for (const effect of item.system.effect.split(",")) {
            // Do not include [NORMALDC] strike and similar
            if (effect.indexOf("[") == -1 && !effect.match(/strike/i)) {
                effectsFinal += effect;
            }
        }
    }
    effectsFinal = effectsFinal.replace(/; $/, "");

    // Mind Control
    if (item.system.XMLID === "MINDCONTROL") {
        const targetActorEgo = token.actor?.system.characteristics?.ego?.value;
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

        // misc
        tags: defenseTags.filter((o) => !o.options?.knockback),
        attackTags: getAttackTags(item),
        targetToken: token,
        actionData: actionToJSON(action),
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-damage-card.hbs`;
    const cardHtml = await foundryVttRenderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });
    //speaker.alias = item.actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
        rolls: damageDetail.knockbackRoller?.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    // none: "No Automation",
    // npcOnly: "NPCs Only (end, stun, body)",
    // pcEndOnly: "PCs (end) and NPCs (end, stun, body)",
    // all: "PCs and NPCs (end, stun, body)"
    if (automation === "all" || (automation === "npcOnly" && token.actor.type === "npc")) {
        let changes = {
            "system.characteristics.body.value": token.actor.system.characteristics.body.value - damageDetail.body,
        };

        // See if token has STUN.  Notice we check raw actor type from config, not current actor props as
        // this token may have originally been a PC, and changed to a BASE.
        const hasSTUN = getCharacteristicInfoArrayForActor(token.actor).find((o) => o.key === "STUN");

        if (hasSTUN) {
            changes["system.characteristics.stun.value"] =
                token.actor.system.characteristics.stun?.value - damageDetail.stun;
        }
        await token.actor.update(changes);
    }

    const damageChatMessage = ChatMessage.create(chatData);

    // Absorption happens after damage is taken unless the GM allows it.
    const absorptionItems = token.actor.items.filter((item) => item.system.XMLID === "ABSORPTION");
    if (absorptionItems) {
        await _performAbsorptionForToken(token, absorptionItems, damageDetail, item);
    }

    return damageChatMessage;
}

export async function _onApplyEntangleToSpecificToken(item, token, originalRoll) {
    const entangleDefense = item.baseInfo.defense(item);
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
        const cardHtml = await foundryVttRenderTemplate(template, cardData);
        const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });
        //speaker.alias = item.actor.name;

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
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
        (entangleDefense.string = `${
            entangleDefense.mentalEntangle
                ? `${entangleDefense.rMD} rMD`
                : `${entangleDefense.rPD} rPD/${entangleDefense.rED} rED`
        }`),
            (body = Math.max(body, prevBody) + 1);
    }
    const effectData = {
        id: "entangled",
        img: HeroSystem6eActorActiveEffects.statusEffectsObj.entangledEffect.img,
        changes: foundry.utils.deepClone(HeroSystem6eActorActiveEffects.statusEffectsObj.entangledEffect.changes),
        name: `${item.system.XMLID} ${body} BODY ${entangleDefense.string}`,
        description: item.system.description,
        flags: {
            [game.system.id]: {
                entangleDefense,
                XMLID: item.system.XMLID,
                source: item.actor.name,
                dehydratedEntangleItem: dehydrateAttackItem(item),
                dehydratedEntangleActorUuid: item.actor.uuid,
            },
        },
        origin: item.uuid,
    };
    const changeBody = effectData.changes?.find((o) => o.key === "body");
    if (changeBody) {
        changeBody.value === body;
    } else {
        effectData.changes ??= [];
        effectData.changes.push({ key: "body", value: body, mode: 5 });
    }

    if (prevEntangle) {
        prevEntangle.update({
            name: effectData.name,
            flags: effectData.flags,
            changes: effectData.changes,
            origin: effectData.origin,
        });
    } else {
        token.actor.addActiveEffect(effectData);
    }

    const cardData = {
        item: item,

        // Incoming Damage Information
        incomingDamageSummary: originalRoll.getTotalSummary(),
        incomingAnnotatedDamageTerms: originalRoll.getAnnotatedTermsSummary(),

        // dice rolls
        roller: originalRoll,

        // damage info
        effects: `${token.name} is entangled.  The entangle has ${body} BODY ${entangleDefense.string}. ${
            prevEntangle ? `This entangle augmented a previous ${prevBody} body entangle.` : ""
        }`,

        // misc
        attackTags: getAttackTags(item),
        targetToken: token,
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-entangle-card.hbs`;
    const cardHtml = await foundryVttRenderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: item.actor, token });
    //speaker.alias = item.actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    ChatMessage.create(chatData);
}

export async function _onApplyDamageToEntangle(attackItem, token, originalRoll, entangleAE) {
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
    if (attackItem.baseInfo?.type.includes("adjustment")) {
        ui.notifications.error(
            `An entangle (${fromUuidSync(entangleAE.origin).name || entangleAE.name}) is not a supported target for an adjustment power (${attackItem.name}).`,
        );
        return;
    }

    let defense;
    let defenseType;
    switch (attackItem?.system.class) {
        case "physical":
            defense = entangleAE.flags[game.system.id]?.entangleDefense.rPD;
            defenseType = "rPD";
            break;
        case "energy":
            defense = entangleAE.flags[game.system.id]?.entangleDefense.rED;
            defenseType = "rED";
            break;
        case "mental":
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
            entangleAE.changes[bodyChangeIdx].value = newBody;
            entangleAE.update({ changes: entangleAE.changes });
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
        targetToken: token,
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-damage-card.hbs`;
    const cardHtml = await foundryVttRenderTemplate(template, cardData);
    const speaker = ChatMessage.getSpeaker({ actor: attackItem.actor, token });
    //speaker.alias = attackItem.actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    ChatMessage.create(chatData);
}

async function _performAbsorptionForToken(token, absorptionItems, damageDetail, damageItem) {
    const attackType = damageItem.system.class; // TODO: avad?

    // Match attack against absorption type. If we match we can do some absorption.
    for (const absorptionItem of absorptionItems) {
        if (absorptionItem.system.OPTION === attackType.toUpperCase() && absorptionItem.isActive) {
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

                // `Presen`t the roll.
                const cardHtml = await absorptionRoller.render(`${attackType} attack vs ${absorptionItem.name}`);

                const speaker = ChatMessage.getSpeaker({
                    actor: actor,
                    token,
                });
                //speaker.alias = actor.name;

                const chatData = {
                    style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
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

async function _onApplyAdjustmentToSpecificToken(adjustmentItem, token, damageDetail, defense, defenseTags, action) {
    if (
        adjustmentItem.actor.id === token.actor.id &&
        ["DISPEL", "DRAIN", "SUPPRESS", "TRANSFER"].includes(adjustmentItem.system.XMLID)
    ) {
        await ui.notifications.warn(
            `${adjustmentItem.system.XMLID} attacker/source (${adjustmentItem.actor.name}) and defender/target (${token.actor.name}) are the same.`,
        );
    }

    // Where is the adjustment taking from/giving to?
    const { valid, reducesArray, enhancesArray } = adjustmentItem.splitAdjustmentSourceAndTarget();
    if (!valid && token.actor.items.filter((o) => o.type === "power").length > 0) {
        // Show a list of powers from target token
        if (game.settings.get(game.system.id, "alphaTesting")) {
            let html = "<table>";
            for (const item of token.actor.items.filter((o) => o.type === "power")) {
                html += `<tr>`;
                html += `<td><input type="checkbox" id="${item.id}" data-dtype="Boolean" /></td>`;
                html += `<td style="text-align: left"><b>${item.name}</b>: ${item.system.description}</td>`;
                html += `</tr>`;
            }
            html += `</table>`;

            const data = {
                title: `Pick power to adjust`,
                content: html,
                buttons: {
                    normal: {
                        label: "Apply",
                        callback: async function (html) {
                            return html.find("input:checked");
                        },
                    },
                    cancel: {
                        label: "Cancel",
                    },
                },
            };

            const checked = await Dialog.wait(data);
            // while (reducesArray?.length > 0) {
            //     reducesArray.pop();
            // }
            // while (enhancesArray?.length > 0) {
            //     enhancesArray.pop();
            // }
            for (const checkedElement of checked) {
                const checkedItem = token.actor.items.find((o) => o.id === checkedElement.id);
                if (reducesArray.length > 0) {
                    reducesArray.push(checkedItem.id);
                } else if (enhancesArray.length > 0) {
                    enhancesArray.push(checkedItem.id);
                }
            }
            if ((reducesArray?.length || 0) + (enhancesArray?.length || 0) === 0) {
                return ui.notifications.error(
                    `${adjustmentItem.actor.name} has an invalid adjustment sources/targets provided for ${
                        adjustmentItem.system.ALIAS || adjustmentItem.name
                    }. Compute effects manually.`,
                    { permanent: true },
                );
            } else {
                console.log(reducesArray, enhancesArray);
            }
        } else {
            return ui.notifications.error(
                `${adjustmentItem.actor.name} has an invalid adjustment sources/targets provided for ${
                    adjustmentItem.system.ALIAS || adjustmentItem.name
                }. Compute effects manually.`,
                { permanent: true },
            );
        }
    }

    const adjustmentItemTags = getAttackTags(adjustmentItem);

    const rawActivePointsEffectBeforeDefense = damageDetail.stunDamage;
    const activePointsEffectAfterDefense = damageDetail.stun;

    // DRAIN
    const reductionChatMessages = [];
    //const reductionTargetActor = token.actor;
    for (const reduce of reducesArray) {
        reductionChatMessages.push(
            await performAdjustment(
                adjustmentItem,
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
    //const enhancementTargetActor = adjustmentItem.system.XMLID === "TRANSFER" ? adjustmentItem.actor : token.actor;
    for (const enhance of enhancesArray) {
        const simplifiedHealing = adjustmentItem.system.XMLID === "HEALING" && enhance.match(/simplified/i);

        if (simplifiedHealing) {
            // STUN
            enhancementChatMessages.push(
                await performAdjustment(
                    adjustmentItem,
                    "STUN", //enhance,
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
                    adjustmentItem,
                    "BODY", //enhance,
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
                    adjustmentItem,
                    enhance,
                    adjustmentItem.system.XMLID === "TRANSFER"
                        ? activePointsEffectAfterDefense
                        : simplifiedHealing && enhance === "BODY"
                          ? damageDetail.bodyDamage
                          : rawActivePointsEffectBeforeDefense,
                    "None - Beneficial",
                    "",
                    false,
                    adjustmentItem.system.XMLID !== "TRANSFER"
                        ? token
                        : adjustmentItem.actor
                              .getActiveTokens()
                              ?.find((t) => t.id === action?.current?.attackerTokenId) ||
                              adjustmentItem.actor.getActiveTokens?.[0],
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

async function _onApplySenseAffectingToSpecificToken(senseAffectingItem, token, damageData) {
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
    const targetGroups = [senseAffectingItem.system.OPTIONID || senseAffectingItem.system.INPUT];
    targetGroups.push(...senseAffectingItem.adders.map((a) => a.XMLID));
    for (const adder of targetGroups) {
        let adder2 = adder;

        // Martial Flash MANEUVER is for the entire GROUP
        if (senseAffectingItem.system.XMLID === "MANEUVER") {
            adder2 =
                senseGroups.find((o) => o.XMLID.match(new RegExp(senseAffectingItem.system.INPUT, "i")))?.XMLID ||
                adder2;
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
            senseGroup.bodyDamage = damageData.bodyDamage;
        } else {
            console.warn(`Unable to find senseGroup ${adder2}`);
        }
    }

    // FLASHDEFENSE
    for (const flashDefense of token.actor.items.filter((o) => o.system.XMLID === "FLASHDEFENSE" && o.isActive)) {
        if (
            senseAffectingItem.system.OPTIONID === flashDefense.system.OPTIONID ||
            flashDefense.system.OPTIONID.includes(senseAffectingItem.system.INPUT?.toUpperCase())
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

    // Create new ActiveEffects
    for (const senseGroup of senseGroups) {
        if (senseGroup.bodyDamage > 0) {
            token.actor.addActiveEffect({
                ...senseGroup.statusEffect,
                name: `${senseAffectingItem.system.XMLID.replace("MANEUVER", senseAffectingItem.system.ALIAS)} ${senseGroup.XMLID} ${
                    senseGroup.bodyDamage
                } segments remaining [${senseAffectingItem.actor.name}]`,
                duration: {
                    seconds: senseGroup.bodyDamage,
                },
                flags: {
                    [game.system.id]: {
                        bodyDamage: senseGroup.bodyDamage,
                        XMLID: senseAffectingItem.system.XMLID,
                        source: senseAffectingItem.actor.name,
                        expiresOn: "segmentEnd",
                    },
                },
                origin: senseAffectingItem.uuid,
            });
        }
    }

    const cardData = {
        item: senseAffectingItem,
        senseGroups: senseGroups.filter((sg) => sg.defenseItems || sg.bodyDamage > 0),

        // body
        damageData,

        // misc
        targetToken: token,
        tags: defenseTags,
        attackTags: getAttackTags(senseAffectingItem),
    };

    // render card
    const template = `systems/${HEROSYS.module}/templates/chat/apply-sense-affecting-card.hbs`;
    const cardHtml = await foundryVttRenderTemplate(template, cardData);
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
    const itemData = item.system;

    const isAdjustment = !!getPowerInfo({
        item: item,
    })?.type?.includes("adjustment");
    const isSenseAffectingPower = item.isSenseAffecting();
    const isEntangle = item.system.XMLID === "ENTANGLE";
    const isBodyBasedEffectRollItem = isBodyBasedEffectRoll(item);
    const isStunBasedEffectRollItem = isStunBasedEffectRoll(item);

    let body;
    let stun;
    let effect = 0;
    let bodyForPenetrating = 0;
    let effects = "";

    if (isAdjustment) {
        // kludge for SIMPLIFIED HEALING
        if (item.system.XMLID === "HEALING" && item.system.INPUT.match(/simplified/i)) {
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
        if (item.doesKillingDamage) {
            bodyForPenetrating = (
                await damageRoller.cloneWhileModifyingType(HeroRoller.ROLL_TYPE.NORMAL)
            ).getBodyTotal();
        } else {
            bodyForPenetrating = body;
        }

        // Knocked out targets take double STUN damage from attacks
        const targetActor = (game.scenes.current.tokens.get(options.targetTokenId) || options.targetToken)?.actor;
        if (targetActor?.statuses.has("knockedOut")) {
            const preStun = stun;
            stun *= 2;
            effects += `Knocked Out x2 STUN (${preStun}x2=${stun});`;
        }
    }

    const noHitLocationsPower = !!item.system.noHitLocations;
    const useHitLocations = game.settings.get(HEROSYS.module, "hit locations") && !noHitLocationsPower;
    const hasStunMultiplierRoll = item.doesKillingDamage && !useHitLocations;

    const stunMultiplier = hasStunMultiplierRoll ? damageRoller.getStunMultiplier() : 1;

    // TODO: FIXME: This calculation is buggy as it doesn't consider:
    //       multiple levels of penetrating vs hardened/impenetrable
    //       or the fact that there is no impenetrable in 5e which uses hardened instead.
    // Penetrating
    const penetratingBody = item.system.penetrating
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

    if (item.system.EFFECT) {
        effects += `${item.system._effect || item.system.EFFECT}; `;
    }

    // VULNERABILITY
    if (options.vulnStunMultiplier) {
        const preStun = stun;
        stun = Math.floor(stun * options.vulnStunMultiplier);
        effects += `${options.VulnDesc.join("/")} x${options.vulnStunMultiplier} STUN (${preStun}x${options.vulnStunMultiplier}=${stun});`;
    }
    if (options.vulnBodyMultiplier) {
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
    let REDUCEDPENETRATION = item.findModsByXmlid("REDUCEDPENETRATION");
    if (REDUCEDPENETRATION) {
        if (item.doesKillingDamage) {
            body = Math.max(0, body - (options.resistantValue || 0));
        }
        body = Math.max(0, body - (options.defenseValue || 0));
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
    } = await _calcKnockback(body, item, options, itemData.knockbackMultiplier);

    // -------------------------------------------------
    // determine effective damage
    // -------------------------------------------------
    if (item.doesKillingDamage) {
        stun = stun - (options.defenseValue || 0) - (options.resistantValue || 0);
        body = body - (options.resistantValue || 0);
    } else {
        stun = stun - (options.defenseValue || 0) - (options.resistantValue || 0);
        body = body - (options.defenseValue || 0) - (options.resistantValue || 0);
    }

    stun = RoundFavorPlayerDown(stun < 0 ? 0 : stun);
    body = RoundFavorPlayerDown(body < 0 ? 0 : body);

    let hitLocText = "";
    if (useHitLocations) {
        const hitLocationBodyMultiplier = damageRoller.getHitLocation().bodyMultiplier;
        const hitLocationStunMultiplier = damageRoller.getHitLocation().stunMultiplier;

        if (item.doesKillingDamage) {
            // Killing attacks apply hit location multiplier after resistant damage protection has been subtracted
            // Location : [x Stun, x N Stun, x Body, OCV modifier]
            body = RoundFavorPlayerDown(body * hitLocationBodyMultiplier);
        } else {
            // stun attacks apply N STUN hit location and BODY multiplier after defenses have been subtracted
            stun = RoundFavorPlayerDown(stun * hitLocationStunMultiplier);
            body = RoundFavorPlayerDown(body * hitLocationBodyMultiplier);
        }
        if (damageRoller.getHitLocation().item || damageRoller.getHitLocation().activeEffect) {
            hitLocText = `Hit ${hitLocation}`;
        } else {
            hitLocText = `Hit ${hitLocation} (x${hitLocationBodyMultiplier} BODY x${hitLocationStunMultiplier} STUN)`;
        }
    }

    // apply damage reduction
    if (options.damageReductionValue > 0) {
        stun = RoundFavorPlayerDown(stun * (1 - options.damageReductionValue / 100));
        body = RoundFavorPlayerDown(body * (1 - options.damageReductionValue / 100));
    }

    // Penetrating attack minimum damage
    if (item.doesKillingDamage && penetratingBody > body) {
        body = penetratingBody;
        effects += "penetrating damage; ";
    } else if (!item.doesKillingDamage && penetratingBody > stun) {
        stun = penetratingBody;
        effects += "penetrating damage; ";
    }

    // minimum damage rule (needs to be last)
    if (stun < body && !isSenseAffectingPower) {
        stun = body;
        effects +=
            `minimum damage invoked <i class="fal fa-circle-info" data-tooltip="` +
            `<b>MINIMUM DAMAGE FROM INJURIES</b><br>` +
            `Characters take at least 1 STUN for every 1 point of BODY
                 damage that gets through their defenses.` +
            `"></i>; `;
    }

    // Special effects that change damage?
    if (item.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.stunonly) {
        body = 0;
    } else if (item.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.bodyonly) {
        stun = 0;
    } else if (item.system.stunBodyDamage === CONFIG.HERO.stunBodyDamages.effectonly) {
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

    stun = RoundFavorPlayerDown(stun);
    body = RoundFavorPlayerDown(body);

    damageDetail.body = body;
    damageDetail.stun = stun;
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

    return damageDetail;
}

async function _calcKnockback(body, item, options, knockbackMultiplier) {
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

    if (game.settings.get(HEROSYS.module, "knockback") && knockbackMultiplier && !isBase) {
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

        // TODO: Target Rolled With A Punch -1d6
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
        if (item.doesKillingDamage) {
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

        // Calculate the knockback considering:
        // - the knockback multiplier is a calculation to the attacker's advantage (so round up)
        knockbackRoller = new HeroRoller()
            .setPurpose(DICE_SO_NICE_CUSTOM_SETS.KNOCKBACK)
            .makeBasicRoll()
            .addNumber(
                RoundFavorPlayerUp(body * (knockbackMultiplier > 1 ? knockbackMultiplier : 1)),
                "Max potential knockback",
            )
            .addNumber(-parseInt(knockbackResistanceValue), "Knockback resistance")
            .addDice(-Math.max(0, knockbackDice));
        await knockbackRoller.roll();

        knockbackResultTotal = Math.round(knockbackRoller.getBasicTotal());

        knockbackRenderedResult = await knockbackRoller.render();

        // SHRINKING
        if (actor) {
            for (const shrinkItem of actor.items.filter((i) => i.system.XMLID === "SHRINKING" && i.isActive)) {
                console.log(shrinkItem, shrinkItem.baseInfo);
                shrinkingKB += (parseInt(shrinkItem.system.LEVELS) || 0) * 3;
            }
        }

        if (knockbackResultTotal + shrinkingKB < 0) {
            knockbackMessage = "No Knockback";
        } else if (knockbackResultTotal + shrinkingKB == 0) {
            knockbackMessage = "Inflicts Knockdown";
            await actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.proneEffect.id, {
                active: true,
            });
        } else {
            // If the result is positive, the target is Knocked Back 1" or 2m times the result
            knockbackMessage = `Knocked Back ${
                (knockbackResultTotal + shrinkingKB) * (item.actor?.system.is5e || item.system.is5e ? 1 : 2)
            }${getSystemDisplayUnits(item.actor?.is5e || item.system.is5e)}`;
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
    };
}

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
    if (useResources && resourcesRequired.totalEnd > actorEndurance) {
        // Automation or other actor without STUN?
        const hasSTUN = getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "STUN");
        if (!hasSTUN) {
            return {
                error: `${item.detailedName()} needs ${resourcesRequired.totalEnd} END but ${actor.name} only has ${actorEndurance} END. This actor cannot use STUN for END`,
            };
        }

        // Is the actor willing to use STUN to make up for the lack of END?
        const potentialStunCost = calculateRequiredStunDiceForLackOfEnd(actor, resourcesRequired.totalEnd);

        if (!options.forceStunUsage) {
            const confirmed = await Dialog.confirm({
                title: "USING STUN FOR ENDURANCE",
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
                const startingCharges = parseInt(usage.item.system.charges?.value || 0);

                return usage.charges > startingCharges;
            })
            .filter((resource) => resource.charges > 0);
        const errorItemList = chargeUsingItemsWithInsufficientCharges.reduce(
            (error, current) =>
                error +
                `${error ? " " : ""}${current.item.detailedName()} does not have ${current.charges} charge${
                    current.charges > 1 ? "s" : ""
                } remaining`,
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
    const startingCharges = parseInt(item.system.charges?.value || 0);
    const maximumCharges = item.system.charges?.max || 0;
    let chargesToUse = 0;

    // Does this item use charges?
    if (maximumCharges > 0) {
        // Maximum of 4
        const boostableChargesUsed = clamp(boostableChargesToUse, 0, Math.min(startingCharges - 1, 4));
        chargesToUse = 1 + boostableChargesUsed;
    }

    // How many applications?
    const autofire = item.findModsByXmlid("AUTOFIRE");
    const multipleApplications = autofire ? parseInt(autofire.OPTION_ALIAS.match(/\d+/)) : 1;
    chargesToUse *= multipleApplications || 1;

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

        // Pushing uses 1 END per pushed CP
        const endPerShot = (item.end || 0) + (item.system._active.pushedRealPoints || 0);

        // How many applications?
        const autofire = item.findModsByXmlid("AUTOFIRE");
        const multipleApplications = autofire ? parseInt(autofire.OPTION_ALIAS.match(/\d+/)) : 0;
        endToUse = endPerShot * (multipleApplications || 1);
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

        // Pushing uses 1 END per pushed CP
        const endPerShot = (item.end || 0) + (item.system._active.pushedRealPoints || 0);

        // How many applications?
        const autofire = item.findModsByXmlid("AUTOFIRE");
        const multipleApplications = autofire ? parseInt(autofire.OPTION_ALIAS.match(/\d+/)) : 0;
        reserveEndToUse = endPerShot * (multipleApplications || 1);
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
                    const startingCharges = parseInt(usage.item.system.charges?.value || 0);

                    await item.update({ "system.charges.value": startingCharges - chargesToSpend });
                }
            });
    }

    let resourcesUsedDescription = "";
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

    const data = {
        title: `Modal Damage`,
        content,
        buttons: {
            cancel: {
                label: "Close",
            },
        },
        default: "Cancel",
        render: (html) => {
            this.chatListeners(html);
        },
        //close: () => resolve({ cancelled: true }),
    };
    const d = new Dialog(data, { form: { closeOnSubmit: false } });
    await d.render(true);
}

/**
 * Given information, find the best guess for the token in the scene which we should use.
 *
 * NOTE: Typically we want the token that is making an attack or receiving the attack so that we can
 *       make distance calculations.
 *
 * @param {Object} options
 * @param {action} options.action
 * @param {HeroSystem6eActor} options.actor
 * @param {Token | TokenDocument} options.token
 * @param {string} options.tokenId we should really get rid of this.
 *
 * @returns {Token | TokenDocument}
 */
export function getTokenEducatedGuess(options = {}) {
    // NOTE: This is a catch in case we've done something stupid as FoundryVTT has 3 types of tokens.
    const isPrototypeToken = options.token instanceof foundry.data.PrototypeToken;
    if (isPrototypeToken) {
        console.error("Ignoring provided PrototypeToken");
        delete options.token;
    }

    // If we passed in a Token or TokenDocument, consider it authorative
    if (options.token) {
        return options.token;
    }

    // action will be our next best bet, although tokenId is pretty good too
    // if (!options.action && !options.tokenId) {
    //     console.warn(`Unable to find action in getTokenEducatedGuess`);
    // }

    const actor = options.actor ?? options.action?.current.actor;
    const tokenId = options.action?.current.attackerTokenId ?? options.tokenId ?? "";
    const scene = game.scenes.current;
    const token =
        scene.tokens.get(tokenId) ||
        actor?.getActiveTokens().find((t) => canvas.tokens.controlled.find((c) => c.id === t.id)) ||
        actor?.getActiveTokens()[0];
    if (!token) {
        if (actor.id) {
            console.warn(`Unable to find token for ${actor.name}`);
        } else {
            console.log(`${actor.name} has no id, likely a temporary actor. No associated token is expected.`);
        }
    }
    return token;
}
