import { HEROSYS } from "../herosystem6e.mjs";
import { AttackAction } from "../utility/attack-action.mjs";
import { calculateDistanceBetween } from "../utility/range.mjs";
import { HeroRoller } from "../utility/dice.mjs";
import { addRangeIntoToHitRoll } from "./item-attack.mjs";

// v13 compatibility
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;

export class ItemAttackV2 {
    static chatListeners(_html) {
        const html = $(_html); // v13 compatibility
        html.on("click", `button[data-action="place-template"]`, this._onPlaceTemplate.bind(this));
        html.on("click", `button[data-action="remove-template"]`, this._onRemoveTemplate.bind(this));
        html.on("click", `button[data-action="roll-template-placement"]`, this._onRollTemplatePlacement.bind(this));
    }

    static async processActionToHitV2(attackAction) {
        //attackAction.targetTokens = Array.from(game.user.targets).map((t) => t.id);

        // Can haymaker anything except for maneuvers because it is a maneuver itself. The strike manuever is the 1 exception.
        // const haymakerManeuverActive = attackAction.actor?.items.find(
        //     (anItem) => anItem.isCombatManeuver && anItem.system.XMLID === "HAYMAKER" && anItem.isActive,
        // );
        // if (haymakerManeuverActive) {
        //     if (
        //         attackAction.effectiveItem.isMartialManeuver ||
        //         (attackAction.effectiveItem.isCombatManeuver && attackAction.effectiveItem.system.XMLID !== "STRIKE")
        //     ) {
        //         return ui.notifications.warn("Haymaker cannot be combined with another maneuver except Strike.", {
        //             localize: true,
        //         });
        //     }
        // }

        await this.allInOneV2(attackAction);
    }

    static async allInOneV2(attackAction) {
        if (!attackAction) {
            new Error("attackAction not defined");
        }

        const aoe = attackAction.effectiveItem.aoeAttackParameters;
        if (aoe) {
            attackAction.stages["TEMPLATE_PLACEMENT_ROLL"].heroRoller = this.newHeroRollerForAttackAction(
                attackAction,
            ).addNumber(aoe.templatePlacementRollBonus, "Template placement roll bonus");
        } else {
            attackAction.stages["TEMPLATE_PLACEMENT_ROLL"].complete = true;
        }

        const cardData = {
            attackAction,
        };
        const template = `systems/${HEROSYS.module}/templates/chat/item-attack-allinone-card-v2.hbs`;
        const cardHtml = await foundryVttRenderTemplate(template, cardData);

        const chatData = {
            style: CONFIG?.HERO?.CHAT_MESSAGE_DEFAULT_STYLE ?? CONST.CHAT_MESSAGE_STYLES.OOC,
            author: game.user._id,
            content: cardHtml,
            speaker: ChatMessage.getSpeaker({ actor: attackAction.actor, token: attackAction.attackerToken }),
        };

        const message = await ChatMessage.create(chatData);

        // For convenience, doesn't seem necessary
        attackAction.messageId = message.id;
        //await attackAction.saveToMessage();
    }

    static getAttackActionFromDomObject(target) {
        // Get attackAction
        const attackActionJson = target.closest("[data-attack-action]")?.dataset?.attackAction;
        if (!attackActionJson) {
            throw new Error("missing attackAction");
        }
        return AttackAction.fromJSON(attackActionJson);
    }

    static async _onPlaceTemplate(event) {
        // Remove any previous tempaltes
        // AUTOFIRE? May not want to remove template.
        // Some way to keep track of the number of valid templates for this attack.
        await this._onRemoveTemplate(event);

        // Get attackAction
        const attackAction = this.getAttackActionFromDomObject(event.target);

        // Get message
        const messageId = event.target.closest(`li[data-message-id]`).dataset.messageId;
        const message = ChatMessage.get(messageId);

        // Place template preview on canvas
        await attackAction.effectiveItem.placeTemplate(message);
    }

    static async _onRemoveTemplate(event) {
        const messageId = event.target.closest(`li[data-message-id]`).dataset.messageId;
        const templateIds =
            canvas.scene?.templates.filter((t) => t.flags[game.system.id]?.messageId === messageId).map((t) => t.id) ??
            [];
        //button.disabled = true;
        await canvas.scene?.deleteEmbeddedDocuments("MeasuredTemplate", templateIds);
        //button.disabled = false;
        return;
    }

    static async _onRollTemplatePlacement(event) {
        const messageId = event.target.closest(`li[data-message-id]`).dataset.messageId;
        const templateIds =
            canvas.scene?.templates.filter((t) => t.flags[game.system.id]?.messageId === messageId).map((t) => t.id) ??
            [];
        if (templateIds.length === 0) {
            throw new Error("No template found");
        }
        if (templateIds.length > 1) {
            throw new Error("Multiple templates not supported");
        }

        // Get attackAction
        const attackAction = this.getAttackActionFromDomObject(event.target);

        const distance = calculateDistanceBetween(attackAction.placedAoeTemplate, attackAction.attackerToken).distance;
        //const dcvTargetNumber = distance > (attackAction.actor.is5e ? 1 : 2) ? 3 : 0;

        const hitCharacteristic = attackAction.actor.system.characteristics.ocv.value;

        const attackHeroRoller = new HeroRoller()
            .makeSuccessRoll()
            .addNumber(11, "Base to hit")
            .addNumber(hitCharacteristic, attackAction.effectiveItem.system.attacksWith);

        // Range modifiers
        addRangeIntoToHitRoll(distance, attackAction.effectiveItem, attackAction.actor, attackHeroRoller);

        // Combat Skill Levels (need new version to use attackAction)
        //await addAttackCslsIntoToHitRoll({}, attackHeroRoller, attackAction.effectiveItem);

        // This is the actual roll to hit. In order to provide for a die roll
        // that indicates the upper bound of DCV hit, we have added the base (11) and the OCV, and subtracted the mods
        // and lastly we subtract the die roll. The value returned is the maximum DCV hit
        // (so we can be sneaky and not tell the target's DCV out loud).
        attackHeroRoller.addDice(-3);
        await attackHeroRoller.roll();
        ui.notifications.info(`Template placement roll: ${attackHeroRoller.getBaseTotal()}`, {});
        throw new Error("Template placement unimplemented");
    }

    static newHeroRollerForAttackAction(attackAction) {
        const hitCharacteristic = attackAction.actor.system.characteristics.ocv.value;

        return new HeroRoller()
            .makeSuccessRoll()
            .addNumber(11, "Base to hit")
            .addNumber(hitCharacteristic, attackAction.effectiveItem.system.attacksWith);

        // TODO - add range modifiers, CSLs, and other modifiers that would apply to the template placement roll, which may be different from the to hit roll depending on the attack.
    }
}
