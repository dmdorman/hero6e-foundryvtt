import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";
import * as Attack from "../item/item-attack.mjs";
import { createSkillPopOutFromItem } from "../item/skill.mjs";
import { enforceManeuverLimits } from "../item/manuever.mjs";
import {
    adjustmentSourcesPermissive,
    adjustmentSourcesStrict,
    determineMaxAdjustment,
} from "../utility/adjustment.mjs";
import { onActiveEffectToggle } from "../utility/effects.mjs";
import { getPowerInfo, getModifierInfo, whisperUserTargetsForActor } from "../utility/util.mjs";
import { RoundFavorPlayerDown, RoundFavorPlayerUp } from "../utility/round.mjs";
import { convertToDcFromItem, getDiceFormulaFromItemDC, CombatSkillLevelsForAttack } from "../utility/damage.mjs";
import { getSystemDisplayUnits } from "../utility/units.mjs";
import { calculateVelocityInSystemUnits } from "../ruler.mjs";
import { HeroRoller } from "../utility/dice.mjs";
import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";

export function initializeItemHandlebarsHelpers() {
    Handlebars.registerHelper("itemFullDescription", itemFullDescription);
    Handlebars.registerHelper("itemName", itemName);
    Handlebars.registerHelper("itemIsManeuver", itemIsManeuver);
    Handlebars.registerHelper("itemIsOptionalManeuver", itemIsOptionalManeuver);
    Handlebars.registerHelper("filterItem", filterItem);
    // Handlebars.registerHelper("parentItem", parentItem);
    // Handlebars.registerHelper("parentItemType", parentItemType);
}

// Returns HTML so expects to not escaped in handlebars (i.e. triple braces)
function itemFullDescription(item) {
    let desc = item.system.description;
    if (item.system.NAME) {
        desc = `<i>${item.system.NAME}:</i> ${item.system.description}`;
    }

    if (item.system.NOTES) {
        desc += `<br><b>Notes:</b> ${item.system.NOTES}`;
    }

    return desc;
}

// Returns HTML so expects to not escaped in handlebars (i.e. triple braces)
function itemName(item) {
    try {
        if (item.system.NAME) {
            return `<i>${item.system.NAME}</i>`;
        }

        return item.name;
    } catch (e) {
        // This should not happen, but one of the test tokens (Venin Vert had this issue).
        // Possibly due to testing that caused failed initialization of an item.
        // Possibly the item was null due to an effect source that is no longer available.
        console.error(e);
        return "<i>undefined</i>";
    }
}

function itemIsManeuver(item) {
    return item.type === "maneuver";
}

function itemIsOptionalManeuver(item) {
    return itemIsManeuver(item) && !!getPowerInfo({ item: item })?.behaviors.includes("optional-maneuver");
}

function filterItem(item, filterString) {
    if (!filterString) return item;

    if (
        item.name.toLowerCase().includes(filterString.toLowerCase()) ||
        (item.system.description && item.system.description.toLowerCase().includes(filterString.toLowerCase())) ||
        (item.system.XMLID && item.system.XMLID.toLowerCase().includes(filterString.toLowerCase()))
    ) {
        return item;
    }
}

// function parentItem(item) {
//     return item.getHdcParent();
// }

// function parentItemType(item, type) {
//     const parent = parentItem(item);

//     return parent?.system.type === type;
// }

const itemTypeToIcon = {
    attack: "icons/svg/sword.svg",
    movement: "icons/svg/pawprint.svg",
    skill: "icons/svg/hanging-sign.svg",
    defense: "icons/svg/shield.svg",
    power: "icons/svg/aura.svg",
    maneuver: "icons/svg/upgrade.svg",
    martialart: "icons/svg/downgrade.svg",
};

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class HeroSystem6eItem extends Item {
    static async chatListeners(html) {
        html.on("click", ".roll-damage", this.__onChatCardAction.bind(this));
    }

    // Perform preliminary operations before a Document of this type is created. Pre-creation operations only
    // occur for the client which requested the operation. Modifications to the pending document before it is
    // persisted should be performed with this.updateSource().
    async _preCreate(data, options, userId) {
        await super._preCreate(data, options, userId);

        // assign a default image
        if (!data.img || data.img === "icons/svg/item-bag.svg") {
            if (this.system.XMLID === "COMPOUNDPOWER") {
                return this.updateSource({ img: "icons/svg/chest.svg" });
            }
            if (this.system.XMLID === "MULTIPOWER") {
                return this.updateSource({ img: "icons/svg/chest.svg" });
            }
            if (this.baseInfo?.type.includes("enhancer")) {
                return this.updateSource({ img: "icons/svg/chest.svg" });
            }
            if (this.baseInfo?.type.includes("framework")) {
                return this.updateSource({ img: "icons/svg/chest.svg" });
            }
            if (itemTypeToIcon[this.type]) {
                this.updateSource({ img: itemTypeToIcon[this.type] });
            }
        }
    }

    async _onCreate(data, options, userId) {
        // If this is an ITEMS pack then override default name
        if (this.pack && this.name.match(/New Item \(\d+\)/)) {
            const myPack = game.packs.get(this.pack);
            await myPack.getIndex();
            const count = myPack.index.size;
            await this.update({
                name: `New ${String(data.type).titleCase()} (${count})`,
            });
        }
        super._onCreate(data, options, userId);
    }

    /**
     * Augment the basic Item data model with additional dynamic data.
     */

    prepareData() {
        super.prepareData();
    }

    async _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);

        // If our value has changed, we need to rebuild this item.
        if (changed.system?.value != null) {
            // TODO: Update everything!
            changed = this.calcItemPoints() || changed;

            // DESCRIPTION
            const oldDescription = this.system.description;
            this.updateItemDescription();
            changed = oldDescription !== this.system.description || changed;

            // Save changes
            await this.update({ system: this.system });
        }

        if (this.actor && this.type === "equipment") {
            this.actor.applyEncumbrancePenalty();
        }
    }

    /**
     * Reset an item back to its default state.
     */
    async resetToOriginal() {
        // Set Charges to max
        if (this.system.charges && this.system.charges.value !== this.system.charges.max) {
            await this.update({
                [`system.charges.value`]: this.system.charges.max,
            });
            await this._postUpload();
        }

        // Remove temporary effects
        const temporaryEffectPromises = Promise.all(
            this.effects.map(async (effect) => {
                if (parseInt(effect.duration?.seconds || 0) > 0) {
                    await effect.delete();
                }
            }),
        );

        await temporaryEffectPromises;

        if (this.system.value !== this.system.max) {
            await this.update({ ["system.value"]: this.system.max });
        }

        if (this.type === "maneuver" && this.system.active) {
            await this.update({ ["system.active"]: false });
        }
    }

    // Largely used to determine if we can drag to hotbar
    isRollable() {
        switch (this.system?.subType || this.type) {
            case "attack":
                return true;
            case "skill":
                return true;
            case "defense":
                return true;
        }

        return getPowerInfo({ item: this })?.behaviors.includes("success") ? true : false;
    }

    hasSuccessRoll() {
        const powerInfo = getPowerInfo({
            item: this,
        });
        return (
            powerInfo?.behaviors.includes("success") ||
            (this.system.XMLID === "CUSTOMSKILL" && parseInt(this.system.ROLL) > 0)
        );
    }

    async roll(event) {
        if (!this.actor.canAct(true)) return;

        // TODO: Convert to behaviors when powers are fully updated
        switch (this.system.subType || this.type) {
            case "attack":
                switch (this.system.XMLID) {
                    case "HKA":
                    case "RKA":
                    case "ENERGYBLAST":
                    case "HANDTOHANDATTACK":
                    case "TELEKINESIS":
                    case "EGOATTACK":
                    case "AID":
                    case "DRAIN":
                    case "HEALING":
                    case "SUCCOR":
                    case "TRANSFER":
                    case "FLASH":
                    case "BLOCK":
                    case "DODGE":
                    case "HAYMAKER":
                    case "SET":
                    case "STRIKE":
                    case "MINDSCAN":
                    case "TRANSFORM":
                        return Attack.AttackOptions(this, event);

                    case "ABSORPTION":
                    case "DISPEL":
                    case "SUPPRESS":
                    case "BLAZINGAWAY":
                    case "BRACE":
                    case "CHOKE":
                    case "CLUBWEAPON":
                    case "COVER":
                    case "DISARM":
                    case "DIVEFORCOVER":
                    case "GRAB":
                    case "GRABBY":
                    case "HIPSHOT":
                    case "HURRY":
                    case "MOVEBY":
                    case "MOVETHROUGH":
                    case "MULTIPLEATTACK":
                    case "OTHERATTACKS":
                    case "PULLINGAPUNCH":
                    case "RAPIDFIRE":
                    case "ROLLWITHAPUNCH":
                    case "SETANDBRACE":
                    case "SHOVE":
                    case "SNAPSHOT":
                    case "STRAFE":
                    case "SUPPRESSIONFIRE":
                    case "SWEEP":
                    case "THROW":
                    case "TRIP":
                    default:
                        ui.notifications.warn(`${this.system.XMLID} roll is not fully supported`);
                        return Attack.AttackOptions(this, event);
                }

            case "defense":
                return this.toggle();

            case "skill":
            default: {
                const powerInfo = getPowerInfo({
                    item: this,
                });
                const hasSuccessRoll = this.hasSuccessRoll();
                const isSkill = powerInfo?.type.includes("skill");

                if (hasSuccessRoll && isSkill) {
                    this.updateRoll();
                    if (!(await RequiresASkillRollCheck(this))) return;
                    return createSkillPopOutFromItem(this, this.actor);
                } else if (hasSuccessRoll) {
                    // Handle any type of non skill based success roll with a basic roll
                    // TODO: Basic roll.
                    this.updateRoll();
                    return createSkillPopOutFromItem(this, this.actor);
                } else {
                    ui.notifications.warn(`${this.name} roll (${hasSuccessRoll}/${isSkill}) is not supported`);
                }
            }
        }
    }

    async chat() {
        this.updateItemDescription();

        let content = `<div class="item-chat">`;

        // Part of a framework (is there a PARENTID?)
        if (this.parentItem?.parentItem) {
            const _parentItem = this.parentItem.parentItem;
            content += `<p><b>${_parentItem.name}</b>`;
            if (_parentItem.system.description && _parentItem.system.description != parent.name) {
                content += ` ${_parentItem.system.description}`;
            }
            content += ".</p>";
        }
        if (this.parentItem) {
            const _parentItem = this.parentItem;
            content += `<p><b>${_parentItem.name}</b>`;
            if (_parentItem.system.description && _parentItem.system.description != parent.name) {
                content += ` ${_parentItem.system.description}`;
            }
            content += ".</p>";
        }
        content += `<b>${this.name}`;
        if (this.name.toUpperCase().replace(/ /g, "") != this.system.XMLID.toUpperCase().replace(/_/g, "")) {
            content += ` <i>[${this.system.XMLID}]</i> `;
        }
        content += `</b>`;

        content += ` ${this.system.description}.`;

        // Powers have one of four Ranges: Self; No Range; Standard
        // Range; and Line of Sight (LOS).
        const configPowerInfo = getPowerInfo({ item: this });
        if (typeof this.baseInfo?.rangeText === "function") {
            content += ` ${this.baseInfo.rangeText(this)}${getSystemDisplayUnits(this.is5e)}.`;
        } else {
            switch (this.system.range) {
                case CONFIG.HERO.RANGE_TYPES.SELF: {
                    if (!configPowerInfo?.type.includes("skill")) {
                        content += " Self.";
                    }

                    break;
                }

                case CONFIG.HERO.RANGE_TYPES.NO_RANGE:
                    content += " No Range.";
                    break;

                case CONFIG.HERO.RANGE_TYPES.LIMITED_RANGE:
                    {
                        let range = this.system.basePointsPlusAdders * 10;
                        if (this.actor?.system?.is5e) {
                            range = Math.floor(range / 2); // TODO: Should this not be rounded in the player's favour?
                        }
                        content += ` GM Determined Maximum Range (much less than ${range}${getSystemDisplayUnits(
                            this.is5e,
                        )}).`;
                    }
                    break;

                case CONFIG.HERO.RANGE_TYPES.RANGE_BASED_ON_STR:
                    {
                        const runningThrow = this.actor?.strDetails().strThrow;
                        content += ` Maximum Range (running throw based on STR) ${runningThrow}${getSystemDisplayUnits(
                            this.is5e,
                        )}.`;
                    }
                    break;

                case CONFIG.HERO.RANGE_TYPES.STANDARD:
                    {
                        let range = this.system.basePointsPlusAdders * 10;
                        if (this.actor?.system?.is5e) {
                            range = Math.floor(range / 2); // TODO: Should this not be rounded in the player's favour?
                        }
                        content += ` Maximum Range ${range}${getSystemDisplayUnits(this.is5e)}.`;
                    }
                    break;

                case CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT:
                    content += " Line of Sight.";
                    break;

                default:
                    console.error("Unhandled range", configPowerInfo);
                    if (configPowerInfo?.range?.toLowerCase()) {
                        content += ` ${configPowerInfo?.range?.toLowerCase()}`;
                    }
                    break;
            }
        }

        if (this.system.end) {
            content += ` Estimated End: ${this.system.end}.`;
        }

        if (this.system.realCost && !isNaN(this.system.realCost)) {
            content += ` Total Cost: ${this.system.realCost} CP.`;
        }

        if (this.system.NOTES) {
            content += `<br><b>Notes:</b> ${this.system.NOTES}`;
        }

        content += `</div>`;

        const chatData = {
            user: game.user._id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            type: CONST.CHAT_MESSAGE_TYPES.ChatMessage,
            content: content,
            //speaker: speaker
        };
        ChatMessage.create(chatData);
    }

    async toggle(event) {
        let item = this;

        if (!item.system.active) {
            if (!this.actor.canAct(true)) {
                return;
            }

            // Spend END to toggle power on
            let end = parseInt(this.system.end);
            let value = parseInt(this.actor.system.characteristics.end.value);
            if (end > value) {
                if (event?.ctrlKey) {
                    ui.notifications.info(`${game.user.name} used CTRL key to force <b>${this.name}</b> on.`);
                } else {
                    ui.notifications.error(
                        `Unable to active ${this.name}.  ${item.actor.name} has ${value} END.  Power requires ${end} END to activate.  Hold CTRL to force.`,
                    );
                    return;
                }
            }

            // Only spend the END if we are in combat.
            if (this.actor.inCombat && end) {
                await item.actor.update({
                    "system.characteristics.end.value": value - end,
                });

                const speaker = ChatMessage.getSpeaker({ actor: item.actor });
                speaker["alias"] = item.actor.name;
                const chatData = {
                    user: game.user._id,
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                    content: `Spent ${end} END to activate ${item.name}`,
                    whisper: whisperUserTargetsForActor(item.actor),
                    speaker,
                };
                await ChatMessage.create(chatData);
            } else {
                const speaker = ChatMessage.getSpeaker({ actor: item.actor });
                speaker["alias"] = item.actor.name;
                const chatData = {
                    user: game.user._id,
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                    content: `Activated ${item.name}`,
                    whisper: whisperUserTargetsForActor(item.actor),
                    speaker,
                };
                await ChatMessage.create(chatData);
            }

            const success = await RequiresASkillRollCheck(this, event);
            if (!success) {
                return;
            }

            // Invisibility status effect for SIGHTGROUP?
            if (this.system.XMLID === "INVISIBILITY") {
                if (this.system.OPTIONID === "SIGHTGROUP" && !this.actor.statuses.has("invisible")) {
                    this.actor.addActiveEffect(HeroSystem6eActorActiveEffects.invisibleEffect);
                }
            }
        } else {
            // Let GM know power was deactivated
            const speaker = ChatMessage.getSpeaker({ actor: item.actor });
            speaker["alias"] = item.actor.name;
            const chatData = {
                user: game.user._id,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                content: `Turned off ${item.name}`,
                whisper: whisperUserTargetsForActor(item.actor),
                speaker,
            };
            await ChatMessage.create(chatData);

            // Remove Invisibility status effect
            if (this.system.XMLID === "INVISIBILITY") {
                if (this.actor.statuses.has("invisible")) {
                    await this.actor.removeActiveEffect(HeroSystem6eActorActiveEffects.invisibleEffect);
                }
            }
        }

        const attr = "system.active";
        const newValue = !foundry.utils.getProperty(item, attr);
        const firstAE = item.effects.contents[0];

        switch (this.type) {
            case "defense":
                await item.update({ [attr]: newValue });
                break;

            case "power":
            case "equipment":
                {
                    // Is this a defense power?  If so toggle active state
                    const configPowerInfo = item.baseInfo;
                    if (
                        (configPowerInfo && configPowerInfo.type.includes("defense")) ||
                        configPowerInfo.behaviors.includes("defense") ||
                        item.type === "equipment"
                    ) {
                        await item.update({ [attr]: newValue });
                    }

                    // Check if there is an ActiveEffect associated with this item
                    if (firstAE) {
                        const newState = !newValue;
                        await item.update({ [attr]: newState });
                        let effects = item.effects
                            .filter(() => true)
                            .concat(item.actor.effects.filter((o) => o.origin === item.uuid));
                        for (const activeEffect of effects) {
                            await onActiveEffectToggle(activeEffect, newState);
                        }
                    } else {
                        await item.update({ [attr]: newValue });
                    }
                }
                break;

            case "maneuver":
                await enforceManeuverLimits(this.actor, item.id, item.name);
                //await updateCombatAutoMod(item.actor, item)
                break;

            case "talent": // COMBAT_LUCK
                await item.update({ [attr]: newValue });
                break;

            default:
                ui.notifications.warn(`${this.name} toggle may be incomplete`);
                break;
        }

        // If we have control of this token, reaquire to update movement types
        const myToken = this.actor?.getActiveTokens()?.[0];
        if (canvas.tokens.controlled.find((t) => t.id == myToken.id)) {
            myToken.release();
            myToken.control();
        }
    }

    isPerceivable(perceptionSuccess) {
        if (["NAKEDMODIFIER", "LIST"].includes(this.system.XMLID)) {
            return false;
        }

        // Power must be turned on
        if (this.system.active === false) return false;

        // TODO: Costs endurance (even if bought to 0 END) is perceivable when active unless it has invisible power effect bought for it.

        // FOCUS
        const FOCUS = this.system.MODIFIER?.find((o) => o.XMLID === "FOCUS");
        if (FOCUS) {
            if (FOCUS?.OPTION?.startsWith("O")) return true;
            if (FOCUS?.OPTION?.startsWith("I")) return perceptionSuccess;
        }

        const VISIBLE = this.system.MODIFIER?.find((o) => o.XMLID === "VISIBLE");
        if (VISIBLE) {
            if (VISIBLE?.OPTION?.endsWith("OBVIOUS")) {
                return true;
            } else if (VISIBLE?.OPTION?.endsWith("INOBVIOUS")) {
                return perceptionSuccess;
            }

            return true; // 5e?
        }

        // Parent that's visible?
        const PARENT = this.actor.items.find((o) => o.system.ID === (this.system.PARENTID || "null"));
        if (PARENT) {
            const VISIBLE = PARENT.system.MODIFIER?.find((o) => o.XMLID === "VISIBLE");
            if (VISIBLE) {
                if (VISIBLE?.OPTION.endsWith("OBVIOUS")) {
                    return true;
                } else if (VISIBLE?.OPTION.endsWith("INOBVIOUS")) {
                    return perceptionSuccess;
                }
            }
        }

        const configPowerInfo = getPowerInfo({ item: this });

        if (configPowerInfo?.duration?.toLowerCase() === "instant") {
            return false;
        }

        if (!configPowerInfo?.perceivability) {
            // TODO: Should it say that it's not perceivable if we haven't set it.
            return false;
        } else if (configPowerInfo?.perceivability.toLowerCase() === "imperceptible") {
            return false;
        } else if (configPowerInfo?.perceivability.toLowerCase() === "obvious") {
            return true;
        } else if (configPowerInfo?.perceivability.toLowerCase() === "inobvious") {
            return perceptionSuccess;
        }

        if (["INVISIBILITY"].includes(this.system.XMLID)) {
            return false;
        }

        if (game.settings.get(game.system.id, "alphaTesting")) {
            ui.notifications.warn(`${this.name} has undetermined perceivability`);
        }

        return false;
    }

    static ItemXmlTags = ["SKILLS", "PERKS", "TALENTS", "MARTIALARTS", "POWERS", "DISADVANTAGES", "EQUIPMENT"];
    static ItemXmlChildTags = ["ADDER", "MODIFIER", "POWER"];

    static ItemXmlChildTagsUpload = ["ADDER", "MODIFIER", "POWER", "SKILL", "PERK", "TALENT"];

    findModsByXmlid(xmlid) {
        for (const key of HeroSystem6eItem.ItemXmlChildTags) {
            if (this.system?.[key]) {
                const value = this.system[key]?.find((o) => o.XMLID === xmlid);
                if (value) {
                    return value;
                }
            }
        }

        // TODO: "Delete" support for old format
        for (const key of ["ADDER", "MODIFIER", "POWER"]) {
            if (this.system?.[key]) {
                const value = this.system[key].find((o) => o.XMLID === xmlid);
                if (value) {
                    return value;
                }

                for (const subMod of this.system[key]) {
                    for (const key2 of ["ADDER", "MODIFIER", "POWER"]) {
                        if (subMod[key2]) {
                            const value = subMod[key2].find((o) => o.XMLID === xmlid);
                            if (value) {
                                return value;
                            }
                        }
                    }
                }
            }
        }

        // Power framework may include this modifier
        if (this.parentItem && !this.parentItem.XMLID === "COMPOUNDPOWER" && this.actor?.items) {
            if (this.parentItem) {
                return this.parentItem.findModsByXmlid(xmlid);
            }
        }

        return null;
    }

    findModById(id, xmlid) {
        for (const key of HeroSystem6eItem.ItemXmlChildTags) {
            if (this.system?.[key]) {
                // Intentionally using == here to take advantage of string/int equality
                const value = this.system[key].find((o) => o.ID == id);
                if (value) {
                    return { ...value, _parentKey: key };
                }

                for (const subMod of this.system[key]) {
                    for (const key2 of HeroSystem6eItem.ItemXmlChildTags) {
                        if (subMod[key2]) {
                            const value = subMod[key2].find((o) => o.ID == id);
                            if (value) {
                                value;
                            }
                        }
                    }
                }
            }
        }

        ui.notifications.error(`Unable to find ${id}/${xmlid} from ${this.name}.`);
        return false;
    }

    async deleteModById(id, xmlid) {
        for (const key of HeroSystem6eItem.ItemXmlChildTags) {
            if (this.system?.[key]) {
                // Intentionally using == here to take advantage of string/int equality
                const value = this.system[key].find((o) => o.ID == id);
                if (value) {
                    this.system[key] = this.system[key].filter((o) => o.ID != id);
                    await this.update({ system: this.system });
                    return true;
                }

                for (const subMod of this.system[key]) {
                    for (const key2 of HeroSystem6eItem.ItemXmlChildTags) {
                        if (subMod[key2]) {
                            const value = subMod[key2].find((o) => o.ID == id);
                            if (value) {
                                subMod[key2] = subMod[key2].filter((o) => o.ID != id);
                                await this.update({ system: this.system });
                                return true;
                            }
                        }
                    }
                }
            }
        }

        ui.notifications.error(`Unable to delete ${id}/${xmlid} from ${this.name}.`);
        return false;
    }

    setInitialItemValueAndMax() {
        let changed;

        // LEVELS by default define the value/max. NOTE: use value/max instead of LEVELS so we can adjust powers.
        let newValue = parseInt(this.system.LEVELS || 0);

        switch (this.system.XMLID) {
            case "MENTALDEFENSE":
                // 5e gets some levels for free
                if (this.actor?.system.is5e) {
                    newValue =
                        newValue > 0
                            ? newValue +
                              RoundFavorPlayerUp(parseInt(this.actor?.system.characteristics.ego.value) / 5 || 0)
                            : 0;
                }

                // else use default value

                break;

            default:
                // use default value
                break;
        }

        if (this.system.max != newValue) {
            this.system.max = newValue;
            changed = true;
        }

        if (this.system.value != newValue) {
            this.system.value = newValue;
            changed = true;
        }

        return changed;
    }

    setInitialRange(power) {
        let changed = false;

        if (power) {
            this.system.range = power.range;

            changed = true;
        } else {
            ui.notifications.warn(`${this.actor?.name}/${this.name} doesn't have power (${power}) defined`);
        }

        return changed;
    }

    determinePointCosts() {
        let changed = false;
        changed = this.calcItemPoints() || changed;
        return changed;
    }

    // An attempt to cache getPowerInfo for performance reasons.
    #baseInfo = getPowerInfo({ item: this });
    getBaseInfo() {
        console.warn("Use baseInfo instead of getBaseInfo");
        return this.#baseInfo;
    }
    get baseInfo() {
        return this.#baseInfo;
    }

    get is5e() {
        return this.actor?.is5e || this.system?.is5e;
    }

    /**
     * Calculate all the AOE related parameters.
     *
     * @param {Modifier} modifier
     * @returns
     */
    buildAoeAttackParameters(modifier, options) {
        const is5e = !!this.actor?.system?.is5e;

        let changed = false;

        const widthDouble = parseInt(
            (modifier.ADDER || []).find((adder) => adder.XMLID === "DOUBLEWIDTH")?.LEVELS || 0,
        );
        const heightDouble = parseInt(
            (modifier.ADDER || []).find((adder) => adder.XMLID === "DOUBLEHEIGHT")?.LEVELS || 0,
        );
        // In 6e, widthDouble and heightDouble are the actual size and not instructions to double like 5e
        const width = is5e ? Math.pow(2, widthDouble) : widthDouble || 2;
        const height = is5e ? Math.pow(2, heightDouble) : heightDouble || 2;
        let levels = 1;
        let dcFalloff = 0;

        // 5e has a calculated size
        if (is5e) {
            if (modifier.XMLID === "AOE") {
                // not counting the Area Of Effect Advantage.
                // TODO: This is not quite correct as it item.system.activePoints are already rounded so this can
                //       come up short. We need a raw active cost and build up the advantage multipliers from there.
                //       Make sure the value is at least basePointsPlusAdders but this is just a kludge to handle most cases.
                const activePointsWithoutAoeAdvantage = Math.max(
                    this.system.basePointsPlusAdders,
                    this.system.activePoints / (1 + modifier.BASECOST_total),
                );
                switch (modifier.OPTIONID) {
                    case "CONE":
                        levels = RoundFavorPlayerUp(1 + activePointsWithoutAoeAdvantage / 5);
                        break;

                    case "HEX":
                        levels = 1;
                        break;

                    case "LINE":
                        levels = RoundFavorPlayerUp((2 * activePointsWithoutAoeAdvantage) / 5);
                        break;

                    case "ANY":
                    case "RADIUS":
                        levels = Math.max(1, RoundFavorPlayerUp(activePointsWithoutAoeAdvantage / 10));
                        break;

                    default:
                        console.error(
                            `Unhandled 5e AOE OPTIONID ${modifier.OPTIONID} for ${this.name}/${this.system.XMLID}`,
                        );
                        break;
                }

                // Modify major dimension (radius, length, etc). Line is different from all others.
                const majorDimensionDoubles = (modifier?.ADDER || []).find(
                    (adder) => adder.XMLID === "DOUBLEAREA" || adder.XMLID === "DOUBLELENGTH",
                );
                if (majorDimensionDoubles) {
                    levels *= Math.pow(2, parseInt(majorDimensionDoubles.LEVELS));
                }
            } else {
                // Explosion DC falloff has different defaults based on shape. When
                // LEVELS are provided they are the absolute value and not additive to the default.
                if (modifier.OPTIONID === "CONE") {
                    dcFalloff = 2;
                } else if (modifier.OPTIONID === "LINE") {
                    dcFalloff = 3;
                } else {
                    dcFalloff = 1;
                }
                dcFalloff = parseInt(options?.LEVELS || modifier.LEVELS || 0)
                    ? parseInt(options?.LEVELS || modifier.LEVELS)
                    : dcFalloff;

                // TODO: Can we work with DC given all the adders that are possible at the time of attack?
                const { dc } = convertToDcFromItem(this, {});

                levels = dc * dcFalloff;
            }
        } else {
            levels = parseInt(modifier.LEVELS);
        }

        // 5e has a slightly different alias for an Explosive Radius in HD.
        // Otherwise, all other shapes seems the same.
        const type = modifier.OPTION_ALIAS === "Normal (Radius)" ? "Radius" : modifier.OPTION_ALIAS;
        const newAoe = {
            type: type.toLowerCase(),
            value: levels,
            width: width,
            height: height,

            isExplosion: this.hasExplosionAdvantage(),
            dcFalloff: dcFalloff,
        };

        if (!foundry.utils.objectsEqual(this.system.areaOfEffect, newAoe)) {
            this.system.areaOfEffect = {
                ...this.system.areaOfEffect,
                ...newAoe,
            };

            changed = true;
        }

        return changed;
    }

    buildRangeParameters() {
        const originalRange = this.system.range;

        // Range Modifiers "self", "no range", "standard", or "los" based on base power.
        // It is the modified up or down but the only other types that should be added are:
        // "range based on str" or "limited range"
        const ranged = !!this.findModsByXmlid("RANGED");
        const noRange = !!this.findModsByXmlid("NORANGE");
        const limitedRange =
            this.findModsByXmlid("RANGED")?.OPTIONID === "LIMITEDRANGE" || // Advantage form
            !!this.findModsByXmlid("LIMITEDRANGE"); // Limitation form
        const rangeBasedOnStrength =
            this.findModsByXmlid("RANGED")?.OPTIONID === "RANGEBASEDONSTR" || // Advantage form
            !!this.findModsByXmlid("RANGEBASEDONSTR"); // Limitation form
        const los = !!this.findModsByXmlid("LOS");
        const normalRange = !!this.findModsByXmlid("NORMALRANGE");
        const usableOnOthers = !!this.findModsByXmlid("UOO");
        const boecv = !!this.findModsByXmlid("BOECV");

        // Based on EGO combat value comes with line of sight
        if (boecv) {
            this.system.range = CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT;
        }

        // Self only powers cannot be bought to have range unless they become usable on others at which point
        // they gain no range.
        if (this.system.range === CONFIG.HERO.RANGE_TYPES.SELF) {
            if (usableOnOthers) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
            }
        }

        // No range can be bought to have range.
        if (this.system.range === CONFIG.HERO.RANGE_TYPES.NO_RANGE) {
            if (ranged) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.STANDARD;
            }
        }

        // Standard range can be bought up or bought down.
        if (this.system.range === CONFIG.HERO.RANGE_TYPES.STANDARD) {
            if (noRange) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
            } else if (los) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT;
            } else if (limitedRange) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.LIMITED_RANGE;
            } else if (rangeBasedOnStrength) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.RANGE_BASED_ON_STR;
            }
        }

        // Line of sight can be bought down
        if (this.system.range === CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT) {
            if (normalRange) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.STANDARD;
            } else if (rangeBasedOnStrength) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.RANGE_BASED_ON_STR;
            } else if (limitedRange) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.LIMITED_RANGE;
            } else if (noRange) {
                this.system.range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
            }
        }

        return originalRange === this.system.range;
    }

    AoeAttackParameters(options) {
        const aoeModifier = this.getAoeModifier();
        if (aoeModifier) {
            const is5e = !!this.actor?.system?.is5e;

            const widthDouble = parseInt(
                (aoeModifier.ADDER || []).find((adder) => adder.XMLID === "DOUBLEWIDTH")?.LEVELS || 0,
            );
            const heightDouble = parseInt(
                (aoeModifier.ADDER || []).find((adder) => adder.XMLID === "DOUBLEHEIGHT")?.LEVELS || 0,
            );
            // In 6e, widthDouble and heightDouble are the actual size and not instructions to double like 5e
            const width = is5e ? Math.pow(2, widthDouble) : widthDouble || 2;
            const height = is5e ? Math.pow(2, heightDouble) : heightDouble || 2;
            let levels = 1;
            let dcFalloff = 0;

            // 5e has a calculated size
            if (is5e) {
                // A bit hacky: create effectiveItem based on options.levels
                let effectiveItemData = new HeroSystem6eItem(
                    foundry.utils.mergeObject(this.toObject(), { system: { is5e: true } }),
                );
                if ((parseInt(options?.levels) || 0) > 0) {
                    effectiveItemData.name = "Effective";
                    effectiveItemData.system.LEVELS = parseInt(options?.levels) || 0;
                    effectiveItemData.calcItemPoints();
                }

                if (aoeModifier.XMLID === "AOE") {
                    // not counting the Area Of Effect Advantage.
                    // TODO: This is not quite correct as it item.system.activePoints are already rounded so this can
                    //       come up short. We need a raw active cost and build up the advantage multipliers from there.
                    //       Make sure the value is at least basePointsPlusAdders but this is just a kludge to handle most cases.

                    const activePointsWithoutAoeAdvantage = Math.max(
                        effectiveItemData.system.basePointsPlusAdders,
                        effectiveItemData.system.activePoints / (1 + aoeModifier.BASECOST_total),
                    );
                    switch (aoeModifier.OPTIONID) {
                        case "CONE":
                            levels = RoundFavorPlayerUp(1 + activePointsWithoutAoeAdvantage / 5);
                            break;

                        case "HEX":
                            levels = 1;
                            break;

                        case "LINE":
                            levels = RoundFavorPlayerUp((2 * activePointsWithoutAoeAdvantage) / 5);
                            break;

                        case "ANY":
                        case "RADIUS":
                            levels = Math.max(1, RoundFavorPlayerUp(activePointsWithoutAoeAdvantage / 10));
                            break;

                        default:
                            console.error(
                                `Unhandled 5e AOE OPTIONID ${aoeModifier.OPTIONID} for ${this.name}/${this.system.XMLID}`,
                            );
                            break;
                    }

                    // Modify major dimension (radius, length, etc). Line is different from all others.
                    const majorDimensionDoubles = (aoeModifier?.ADDER || []).find(
                        (adder) => adder.XMLID === "DOUBLEAREA" || adder.XMLID === "DOUBLELENGTH",
                    );
                    if (majorDimensionDoubles) {
                        levels *= Math.pow(2, parseInt(majorDimensionDoubles.LEVELS));
                    }
                } else {
                    // Explosion DC falloff has different defaults based on shape. When
                    // LEVELS are provided they are the absolute value and not additive to the default.
                    if (aoeModifier.OPTIONID === "CONE") {
                        dcFalloff = 2;
                    } else if (aoeModifier.OPTIONID === "LINE") {
                        dcFalloff = 3;
                    } else {
                        dcFalloff = 1;
                    }
                    dcFalloff = parseInt(options?.LEVELS || aoeModifier.LEVELS || 0)
                        ? parseInt(options?.LEVELS || aoeModifier.LEVELS)
                        : dcFalloff;

                    // TODO: Can we work with DC given all the adders that are possible at the time of attack?
                    const { dc } = convertToDcFromItem(effectiveItemData, {});

                    levels = dc * dcFalloff;
                }
            } else {
                levels = parseInt(options?.LEVELS || aoeModifier.LEVELS);
            }

            // 5e has a slightly different alias for an Explosive Radius in HD.
            // Otherwise, all other shapes seems the same.
            const type = aoeModifier.OPTION_ALIAS === "Normal (Radius)" ? "Radius" : aoeModifier.OPTION_ALIAS;
            const newAoe = {
                type: type.toLowerCase(),
                value: levels,
                width: width,
                height: height,

                isExplosion: this.hasExplosionAdvantage(),
                dcFalloff: dcFalloff,
            };

            return {
                ...aoeModifier,
                ...newAoe,
            };
        }
        return null;
    }

    _postUploadDetails() {
        const item = this;

        // Make sure we have an actor (like when creating compendiums)
        if (!item.actor) {
            return;
        }
        if(item.system.XMLID === "MULTIPLEATTACK"){
            console.log("RWC MULTIPLEATTACK");
        }
        // showToggle
        const itemEffects = item.effects.find(() => true);
        if (itemEffects) {
            item.system.showToggle = true;
            item.system.active = !itemEffects.disabled;
        }

        // NOTE: item._id can be null in the case of a temporary/effective item.
        const actorEffects = item.actor.effects.find((o) => o.origin === item.actor.items.get(item._id)?.uuid);
        {
            if (actorEffects) {
                item.system.showToggle = true;
                item.system.active = !actorEffects.disabled;
            }
        }
        if (item.baseInfo?.behaviors?.includes("activatable")) {
            item.system.showToggle = true;
        }

        // Item in a Framework?
        if (item.parentItem) {
            // const parentPosition =
            //     item.parentItem.system.XMLID === "COMPOUNDPOWER"
            //         ? -1 // Compound power starts at a random position. Sub powers start at 0.
            //         : parseInt(item.parentItem.system.POSITION);
            //item.system.childIdx = parseInt(item.system.POSITION) - parseInt(parentPosition);
            item.system.childIdx = item.parentItem.childItems?.findIndex((o) => o.id === item.id) + 1;

            if (item.parentItem?.parentItem) {
                item.system.childIdx = `${item.parentItem.system.childIdx}.${item.system.childIdx}`;
            }
        }
        if(item.system.XMLID === "MULTIPLEATTACK"){
            console.log("RWC MULTIPLEATTACK");
        }
        // Endurance
        item.system.endEstimate = parseInt(item.system.end) || 0;

        // Damage
        if (
            item.type == "attack" ||
            item.type == "maneuver" ||
            item.system.subType === "attack" ||
            item.system.XMLID === "martialart"
        ) {
            item.flags.tags = {};

            // Combat Skill Levels
            const csls = CombatSkillLevelsForAttack(item);
            let cslSummary = {};

            for (const csl of csls) {
                for (const prop of ["ocv", "omcv", "dcv", "dmcv", "dc"]) {
                    cslSummary[prop] = csl[prop] + parseInt(cslSummary[prop] || 0);

                    if (csl[prop] != 0) {
                        if (item.flags.tags[prop]) {
                            item.flags.tags[prop] += "\n";
                        } else {
                            item.flags.tags[prop] = "";
                        }
                        item.flags.tags[prop] = `${item.flags.tags[prop]}${csl[prop].signedString()} ${
                            prop === "dc" ? "DC " : ""
                        }${csl.item.name}`;
                    }
                }
            }
            let { dc, end } = convertToDcFromItem(item);
            item.system.endEstimate = Math.max(item.system.endEstimate, end);

            // text description of damage
            item.system.damage = getDiceFormulaFromItemDC(item, dc);

            // Standard Effect
            if (item.system.USESTANDARDEFFECT) {
                let stun = parseInt(item.system.value * 3);
                if (
                    item.findModsByXmlid("PLUSONEHALFDIE") ||
                    item.findModsByXmlid("MINUSONEPIP") ||
                    item.findModsByXmlid("PLUSONEPIP")
                ) {
                    stun += 1;
                }
                item.system.damage = stun;
            }

            if (dc > 0) {
                if (item.system.killing) {
                    item.system.damage += "K";
                }
            }

            // Signed OCV and DCV
            if (item.system.ocv != undefined && item.system.uses === "ocv") {
                const ocv = parseInt(item.actor?.system.characteristics.ocv?.value || 0);
                if (parseInt(ocv) != 0) {
                    if (item.flags.tags.ocv) {
                        item.flags.tags.ocv += "\n";
                    } else {
                        item.flags.tags.ocv = "";
                    }
                    item.flags.tags.ocv = `${item.flags.tags.ocv}${ocv.signedString()} OCV`;
                }
                switch (item.system.ocv) {
                    case "--":
                        item.system.ocvEstimated = "";
                        break;

                    case "-v/10":
                        {
                            item.system.ocv = ("+" + parseInt(item.system.ocv)).replace("+-", "-");

                            const tokens = item.actor.getActiveTokens();
                            const token = tokens[0];
                            const velocity = calculateVelocityInSystemUnits(item.actor, token);

                            item.system.ocvEstimated = (
                                ocv +
                                parseInt(cslSummary.ocv) +
                                parseInt(velocity / 10)
                            ).signedString();

                            if (parseInt(velocity / 10) != 0) {
                                if (item.flags.tag.ocv) {
                                    item.flags.tagsocv += "\n";
                                } else {
                                    item.flags.tags.ocv = "";
                                }
                                item.flags.tags.ocv = `${item.flags.tags.ocv}${parseInt(
                                    velocity / 10,
                                ).signedString()} Velocity`;
                            }
                        }
                        break;

                    default:
                        item.system.ocv = parseInt(item.system.ocv).signedString();

                        item.system.ocvEstimated = (
                            ocv +
                            parseInt(item.system.ocv) +
                            parseInt(cslSummary.ocv || cslSummary.omcv || 0)
                        ).signedString();

                        if (parseInt(item.system.ocv) != 0) {
                            if (item.flags.tags.ocv) {
                                item.flags.tags.ocv += "\n";
                            } else {
                                item.flags.tags.ocv = "";
                            }
                            item.flags.tags.ocv += `${item.system.ocv} ${item.name}`;
                        }
                }
            }

            if (item.system.dcv != undefined && item.system.uses === "ocv") {
                const dcv = parseInt(item.actor?.system.characteristics.dcv?.value || 0);
                if (parseInt(dcv) != 0) {
                    if (item.flags.tags.dcv) {
                        item.flags.tags.dcv += "\n";
                    } else {
                        item.flags.tags.dcv = "";
                    }
                    item.flags.tags.dcv = `${item.flags.tags.dcv}${dcv.signedString()} DCV`;
                }
                item.system.dcv = parseInt(item.system.dcv).signedString();
                item.system.dcvEstimated = (
                    dcv +
                    parseInt(item.system.dcv) +
                    parseInt(cslSummary.dcv || cslSummary.dmcv || 0)
                ).signedString();

                if (parseInt(item.system.dcv) != 0) {
                    if (item.flags.tags.dcv) {
                        item.flags.tags.dcv += "\n";
                    } else {
                        item.flags.tags.dcv = "";
                    }
                    item.flags.tags.dcv = `${item.flags.tags.dcv}${item.system.dcv} ${item.name}`;
                }
            }

            if (item.system.uses === "omcv") {
                const omcv = parseInt(item.actor?.system.characteristics.omcv?.value || 0);
                item.system.ocvEstimated = (omcv + parseInt(cslSummary.omcv || 0)).signedString();
                if (omcv != 0) {
                    if (item.flags.tags.omcv) {
                        item.flags.tags.omcv += "\n";
                    } else {
                        item.flags.tags.omcv = "";
                    }
                    item.flags.tags.omcv = `${item.flags.tags.omcv}${omcv.signedString()} OMCV`;
                }

                const dmcv = parseInt(item.actor?.system.characteristics.dmcv?.value || 0);
                item.system.dcvEstimated = (dmcv + parseInt(cslSummary.dmcv || 0)).signedString();
                if (dmcv != 0) {
                    if (item.flags.tags.dmcv) {
                        item.flags.tags.dmcv += "\n";
                    } else {
                        item.flags.tags.dmcv = "";
                    }
                    item.flags.tags.dmcv = `${item.flags.tags.dmcv}${dmcv.signedString()} DMCV`;
                }
            }

            // Set +1 OCV
            const setManeuver = item.actor.items.find(
                (o) => o.type == "maneuver" && o.name === "Set" && o.system.active,
            );
            if (setManeuver) {
                item.system.ocvEstimated = (parseInt(item.system.ocvEstimated) + 1).signedString();

                if (item.flags.tags.ocv) {
                    item.flags.tags.ocv += "\n";
                } else {
                    item.flags.tags.ocv = "";
                }
                item.flags.tags.ocv += `+1 Set`;
            }

            // Haymaker -5 DCV
            const haymakerManeuver = item.actor.items.find(
                (o) => o.type == "maneuver" && o.name === "Haymaker" && o.system.active,
            );
            if (haymakerManeuver) {
                item.system.dcvEstimated = (parseInt(item.system.dcvEstimated) - 4).signedString();

                if (item.flags.tags.dcv) {
                    item.flags.tags.dcv += "\n";
                } else {
                    item.flags.tags.dcv = "";
                }
                item.flags.tags.dcv += `-4 Haymaker`;
            }

            item.system.phase = item.system.PHASE;
        }

        // Defense
        if (item.type == "defense") {
            item.system.description =
                CONFIG.HERO.defenseTypes[item.system.defenseType] ||
                CONFIG.HERO.defenseTypes5e[item.system.defenseType];
        }

        item.updateRoll();

        // Charges
        if (parseInt(item.system.charges?.max || 0) > 0) {
            const costsEnd = item.findModsByXmlid("COSTSEND");
            if (item.system.endEstimate === 0 || !costsEnd) item.system.endEstimate = "";
            item.system.endEstimate += ` [${parseInt(item.system.charges?.value || 0)}${
                item.system.charges?.recoverable ? "rc" : ""
            }]`;
            item.system.endEstimate = item.system.endEstimate.trim();
        }

        // 0 END
        if (!item.system.endEstimate) {
            item.system.endEstimate = "";
        }

        // Mental
        if (item?.flags?.tags?.omcv) {
            item.flags.tags.ocv ??= item.flags.tags.omcv;
            item.flags.tags.dcv ??= item.flags.tags.dmcv;
        }
    }

    async _postUpload(options) {
        const configPowerInfo = this.baseInfo;

        let changed = this.setInitialItemValueAndMax();

        changed = this.setInitialRange(configPowerInfo) || changed;

        this.updateRoll();

        changed = this.determinePointCosts() || changed;

        // CHARGES
        const CHARGES = this.findModsByXmlid("CHARGES");
        if (CHARGES) {
            this.system.charges = {
                ...this.system.charges,
                max: parseInt(CHARGES.OPTION_ALIAS),
                recoverable: (CHARGES.ADDER || []).find((o) => o.XMLID == "RECOVERABLE") ? true : false,
                continuing: (CHARGES.ADDER || []).find((o) => o.XMLID == "CONTINUING")?.OPTIONID,
            };
            if (this.system.charges?.value === undefined || this.system.charges?.value === null) {
                console.log("Invalid charges. Resetting to max", this);
                this.system.charges.value ??= this.system.charges.max;
                changed = true;
            }
        } else {
            // When CHARGES is manually deleted
            if (this.system.charges) {
                delete this.system.charges;
                this.update({ "system.-=charges": null });
            }
        }

        // Toggles
        if (this.baseInfo?.behaviors.includes("activatable")) {
            if (!this.system.showToggle) {
                this.system.showToggle = true;
                changed = true;
            }
        }

        // DEFENSES
        // TODO: NOTE: This shouldn't just be for defense type. Should probably get rid of the subType approach.
        if (
            this.baseInfo?.type.includes("defense") ||
            this.baseInfo?.behaviors?.includes("defense") ||
            this.baseInfo?.type?.includes("characteristic")
        ) {
            const newDefenseValue = "defense";

            if (this.system.subType !== newDefenseValue && this.baseInfo?.behaviors.includes("activatable")) {
                this.system.subType = newDefenseValue;
                this.system.showToggle = true;
                changed = true;
            }

            // Default toggles to ON unless they are instant, have charges, part of a MULTIPOWER, etc
            if (
                this.system.charges?.value > 0 ||
                this.system.AFFECTS_TOTAL === false ||
                configPowerInfo?.duration === "instant" ||
                this.parentItem?.system.XMLID === "MULTIPOWER"
            ) {
                this.system.active ??= false;
            } else {
                this.system.active ??= true;
            }
        }

        // MOVEMENT
        if (this.baseInfo?.type.includes("movement")) {
            const movement = "movement";
            if (this.system.subType !== movement) {
                this.system.subType = movement;
                this.system.showToggle = true;
                changed = true;
            }
        }

        // SKILLS
        if (this.baseInfo?.type?.includes("skill")) {
            const skill = "skill";
            if (this.system.subType !== skill) {
                this.system.subType = skill;
                changed = true;
            }
        }

        // ATTACK
        if (
            configPowerInfo &&
            (configPowerInfo.behaviors.includes("attack") || configPowerInfo.behaviors.includes("dice"))
        ) {
            // TODO: NOTE: This shouldn't just be for attack type. Should probably get rid of the subType approach. Should probably for anything with range != self
            const attack = "attack";
            if (this.system.subType !== attack) {
                this.system.subType = attack;
                changed = true;
                this.makeAttack();
            } else {
                // Newer item edit may change system.LEVELS or adder/modifier
                if (changed) {
                    this.makeAttack();
                }
            }

            if (changed) {
                // if (this.system.ID === "1723406694834") {
                //     debugger;
                // }
                let { dc, end } = convertToDcFromItem(this);
                this.system.endEstimate = Math.max(this.system.endEstimate, end);

                // text description of damage
                this.system.damage = getDiceFormulaFromItemDC(this, dc);

                if (dc > 0) {
                    if (this.system.killing) {
                        this.system.damage += "K";
                    } else {
                        this.system.damage += "N";
                    }
                }
            }
        }

        changed = this.buildRangeParameters() || changed;

        const aoeModifier = this.getAoeModifier();
        if (aoeModifier) {
            this.buildAoeAttackParameters(aoeModifier);
        }

        if (this.system.XMLID == "COMBAT_LEVELS") {
            // Make sure CSLs are defined; but don't override them if they are already present
            this.system.csl ??= {};
            for (let c = 0; c < parseInt(this.system.LEVELS); c++) {
                this.system.csl[c] ??= "ocv";
            }
        }

        if (this.system.XMLID == "MENTAL_COMBAT_LEVELS") {
            // Make sure CSLs are defined; but don't override them if they are already present
            this.system.csl ??= {};
            for (let c = 0; c < parseInt(this.system.LEVELS); c++) {
                this.system.csl[c] ??= "omcv";
            }
        }

        // Attempt default weapon selection if showAttacks is defined and there are no custom adders
        // Or the OPTIONID=ALL is specified
        if (this.baseInfo?.editOptions?.showAttacks && this.actor?.items) {
            if (!(this.system.ADDER || []).find((o) => o.XMLID === "ADDER") || this.system.OPTIONID === "ALL") {
                let count = 0;
                for (const attackItem of this.actor.items.filter(
                    (o) =>
                        (o.type === "attack" || o.system.subType === "attack") &&
                        (!o.baseInfo.behaviors.includes("optional-maneuver") ||
                            game.settings.get(HEROSYS.module, "optionalManeuvers")),
                )) {
                    let addMe = false;

                    switch (this.system.XMLID) {
                        case "WEAPON_MASTER":
                            // Skip mental powers
                            if (attackItem.baseInfo.type.includes("mental")) {
                                continue;
                            }
                            switch (this.system.OPTIONID) {
                                case "VERYLIMITED":
                                    if (count === 0) {
                                        addMe = true;
                                    }
                                    break;
                                case "LIMITED":
                                    if (count < 3) {
                                        addMe = true;
                                    }
                                    break;
                                case "ANYHTH":
                                    if (attackItem.baseInfo.range === "No Range") {
                                        addMe = true;
                                    }
                                    break;
                                case "ANYRANGED":
                                    if (attackItem.baseInfo.range === "Standard") {
                                        addMe = true;
                                    }
                                    break;
                                default:
                                    console.warn("Unhandled attack automatic selection", this);
                            }
                            break;
                        case "COMBAT_LEVELS":
                            // Skip mental powers
                            if (attackItem.baseInfo.type.includes("mental")) {
                                continue;
                            }
                            switch (this.system.OPTIONID) {
                                case "SINGLE":
                                    if (count === 0) {
                                        // Is this part of a framework/compound power/list?
                                        if (this.parentItem) {
                                            if (this.parentItem.id === attackItem.parentItem?.id) {
                                                addMe = true;
                                            }
                                        } else {
                                            addMe = true;
                                        }
                                    }
                                    break;
                                case "TIGHT":
                                    if (count < 3) {
                                        addMe = true;
                                    }
                                    break;
                                case "BROAD":
                                    if (count < 6) {
                                        addMe = true;
                                    }
                                    break;
                                case "HTH":
                                    if (attackItem.baseInfo.range === "No Range") {
                                        addMe = true;
                                    }
                                    break;
                                case "RANGED":
                                    if (attackItem.baseInfo.range === "Standard") {
                                        addMe = true;
                                    }
                                    break;
                                case "ALL":
                                    addMe = true;
                                    break;
                            }
                            break;
                        case "PENALTY_SKILL_LEVELS":
                            // Skip mental powers
                            if (attackItem.baseInfo.type.includes("mental")) {
                                continue;
                            }
                            switch (this.system.OPTIONID) {
                                case "SINGLE":
                                    if (count === 0) {
                                        // Is this part of a framework/compound power/list?
                                        if (this.parentItem) {
                                            if (this.parentItem.id === attackItem.parentItem?.id) {
                                                addMe = true;
                                            }
                                        } else {
                                            addMe = true;
                                        }

                                        // Assumed penalty type
                                        if (
                                            addMe &&
                                            ["limited range", "standard", "range based on str"].includes(
                                                attackItem.system.range,
                                            )
                                        ) {
                                            this.system.penalty ??= "range";
                                        }
                                    }
                                    break;
                                case "THREE":
                                    if (count < 3) {
                                        addMe = true;

                                        // Assumed penalty type
                                        if (
                                            addMe &&
                                            ["limited range", "standard", "range based on str"].includes(
                                                attackItem.system.range,
                                            )
                                        ) {
                                            this.system.penalty ??= "range";
                                        }
                                    }
                                    break;
                                case "ALL":
                                    addMe = true;

                                    // Assumed penalty type
                                    if (
                                        addMe &&
                                        ["limited range", "standard", "range based on str"].includes(
                                            attackItem.system.range,
                                        )
                                    ) {
                                        this.system.penalty ??= "range";
                                    }
                                    break;
                            }
                            break;
                        case "MENTAL_COMBAT_LEVELS":
                            // Skip non-mental powers
                            if (!attackItem.baseInfo.type.includes("mental")) {
                                continue;
                            }
                            switch (this.system.OPTIONID) {
                                case "SINGLE":
                                    if (count === 0) {
                                        addMe = true;
                                    }
                                    break;
                                case "TIGHT":
                                    if (count < 3) {
                                        addMe = true;
                                    }
                                    break;
                                case "BROAD":
                                case "ALL":
                                    addMe = true;
                                    break;
                            }
                            break;
                        default:
                            console.warn("Unhandled attack automatic selection", this);
                    }

                    if (addMe) {
                        const newAdder = {
                            XMLID: "ADDER",
                            ID: new Date().getTime().toString(),
                            ALIAS: attackItem.name || attackItem.system.ALIAS,
                            BASECOST: "0.0",
                            LEVELS: "0",
                            NAME: "",
                            PRIVATE: false,
                            SELECTED: true,
                            BASECOST_total: 0,
                        };
                        this.system.ADDER ??= [];
                        this.system.ADDER.push(newAdder);
                        count++;
                    }
                }
            }
        }

        // DESCRIPTION
        const oldDescription = this.system.description;
        const oldName = this.name;
        this.updateItemDescription();
        changed = oldDescription !== this.system.description || oldName !== this.name || changed;

        // Save changes
        if (changed && this.id && this.isEmbedded) {
            const changeObject = { system: this.system };
            if (oldName !== this.name) {
                changeObject.name = this.name;
            }
            await this.update(changeObject, options);
        }
        options?.uploadProgressBar?.advance(`${this.actor.name}: Adding ${this.name}`);

        // ACTIVE EFFECTS
        if (changed && this.id && configPowerInfo && configPowerInfo.type?.includes("movement")) {
            const activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} +${this.system.value}`;
            activeEffect.icon = "icons/svg/upgrade.svg";
            activeEffect.changes = [
                {
                    key: `system.characteristics.${this.system.XMLID.toLowerCase()}.max`,
                    value: this.system.value,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ];
            for (const usableas of (this.system.MODIFIER || []).filter((o) => o.XMLID === "USABLEAS")) {
                let foundMatch = false;
                for (const movementKey of Object.keys(CONFIG.HERO.movementPowers)) {
                    if (usableas.ALIAS.match(new RegExp(movementKey, "i"))) {
                        activeEffect.changes.push({
                            key: `system.characteristics.${movementKey.toLowerCase()}.max`,
                            value: this.system.value,
                            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                        });
                        foundMatch = true;
                    }
                }
                if (!foundMatch) {
                    ui.notifications.warn(`${this.name} has unknown USABLE AS "${usableas.ALIAS}"`);
                    console.warn(`${this.name} has unknown USABLE AS "${usableas.ALIAS}"`, usableas);
                }
            }
            activeEffect.transfer = true;
            activeEffect.disabled = !this.system.active;

            if (activeEffect.update) {
                await activeEffect.update({
                    name: activeEffect.name,
                    changes: activeEffect.changes,
                });
                if (this.actor) {
                    await this.actor.update({
                        [`system.characteristics.${this.system.XMLID.toLowerCase()}.value`]:
                            this.actor.system.characteristics[this.system.XMLID.toLowerCase()].max,
                    });
                }
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        }

        if (changed && this.id && configPowerInfo?.type?.includes("characteristic")) {
            const activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} +${this.system.value}`;
            activeEffect.icon = "icons/svg/upgrade.svg";
            activeEffect.changes = [
                {
                    key: `system.characteristics.${this.system.XMLID.toLowerCase()}.max`,
                    value: this.system.value,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ];
            activeEffect.transfer = true;
            activeEffect.disabled = !this.system.active;

            if (activeEffect.update) {
                const oldMax = this.actor.system.characteristics[this.system.XMLID.toLowerCase()].max;
                await activeEffect.update({
                    name: activeEffect.name,
                    changes: activeEffect.changes,
                });
                const deltaMax = this.actor.system.characteristics[this.system.XMLID.toLowerCase()].max - oldMax;
                await this.actor.update({
                    [`system.characteristics.${this.system.XMLID.toLowerCase()}.value`]:
                        this.actor.system.characteristics[this.system.XMLID.toLowerCase()].value + deltaMax,
                });
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        }

        if (changed && this.id && this.system.XMLID === "DENSITYINCREASE") {
            const strAdd = Math.floor(this.system.value) * 5;
            const pdAdd = Math.floor(this.system.value);
            const edAdd = Math.floor(this.system.value);

            let activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} ${this.system.value}`;
            activeEffect.icon = "icons/svg/upgrade.svg";
            activeEffect.changes = [
                {
                    key: "system.characteristics.str.max",
                    value: strAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    key: "system.characteristics.pd.max",
                    value: pdAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    key: "system.characteristics.ed.max",
                    value: edAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ];
            activeEffect.transfer = true;
            activeEffect.disabled = !this.system.active;

            if (activeEffect.update) {
                await activeEffect.update({
                    name: activeEffect.name,
                    changes: activeEffect.changes,
                });
                await this.actor.update({
                    [`system.characteristics.str.value`]: this.actor.system.characteristics.str.max,
                });
                await this.actor.update({
                    [`system.characteristics.pd.value`]: this.actor.system.characteristics.pd.max,
                });
                await this.actor.update({
                    [`system.characteristics.ed.value`]: this.actor.system.characteristics.ed.max,
                });
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        }

        // 5e GROWTH
        // Growth5e (+10 STR, +2 BODY, +2 STUN, -2" KB, 400 kg, +0 DCV, +0 PER Rolls to perceive character, 3 m tall, 2 m wide)
        // Growth6e (+15 STR, +5 CON, +5 PRE, +3 PD, +3 ED, +3 BODY, +6 STUN, +1m Reach, +12m Running, -6m KB, 101-800 kg, +2 to OCV to hit, +2 to PER Rolls to perceive character, 2-4m tall, 1-2m wide)
        // Growth6e is a static template.  LEVELS are ignored, instead use OPTIONID.
        if (changed && this.id && this.system.XMLID === "GROWTH" && this.system.active) {
            const details = configPowerInfo?.details(this) || {};
            let activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.system.ALIAS || this.system.XMLID || this.name) + ": ";
            activeEffect.name += `${this.system.XMLID} ${this.is5e ? this.system.value : this.system.OPTIONID}`;
            activeEffect.icon = "icons/svg/upgrade.svg";
            activeEffect.changes = [
                {
                    key: "system.characteristics.str.max",
                    value: details.str,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    key: "system.characteristics.body.max",
                    value: details.body,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    key: "system.characteristics.stun.max",
                    value: details.stun,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    // Growth6e + OCV is sorta like -DCV, but not quite as 1/2 DCV penalties are an issue, also min 0 DCV rules,
                    // should technicaly add to OCV of attacker.
                    // However 5e use the -DCV concept and we will implement 6e in kind for now.
                    key: "system.characteristics.dcv.max",
                    value: -details.dcv,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ];
            if (!this.is5e) {
                activeEffect.changes.push({
                    key: "system.characteristics.con.max",
                    value: details.con,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                });
                activeEffect.changes.push({
                    key: "system.characteristics.pre.max",
                    value: details.pre,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                });
                activeEffect.changes.push({
                    key: "system.characteristics.pd.max",
                    value: details.pd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                });
                activeEffect.changes.push({
                    key: "system.characteristics.ed.max",
                    value: details.ed,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                });
                activeEffect.changes.push({
                    key: "system.characteristics.running.max",
                    value: details.running,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                });
            }
            activeEffect.transfer = true;

            if (activeEffect.update) {
                await activeEffect.update({
                    name: activeEffect.name,
                    changes: activeEffect.changes,
                });
                await this.actor.update({
                    [`system.characteristics.str.value`]: this.actor.system.characteristics.str.max,
                });
                await this.actor.update({
                    [`system.characteristics.pd.value`]: this.actor.system.characteristics.pd.max,
                });
                await this.actor.update({
                    [`system.characteristics.ed.value`]: this.actor.system.characteristics.ed.max,
                });
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        }

        // 6e Shrinking (1 m tall, 12.5 kg mass, -2 PER Rolls to perceive character, +2 DCV, takes +6m KB)
        // 5e Shrinking (1 m tall, 12.5 kg mass, -2 PER Rolls to perceive character, +2 DCV)
        if (changed && this.id && this.system.XMLID === "SHRINKING" && this.system.active) {
            const dcvAdd = Math.floor(this.system.value) * 2;

            let activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} ${this.system.value}`;
            activeEffect.icon = "icons/svg/upgrade.svg";
            activeEffect.changes = [
                {
                    key: "system.characteristics.dcv.max",
                    value: dcvAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ];
            activeEffect.transfer = true;

            if (activeEffect.update) {
                await activeEffect.update({
                    name: activeEffect.name,
                    changes: activeEffect.changes,
                });
                await this.actor.update({
                    [`system.characteristics.dcv.value`]: this.actor.system.characteristics.dcv.max,
                });
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        }

        this._postUploadDetails();

        return changed;
    }

    getAttacksWith() {
        const configPowerInfo = getPowerInfo({ item: this });
        if (configPowerInfo?.type.includes("mental")) return "omcv";
        return "ocv";
    }
    getDefendsWith() {
        const configPowerInfo = getPowerInfo({ item: this });
        if (configPowerInfo?.type.includes("mental")) return "dmcv";
        return "dcv";
    }

    getAllChildren() {
        let results = [];
        for (let key of HeroSystem6eItem.ItemXmlChildTags) {
            if (this.system?.[key]) {
                results = results.concat(this.system?.[key]);
            }
        }
        return results;
    }

    static itemDataFromXml(xml, actor) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        const heroJson = {};
        HeroSystem6eActor._xmlToJsonNode(heroJson, xmlDoc.children);

        let itemData = {
            name: "undefined",
            type: "power",
        };

        // Keep track of is5e as it may be important (compendiums, transfer between 5e/6e actors)
        itemData.system ??= {};
        itemData.system.is5e = actor.system?.is5e;

        const powerList = actor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
        for (const itemTag of [
            ...HeroSystem6eItem.ItemXmlTags,
            ...powerList
                .filter(
                    (power) =>
                        power.type.includes("characteristic") ||
                        power.type.includes("framework") ||
                        (power.type.includes("skill") && power.type.includes("enhancer")),
                )
                .map((power) => power.key),
        ]) {
            const itemSubTag = itemTag
                .replace(/S$/, "")
                .replace("MARTIALART", "MANEUVER")
                .replace("DISADVANTAGE", "DISAD");
            if (heroJson[itemSubTag]) {
                for (const system of Array.isArray(heroJson[itemSubTag])
                    ? heroJson[itemSubTag]
                    : [heroJson[itemSubTag]]) {
                    itemData = {
                        name: system?.ALIAS || system?.XMLID || itemTag, // simplistic name for now
                        type: powerList.filter((o) => o.type?.includes("characteristic")).map((o) => o.key)
                            ? "power"
                            : itemTag.toLowerCase().replace(/s$/, ""),
                        system: { ...system, is5e: itemData.system.is5e },
                    };

                    return itemData;
                }
            }
        }

        // Perhaps a single entry
        if (!itemData.system.XMLID) {
            itemData.system = {
                ...heroJson[Object.keys(heroJson)[0]],
                is5e: itemData.system.is5e,
            };
            itemData.name = itemData.system?.ALIAS || itemData.system?.XMLID;
        }

        return itemData;
    }

    /**
     * Retrieves the parent item of the current item based on the `PARENTID` property.
     *
     * @returns {HeroSystem6eItem|null} The parent item if found, otherwise null.
     */
    get parentItem() {
        const parentId = this.system?.PARENTID;
        if (!parentId) return null;

        const items = this.actor?.items || game.items;
        return items.find((item) => item.system?.ID === parentId) || null;
    }

    /**
     * Retrieves all child items of the current item based on the PARENTID property.
     *
     * @returns {Array|null} An array of child items if found, otherwise null.
     */
    get childItems() {
        const items = this.actor?.items || game.items;
        const children = items.filter((item) => item.system.PARENTID === this.system.ID);
        return children.length ? children : null;
    }

    calcItemPoints() {
        let changed = false;
        changed = this.calcBasePointsPlusAdders() || changed;
        changed = this.calcActivePoints() || changed;
        changed = this.calcRealCost() || changed;
        return changed;
    }

    calcBasePointsPlusAdders() {
        const system = this.system;
        const actor = this.actor;

        const old = system.basePointsPlusAdders;

        if (!system.XMLID) return 0;

        // Everyman skills are free
        if (system.EVERYMAN) {
            system.basePointsPlusAdders = 0;
            return { changed: old != system.basePointsPlusAdders };
        }

        // Native Tongue
        if (system.NATIVE_TONGUE) {
            system.basePointsPlusAdders = 0;
            return { changed: old != system.basePointsPlusAdders };
        }

        // Check if we have CONFIG info about this power
        const configPowerInfo = getPowerInfo({
            item: this,
            actor: actor,
        });

        // Base Cost is typically extracted directly from HDC
        let baseCost = parseFloat(system.BASECOST) || 0;

        // Cost per level is NOT included in the HDC file.
        // We will try to get cost per level via config.js
        // Default cost per level will be BASECOST, or 3/2 for skill, or 1 for everything else
        // let costPerLevel = parseFloat(
        //     system.costPerLevel ||
        //         configPowerInfo?.costPerLevel ||
        //         configPowerInfo?.cost ||
        //         (configPowerInfo?.type == "skill" ? 2 : 0) ||
        //         baseCost ||
        //         1,
        // );

        // Default costPerLevel 1
        let costPerLevel = 1;

        // Skills typically cost 2CP for every +1
        if (configPowerInfo?.type == "skill") {
            costPerLevel = 2;
        }

        // Check if configPowerInfo has a more specific costPerLevel
        if (configPowerInfo?.costPerLevel !== undefined) {
            if (typeof configPowerInfo?.costPerLevel === "function") {
                costPerLevel = parseFloat(configPowerInfo?.costPerLevel(this)) || 0;
            } else {
                costPerLevel = parseFloat(configPowerInfo?.costPerLevel) || 0;
            }
        }
        this.system.costPerLevel = costPerLevel;

        // The number of levels for cost is based on the original power, not
        // not any additional modifications or adjustments.
        const levels = parseInt(system.LEVELS) || 0;

        let subCost = costPerLevel * levels;

        // 3 CP per 2 points
        if (costPerLevel == 3 / 2 && subCost % 1) {
            let _threePerTwo = Math.ceil(costPerLevel * levels) + 1;
            subCost = _threePerTwo;
            system.title = (system.title || "") + "3 CP per 2 points; \n+1 level may cost nothing. ";
        }

        if (system.XMLID === "FORCEWALL") {
            // FORCEWALL/BARRIER
            baseCost += parseInt(system.BODYLEVELS) || 0;
            baseCost += parseInt(system.LENGTHLEVELS) || 0;
            baseCost += parseInt(system.HEIGHTLEVELS) || 0;
            baseCost += Math.ceil(parseFloat(system.WIDTHLEVELS * 2)) || 0; // per +½m of thickness
        } else if (system.XMLID === "DUPLICATION") {
            const points = parseInt(system.POINTS || 0);
            const cost = points * configPowerInfo?.costPerLevel;
            baseCost += cost;
        }

        // Start adding up the costs
        let cost = baseCost + subCost;

        if (system.XMLID === "FOLLOWER") {
            cost = Math.ceil((parseInt(system.BASEPOINTS) || 5) / 5);
            let multiplier = Math.ceil(Math.sqrt(parseInt(system.NUMBER) || 0)) + 1;
            cost *= multiplier;
        }

        // ADDERS
        let adderCost = 0;
        for (const adder of system.ADDER || []) {
            // Some adders kindly provide a base cost. Some, however, are 0 and so fallback to the LVLCOST and hope it's provided
            const adderBaseCost = parseInt(adder.BASECOST || adder.LVLCOST) || 0;
            //adder.BASECOST_total = adderBaseCost;

            if (adder.SELECTED != false) {
                //TRANSPORT_FAMILIARITY
                const adderCostPerLevel = parseFloat(adder.LVLCOST || 0) / parseFloat(adder.LVLVAL || 1) || 1;
                const adderLevels = parseInt(adder.LEVELS);
                //adderCost += Math.ceil(adderCostPerLevel * adderLevels);
                adder.BASECOST_total = adderBaseCost + Math.ceil(adderCostPerLevel * adderLevels);

                // WEAPONSMITH (selections over 1 cost only 1)
                if (this.system.XMLID === "WEAPONSMITH" && adderCost > 0) {
                    adder.BASECOST_total = 1;
                }
            } else {
                adder.BASECOST_total = 0;
            }

            adderCost += adder.BASECOST_total;

            adder.BASECOST_total = RoundFavorPlayerDown(adder.BASECOST_total);

            let subAdderCost = 0;

            for (const adder2 of adder.ADDER || []) {
                const adder2BaseCost = adder2.BASECOST;

                if (adder2.SELECTED != false) {
                    let adderLevels = Math.max(1, parseInt(adder2.LEVELS));
                    subAdderCost += Math.ceil(adder2BaseCost * adderLevels);
                    adder2.BASECOST_total = Math.ceil(adder2BaseCost * adderLevels);
                }
            }

            // TRANSPORT_FAMILIARITY checking more than 2 animals costs same as entire category
            if (!adder.SELECTED && subAdderCost > (adderBaseCost || 99)) {
                subAdderCost = adderBaseCost;
            }

            // Riding discount
            if (this.system.XMLID === "TRANSPORT_FAMILIARITY" && this.actor && subAdderCost > 0) {
                if (adder.XMLID === "RIDINGANIMALS" && this.actor.items.find((o) => o.system.XMLID === "RIDING")) {
                    subAdderCost -= 1;
                }
            }

            adderCost += subAdderCost;
        }

        // Categorized skills cost 2 per category and +1 per each subcategory.
        // If no catagories selected then assume 3 pts
        // if (configPowerInfo?.categorized && adderCost >= 4) {
        //     if (adderCost == 0) {
        //         adderCost = 3
        //     } else {
        //         adderCost = Math.floor(adderCost / 2) + 1
        //     }
        // }

        // POWERS (likely ENDURANCERESERVEREC)
        if (system.POWER) {
            for (const adderPower of system.POWER) {
                //const adderBaseCost = parseFloat(adderPower.BASECOST);
                const adderLevels = Math.max(1, parseInt(adderPower.LEVELS));
                const adderPowerInfo = getPowerInfo({
                    item: adderPower,
                    actor: this.actor,
                    is5e: this.is5e,
                });
                const adderCostPerLevel = adderPowerInfo?.costPerLevel || 0;
                adderCost += Math.ceil(adderCostPerLevel * adderLevels);
            }
        }

        cost += adderCost;

        // Cost override
        if (typeof this.baseInfo?.cost === "function") {
            cost = this.baseInfo.cost(this);
            baseCost = 0;
        }

        // INDEPENDENT ADVANTAGE (aka Naked Advantage)
        // NAKEDMODIFIER uses PRIVATE=="No" to indicate NAKED modifier
        //if (system.XMLID == "NAKEDMODIFIER" && system.MODIFIER) {
        if (configPowerInfo?.privateAsAdder && system.MODIFIER) {
            let advantages = 0;
            for (let modifier of (system.MODIFIER || []).filter((o) => !o.PRIVATE)) {
                const modPowerInfo = getPowerInfo({
                    item: modifier,
                    actor: this.actor,
                });

                if (!modPowerInfo) {
                    console.warn("Missing modPowerInfo", modifier);
                }

                // Is there a cost function
                let modCost = modPowerInfo?.cost ? modPowerInfo.cost(modifier, this) : 0;

                // If not use a the default cost formula
                if (!modCost) {
                    const modifierBaseCost = parseFloat(modifier.BASECOST) || 0;
                    modCost += modifierBaseCost;
                    const modifierCostPerLevel =
                        typeof modPowerInfo?.costPerLevel === "function"
                            ? modPowerInfo.costPerLevel(modifier)
                            : modPowerInfo?.costPerLevel || 0;
                    modCost += parseFloat(modifier.LEVELS || 0) * modifierCostPerLevel;
                }

                modifier.BASECOST_total = modCost;
                advantages += modCost;
            }
            cost = cost * advantages;
        }

        // COMPOUNDPOWER itself costs 0, other ITEMS will handle COMPOUNDPOWER sub-powers
        if (this.system.XMLID === "COMPOUNDPOWER") {
            cost = 0;
        }

        system.basePointsPlusAdders = cost;

        //return cost; //Math.max(1, cost)
        return old != system.basePointsPlusAdders;
    }

    // Active Points = (Base Points + cost of any Adders) x (1 + total value of all Advantages)
    calcActivePoints() {
        let system = this.system;

        let advantages = 0;
        let advantagesDC = 0;
        let minAdvantage = 0;
        let endModifierCost = 0;

        const configPowerInfo = getPowerInfo({
            item: this,
            actor: this.actor,
        });

        for (const modifier of (system.MODIFIER || []).filter(
            (mod) =>
                //system.XMLID != "NAKEDMODIFIER" ||
                //!mod.PRIVATE &&
                parseFloat(mod.BASECOST) >= 0,
        )) {
            let _myAdvantage = 0;

            const modPowerInfo = getPowerInfo({
                item: modifier,
                actor: this.actor,
                is5e: this.system.is5e,
            });

            // This may be a limitation with an unusual BASECOST (for example REQUIRESASKILLROLL 14-)
            if (modPowerInfo?.minumumLimitation) {
                continue;
            }

            // Some non-PRIVATE modifiers are considered adders and included in basePointsPlusAdders
            if (configPowerInfo?.privateAsAdder && !modifier.PRIVATE) {
                continue;
            }

            // Is there a cost function
            let modCost = modPowerInfo?.cost ? modPowerInfo.cost(modifier, this) : 0;

            const modifierBaseCost = parseFloat(modifier.BASECOST) || 0;

            // If not use a the default cost formula
            if (!modCost) {
                modCost += modifierBaseCost;
                const modifierCostPerLevel =
                    typeof modPowerInfo?.costPerLevel === "function"
                        ? modPowerInfo.costPerLevel(modifier)
                        : modPowerInfo?.costPerLevel || 0;
                modCost += parseFloat(modifier.LEVELS || 0) * modifierCostPerLevel;
            }

            _myAdvantage += modCost;

            switch (modifier.XMLID) {
                // case "EXPLOSION":
                // case "AOE":
                //     _myAdvantage += modifierBaseCost;
                //     break;

                // case "CUMULATIVE":
                //     // Cumulative, in HD, is 0 based rather than 1 based so a 0 level is a valid value.
                //     _myAdvantage +=
                //         modifierBaseCost + parseInt(modifier.LEVELS) * 0.25;
                //     break;

                case "REDUCEDEND":
                    {
                        // Reduced endurance is double the cost if it's applying against a power with autofire
                        // We track this because we back out the endModifierCost to calculate _activePointsWithoutEndMods.
                        const autofire = (system.MODIFIER || []).find((mod) => mod.XMLID === "AUTOFIRE");
                        if (autofire) {
                            endModifierCost = 2 * modifierBaseCost;
                        } else {
                            endModifierCost = modifierBaseCost;
                        }
                        //_myAdvantage = _myAdvantage + endModifierCost;
                    }
                    break;

                // default:
                //     _myAdvantage +=
                //         modifierBaseCost *
                //         Math.max(1, parseInt(modifier.LEVELS));
            }

            // Some modifiers may have ADDERS
            for (const adder of modifier.ADDER || []) {
                const adderPowerInfo = getPowerInfo({
                    item: adder,
                    actor: this.actor,
                });

                if (!adderPowerInfo) {
                    console.warn(`Missing powerInfo for ${adder.XMLID}`, adder);
                }

                let adderCost = adderPowerInfo?.cost ? adderPowerInfo.cost(adder, this) : 0;

                if (!adderCost) {
                    adderCost += parseFloat(adder.BASECOST);
                    const adderCostPerLevel =
                        typeof adderPowerInfo?.costPerLevel === "function"
                            ? adderPowerInfo.costPerLevel(adder)
                            : adderPowerInfo?.costPerLevel ||
                              parseFloat(adder.LVLCOST || 0) / parseFloat(adder.LVLVAL || 1) ||
                              0;
                    adderCost += parseFloat(adder.LEVELS || 0) * adderCostPerLevel;
                }

                adder.BASECOST_total = adderCost;
                _myAdvantage += adderCost;
                minAdvantage = 0.25;
            }

            // No negative advantages and minimum is 1/4
            advantages += Math.max(minAdvantage, _myAdvantage);
            modifier.BASECOST_total = _myAdvantage;

            // For attacks with Advantages, determine the DCs by
            // making a special Active Point calculation that only counts
            // Advantages that directly affect how the victim takes damage.
            const powerInfo = getPowerInfo({ item: this });
            const modifierInfo = getModifierInfo({
                xmlid: modifier.XMLID,
                item: this,
            });
            if (powerInfo && powerInfo.type?.includes("attack")) {
                if (modifierInfo && modifierInfo.dc) {
                    advantagesDC += Math.max(0, _myAdvantage);
                }
            }
        }

        const _activePoints = system.basePointsPlusAdders * (1 + advantages);
        // if (system.XMLID === "NAKEDMODIFIER") {
        //     _activePoints = parseInt(system.LEVELS) * advantages;
        // }
        system.activePointsDc = RoundFavorPlayerDown(system.basePointsPlusAdders * (1 + advantagesDC));

        // HALFEND is based on active points without the HALFEND modifier
        if (this.findModsByXmlid("REDUCEDEND")) {
            system._activePointsWithoutEndMods = system.basePointsPlusAdders * (1 + advantages - endModifierCost);
        }

        let old = system.activePoints;
        system.activePoints = RoundFavorPlayerDown(_activePoints || 0);

        //return RoundFavorPlayerDown(_activePoints)
        const changed = old !== system.activePoints;
        return changed;
    }

    calcRealCost() {
        const system = this.system;

        // Real Cost = Active Cost / (1 + total value of all Limitations)

        // This may be a slot in a framework if so get parent

        let modifiers = (system.MODIFIER || []).filter(
            (o) =>
                parseFloat(o.BASECOST) < 0 ||
                getPowerInfo({
                    item: o,
                    actor: this.actor,
                })?.minumumLimitation,
        );

        // Add limitations from parent
        if (this.parentItem) {
            modifiers.push(...(this.parentItem.system.MODIFIER || []).filter((o) => parseFloat(o.BASECOST) < 0));
        }

        let limitations = 0;
        for (let modifier of modifiers) {
            let _myLimitation = 0;

            const modPowerInfo = getPowerInfo({
                item: modifier,
                actor: this.actor,
                is5e: this.is5e,
            });
            if (!modPowerInfo) {
                console.warn(`Missing powerInfo for ${modifier.XMLID}`, modifier);
            }

            const modifierBaseCost = parseFloat(modifier.BASECOST || 0);
            _myLimitation += -modifierBaseCost;

            // Some modifiers may have ADDERS as well (like a focus)
            for (let adder of modifier.ADDER || []) {
                let adderBaseCost = parseFloat(adder.BASECOST || 0);

                // Unique situation where JAMMED floors the limitation
                // if (adder.XMLID == "JAMMED" && _myLimitation == 0.25) {
                //     system.title =
                //         (system.title || "") +
                //         "Limitations are below the minimum of -1/4; \nConsider removing unnecessary limitations.";
                //     adderBaseCost = 0;
                // }

                // can be positive or negative (like charges).
                // Requires a roll gets interesting with Jammed / Can choose which of two rolls to make from use to use
                _myLimitation += -adderBaseCost;

                const multiplier = Math.max(1, parseFloat(adder.MULTIPLIER || 0));
                _myLimitation *= multiplier;
            }

            // NOTE: REQUIRESASKILLROLL The minimum value is -1/4, regardless of modifiers.
            if (_myLimitation < 0.25) {
                console.warn(`${modifier.XMLID} Limitation clamped to -1/4`, modifier, this);
                _myLimitation = 0.25;
                system.title =
                    (system.title || "") +
                    "Limitations are below the minimum of -1/4; \nConsider removing unnecessary limitations.";
            }

            modifier.BASECOST_total = -_myLimitation;

            limitations += _myLimitation;
        }

        let _realCost = system.activePoints;

        // Skill Enhancer discount (min cost of 1)
        if (this.parentItem?.baseInfo?.type.includes("enhancer")) {
            _realCost = Math.max(1, _realCost - 1);

            // NATIVE_TONGUE is always free
            if (this.system.NATIVE_TONGUE) {
                _realCost = 0;
            }
        }

        // Power cost in Power Framework is applied before limitations
        let costSuffix = "";
        if (this.parentItem) {
            if (this.parentItem.system.XMLID === "MULTIPOWER") {
                // Fixed
                if (this.system.ULTRA_SLOT) {
                    costSuffix = this.actor?.system.is5e ? "u" : "f";
                    _realCost /= 10.0;
                }

                // Variable
                else {
                    costSuffix = this.actor?.system.is5e ? "m" : "v";
                    _realCost /= 5.0;
                }
            } else if (this.parentItem.system.XMLID === "ELEMENTAL_CONTROL") {
                _realCost = _realCost - this.parentItem.system.BASECOST;
            }
        }

        _realCost = _realCost / (1 + limitations);

        // ADD_MODIFIERS_TO_BASE
        if (this.system.ADD_MODIFIERS_TO_BASE && this.actor) {
            const _base = this.actor.system.characteristics[this.system.XMLID.toLowerCase()].core;
            const _cost = getPowerInfo({ xmlid: this.system.XMLID, actor: this.actor }).costPerLevel || 1;
            const _baseCost = _base * _cost;
            const _discount = _baseCost - RoundFavorPlayerDown(_baseCost / (1 + limitations));
            _realCost -= _discount;
        }

        _realCost = RoundFavorPlayerDown(_realCost);

        // Minimum cost
        if (_realCost == 0 && system.activePoints > 0) {
            _realCost = 1;
        }

        let old = system.realCost;
        system.realCost = _realCost + costSuffix;

        const changed = old != system.realCost;
        return changed;
    }

    updateItemDescription() {
        // Description (eventual goal is to largely match Hero Designer)
        // TODO: This should probably be moved to the sheets code
        // so when the power is modified in foundry, the power
        // description updates as well.
        // If in sheets code it may handle drains/suppresses nicely.

        const system = this.system;
        const type = this.type;
        const is5e = !!this.actor?.system.is5e;

        // Reset the description and build it up again.
        system.description = "";

        const configPowerInfo = this.baseInfo;
        const powerXmlId = system.XMLID;

        switch (powerXmlId) {
            case "DENSITYINCREASE":
                // Density Increase (400 kg mass, +10 STR, +2 PD/ED, -2" KB); IIF (-1/4)
                system.description = `${system.ALIAS} (${Math.pow(system.value, 2) * 100} kg mass, +${
                    system.value * 5
                } STR, +${system.value} PD/ED, -${
                    this.actor?.system.is5e ? system.value + '"' : system.value * 2 + "m"
                } KB)`;
                break;

            case "GROWTH": {
                // Growth6e (+15 STR, +5 CON, +5 PRE, +3 PD, +3 ED, +3 BODY, +6 STUN, +1m Reach, +12m Running, -6m KB, 101-800 kg, +2 to OCV to hit, +2 to PER Rolls to perceive character, 2-4m tall, 1-2m wide) // Growth5e (+5 STR, +1 BODY, +1 STUN, -1" KB, 200 kg, +0 DCV, +0 PER Rolls to perceive character, 2 m tall, 1 m wide)
                // Growth6e is a static template.  LEVELS are ignored, instead use OPTIONID.
                const details = configPowerInfo?.details(this) || {};
                system.description = `${system.ALIAS} (`;
                system.description += `+${details.str} STR`;
                if (!this.is5e) {
                    system.description += `, +${details.con} CON`;
                }
                if (!this.is5e) {
                    system.description += `, +${details.pre} PRE`;
                }
                if (!this.is5e) {
                    system.description += `, +${details.pd} PD`;
                }
                if (!this.is5e) {
                    system.description += `, +${details.ed} ED`;
                }
                system.description += `, +${details.body} BODY`;
                system.description += `, +${details.stun} STUN`;
                system.description += `, +${details.reach}${this.is5e ? '"' : "m"} Reach`;
                if (!this.is5e) {
                    system.description += `, +${details.running}m Running`;
                }
                system.description += `, -${details.kb}${this.is5e ? '"' : "m"}
                KB`;
                system.description += `, ${details.mass}`;
                system.description += `, -${details.dcv} DCV`;
                system.description += `, +${details.perception} to PER Rolls to perceive character`;
                system.description += `, ${details.tall}m tall`;
                system.description += `, ${details.wide}m wide`;
                system.description += `)`;
                break;
            }

            case "SHRINKING":
                // 6e Shrinking (1 m tall, 12.5 kg mass, -2 PER Rolls to perceive character, +2 DCV, takes +6m KB)
                // 5e Shrinking (1 m tall, 12.5 kg mass, -2 PER Rolls to perceive character, +2 DCV) -- Also +3" KB which is not in HD
                system.description = `${system.ALIAS} (`;
                system.description += `${(2 / Math.pow(2, parseInt(system.value)))
                    .toPrecision(3)
                    .replace(/\.?0+$/, "")} m tall`;
                system.description += `, ${(100 / Math.pow(8, parseInt(system.value)))
                    .toPrecision(4)
                    .replace(/\.?0+$/, "")}
                kg mass`;
                system.description += `, -${system.value * 2} PER Rolls to perceive character`;
                system.description += `, +${system.value * 2} DCV`;
                system.description += `, takes +${
                    system.value * (this.is5e ? 3 : 6) + getSystemDisplayUnits(this.is5e)
                } KB`;

                break;

            case "MENTALDEFENSE":
            case "POWERDEFENSE":
                system.description = `${system.ALIAS} ${system.value} points`;
                break;

            case "FLASHDEFENSE":
                system.description = `${system.OPTION_ALIAS} ${system.ALIAS} (${system.value} points)`;
                break;

            case "FOLLOWER":
                system.description = system.ALIAS.replace("Followers: ", "");
                break;

            case "MINDSCAN":
                {
                    const diceFormula = getDiceFormulaFromItemDC(this, convertToDcFromItem(this).dc);
                    system.description = `${diceFormula} ${system.ALIAS}`;
                }
                break;

            case "FORCEFIELD":
            case "ARMOR":
            case "DAMAGERESISTANCE":
                {
                    system.description = system.ALIAS + " (";

                    let ary = [];
                    if (parseInt(system.PDLEVELS)) ary.push(system.PDLEVELS + " rPD");
                    if (parseInt(system.EDLEVELS)) ary.push(system.EDLEVELS + " rED");
                    if (parseInt(system.MDLEVELS)) ary.push(system.MDLEVELS + " rMD");
                    if (parseInt(system.POWDLEVELS)) ary.push(system.POWDLEVELS + " rPOW");

                    system.description += ary.join("/") + ")";
                }
                break;

            case "FORCEWALL":
                {
                    system.description = system.ALIAS + " ";

                    let aryFW = [];
                    if (parseInt(system.PDLEVELS)) aryFW.push(system.PDLEVELS + " rPD");
                    if (parseInt(system.EDLEVELS)) aryFW.push(system.EDLEVELS + " rED");
                    if (parseInt(system.MDLEVELS)) aryFW.push(system.MDLEVELS + " rMD");
                    if (parseInt(system.POWDLEVELS)) aryFW.push(system.POWDLEVELS + " rPOW");
                    if (parseInt(system.BODYLEVELS)) aryFW.push(system.BODYLEVELS + " BODY");

                    system.description += aryFW.join("/");
                    system.description += `(up to ${parseInt(system.LENGTHLEVELS) + 1}m long, and ${
                        parseInt(system.HEIGHTLEVELS) + 1
                    }m tall, and ${parseFloat(system.WIDTHLEVELS) + 0.5}m thick)`;
                }
                break;

            case "ABSORPTION":
                {
                    const reduceAndEnhanceTargets = this.splitAdjustmentSourceAndTarget();
                    const diceFormula = getDiceFormulaFromItemDC(this, convertToDcFromItem(this).dc);

                    system.description = `${system.ALIAS} ${is5e ? `${diceFormula}` : `${system.value} BODY`} (${
                        system.OPTION_ALIAS
                    }) to ${
                        reduceAndEnhanceTargets.valid
                            ? reduceAndEnhanceTargets.enhances || reduceAndEnhanceTargets.reduces
                            : "unknown"
                    }`;
                }
                break;

            case "AID":
            case "DISPEL":
            case "DRAIN":
            case "SUCCOR":
            case "SUPPRESS":
            case "HEALING":
                {
                    const reduceAndEnhanceTargets = this.splitAdjustmentSourceAndTarget();
                    const diceFormula = getDiceFormulaFromItemDC(this, convertToDcFromItem(this).dc);

                    system.description = `${system.ALIAS} ${
                        reduceAndEnhanceTargets.valid
                            ? reduceAndEnhanceTargets.enhances || reduceAndEnhanceTargets.reduces
                            : "unknown"
                    } ${diceFormula}`;
                }
                break;

            case "TRANSFER":
                {
                    const reduceAndEnhanceTargets = this.splitAdjustmentSourceAndTarget();
                    const diceFormula = getDiceFormulaFromItemDC(this, convertToDcFromItem(this).dc);

                    system.description = `${system.ALIAS} ${diceFormula} from ${
                        reduceAndEnhanceTargets.valid ? reduceAndEnhanceTargets.reduces : "unknown"
                    } to ${reduceAndEnhanceTargets.valid ? reduceAndEnhanceTargets.enhances : "unknown"}`;
                }
                break;

            case "TRANSFORM":
                {
                    const diceFormula = getDiceFormulaFromItemDC(this, convertToDcFromItem(this).dc);
                    system.description = `${system.OPTION_ALIAS} ${system.ALIAS} ${diceFormula}`;
                }
                break;

            case "STRETCHING":
                system.description = `${system.ALIAS} ${system.value}${getSystemDisplayUnits(this.is5e)}`;
                break;

            case "LEAPING":
            case "RUNNING":
            case "SWIMMING":
                // Running +25m (12m/37m total)
                system.description = `${system.ALIAS} +${system.value}${getSystemDisplayUnits(this.is5e)}`;
                break;

            case "GLIDING":
            case "FLIGHT":
            case "TELEPORTATION":
            case "SWINGING":
                system.description = `${system.ALIAS} ${system.value}${getSystemDisplayUnits(this.is5e)}`;
                break;
            case "TUNNELING":
                {
                    // Tunneling 22m through 10 PD materials
                    let pd;
                    if (this.actor?.system.is5e) {
                        pd = parseInt(system.value);
                    } else {
                        const defbonus = (system.ADDER || []).find((o) => o.XMLID == "DEFBONUS");
                        pd = 1 + parseInt(defbonus?.LEVELS || 0);
                    }

                    system.description = `${system.ALIAS} ${system.value}${getSystemDisplayUnits(
                        this.is5e,
                    )} through ${pd} PD materials`;
                }
                break;

            case "NAKEDMODIFIER":
                // Area Of Effect (8m Radius; +1/2) for up to 53 Active Points of STR
                // Naked Advantage: Reduced Endurance (0 END; +1/2) for up to 70 Active Points (35 Active Points); Gestures (Requires both hands; -1/2), Linked to Opening of the Blind, Third Eye (Opening of the Blind, Third Eye; -1/4), Visible (Tattoos of flames encompass the biceps and shoulders.  When this power is active, these flames appear to burn, emitting firelight.  ; -1/4)
                system.description = `${system.ALIAS} for up to ${system.value} Active points`;
                if (system.INPUT) {
                    system.description += ` of ${system.INPUT}`;
                }
                break;

            case "DEFENSE_MANEUVER":
                system.description = system.ALIAS + " " + system.OPTION_ALIAS;
                break;

            case "LANGUAGES":
                //English:  Language (basic conversation) (1 Active Points)
                system.description = system.INPUT || system.ALIAS;
                if (system.OPTION_ALIAS) {
                    system.description += " (" + system.OPTION_ALIAS + ")";
                }
                break;

            case "ANALYZE":
            case "PROFESSIONAL_SKILL":
            case "KNOWLEDGE_SKILL":
            case "SCIENCE_SKILL":
                {
                    // KS: types of brain matter 11-, PS: Appraise 11-, or SS: tuna batteries 28-
                    const { roll } = this._getSkillRollComponents(system);
                    system.description = `${system.ALIAS ? system.ALIAS + ": " : ""}${system.INPUT} ${roll}`;
                    this.name = system.NAME || `${this.system.ALIAS}: ${this.system.INPUT?.trim()}`;
                }
                break;

            case "CONTACT":
                {
                    const levels = parseInt(system.LEVELS || 1);
                    system.description = `${system.ALIAS} ${levels === 1 ? "8-" : `${9 + levels}-`}`;
                }
                break;

            case "ACCIDENTALCHANGE":
            case "DEPENDENCE":
            case "DEPENDENTNPC":
            case "DISTINCTIVEFEATURES":
            case "ENRAGED":
            case "HUNTED":
            case "MONEYDISAD":
            case "PSYCHOLOGICALLIMITATION":
            case "PHYSICALLIMITATION":
            case "RIVALRY":
            case "SOCIALLIMITATION":
            case "SUSCEPTIBILITY":
            case "VULNERABILITY":
                // Disadvantage: blah blah blah
                system.description = `${system.ALIAS}: `;
                break;

            case "UNLUCK":
                system.description = `${system.ALIAS}`;
                break;

            case "REPUTATION":
                // There are 2 types of reputation - positive, a perk, and negative, a disadvantage. Both share an XMLID.
                if (this.type === "disadvantage") {
                    system.description = `${system.ALIAS}: `;
                } else {
                    system.description = `${system.ALIAS}: ${
                        system.LEVELS ? `+${system.LEVELS}/+${system.LEVELS}d6 ` : ""
                    }`;
                }

                break;

            case "TRANSPORT_FAMILIARITY":
                //TF:  Custom Adder, Small Motorized Ground Vehicles
                //TF:  Equines, Small Motorized Ground Vehicles
                system.description = `${system.ALIAS}: `;
                break;

            case "PENALTY_SKILL_LEVELS":
                system.description = (system.NAME || system.ALIAS) + ": +" + system.value + " " + system.OPTION_ALIAS;

                // Penalty details
                switch (system.penalty) {
                    case "range":
                        system.description = system.description.replace(
                            "a specific negative OCV modifier",
                            "range OCV penalties",
                        );
                        break;
                }
                break;

            case "RKA":
            case "HKA":
            case "ENERGYBLAST":
            case "EGOATTACK":
            case "MINDCONTROL":
            case "HANDTOHANDATTACK":
                {
                    const diceFormula = getDiceFormulaFromItemDC(this, convertToDcFromItem(this).dc);
                    system.description = `${system.ALIAS} ${diceFormula}`;
                }
                break;

            case "KBRESISTANCE":
                system.description =
                    (system.INPUT ? system.INPUT + " " : "") +
                    (system.OPTION_ALIAS || system.ALIAS) +
                    ` -${system.value}m`;
                break;

            case "ENTANGLE":
                {
                    // Entangle 2d6, 7 PD/2 ED
                    const pd_entangle =
                        parseInt(system.value || 0) + parseInt(this.findModsByXmlid("ADDITIONALPD")?.LEVELS || 0);
                    const ed_entangle =
                        parseInt(system.value || 0) + parseInt(this.findModsByXmlid("ADDITIONALED")?.LEVELS || 0);
                    system.description = `${system.ALIAS} ${system.value}d6, ${pd_entangle} PD/${ed_entangle} ED`;
                }
                break;

            case "ELEMENTAL_CONTROL":
                // Elemental Control, 12-point powers
                system.description = `${system.NAME || system.ALIAS}, ${parseInt(system.BASECOST) * 2}-point powers`;
                break;

            case "MANEUVER":
                {
                    system.description = "";

                    // Offensive Strike:  1/2 Phase, -2 OCV, +1 DCV, 8d6 Strike
                    // Killing Strike:  1/2 Phase, -2 OCV, +0 DCV, HKA 1d6 +1
                    if (system.PHASE) system.description += ` ${system.PHASE} Phase`;
                    const ocv = parseInt(system.ocv || system.OCV);
                    const dcv = parseInt(system.dcv || system.DCV);
                    if (isNaN(ocv)) {
                        system.description += `, -- OCV`;
                    } else {
                        system.description += `, ${ocv.signedString()} OCV`;
                    }
                    system.description += `, ${dcv.signedString()} DCV`;
                    if (system.EFFECT) {
                        let dc = convertToDcFromItem(this).dc;
                        if (system.EFFECT.search(/\[STRDC\]/) > -1) {
                            const effectiveStrength = 5 * dc;
                            system.description += `, ${system.EFFECT.replace("[STRDC]", `${effectiveStrength} STR`)}`;
                        } else if (dc) {
                            const damageDiceFormula = getDiceFormulaFromItemDC(this, dc);
                            if (damageDiceFormula) {
                                system.description += `,`;

                                if (system.CATEGORY === "Hand To Hand" && system.EFFECT.indexOf("KILLING") > -1) {
                                    system.description += " HKA";
                                }

                                const dice = system.EFFECT.replace("[NORMALDC]", damageDiceFormula)
                                    .replace("[KILLINGDC]", damageDiceFormula)
                                    .replace("[FLASHDC]", damageDiceFormula);

                                system.description += ` ${dice}`;
                            }
                        } else {
                            system.description += ", " + system.EFFECT;
                        }
                    }
                }
                break;

            case "TELEKINESIS":
                //Psychokinesis:  Telekinesis (62 STR), Alternate Combat Value (uses OMCV against DCV; +0)
                // (93 Active Points); Limited Range (-1/4), Only In Alternate Identity (-1/4),
                // Extra Time (Delayed Phase, -1/4), Requires A Roll (14- roll; -1/4)
                system.description = `${system.ALIAS} (${system.value} STR)`;
                break;

            case "MENTAL_COMBAT_LEVELS":
            case "COMBAT_LEVELS":
                // +1 with any single attack
                system.description = `${system.ALIAS}: +${system.value} ${system.OPTION_ALIAS}`;
                break;

            case "WEAPON_MASTER":
                // Weapon Master:  +1d6 (all Ranged Killing Damage weapons)
                system.ALIAS = "Weapon Master";
                system.description = `${system.ALIAS}: +${parseInt(system.LEVELS) * 3}DC (${system.OPTION_ALIAS})`;
                break;

            case "DEADLYBLOW":
                // Deadly Blow:  +1d6 ([very limited circumstances])
                system.ALIAS = "Deadly Blow";
                system.description = `${system.ALIAS}: +${parseInt(system.LEVELS) * 3}DC (${system.OPTION_ALIAS})`;
                break;

            case "RESISTANCE":
                system.description = `Resistance (+${parseInt(system.LEVELS)} to roll)`;
                system.ALIAS = system.description;
                if (this.name.match(/Resistance \(\+\d+ to roll\)/)) {
                    this.name = system.NAME || system.ALIAS;
                }
                break;

            case "COMBAT_LUCK":
                system.description = `Combat Luck (${3 * system.value} rPD/${3 * system.value} rED)`;
                // Check to make sure ALIAS is largely folling default format before overriding
                if (this.name.trim().length <= 1 || this.name.match(/Combat Luck \(\d+ rPD\/\d+ rED\)/)) {
                    system.ALIAS = system.description;
                    this.name = system.NAME || system.ALIAS;
                }
                break;

            case "DARKNESS":
            case "INVISIBILITY":
                // Invisibility to Hearing and Touch Groups  (15 Active Points); Conditional Power Only vs organic perception (-1/2)
                break;

            case "ENDURANCERESERVE":
                {
                    // Endurance Reserve  (20 END, 5 REC) (9 Active Points)
                    system.description = system.ALIAS || system.XMLID;

                    const ENDURANCERESERVEREC = this.findModsByXmlid("ENDURANCERESERVEREC");
                    if (ENDURANCERESERVEREC) {
                        if (parseInt(system.value) === parseInt(system.max)) {
                            system.description += ` (${system.max} END, ${ENDURANCERESERVEREC.LEVELS} REC)`;
                        } else {
                            system.description += ` (${system.value}/${system.max} END, ${ENDURANCERESERVEREC.LEVELS} REC)`;
                        }
                    }
                }
                break;

            case "SKILL_LEVELS":
                //<i>Martial Practice:</i>  +10 with single Skill or Characteristic Roll
                system.description = `${parseInt(system.value).signedString()} ${system.OPTION_ALIAS}`;
                break;

            case "VPP":
            case "MULTIPOWER":
                // <i>Repligun:</i>  Multipower, 60-point reserve, all slots Reduced Endurance (0 END; +1/2) (90 Active Points); all slots OAF Durable Expendable (Difficult to obtain new Focus; Ray gun; -1 1/4)
                system.description = `${system.NAME || system.ALIAS}, ${parseInt(system.BASECOST)}-point reserve`;
                break;

            case "FLASH":
                {
                    //Sight and Hearing Groups Flash 5 1/2d6
                    //Sight, Hearing and Mental Groups, Normal Smell, Danger Sense and Combat Sense Flash 5 1/2d6
                    // Groups
                    let _groups = [system.OPTION_ALIAS];
                    for (let addr of (system.ADDER || []).filter((o) => o.XMLID.indexOf("GROUP") > -1)) {
                        _groups.push(addr.ALIAS);
                    }
                    if (_groups.length === 1) {
                        system.description = _groups[0];
                    } else {
                        system.description = _groups
                            .slice(0, -1)
                            .join(", ")
                            .replace(/ Group/g, "");
                        system.description += " and " + _groups.slice(-1) + "s";
                    }

                    // singles
                    const _singles = [];
                    for (let addr of (system.ADDER || []).filter(
                        (o) =>
                            o.XMLID.indexOf("GROUP") === -1 &&
                            o.XMLID.match(/(NORMAL|SENSE|MINDSCAN|HRRP|RADAR|RADIO|MIND|AWARENESS)/),
                    )) {
                        _singles.push(addr.ALIAS);
                    }
                    if (_singles.length === 1) {
                        system.description += ", " + _singles[0];
                    } else {
                        system.description += ", " + _singles.slice(0, -1).join(", ");
                        system.description += " and " + _singles.slice(-1);
                    }

                    const diceFormula = getDiceFormulaFromItemDC(this, convertToDcFromItem(this).dc);
                    system.description += ` ${system.ALIAS} ${diceFormula}`;
                }
                break;

            case "EXTRADIMENSIONALMOVEMENT":
                system.description = `${system.ALIAS} ${system.OPTION_ALIAS}`;
                break;

            case "PERCEPTION":
                // Skill added by system and not in HDC
                system.description = "Perception";
                break;

            case "CLINGING":
                {
                    if (!this.actor) {
                        system.description = `${system.ALIAS}`;
                    } else {
                        const baseStr = this.actor.system.characteristics.str.value;
                        const additionalClingingStr = system.value;
                        const totalStr = baseStr + additionalClingingStr;
                        system.description = `${system.ALIAS} (${baseStr} + ${additionalClingingStr} = ${totalStr} STR)`;
                    }
                }
                break;

            case "Advanced Tech":
            case "AMBIDEXTERITY":
            case "COMBATSPELLCASTING":
            case "MONEY":
            case "SHAPECHANGING":
            case "SKILLMASTER":
                system.description = `${system.ALIAS} (${system.OPTION_ALIAS})`;
                break;

            case "ENVIRONMENTAL_MOVEMENT":
                system.description = `${system.ALIAS} (${system.INPUT})`;
                break;

            case "DUPLICATION":
                {
                    const points = parseInt(system.POINTS);
                    system.description = `${system.ALIAS} (creates ${points}-point form)`;
                }
                break;

            case "SHAPESHIFT":
                system.description = `${system.ALIAS} (${system.OPTION_ALIAS})`;
                break;

            case "FINDWEAKNESS":
                {
                    const { roll } = this._getNonCharacteristicsBasedRollComponents(system);

                    system.description = `${system.ALIAS} ${roll} with ${system.OPTION_ALIAS}`;
                }
                break;

            case "DANGER_SENSE":
                {
                    const { roll } = this._getNonCharacteristicsBasedRollComponents(system);

                    system.description = `${system.ALIAS} ${roll}`;
                }
                break;

            case "ACTIVESONAR":
            case "HRRP":
            case "INFRAREDPERCEPTION":
            case "NRAYPERCEPTION":
            case "RADAR":
            case "RADIOPERCEIVETRANSMIT":
            case "RADIOPERCEPTION":
            case "SPATIALAWARENESS":
            case "ULTRASONICPERCEPTION":
            case "ULTRAVIOLETPERCEPTION":
                system.description = `${system.ALIAS} (${system.GROUP})`;
                break;

            case "DETECT":
                system.description = `${system.ALIAS} ${system.OPTION_ALIAS} (${system.GROUP})`;
                break;

            case "ENHANCEDPERCEPTION":
                {
                    const levels = parseInt(system.LEVELS || 0);
                    system.description = `${system.ALIAS} +${levels} PER with ${system.OPTION_ALIAS}`;
                }
                break;

            case "TELESCOPIC":
                {
                    const levels = parseInt(system.LEVELS || 0);
                    system.description = `${system.ALIAS} +${levels} range modifier for ${system.OPTION_ALIAS}`;
                }
                break;

            case "CONCEALED":
                {
                    const levels = parseInt(system.LEVELS || 0);
                    system.description = `${system.ALIAS} (-${levels} PER to ${system.OPTION_ALIAS})`;
                }
                break;

            case "RAPID":
                {
                    const factor = Math.pow(10, parseInt(system.LEVELS || 1));
                    system.description = `${system.ALIAS} (x${factor}) with ${system.OPTION_ALIAS})`;
                }
                break;

            case "CLAIRSENTIENCE":
            case "ANALYZESENSE":
            case "DIMENSIONALSINGLE":
            case "DIMENSIONALGROUP":
            case "DIMENSIONALALL":
            case "DISCRIMINATORY":
            case "INCREASEDARC240":
            case "INCREASEDARC360":
            case "MAKEASENSE":
            case "MICROSCOPIC":
            case "RANGE":
            case "TARGETINGSENSE":
            case "TRACKINGSENSE":
            case "TRANSMIT":
                system.description = `${system.ALIAS} with ${system.OPTION_ALIAS}`;
                break;

            case "MENTALAWARENESS":
            case "NIGHTVISION":
                system.description = `${system.ALIAS}`;
                break;

            default:
                {
                    if (configPowerInfo?.type?.includes("characteristic")) {
                        system.description = "+" + system.value + " " + system.ALIAS;
                        break;
                    }

                    if (configPowerInfo?.type?.includes("skill")) {
                        const { roll } = this._getSkillRollComponents(system);
                        system.description = system.ALIAS;
                        this.name = system.NAME || system.ALIAS;
                        if (system?.INPUT) {
                            system.description += `: ${system.INPUT}`;
                            this.name += `: ${system.INPUT}`;
                        }
                        // Skill enhancer?
                        if (roll) {
                            system.description += ` ${roll}`;
                        }
                        break;
                    }

                    // Provide a basic description
                    const _desc = system.OPTION_ALIAS || system.ALIAS || system.EFFECT || "";
                    system.description = (system.INPUT ? system.INPUT + " " : "") + _desc;

                    // Provide dice if this is an attack
                    // TODO: Look at behaviors
                    const value2 = getDiceFormulaFromItemDC(this, convertToDcFromItem(this).dc);
                    if (value2 && !isNaN(value2)) {
                        if (system.description.indexOf(value2) === -1) {
                            system.description = ` ${value2} ${system.class || ""}`;
                        }
                    }

                    // Add a success roll, if it has one, but only for skills, talents, or perks
                    if (
                        configPowerInfo?.behaviors?.includes("success") &&
                        configPowerInfo?.type?.find((type) => ["skill", "talent", "perk"].includes(type))
                    ) {
                        system.description += ` ${system.roll}`;
                    }
                }
                break;
        }

        // ADDRS
        let _adderArray = [];

        if (system.XMLID === "INVISIBILITY" || system.XMLID === "DARKNESS") {
            _adderArray.push(system.OPTION_ALIAS);
        }

        // The INPUT field isn't always displayed in HD so that is not strictly compatible, but it does mean that we will show things
        // like a ranged killing attack being ED vs PD in the power description.
        if (system?.INPUT) {
            switch (powerXmlId) {
                case "ABSORPTION":
                case "AID":
                case "DISPEL":
                case "DRAIN":
                case "HEALING":
                case "SUPPRESS":
                case "TRANSFER":
                    break;

                case "PROFESSIONAL_SKILL":
                case "KNOWLEDGE_SKILL":
                case "SCIENCE_SKILL":
                    break;

                default:
                    if (configPowerInfo?.type?.includes("skill")) {
                        break;
                    }

                    _adderArray.push(system.INPUT);
                    break;
            }
        }

        if (system?.ADDER?.length > 0 || _adderArray.length > 0) {
            for (const adder of system?.ADDER || []) {
                switch (adder.XMLID) {
                    case "DIMENSIONS":
                        system.description += `, ${adder.ALIAS}`;
                        break;

                    case "ATTACK":
                    case "EATING":
                    case "EXTENDEDBREATHING":
                    case "IMMUNITY":
                    case "LONGEVITY":
                    case "RECOGNIZED":
                    case "SLEEPING":
                    case "USEFUL":
                        _adderArray.push(`${adder.ALIAS} ${adder.OPTION_ALIAS}`);
                        break;

                    case "ADDITIONALPD":
                    case "ADDITIONALED":
                    case "DEFBONUS":
                        break;

                    case "DAMAGE":
                        // Unfortunately DAMAGE is used as an adder for both SUSCEPTIBILITY and CHANGEENVIRONMENT. They do not
                        // share a structure.
                        if (powerXmlId === "CHANGEENVIRONMENT") {
                            _adderArray.push(`, ${adder.ALIAS}`);
                        } else {
                            _adderArray.push(adder.OPTION_ALIAS.replace("(", ""));
                        }
                        break;

                    case "APPEARANCE":
                    case "AREA":
                    case "CAPABILITIES":
                    case "CHANCETOGO":
                    case "CHANCETORECOVER":
                    case "CIRCUMSTANCES":
                    case "CONCEALABILITY":
                    case "CONDITION":
                    case "DESCRIPTION":
                    case "DICE":
                    case "EFFECT":
                    case "EFFECTS":
                    case "FIERCENESS":
                    case "HOWWELL":
                    case "HOWWIDE":
                    case "IMPAIRS":
                    case "INTENSITY":
                    case "KNOWLEDGE":
                    case "LEVEL":
                    case "MOTIVATION":
                    case "OCCUR":
                    case "OCCURS":
                    case "POWER":
                    case "REACTION":
                    case "SENSING":
                    case "SENSITIVITY":
                    case "SITUATION":
                    case "SUBSTANCE":
                    case "TIME":
                    case "USEFULNESS":
                        _adderArray.push(adder.OPTION_ALIAS.replace("(", ""));
                        break;

                    case "PHYSICAL":
                    case "ENERGY":
                    case "MENTAL":
                        // Damage Negation (-1 DCs Energy)
                        if (system.XMLID === "DAMAGENEGATION") {
                            if (parseInt(adder.LEVELS) != 0)
                                _adderArray.push(
                                    "-" + parseInt(adder.LEVELS) + " DCs " + adder.ALIAS.replace(" DCs", ""),
                                );
                        } else {
                            if (parseInt(adder.LEVELS) != 0)
                                _adderArray.push("-" + parseInt(adder.LEVELS) + " " + adder.ALIAS);
                        }
                        break;

                    case "PLUSONEPIP":
                    case "MINUSONEPIP":
                    case "PLUSONEHALFDIE":
                        // Don't show the +1, 1/2d6, 1d6-1 modifier as it's already included in the description's dice formula
                        break;

                    case "COMMONMOTORIZED":
                    case "RIDINGANIMALS":
                        // Both of these Transport Familiarity adders may contain subadders. If they do, then use the subadders
                        // otherwise use the adder.
                        if (adder.SELECTED) {
                            _adderArray.push(adder.ALIAS);
                        } else {
                            for (const adder2 of adder?.ADDER || []) {
                                _adderArray.push(adder2.ALIAS);
                            }
                        }
                        break;

                    case "INCREASEDMAX":
                        // Typical ALIAS would be "Increased Maximum (+34 points)". Provide total as well.
                        // Can Add Maximum Of 34 Points
                        //_adderArray.push(
                        // `${adder.ALIAS} (${determineMaxAdjustment(
                        //     this,
                        // )} total points)`,
                        system.description += `, Can Add Maximum Of ${determineMaxAdjustment(this)} Points`;
                        //);
                        break;

                    case "ADDER":
                        // This is likely a CSL adder that we use to specificy which attacks the CSL applies to.
                        // If the CLS applies to ALL attacks, don't bother to list them all.
                        if (this.system.XMLID === "COMBAT_LEVELS" && this.system.OPTIONID === "ALL") break;
                        if (this.system.XMLID === "MENTAL_COMBAT_LEVELS" && this.system.OPTIONID === "ALL") break;

                        // Otherwise add it to the list of ADDERS as normal.
                        if (adder.ALIAS.trim()) {
                            _adderArray.push(adder.ALIAS);
                        }
                        break;

                    default:
                        if (adder.ALIAS.trim()) {
                            _adderArray.push(adder.ALIAS);
                        }
                        break;
                }
            }

            if (_adderArray.length > 0) {
                switch (powerXmlId) {
                    case "TRANSPORT_FAMILIARITY":
                        system.description += _adderArray.sort().join(", ");
                        break;

                    case "DARKNESS":
                    case "INVISIBILITY":
                        {
                            system.description += system.ALIAS + " to ";
                            // Groups
                            let _groups = _adderArray.filter((o) => o.indexOf("Group") > -1);
                            if (_groups.length === 1) {
                                system.description += _groups[0];
                            } else {
                                system.description += _groups
                                    .slice(0, -1)
                                    .join(", ")
                                    .replace(/ Group/g, "");
                                system.description += " and " + _groups.slice(-1) + "s";
                            }

                            // singles
                            let _singles = _adderArray.filter((o) => o.indexOf("Group") === -1);
                            // spacing
                            if (_groups.length > 0 && _singles.length > 0) {
                                system.description += ", ";
                            }

                            if (_singles.length === 1) {
                                system.description += _singles[0];
                            } else if (_singles.length > 1) {
                                system.description += _singles.slice(0, -1).join(", ");
                                system.description += " and " + _singles.slice(-1);
                            }
                        }

                        break;

                    case "FLASH":
                        // The senses are already in the description
                        system.description +=
                            " (" +
                            _adderArray
                                .filter(
                                    (o) => !o.match(/(GROUP|NORMAL|SENSE|MINDSCAN|HRRP|RADAR|RADIO|MIND|AWARENESS)/i),
                                )
                                .join("; ") +
                            ")";
                        system.description = system.description.replace("()", "");
                        break;

                    default:
                        system.description += " (" + _adderArray.join("; ") + ")";
                        break;
                }
            }
        }

        // Standard Effect
        if (system.USESTANDARDEFFECT) {
            let stun = parseInt(system.value * 3);
            let body = parseInt(system.value);

            if (
                this.findModsByXmlid("PLUSONEHALFDIE") ||
                this.findModsByXmlid("MINUSONEPIP") ||
                this.findModsByXmlid("PLUSONEPIP")
            ) {
                stun += 1;
                body += 1;
            }

            if (configPowerInfo?.type.includes("adjustment")) {
                system.description += " (standard effect: " + parseInt(system.value * 3) + " points)";
            } else {
                system.description += ` (standard effect: ${stun} STUN, ${body} BODY)`;
            }
        }

        // Advantages sorted low to high
        for (let modifier of (system.MODIFIER || [])
            .filter((o) => o.BASECOST >= 0)
            .sort((a, b) => {
                return a.BASECOST_total - b.BASECOST_total;
            })) {
            // This might be a limitation with an unusually positive value
            const modPowerInfo = getPowerInfo({
                item: modifier,
                actor: this.actor,
            });
            if (modPowerInfo?.minumumLimitation) {
                continue;
            }

            system.description += this.createPowerDescriptionModifier(modifier);
        }

        // Active Points
        if (parseInt(system.realCost) != parseInt(system.activePoints) || this.parentItem) {
            if (system.activePoints) {
                system.description += " (" + system.activePoints + " Active Points);";
            }
        }

        // MULTIPOWER slots typically include limitations
        let modifiers = (system.MODIFIER || [])
            .filter((o) => o.BASECOST_total < 0)
            .sort((a, b) => {
                return a.BASECOST_total - b.BASECOST_total;
            });
        if (this.parentItem) {
            modifiers.push(
                ...(this.parentItem.system.MODIFIER || [])
                    .filter((o) => o.BASECOST < 0)
                    .sort((a, b) => {
                        return a.BASECOST_total - b.BASECOST_total;
                    }),
            );
        }

        // Disadvantages sorted low to high
        for (let modifier of modifiers) {
            system.description += this.createPowerDescriptionModifier(modifier);
        }

        system.description = system.description
            .replace(";,", ";")
            .replace("; ,", ";")
            .replace("; ;", ";")
            .replace(/;$/, "") // Remove ";" at the end of the description string
            .trim();

        // Endurance
        system.end = Math.max(1, RoundFavorPlayerDown(system.activePoints / 10) || 0);
        const increasedEnd = this.findModsByXmlid("INCREASEDEND");
        if (increasedEnd) {
            system.end *= parseInt(increasedEnd.OPTION.replace("x", ""));
        }

        const reducedEnd =
            this.findModsByXmlid("REDUCEDEND") || (this.parentItem && this.parentItem.findModsByXmlid("REDUCEDEND"));
        if (reducedEnd && reducedEnd.OPTION === "HALFEND") {
            system.end = RoundFavorPlayerDown((system._activePointsWithoutEndMods || system.activePoints) / 10);
            system.end = Math.max(1, RoundFavorPlayerDown(system.end / 2));
        } else if (reducedEnd && reducedEnd.OPTION === "ZERO") {
            system.end = 0;
        }

        // Some powers do not use Endurance
        if (!this.findModsByXmlid("COSTSEND")) {
            if (!configPowerInfo?.costEnd) {
                system.end = 0;
            }

            // Charges typically do not cost END
            if (this.findModsByXmlid("CHARGES")) {
                system.end = 0;
            }
        }

        // STR only costs endurance when used.
        // Can get a bit messy, like when resisting an entangle, but will deal with that later.
        if (system.XMLID == "STR") {
            system.end = 0;
        }

        // MOVEMENT only costs endurance when used.  Typically per round.
        if (configPowerInfo && configPowerInfo.type?.includes("movement")) {
            system.end = 0;
        }

        // PERKS, TALENTS, COMPLICATIONS do not use endurance.
        if (["perk", "talent", "complication"]?.includes(type)) {
            system.end = 0;
        }

        // Notes (moved to item-partial-common.hbs)
        // if (system.NOTES) {
        //     system.description += `<br> <b>Notes:</b> ${system.NOTES}`;
        // }
    }

    createPowerDescriptionModifier(modifier) {
        const item = this;
        const system = item.system;
        let result = "";

        switch (modifier.XMLID) {
            case "CHARGES":
                {
                    // 1 Recoverable Continuing Charge lasting 1 Minute
                    result += ", ";
                    const maxCharges = parseInt(modifier.OPTION_ALIAS);
                    if (maxCharges != parseInt(this.system.charges.max)) {
                        console.error("CHARGES mismatch", item);
                    }
                    const currentCharges = parseInt(this.system.charges.value);
                    if (currentCharges != maxCharges) {
                        result += `${currentCharges}/`;
                    }
                    result += modifier.OPTION_ALIAS;

                    let recoverable = (modifier.ADDER || []).find((o) => o.XMLID == "RECOVERABLE");
                    if (recoverable) {
                        result += " " + recoverable.ALIAS;
                    }

                    let continuing = (modifier.ADDER || []).find((o) => o.XMLID == "CONTINUING");
                    if (continuing) {
                        result += " " + continuing.ALIAS;
                    }

                    result += maxCharges > 1 ? " Charges" : " Charge";

                    if (continuing) {
                        result += " lasting " + continuing.OPTION_ALIAS;
                    }
                }

                break;

            case "FOCUS":
                result += ", " + modifier.ALIAS;
                break;

            case "ABLATIVE":
                result += `, ${modifier.ALIAS} ${modifier.OPTION_ALIAS}`;
                break;

            default:
                if (modifier.ALIAS) result += ", " + modifier.ALIAS || "?";
                break;
        }

        if (!["CONDITIONALPOWER"].includes(modifier.XMLID)) {
            result += " (";
        } else {
            result += " ";
        }

        // Multiple levels?
        if ((parseInt(modifier.LEVELS) || 0) > 1) {
            if (["HARDENED", "PENETRATING", "ARMORPIERCING"].includes(modifier.XMLID)) {
                result += "x" + parseInt(modifier.LEVELS) + "; ";
            }
        }

        if (modifier.XMLID === "AOE") {
            if (item.system.areaOfEffect.value > 0) {
                result += `${item.system.areaOfEffect.value}${
                    modifier.OPTION_ALIAS === "Any Area" && !item.actor?.system?.is5e
                        ? ""
                        : getSystemDisplayUnits(item.is5e)
                } `;
            }
        }

        if (modifier.XMLID === "CUMULATIVE" && parseInt(modifier.LEVELS) > 0) {
            result += parseInt(system.value) * 6 * (parseInt(modifier.LEVELS) + 1) + " points; ";
        }

        if (modifier.OPTION_ALIAS && !["VISIBLE", "CHARGES", "AVAD", "ABLATIVE"].includes(modifier.XMLID)) {
            switch (modifier.XMLID) {
                case "AOE":
                    if (modifier.OPTION_ALIAS === "One Hex" && item.system.areaOfEffect.value > 1) {
                        result += "Radius; ";
                    } else if (modifier.OPTION_ALIAS === "Any Area" && !item.actor?.system?.is5e) {
                        result += "2m Areas; ";
                    } else if (modifier.OPTION_ALIAS === "Line") {
                        const width = item.system.areaOfEffect.width;
                        const height = item.system.areaOfEffect.height;

                        result += `Long, ${height}${getSystemDisplayUnits(
                            item.actor.is5e,
                        )} Tall, ${width}${getSystemDisplayUnits(item.actor.is5e)} Wide Line; `;
                    } else {
                        result += `${modifier.OPTION_ALIAS}; `;
                    }
                    break;
                case "EXPLOSION":
                    {
                        const shape = modifier.OPTION_ALIAS === "Normal (Radius)" ? "Radius" : modifier.OPTION_ALIAS;
                        result += `${shape}; -1 DC/${item.system.areaOfEffect.dcFalloff}"; `;
                    }
                    break;
                case "EXTRATIME":
                    result += `${modifier.OPTION_ALIAS}, `;
                    break;
                case "CONDITIONALPOWER":
                    result += `${modifier.OPTION_ALIAS}; (`;
                    break;
                default:
                    result += `${modifier.OPTION_ALIAS}; `;
            }
        }

        if (modifier.INPUT) {
            result += modifier.INPUT + "; ";
        }

        if (modifier.COMMENTS) result += modifier.COMMENTS + "; ";
        for (const adder of modifier.ADDER || []) {
            switch (adder.XMLID) {
                case "DOUBLELENGTH":
                case "DOUBLEWIDTH":
                case "DOUBLEHEIGHT":
                case "DOUBLEAREA":
                    // These adders relate to AOE and so are displayed as a part of that
                    break;

                case "EXPLOSION":
                    result += adder.ALIAS + "; ";

                    break;
                default:
                    result += adder.ALIAS + ", ";
            }
        }

        let fraction = "";

        let BASECOST_total = modifier.BASECOST_total || modifier.BASECOST;

        if (BASECOST_total == 0) {
            fraction += "+0";
            // if (game.settings.get(game.system.id, 'alphaTesting')) {
            //     ui.notifications.warn(`${powerName} has an unhandled modifier (${modifier.XMLID})`)
            // }
        }

        if (BASECOST_total > 0) {
            fraction += "+";
        }
        let wholeNumber = Math.trunc(BASECOST_total);

        if (wholeNumber != 0) {
            fraction += wholeNumber + " ";
        } else if (BASECOST_total < 0) {
            fraction += "-";
        }
        switch (Math.abs(BASECOST_total % 1)) {
            case 0:
                break;
            case 0.25:
                fraction += "1/4";
                break;
            case 0.5:
                fraction += "1/2";
                break;
            case 0.75:
                fraction += "3/4";
                break;
            default:
                fraction += BASECOST_total % 1;
        }

        result += fraction.trim() + ")";

        // Highly summarized
        if (["FOCUS"].includes(modifier.XMLID)) {
            // 'Focus (OAF; Pen-sized Device in pocket; -1)'
            result = result.replace(`Focus (${modifier.OPTION}; `, `${modifier.OPTION} (`);
        }

        const configPowerInfo = getPowerInfo({
            xmlid: system.XMLID,
            actor: item?.actor,
            is5e: this.is5e,
        });

        // All Slots? This may be a slot in a framework if so get parent
        if (configPowerInfo && configPowerInfo.type?.includes("framework")) {
            if (result.match(/^,/)) {
                result = result.replace(/^,/, ", all slots");
            } else {
                result = "all slots " + result;
            }
        }

        // Mind Control Inobvious Power, Invisible to Mental Group
        // Mind Control 15d6, Armor Piercing (+1/4), Reduced Endurance (1/2 END; +1/4), Telepathic (+1/4), Invisible Power Effects (Invisible to Mental Group; +1/4), Cumulative (180 points; +3/4) (206 Active Points); Extra Time (Full Phase, -1/2)
        result = result.replace("Inobvious Power, Invisible ", "Invisible ");

        return result;
    }

    makeAttack() {
        // this.id will be null for temporary items (quench, defense left sidebar summary on actor sheet)
        // Keep this as it is handy for breakpoints
        // if (this.id) {
        //     console.log("makeAttack", this);
        // }

        // AARON: Do we really need makeAttack?
        // Many of these properties can converted into get properties on the item and calculated on the fly.

        const xmlid = this.system.XMLID;

        if(xmlid === "MULTIPLEATTACK"){
            console.log("RWC MULTIPLEATTACK");
        }
        // Name
        let description = this.system.ALIAS;
        let name = this.system.NAME || description || this.system.name || this.name;
        this.name = name;

        // 5E Martial DC, EXTRADC, and CSL DCs are halved for killing attacks.  STR/5 DCs are unchanged.
        let dc = parseInt(this.system.DC);
        if (this.is5e && this.system.killing && ["maneuver", "martialart"].includes(this.type)) {
            dc = Math.floor(dc / 2);
        }

        let levels = parseInt(this.system.value) || dc || 0;
        const input = this.system.INPUT;

        const ocv = parseInt(this.system.OCV) || 0;
        // todo: right here any "1/2" DCV get turned into "1" dcv
        const dcv = parseInt(this.system.DCV) || 0;

        // Check if TELEKINESIS + WeaponElement (BAREHAND) + EXTRADC  (WillForce)
        if (this.system.XMLID == "TELEKINESIS") {
            if (
                this.actor?.items &&
                this.actor.items.find(
                    (o) => o.system.XMLID == "WEAPON_ELEMENT" && o.system.ADDER.find((o) => o.XMLID == "BAREHAND"),
                )
            ) {
                let EXTRADC = this.actor.items.find(
                    (o) => o.system.XMLID == "EXTRADC" && o.system.ALIAS.indexOf("HTH") > -1,
                );
                // Extract +2 HTH Damage Class(es)
                if (EXTRADC) {
                    let match = EXTRADC.system.ALIAS.match(/\+\d+/);
                    if (match) {
                        levels += parseInt(match[0]) * 5; // Below we take these levels (as STR) and determine dice
                    }
                }
            }
        }

        // Fix CHOKE
        if (this.system.EFFECT?.includes("NND")) {
            const nndd6 = this.system.EFFECT.match(/NND (\d+)d6/);
            const d6 = parseInt(nndd6?.[1]);
            if (d6 > 0) {
                this.system.DC = d6 * 2; // Were going to halve it later on in this function due to NND;
            }
        }

        this.system.subType = "attack";
        this.system.class = input === "ED" ? "energy" : "physical";
        this.system.dice = levels;
        this.system.extraDice = "zero";
        this.system.killing = false;
        this.system.knockbackMultiplier = 1;
        this.system.targets = "dcv";
        this.system.uses = "ocv";
        this.system.usesStrength = true;
        this.system.areaOfEffect = { type: "none", value: 0 };
        this.system.piercing = 0;
        this.system.penetrating = 0;
        this.system.ocv = ocv;
        this.system.dcv = dcv;
        this.system.stunBodyDamage = "stunbody";

        // FLASHDC, BLOCK, DODGE do not use STR
        if (["maneuver", "martialart"].includes(this.type)) {
            if (
                this.system.EFFECT &&
                (this.system.EFFECT.toLowerCase().indexOf("block") > -1 ||
                    this.system.EFFECT.toLowerCase().indexOf("dodge") > -1 ||
                    this.system.EFFECT.search(/\[FLASHDC\]/) > -1)
            ) {
                this.system.usesStrength = false;
            }
        }

        // MAXSTR = 0 does not use STR (NNDs for example)
        // BROKEN: Offensive Strike has MAXSTR = 0, which is wrong, so commenting this out for now.
        // if (this.system.MAXSTR && parseInt(this.system.MAXSTR) === 0) {
        //     this.system.usesStrength = false;
        // }

        // NND (the DC should be halved; suspect because of AVAD/NND implied limitation; Nerve Strike)
        if (this.system.EFFECT?.includes("NND")) {
            this.system.dice = Math.floor(parseInt(this.system.DC) / 2);
            this.system.usesStrength = false;
            this.system.EFFECT = this.system.EFFECT.replace(`[NNDDC]`, `${this.system.dice}d6 NND`);
        }

        // Specific power overrides
        if (xmlid === "ENTANGLE") {
            this.system.class = "entangle";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
            this.system.knockbackMultiplier = 0;
        } else if (xmlid === "DARKNESS") {
            this.system.class = "darkness";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "IMAGES") {
            this.system.class = "images";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "ABSORPTION") {
            this.system.class = "adjustment";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "AID" || xmlid === "SUCCOR") {
            this.system.class = "adjustment";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "DISPEL") {
            this.system.class = "adjustment";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "DRAIN") {
            this.system.class = "adjustment";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "HEALING") {
            this.system.class = "adjustment";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "SUPPRESS") {
            this.system.class = "adjustment";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "TRANSFER") {
            this.system.class = "adjustment";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "MINDSCAN") {
            this.system.class = "mindscan";
            this.system.uses = "omcv";
            this.system.targets = "dmcv";
            this.system.knockbackMultiplier = 0;
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "EGOATTACK") {
            this.system.class = "mental";
            this.system.targets = "dmcv";
            this.system.uses = "omcv";
            this.system.knockbackMultiplier = 0;
            this.system.usesStrength = false;
            this.system.stunBodyDamage = "stunonly";
            this.system.noHitLocations = true;
        } else if (xmlid === "MINDCONTROL") {
            this.system.class = "mindcontrol";
            this.system.targets = "dmcv";
            this.system.uses = "omcv";
            this.system.knockbackMultiplier = 0;
            this.system.usesStrength = false;
            this.system.stunBodyDamage = "stunonly";
            this.system.noHitLocations = true;
        } else if (xmlid === "TELEPATHY") {
            this.system.class = "telepathy";
            this.system.targets = "dmcv";
            this.system.uses = "omcv";
            this.system.knockbackMultiplier = 0;
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "CHANGEENVIRONMENT") {
            this.system.class = "change enviro";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "FLASH") {
            this.system.class = "flash";
            this.system.usesStrength = false;
            this.system.noHitLocations = true;
        } else if (xmlid === "ENERGYBLAST") {
            this.system.usesStrength = false;
        } else if (xmlid === "RKA") {
            this.system.usesStrength = false;
        } else if (xmlid === "TRANSFORM") {
            this.system.class = "transform";
            this.system.usesStrength = false;
        }

        // AVAD
        const avad = this.findModsByXmlid("AVAD");
        if (avad) {
            this.system.class = "avad";
        }

        // Armor Piercing
        const armorPiercing = this.findModsByXmlid("ARMORPIERCING");
        if (armorPiercing) {
            this.system.piercing = parseInt(armorPiercing.LEVELS);
        }

        // Penetrating
        const penetrating = this.findModsByXmlid("PENETRATING");
        if (penetrating) {
            this.system.penetrating = parseInt(penetrating.LEVELS);
        }

        // No Knockback
        const noKb = this.findModsByXmlid("NOKB");
        if (noKb) {
            this.system.knockbackMultiplier = 0;
        }

        // Double Knockback
        const doubleKb = this.findModsByXmlid("DOUBLEKB");
        if (doubleKb) {
            this.system.knockbackMultiplier = 2;
        }

        // Alternate Combat Value (uses OMCV against DCV)
        const acv = this.findModsByXmlid("ACV");
        if (acv) {
            this.system.uses = (acv.OPTION_ALIAS.match(/uses (\w+)/)?.[1] || this.system.uses).toLowerCase();
            this.system.targets = (acv.OPTION_ALIAS.match(/against (\w+)/)?.[1] || this.system.targets).toLowerCase();
        }

        const boecv = this.findModsByXmlid("BOECV");
        if (boecv) {
            this.system.targets = "dmcv";
            this.system.uses = "omcv";
        }

        if (this.findModsByXmlid("PLUSONEPIP")) {
            this.system.extraDice = "pip";
        }

        if (this.findModsByXmlid("PLUSONEHALFDIE")) {
            this.system.extraDice = "half";
        }

        if (this.findModsByXmlid("MINUSONEPIP")) {
            // +1d6-1 is equal to +1/2 d6 DC-wise but is uncommon.
            this.system.extraDice = "one-pip";
        }

        // TODO: Investigate why this is required. It is wrong for 1/2d6 vs d6-1.
        if (xmlid === "HKA" || this.system.EFFECT?.indexOf("KILLING") > -1) {
            this.system.killing = true;

            // Killing Strike uses DC=2 which is +1/2d6.
            // For now just recalculate that, but ideally rework this function to use DC instead of dice.
            let pips = parseInt(this.system.DC || this.system.value * 3);
            //pips += Math.floor(this.system.characteristics.str.value / 5)
            this.system.dice = Math.floor(pips / 3);
            if (pips % 3 == 1) {
                this.system.extraDice = "pip";
            }
            if (pips % 3 == 2) {
                this.system.extraDice = "half";
            }
        }

        if (xmlid === "TELEKINESIS") {
            // levels is the equivalent strength
            this.system.dice = 0;
            this.system.extraDice = "zero";
            this.name = name + " (TK strike)";
            this.system.usesStrength = false;
            this.system.usesTk = true;
        }

        if (xmlid === "ENERGYBLAST") {
            this.system.usesStrength = false;
        }

        if (xmlid === "RKA") {
            this.system.killing = true;
            this.system.usesStrength = false;
        }

        // Damage effect/type modifiers
        const noStrBonus = this.findModsByXmlid("NOSTRBONUS");
        if (noStrBonus) {
            this.system.usesStrength = false;
        }

        const stunOnly = this.findModsByXmlid("STUNONLY");
        if (stunOnly) {
            this.system.stunBodyDamage = "stunonly";
        }

        const doesBody = this.findModsByXmlid("DOESBODY");
        if (doesBody) {
            this.system.stunBodyDamage = "stunbody";
        }
    }

    updateRoll() {
        const skillData = this.system;

        skillData.tags = [];

        if (!this.hasSuccessRoll()) {
            skillData.roll = null;
            return;
        }

        // TODO: Can this be simplified. Should we add some test cases?
        // TODO: Luck and unluck...

        // No Characteristic = no roll (Skill Enhancers for example) except for FINDWEAKNESS
        const characteristicBased = skillData.CHARACTERISTIC;
        const { roll, tags } = !characteristicBased
            ? this._getNonCharacteristicsBasedRollComponents(skillData)
            : this._getSkillRollComponents(skillData);

        skillData.roll = roll;
        skillData.tags = tags;
    }

    _getNonCharacteristicsBasedRollComponents(skillData) {
        let roll = null;
        const tags = [];

        const configPowerInfo = this.baseInfo;

        if (skillData.XMLID === "FINDWEAKNESS") {
            // Provide up to 2 tags to explain how the roll was calculated:
            // 1. Base skill value without modifier due to characteristics
            const baseRollValue = 11;
            tags.push({
                value: baseRollValue,
                name: "Base Skill",
            });

            // 2. Adjustments due to level
            const levelsAdjustment = parseInt(skillData.LEVELS?.value || skillData.LEVELS || skillData.levels) || 0;
            if (levelsAdjustment) {
                tags.push({
                    value: levelsAdjustment,
                    name: "Levels",
                });
            }

            const rollVal = baseRollValue + levelsAdjustment;
            roll = `${rollVal}-`;
        } else if (skillData.XMLID === "REPUTATION") {
            // 2 types of reputation. Positive is a perk ("HOWWELL" adder) and Negative is a disadvantage ("RECOGNIZED" adder).
            let perkRollValue = parseInt(skillData.ADDER.find((adder) => adder.XMLID === "HOWWELL")?.OPTIONID || 0);

            if (!perkRollValue) {
                const disadRollName = skillData.ADDER.find((adder) => adder.XMLID === "RECOGNIZED").OPTIONID;

                if (disadRollName === "SOMETIMES") {
                    perkRollValue = 8;
                } else if (disadRollName === "FREQUENTLY") {
                    perkRollValue = 11;
                } else if (disadRollName === "ALWAYS") {
                    perkRollValue = 14;
                } else {
                    console.error(`unknown disadRollName ${disadRollName} for REPUTATION`);
                    perkRollValue = 14;
                }
            }

            tags.push({
                value: perkRollValue,
                name: "How Recognized",
            });

            roll = `${perkRollValue}-`;
        } else if (skillData.XMLID === "ACCIDENTALCHANGE") {
            const changeChance = skillData.ADDER.find((adder) => adder.XMLID === "CHANCETOCHANGE")?.OPTIONID;
            let rollValue;

            if (changeChance === "INFREQUENT") {
                rollValue = 8;
            } else if (changeChance === "FREQUENT") {
                rollValue = 11;
            } else if (changeChance === "VERYFREQUENT") {
                rollValue = 14;
            } else if (!changeChance) {
                // Shouldn't happen. Give it a default.
                console.error(`ACCIDENTALCHANGE doesn't have a CHANCETOCHANGE adder. Defaulting to 8-`);
                rollValue = 8;
            }

            tags.push({
                value: rollValue,
                name: "Change Chance",
            });

            roll = `${rollValue}-`;
        } else if (skillData.XMLID === "DEPENDENTNPC" || skillData.XMLID === "HUNTED") {
            const appearanceChance = skillData.ADDER.find((adder) => adder.XMLID === "APPEARANCE")?.OPTIONID;
            let chance;

            if (appearanceChance === "EIGHT" || appearanceChance === "8ORLESS") {
                chance = 8;
            } else if (appearanceChance === "ELEVEN" || appearanceChance === "11ORLESS") {
                chance = 11;
            } else if (appearanceChance === "FOURTEEN" || appearanceChance === "14ORLESS") {
                chance = 14;
            } else {
                // Shouldn't happen. Give it a default.
                console.error(`${skillData.XMLID} unknown APPEARANCE adder ${appearanceChance}. Defaulting to 8-`);
            }

            tags.push({
                value: chance,
                name: "Appearance Chance",
            });

            roll = `${chance ? chance : 8}-`;
        } else if (skillData.XMLID === "ENRAGED") {
            const enrageChance = skillData.ADDER.find((adder) => adder.XMLID === "CHANCETOGO")?.OPTIONID;
            let rollValue;

            if (enrageChance === "8-") {
                rollValue = 8;
            } else if (enrageChance === "11-") {
                rollValue = 11;
            } else if (enrageChance === "14-") {
                rollValue = 14;
            } else if (!enrageChance) {
                // Shouldn't happen. Give it a default.
                console.error(`ENRAGED doesn't have a CHANCETOGO adder. Defaulting to 8-`);
                rollValue = 8;
            }

            tags.push({
                value: rollValue,
                name: "Become Enraged",
            });

            roll = `${rollValue}-`;
        } else if (skillData.XMLID === "PSYCHOLOGICALLIMITATION") {
            // Intensity is based on an EGO roll
            const egoRoll = this.actor.system.characteristics.ego.roll || 0;
            const intensity = skillData.ADDER.find((adder) => adder.XMLID === "INTENSITY")?.OPTIONID;
            let intensityValue;

            if (intensity === "MODERATE") {
                intensityValue = 5;
            } else if (intensity === "STRONG") {
                intensityValue = 0;
            } else if (intensity === "TOTAL") {
                intensityValue = -5;
            } else {
                console.error(`unknown intensity ${intensity} for PSYCHOLOGICALLIMITATION`);
                intensityValue = egoRoll;
            }

            tags.push({
                value: egoRoll,
                name: "Ego Roll",
            });

            tags.push({
                value: intensityValue,
                name: `${intensity} intensity`,
            });

            roll = `${egoRoll + intensityValue}-`;
        } else if (skillData.XMLID === "SOCIALLIMITATION") {
            const occurChance = skillData.ADDER.find((adder) => adder.XMLID === "OCCUR")?.OPTIONID;
            let rollValue;

            if (occurChance === "OCCASIONALLY") {
                rollValue = 8;
            } else if (occurChance === "FREQUENTLY") {
                rollValue = 11;
            } else if (occurChance === "VERYFREQUENTLY") {
                rollValue = 14;
            } else {
                console.error(`unknown occurChance ${occurChance} for SOCIALLIMITATION`);
                rollValue = 14;
            }

            tags.push({
                value: rollValue,
                name: "Occurrence Chance",
            });

            roll = `${rollValue}-`;
        } else if (skillData.XMLID === "CONTACT") {
            const levels = parseInt(skillData.LEVELS || 1);
            let rollValue;

            if (levels === 1) {
                rollValue = 8;
            } else {
                rollValue = 9 + levels;
            }

            tags.push({
                value: rollValue,
                name: "Contact Chance",
            });

            roll = `${rollValue}-`;
        } else if (skillData.XMLID === "DANGER_SENSE") {
            const level = parseInt(skillData.LEVELS || 0);
            if (!skillData.LEVELS) {
                console.error(`unknown levels ${skillData.LEVELS} for DANGER_SENSE`);
            }

            const perceptionItem = (this.actor?.items || []).find((power) => power.system.XMLID === "PERCEPTION");
            const perceptionRoll = parseInt(perceptionItem?.system.roll?.replace("-", "") || 11);

            tags.push({
                value: perceptionRoll + level,
                name: "Sense Danger",
            });

            roll = `${perceptionRoll + level}-`;
        } else if (configPowerInfo?.type.includes("characteristic")) {
            // Characteristics can be bought as powers. We don't give them a roll in this case as they will be
            // rolled from the characteristics tab.
            roll = null;
        } else {
            console.error(`Don't know how to build non characteristic based roll information for ${skillData.XMLID}`);
            roll = null;
        }

        return { roll: roll, tags: tags };
    }

    _getSkillRollComponents(skillData) {
        let roll = null;
        const tags = [];

        if (skillData.EVERYMAN) {
            if (skillData.XMLID === "PROFESSIONAL_SKILL") {
                // Assume that there's only 1 everyman professional skill. It will be an 11- as HD doesn't distinguish
                // between the 1st PS and the 2nd PS. All other everyman skill are 8-.
                roll = "11-";
                tags.push({ value: 11, name: "Everyman PS" });
            } else {
                roll = "8-";
                tags.push({ value: 8, name: "Everyman" });
            }
        } else if (skillData.FAMILIARITY) {
            roll = "8-";
            tags.push({ value: 8, name: "Familiarity" });
        } else if (skillData.PROFICIENCY) {
            roll = "10-";
            tags.push({ value: 10, name: "Proficiency" });
        } else if (skillData.XMLID === "CUSTOMSKILL") {
            const rollValue = parseInt(skillData.ROLL || 0);
            if (!rollValue) {
                roll = null;
            } else {
                roll = `${rollValue}-`;
                tags.push({
                    value: rollValue,
                    name: skillData.NAME || skillData.ALIAS,
                });
            }
        } else if (skillData.CHARACTERISTIC) {
            const characteristic = skillData.CHARACTERISTIC.toLowerCase();

            const baseRollValue = skillData.CHARACTERISTIC === "GENERAL" ? 11 : 9;
            const characteristicValue =
                characteristic !== "general" && characteristic != ""
                    ? this.actor?.system.characteristics?.[`${characteristic}`].value || 0
                    : 0;
            const characteristicAdjustment = Math.round(characteristicValue / 5);
            const levelsAdjustment = parseInt(skillData.LEVELS?.value || skillData.LEVELS || skillData.levels) || 0;
            let rollVal = baseRollValue + characteristicAdjustment + levelsAdjustment;

            // Provide up to 3 tags to explain how the roll was calculated:
            // 1. Base skill value without modifier due to characteristics
            tags.push({ value: baseRollValue, name: "Base Skill" });

            // 2. Adjustment value due to characteristics.
            //    NOTE: Don't show for things like Knowledge Skills which are GENERAL, not characteristic based, or if we have a 0 adjustment
            if (skillData.CHARACTERISTIC !== "GENERAL" && characteristicAdjustment) {
                tags.push({
                    value: characteristicAdjustment,
                    name: characteristic,
                });
            }

            // 3. Adjustments due to level
            if (levelsAdjustment) {
                tags.push({
                    value: levelsAdjustment,
                    name: "Levels",
                });
            }

            const enhancedPerception = this.actor.items.find((o) => o.system.XMLID === "ENHANCEDPERCEPTION");
            if (enhancedPerception) {
                if (enhancedPerception.system.OPTIONID === "ALL") {
                    const levels = parseInt(enhancedPerception.system.LEVELS);
                    tags.push({
                        value: levels,
                        name: enhancedPerception.name,
                    });
                    rollVal += levels;
                } else {
                    console.warn(
                        `Unsupported ${enhancedPerception.system.XMLID} OPTIONID ${enhancedPerception.system.OPTIONID}`,
                    );
                }
            }

            roll = rollVal.toString() + "-";
        } else {
            // This is likely a Skill Enhancer.
            // Skill Enhancers provide a discount to the purchase of associated skills.
            // They do not change the roll.
            // Skip for now.
            // HEROSYS.log(false, (skillData.XMLID || this.name) + ' was not included in skills.  Likely Skill Enhancer')
        }

        return { roll: roll, tags: tags };
    }

    _areAllAdjustmentTargetsInListValid(targetsList, mustBeStrict) {
        if (!targetsList) return false;
        if (!this.actor) return true;

        // ABSORPTION, AID + SUCCOR/BOOST, and TRANSFER target characteristics/powers are the only adjustment powers that must match
        // the character's characteristics/powers (i.e. they can't create new characteristics or powers). All others just
        // have to match actual possible characteristics/powers.
        const validator =
            this.system.XMLID === "AID" ||
            this.system.XMLID === "ABSORPTION" ||
            this.system.XMLID === "SUCCOR" ||
            (this.system.XMLID === "TRANSFER" && mustBeStrict)
                ? adjustmentSourcesStrict
                : adjustmentSourcesPermissive;
        const validList = Object.keys(validator(this.actor));

        const adjustmentTargets = targetsList.split(",");
        for (const rawAdjustmentTarget of adjustmentTargets) {
            const upperCasedInput = rawAdjustmentTarget.toUpperCase().trim();
            if (!validList.includes(upperCasedInput)) {
                return false;
            }
        }

        return true;
    }

    /**
     *
     *  If valid, the enhances and reduces lists are valid, otherwise ignore them.
     *
     * @typedef { Object } AdjustmentSourceAndTarget
     * @property { boolean } valid - if any of the reduces and enhances fields are valid
     * @property { string } reduces - things that are reduced (aka from)
     * @property { string } enhances - things that are enhanced (aka to)
     * @property { string[] } reducesArray
     * @property { string[] } enhancesArray
     */
    /**
     *
     * @returns { AdjustmentSourceAndTarget }
     */
    splitAdjustmentSourceAndTarget() {
        let valid;
        let reduces = "";
        let enhances = "";

        if (this.system.XMLID === "TRANSFER") {
            // Should be something like "STR,CON -> DEX,SPD"
            const splitSourcesAndTargets = this.system.INPUT ? this.system.INPUT.split(" -> ") : [];

            valid =
                this._areAllAdjustmentTargetsInListValid(splitSourcesAndTargets[0], false) &&
                this._areAllAdjustmentTargetsInListValid(splitSourcesAndTargets[1], true);
            enhances = splitSourcesAndTargets[1];
            reduces = splitSourcesAndTargets[0];
        } else {
            valid = this._areAllAdjustmentTargetsInListValid(
                this.system.INPUT,
                this.system.XMLID === "AID" || this.system.XMLID === "ABSORPTION" || this.system.XMLID === "SUCCOR",
            );

            if (
                this.system.XMLID === "AID" ||
                this.system.XMLID === "ABSORPTION" ||
                this.system.XMLID === "HEALING" ||
                this.system.XMLID === "SUCCOR"
            ) {
                enhances = this.system.INPUT || "undefined";
            } else {
                reduces = this.system.INPUT;
            }
        }

        return {
            valid: valid,

            reduces: reduces,
            enhances: enhances,
            reducesArray: reduces ? reduces.split(",").map((str) => str.trim()) : [],
            enhancesArray: enhances ? enhances.split(",").map((str) => str.trim()) : [],
        };
    }

    static _maxNumOf5eAdjustmentEffects(mod) {
        if (!mod) return 1;

        switch (mod.BASECOST) {
            case "0.5":
                return 2;
            case "1.0":
                return 4;
            case "2.0":
                // All of a type. Assume this is just infinite (pick a really big number).
                return 10000;
            default:
                return 1;
        }
    }

    numberOfSimultaneousAdjustmentEffects() {
        if (this.actor.system.is5e) {
            // In 5e, the number of simultaneous effects is based on the VARIABLEEFFECT modifier.
            const variableEffect = this.findModsByXmlid("VARIABLEEFFECT"); // From for TRANSFER and everything else
            const variableEffect2 = this.findModsByXmlid("VARIABLEEFFECT2"); // To for TRANSFER

            if (this.system.XMLID === "TRANSFER") {
                return {
                    maxReduces: HeroSystem6eItem._maxNumOf5eAdjustmentEffects(variableEffect),
                    maxEnhances: HeroSystem6eItem._maxNumOf5eAdjustmentEffects(variableEffect2),
                };
            } else if (
                this.system.XMLID === "AID" ||
                this.system.XMLID === "ABSORPTION" ||
                this.system.XMLID === "HEALING" ||
                this.system.XMLID === "SUCCOR"
            ) {
                return {
                    maxReduces: 0,
                    maxEnhances: HeroSystem6eItem._maxNumOf5eAdjustmentEffects(variableEffect),
                };
            } else {
                return {
                    maxReduces: HeroSystem6eItem._maxNumOf5eAdjustmentEffects(variableEffect),
                    maxEnhances: 0,
                };
            }
        }

        // In 6e, the number of simultaneous effects is LEVELS in the EXPANDEDEFFECT modifier, if available, or
        // it is just 1. There is no TRANSFER in 6e.
        const maxCount = this.findModsByXmlid("EXPANDEDEFFECT")?.LEVELS || 1;
        if (
            this.system.XMLID === "AID" ||
            this.system.XMLID === "ABSORPTION" ||
            this.system.XMLID === "HEALING" ||
            this.system.XMLID === "SUCCOR"
        ) {
            return {
                maxReduces: 0,
                maxEnhances: maxCount,
            };
        } else {
            return {
                maxReduces: maxCount,
                maxEnhances: 0,
            };
        }
    }

    async addActiveEffect(activeEffect) {
        const newEffect = foundry.utils.deepClone(activeEffect);

        return this.createEmbeddedDocuments("ActiveEffect", [newEffect]);
    }

    // In 5e, explosion is a modifier, in 6e it's an adder to an AOE modifier.
    hasExplosionAdvantage() {
        return !!(
            this.findModsByXmlid("AOE")?.ADDER?.find((o) => o.XMLID === "EXPLOSION") ||
            this.findModsByXmlid("EXPLOSION")
        );
    }

    getAoeModifier() {
        const aoe = this.findModsByXmlid("AOE");
        const explosion5e = this.findModsByXmlid("EXPLOSION");

        return aoe || explosion5e;
    }
}

export function getItem(id) {
    const gameItem = game.items.get(id);
    if (gameItem) {
        return gameItem;
    }

    for (const actor of game.actors) {
        const testItem = actor.items.get(id);
        if (testItem) {
            return testItem;
        }
    }

    return null;
}

export async function RequiresASkillRollCheck(item, event) {
    // Toggles don't need a roll to turn off
    //if (item.system?.active === true) return true;

    let rar = (item.system.MODIFIER || []).find(
        (o) => o.XMLID === "REQUIRESASKILLROLL" || o.XMLID === "ACTIVATIONROLL",
    );
    if (rar) {
        let OPTION_ALIAS = rar.OPTION_ALIAS;

        // Requires A Roll (generic) default to 11
        let value = parseInt(rar.OPTIONID);

        switch (rar.OPTIONID) {
            case "SKILL":
            case "SKILL1PER5":
            case "SKILL1PER20":
                {
                    OPTION_ALIAS = OPTION_ALIAS?.split(",")[0].replace(/roll/i, "").trim();
                    let skill = item.actor.items.find(
                        (o) =>
                            (o.system.subType || o.system.type) === "skill" &&
                            (o.system.XMLID === OPTION_ALIAS.toUpperCase() ||
                                o.name.toUpperCase() === OPTION_ALIAS.toUpperCase()),
                    );
                    if (!skill && rar.COMMENTS) {
                        skill = item.actor.items.find(
                            (o) =>
                                (o.system.subType || o.system.type) === "skill" &&
                                (o.system.XMLID === rar.COMMENTS.toUpperCase() ||
                                    o.name.toUpperCase() === rar.COMMENTS.toUpperCase() ||
                                    o.system.INPUT?.toUpperCase() === rar.COMMENTS.toUpperCase()),
                        );
                        if (skill) {
                            OPTION_ALIAS = rar.COMMENTS;
                        }
                    }
                    if (!skill && rar.COMMENTS) {
                        let char = item.actor.system.characteristics[rar.COMMENTS.toLowerCase()];
                        if (char) {
                            ui.notifications.warn(
                                `${item.actor.name} has a power ${item.name}, which is incorrectly built.  Skill Roll for ${rar.COMMENTS} should be a Characteristic Roll.`,
                                // { console: true, permanent: true },
                            );

                            // Lets try anyway
                            value = char?.roll;
                        }
                    }
                    if (skill) {
                        value = parseInt(skill.system.roll);
                        if (rar.OPTIONID === "SKILL1PER5")
                            value = Math.max(3, value - Math.floor(parseInt(item.system.activePoints) / 5));
                        if (rar.OPTIONID === "SKILL1PER20")
                            value = Math.max(3, value - Math.floor(parseInt(item.system.activePoints) / 20));

                        OPTION_ALIAS += ` ${value}-`;
                    } else {
                        ui.notifications.warn(
                            `${item.actor.name} has a power ${item.name}. Expecting 'SKILL roll', where SKILL is the name of an owned skill.`,
                            // { console: true, permanent: true },
                        );
                    }
                }
                break;

            case "CHAR":
                {
                    OPTION_ALIAS = OPTION_ALIAS?.split(",")[0].replace(/roll/i, "").trim();
                    let char = item.actor.system.characteristics[OPTION_ALIAS.toLowerCase()];
                    if (!char && rar.COMMENTS) {
                        char = item.actor.system.characteristics[rar.COMMENTS.toLowerCase()];
                        if (char) {
                            OPTION_ALIAS = rar.COMMENTS;
                        }
                    }
                    if (char) {
                        item.actor.updateRollable(OPTION_ALIAS.toLowerCase());
                        value = parseInt(item.actor.system.characteristics[OPTION_ALIAS.toLowerCase()].roll);
                        OPTION_ALIAS += ` ${value}-`;
                    } else {
                        ui.notifications.warn(
                            `${item.actor.name} has a power ${item.name}. Expecting 'CHAR roll', where CHAR is the name of a characteristic.`,
                            // { console: true, permanent: true },
                        );
                    }
                }
                break;

            default:
                if (!value) {
                    ui.notifications.warn(
                        `${item.actor.name} has a power ${item.name}. ${OPTION_ALIAS} is not supported.`,
                        // { console: true, permanent: true },
                    );
                    // Try to continue
                    value = 11;
                }
        }

        const successValue = parseInt(value);
        const activationRoller = new HeroRoller().makeSuccessRoll(true, successValue).addDice(3);
        await activationRoller.roll();
        let succeeded = activationRoller.getSuccess();
        const autoSuccess = activationRoller.getAutoSuccess();
        const total = activationRoller.getSuccessTotal();
        const margin = successValue - total;

        const flavor = `${item.name.toUpperCase()} (${OPTION_ALIAS}) activation ${
            succeeded ? "succeeded" : "failed"
        } by ${autoSuccess === undefined ? `${Math.abs(margin)}` : `rolling ${total}`}`;
        let cardHtml = await activationRoller.render(flavor);

        // FORCE success
        if (!succeeded && event?.ctrlKey) {
            ui.notifications.info(`${item.actor.name} succeeded roll because ${game.user.name} used CTRL key.`);
            succeeded = true;
            cardHtml += `<p>Succeeded roll because ${game.user.name} used CTRL key.</p>`;
        }

        const actor = item.actor;
        const token = actor.token;
        const speaker = ChatMessage.getSpeaker({ actor: actor, token });
        speaker.alias = actor.name;

        const chatData = {
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            rolls: activationRoller.rawRolls(),
            user: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        await ChatMessage.create(chatData);

        return succeeded;
    }
    return true;
}

// for testing and pack-load-from-config macro
window.HeroSystem6eItem = HeroSystem6eItem;
