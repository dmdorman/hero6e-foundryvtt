import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";
import {
    collectActionDataBeforeToHitOptions,
    rollEffect,
    userInteractiveVerifyOptionallyPromptThenSpendResources,
} from "../item/item-attack.mjs";
import { createSkillPopOutFromItem } from "../item/skill.mjs";
import {
    activateManeuver,
    maneuverCanBeAbortedTo,
    deactivateManeuver,
    enforceManeuverLimits,
    maneuverHasBlockTrait,
    maneuverHasFlashTrait,
} from "./maneuver.mjs";
import {
    adjustmentSourcesPermissive,
    adjustmentSourcesStrict,
    determineMaxAdjustment,
} from "../utility/adjustment.mjs";
import { HeroSystemGenericSharedCache } from "../utility/cache.mjs";
import { onActiveEffectToggle } from "../utility/effects.mjs";
import {
    getModifierInfo,
    getPowerInfo,
    hdcTimeOptionIdToSeconds,
    whisperUserTargetsForActor,
    tokenEducatedGuess,
} from "../utility/util.mjs";
import { RoundFavorPlayerDown, RoundFavorPlayerUp } from "../utility/round.mjs";
import {
    buildStrengthItem,
    calculateApPerDieForItem,
    calculateDicePartsForItem,
    calculateDicePartsFromDcForItem,
    calculateStrengthMinimumForItem,
    combatSkillLevelsForAttack,
    dicePartsToEffectFormula,
    getEffectFormulaFromItem,
    getExtraMartialDcsOrZero,
    getFullyQualifiedEffectFormulaFromItem,
    getManeuverEffect,
    isManeuverHthCategory,
    isManeuverThatDoesReplaceableDamageType,
    isRangedMartialManeuver,
} from "../utility/damage.mjs";
import { getSystemDisplayUnits } from "../utility/units.mjs";
import { calculateVelocityInSystemUnits } from "../heroRuler.mjs";
import { HeroRoller } from "../utility/dice.mjs";
import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { Attack } from "../utility/attack.mjs";
import { getItemDefenseVsAttack } from "../utility/defense.mjs";
import { overrideCanAct } from "../settings/settings-helpers.mjs";
// import { HeroSystem6eAdder } from "./adder.mjs";
// import { HeroSystem6eModifier } from "./modifier.mjs";
// import { HeroSystem6eConnectingPower } from "./connectingPower.mjs";
import {
    HeroSystem6eItemPower,
    HeroSystem6eItemEquipment,
    HeroSystem6eItemPerk,
    HeroSystem6eItemSkill,
    HeroSystem6eItemManeuver,
    HeroSystem6eItemTalent,
    HeroSystem6eItemMartialArt,
    HeroSystem6eItemDisadvantage,
} from "./HeroSystem6eTypeDataModels.mjs";
import { HeroAdderModel } from "./HeroSystem6eTypeDataModels.mjs";

export function initializeItemHandlebarsHelpers() {
    Handlebars.registerHelper("itemFullDescription", itemFullDescription);
    Handlebars.registerHelper("itemName", itemName);
    Handlebars.registerHelper("itemIsManeuver", itemIsManeuver);
    Handlebars.registerHelper("itemIsOptionalManeuver", itemIsOptionalManeuver);
    Handlebars.registerHelper("filterItem", filterItem);
    Handlebars.registerHelper("itemHasBehaviours", itemHasBehaviours);
    Handlebars.registerHelper("itemHasActionBehavior", itemHasActionBehavior);
    Handlebars.registerHelper("itemPostHitActionString", itemPostHitActionString);
    Handlebars.registerHelper("hasDefenseActiveEffect", itemHasDefenseActiveEffect);
    Handlebars.registerHelper("itemHeroValidationForProperty", itemHeroValidationForProperty);
}

function itemHeroValidationForProperty(item, property) {
    return item.heroValidation
        .filter((o) => o.property === property)
        .map((m) => `${m.message} For example: "${m.example}"`)
        .join(" ");
}

function itemHasDefenseActiveEffect(item) {
    if (!item) return false;
    const defenseChange = item.effects.find((ae) =>
        ae.changes.find((ch) =>
            getPowerInfo({
                xmlid: ch.key.match(/system\.characteristics\.([a-z]+)\.max/)?.[1].toUpperCase(),
                actor: item.actor,
                xmlTag: ch.key.match(/system\.characteristics\.([a-z]+)\.max/)?.[1].toUpperCase(), // only search for characteristic not adders and such
            })?.behaviors.includes("defense"),
        ),
    );
    if (defenseChange) {
        return true;
    }
    return false;
}

// Returns HTML so expects to not escaped in handlebars (i.e. triple braces)
function itemFullDescription(item) {
    let desc = item.system.description;
    if (item.system.NAME) {
        desc = `<i>${item.system.NAME}:</i> ${item.system.description}`;
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

    const regex = new RegExp(filterString.trim(), "i");

    const match =
        item.name?.match(regex) ||
        item.system.NAME?.match(regex) ||
        item.system.description?.match(regex) ||
        item.system.XMLID?.match(regex);
    if (match) {
        return true;
    }

    // Could be a child of a parent
    for (const child of item.childItems) {
        const match2 =
            child.name?.match(regex) ||
            child.system.NAME?.match(regex) ||
            child.system.description?.match(regex) ||
            child.system.XMLID?.match(regex);
        if (match2) {
            return true;
        }

        // Or a child of a child of a parent
        for (const child2 of child.childItems) {
            const match3 =
                child2.name?.match(regex) ||
                child2.system.description?.match(regex) ||
                child2.system.XMLID?.match(regex);
            if (match3) {
                return true;
            }
        }
    }

    // What about our parent?
    if (item.parentItem) {
        const parent = item.parentItem;
        const match =
            parent.name?.match(regex) || parent.system.description?.match(regex) || parent.system.XMLID?.match(regex);
        if (match) {
            return true;
        }
    }

    return false;
}

function itemHasBehaviours(item, ...desiredBehaviourArgs) {
    const desiredBehaviours = [...desiredBehaviourArgs];
    for (const desiredbehaviour of desiredBehaviours) {
        // Unfortunately handlebars seems to pass metadata in the last argument as an object. We use only strings.
        // Rare occurance where a 5e item (SUPPRESS) is in a 6e actor, we don't allow this, but you never know,
        // and we want to make sure the Actor sheet opens.
        if (typeof desiredbehaviour === "string" && item.baseInfo?.behaviors.includes(desiredbehaviour)) {
            return true;
        }
    }
    return false;
}

function itemHasActionBehavior(item, actionBehavior) {
    try {
        if (!item) {
            console.error(`itemHasActionBehavior called with item being falsy`, item);
            return false;
        }

        if (actionBehavior === "to-hit") {
            return item.rollsToHit();
        } else if (actionBehavior === "activatable") {
            return item.isActivatable();
        }
        console.warn(`Unknown request to get action behavior ${actionBehavior}`);
        return false;
    } catch (e) {
        console.error(e);
        return false;
    }
}

function itemPostHitActionString(item) {
    try {
        const isAdjustment = getPowerInfo({
            item: item,
        })?.type?.includes("adjustment");
        const isSenseAffecting = item.isSenseAffecting();
        const isManeuver = itemIsManeuver(item);

        // Provide a more specific name
        if (isAdjustment || isSenseAffecting) {
            return `Roll ${item.system.XMLID}`;
        } else if (isManeuver && (item.system.XMLID === "GRAB" || item.system.XMLID === "GRABBY")) {
            return `Roll ${item.baseInfo.name}`;
        }

        // The default action
        return "Roll Damage";
    } catch (error) {
        console.error(error);
        return "invalid post to-hit action string";
    }
}

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

        return super._onCreate(data, options, userId);
    }

    prepareData() {
        if (this.system.debugModelProps) {
            this.system.debugModelProps();
        } else {
            if (this.type === "attack") {
                console.warn(`Invalid item.type = ${this.type} for ${this.actor?.name}`, this);
                return;
            }
            if (this.type === "misc") {
                return; // don't care about misc
            }
            console.error(`Invalid item.type = ${this.type} for ${this.actor?.name}`, this);
        }
    }
    XprepareData() {
        super.prepareData();
        window.prepareData ??= {};
        this.system._active ??= {};

        if (!this.actor) {
            // Aaron thinks we should still run most of the prepareData.
            // Things like item description, default values and such are still valid.
            // The Make Attack is likely the only broken thing here when missing an Actor.
            if (this.pack) {
                console.log(
                    `Partial prepareData on item ${this.detailedName()} from the ${this.pack} compendium`,
                    this,
                );
            } else if (this.uuid?.startsWith("Item.")) {
                console.log(`Partial prepareData on item ${this.detailedName()} from the Item sidebar`, this);
            } else {
                console.error(
                    `Partial prepareData on item ${this.detailedName()} which has no actor (probably Items collection)`,
                    this,
                );
            }
            try {
                //this.setAoeModifier();
                //this.getUpdateItemDescription();
            } catch (e) {
                console.error(e);
            }
            return;
        }

        // Basic Validatiton, we need an XMLID
        if (!this.baseInfo) {
            if (this.system.XMLID) {
                console.warn(
                    `${this.actor?.name} / ${this.actor?.getActiveTokens()[0]?.name}/${this.detailedName()} doesn't have XMLID defined`,
                    this,
                );
            } else {
                console.error(
                    `${this.actor?.name} / ${this.actor?.getActiveTokens()[0]?.name}/${this.detailedName()} doesn't have XMLID defined`,
                    this,
                );
            }
        }

        this.setInitialItemValueAndMax();
        this.setInitialRange(this.baseInfo);
        this.updateRoll();
        this.determinePointCosts();
        this.setCharges();
        this.setShowToggle();
        //this.calcEndurance();
        this.setCarried();
        this.setShowToggleActiveDefault();
        this.setMovement();
        this.setSkills();
        this.setToHit();
        this.setAttack();
        this.buildRangeParameters();
        this.setAoeModifier();
        this.setCombatSkillLevels();
        //this.getUpdateItemDescription();

        // Preparing for HeroSystem6eItemTypeDataModel
        for (const key of Object.keys(this.system).filter((o) => o.match(/^[A-Z]+$/))) {
            switch (this.type) {
                case "power":
                    if (!HeroSystem6eItemPower.schema.fields[key]) {
                        window.prepareData.HeroSystem6eItemPower ??= new Set();
                        window.prepareData.HeroSystem6eItemPower.add(key);
                        console.error(`Need to add ${key} to ${this.type} data model`);
                    }
                    break;
                case "equipment":
                    if (!HeroSystem6eItemEquipment.schema.fields[key]) {
                        window.prepareData.HeroSystem6eItemEquipment ??= new Set();
                        window.prepareData.HeroSystem6eItemEquipment.add(key);
                        console.error(`Need to add ${key} to ${this.type} data model`);
                    }
                    break;
                case "skill":
                    if (!HeroSystem6eItemSkill.schema.fields[key]) {
                        window.prepareData.HeroSystem6eItemSkill ??= new Set();
                        window.prepareData.HeroSystem6eItemSkill.add(key);
                        console.error(`Need to add ${key} to ${this.type} data model`);
                    }
                    break;
                case "perk":
                    if (!HeroSystem6eItemPerk.schema.fields[key]) {
                        window.prepareData.HeroSystem6eItemPerk ??= new Set();
                        window.prepareData.HeroSystem6eItemPerk.add(key);
                        console.error(`Need to add ${key} to ${this.type} data model`);
                    }
                    break;
                case "maneuver":
                    if (!HeroSystem6eItemManeuver.schema.fields[key]) {
                        window.prepareData.HeroSystem6eItemManeuver ??= new Set();
                        window.prepareData.HeroSystem6eItemManeuver.add(key);
                        console.error(`Need to add ${key} to ${this.type} data model`);
                    }
                    break;

                case "talent":
                    if (!HeroSystem6eItemTalent.schema.fields[key]) {
                        window.prepareData.HeroSystem6eItemTalant ??= new Set();
                        window.prepareData.HeroSystem6eItemTalant.add(key);
                        console.error(`Need to add ${key} to ${this.type} data model`);
                    }
                    break;
                case "martialart":
                    if (!HeroSystem6eItemMartialArt.schema.fields[key]) {
                        window.prepareData.HeroSystem6eItemMartialArt ??= new Set();
                        window.prepareData.HeroSystem6eItemMartialArt.add(key);
                        console.error(`Need to add ${key} to ${this.type} data model`);
                    }
                    break;
                case "disadvantage":
                    if (!HeroSystem6eItemDisadvantage.schema.fields[key]) {
                        window.prepareData.HeroSystem6eItemDisadvantage ??= new Set();
                        window.prepareData.HeroSystem6eItemDisadvantage.add(key);
                        console.error(`Need to add ${key} to ${this.type} data model`);
                    }
                    break;

                case "complication":
                case "attack":
                    // These types are no longer supported
                    break;

                default:
                    console.error(`Unknown item type ${this.type}`);
            }
        }

        window.prepareData.HeroSystem6eItemCommon = function () {
            const common = [];
            for (const key of window.prepareData.HeroSystem6eItemPower) {
                if (
                    window.prepareData.HeroSystem6eItemPower.has(key) &&
                    window.prepareData.HeroSystem6eItemEquipment.has(key) &&
                    window.prepareData.HeroSystem6eItemSkill.has(key) &&
                    window.prepareData.HeroSystem6eItemPerk.has(key) &&
                    window.prepareData.HeroSystem6eItemTalant.has(key) &&
                    window.prepareData.HeroSystem6eItemMartialArt.has(key) &&
                    window.prepareData.HeroSystem6eItemDisadvantage.has(key)
                ) {
                    common.push(key);
                }
            }
            return common;
        };
    }

    async setActiveEffects() {
        // ACTIVE EFFECTS
        if (this.id && this.baseInfo && this.baseInfo.type?.includes("movement")) {
            const activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} +${this.system.LEVELS}`;
            activeEffect.img = "icons/svg/upgrade.svg";
            activeEffect.description = this.system.description;
            activeEffect.changes = [
                {
                    key: `system.characteristics.${this.system.XMLID.toLowerCase()}.max`,
                    value: parseInt(this.system.LEVELS),
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ];
            for (const usableas of this.modifiers.filter((o) => o.XMLID === "USABLEAS")) {
                let foundMatch = false;
                for (const movementKey of Object.keys(CONFIG.HERO.movementPowers)) {
                    if (usableas.ALIAS.match(new RegExp(movementKey, "i"))) {
                        activeEffect.changes.push({
                            key: `system.characteristics.${movementKey.toLowerCase()}.max`,
                            value: parseInt(this.system.LEVELS),
                            mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                        });
                        foundMatch = true;
                    }
                }
                if (!foundMatch) {
                    ui.notifications.warn(
                        `${this.name} has unknown USABLE AS "${usableas.ALIAS}. Expected format is "Usable as Swimming"`,
                    );
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
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
            if (this.actor) {
                for (const change of activeEffect.changes) {
                    await this.actor.update({
                        [change.key.replace(".max", ".value")]: foundry.utils.getProperty(this.actor, change.key),
                    });
                }
            }
        }

        if (this.id && this.type !== "characteristic" && this.baseInfo?.type?.includes("characteristic")) {
            const activeEffect = Array.from(this.effects)?.[0] || {};
            const value = this.system.LEVELS;
            activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} +${value}`;
            activeEffect.img = "icons/svg/upgrade.svg";
            activeEffect.description = this.system.description;
            activeEffect.changes = [
                {
                    key: `system.characteristics.${this.system.XMLID.toLowerCase()}.max`,
                    value: value,
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
                const newValue = this.actor.system.characteristics[this.system.XMLID.toLowerCase()].value + deltaMax;
                await this.actor.update({
                    [`system.characteristics.${this.system.XMLID.toLowerCase()}.value`]: newValue,
                });
            } else {
                await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
            }
        }

        if (this.id && this.system.XMLID === "DENSITYINCREASE") {
            const noStrIncrease = this.modifiers.find((mod) => mod.XMLID === "NOSTRINCREASE");
            const strAdd = noStrIncrease ? 0 : Math.floor(this.system.LEVELS) * 5;
            const pdAdd = Math.floor(this.system.LEVELS);
            const edAdd = Math.floor(this.system.LEVELS);

            let activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} ${this.system.value}`;
            activeEffect.img = "icons/svg/upgrade.svg";
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
        if (this.id && this.system.XMLID === "GROWTH") {
            const details = this.baseInfo?.details(this) || {};
            let activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.system.ALIAS || this.system.XMLID || this.name) + ": ";
            activeEffect.name += `${this.system.XMLID} ${this.is5e ? this.system.value : this.system.OPTIONID}`;
            activeEffect.img = "icons/svg/upgrade.svg";
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
        if (this.id && this.system.XMLID === "SHRINKING") {
            const dcvAdd = Math.floor(this.system.LEVELS) * 2;

            let activeEffect = Array.from(this.effects)?.[0] || {};
            activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} ${this.system.value}`;
            activeEffect.img = "icons/svg/upgrade.svg";
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

        const MOBILITY = this.findModsByXmlid("MOBILITY");
        if (this.id && MOBILITY) {
            const dcvValue = MOBILITY.OPTIONID === "BULKY" ? 0.5 : MOBILITY.OPTIONID === "IMMOBILE" ? 0 : null;

            const activeEffect = Array.from(this.effects)?.[0] || {};
            if (dcvValue !== null) {
                activeEffect.name =
                    (this.name ? `${this.name}/${MOBILITY.parent.name || MOBILITY.parent.ALIAS}: ` : "") +
                    `${MOBILITY.OPTIONID} ${dcvValue}`;
                activeEffect.img = "icons/svg/downgrade.svg";
                activeEffect.changes = [
                    {
                        key: "system.characteristics.dcv.value",
                        value: dcvValue,
                        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
                    },
                ];
                activeEffect.transfer = true;
                activeEffect.disabled = !this.system.active;

                if (activeEffect.update) {
                    await activeEffect.update({
                        name: activeEffect.name,
                        changes: activeEffect.changes,
                    });
                } else {
                    await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
                }
            } else {
                if (activeEffect.delete) {
                    await activeEffect.delete();
                }
            }
        }

        // CUSTOMPOWER LIGHT
        if (this.id && this.system.XMLID === "CUSTOMPOWER" && this.system.description.match(/light/i)) {
            if (!game.modules.get("ATL")?.active) {
                ui.notifications.warn(
                    `You must install the <b>Active Token Effects</b> module for carried lights to work`,
                );
            }
            let activeEffect = Array.from(this.effects)?.[0] || {};
            if (this.system.active || !activeEffect.update) {
                activeEffect.name = (this.name ? `${this.name}: ` : "") + `LIGHT ${this.system.QUANTITY}`;
                activeEffect.img = "icons/svg/light.svg";
                activeEffect.changes = [
                    {
                        key: "ATL.light.bright",
                        value: parseFloat(this.system.QUANTITY),
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    },
                ];
                if (!activeEffect.update) {
                    activeEffect.disabled = true;
                }

                if (activeEffect.update) {
                    await activeEffect.update({
                        name: activeEffect.name,
                        changes: activeEffect.changes,
                        disabled: false,
                    });
                } else {
                    await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
                }
            } else {
                // Light was turned off?
                if (activeEffect?.update) {
                    await activeEffect.update({
                        name: activeEffect.name,
                        disabled: true,
                    });
                }
            }
        }

        // Generic defeault toggle to on (if it doesn't use charges or END or part of multipower)
        if (
            this.system.showToggle &&
            this.system.active === undefined &&
            this.system.charges === undefined &&
            !this.end &&
            this.parentItem?.system.XMLID === "MULTIPOWER"
        ) {
            this.system.active ??= true;
        }

        if (this.system.XMLID === "INVISIBILITY" && this.system.active) {
            // Invisibility status effect for SIGHTGROUP?
            if (this.system.OPTIONID === "SIGHTGROUP" && !this.actor.statuses.has("invisible")) {
                this.actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.invisibleEffect);
            }
        }
    }

    // setDescription() {
    //     const startDate = Date.now();

    //     window.prepareData.startDate = (window.prepareData.startDate || 0) + (Date.now() - startDate);
    // }

    setCombatSkillLevels() {
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
                for (const attackItem of this.actor._cslItems) {
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
                            // Skip mental powers for 6e as they have a different XMLID
                            if (!this.is5e && attackItem.baseInfo.type.includes("mental")) {
                                continue;
                            }

                            switch (this.system.OPTIONID) {
                                case "SINGLESINGLE": // Depricated ?
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
                                /// 5e only: +1 DCV against all attacks (HTH and Ranged)
                                // — no matter how many opponents attack a
                                // character in a given Segment, or with how many
                                // diff erent attacks, a 5-point DCV CSL provides +1
                                // DCV versus all of them.
                                case "DCV":
                                    addMe = true;
                                    break;
                                case "ALL":
                                case "HTHMENTAL": // 5e with HTH and Mental Combat
                                    addMe = true;
                                    break;
                                default:
                                    console.error(
                                        `Unknown OPTIONID ${this.actor?.name}:${this.name}:${this.system.OPTIONID}`,
                                        this,
                                    );
                                    addMe = false;
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

                    if (addMe && !this.adders.find((adder) => adder.ALIAS === attackItem.name)) {
                        const newAdder = {
                            XMLID: "ADDER",
                            ID: new Date().getTime().toString(),
                            ALIAS: attackItem.name,
                            BASECOST: "0.0",
                            LEVELS: "0",
                            NAME: "",
                            PRIVATE: false,
                            SELECTED: true,
                            BASECOST_total: 0,
                            targetId: attackItem.id,
                        };
                        this.system.ADDER ??= [];
                        this.system.ADDER.push(new HeroAdderModel(newAdder, { parent: this }));
                        count++;
                    }
                }
            } else {
                // Try to associate CSL adders with specific attack
                if (this.baseInfo?.editOptions?.showAttacks) {
                    let addersChanged = false;
                    for (const adder of (this.system.ADDER || []).filter((a) => !a.targetId)) {
                        const item = this.actor._cslItems.find(
                            (o) => o.name === adder.ALIAS || o.system.ALIAS === adder.ALIAS,
                        );
                        if (item) {
                            adder.targetId = item.id;
                            addersChanged = true;
                        }
                    }
                    if (addersChanged) {
                        // AARON: The update causes error and it seems to work without it
                        //await this.update({ [`system.ADDER`]: this.system.ADDER });
                    }
                }
            }

            // if (this.system.XMLID === "PENALTY_SKILL_LEVELS" && !this.system.penalty) {
            //     if (this.system.OPTION_ALIAS.match(/range/i)) {
            //         this.system.penalty ??= "range";
            //     } else if (this.system.OPTION_ALIAS.match(/hit/i) || this.system.OPTION_ALIAS.match(/location/i)) {
            //         this.system.penalty ??= "hitLocation";
            //     } else if (this.system.OPTION_ALIAS.match(/encumbrance/i) && this.system.OPTIONID.includes("DCV")) {
            //         this.system.penalty ??= "encumbrance";
            //     }
            // }

            // Don't GUESS or rewrite
            // if (this.system.XMLID === "PENALTY_SKILL_LEVELS" && !this.pslPenaltyType) {
            //     this.system.OPTION_ALIAS = this.system.OPTION_ALIAS.replace(
            //         "to offset a specific negative OCV modifier",
            //         "to offset range penalty OCV modifier",
            //     );
            // }
        }
    }

    // setAoeModifier() {
    //     const startDate = Date.now();
    //     const aoeModifier = this.getAoeModifier();
    //     if (aoeModifier) {
    //         this.buildAoeAttackParameters(aoeModifier);
    //     }
    //     window.prepareData.setAoeModifier = (window.prepareData.setAoeModifier || 0) + (Date.now() - startDate);
    // }

    get heroValidation() {
        const _heroValidation = [];

        if (this.baseInfo) {
            if (this.baseInfo.heroValidation) {
                const v = this.baseInfo.heroValidation(this);
                if (v) {
                    _heroValidation.push(...this.baseInfo.heroValidation(this));
                }
            }
        }

        return _heroValidation;
    }

    get pslRangePenaltyOffsetItems() {
        const psls = this.actor.items.filter(
            (pslItem) =>
                pslItem.pslPenaltyType === CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES.range &&
                (pslItem.system.OPTIONID === "ALL" ||
                    pslItem.adders.find(
                        (adder) => adder.ALIAS.toLowerCase().trim() === this.name.toLowerCase().trim(),
                    )) &&
                pslItem.isActive != false,
        );
        return psls;
    }

    get pslPenaltyType() {
        if (this.system.XMLID !== "PENALTY_SKILL_LEVELS") return null;

        if (this.system.OPTION_ALIAS.match(/range/i)) {
            return CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES.range;
        } else if (this.system.OPTION_ALIAS.match(/hit/i) || this.system.OPTION_ALIAS.match(/location/i)) {
            return CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES.hitLocation;
        } else if (this.system.OPTION_ALIAS.match(/encumbrance/i) && this.system.OPTIONID.includes("DCV")) {
            return CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES.encumbrance;
        }

        console.warn(`Unknown PSL type "${this.system.OPTION_ALIAS}"`, this);

        return null;
    }

    setAttack() {
        // ATTACK
        if (this.causesDamageEffect()) {
            // TODO: NOTE: This shouldn't just be for attack type. Should probably get rid of the subType approach.
            const attack = "attack";
            if (this.system.subType !== attack) {
                this.system.subType = attack;
                this.makeAttack();
            } else {
                // Newer item edit may change system.LEVELS or adder/modifier
                this.makeAttack();
            }

            // text description of damage
            this.system.damage = getFullyQualifiedEffectFormulaFromItem(this, {});
        }
    }

    setToHit() {
        // TO HIT
        if (this.rollsToHit()) {
            this.makeToHit();
        }
    }

    setSkills() {
        // SKILLS
        if (this.baseInfo?.type.includes("skill")) {
            const skill = "skill";
            if (this.system.subType !== skill) {
                this.system.subType = skill;
            }
        }
    }

    setMovement() {
        // MOVEMENT
        if (this.baseInfo?.type.includes("movement")) {
            const movement = "movement";
            if (this.system.subType !== movement) {
                this.system.subType = movement;
                this.system.showToggle = true;

                // Movement power typically default to active
                if (
                    !this.system.charges?.value &&
                    this.parentItem?.system.XMLID !== "MULTIPOWER" &&
                    !this.baseInfo?.behaviors.includes("defaultoff")
                ) {
                    this.system.active ??= true;
                }
            }
        }
    }

    setShowToggleActiveDefault() {
        // ShowToggles & Activatable & default active
        // TODO: NOTE: This shouldn't just be for defense type. Should probably get rid of the subType approach.
        if (
            this.baseInfo?.type.includes("defense") ||
            this.baseInfo?.behaviors?.includes("defense") ||
            this.baseInfo?.type?.includes("characteristic") ||
            (["power", "equipment"].includes(this.type) && this.baseInfo?.type?.includes("sense"))
        ) {
            const newDefenseValue = "defense";

            if (this.system.subType !== newDefenseValue && this.baseInfo?.behaviors.includes("activatable")) {
                this.system.subType = newDefenseValue;
                this.system.showToggle = true;
            }

            // Default toggles to ON unless they are instant, have charges, part of a MULTIPOWER, etc
            if (
                this.system.charges?.value > 0 ||
                this.system.AFFECTS_TOTAL === false ||
                this.baseInfo?.duration === "instant" ||
                this.parentItem?.system.XMLID === "MULTIPOWER" ||
                this.baseInfo?.behaviors.includes("defaultoff")
            ) {
                this.system.active ??= false;
            } else {
                if (this.system.active === undefined) {
                    this.system.active ??= true;
                }
            }
        }
    }

    setCarried() {
        if (this.system.CARRIED && this.system.active === undefined && this.end === 0) {
            this.system.active ??= true;
        }
    }

    setShowToggle() {
        if (this.baseInfo?.behaviors.includes("activatable")) {
            if (!this.system.showToggle) {
                this.system.showToggle = true;
            }
        }
    }

    setCharges() {
        // CHARGES are also messed with in _postUploadDetails, should probably consolidate
        const CHARGES = this.findModsByXmlid("CHARGES");
        if (CHARGES) {
            this.system.charges = {
                //max: parseInt(CHARGES.OPTION_ALIAS),
                value: parseInt(CHARGES.OPTION_ALIAS),
                //clipsMax: Math.pow(parseInt((CHARGES.ADDER || []).find((o) => o.XMLID === "CLIPS")?.LEVELS || 1), 2),
                clips: Math.pow(parseInt((CHARGES.ADDER || []).find((o) => o.XMLID === "CLIPS")?.LEVELS || 1), 2),
                // recoverable: !!(CHARGES.ADDER || []).find((o) => o.XMLID === "RECOVERABLE"),
                // continuing: !!(CHARGES.ADDER || []).find((o) => o.XMLID === "CONTINUING")?.OPTIONID,
                // boostable: !!(CHARGES.ADDER || []).find((o) => o.XMLID === "BOOSTABLE"),
                // fuel: !!(CHARGES.ADDER || []).find((o) => o.XMLID === "FUEL"),
                ...this.system.charges,
            };
        }
    }

    async update(...args) {
        if (!this.id) {
            // This is either an effective item or just an item that's not in the database.
            // If it's an effective item, redirect to the original item for persistance otherwise ignore.
            if (this.system._active?.__originalUuid) {
                const originalItem = fromUuidSync(this.system._active.__originalUuid);
                return originalItem.update(...args);
            }

            // Hmm. Just a temporary item. Ignore the update.
            console.warn(`Ignoring update to ${this.actor.name}'s temporary item ${this.detailedName()}`);
            return this;
        }

        return super.update(...args);
    }

    /**
     * Augment the basic Item data model with additional dynamic data.
     */

    // prepareData() {
    //     super.prepareData();
    // }

    calcItemPoints() {
        //let changed = false;
        //super.prepareDerivedData();

        if (this.is5e === undefined) {
            console.warn(`${this.actor.name}/${this.name}: is5e === undefined`);
        }

        // Base points plus adders
        const _basePointsPlusAdders = this._basePoints + this._addersCost;
        // if (_basePointsPlusAdders !== this.system.basePointsPlusAdders) {
        //     //changed = true;
        // }
        this.system.basePointsPlusAdders = _basePointsPlusAdders;
        this.system.basePointsPlusAddersForActivePoints = _basePointsPlusAdders - this._negativeCustomAddersCost;

        // Active Points = (Base Points + cost of any Adders) x (1 + total value of all Advantages)
        const _activePoints = this._activePoints;
        // if (_activePoints !== this.system.activePoints) {
        //     //changed = true;
        // }

        const results = {
            activePoints: _activePoints,
            _activePointsWithoutEndMods: this._activePointsForEnd,
            _advantages: this._advantageCost,
        };

        // Real Cost = Active Points / (1 + total value of all limitations)
        const _realCost = this._realCost;
        if (_realCost !== results.realCost) {
            //changed = true;
            results.realCost = _realCost;
        }

        // CharacterPointCost
        //const _characterPointCost = this._characterPointCost;
        // if (_characterPointCost !== this.system.characterPointCost) {
        //     changed = true;
        // }
        results.characterPointCost = this._characterPointCost;

        return results;
    }

    async _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);

        if (!this.isOwner) {
            //console.log(`Skipping _onUpdate because this client is not an owner of ${this.actor.name}:${this.name}`);
            return;
        }

        await this.setActiveEffects();

        // If our value has changed, we need to rebuild this item.
        // if (changed.system?.value != null) {
        //     // TODO: Update everything!
        //     changed = this.calcItemPoints() || changed;

        //     // DESCRIPTION
        //     const oldDescription = this.system.description;
        //     this.updateItemDescription();
        //     changed = oldDescription !== this.system.description || changed;

        //     // Save changes
        //     await this.update({ system: this.system });
        // }

        if (this.actor && (this.type === "equipment" || this.system.XMLID === "PENALTY_SKILL_LEVELS")) {
            await this.actor.applyEncumbrancePenalty();
        }

        // Update detection modes for SENSE items
        // Seems like a bit of a kluge.  There must be a better way.
        if (this.system.active !== undefined) {
            if (this.actor && this.baseInfo?.type.includes("sense")) {
                for (const token of this.actor.getActiveTokens()) {
                    token.document._prepareDetectionModes();
                    token.renderFlags.set({ refreshVisibility: true });
                }
            }
        }
    }

    /**
     * Reset an item back to its default state.
     */
    async resetToOriginal() {
        // Default active status
        if (
            ["power", "equipment"].includes(this.type) &&
            this.isActivatable() &&
            !this.system.endEstimate &&
            this.system.charges?.value === undefined &&
            this.baseInfo.duration !== "instant" &&
            !(this.parentItem?.system.XMLID === "MULTIPOWER")
        ) {
            await this.update({ [`system.active`]: true });
            const effect = this.effects[0];
            if (effect) {
                await effect.update({ disabled: false });
            }
        }

        // Set Charges to max
        if (this.system.charges && this.system.charges.value !== this.system.LEVELS) {
            await this.update({
                [`system.charges.value`]: this.system.LEVELS, //charges.max,
            });
            //await this._postUpload();
        }

        // if (this.baseInfo?.resetToOriginalChanges) {
        //     await this.update(this.baseInfo.resetToOriginalChanges(this));
        // }

        // Remove temporary effects that have an origin.
        // Actor items with built in effects should have no origin and we want to keep those (POWER STR +30 for example)
        this.effects.map(async (effect) => {
            if (effect.origin) {
                await effect.delete();
            } else {
                // Some effects like purchasing characteristics, should remain
                // unless they are part of a multipower
                if (effect.parent?.parentItem?.system?.XMLID === "MULIPOWER") {
                    await effect.update({ disabled: true });
                } else {
                    // Otherwise turn it on if it has no charges and uses no endurance
                    if (!effect.parent?.end && effect.parent?.system.charges === undefined) {
                        await effect.update({ disabled: false });
                    }
                }
            }
        });

        if (["ENDURANCERESERVE"].includes(this.system.XMLID)) {
            if (this.id) {
                await this.update({ ["system.value"]: this.system.LEVELS });
            } else {
                this.system.value = this.system.LEVELS;
            }
        }

        if (this.type === "maneuver" && this.system.active) {
            await this.update({ ["system.active"]: false });
        }

        if (this.system.XMLID === "INVISIBILITY" && this.system.active) {
            // Invisibility status effect for SIGHTGROUP?
            if (this.system.OPTIONID === "SIGHTGROUP" && !this.actor.statuses.has("invisible")) {
                this.actor.addActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.invisibleEffect);
            }
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
            xmlTag: this.system.xmlTag,
        });
        return (
            powerInfo?.behaviors.includes("success") ||
            (this.system.XMLID === "CUSTOMSKILL" && parseInt(this.system.ROLL) > 0)
        );
    }

    canBeAbortedTo() {
        // Maneuvers have their own rules for what can be used for an abort.
        if (["maneuver", "martialart"].includes(this.type)) {
            return maneuverCanBeAbortedTo(this);
        }

        // Can abort to a defensive power
        else if (this.baseInfo.type.includes("defense")) {
            return true;
        }

        return false;
    }

    async roll(event, options = {}) {
        if (!this.actor.canAct(true, event)) return;

        if (this.actor.needsToAbortToAct() && !this.canBeAbortedTo()) {
            await ui.notifications.warn(`${this.actor.name} is not the active combatant`);
            //return;
        }

        if (this.baseInfo.behaviors.includes("to-hit")) {
            // FIXME: Martial maneuvers all share the MANEUVER XMLID. Need to extract out things from that (and fix the broken things).
            switch (this.system.XMLID) {
                case "AID":
                case "BLOCK":
                case "DODGE":
                case "DRAIN":
                case "EGOATTACK":
                case "ENERGYBLAST":
                case "ENTANGLE":
                case "FLASH":
                case "HANDTOHANDATTACK":
                case "HEALING":
                case "HKA":
                case "MINDSCAN":
                case "MOVEBY":
                case "MOVETHROUGH":
                case "RKA":
                case "SET":
                case "STRIKE":
                case "SUCCOR":
                case "TELEKINESIS":
                case "TRANSFER":
                case "TRANSFORM":
                    return collectActionDataBeforeToHitOptions(this, { ...options, event });

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
                    return collectActionDataBeforeToHitOptions(this, event);
            }
        } else if (this.baseInfo.behaviors.includes("dice")) {
            switch (this.system.XMLID) {
                case "LUCK":
                case "UNLUCK":
                    return rollEffect(this, event);

                case "DEPENDENCE":
                case "SUSCEPTIBILITY":
                default:
                    ui.notifications.warn(`${this.system.XMLID} effect roll is not fully supported`);
                    return rollEffect(this, event);
            }
        } else if (this.baseInfo.behaviors.includes("defense")) {
            return this.toggle(event);
        } else {
            const powerInfo = getPowerInfo({
                item: this,
            });
            const hasSuccessRoll = this.hasSuccessRoll();
            const isSkill = powerInfo?.type.includes("skill");

            if (hasSuccessRoll && isSkill) {
                //this.updateRoll();
                if (!(await requiresASkillRollCheck(this))) return;
                return createSkillPopOutFromItem(this, this.actor);
            } else if (hasSuccessRoll) {
                // Handle any type of non skill based success roll with a basic roll
                // TODO: Basic roll.
                this.updateRoll();
                return createSkillPopOutFromItem(this, this.actor);
            } else {
                ui.notifications.warn(
                    `${this.actor.name}: ${this.name} roll (${hasSuccessRoll}/${isSkill}) is not supported`,
                );
            }
        }
    }

    async chat() {
        //this.getUpdateItemDescription();

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
                    // Some items don't really have a range
                    if (["MULTIPOWER", "COMPOUNDPOWER", "LIST"].includes(this.system.XMLID)) {
                        break;
                    }
                    console.error("Unhandled range", configPowerInfo);
                    if (configPowerInfo?.range?.toLowerCase()) {
                        content += ` ${configPowerInfo?.range?.toLowerCase()}`;
                    }
                    break;
            }
        }

        // Perceivability
        if (this.baseInfo.perceivability) {
            content += ` Perceivability: ${this.baseInfo.perceivability}.`;
        }

        if (this.end) {
            content += ` Estimated End: ${this.end}.`;
        }

        if (this.system.realCost && !isNaN(this.system.realCost)) {
            content += ` Total Cost: ${this.system.realCost} CP.`;
        }

        content += `</div>`;

        const chatData = {
            author: game.user._id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            content: content,
            whisper: [game.user.id],
        };
        ChatMessage.create(chatData);
    }

    /**
     *
     * @param {Event} [event]
     * @returns {Promise<undefined>}
     */
    async toggle(event) {
        let item = this;

        if (!item.isActive) {
            if (!this.actor.canAct(true, event)) {
                return;
            }

            // Make sure there are enough resources and consume them
            const {
                error: resourceError,
                warning: resourceWarning,
                resourcesUsedDescription,
                resourcesUsedDescriptionRenderedRoll,
            } = await userInteractiveVerifyOptionallyPromptThenSpendResources(item, {
                noResourceUse: overrideCanAct,
            });
            if (resourceError) {
                return ui.notifications.error(`${item.name} ${resourceError}`);
            } else if (resourceWarning) {
                return ui.notifications.warn(`${item.name} ${resourceWarning}`);
            }

            // Make sure VPP pool is large enough
            const VPP = item.parentItem?.system.XMLID === "VPP" ? item.parentItem : null;

            if (VPP) {
                // Pool points (LEVELS) is the total amount of Real
                // Points’ worth of powers and abilities the character
                // can create with his VPP at any one time.
                const currentPool = VPP.childItems
                    .filter((i) => i.system.active)
                    .reduce((accumulator, _item) => accumulator + _item.system.realCost, 0);
                if (currentPool + parseInt(item.system?.realCost || 0) > parseInt(VPP.system.LEVELS || 0)) {
                    if (overrideCanAct) {
                        const token = tokenEducatedGuess({
                            item: this,
                        });
                        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
                        //speaker.alias = actor.name;
                        const chatData = {
                            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
                            author: game.user._id,
                            content: `Unable to activate ${item.name} because it would exceed the ${VPP.name} active point pool of ${VPP.system.LEVELS}RC.`,
                            speaker: speaker,
                            whisper: whisperUserTargetsForActor(this.actor),
                        };
                        await ChatMessage.create(chatData);
                    } else {
                        const token = tokenEducatedGuess({
                            item: this,
                        });
                        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
                        const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
                        const chatData = {
                            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
                            author: game.user._id,
                            content:
                                `Unable to activate ${item.name} because it would exceed the ${VPP.name} pool of ${VPP.system.LEVELS}RC.` +
                                `Use ${overrideKeyText} to override.` +
                                `<ul>${VPP.childItems
                                    .filter((i) => i.system.active)
                                    .map((item) => `<li>${parseInt(item.system?.realCost || 0)}RC: ${item.name}</li>`)
                                    .join("")}</ul>` +
                                `<hr>${parseInt(item.system?.realCost || 0)}RC: ${item.name}`,
                            speaker: speaker,
                            whisper: whisperUserTargetsForActor(this.actor),
                        };

                        await ChatMessage.create(chatData);
                        console.log(item, VPP, currentPool);
                        return ui.notifications.error(
                            `Unable to activate ${item.name} because it would exceed the ${VPP.name} pool of ${VPP.system.LEVELS}RC.`,
                        );
                    }
                }

                // PH: FIXME: This check is wrong for 5e where the pool cost determines the max AP
                const controlCost = parseInt(VPP.findModsByXmlid("CONTROLCOST")?.LEVELS || 0);
                if (!item.is5e && parseInt(item.system?.activePoints || 0) > controlCost) {
                    console.log(item, VPP, controlCost);
                    if (overrideCanAct) {
                        const token = tokenEducatedGuess({
                            item: this,
                        });
                        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
                        //speaker.alias = actor.name;
                        const chatData = {
                            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
                            author: game.user._id,
                            content: `${item.name} was activated even though it exceed the ${VPP.name} control cost`,
                            speaker: speaker,
                            whisper: whisperUserTargetsForActor(this.actor),
                        };
                        await ChatMessage.create(chatData);
                    } else {
                        const token = tokenEducatedGuess({
                            item: this,
                        });
                        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
                        const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
                        //speaker.alias = actor.name;
                        const chatData = {
                            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
                            author: game.user._id,
                            content:
                                `Unable to activate ${item.name} because it would exceed the ${VPP.name} control cost of ${controlCost}AP. ` +
                                `Use ${overrideKeyText} to override.`,
                            speaker: speaker,
                            whisper: whisperUserTargetsForActor(this.actor),
                        };

                        await ChatMessage.create(chatData);
                        return ui.notifications.error(
                            `Unable to activate ${item.name} because it would exceed the ${VPP.name} control cost of ${controlCost}AP.`,
                        );
                    }
                }
            }

            const success = await requiresASkillRollCheck(this, event);
            if (!success) {
                const speaker = ChatMessage.getSpeaker({ actor: item.actor });
                speaker["alias"] = item.actor.name;

                const chatData = {
                    author: game.user._id,
                    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                    content: `${
                        resourcesUsedDescription ? `Spent ${resourcesUsedDescription} to attempt` : "Attempted"
                    } to activate ${item.name} but attempt failed${resourcesUsedDescriptionRenderedRoll}`,
                    whisper: whisperUserTargetsForActor(item.actor),
                    speaker,
                };
                await ChatMessage.create(chatData);

                return;
            }

            const speaker = ChatMessage.getSpeaker({ actor: item.actor });
            speaker["alias"] = item.actor.name;

            const chatData = {
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                content: `${
                    resourcesUsedDescription ? `Spent ${resourcesUsedDescription} to activate` : "Activated "
                } ${item.name}${resourcesUsedDescriptionRenderedRoll}`,
                whisper: whisperUserTargetsForActor(item.actor),
                speaker,
            };
            await ChatMessage.create(chatData);

            // A continuing charges use is tracked by an active effect. Start it.
            await _startIfIsAContinuingCharge(this);

            // Toggle status effect on based on power
            if (this.system.XMLID === "INVISIBILITY") {
                // Invisibility status effect for SIGHTGROUP?
                if (this.system.OPTIONID === "SIGHTGROUP" && !this.actor.statuses.has("invisible")) {
                    await this.actor.toggleStatusEffect(
                        HeroSystem6eActorActiveEffects.statusEffectsObj.invisibleEffect.id,
                        {
                            active: true,
                        },
                    );
                }
            } else if (this.system.XMLID === "FLIGHT" || this.system.XMLID === "GLIDING") {
                await this.actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.flyingEffect.id, {
                    active: true,
                });
            } else if (this.system.XMLID === "DESOLIDIFICATION") {
                await this.actor.toggleStatusEffect(
                    HeroSystem6eActorActiveEffects.statusEffectsObj.desolidificationEffect.id,
                    {
                        active: true,
                    },
                );
            } else if (["maneuver", "martialart"].includes(item.type)) {
                await activateManeuver(this);
            }
        } else {
            // Let GM know power was deactivated
            const speaker = ChatMessage.getSpeaker({ actor: item.actor });
            speaker["alias"] = item.actor.name;

            const chatData = {
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                content: `Turned off ${item.name}`,
                whisper: whisperUserTargetsForActor(item.actor),
                speaker,
            };
            await ChatMessage.create(chatData);

            // Toggle status effect off based on power
            if (this.system.XMLID === "INVISIBILITY") {
                // Remove Invisibility status effect
                if (this.actor.statuses.has("invisible")) {
                    await this.actor.toggleStatusEffect(
                        HeroSystem6eActorActiveEffects.statusEffectsObj.invisibleEffect.id,
                        {
                            active: false,
                        },
                    );
                    // await this.actor.removeActiveEffect(
                    //     HeroSystem6eActorActiveEffects.statusEffectsObj.invisibleEffect,
                    // );
                }
            } else if (this.system.XMLID === "FLIGHT" || this.system.XMLID === "GLIDING") {
                if (this.actor.statuses.has("fly")) {
                    await this.actor.toggleStatusEffect(
                        HeroSystem6eActorActiveEffects.statusEffectsObj.flyingEffect.id,
                        {
                            active: false,
                        },
                    );
                    //await this.actor.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.flyingEffect);
                }
            } else if (this.system.XMLID === "DESOLIDIFICATION") {
                await this.actor.toggleStatusEffect(
                    HeroSystem6eActorActiveEffects.statusEffectsObj.desolidificationEffect.id,
                    {
                        active: false,
                    },
                );
                // await this.actor.removeActiveEffect(
                //     HeroSystem6eActorActiveEffects.statusEffectsObj.desolidificationEffect,
                // );
            } else if (["maneuver", "martialart"].includes(item.type)) {
                await deactivateManeuver(this);
            }
        }

        const attr = "system.active";
        const newValue = !foundry.utils.getProperty(item, attr);
        const firstAE = item.effects.find((ae) => ae.flags[game.system.id]?.type !== "adjustment");

        switch (this.type) {
            case "defense":
                await item.update({ [attr]: newValue });
                break;

            case "power":
            case "equipment":
                {
                    // Is this a defense power?  If so toggle active state
                    // const configPowerInfo = item.baseInfo;
                    // if (
                    //     (configPowerInfo && configPowerInfo.type.includes("defense")) ||
                    //     configPowerInfo.behaviors.includes("defense") ||
                    //     item.type === "equipment"
                    // ) {
                    //     await item.update({ [attr]: newValue });
                    // }

                    // Check if there is an ActiveEffect associated with this item
                    if (firstAE) {
                        const newActiveState = firstAE.disabled;
                        const effects = item.effects
                            .filter((ae) => ae.disabled === newValue)
                            .concat(item.actor.effects.filter((o) => o.origin === item.uuid));
                        for (const activeEffect of effects) {
                            await onActiveEffectToggle(activeEffect, newActiveState);
                        }
                    } else {
                        await item.update({ [attr]: newValue });
                    }
                }
                break;

            case "martialart":
            case "maneuver":
                await enforceManeuverLimits(this.actor, this);
                break;

            case "talent": // COMBAT_LUCK
                await item.update({ [attr]: newValue });
                break;

            default:
                ui.notifications.warn(`${this.name} toggle may be incomplete`);
                break;
        }

        // DENSITYINCREASE can affect Encumbrance & Movements
        if (this.system.XMLID === "DENSITYINCREASE") {
            await this.actor.applyEncumbrancePenalty();
        }

        // If we have control of this token, re-acquire to update movement types
        const myToken = this.actor?.getActiveTokens()?.[0];
        if (canvas.tokens.controlled?.find((t) => t.id == myToken?.id)) {
            myToken.release();
            myToken.control();
        }
    }

    isPerceivable(perceptionSuccess) {
        if (["NAKEDMODIFIER", "LIST", "COMPOUNDPOWER"].includes(this.system.XMLID)) {
            return false;
        }

        if (this.system.XMLID.startsWith("__")) {
            return false;
        }

        // Power must be turned on
        if (this.baseInfo?.behaviors.includes("activatable") && !this.system.active) {
            return false;
        }

        // FOCUS
        const FOCUS = this.findModsByXmlid("FOCUS"); //this.system.MODIFIER?.find((o) => o.XMLID === "FOCUS");
        if (FOCUS) {
            if (FOCUS?.OPTIONID?.startsWith("O")) return true;
            if (FOCUS?.OPTIONID?.startsWith("I")) return perceptionSuccess;
        }

        // Combat Maneuvers and Martial Arts are only perceivable when used
        if (["maneuver", "martialarts"].includes(this.type)) {
            return false;
        }

        // If you roll dice the power isn't perceivable just by looking at you.
        // The power must be rolled to be perceivable.
        if (this.baseInfo?.type.includes("attack") || this.baseInfo?.behaviors.includes("to-hit")) {
            return false;
        }

        // Only In ALternate Identity
        if (this.findModsByXmlid("OIHID") && this.actor.system.heroicIdentity === false) return false;

        // TODO: Costs endurance (even if bought to 0 END) is perceivable when active unless it has invisible power effect bought for it.

        const VISIBLE = this.modifiers.find((o) => o.XMLID === "VISIBLE");
        if (VISIBLE) {
            if (VISIBLE?.OPTION?.endsWith("OBVIOUS")) {
                return true;
            } else if (VISIBLE?.OPTION?.endsWith("INOBVIOUS")) {
                return perceptionSuccess;
            }

            return true; // 5e?
        }

        // Default values
        if (this.baseInfo?.perceivability?.toLowerCase() === "imperceptible") {
            return false;
        } else if (this.baseInfo?.perceivability?.toLowerCase() === "obvious") {
            return true;
        } else if (this.baseInfo?.perceivability?.toLowerCase() === "inobvious") {
            return perceptionSuccess;
        }

        // Movement Powers are Inobvious most of the time
        if (this.baseInfo?.type.includes("movement")) {
            return perceptionSuccess;
        }

        // MULTIPOWERs are likely not preceivable by default
        if (["MULTIPOWER"].includes(this.system.XMLID)) {
            return false;
        }

        if (this.system.XMLID === "DISTINCTIVEFEATURES") {
            return "maybe";
        }

        if (
            ["skill", "disadvantage", "perk", "talent"].includes(this.type) ||
            this.baseInfo?.type.includes("characteristic") ||
            this.baseInfo?.type.includes("passive") // passive sense
        ) {
            return false;
        }

        if (this.baseInfo?.duration?.toLowerCase() === "instant") {
            return false;
        }

        if (["INVISIBILITY"].includes(this.system.XMLID)) {
            return false;
        }

        // Most equipment that is not armor or a weapon is likely inobvious
        if (this.type.includes("equipment")) {
            return "maybe";
        }

        if (game.settings.get(game.system.id, "alphaTesting")) {
            console.warn(`${this.actor.name}/${this.name}/${this.system.XMLID} has undetermined perceivability`, this);
        }

        return false;
    }

    static ItemXmlTags = ["SKILLS", "PERKS", "TALENTS", "MARTIALARTS", "POWERS", "DISADVANTAGES", "EQUIPMENT"];
    static ItemXmlChildTags = ["ADDER", "MODIFIER", "POWER"];

    static ItemXmlChildTagsUpload = ["ADDER", "MODIFIER", "POWER", "SKILL", "PERK", "TALENT"];

    findModsByXmlid(xmlid) {
        function recursiveFindByXmlid(xmlid) {
            for (const mod of this.modifiers || this.MODIFIER || []) {
                if (mod.XMLID === xmlid) return mod;
            }
            for (const adder of this.adders || this.ADDER || []) {
                if (adder.XMLID === xmlid) return adder;
            }
            for (const power of this.powers || this.POWER || []) {
                if (power.XMLID === xmlid) return power;
            }

            // recurse part
            for (const mod of this.modifiers || this.MODIFIER || []) {
                const mod2 = recursiveFindByXmlid.call(mod, xmlid);
                if (mod2) {
                    return mod2;
                }
            }
            for (const adder of this.adders || this.ADDER || []) {
                const adder2 = recursiveFindByXmlid.call(adder, xmlid);
                if (adder2) {
                    return adder2;
                }
            }
            for (const power of this.powers || this.POWER || []) {
                const power2 = recursiveFindByXmlid.call(power, xmlid);
                if (power2) {
                    return power2;
                }
            }
        }

        return recursiveFindByXmlid.call(this, xmlid);
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
                if (this.actor?.is5e) {
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

    // setInitialRange(power) {
    //     if (power) {
    //         this.system.range = power.range;
    //     } else {
    //         // This should never happen, missing something from CONFIG.mjs?  Perhaps with super old actors?
    //         this.system.range = CONFIG.HERO.RANGE_TYPES.SELF;
    //     }
    //     return true;
    // }

    // determinePointCosts() {
    //     let changed = false;
    //     changed = this.calcItemPoints() || changed;
    //     return changed;
    // }

    // An attempt to cache getPowerInfo for performance reasons.
    get baseInfo() {
        return this.system.baseInfo;
        // cache getPowerInfo
        // this._baseInfo ??= getPowerInfo({ item: this, xmlTag: this.system.xmlTag });
        // return this._baseInfo;
    }

    get is5e() {
        if (this.system.is5e !== undefined && this.actor && this.actor.is5e !== this.system.is5e) {
            console.warn(
                `${this.actor?.name}/${this.name} has is5e=${this.system.is5e} does not match actor=${this.actor.is5e}`,
                this,
            );
        }
        return this.system.is5e;
    }

    /**
     * Calculate all the AOE related parameters.
     * 5e's modifier is either AOE or EXPLOSION. 6e is always AOE. There are of course ADDERS which modify the two possibilities.
     *
     * @param {Modifier} aoeModifier - Must be AOE or EXPLOSION modifier.
     * @returns
     */
    // buildAoeAttackParameters(aoeModifier) {
    //     const is5e = !!this.actor?.system?.is5e;

    //     let changed = false;

    //     const widthDouble = parseInt(
    //         (aoeModifier.ADDER || []).find((adder) => adder.XMLID === "DOUBLEWIDTH")?.LEVELS || 0,
    //     );
    //     const heightDouble = parseInt(
    //         (aoeModifier.ADDER || []).find((adder) => adder.XMLID === "DOUBLEHEIGHT")?.LEVELS || 0,
    //     );
    //     // In 6e, widthDouble and heightDouble are the actual size and not instructions to double like 5e
    //     const width = is5e ? Math.pow(2, widthDouble) : widthDouble || 2;
    //     const height = is5e ? Math.pow(2, heightDouble) : heightDouble || 2;
    //     let levels = 1;
    //     let dcFalloff = 0;

    //     // 5e has a calculated size
    //     if (is5e) {
    //         const activePointsWithoutAoeAdvantage = this._activePointsWithoutAoe;
    //         if (aoeModifier.XMLID === "AOE") {
    //             switch (aoeModifier.OPTIONID) {
    //                 case "CONE":
    //                     levels = RoundFavorPlayerUp(1 + activePointsWithoutAoeAdvantage / 5);
    //                     break;

    //                 case "HEX":
    //                     levels = 1;
    //                     break;

    //                 case "LINE":
    //                     levels = RoundFavorPlayerUp((2 * activePointsWithoutAoeAdvantage) / 5);
    //                     break;

    //                 case "ANY":
    //                 case "RADIUS":
    //                     levels = Math.max(1, RoundFavorPlayerUp(activePointsWithoutAoeAdvantage / 10));
    //                     break;

    //                 default:
    //                     console.error(`Unhandled 5e AOE OPTIONID ${aoeModifier.OPTIONID} for ${this.detailedName()}`);
    //                     break;
    //             }

    //             // Modify major dimension (radius, length, etc). Line is different from all others.
    //             const majorDimensionDoubles = (aoeModifier?.ADDER || []).find(
    //                 (adder) => adder.XMLID === "DOUBLEAREA" || adder.XMLID === "DOUBLELENGTH",
    //             );
    //             if (majorDimensionDoubles) {
    //                 levels *= Math.pow(2, parseInt(majorDimensionDoubles.LEVELS));
    //             }
    //         } else {
    //             // Explosion DC falloff has different defaults based on shape. When
    //             // LEVELS are provided they are the absolute value and not additive to the default.
    //             if (aoeModifier.OPTIONID === "CONE") {
    //                 dcFalloff = 2;
    //             } else if (aoeModifier.OPTIONID === "LINE") {
    //                 dcFalloff = 3;
    //             } else {
    //                 dcFalloff = 1;
    //             }
    //             dcFalloff = aoeModifier.LEVELS ? parseInt(aoeModifier.LEVELS) : dcFalloff;

    //             // The description in FRed is poorly written as it talks about AP of the power but it doesn't exclude
    //             // the contribution of the explosion advantage itself although its example does. We will remove the explosion contribution to
    //             // the power's DC.
    //             const effectiveDc = Math.floor(activePointsWithoutAoeAdvantage / 5);
    //             levels = effectiveDc * dcFalloff;
    //         }
    //     } else {
    //         levels = parseInt(aoeModifier.LEVELS || 0);
    //     }

    //     // 5e has HEX and RADIUS but they're the same template. 5e explosion radius template is called NORMAL for some reason.
    //     const type =
    //         aoeModifier.OPTIONID === "HEX" || aoeModifier.OPTIONID === "NORMAL" ? "RADIUS" : aoeModifier.OPTIONID;
    //     const newAoe = {
    //         type: type.toLowerCase(),
    //         value: levels,
    //         width: width,
    //         height: height,

    //         isExplosion: this.hasExplosionAdvantage(),
    //         dcFalloff: dcFalloff,
    //     };

    //     if (!foundry.utils.objectsEqual(this.system.areaOfEffect, newAoe)) {
    //         this.system.areaOfEffect = {
    //             ...this.system.areaOfEffect,
    //             ...newAoe,
    //         };

    //         changed = true;
    //     }

    //     return changed;
    // }

    // buildRangeParameters() {
    //     const originalRange = this.system.range;

    //     // Range Modifiers "self", "no range", "standard", or "los" based on base power.
    //     // It is the modified up or down but the only other types that should be added are:
    //     // "range based on str" or "limited range"
    //     const ranged = !!this.findModsByXmlid("RANGED");
    //     const noRange = !!this.findModsByXmlid("NORANGE");
    //     const limitedRange =
    //         this.findModsByXmlid("RANGED")?.OPTIONID === "LIMITEDRANGE" || // Advantage form
    //         !!this.findModsByXmlid("LIMITEDRANGE"); // Limitation form
    //     const rangeBasedOnStrength =
    //         this.findModsByXmlid("RANGED")?.OPTIONID === "RANGEBASEDONSTR" || // Advantage form
    //         !!this.findModsByXmlid("RANGEBASEDONSTR"); // Limitation form
    //     const los = !!this.findModsByXmlid("LOS");
    //     const normalRange = !!this.findModsByXmlid("NORMALRANGE");
    //     const usableOnOthers = !!this.findModsByXmlid("UOO");
    //     const boecv = !!this.findModsByXmlid("BOECV");

    //     // Based on EGO combat value comes with line of sight
    //     if (boecv) {
    //         this.system.range = CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT;
    //     }

    //     // Self only powers cannot be bought to have range unless they become usable on others at which point
    //     // they gain no range.
    //     if (this.system.range === CONFIG.HERO.RANGE_TYPES.SELF) {
    //         if (usableOnOthers) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
    //         }
    //     }

    //     // No range can be bought to have range.
    //     if (this.system.range === CONFIG.HERO.RANGE_TYPES.NO_RANGE) {
    //         if (ranged) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.STANDARD;
    //         }
    //     }

    //     // Standard range can be bought up or bought down.
    //     if (this.system.range === CONFIG.HERO.RANGE_TYPES.STANDARD) {
    //         if (noRange) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
    //         } else if (los) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT;
    //         } else if (limitedRange) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.LIMITED_RANGE;
    //         } else if (rangeBasedOnStrength) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.RANGE_BASED_ON_STR;
    //         }
    //     }

    //     // Line of sight can be bought down
    //     if (this.system.range === CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT) {
    //         if (normalRange) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.STANDARD;
    //         } else if (rangeBasedOnStrength) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.RANGE_BASED_ON_STR;
    //         } else if (limitedRange) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.LIMITED_RANGE;
    //         } else if (noRange) {
    //             this.system.range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
    //         }
    //     }

    //     return originalRange === this.system.range;
    // }

    // FIXME: Take this function out back and kill it. It's too similar to buildAoeAttackParameters
    aoeAttackParameters() {
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
                const activePointsWithoutAoeAdvantage = this._activePointsWithoutAoe;
                if (aoeModifier.XMLID === "AOE") {
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
                                `Unhandled 5e AOE OPTIONID ${aoeModifier.OPTIONID} for ${this.detailedName()}`,
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
                    dcFalloff = parseInt(aoeModifier.LEVELS || 0) ? parseInt(aoeModifier.LEVELS) : dcFalloff;

                    const effectiveDc = Math.floor(activePointsWithoutAoeAdvantage / 5);
                    levels = effectiveDc * dcFalloff;
                }
            } else {
                levels = parseInt(aoeModifier.LEVELS);
            }

            // 5e has a slightly different alias for an Explosive Radius in HD.
            // Otherwise, all other shapes seems the same.
            const type =
                aoeModifier.OPTIONID === "HEX" || aoeModifier.OPTIONID === "NORMAL" ? "RADIUS" : aoeModifier.OPTIONID;
            const newAoe = {
                type: type.toLowerCase(),
                value: levels,
                width: width,
                height: height,

                isExplosion: this.hasExplosionAdvantage(),
                dcFalloff: dcFalloff,
            };

            // KLUGE for SURFACE
            // Rectangles are defined as a distance/hypotenuse
            if (aoeModifier.OPTIONID === "SURFACE") {
                newAoe.direction = 45;
                newAoe.distance = Math.sqrt(levels * levels * 2);
            }

            return {
                ...aoeModifier,
                ...newAoe,
            };
        }
        return null;
    }

    /**
     * If activatable return true otherwise it is a damage maneuver and return false.
     * @returns boolean
     */
    isActivatableManeuver() {
        // Hero designer has a few ways of marking things as doing damage. For the prebuilt ones you can't look at DAMAGETYPE as it's always "0" even
        // for things like a Flying Dodge. So, we make our decision based on the EFFECT/WEAPONEFFECT. This means that custom maneuvers need to have the
        // correct EFFECT or WEAPONEFFECT specified for things to work.
        // NOTE: Doesn't appear that there is a [WEAPONNNDDC] or [WEAPONFLASHDC] but we're going to add it just in case
        const effect = getManeuverEffect(this);

        // Does it have a recognized damage type?
        if (isManeuverThatDoesReplaceableDamageType(this)) {
            return false;
        }

        // Does it perform a strike?
        else if (effect.search(/Strike/) > -1) {
            return false;
        }

        // Does it use Strength?
        else if (effect.search(/\[STRDC\]/) > -1) {
            return false;
        }

        // Does it use velocity?
        else if (effect.search(/v\/\d/) > -1) {
            return false;
        }

        // Does it require an attack to hit roll like BLOCK?
        else if (maneuverHasBlockTrait(this)) {
            return false;
        }

        return true;
    }

    // FIXME: This should be trimmed down
    isActivatable() {
        if (this.type === "characteristic") {
            return false;
        }

        const itemEffects = this.effects.find((ae) => ae.flags[game.system.id]?.type !== "adjustment");
        if (itemEffects) {
            return true;
        }

        // NOTE: item._id can be null in the case of a temporary/effective item.
        const actorEffects = this.actor.effects.find((o) => o.origin === this.actor.items.get(this._id)?.uuid);
        if (actorEffects) {
            return true;
        }

        if (
            this.baseInfo?.behaviors?.includes("activatable") ||
            (this.system.XMLID === "MANEUVER" && this.isActivatableManeuver())
        ) {
            return true;
        }

        // FIXME: This should not be required as the behavior should be marked correctly.
        if (this.baseInfo?.type?.includes("sense")) {
            return true;
        }

        // FIXME: This should not be required as the behavior should be marked correctly.
        // Talent/Skill/Perk as Powers are technically toggleable
        if (this.type === "power" && ["talent", "skill", "perk"].find((o) => this.baseInfo?.type.includes(o))) {
            return true;
        }

        // Custom Light
        // if (this.id && this.system.XMLID === "CUSTOMPOWER" && this.system.description.match(/light/i)) {
        //     return true;
        // }

        return false;
    }

    _postUploadDetails() {
        // TODO: Should move most of this stuff into prepareData
        const item = this;

        // Make sure we have an actor (like when creating compendiums)
        if (!item.actor) {
            return;
        }

        // showToggle
        item.system.showToggle = this.isActivatable();

        const itemEffects = item.effects.find((ae) => ae.flags[game.system.id]?.type !== "adjustment");
        if (itemEffects) {
            item.system.active = !itemEffects.disabled;
        }

        // NOTE: item._id can be null in the case of a temporary/effective item.
        const actorEffects = item.actor.effects.find((o) => o.origin === item.actor.items.get(item._id)?.uuid);
        {
            if (actorEffects) {
                item.system.active = !actorEffects.disabled;
            }
        }

        // Penalty Skill Levels are checked by default
        if (item.system.XMLID === "PENALTY_SKILL_LEVELS" && this.system.checked === undefined) {
            this.system.checked = true;
        }

        // Endurance
        //item.system.endEstimate = parseInt(item.end) || 0;

        // Effect
        this.configureAttackParameters();

        // Defense
        // if (item.type === "defense") {
        //     item.description =
        //         CONFIG.HERO.defenseTypes[item.system.defenseType] ||
        //         CONFIG.HERO.defenseTypes5e[item.system.defenseType];
        // }

        // This seems to still be required. See #2624.
        //item.updateRoll();

        // Charges
        // Not sure why we do CHARGES here and in setCharges();
        // if (parseInt(item.system.charges?.max || 0) > 0) {
        //     const costsEnd = item.findModsByXmlid("COSTSEND");
        //     if (item.system.endEstimate === 0 || !costsEnd) {
        //         item.system.endEstimate = "";
        //     }

        //     const numChargesIndicator = `${parseInt(item.system.charges?.value || 0)}${
        //         item.system.charges?.clipsMax && item.system.charges?.clipsMax > 1
        //             ? `x${item.system.charges?.clips}`
        //             : ""
        //     }`;
        //     const boostableIndicator = `${item.system.charges?.boostable ? "b" : ""}`;
        //     const recoverableIndicator = `${item.system.charges?.recoverable ? "r" : ""}`;
        //     const continuingIndicator = `${item.system.charges?.continuing ? "c" : ""}`;
        //     const fuelIndicator = `${item.system.charges?.fuel ? "f" : ""}`;

        //     item.system.endEstimate = `${
        //         item.system.endEstimate ? `${item.system.endEstimate} ` : ""
        //     }[${numChargesIndicator}${boostableIndicator}${recoverableIndicator}${continuingIndicator}${fuelIndicator}]`;
        // }

        // // 0 END
        // if (!item.system.endEstimate) {
        //     item.system.endEstimate = "";
        // }

        // // Mental
        // if (item?.flags?.[game.system.id]?.tags?.omcv) {
        //     item.flags[game.system.id] ??= {};
        //     item.flags[game.system.id].tags.ocv ??= item.flags[game.system.id]?.tags.omcv;
        //     item.flags[game.system.id].tags.dcv ??= item.flags[game.system.id]?.tags.dmcv;
        // }
    }

    configureAttackParameters() {
        const maneuver = ["maneuver", "martialart"].includes(this.type);

        // PH: FIXME: Kludge to stick in ocv & dcv
        if (maneuver) {
            this.system.uses = "ocv";
            this.system.ocv = parseInt(this.system.OCV) || 0;
            this.system.dcv = parseInt(this.system.DCV) || 0;
        }

        this.flags[game.system.id] ??= {};
        this.flags[game.system.id].tags = {};

        // Combat Skill Levels
        const csls = combatSkillLevelsForAttack(this);
        let cslSummary = {};

        for (const csl of csls) {
            for (const prop of ["ocv", "omcv", "dcv", "dmcv", "dc"]) {
                cslSummary[prop] = csl[prop] + parseInt(cslSummary[prop] || 0);

                if (csl[prop] != 0) {
                    if (this.flags[game.system.id].tags[prop]) {
                        this.flags[game.system.id].tags[prop] += "\n";
                    } else {
                        this.flags[game.system.id].tags[prop] = "";
                    }
                    this.flags[game.system.id].tags[prop] =
                        `${this.flags[game.system.id].tags[prop]}${csl[prop].signedStringHero()} ${prop === "dc" ? "DC " : ""}${csl.item.name}`;
                }
            }
        }

        // text description of damage
        if (this.causesDamageEffect()) {
            this.system.damage = getFullyQualifiedEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
        }

        if (this.system.cvModifiers === undefined) {
            this.system.cvModifiers = Attack.parseCvModifiers(this.system.OCV, this.system.DCV, this.system.DC);
        }

        // Signed OCV and DCV
        if (this.system.ocv != undefined && this.system.uses === "ocv") {
            const ocv = parseInt(this.actor?.system.characteristics.ocv?.value || 0);
            if (parseInt(ocv) != 0) {
                if (this.flags[game.system.id].tags.ocv) {
                    this.flags[game.system.id].tags.ocv += "\n";
                } else {
                    this.flags[game.system.id].tags.ocv = "";
                }
                this.flags[game.system.id].tags.ocv =
                    `${this.flags[game.system.id].tags.ocv}${ocv.signedStringHero()} OCV`;
            }
            switch (this.system.ocv) {
                case "--":
                    this.system.ocvEstimated = "";
                    break;

                case "-v/10":
                    {
                        this.system.ocv = ("+" + parseInt(this.system.ocv)).replace("+-", "-");

                        // Educated guess for token
                        const token =
                            this.actor
                                .getActiveTokens()
                                .find((t) => canvas.tokens.controlled.find((c) => c.id === t.id)) ||
                            this.actor.getActiveTokens()[0];
                        const velocity = calculateVelocityInSystemUnits(this.actor, token);

                        this.system.ocvEstimated = `${ocv + parseInt(cslSummary.ocv) + parseInt(velocity / 10)}`;

                        if (parseInt(velocity / 10) != 0) {
                            if (this.flags[game.system.id].tags.ocv) {
                                this.flags[game.system.id].tags.ocv += "\n";
                            } else {
                                this.flags[game.system.id].tags.ocv = "";
                            }
                            this.flags[game.system.id].tags.ocv = `${this.flags[game.system.id].tags.ocv}${parseInt(
                                velocity / 10,
                            ).signedStringHero()} Velocity`;
                        }
                    }
                    break;

                default:
                    this.system.ocv = parseInt(this.system.ocv).signedStringHero();

                    this.system.ocvEstimated = `${ocv + parseInt(this.system.ocv) + parseInt(cslSummary.ocv || cslSummary.omcv || 0)}`;

                    if (parseInt(this.system.ocv) != 0) {
                        if (this.flags[game.system.id].tags.ocv) {
                            this.flags[game.system.id].tags.ocv += "\n";
                        } else {
                            this.flags[game.system.id].tags.ocv = "";
                        }
                        this.flags[game.system.id].tags.ocv += `${this.system.ocv} ${this.name}`;
                    }
            }
        }

        if (this.system.dcv != undefined && this.system.uses === "ocv") {
            const dcv = parseInt(this.actor?.system.characteristics.dcv?.value || 0);
            if (parseInt(dcv) !== 0) {
                if (this.flags[game.system.id].tags.dcv) {
                    this.flags[game.system.id].tags.dcv += "\n";
                } else {
                    this.flags[game.system.id].tags.dcv = "";
                }
                this.flags[game.system.id].tags.dcv =
                    `${this.flags[game.system.id].tags.dcv}${dcv.signedStringHero()} DCV`;
            }
            this.system.dcv = parseInt(this.system.dcv).signedStringHero();
            this.system.dcvEstimated = `${dcv + parseInt(this.system.dcv) + parseInt(cslSummary.dcv || cslSummary.dmcv || 0)}`;

            if (parseInt(this.system.dcv) != 0) {
                if (this.flags[game.system.id].tags.dcv) {
                    this.flags[game.system.id].tags.dcv += "\n";
                } else {
                    this.flags[game.system.id].tags.dcv = "";
                }
                this.flags[game.system.id].tags.dcv =
                    `${this.flags[game.system.id].tags.dcv}${this.system.dcv} ${this.name}`;
            }
        }

        if (this.system.uses === "omcv") {
            const omcv = parseInt(this.actor?.system.characteristics.omcv?.value || 0);
            this.system.ocvEstimated = `${omcv + parseInt(cslSummary.omcv || 0)}`;
            if (omcv !== 0) {
                if (this.flags[game.system.id].tags.omcv) {
                    this.flags[game.system.id].tags.omcv += "\n";
                } else {
                    this.flags[game.system.id].tags.omcv = "";
                }
                this.flags[game.system.id].tags.omcv =
                    `${this.flags[game.system.id].tags.omcv}${omcv.signedStringHero()} OMCV`;
            }

            const dmcv = parseInt(this.actor?.system.characteristics.dmcv?.value || 0);
            this.system.dcvEstimated = `${dmcv + parseInt(cslSummary.dmcv || 0)}`;
            if (dmcv !== 0) {
                if (this.flags[game.system.id].tags.dmcv) {
                    this.flags[game.system.id].tags.dmcv += "\n";
                } else {
                    this.flags[game.system.id].tags.dmcv = "";
                }
                this.flags[game.system.id].tags.dmcv =
                    `${this.flags[game.system.id].tags.dmcv}${dmcv.signedStringHero()} DMCV`;
            }
        }

        // Set +1 OCV
        const setManeuver = this.actor.items.find((o) => o.type == "maneuver" && o.name === "Set" && o.system.active);
        if (setManeuver) {
            // Some items do not have OCV (like set itself)
            if (this.system.ocvEstimated !== undefined) {
                this.system.ocvEstimated = `${parseInt(this.system.ocvEstimated) + 1}`;

                if (this.flags[game.system.id].tags.ocv) {
                    this.flags[game.system.id].tags.ocv += "\n";
                } else {
                    this.flags[game.system.id].tags.ocv = "";
                }
                this.flags[game.system.id].tags.ocv += `+1 Set`;
            }
        }

        // Haymaker -5 DCV
        const haymakerManeuver = this.actor.items.find(
            (o) => o.type == "maneuver" && o.name === "Haymaker" && o.system.active,
        );
        if (haymakerManeuver) {
            // Some items do not have DCV (like haymaker itself)
            if (this.system.dcvEstimated !== undefined) {
                this.system.dcvEstimated = `${parseInt(this.system.dcvEstimated) - 5}`;

                if (this.flags[game.system.id].tags.dcv) {
                    this.flags[game.system.id].tags.dcv += "\n";
                } else {
                    this.flags[game.system.id].tags.dcv = "";
                }
                this.flags[game.system.id].tags.dcv += `-5 Haymaker`;
            }
        }

        // STRMINIMUM
        const strengthMinimumModifier = this.findModsByXmlid("STRMINIMUM");
        if (strengthMinimumModifier) {
            const strMinimumValue = calculateStrengthMinimumForItem(this, strengthMinimumModifier);
            const extraStr = Math.max(0, parseInt(this.actor?.system.characteristics.str.value || 0)) - strMinimumValue;
            if (extraStr < 0) {
                const adjustment = Math.floor(extraStr / 5);
                this.system.ocvEstimated = `${parseInt(this.system.ocvEstimated) + adjustment}`;

                if (this.flags[game.system.id].tags.ocv) {
                    this.flags[game.system.id].tags.ocv += "\n";
                } else {
                    this.flags[game.system.id].tags.ocv = "";
                }
                this.flags[game.system.id].tags.ocv +=
                    `${adjustment.signedStringHero()} ${strengthMinimumModifier.ALIAS}`;
            }
        }

        this.system.phase = this.system.PHASE;
    }

    rollsToHit() {
        try {
            return (
                (this.system.XMLID !== "MANEUVER" && this.baseInfo?.behaviors.includes("to-hit")) ||
                (this.system.XMLID === "MANEUVER" && !this.isActivatable())
            );
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    causesDamageEffect() {
        return (
            (this.system.XMLID !== "MANEUVER" && this.baseInfo?.behaviors.includes("dice")) ||
            (this.system.XMLID === "MANEUVER" && !this.isActivatable())
        );
    }

    async _postUpload(options) {
        try {
            // Compendium?
            if (this.pack) {
                console.log(`skipping _postUpload for ${this.pack}.${this.name}`, this);
                return;
            }

            if (this.type === "characteristic") {
                return;
            }

            // Adding this back in (was only called in prepareData).
            // Needed for when we add/remove attacks as we need to update CSLs.
            // TODO: move this into Actor addEmbeddedItems or similar
            this.setCombatSkillLevels();

            // Progress Bar (plan to deprecate)
            if (options?.uploadProgressBar) {
                if (this.system.versionHeroSystem6eCreated === undefined) {
                    this.system.versionHeroSystem6eCreated = game.system.version;
                    options.uploadProgressBar.advance(`${this.actor.name}: Adding ${this.name}`);
                }
            }

            await this.setActiveEffects();

            this._postUploadDetails(options);

            return true;
        } catch (error) {
            try {
                if (foundry.utils.isNewerVersion(this.actor?.system.versionHeroSystem6eCreated, "3.0.63")) {
                    ui.notifications.error(
                        `${this.detailedName()} for ${this.actor?.name} failed to parse properly. Please report.  Error: ${error.message}`,
                        { console: true, permanent: true },
                    );
                    console.error(error);
                } else {
                    ui.notifications.error(
                        `${this.detailedName()} for ${this.actor?.name} failed to parse properly, it is no longer supported. Please upload the HDC file again.`,
                        { console: true, permanent: false },
                    );
                    console.error(error);
                }
            } catch (error2) {
                ui.notifications.error(
                    `${this.detailedName()} for ${this.actor.name} failed to parse properly. Please report.`,
                    { console: true, permanent: true },
                );
                console.error(error);
                console.error(error2);
            }
        }
        return false;
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
        const performanceStart = new Date().getTime();
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
        if (actor?.system?.is5e == undefined) {
            // Yuck
            console.warn(`DefaultEdition was used to determine is5e for ${actor?.name}`);
        }
        itemData.system.is5e =
            actor?.system?.is5e == undefined
                ? game.settings.get(HEROSYS.module, "DefaultEdition") === "five"
                    ? true
                    : false
                : actor?.system?.is5e;

        const powerList = (itemData.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e).filter(
            (possibleNonModifierOrAdder) =>
                !(
                    possibleNonModifierOrAdder.behaviors.includes("adder") ||
                    possibleNonModifierOrAdder.behaviors.includes("modifier")
                ),
        );
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
                        name: system?.NAME || system?.ALIAS || system?.XMLID || itemTag, // simplistic name for now
                        type:
                            powerList
                                .filter((o) => o.type?.includes("characteristic"))
                                .map((o) => o.key)
                                .includes(system.XMLID) || ["MULTIPOWER", "ELEMENTAL_CONTROL"].includes(system.XMLID)
                                ? "power"
                                : itemTag.toLowerCase().replace(/s$/, ""),
                        system: { ...system, is5e: itemData.system.is5e, xmlTag: itemSubTag },
                    };

                    // Skill Enhancers
                    if (["JACK_OF_ALL_TRADES", "LINGUIST", "SCIENTIST", "SCHOLAR", "TRAVELER"].includes(system.XMLID)) {
                        itemData.type = "skill";
                    }

                    // Perk Enhancers
                    if (["WELL_CONNECTED"].includes(system.XMLID)) {
                        itemData.type = "perk";
                    }

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

        const performanceDuration = new Date().getTime() - performanceStart;
        if (performanceDuration > 1000) {
            console.warn(
                `${this.actor?.name}/${this.detailedName()}: Performance concernt. Took ${performanceDuration} seconds to upload.`,
            );
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
        if (!this.system?.ID) return null;

        const items = this.actor?.items || game.items;
        return items.find((item) => item.system?.ID === parentId) || null;
    }

    /**
     * Retrieves all child items of the current item based on the PARENTID property.
     *
     * @returns {Array} An array of child items.
     */
    get childItems() {
        /// Compendiums only have the index entry, so need to get the whole item
        // However, we apparently never need this, so commenting it out for now.
        // If we HAVE to have this we need to make get childItems async, which is messy.
        // if (this.pack) {
        //     const p = game.packs.get(this.pack).getDocuments({ "system.ID": this.system.PARENTID });
        //     p.then()
        // }
        // game.packs.get(this.pack).index.contents

        // Super old items may not have an ID
        if (!this.system?.ID) return [];

        const items = this.actor?.items || (this.pack ? [] : game.items);

        const children = items
            .filter((item) => item.system.PARENTID === this.system.ID)
            .sort((a, b) => (a.sort || 0) - (b.sort || 0));
        return children;
    }

    get childIdx() {
        if (!this.parentItem) return null;
        let result = this.parentItem.childItems.findIndex((o) => o.id === this.id) + 1;
        if (this.parentItem?.parentItem) {
            result = `${this.parentItem.childIdx}.${result}`;
        }
        return result;
    }

    // If this item belongs to an unlinked actor may want to know if it was
    // inherited from the baseActor.
    get baseActor() {
        return this.actor?.token?.baseActor;
    }

    // You would think there would be a built in property, perhaps in token.delta
    // to determine this, but I was unable to find one.
    get isFromBaseActor() {
        if (!this.baseActor) {
            return true;
        }

        return this.baseActor?.items.find((o) => o.id === this.id) ? true : false;

        // FIXME: This doesn't quite work. QUANTITY?
        // return this.baseActor?.items.find((o) => o.id === this.id && o.toXML() === this.toXML()) ? true : false;
    }

    static _modifiersCache = HeroSystemGenericSharedCache.create("modifiers");
    get modifiers() {
        // Caching for performance
        // if (this.id) {
        //     const cachedValue = HeroSystem6eItem._modifiersCache.getCachedValue(this.id);
        //     if (cachedValue) {
        //         return cachedValue;
        //     }
        // }

        // Need to be careful we don't jumble up parent & child modifiers, so make a working copy.
        // Any changes will require special handling.
        let _modifiers = [...(this.system.MODIFIER || [])];
        // for (const _mod of this.system.MODIFIER || []) {
        //     _modifiers.push(new HeroSystem6eModifier(_mod, { item: this, _itemUuid: this.uuid }));
        // }

        if (this.parentItem) {
            // Include common modifiers from parent that are not private.
            // <i>Crossbow:</i>  Multipower, 50-point reserve,  (50 Active Points); all slots OAF (-1)
            for (const pMod of this.parentItem.modifiers.filter((mod) => mod.PRIVATE === false)) {
                // Add parent mod if we don't already have it
                if (!_modifiers.find((mod) => mod.ID === pMod.ID)) {
                    // We may want the parent reference at some point (like for ingame editing of items)
                    //pMod.parentId ??= this.parentItem.system.ID;

                    // Sometimes the same modifiers is applied to item and items parent, we keep the most expensive one
                    const mod = _modifiers.find((mod) => mod.XMLID === pMod.XMLID);

                    // Cannot use mod.cost because we may trigger a stack overflow due to recursion.
                    // Instead we will use a rough cost estimate using BASECOST
                    const pCost = parseFloat(pMod.BASECOST || 0);
                    const mCost = parseFloat(mod?.BASECOST || 0);
                    if (mod && pCost === 0 && mCost === 0) {
                        // Do we really care, likely not, leave warn code commented out as we may want it later.
                        // console.warn(`inconclusive parent/child mod BASECOST for ${this.actor?.name}:${this.name}`),
                        //     this;
                    }
                    if (!mod || (pCost < 0 && pCost < mCost)) {
                        // Keeping parent modifier
                        _modifiers = _modifiers.filter((mod) => mod.XMLID !== pMod.XMLID);
                        //_modifiers.push(new HeroSystem6eModifier(pMod._original || pMod, { item: this }));
                        _modifiers.push(pMod);
                    } else {
                        // Keeping child modifier
                        console.debug("Keeping child modifier instead of parent", pMod, mod);
                    }
                }
            }
        }

        // // Cache modifiers if this is a non temporary item
        // if (this.id) {
        //     HeroSystem6eItem._modifiersCache.setCachedValue(this.id, _modifiers);
        // }

        return _modifiers;
    }

    get advantages() {
        return this.modifiers.filter((o) => o.cost >= 0);
    }

    get limitations() {
        return this.modifiers.filter((o) => o.cost < 0);
    }

    static _addersCache = HeroSystemGenericSharedCache.create("adders");
    get adders() {
        if (!this.system?.ADDER) {
            return [];
        }
        return this.system.ADDER;
        // // Caching for performance
        // if (this.id) {
        //     const cachedValue = HeroSystem6eItem._addersCache.getCachedValue(this.id);
        //     if (cachedValue) {
        //         return cachedValue;
        //     }
        // }

        // const _adders = [];
        // for (const _adderJson of this.system.ADDER || []) {
        //     _adders.push(new HeroSystem6eAdder(_adderJson, { item: this, parent: this }));
        // }

        // // Cache adders if this is a non temporary item
        // if (this.id) {
        //     HeroSystem6eItem._addersCache.setCachedValue(this.id, _adders);
        // }

        // return _adders;
    }

    //static #powersCache = HeroSystemGenericSharedCache.create("powers");
    get powers() {
        if (!this.system?.POWER) {
            return [];
        }
        return this.system.POWER;
        // Caching for performance
        // if (this.id) {
        //     const cachedValue = HeroSystem6eItem.#powersCache.getCachedValue(this.id);
        //     if (cachedValue) {
        //         return cachedValue;
        //     }
        // }

        // // ENDURANCERESERVE uses a POWER "modifier"
        // // This can get confusing with COMPOUNDPOWERS that have POWERs.
        // // uploadFromXml has been improved to remove these duplciate POWER entries as of 1/18/1025.
        // // A quick sanity check warns of this issue and removes the offending POWER from the array.
        // // There was an issue where findModsByXmlid(, "STRMINIMUM") would return the COMPOUNDPOWER instead of the RKA (Oceana Silverheart.HDC)
        // let powersList = this.system.POWER || [];
        // try {
        //     for (let p of powersList) {
        //         const childDuplicate = this.childItems.find((c) => c.system.ID === p.ID);
        //         if (childDuplicate) {
        //             console.warn(
        //                 `${this.actor.name}:${p.ALIAS} is an ITEM (${this.name}). It also has a POWER modifier entry that shouldn't be there. The offending POWER modifier has been temporarily removed and should not cause any issues. Re-uploading the HDC file should resolve this issue.`,
        //             );
        //             this.system.POWER = powersList.filter((p) => !this.childItems.find((c) => c.system.ID === p.ID));
        //         }
        //     }
        //     powersList = powersList.filter((p) => !this.childItems.find((c) => c.system.ID === p.ID));

        //     const _powers = [];
        //     for (const _powerJson of powersList) {
        //         _powers.push(new HeroSystem6eConnectingPower(_powerJson, { item: this, parent: this }));
        //     }

        //     // Cache powers if this is a non temporary item
        //     if (this.id) {
        //         HeroSystem6eItem.#powersCache.setCachedValue(this.id, _powers);
        //     }

        //     return _powers;
        // } catch (e) {
        //     console.error(e);
        //     return [];
        // }
    }

    /**
     * Returns the base cost of an item. It's possible that it costs more beyond there (e.g. STR added etc)
     * @returns number
     */
    getBaseEndCost() {
        // PERKS, TALENTS, COMPLICATIONS, and martial maneuvers do not use endurance.
        if (["perk", "talent", "complication", "martialart"].includes(this.type)) {
            return 0;
        }

        // Combat maneuvers cost 1 END
        if (this.type === "maneuver") {
            return 1;
        }

        // Everything else is based on 1 END per 10 active points except for strength which is 1 per 5 when using optional heroic rules.
        const endUnitSize =
            this.system.XMLID === "__STRENGTHDAMAGE" && game.settings.get(HEROSYS.module, "StrEnd") === "five" ? 5 : 10;

        const activePoints = this.system._active?.originalActivePoints ?? this._activePoints;

        // NOTE: When we push we are altering the actual active points, via LEVELS and modifiers, so we have to back it out.
        const unpushedActivePoints =
            activePoints - (this.system._active?.pushedRealPoints || 0) * (1 + this._limitationCost);
        const endCost = RoundFavorPlayerDown(unpushedActivePoints / endUnitSize);

        return Math.max(1, endCost);
    }

    getItemDescription() {
        // Description (eventual goal is to largely match Hero Designer)
        const system = this.system;
        const is5e = !!this.actor?.system.is5e;

        // Reset the description and build it up again.
        let description = "";

        const configPowerInfo = this.baseInfo;
        const powerXmlId = system.XMLID;

        switch (powerXmlId) {
            case "GROWTH": {
                // Growth6e (+15 STR, +5 CON, +5 PRE, +3 PD, +3 ED, +3 BODY, +6 STUN, +1m Reach, +12m Running, -6m KB, 101-800 kg, +2 to OCV to hit, +2 to PER Rolls to perceive character, 2-4m tall, 1-2m wide) // Growth5e (+5 STR, +1 BODY, +1 STUN, -1" KB, 200 kg, +0 DCV, +0 PER Rolls to perceive character, 2 m tall, 1 m wide)
                // Growth6e is a static template.  LEVELS are ignored, instead use OPTIONID.
                const details = configPowerInfo?.details(this) || {};
                description = `${system.ALIAS} (`;
                description += `+${details.str} STR`;
                if (!this.is5e) {
                    description += `, +${details.con} CON`;
                }
                if (!this.is5e) {
                    description += `, +${details.pre} PRE`;
                }
                if (!this.is5e) {
                    description += `, +${details.pd} PD`;
                }
                if (!this.is5e) {
                    description += `, +${details.ed} ED`;
                }
                description += `, +${details.body} BODY`;
                description += `, +${details.stun} STUN`;
                description += `, +${details.reach}${this.is5e ? '"' : "m"} Reach`;
                if (!this.is5e) {
                    description += `, +${details.running}m Running`;
                }
                description += `, -${details.kb}${this.is5e ? '"' : "m"}
                KB`;
                description += `, ${details.mass}`;
                description += `, -${details.dcv} DCV`;
                description += `, +${details.perception} to PER Rolls to perceive character`;
                description += `, ${details.tall}m tall`;
                description += `, ${details.wide}m wide`;
                description += `)`;
                break;
            }

            case "SHRINKING":
                // 6e Shrinking (1 m tall, 12.5 kg mass, -2 PER Rolls to perceive character, +2 DCV, takes +6m KB)
                // 5e Shrinking (1 m tall, 12.5 kg mass, -2 PER Rolls to perceive character, +2 DCV) -- Also +3" KB which is not in HD
                description = `${system.ALIAS} (`;
                description += `${(2 / Math.pow(2, parseInt(system.LEVELS)))
                    .toPrecision(3)
                    .replace(/\.?0+$/, "")} m tall`;
                description += `, ${(100 / Math.pow(8, parseInt(system.LEVELS))).toPrecision(4).replace(/\.?0+$/, "")}
                kg mass`;
                description += `, -${system.LEVELS * 2} PER Rolls to perceive character`;
                description += `, +${system.LEVELS * 2} DCV`;
                description += `, takes +${system.LEVELS * (this.is5e ? 3 : 6) + getSystemDisplayUnits(this.is5e)} KB)`;

                break;

            case "MENTALDEFENSE":
            case "POWERDEFENSE":
                description = `${system.ALIAS} ${system.LEVELS} points`;
                break;

            case "FLASHDEFENSE":
                description = `${system.OPTION_ALIAS} ${system.ALIAS} (${system.LEVELS} points)`;
                break;

            case "FOLLOWER":
                description = system.ALIAS.replace("Followers: ", "");
                break;

            case "MINDSCAN":
                {
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                    description = `${diceFormula} ${system.ALIAS}`;
                }
                break;

            case "FORCEFIELD":
            case "ARMOR":
            case "DAMAGERESISTANCE":
                {
                    description = system.ALIAS + " (";

                    let ary = [];
                    if (parseInt(system.PDLEVELS)) ary.push(system.PDLEVELS + " rPD");
                    if (parseInt(system.EDLEVELS)) ary.push(system.EDLEVELS + " rED");
                    if (parseInt(system.MDLEVELS)) ary.push(system.MDLEVELS + " rMD");
                    if (parseInt(system.POWDLEVELS)) ary.push(system.POWDLEVELS + " rPOW");

                    description += ary.join("/") + ")";
                }
                break;

            case "FORCEWALL":
                {
                    description = system.ALIAS + " ";

                    let aryFW = [];
                    if (parseInt(system.PDLEVELS)) aryFW.push(system.PDLEVELS + " rPD");
                    if (parseInt(system.EDLEVELS)) aryFW.push(system.EDLEVELS + " rED");
                    if (parseInt(system.MDLEVELS)) aryFW.push(system.MDLEVELS + " rMD");
                    if (parseInt(system.POWDLEVELS)) aryFW.push(system.POWDLEVELS + " rPOW");
                    if (parseInt(system.BODYLEVELS)) aryFW.push(system.BODYLEVELS + " BODY");

                    description += aryFW.join("/");
                    description += `(up to ${parseInt(system.LENGTHLEVELS) + 1}m long, and ${
                        parseInt(system.HEIGHTLEVELS) + 1
                    }m tall, and ${parseFloat(system.WIDTHLEVELS) + 0.5}m thick)`;
                }
                break;

            case "ABSORPTION":
                {
                    const reduceAndEnhanceTargets = this.splitAdjustmentSourceAndTarget();
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });

                    description = `${system.ALIAS} ${is5e ? `${diceFormula}` : `${system.LEVELS} BODY`} (${
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
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });

                    description = `${system.ALIAS} ${
                        reduceAndEnhanceTargets.valid
                            ? reduceAndEnhanceTargets.enhances || reduceAndEnhanceTargets.reduces
                            : "unknown"
                    } ${diceFormula}`;

                    this.name = system.NAME || `${system.ALIAS} ${system.INPUT}`;
                }
                break;

            case "TRANSFER":
                {
                    const reduceAndEnhanceTargets = this.splitAdjustmentSourceAndTarget();
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });

                    description = `${system.ALIAS} ${diceFormula} from ${
                        reduceAndEnhanceTargets.valid ? reduceAndEnhanceTargets.reduces : "unknown"
                    } to ${reduceAndEnhanceTargets.valid ? reduceAndEnhanceTargets.enhances : "unknown"}`;
                }
                break;

            case "TRANSFORM":
                {
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                    description = `${system.OPTION_ALIAS} ${system.ALIAS} ${diceFormula}`;
                }
                break;

            case "STRETCHING":
                description = `${system.ALIAS} ${system.LEVELS}${getSystemDisplayUnits(this.is5e)}`;
                break;

            case "LEAPING":
            case "RUNNING":
            case "SWIMMING":
                // Running +25m (12m/37m total)
                description = `${system.ALIAS} +${system.LEVELS}${getSystemDisplayUnits(this.is5e)}`;
                break;

            case "GLIDING":
            case "FLIGHT":
            case "TELEPORTATION":
            case "SWINGING":
                description = `${system.ALIAS} ${system.LEVELS}${getSystemDisplayUnits(this.is5e)}`;
                break;
            case "TUNNELING":
                {
                    // Tunneling 22m through 10 PD materials
                    let pd;
                    if (this.actor?.system.is5e) {
                        pd = parseInt(system.LEVELS);
                    } else {
                        const defbonus = (system.ADDER || []).find((o) => o.XMLID == "DEFBONUS");
                        pd = 1 + parseInt(defbonus?.LEVELS || 0);
                    }

                    description = `${system.ALIAS} ${system.LEVELS}${getSystemDisplayUnits(
                        this.is5e,
                    )} through ${pd} PD materials`;
                }
                break;

            case "NAKEDMODIFIER":
                // Area Of Effect (8m Radius; +1/2) for up to 53 Active Points of STR
                // Naked Advantage: Reduced Endurance (0 END; +1/2) for up to 70 Active Points (35 Active Points); Gestures (Requires both hands; -1/2), Linked to Opening of the Blind, Third Eye (Opening of the Blind, Third Eye; -1/4), Visible (Tattoos of flames encompass the biceps and shoulders.  When this power is active, these flames appear to burn, emitting firelight.  ; -1/4)
                description = `${system.ALIAS} for up to ${system.LEVELS} Active points`;
                if (system.INPUT) {
                    description += ` of ${system.INPUT}`;
                }
                break;

            case "DEFENSE_MANEUVER":
                description = system.ALIAS + " " + system.OPTION_ALIAS;
                break;

            case "LANGUAGES":
                //English:  Language (basic conversation) (1 Active Points)
                description = system.INPUT || system.ALIAS;
                if (system.OPTION_ALIAS) {
                    description += " (" + system.OPTION_ALIAS + ")";
                }
                break;

            case "ANALYZE":
            case "PROFESSIONAL_SKILL":
            case "KNOWLEDGE_SKILL":
            case "SCIENCE_SKILL":
                {
                    // KS: types of brain matter 11-, PS: Appraise 11-, or SS: tuna batteries 28-
                    const { roll } = this._getSkillRollComponents(system);
                    description = `${system.ALIAS ? system.ALIAS + ": " : ""}${system.INPUT || system.TYPE} ${roll}`;
                    this.name = system.NAME || `${this.system.ALIAS}: ${(this.system.INPUT || system.TYPE)?.trim()}`;
                }
                break;

            case "CONTACT":
                {
                    const levels = parseInt(system.LEVELS || 1);
                    description = `${system.ALIAS} ${levels === 1 ? "8-" : `${9 + levels}-`}`;
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
                description = `${system.ALIAS}: `;
                break;

            case "LUCK":
                {
                    const levels = parseInt(system.LEVELS || 1);
                    description = `${system.ALIAS} ${levels}d6`;
                }
                break;

            case "UNLUCK":
                description = `${system.ALIAS}`;
                break;

            case "REPUTATION":
                // There are 2 types of reputation - positive, a perk, and negative, a disadvantage. Both share an XMLID.
                if (this.type === "disadvantage") {
                    description = `${system.ALIAS}: `;
                } else {
                    description = `${system.ALIAS}: ${system.LEVELS ? `+${system.LEVELS}/+${system.LEVELS}d6 ` : ""}`;
                }

                break;

            case "TRANSPORT_FAMILIARITY":
                //TF:  Custom Adder, Small Motorized Ground Vehicles
                //TF:  Equines, Small Motorized Ground Vehicles
                description = `${system.ALIAS}: `;
                break;

            case "PENALTY_SKILL_LEVELS":
                description = (system.NAME || system.ALIAS) + ": +" + system.LEVELS + " " + system.OPTION_ALIAS;

                // Penalty details
                switch (system.penalty) {
                    case "range":
                        description = description.replace("a specific negative OCV modifier", "range OCV penalties");
                        break;
                }
                break;

            case "RKA":
            case "HKA":
            case "ENERGYBLAST":
            case "EGOATTACK":
            case "MINDCONTROL":
                {
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                    description = `${system.ALIAS} ${diceFormula}`;
                }
                break;

            case "HANDTOHANDATTACK":
                {
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                    description = `${system.ALIAS} +${diceFormula}${diceFormula === "1" || diceFormula === "0" ? " point" : ""}`;
                }
                break;

            case "KBRESISTANCE":
                description =
                    (system.INPUT ? system.INPUT + " " : "") +
                    (system.OPTION_ALIAS || system.ALIAS) +
                    ` -${system.LEVELS}m`;
                break;

            case "ENTANGLE":
                description = `${system.ALIAS} ${system.LEVELS}d6, ${this.baseInfo.defense(this).string}`;
                break;

            case "ELEMENTAL_CONTROL":
                // Elemental Control, 12-point powers
                description = `${system.ALIAS}, ${parseInt(system.BASECOST) * 2}-point powers`;
                break;

            // Generic maneuvers and the ones that are not in Hero Designer (freebees)
            case "BLAZINGAWAY":
            case "BLOCK":
            case "BRACE":
            case "CHOKE":
            case "CLUBWEAPON":
            case "COVER":
            case "DISARM":
            case "DIVEFORCOVER":
            case "DODGE":
            case "GRAB":
            case "GRABBY":
            case "HAYMAKER":
            case "HIPSHOT":
            case "HURRY":
            case "MOVEBY":
            case "MOVETHROUGH":
            case "MULTIPLEATTACK":
            case "OTHERATTACKS":
            case "PULLINGAPUNCH":
            case "RAPIDFIRE":
            case "ROLLWITHAPUNCH":
            case "SET":
            case "SETANDBRACE":
            case "SHOVE":
            case "SNAPSHOT":
            case "STRAFE":
            case "STRIKE":
            case "SUPPRESSIONFIRE":
            case "SWEEP":
            case "THROW":
            case "TRIP":
            case "MANEUVER":
                {
                    description = "";

                    // Offensive Strike:  1/2 Phase, -2 OCV, +1 DCV, 8d6 Strike
                    // Killing Strike:  1/2 Phase, -2 OCV, +0 DCV, HKA 1d6 +1
                    if (system.PHASE) description += ` ${system.PHASE} Phase`;
                    // const ocv = parseInt(system.ocv || system.OCV);
                    // const dcv = parseInt(system.dcv || system.DCV);
                    // if (isNaN(ocv)) {
                    //     description += `, -- OCV`;
                    // } else {
                    //     description += `, ${ocv.signedStringHero()} OCV`;
                    // }
                    // description += `, ${dcv.signedStringHero()} DCV`;
                    description += `, ${system.OCV} OCV, ${system.DCV} DCV`;

                    const maneuverEffect = getManeuverEffect(this);
                    if (maneuverEffect) {
                        let effectString = maneuverEffect;
                        let rangeString = "";
                        let dcsString = "";

                        if (this.causesDamageEffect()) {
                            const { diceParts } = calculateDicePartsForItem(this, { ignoreDeadlyBlow: true });
                            const doesDiceOfDamage =
                                diceParts.d6Count +
                                diceParts.d6Less1DieCount +
                                diceParts.halfDieCount +
                                diceParts.constant;
                            if (maneuverEffect.search(/\[STRDC\]/) > -1) {
                                // PH: FIXME: Offensive Ranged Disarm and Ranged Disarm are shown as [WEAPONDC] but are not offensive and should be caught in this.
                                //            How to determine these martial maneuvers behave like this generically?
                                // Cheat a bit. d6Count for strength is ~DC.
                                const effectiveStrength = diceParts.d6Count * 5;
                                effectString = maneuverEffect.replace("[STRDC]", `${effectiveStrength} STR`);
                            } else if (doesDiceOfDamage) {
                                // This does some damage.
                                const damageFormula = dicePartsToEffectFormula(diceParts);
                                if (damageFormula) {
                                    const nnd =
                                        maneuverEffect.indexOf("NNDDC") > -1 ||
                                        maneuverEffect.indexOf("WEAPONNNDDC") > -1;
                                    const killing =
                                        maneuverEffect.indexOf("KILLINGDC") > -1 ||
                                        maneuverEffect.indexOf("WEAPONKILLINGDC") > -1;

                                    const diceFormula = `${damageFormula}${nnd ? " NND" : ""}${killing ? (isManeuverHthCategory(this) ? " HKA" : " RKA") : ""}`;

                                    effectString = maneuverEffect
                                        .replace("[NORMALDC]", diceFormula)
                                        .replace("[KILLINGDC]", diceFormula)
                                        .replace("[FLASHDC]", diceFormula)
                                        .replace("[NNDDC]", diceFormula)
                                        .replace("[WEAPONDC]", diceFormula)
                                        .replace("[WEAPONKILLINGDC]", diceFormula)
                                        .replace("[WEAPONFLASHDC]", diceFormula)
                                        .replace("[WEAPONNNDDC]", diceFormula);
                                }
                            }

                            const maneuverDcs = parseInt(system.DC || 0) + getExtraMartialDcsOrZero(this);
                            dcsString =
                                isManeuverThatDoesReplaceableDamageType(this) && maneuverDcs
                                    ? `, ${maneuverDcs.signedStringHero()} DC`
                                    : "";

                            if (isRangedMartialManeuver(this)) {
                                const range = parseInt(system.RANGE || 0);
                                rangeString = `, Range ${range.signedStringHero()}`;
                            }
                        }

                        system._effect = effectString;

                        description += `, ${effectString}${rangeString}${dcsString}`;
                    }
                }
                break;

            case "TELEKINESIS": {
                //Psychokinesis:  Telekinesis (62 STR), Alternate Combat Value (uses OMCV against DCV; +0)
                // (93 Active Points); Limited Range (-1/4), Only In Alternate Identity (-1/4),
                // Extra Time (Delayed Phase, -1/4), Requires A Roll (14- roll; -1/4)
                description = `${system.ALIAS} (${system.LEVELS} STR)`;
                const strDetails = this.actor?.strDetails(parseInt(system.LEVELS));
                if (strDetails) {
                    description += ` Throw ${strDetails.strThrow}${getSystemDisplayUnits(this.actor.is5e)}`;
                }
                break;
            }

            case "MENTAL_COMBAT_LEVELS":
            case "COMBAT_LEVELS":
                // +1 with any single attack
                description = `${system.ALIAS}: +${system.LEVELS} ${system.OPTION_ALIAS}`;
                break;

            case "WEAPON_MASTER":
                // Weapon Master:  +1d6 (all Ranged Killing Damage weapons)
                system.ALIAS = "Weapon Master";
                description = `${system.ALIAS}: +${parseInt(system.LEVELS) * 3}DC (${system.OPTION_ALIAS})`;
                break;

            case "DEADLYBLOW":
                // Deadly Blow:  +1d6 ([very limited circumstances])
                system.ALIAS = "Deadly Blow";
                description = `${system.ALIAS}: +${parseInt(system.LEVELS) * 3}DC (${system.OPTION_ALIAS})`;
                break;

            case "RESISTANCE":
                description = `Resistance (+${parseInt(system.LEVELS)} to roll)`;
                system.ALIAS = description;
                if (this.name.match(/Resistance \(\+\d+ to roll\)/)) {
                    this.name = system.NAME || system.ALIAS;
                }
                break;

            case "COMBAT_LUCK":
                description = `Combat Luck (${3 * system.LEVELS} rPD/${3 * system.LEVELS} rED)`;
                // Check to make sure ALIAS is largely folling default format before overriding
                if (this.name.trim().length <= 1 || this.name.match(/Combat Luck \(\d+ rPD\/\d+ rED\)/)) {
                    system.ALIAS = description;
                    this.name = system.NAME || system.ALIAS;
                }
                break;

            case "LIGHTNING_REFLEXES_ALL":
                description = `${system.ALIAS}${system.OPTION_ALIAS ? `: ${system.OPTION_ALIAS}` : ``}`;
                system.name = `${system.NAME || system.ALIAS}`;
                break;

            case "DARKNESS":
            case "INVISIBILITY":
                // Invisibility to Hearing and Touch Groups  (15 Active Points); Conditional Power Only vs organic perception (-1/2)
                break;

            case "ENDURANCERESERVE":
                {
                    // Endurance Reserve  (20 END, 5 REC) (9 Active Points)
                    description = system.ALIAS || system.XMLID;

                    const ENDURANCERESERVEREC = this.findModsByXmlid("ENDURANCERESERVEREC");
                    if (ENDURANCERESERVEREC) {
                        if (parseInt(system.value) === parseInt(system.LEVELS)) {
                            description += ` (${system.LEVELS} END, ${ENDURANCERESERVEREC.LEVELS} REC)`;
                        } else {
                            description += ` (${system.value}/${system.LEVELS} END, ${ENDURANCERESERVEREC.LEVELS} REC)`;
                        }
                    }
                }
                break;

            case "SKILL_LEVELS":
                //<i>Martial Practice:</i>  +10 with single Skill or Characteristic Roll
                description = `${parseInt(system.LEVELS).signedStringHero()} ${system.OPTION_ALIAS}`;
                break;

            case "VPP":
                description = `${system.ALIAS}, ${parseInt(system.LEVELS)} base + ${parseInt(this.findModsByXmlid("CONTROLCOST")?.LEVELS || RoundFavorPlayerDown(parseInt(system.LEVELS) / 2))} control cost`;
                break;

            case "MULTIPOWER":
                // <i>Repligun:</i>  Multipower, 60-point reserve, all slots Reduced Endurance (0 END; +1/2) (90 Active Points); all slots OAF Durable Expendable (Difficult to obtain new Focus; Ray gun; -1 1/4)
                description = `${system.ALIAS}, ${parseInt(system.BASECOST)}-point reserve`;
                break;

            case "FLASH":
                {
                    //Sight and Hearing Groups Flash 5 1/2d6
                    //Sight, Hearing and Mental Groups, Normal Smell, Danger Sense and Combat Sense Flash 5 1/2d6
                    // Groups
                    const _groups = [system.OPTION_ALIAS];
                    for (const addr of (system.ADDER || []).filter((o) => o.XMLID.indexOf("GROUP") > -1)) {
                        _groups.push(addr.ALIAS);
                    }
                    if (_groups.length === 1) {
                        description = _groups[0];
                    } else {
                        description = _groups
                            .slice(0, -1)
                            .join(", ")
                            .replace(/ Group/g, "");
                        description += " and " + _groups.slice(-1) + "s";
                    }

                    // singles
                    const _singles = [];
                    for (const addr of (system.ADDER || []).filter(
                        (o) =>
                            o.XMLID.indexOf("GROUP") === -1 &&
                            o.XMLID.match(/(NORMAL|SENSE|MINDSCAN|HRRP|RADAR|RADIO|MIND|AWARENESS)/),
                    )) {
                        _singles.push(addr.ALIAS);
                    }
                    if (_singles.length === 1) {
                        description += ", " + _singles[0];
                    } else if (_singles.length > 1) {
                        description += ", " + _singles.slice(0, -1).join(", ");
                        description += " and " + _singles.slice(-1);
                    }

                    const damageFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                    description += ` ${system.ALIAS} ${damageFormula}`;
                }
                break;

            case "EXTRADIMENSIONALMOVEMENT":
                description = `${system.ALIAS} ${system.OPTION_ALIAS}`;
                break;

            case "PERCEPTION":
                // Skill added by system and not in HDC
                description = "Perception";
                break;

            case "CLINGING":
                {
                    if (!this.actor) {
                        description = `${system.ALIAS}`;
                    } else {
                        const baseStr = this.actor.system.characteristics.str.value;
                        const additionalClingingStr = system.LEVELS;
                        const totalStr = baseStr + additionalClingingStr;
                        description = `${system.ALIAS} (${baseStr} + ${additionalClingingStr} = ${totalStr} STR)`;
                    }
                }
                break;

            case "Advanced Tech":
            case "AMBIDEXTERITY":
            case "COMBATSPELLCASTING":
            case "MONEY":
            case "SHAPECHANGING":
            case "SKILLMASTER":
                description = `${system.ALIAS} (${system.OPTION_ALIAS})`;
                break;

            case "ENVIRONMENTAL_MOVEMENT":
                description = `${system.ALIAS} (${system.INPUT})`;
                break;

            case "DUPLICATION":
                {
                    const points = parseInt(system.POINTS);
                    description = `${system.ALIAS} (creates ${points}-point form)`;
                }
                break;

            case "SHAPESHIFT":
                description = `${system.ALIAS} (${system.OPTION_ALIAS})`;
                break;

            case "FINDWEAKNESS":
                {
                    const { roll } = this._getNonCharacteristicsBasedRollComponents(system);

                    description = `${system.ALIAS} ${roll} with ${system.OPTION_ALIAS}`;
                }
                break;

            case "DANGER_SENSE":
                {
                    const { roll } = this._getNonCharacteristicsBasedRollComponents(system);

                    description = `${system.ALIAS} ${roll}`;
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
                description = `${system.ALIAS} (${system.GROUP})`;
                break;

            case "DETECT":
                description = `${system.ALIAS} ${system.OPTION_ALIAS} (${system.GROUP})`;
                break;

            case "ENHANCEDPERCEPTION":
                {
                    const levels = parseInt(system.LEVELS || 0);
                    description = `${system.ALIAS} +${levels} PER with ${system.OPTION_ALIAS}`;
                }
                break;

            case "TELESCOPIC":
                {
                    const levels = parseInt(system.LEVELS || 0);
                    description = `${system.ALIAS} +${levels} range modifier for ${system.OPTION_ALIAS}`;
                }
                break;

            case "CONCEALED":
                {
                    const levels = parseInt(system.LEVELS || 0);
                    description = `${system.ALIAS} (-${levels} PER to ${system.OPTION_ALIAS})`;
                }
                break;

            case "RAPID":
                {
                    const factor = Math.pow(10, parseInt(system.LEVELS || 1));
                    description = `${system.ALIAS} (x${factor}) with ${system.OPTION_ALIAS})`;
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
                description = `${system.ALIAS} with ${system.OPTION_ALIAS}`;
                break;

            case "MENTALAWARENESS":
            case "NIGHTVISION":
                description = `${system.ALIAS}`;
                break;

            case "STRIKING_APPEARANCE": {
                const levels = parseInt(system.LEVELS);
                description = `+${levels}/+${levels}d6 ${system.ALIAS} (${system.OPTION_ALIAS})`;
                break;
            }

            case "CHANGEENVIRONMENT":
                description = `${system.ALIAS}`;
                break;

            case "POSSESSION":
                {
                    description = `${system.ALIAS}`;
                }

                break;

            default:
                {
                    if (this.baseInfo?.descriptionFactory) {
                        description = this.baseInfo.descriptionFactory(this);
                        break;
                    }

                    if (configPowerInfo?.type?.includes("characteristic")) {
                        description = "+" + system.LEVELS + " " + system.ALIAS;
                        break;
                    }

                    if (configPowerInfo?.type?.includes("skill")) {
                        const { roll } = this._getSkillRollComponents(system);
                        description = system.ALIAS || system.XMLID;
                        this.name = system.NAME || system.ALIAS;
                        if (system?.INPUT) {
                            description += `: ${system.INPUT}`;
                            this.name += `: ${system.INPUT}`;
                        }
                        // Skill enhancer?
                        if (roll) {
                            description += ` ${roll}`;
                        }
                        break;
                    }

                    // Provide a basic description
                    const _desc = system.OPTION_ALIAS || system.ALIAS || system.EFFECT || "";
                    description = (system.INPUT ? system.INPUT + " " : "") + _desc;

                    // Provide dice if this is an attack
                    if (this.baseInfo?.behaviors.includes("dice")) {
                        const damageFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                        if (damageFormula !== "0") {
                            if (description.indexOf(damageFormula) === -1) {
                                description = ` ${damageFormula} ${system.class || ""}`;
                            }
                        }
                    }

                    // Add a success roll, if it has one, but only for skills, talents, or perks
                    if (configPowerInfo?.behaviors?.includes("success")) {
                        // PH: FIXME: Why is this not based purely on behavior?
                        if (!this.system.CHARACTERISTIC) {
                            console.error(
                                `${this.actor?.name}: ${this.detailedName()} has a success behavior but no CHARACTERISTIC specified`,
                            );
                        }
                        description += ` ${system.roll}`;
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
        if (system.INPUT) {
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

                case "VULNERABILITY":
                    // Vulnerability:  Mental (Common)
                    description += `${system.INPUT}`;
                    break;

                default:
                    if (configPowerInfo?.type?.includes("skill")) {
                        break;
                    }

                    _adderArray.push(system.INPUT);
                    break;
            }
        }

        for (const adder of this.adders) {
            switch (adder.XMLID) {
                case "HEALEDBY":
                    {
                        _adderArray.push(`${adder.ALIAS} ${adder.OPTION_ALIAS || "unknown"}`);
                    }
                    break;

                case "DIMENSIONS":
                    description += `, ${adder.ALIAS}`;
                    break;

                case "ATTACK":
                case "EATING":
                case "EXTENDEDBREATHING":
                case "IMMUNITY":
                case "LONGEVITY":
                case "RECOGNIZED":
                case "SLEEPING":
                case "USEFUL":
                    if (system.XMLID === "VULNERABILITY") {
                        description += ` (${adder.OPTION_ALIAS})`.replace("((", "("); // Unclear why there is a parand in the OPTION_ALIAS
                        break;
                    }
                    _adderArray.push(`${adder.ALIAS} ${adder.OPTION_ALIAS}`);
                    break;

                case "ADDITIONALPD":
                case "ADDITIONALED":
                case "CONTROLCOST":
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
                            _adderArray.push("-" + parseInt(adder.LEVELS) + " DCs " + adder.ALIAS.replace(" DCs", ""));
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
                    description += `, Can Add Maximum Of ${determineMaxAdjustment(this)} Points`;
                    break;

                case "ADDER":
                    // This is likely a CSL adder that we use to specificy which attacks the CSL applies to.
                    // If the CLS applies to ALL attacks, don't bother to list them all.
                    if (this.system.XMLID === "COMBAT_LEVELS" && this.system.OPTIONID === "ALL") break;
                    if (this.system.XMLID === "MENTAL_COMBAT_LEVELS" && this.system.OPTIONID === "ALL") break;
                    if (this.system.XMLID === "PENALTY_SKILL_LEVELS" && this.system.OPTIONID === "ALL") break;

                    // Otherwise add it to the list of ADDERS as normal. Most likely this is a custom adder and since they
                    // can be for anything, we don't provide its cost if the cost is 0.
                    if (adder.ALIAS.trim()) {
                        _adderArray.push(
                            `${adder.ALIAS}${parseInt(adder.BASECOST) !== 0 ? ` ${parseInt(adder.BASECOST)?.signedStringHero()} Points` : ""}`,
                        );
                    }
                    break;

                case "MINDCONTROLEFFECT":
                    {
                        const mindControlEffect = 40 + (parseInt(adder.LEVELS) || 0);
                        _adderArray.push(`Mind Control Effect ${mindControlEffect} points`);
                    }
                    break;

                case "TELEPATHYEFFECT":
                    {
                        const telepathyEffect = 30 + (parseInt(adder.LEVELS) || 0);
                        _adderArray.push(`Telepathy Effect ${telepathyEffect} points`);
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
                    description += _adderArray.sort().join(", ");
                    break;

                case "DARKNESS":
                case "INVISIBILITY":
                    {
                        description += system.ALIAS + " to ";
                        // Groups
                        let _groups = _adderArray.filter((o) => o.indexOf("Group") > -1);
                        if (_groups.length === 1) {
                            description += _groups[0];
                        } else {
                            description += _groups
                                .slice(0, -1)
                                .join(", ")
                                .replace(/ Group/g, "");
                            description += " and " + _groups.slice(-1) + "s";
                        }

                        // singles
                        let _singles = _adderArray.filter((o) => o.indexOf("Group") === -1);
                        // spacing
                        if (_groups.length > 0 && _singles.length > 0) {
                            description += ", ";
                        }

                        if (_singles.length === 1) {
                            description += _singles[0];
                        } else if (_singles.length > 1) {
                            description += _singles.slice(0, -1).join(", ");
                            description += " and " + _singles.slice(-1);
                        }
                    }

                    // DARKNESS radius
                    // Darkness to Hearing Group 16m radius
                    if (powerXmlId === "DARKNESS") {
                        description += ` ${system.LEVELS}${getSystemDisplayUnits(this.is5e)} radius`;
                    }

                    break;

                case "FLASH":
                    // The senses are already in the description
                    description +=
                        " (" +
                        _adderArray
                            .filter((o) => !o.match(/(GROUP|NORMAL|SENSE|MINDSCAN|HRRP|RADAR|RADIO|MIND|AWARENESS)/i))
                            .join("; ") +
                        ")";
                    description = description.replace("()", "");
                    break;

                default:
                    description += " (" + _adderArray.join("; ") + ")";
                    break;
            }
        }

        // Standard Effect
        if (system.USESTANDARDEFFECT) {
            let stun = parseInt(system.LEVELS * 3);
            let body = parseInt(system.LEVELS);

            if (
                this.findModsByXmlid("PLUSONEHALFDIE") ||
                this.findModsByXmlid("MINUSONEPIP") ||
                this.findModsByXmlid("PLUSONEPIP")
            ) {
                stun += 1;
                body += 1;
            }

            if (configPowerInfo?.type.includes("adjustment")) {
                description += " (standard effect: " + parseInt(system.LEVELS * 3) + " points)";
            } else {
                description += ` (standard effect: ${stun} STUN, ${body} BODY)`;
            }
        }

        // Advantages sorted low to high
        for (let modifier of this.advantages
            .sort((a, b) => {
                return a.BASECOST_total - b.BASECOST_total;
            })
            .sort((a, b) => {
                return a.cost - b.cost;
            })) {
            description += this.createPowerDescriptionModifier(modifier);
        }

        // Active Points show if there are limitations or the real cost is not equal to the displayed cost
        if (this._activePoints !== this._realCost || this.realCost !== this.characterPointCost) {
            if (this.activePoints) {
                description += " (" + this.activePointCostForDisplay + " Active Points);";
            }
        }

        // MULTIPOWER slots typically include limitations
        const modifiers = this.limitations
            .sort((a, b) => {
                return a.BASECOST_total - b.BASECOST_total;
            })
            .sort((a, b) => {
                return a.cost - b.cost;
            });

        // Disadvantages sorted low to high
        for (const modifier of modifiers) {
            description += this.createPowerDescriptionModifier(modifier);
        }

        description = (description || "")
            .replace(";,", ";")
            .replace("; ,", ";")
            .replace("; ;", ";")
            .replace(/;$/, "") // Remove ";" at the end of the description string
            .trim();

        // Endurance
        //this.calcEndurance();

        // STR only costs endurance when used.
        // Can get a bit messy, like when resisting an entangle, but will deal with that later.
        // if (system.XMLID === "STR") {
        //     system.end = 0;
        // }

        // MOVEMENT only costs endurance when used.  Typically per round.
        // if (configPowerInfo && configPowerInfo.type?.includes("movement")) {
        //     system.end = 0;
        // }

        // Some names should include modifiers
        // if (this.type.includes("disadvantage")) {
        //     this.name = description;
        // }

        return description;
    }

    createPowerDescriptionModifier(modifier) {
        const item = this;
        const modifierInfo = modifier.baseInfo;
        const system = item.system;
        let result = "";

        switch (modifier.XMLID) {
            case "CHARGES":
                {
                    // 1 Recoverable Continuing Charge lasting 1 Minute
                    result += ", ";

                    const maxCharges = parseInt(modifier.OPTION_ALIAS);
                    // if (maxCharges !== parseInt(system.LEVELS)) {
                    //     console.warn(
                    //         `CHARGES mismatch ${item.actor?.name}:${item.name} is it ${maxCharges} or ${parseInt(system.charges?.max)}. Check parent ${item.parentItem?.name}.`,
                    //         item,
                    //     );
                    // }
                    const currentCharges = parseInt(this.system.charges?.value);
                    if (currentCharges != maxCharges) {
                        result += `${currentCharges}/`;
                    }
                    result += modifier.OPTION_ALIAS;

                    const recoverable = (modifier.ADDER || []).find((o) => o.XMLID === "RECOVERABLE");
                    if (recoverable) {
                        result += ` ${recoverable.ALIAS}`;
                    }

                    const boostable = (modifier.ADDER || []).find((o) => o.XMLID === "BOOSTABLE");
                    if (boostable) {
                        result += ` ${boostable.ALIAS}`;
                    }

                    const continuing = (modifier.ADDER || []).find((o) => o.XMLID === "CONTINUING");
                    if (continuing) {
                        result += ` ${continuing.ALIAS}`;
                    }

                    const fuel = (modifier.ADDER || []).find((o) => o.XMLID === "FUEL");
                    if (fuel) {
                        result += ` ${fuel.ALIAS}`;
                    }

                    result += maxCharges > 1 ? " Charges" : " Charge";

                    const totalClips = this.system.charges?.clipsMax;
                    if (totalClips > 1) {
                        const currentClips = this.system.charges?.clips;
                        result += ` (${currentClips}/${totalClips} clips)`;
                    }

                    if (continuing) {
                        result += " lasting " + continuing.OPTION_ALIAS;
                    }
                }

                break;

            case "FOCUS":
                result += `, ${modifier.OPTION === modifier.OPTION_ALIAS ? `${modifier.OPTION}` : `${modifier.OPTION}/${modifier.OPTION_ALIAS || modifier.OPTIONID}`}`;
                break;

            case "ABLATIVE":
                result += `, ${modifier.ALIAS} ${modifier.OPTION_ALIAS}`;
                break;

            default:
                if (modifierInfo?.descriptionFactory) {
                    result += `, ${modifierInfo.descriptionFactory(modifier)}`;
                } else {
                    if (modifier.ALIAS) result += ", " + modifier.ALIAS || "?";
                }
                break;
        }

        if (!["CONDITIONALPOWER"].includes(modifier.XMLID) && modifier.XMLID !== "FOCUS") {
            result += " (";
        } else {
            result += " ";
        }

        // Multiple levels?
        if ((parseInt(modifier.LEVELS) || 0) > 1) {
            if (["HARDENED", "PENETRATING", "ARMORPIERCING", "NOTELEPORT"].includes(modifier.XMLID)) {
                result += "x" + parseInt(modifier.LEVELS) + "; ";
            }
        }

        if (modifier.XMLID === "AOE") {
            const areaOfEffect = item.aoeAttackParameters();
            if (areaOfEffect.value > 0) {
                result += `${areaOfEffect.value}${
                    modifier.OPTION_ALIAS === "Any Area" && !item.actor?.system?.is5e
                        ? ""
                        : getSystemDisplayUnits(item.is5e)
                } `;
            }
        }

        if (modifier.XMLID === "CUMULATIVE" && parseInt(modifier.LEVELS) > 0) {
            result += parseInt(system.LEVELS) * 6 * (parseInt(modifier.LEVELS) + 1) + " points; ";
        }

        if (modifier.OPTION_ALIAS && !["VISIBLE", "CHARGES", "AVAD", "ABLATIVE"].includes(modifier.XMLID)) {
            switch (modifier.XMLID) {
                case "AOE":
                    if (modifier.OPTION_ALIAS === "One Hex" && item.aoeAttackParameters().value > 1) {
                        result += "Radius; ";
                    } else if (modifier.OPTION_ALIAS === "Any Area" && !item.actor?.system?.is5e) {
                        result += "2m Areas; ";
                    } else if (modifier.OPTION_ALIAS === "Line") {
                        const width = item.aoeAttackParameters().width;
                        const height = item.aoeAttackParameters().height;

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
                        result += `${shape}; -1 DC/${item.aoeAttackParameters().dcFalloff}"; `;
                    }
                    break;
                case "EXTRATIME":
                    result += `${modifier.OPTION_ALIAS}, `;
                    break;
                case "FOCUS":
                    break;
                case "TRIGGER":
                    // All the important stuff is in the TRIGGER adders
                    break;
                case "DOUBLEKB":
                    // ALIAS already has what we need
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

        if (modifier.COMMENTS && modifier.XMLID !== "FOCUS") {
            result += modifier.COMMENTS + "; ";
        }

        switch (modifier.XMLID) {
            case "AOE":
                for (const adder of modifier.adders) {
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
                break;
            default: {
                const addersDescription = modifier.addersDescription;
                if (addersDescription) {
                    result += `${modifier.addersDescription}; `;
                }
            }
        }

        // EXTRATIME has a MODIFIER
        for (const mod2 of modifier.modifiers) {
            result += `${mod2.ALIAS}, `;
        }

        if (modifier.XMLID === "FOCUS") {
            // Sometimes the focus description is in the ALIAS, sometimes it is in the COMMENTS
            result += `(${modifier.ALIAS.replace("Focus", "")} ${modifier.COMMENTS || ""}; `
                .replace(/ {2}/g, " ")
                .replace("( ", "(")
                .replace("(; ", "(");
        }

        if (modifierInfo?.descriptionModifier) {
            result += modifierInfo.descriptionModifier(modifier, item);
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
                // -.375 for example
                console.warn(`Unexpected fraction`, Math.abs(BASECOST_total % 1), this);
                fraction += Math.abs(BASECOST_total % 1);
                break;
        }

        result += fraction.trim();

        //FORCEALLOW="Yes"
        if (modifier.FORCEALLOW) {
            result += "*";
        }

        result += ")";

        // Highly summarized
        if (["FOCUS"].includes(modifier.XMLID)) {
            // 'Focus (OAF; Pen-sized Device in pocket; -1)'
            result = result.replace(`Focus (${modifier.OPTION}; `, `${modifier.OPTION} (`);
        }

        const configPowerInfo = this.baseInfo;

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

    /**
     * Add the bits that are responsible for hitting
     */
    makeToHit() {
        const xmlid = this.system.XMLID;

        // Name
        const description = this.system.ALIAS;
        const name = this.system.NAME || description || this.system.name || this.name;
        this.name = name;
        if (xmlid === "TELEKINESIS") {
            this.name = name + " (TK strike)";
        }

        const input = this.system.INPUT;
        this.system.class = input === "ED" ? "energy" : "physical";

        this.system.targets = "dcv";
        this.system.uses = "ocv";

        const ocv = parseInt(this.system.OCV) || 0;
        const dcv = parseInt(this.system.DCV) || 0;
        this.system.ocv = ocv;
        this.system.dcv = dcv;

        this.system.noHitLocations = false;

        if (["maneuver", "martialart"].includes(this.type)) {
            // Flash doesn't have a hit location
            if (maneuverHasFlashTrait(this)) {
                this.system.noHitLocations = true;
            }

            // Block doesn't use a hit location
            if (maneuverHasBlockTrait(this)) {
                this.system.noHitLocations = true;
            }

            // Many maneuvers don't use hit locations.
            else if (
                this.system.XMLID === "CHOKE" ||
                this.system.XMLID === "DISARM" ||
                this.system.XMLID === "DIVEFORCOVER" ||
                this.system.XMLID === "GRAB" ||
                this.system.XMLID === "GRABBY" ||
                this.system.XMLID === "SHOVE" ||
                this.system.XMLID === "THROW" ||
                this.system.XMLID === "TRIP"
            ) {
                this.system.noHitLocations = true;
            }
        }

        this.system.areaOfEffect = { type: "none", value: 0 };

        // Specific power overrides.
        // FIXME: We should consider getting rid of this.system.class. Not sure that it adds anything interesting.
        if (xmlid === "ENTANGLE") {
            this.system.class = "entangle";
            this.system.noHitLocations = true;
        } else if (xmlid === "DARKNESS") {
            this.system.class = "darkness";
            this.system.noHitLocations = true;
        } else if (xmlid === "IMAGES") {
            this.system.class = "images";
            this.system.noHitLocations = true;
        } else if (
            xmlid === "ABSORPTION" ||
            xmlid === "AID" ||
            xmlid === "SUCCOR" ||
            xmlid === "DISPEL" ||
            xmlid === "DRAIN" ||
            xmlid === "HEALING" ||
            xmlid === "SUPPRESS" ||
            xmlid === "TRANSFER"
        ) {
            this.system.class = "adjustment";
            this.system.noHitLocations = true;
        } else if (
            xmlid === "EGOATTACK" ||
            xmlid === "MINDCONTROL" ||
            xmlid === "MENTALILLUSIONS" ||
            xmlid === "MINDSCAN" ||
            xmlid === "TELEPATHY"
        ) {
            this.system.class = "mental";
            this.system.targets = "dmcv";
            this.system.uses = "omcv";
            this.system.noHitLocations = true;
        } else if (xmlid === "CHANGEENVIRONMENT") {
            this.system.class = "change enviro";
            this.system.noHitLocations = true;
        } else if (xmlid === "FLASH") {
            this.system.class = "flash";
            this.system.noHitLocations = true;
        } else if (xmlid === "TRANSFORM") {
            this.system.class = "transform";
            this.system.noHitLocations = true;
        } else if (xmlid === "SUSCEPTIBILITY") {
            this.system.class = this.is5e ? "disadvantage" : "complication";
        } else if (xmlid === "LUCK" || xmlid === "UNLUCK") {
            this.system.class = "luck";
        } else if (xmlid === "FORCEWALL") {
            this.system.class = this.is5e ? "forcewall" : "barrier";
        }

        // AVAD
        const avad = this.findModsByXmlid("AVAD");
        if (avad) {
            this.system.class = "avad";
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
    }

    getMakeAttack() {
        // AARON: Do we really need makeAttack?
        // Many of these properties can converted into get properties on the item and calculated on the fly.

        const xmlid = this.system.XMLID;

        const results = {
            killing: false,
            knockbackMultiplier: 1,
            usesStrength: true,
            piercing: 0,
            penetrating: 0,
            stunBodyDamage: CONFIG.HERO.stunBodyDamages.stunbody,
        };

        // Maneuvers and martial arts may allow strength to be added or have extra effects.
        // PH: FIXME: Weapons?
        if (["maneuver", "martialart"].includes(this.type)) {
            if (this.system.ADDSTR != undefined) {
                results.usesStrength = this.system.ADDSTR;
            } else if (
                this.system.EFFECT &&
                (this.system.EFFECT.search(/\[FLASHDC\]/) > -1 || this.system.EFFECT.search(/\[NNDDC\]/) > -1)
            ) {
                results.usesStrength = false;
            }

            if (this.system.EFFECT && this.system.EFFECT.search(/\[FLASHDC\]/) > -1) {
                results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
            } else if (this.system.EFFECT && this.system.EFFECT.search(/\[NNDDC\]/) > -1) {
                results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.stunonly;
            }
        }

        // Specific power overrides
        if (xmlid === "ENTANGLE") {
            results.knockbackMultiplier = 0;
            results.usesStrength = false;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "DARKNESS") {
            results.knockbackMultiplier = 0;
            results.usesStrength = false;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "IMAGES") {
            results.knockbackMultiplier = 0;
            results.usesStrength = false;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "ABSORPTION") {
            results.usesStrength = false;
        } else if (xmlid === "AID" || xmlid === "SUCCOR") {
            results.usesStrength = false;
        } else if (xmlid === "DISPEL") {
            results.usesStrength = false;
        } else if (xmlid === "DRAIN") {
            results.usesStrength = false;
        } else if (xmlid === "HEALING") {
            results.usesStrength = false;
        } else if (xmlid === "SUPPRESS") {
            results.usesStrength = false;
        } else if (xmlid === "TRANSFER") {
            results.usesStrength = false;
        } else if (xmlid === "EGOATTACK") {
            results.knockbackMultiplier = 0;
            results.usesStrength = false;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.stunonly;
        } else if (
            xmlid === "MINDCONTROL" ||
            xmlid === "MENTALILLUSIONS" ||
            xmlid === "MINDSCAN" ||
            xmlid === "TELEPATHY" ||
            xmlid === "POSSESSION"
        ) {
            results.knockbackMultiplier = 0;
            results.usesStrength = false;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "CHANGEENVIRONMENT") {
            results.knockbackMultiplier = 0;
            results.usesStrength = false;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "FLASH") {
            results.knockbackMultiplier = 0;
            results.usesStrength = false;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "ENERGYBLAST") {
            results.usesStrength = false;
        } else if (xmlid === "RKA") {
            results.killing = true;
            results.usesStrength = false;
        } else if (xmlid === "TRANSFORM") {
            results.knockbackMultiplier = 0;
            results.usesStrength = false;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "__STRENGTHDAMAGE") {
            // This is strength damage so it doesn't double up and add itself.
            results.usesStrength = false;
        } else if (xmlid === "LUCK" || xmlid === "UNLUCK") {
            results.usesStrength = false;
        }

        // AVAD
        const avad = this.findModsByXmlid("AVAD");
        if (avad) {
            results.class = "avad";
        }

        // Armor Piercing
        const armorPiercing = this.findModsByXmlid("ARMORPIERCING");
        if (armorPiercing) {
            results.piercing = parseInt(armorPiercing.LEVELS);
        }

        // Penetrating
        const penetrating = this.findModsByXmlid("PENETRATING");
        if (penetrating) {
            results.penetrating = parseInt(penetrating.LEVELS);
        }

        // No Knockback
        const noKb = this.findModsByXmlid("NOKB");
        if (noKb) {
            results.knockbackMultiplier = 0;
        }

        // Double Knockback
        const doubleKb = this.findModsByXmlid("DOUBLEKB");
        if (doubleKb) {
            const cost = doubleKb.cost;

            if (this.actor.system.is5e) {
                // There are 2 types of knockback multipliers with the same XMLID for 5e.
                if (cost === 0.5) {
                    results.knockbackMultiplier = 1.5;
                } else {
                    results.knockbackMultiplier = 2;
                }
            } else {
                // 6e allows it to be purchased in several multiples although HD doesn't support it in a single
                // modifier. The code is here just in case things change.
                const multiplier = 4 * cost;
                results.knockbackMultiplier = multiplier;
            }
        }

        if (xmlid === "HKA" || this.system.EFFECT?.indexOf("KILLING") > -1) {
            results.killing = true;
        } else if (xmlid === "TELEKINESIS") {
            results.usesStrength = false;
            results.usesTk = true;
        }

        // Damage effect/type modifiers
        const noStrBonus = this.findModsByXmlid("NOSTRBONUS");
        if (noStrBonus) {
            results.usesStrength = false;
        }

        const stunOnly = this.findModsByXmlid("STUNONLY");
        if (stunOnly) {
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.stunonly;
        }

        const doesBody = this.findModsByXmlid("DOESBODY");
        if (doesBody) {
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.stunbody;
        }
        return results;
    }

    updateRoll() {
        console.error("Depricated updateRoll");
        return;
        // const skillData = this.system;

        // skillData.tags = [];

        // if (!this.hasSuccessRoll()) {
        //     skillData.roll = null;
        //     return;
        // }

        // // TODO: Can this be simplified. Should we add some test cases?
        // // TODO: Luck and unluck...

        // // No Characteristic = no roll (Skill Enhancers for example) except for FINDWEAKNESS
        // const characteristicBased = skillData.CHARACTERISTIC;
        // const { roll, tags } = !characteristicBased
        //     ? this._getNonCharacteristicsBasedRollComponents(skillData)
        //     : this._getSkillRollComponents(skillData);

        // skillData.roll = roll;
        // skillData.tags = tags;
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
            const CHANCETOCHANGE = skillData.ADDER.find((adder) => adder.XMLID === "CHANCETOCHANGE");
            const changeChance = CHANCETOCHANGE?.OPTIONID;
            let rollValue = -8;

            switch (changeChance) {
                case "INFREQUENT":
                    rollValue = 8;
                    break;
                case "FREQUENT":
                    rollValue = 11;
                    break;
                case "VERYFREQUENT":
                    rollValue = 14;
                    break;
                case "ALWAYS":
                    rollValue = 99;
                    break;
                default:
                    if (parseInt(CHANCETOCHANGE?.BASECOST || 0) === 15) {
                        console.warn(
                            `Unknown CHANCETOCHANGE of ${changeChance}. It cost 15 pts, so assumsing VeryFewquently 14-.`,
                        );
                        rollValue = 14;
                        break;
                    }
                    console.error(`ACCIDENTALCHANGE doesn't have a CHANCETOCHANGE adder. Defaulting to 8-`);
            }

            tags.push({
                value: rollValue,
                name: "Change Chance",
            });

            roll = `${rollValue}-`;
        } else if (skillData.XMLID === "DEPENDENTNPC" || skillData.XMLID === "HUNTED") {
            const appearance = skillData.ADDER.find((adder) => adder.XMLID === "APPEARANCE");
            const appearanceChance = appearance?.OPTIONID || appearance.OPTION;
            let chance;

            if (appearanceChance === "EIGHT" || appearanceChance === "8ORLESS" || appearanceChance.startsWith("8-")) {
                chance = 8;
            } else if (
                appearanceChance === "ELEVEN" ||
                appearanceChance === "11ORLESS" ||
                appearanceChance.startsWith("11-")
            ) {
                chance = 11;
            } else if (
                appearanceChance === "FOURTEEN" ||
                appearanceChance === "14ORLESS" ||
                appearanceChance.startsWith("14-")
            ) {
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
            } else {
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
            const egoRoll = this.actor.system.characteristics.ego?.roll || 0;
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

            if (occurChance === "OCCASIONALLY" || occurChance.includes("8-")) {
                rollValue = 8;
            } else if (occurChance === "FREQUENTLY" || occurChance.includes("11-")) {
                rollValue = 11;
            } else if (occurChance === "VERYFREQUENTLY" || occurChance.includes("14-")) {
                rollValue = 14;
            } else {
                console.error(`unknown occurChance ${occurChance} for SOCIALLIMITATION`);
                rollValue = 14;
            }

            const intensity = skillData.ADDER.find((adder) => adder.XMLID === "EFFECTS")?.OPTIONID;
            let intensityValue = 0;

            switch (intensity) {
                case "MINOR":
                    intensityValue = 0;
                    break;
                case "MAJOR":
                    intensityValue = 5;
                    break;
                case "SEVERE":
                    intensityValue = 10;
                    break;
                default:
                    console.error(`unknown intensity ${intensity} for SOCIALLIMITATION`);
            }

            tags.push({
                value: rollValue,
                name: `${occurChance} occurence`,
            });

            tags.push({
                value: intensityValue,
                name: `${intensity} intensity`,
            });

            roll = `${rollValue + intensityValue}-`;
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
            // if (skillData.LEVELS) {
            //     console.warn(`unknown levels ${skillData.LEVELS} LEVEL for DANGER_SENSE`);
            // }

            const perceptionItem = (this.actor?.items || []).find((power) => power.system.XMLID === "PERCEPTION");
            const perceptionRoll = parseInt(perceptionItem?.system.roll || 11);

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
                    ? this.actor?.system.characteristics?.[characteristic]?.value || 0
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

            if (this.actor && skillData.XMLID === "PERCEPTION") {
                for (const enhancedPerception of this.actor.items.filter(
                    (o) => o.system.XMLID === "ENHANCEDPERCEPTION",
                )) {
                    enhancedPerception.system.checked = true;
                    if (enhancedPerception.system.active) {
                        const levels = parseInt(enhancedPerception.system.LEVELS);
                        tags.push({
                            value: levels,
                            name: enhancedPerception.name,
                            itemId: enhancedPerception.id,
                            title: `${enhancedPerception.system.OPTIONID} ${enhancedPerception.adders.map((a) => a.XMLID).join(" ")}`,
                        });
                        rollVal += levels;
                    }
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
            //this.system.XMLID === "AID" || //You can AID another person that has a power you don't have
            this.system.XMLID === "ABSORPTION" ||
            this.system.XMLID === "SUCCOR" ||
            (this.system.XMLID === "TRANSFER" && mustBeStrict)
                ? adjustmentSourcesStrict
                : adjustmentSourcesPermissive;
        let validList = Object.keys(validator(this.actor));

        // Simple Healing
        if (this.system.XMLID === "HEALING") {
            validList.push("SIMPLIFIED");
        }

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
        newEffect.duration.duration ??= newEffect.duration.seconds;
        newEffect.duration.startTime ??= game.time.worldTime;
        newEffect.duration.startRound ??= game.combat.current.round;
        newEffect.duration.startTurn ??= game.combat.current.turn;
        newEffect.duration.type ??= "seconds";
        //newEffect.transfer = false;

        //const ae = await this.createEmbeddedDocuments("ActiveEffect", [newEffect]);
        //ae.duration = ae.updateDuration();

        //return ae.update({ duration: ae.duration });

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

        // Kludge: DARKNESS inherently should behave like an AOE
        if (this.system.XMLID === "DARKNESS" && !aoe) {
            const _darknessAoe = {
                XMLID: "AOE",
                LEVELS: this.system.LEVELS,
                OPTION: "RADIUS",
                OPTIONID: "RADIUS",
                OPTION_ALIAS: "Radius",
            };
            return _darknessAoe;
        }

        return aoe || explosion5e;
    }

    getDefense(targetActor, attackItem) {
        return getItemDefenseVsAttack(this, attackItem);
    }

    get attackDefenseVs() {
        // What are we effectively using for attack?
        const baseAttackItem = this.baseInfo.baseEffectDicePartsBundle(this, {}).baseAttackItem;

        // CONFIG overrides for specific XMLIDs
        if (baseAttackItem.baseInfo?.attackDefenseVs) {
            if (typeof baseAttackItem.baseInfo.attackDefenseVs === "function") {
                return baseAttackItem.baseInfo.attackDefenseVs();
            }
            return baseAttackItem.baseInfo.attackDefenseVs;
        }

        // Adjustment
        if (baseAttackItem.baseInfo?.type.includes("adjustment")) {
            return "POWERDEFENSE";
        }

        // Generic defense specification
        if (["PD", "ED", "MD"].includes(baseAttackItem.system.INPUT)) {
            return baseAttackItem.system.INPUT;
        }

        // Mental
        if (baseAttackItem.baseInfo?.type.includes("mental")) {
            return "MD";
        }

        // Flash
        if (baseAttackItem.isSenseAffecting()) {
            return "FLASHDEFENSE";
        }

        // MARTIAL KILLING
        if (baseAttackItem.system.WEAPONEFFECT?.includes("KILLINGDC")) {
            return "PD";
        }

        // MARTIAL STR
        if (baseAttackItem.system.WEAPONEFFECT?.includes("STRDC")) {
            return "PD";
        }

        // MARTIAL generic STR
        if (baseAttackItem.system.WEAPONEFFECT?.includes("STR")) {
            return "PD";
        }

        // STRIKE
        if (baseAttackItem.system.EFFECT?.includes("STR")) {
            return "PD";
        }

        if (baseAttackItem.system.XMLID === "TELEKINESIS") {
            return "PD";
        }

        // MARTIAL FLASH
        if (baseAttackItem.system.WEAPONEFFECT?.includes("FLASHDC")) {
            return "FLASHDEFENSE";
        }

        if (baseAttackItem.system.XMLID === "KNOCKBACK") {
            return "KB";
        }

        if (baseAttackItem.system.XMLID === "HANDTOHANDATTACK") {
            return "PD";
        }

        console.warn(`Unable to determine defense for ${this.name}`);
        return "PD"; // Default
    }

    get isContainer() {
        if (this.isSeparator) return false;
        if (this.childItems.length) return true;

        // A backpack from MiscEquipment.hdp is a CUSTOMPOWER
        if (this.system.description.match(/can hold \d+kg/i)) return true;

        return this.baseInfo?.isContainer;
    }

    get isSeparator() {
        // It appears that some seperators can have childItems.  Not sure why this is the case.
        return this.system.XMLID === "LIST" && this.system.ALIAS.trim() === "";
    }

    get isRangedSense() {
        return (
            this.baseInfo?.type.includes("sense") &&
            (this.findModsByXmlid("RANGE") || this.baseInfo?.behaviors.includes("rangeBuiltIn"))
        );
    }

    get isSense() {
        // SightGroup/ToughGroup/HearingGroup/RadioGroup/SmellGroup have SENSE builtIn
        return (
            this.baseInfo?.type.includes("sense") &&
            (["SIGHTGROUP", "TOUCHGROUP", "HEARINGGROUP", "RADIOGROUP", "SMELLGROUP"].includes(this.system.GROUP) ||
                this.findModsByXmlid("SENSE") ||
                this.baseInfo?.behaviors.includes("targetingBuiltIn"))
        );
    }

    get isTargeting() {
        // SightGroup has TARGETING builtIn
        return (
            this.baseInfo?.type.includes("sense") &&
            (["TARGETINGSENSE"].includes(this.system.GROUP) ||
                this.findModsByXmlid("TARGETINGSENSE") ||
                this.baseInfo?.behaviors.includes("senseBuiltIn"))
        );
    }

    get doesKillingDamage() {
        if (this.system.XMLID && this.baseInfo) {
            // PH: FIXME: THis is what we ultamitely want
            // return this.baseInfo.doesKillingDamage(this);

            // Preferred Methods to determine KILLING
            if (this.system.XMLID.startsWith("__")) {
                return false;
            } else if (this.baseInfo.doesKillingDamage != undefined) {
                return this.baseInfo.doesKillingDamage(this);
            } else if (this.baseInfo.nonDmgEffect) {
                return false;
            } else if (this.type === "disadvantage") {
                return false;
            } else if (this.baseInfo.type.includes("disadvantage")) {
                return false;
            }
        }

        // Legacy KILLING support
        console.warn(
            `${this.actor.name}: Unable to determine KILLING property for ${this.system.XMLID}/${this.name}, using legacy values.`,
        );
        if (this.system?.killing === true) {
            return true;
        }
        if (this.system?.killing === false) {
            return false;
        }

        return false;
    }

    get weightKg() {
        const equipmentWeightPercentage =
            parseInt(game.settings.get(game.system.id, "equipmentWeightPercentage")) / 100.0;
        let weightLbs = parseFloat(this.system?.WEIGHT) || 0;
        for (const child of this.childItems) {
            weightLbs += parseFloat(child.system?.WEIGHT) || 0;
        }
        const weightKg = (weightLbs / 2.2046226218) * equipmentWeightPercentage;
        return weightKg.toFixed(1);
    }

    get priceText() {
        const price = parseFloat(this.system.PRICE) || 0;
        return `$${price.toFixed(2)}`;
    }

    // Is this power disabled because we are not in our superheroic identity?
    get disabledOIHID() {
        if (!this.actor) return false;
        if (this.actor.system?.heroicIdentity) return false;
        if (this.findModsByXmlid("OIHID")) return true;
        return false;
    }

    get isActive() {
        try {
            if (this.disabledOIHID) return false;
        } catch (e) {
            console.error(e);
        }

        if (this.effect?.disabled === true && this.system.active === true) {
            console.error(`active mismatch`, this);
        }

        if (this.effect?.disabled === false && this.system.active === false) {
            console.error(`active mismatch`, this);
        }

        if (this.system.active === undefined) {
            return true;
        }

        return this.system.active;
    }

    get compoundCost() {
        if (this.system?.XMLID !== "COMPOUNDPOWER") return 0;

        let cost = 0;
        for (const child of this.childItems) {
            cost += parseInt(child.system.realCost);
        }

        let costSuffix = "";

        // Is this in a framework?
        if (this.parentItem?.system.XMLID === "MULTIPOWER") {
            // Fixed
            if (this.system.ULTRA_SLOT) {
                costSuffix = this.actor?.system.is5e ? "u" : "f";
                cost = RoundFavorPlayerDown(cost / 10.0);
            }

            // Variable
            else {
                costSuffix = this.actor?.system.is5e ? "m" : "v";
                cost = RoundFavorPlayerDown(cost / 5.0);
            }
        } else if (this.parentItem?.system.XMLID === "ELEMENTAL_CONTROL") {
            cost = cost - this.parentItem.system.BASECOST;
        }

        // PH: FIXME: Don't think this is right. This method is only called from hbs files ...
        return RoundFavorPlayerDown(cost) + costSuffix;
    }

    /**
     * Get the item's active cost for display purposes. To be similar to HD we round up (so 4.5 goes to 5).
     * However, be aware that HD keep the actual point cost expressed in 1 or 2 decimal points (based on 5e or 6e)
     */
    get activePointCostForDisplay() {
        return RoundFavorPlayerUp(this._activePoints);
    }

    /**
     * Get the item's real cost for display purposes. To be similar to HD we round up (so 4.5 goes to 5).
     * However, be aware that HD keep the actual point cost expressed in 1 or 2 decimal points (based on 5e or 6e)
     */
    get realPointCostForDisplay() {
        return RoundFavorPlayerUp(this._realCost);
    }

    /**
     * Get the item's character cost for display purposes. To be similar to HD we round up (so 4.5 goes to 5).
     * However, be aware that HD keep the actual point cost expressed in 1 or 2 decimal points (based on 5e or 6e)
     */
    get characterPointCostForDisplay() {
        const cost = this.characterPointCost || parseFloat(this.realCost);

        return RoundFavorPlayerUp(cost);
    }

    get activePoints() {
        return this.calcItemPoints().activePoints;
    }

    get characterPointCost() {
        return this.calcItemPoints().characterPointCost;
    }

    get realCost() {
        return this.calcItemPoints().realCost;
    }

    get _activePointsWithoutEndMods() {
        return this.calcItemPoints()._activePointsWithoutEndMods;
    }

    get _advantages() {
        return this.calcItemPoints()._advantages;
    }

    get characterPointCostForDisplayPlusSuffix() {
        const cost = this.characterPointCostForDisplay;

        if (
            this.parentItem?.system.XMLID === "MULTIPOWER" ||
            this.parentItem?.parentItem?.system.XMLID === "MULTIPOWER"
        ) {
            // Fixed
            if (this.system.ULTRA_SLOT || this.parentItem?.system.ULTRA_SLOT) {
                return cost + (this.actor?.system.is5e ? "u" : "f");
            }

            // Variable
            else {
                return cost + (this.actor?.system.is5e ? "m" : "v");
            }
        }

        return cost;
    }

    get listCost() {
        if (this.system?.XMLID !== "LIST") return 0;
        let cost = 0;
        for (const child of this.childItems) {
            cost += parseInt(child.system.realCost);
        }

        let costSuffix = "";

        // Is this in a framework?
        if (this.parentItem?.system.XMLID === "MULTIPOWER") {
            // Fixed
            if (this.system.ULTRA_SLOT) {
                costSuffix = this.actor?.system.is5e ? "u" : "f";
                cost /= 10.0;
            }

            // Variable
            else {
                costSuffix = this.actor?.system.is5e ? "m" : "v";
                cost /= 5.0;
            }
        } else if (this.parentItem?.system.XMLID === "ELEMENTAL_CONTROL") {
            cost = cost - this.parentItem.system.BASECOST;
        }

        return RoundFavorPlayerDown(cost) + costSuffix;
    }

    /// Get Levels with AID/DRAIN Active Effects
    get adjustedLevels() {
        // TODO: Custom adjustedLevels in config.mjs for things that are all or nothing?
        let _adjustedLevels = parseInt(this.system.LEVELS || 0);

        // Notice that we are only looking for DRAINS on "this" item.
        // If there are more than one item with the same XMLID then we don't know which item is getting the drain.
        for (const ae of this.effects) {
            //console.log(ae);
            for (const change of ae.changes) {
                if (change.key.match(new RegExp(this.system.XMLID, "i"))) {
                    _adjustedLevels += parseInt(change.value || 0);
                }
            }
        }

        // Ideally the AE is on the item, but if DRAINing multiple items at once it may include
        // characteristics + powers, so need to support AE on ITEM and AE on ACTOR.
        if (this.actor) {
            for (const ae of this.actor.temporaryEffects) {
                //console.log(ae);
                for (const change of ae.changes) {
                    if (change.key.match(new RegExp(this.system.XMLID, "i"))) {
                        const item = fromUuidSync(ae.flags?.target); // This should not be an array ?.[0]
                        if (!item) {
                            console.warn(`${ae.name} has no associated item`, this, ae);
                            return Math.max(0, _adjustedLevels);
                        } else if (item.id === this.id) {
                            //console.warn(`${ae.name} should be on item not on actor`, this, ae);
                            _adjustedLevels += parseInt(change.value || 0);
                        }
                    }
                }
            }
        }

        // TODO: Should we be MAXing it here, or when we apply the defense?
        return Math.max(0, _adjustedLevels);
    }

    get conditionalDefenseShortDescription() {
        let shortDesc = this.name;
        if (this.system.XMLID === "VULNERABILITY") {
            shortDesc += ` (${this.system.INPUT})`;
        }
        const ONLYAGAINSTLIMITEDTYPE = this.findModsByXmlid("ONLYAGAINSTLIMITEDTYPE");
        if (ONLYAGAINSTLIMITEDTYPE) {
            shortDesc += ` (${ONLYAGAINSTLIMITEDTYPE.ALIAS})`;
        }
        return shortDesc;
    }

    /**
     * Is the item a sense affecting power or maneuver?
     *
     * @returns {boolean}
     */
    isSenseAffecting() {
        return (
            !!this.baseInfo?.type?.includes("sense-affecting") ||
            (!!this.system.EFFECT && this.system.EFFECT.search(/\[FLASHDC\]/) > -1)
        );
    }

    get _basePoints() {
        if (!this.system.XMLID) return 0;

        if (this.baseInfo?.basePoints) {
            return this.baseInfo.basePoints(this);
        }

        if (this.system.EVERYMAN) return 0;
        if (this.system.NATIVE_TONGUE) return 0;

        // Custom basePoints
        if (this.baseInfo?.cost) {
            return this.baseInfo.cost(this);
        }

        const baseCost = parseFloat(this.system.BASECOST) || 0;
        let _basePoints = baseCost;

        const costPerLevel = this.baseInfo?.costPerLevel(this) || 0;
        const levels = parseInt(this.system.LEVELS) || 0;
        _basePoints += levels * costPerLevel;

        if (levels > 0) {
            _basePoints = Math.max(1, _basePoints);
        }

        return _basePoints;
    }

    get _addersCost() {
        if (this.system.EVERYMAN) return 0;
        if (this.system.NATIVE_TONGUE) return 0;

        let _cost = 0;

        for (const adder of this.adders) {
            if (this.baseInfo?.categorized && this.system.FAMILIARITY) {
                _cost += Math.max(1, adder.cost - 1);
            } else {
                _cost += adder.cost;
            }
        }

        // ENDURANCERESERVEREC is a power, we can treat it like an adder
        for (const power of this.powers) {
            _cost += power.cost;
        }

        return _cost;
    }

    get _negativeCustomAddersCost() {
        let _cost = 0;

        for (const adder of this.adders.filter((a) => a.cost < 0)) {
            _cost += adder.cost;
        }

        return _cost;
    }

    _advantageCostExcludingList(exclusionList) {
        let _cost = 0;

        for (const advantage of this.advantages.filter((advantage) => !exclusionList.includes(advantage.XMLID))) {
            _cost += advantage.cost;
        }

        return _cost;
    }

    get _advantageCost() {
        return this._advantageCostExcludingList([]);
    }

    get _advantageCostWithoutEnd() {
        return this._advantageCostExcludingList(["REDUCEDEND"]);
    }

    get _advantageCostWithoutAoe() {
        return this._advantageCostExcludingList(["AOE", "EXPLOSION"]);
    }

    get _limitationCost() {
        let _cost = 0;
        for (const limitation of this.limitations) {
            _cost += limitation.cost;
        }

        // Return +0 rather than -0 for obviousness
        return _cost ? -_cost : 0;
    }

    get _activePoints() {
        if (this.baseInfo?.activePoints) {
            return this.baseInfo.activePoints(this);
        }

        const advantageCosts = 1 + this._advantageCost;
        let ap = this._basePoints + this._addersCost;

        // We must round only if we multiply (FRed pg 7, 6e vol 1 pg 12)
        if (advantageCosts !== 1) {
            ap = RoundFavorPlayerDown(ap * advantageCosts);
        }

        ap = Math.max(this.baseInfo?.minimumCost || 0, ap);
        return ap;
    }

    get _activePointsForEnd() {
        const advantageCostsWithoutEnd = 1 + this._advantageCostWithoutEnd;
        const baseCostWithoutEnd = this._basePoints + this._addersCost - this._negativeCustomAddersCost;

        // We must round only if we multiply (FRed pg 7, 6e vol 1 pg 12)
        if (advantageCostsWithoutEnd !== 1) {
            return RoundFavorPlayerDown(baseCostWithoutEnd * advantageCostsWithoutEnd);
        } else {
            return baseCostWithoutEnd;
        }
    }

    get _activePointsWithoutAoe() {
        const advantageCostsWithoutAoe = 1 + this._advantageCostWithoutAoe;
        const baseCostWithoutAoe = this._basePoints + this._addersCost - this._negativeCustomAddersCost;

        // We must round only if we multiply (FRed pg 7, 6e vol 1 pg 12)
        if (advantageCostsWithoutAoe !== 1) {
            return RoundFavorPlayerDown(baseCostWithoutAoe * advantageCostsWithoutAoe);
        } else {
            return baseCostWithoutAoe;
        }
    }

    _activePointsWithoutExclusionList(exclusionList) {
        const advantageCostsWithoutExclusions = 1 + this._advantageCostExcludingList(exclusionList);
        const baseCostWithoutExclusions = this._basePoints + this._addersCost - this._negativeCustomAddersCost;

        // We must round only if we multiply (FRed pg 7, 6e vol 1 pg 12)
        if (advantageCostsWithoutExclusions !== 1) {
            return RoundFavorPlayerDown(baseCostWithoutExclusions * advantageCostsWithoutExclusions);
        } else {
            return baseCostWithoutExclusions;
        }
    }

    get _advantagesAffectingDc() {
        let _cost = 0;

        for (const advantage of this.advantages.filter((a) => a.baseInfo?.dcAffecting(a, this))) {
            _cost += advantage.cost;
        }

        return _cost;
    }

    // PH: FIXME: Need to check that this works for maneuvers. They do have an ACTIVECOST field although ours might not.
    get _activePointsAffectingDcRaw() {
        return (
            (this._basePoints + this._addersCost - this._negativeCustomAddersCost) * (1 + this._advantagesAffectingDc)
        );
    }

    get _activePointsDcAffecting() {
        const advantageCostsAffectingDc = 1 + this._advantagesAffectingDc;
        const dcRaw = this._basePoints + this._addersCost - this._negativeCustomAddersCost;

        // We must round only if we multiply (FRed pg 7, 6e vol 1 pg 12)
        if (advantageCostsAffectingDc !== 1) {
            return RoundFavorPlayerDown(dcRaw);
        } else {
            return dcRaw;
        }
    }

    get dc() {
        return Math.floor(this.dcRaw);
    }

    get dcRaw() {
        return this._activePointsAffectingDcRaw / 5;
    }

    /// Real Cost = Active Cost / (1 + total value of all Limitations)
    get _realCost() {
        // VPP parent?
        if (this.parentItem?.system.XMLID === "VPP" || this.parentItem?.parentItem?.system.XMLID === "VPP") {
            return 0;
        }

        if (this.baseInfo?.realCost) {
            return this.baseInfo.realCost(this);
        }

        let _cost = this._activePoints;

        // Skill Enhancer
        if (this.parentItem?.baseInfo?.type.includes("enhancer")) {
            _cost = Math.max(1, _cost - 1);
        }

        let _limitationCost = this._limitationCost;
        if (this.system.XMLID === "NAKEDMODIFIER") {
            // Need to be careful about NAKEDMODIFIER PRIVATE (part of cost) vs !PRIVATE (part of naked limitation)
            // Considering moving this into CONFIG.MJS, but need to see if this applies anywhere else.
            // Would be nice to have something generic to handle all cases
            _limitationCost = 0;

            for (const limitation of this.limitations.filter((o) => o.PRIVATE)) {
                _limitationCost -= limitation.cost;
            }
        } else if (this.parentItem?.system.XMLID === "ELEMENTAL_CONTROL") {
            // Elemental controls reduce the slot cost by the base cost. Slot cost must be at least 2x base cost.
            const baseCost = (this.parentItem.system.BASECOST = parseFloat(this.parentItem.system.BASECOST));
            _cost = Math.max(baseCost, _cost - baseCost);

            // The real cost of an EC slot is the sum of the limitations on the pool and the slot (which is this._limitationCost) above
        }

        // We must round only if we divide (FRed pg 7, 6e vol 1 pg 12)
        if (_limitationCost !== 0) {
            _cost = RoundFavorPlayerDown(_cost / (1 + _limitationCost));
        }

        return _cost;
    }

    get _characterPointCost() {
        let _cost = this._realCost;

        // Power cost in Power Framework is applied before limitations
        if (this.parentItem) {
            if (
                this.parentItem.system.XMLID === "MULTIPOWER" ||
                this.parentItem.parentItem?.system.XMLID === "MULTIPOWER"
            ) {
                // Fixed with minimum cost of 1
                if (this.system.ULTRA_SLOT || this.parentItem?.system.ULTRA_SLOT) {
                    _cost = Math.max(1.0, RoundFavorPlayerDown(_cost / 10.0));
                }

                // Variable with minimum cost of 1
                else {
                    _cost = Math.max(1.0, RoundFavorPlayerDown(_cost / 5.0));
                }
            }
        }

        return _cost;
    }

    get costPerLevel() {
        return this.baseInfo?.costPerLevel(this);
    }

    get end() {
        let end = this.getBaseEndCost();

        const increasedEnd = this.findModsByXmlid("INCREASEDEND");
        if (increasedEnd) {
            end *= parseInt(increasedEnd.OPTION.replace("x", ""));
        }

        const reducedEnd =
            this.findModsByXmlid("REDUCEDEND") || (this.parentItem && this.parentItem.findModsByXmlid("REDUCEDEND"));
        if (reducedEnd && reducedEnd.OPTION === "HALFEND") {
            end = RoundFavorPlayerDown((this.system._activePointsWithoutEndMods || this.activePoints) / 10);
            end = Math.max(1, RoundFavorPlayerDown(end / 2));
        } else if (reducedEnd && reducedEnd.OPTION === "ZERO") {
            end = 0;
        }

        const costsEnd = this.findModsByXmlid("COSTSEND");
        if (!costsEnd) {
            if (!this.baseInfo?.costEnd) {
                end = 0;
            }

            // Charges typically do not cost END
            if (this.findModsByXmlid("CHARGES")) {
                end = 0;
            }
        } else {
            // Full endurance cost unless it's purchased with half endurance
            if (costsEnd.OPTIONID === "HALFEND") {
                end = RoundFavorPlayerDown(end / 2);
            }
        }

        // STR only costs endurance when used.
        // Can get a bit messy, like when resisting an entangle, but will deal with that later.
        if (this.XMLID === "STR") {
            end = 0;
        }

        // MOVEMENT only costs endurance when used.  Typically per round.
        if (this.baseInfo?.type.includes("movement")) {
            end = 0;
        }

        return end;
    }

    get duration() {
        let _duration = this.baseInfo?.duration;
        if (this.baseInfo?.behaviors.includes("success")) {
            _duration ??= "instant";
        }

        if (this.modifiers.find((o) => o.XMLID === "INHERENT")) {
            return "inherent";
        }
        if (this.modifiers.find((o) => o.XMLID === "NONPERSISTENT")) {
            return "constant";
        }
        if (this.modifiers.find((o) => o.XMLID === "PERSISTENT")) {
            return "persistent";
        }

        return _duration;
    }

    /**
     * Add advantages from itemFrom to this item but postUpload is not run
     * FIXME: this does not handle the merging of any advantages (e.g. AP being added when already have AP)
     * NOTE: This assumes that all changes have been made and that copying item advantage is the last thing that's
     *       done for an effective item.
     *
     * @param {HeroSystem6eItem} itemTo
     */
    copyItemAdvantages(itemFrom, advantagesToIgnore) {
        this.system._active.originalActivePoints = this.system._active.originalActivePoints ?? this._activePoints;

        const advantagesToCopy = itemFrom.advantages
            .map((advantage) => advantage._original)
            .filter((advantage) => !advantagesToIgnore.includes(advantage.XMLID));

        this.system.MODIFIER = (this.system.MODIFIER || []).concat(advantagesToCopy);
        HeroSystem6eItem._modifiersCache.invalidateCache(this.id);

        // Stash a copy of what we've added in after the fact
        this.system._active.MODIFIER = (this.system._active.MODIFIER || []).concat(advantagesToCopy);
    }

    // Change the actual levels
    changePowerLevel(effectiveRealCost) {
        const baseRealCost = this._realCost;

        // When reducing character points, we just scale. However, when pushing we don't consider
        // advantages (which was clearly an "it's too complicated to calculate" simplification in the rules that we'll keep)
        const effectiveBaseRawDc = this.dcRaw * (effectiveRealCost / baseRealCost);

        const diceParts = calculateDicePartsFromDcForItem(this, effectiveBaseRawDc);

        this.damageLevelTweaking(diceParts);
    }

    /**
     * Most damage powers have a standard way of describing, in XML, how they do damage. This works for those.
     *
     * PH: FIXME: This doesn't work for at least the following powers:
     * TK
     * Anything that doesn't have a damage effect (e.g. Darkness)
     */
    damageLevelTweaking(diceParts) {
        const plusOnePipAdderData = getModifierInfo({
            xmlid: "PLUSONEPIP",
            actor: this.actor,
            is5e: this.is5e,
            item: this,
            xmlTag: "ADDER",
        });
        const plusHalfDieAdderData = getModifierInfo({
            xmlid: "PLUSONEHALFDIE",
            actor: this.actor,
            is5e: this.is5e,
            item: this,
            xmlTag: "ADDER",
        });
        const minusOnePipAdderData = getModifierInfo({
            xmlid: "MINUSONEPIP",
            actor: this.actor,
            is5e: this.is5e,
            item: this,
            xmlTag: "ADDER",
        });

        // In the future, LEVELS should be something fixed by the actual XML.
        // Set the level for the number of dice.
        if (this.system.XMLID === "TELEKINESIS") {
            this.system.LEVELS =
                diceParts.d6Count * 5 + (diceParts.halfDieCount + diceParts.d6Less1DieCount) * 3 + diceParts.constant;

            // TK does not use adders so we are done.
            return;
        } else {
            this.system.LEVELS = diceParts.d6Count.toString();
        }

        // Set/clear a d6-1 adder
        const minusOnePipAdder = this.adders.find((adder) => adder.XMLID === "MINUSONEPIP");
        if (!diceParts.d6Less1DieCount && minusOnePipAdder) {
            // Remove the adder
            this.system.ADDER = this.system.ADDER.filter((adder) => adder.XMLID !== "MINUSONEPIP");
        } else if (diceParts.d6Less1DieCount && !minusOnePipAdder) {
            // Add the adder
            const newAdder = createModifierOrAdderFromXml(minusOnePipAdderData.xml);
            this.system.ADDER ??= [];
            this.system.ADDER.push(new HeroAdderModel(newAdder, { parent: this }));
        }

        // Invalidate the adders cache if this is a non temporary item.
        if (this.id) {
            HeroSystem6eItem._addersCache.invalidateCache(this.id);
        }

        // Set/clear a 1/2d6 adder
        const halfDieAdder = this.adders.find((adder) => adder.XMLID === "PLUSONEHALFDIE");
        if (!diceParts.halfDieCount && halfDieAdder) {
            // Remove the adder
            this.system.ADDER = this.system.ADDER.filter((adder) => adder.XMLID !== "PLUSONEHALFDIE");
        } else if (diceParts.halfDieCount && !halfDieAdder) {
            // Add the adder
            let xml = plusHalfDieAdderData.xml;

            const { baseApPerDie } = calculateApPerDieForItem(this);

            // BASECOST is either 1.5, 3, 5, or 10 depending on the base LEVELS cost
            let baseCost = 0;
            switch (baseApPerDie) {
                case 3:
                    baseCost = 1.5;
                    break;

                case 5:
                    baseCost = 3;
                    break;

                case 10:
                    baseCost = 5;
                    break;

                case 15:
                    baseCost = 10;
                    break;

                default:
                    console.error(
                        `${this.detailedName()} for ${this.actor.name} has unknown base active points per die`,
                    );
                    break;
            }

            xml = xml.replace(/BASECOST="[\d.]+"/, `BASECOST="${baseCost}"`);

            const newAdder = createModifierOrAdderFromXml(xml);
            this.system.ADDER ??= [];
            this.system.ADDER.push(new HeroAdderModel(newAdder, { parent: this }));
        }

        // Invalidate the adders cache if this is a non temporary item.
        if (this.id) {
            HeroSystem6eItem._addersCache.invalidateCache(this.id);
        }

        // Set/clear a +1 pip adder
        const onePipAdder = this.adders.find((adder) => adder.XMLID === "PLUSONEPIP");
        if (!diceParts.constant && onePipAdder) {
            // Remove the adder
            this.system.ADDER = this.system.ADDER.filter((adder) => adder.XMLID !== "PLUSONEPIP");
        } else if (diceParts.constant && !onePipAdder) {
            // Add the adder
            let xml = plusOnePipAdderData.xml;

            const { baseApPerDie } = calculateApPerDieForItem(this);

            // BASECOST is either 1,2,3, or 5 depending on the base LEVELS cost. See FRed pg. 114 assumed to be same in 6e but can't find rule.
            let baseCost = 0;
            switch (baseApPerDie) {
                case 3:
                    baseCost = 1;
                    break;

                case 5:
                    baseCost = 2;
                    break;

                case 10:
                    baseCost = 3;
                    break;

                case 15:
                    baseCost = 5;
                    break;

                default:
                    console.error(
                        `${this.detailedName()} for ${this.actor.name} has unknown base active points per die`,
                    );
                    break;
            }

            xml = xml.replace(/BASECOST="[\d.]+"/, `BASECOST="${baseCost}"`);

            const newAdder = createModifierOrAdderFromXml(xml);
            this.system.ADDER ??= [];
            this.system.ADDER.push(new HeroAdderModel(newAdder, { parent: this }));
        }

        // Invalidate the adders cache if this is a non temporary item.
        if (this.id) {
            HeroSystem6eItem._addersCache.invalidateCache(this.id);
        }
    }

    // TODO: Start using this everywhere we are using this combination in strings.
    detailedName() {
        // Fake the
        if (this.system.XMLID === "__STRENGTHDAMAGE") {
            if (this.system.ALIAS === "__InternalStrengthPlaceholder") {
                return "Your STRENGTH";
            }
        }

        if (this.system.NAME === "") return this.name || this.system.XMLID;
        return `${this.name} [${this.system.XMLID}]`;

        //return `${this.name}/${this.system.XMLID}`;
    }

    toXML() {
        const primaryAttributes = [
            "XMLID",
            "ID",
            "BASECOST",
            "LEVELS",
            "ALIAS",
            "POSITION",
            "MULTIPLIER",
            "GRAPHIC",
            "COLOR",
            "SFX",
            "SHOW_ACTIVE_COST",
            "OPTION",
            "OPTIONID",
            "OPTION_ALIAS",
            "INCLUDE_NOTES_IN_PRINTOUT",
            "PARENTID",
            "NAME",
        ];
        let primaryXML = "";
        for (const htmlAttribute of primaryAttributes) {
            if (this.system[htmlAttribute]) {
                primaryXML += ` ${htmlAttribute}="${this.system[htmlAttribute]}"`;
            }
        }
        const secondaryAttributes = Object.keys(this.system)
            .filter((o) => !primaryAttributes.includes(o) && o.match(/^[A-Z]+$/))
            .sort();
        let secondaryXML = "";
        for (const htmlAttribute of secondaryAttributes) {
            if (this.system[htmlAttribute] && typeof this.system[htmlAttribute] === "string") {
                secondaryXML += ` ${htmlAttribute}="${this.system[htmlAttribute]}"`;
            }
        }
        const xml = `<${this.system.xmlTag}` + primaryXML + secondaryXML + `></${this.system.xmlTag}>`;
        return xml;
    }
}

// Prepare the modifier object. This is not really an item, but a MODIFER or ADDER
// Using a simplied version of HeroSystemItem6e.itemDataFromXml for now.
// PH: FIXME: Probably want to move from here and consolidate
export function createModifierOrAdderFromXml(xml) {
    const modifierOrAdderData = {
        _hdcXml: xml,
    };
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    for (const attribute of xmlDoc.children[0].attributes) {
        switch (attribute.value) {
            case "Yes":
            case "YES":
                modifierOrAdderData[attribute.name] = true;
                break;
            case "No":
            case "NO":
                modifierOrAdderData[attribute.name] = false;
                break;
            default:
                modifierOrAdderData[attribute.name] = attribute.value.trim();
        }
    }

    // Create a unique ID
    modifierOrAdderData.ID = new Date().getTime().toString();

    return modifierOrAdderData;
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

export async function RequiresACharacteristicRollCheck(actor, characteristic, reasonText) {
    console.log(characteristic, this);
    const successValue = parseInt(actor?.system.characteristics[characteristic.toLowerCase()].roll) || 8;
    const activationRoller = new HeroRoller().makeSuccessRoll(true, successValue).addDice(3);
    await activationRoller.roll();
    let succeeded = activationRoller.getSuccess();
    const autoSuccess = activationRoller.getAutoSuccess();
    const total = activationRoller.getSuccessTotal();
    const margin = successValue - total;

    const flavor = `${reasonText ? `${reasonText}. ` : ``}${characteristic.toUpperCase()} roll ${successValue}- ${
        succeeded ? "succeeded" : "failed"
    } by ${autoSuccess === undefined ? `${Math.abs(margin)}` : `rolling ${total}`}`;
    let cardHtml = await activationRoller.render(flavor);

    // FORCE success
    if (!succeeded && overrideCanAct) {
        const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
        ui.notifications.info(`${actor.name} succeeded roll because override key.`);
        succeeded = true;
        cardHtml += `<p>Succeeded roll because ${game.user.name} used <b>${overrideKeyText}</b> key to override.</p>`;
    }

    const token = actor.token;
    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
    speaker.alias = actor.name;

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
        rolls: activationRoller.rawRolls(),
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);

    return succeeded;
}

export async function requiresASkillRollCheck(item, options = {}) {
    // Toggles don't need a roll to turn off
    //if (item.system?.active === true) return true;

    let rar = item.modifiers.find((o) => o.XMLID === "REQUIRESASKILLROLL" || o.XMLID === "ACTIVATIONROLL");
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
                            value = Math.max(3, value - Math.floor(parseInt(item.activePoints) / 5));
                        if (rar.OPTIONID === "SKILL1PER20")
                            value = Math.max(3, value - Math.floor(parseInt(item.activePoints) / 20));

                        OPTION_ALIAS += ` ${value}-`;
                    } else {
                        ui.notifications.warn(
                            `${item.actor.name} has a power ${item.name}. Expecting 'SKILL roll', where SKILL is the name of an owned skill.`,
                        );

                        if (!overrideCanAct) {
                            const actor = item.actor;
                            const token = actor.token;
                            const speaker = ChatMessage.getSpeaker({ actor: actor, token });
                            speaker.alias = actor.name;
                            const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;

                            const chatData = {
                                style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
                                author: game.user._id,
                                content:
                                    `<div class="dice-roll"><div class="dice-flavor">${item.name} (${item.system.OPTION_ALIAS || item.system.COMMENTS}) activation failed because the appropriate skill is not owned.</div></div>` +
                                    `\nPress <b>${overrideKeyText}</b> to override.`,
                                speaker: speaker,
                            };

                            await ChatMessage.create(chatData);

                            return false;
                        }
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
        if (!succeeded && overrideCanAct) {
            const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
            ui.notifications.info(`${item.actor.name} succeeded roll because override key.`);
            succeeded = true;
            cardHtml += `<p>Succeeded roll because ${game.user.name} used <b>${overrideKeyText}</b> key to override.</p>`;
        }

        const actor = item.actor;
        const token = actor.token;
        const speaker = ChatMessage.getSpeaker({ actor: actor, token });
        //speaker.alias = actor.name;
        if (!succeeded && options.resourcesUsedDescription) {
            cardHtml += `Spent ${options.resourcesUsedDescription}.`;
        }

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            rolls: activationRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        await ChatMessage.create(chatData);

        if (!succeeded && options.showUi) {
            ui.notifications.warn(cardHtml);
        }

        return succeeded;
    }
    return true;
}

async function _startIfIsAContinuingCharge(item) {
    const charges = item.findModsByXmlid("CHARGES");
    const continuing = item.findModsByXmlid("CONTINUING");
    if (charges && continuing) {
        // Charges expire, find the Active Effect
        const ae = item.effects.contents?.[0];
        if (ae) {
            let seconds = hdcTimeOptionIdToSeconds(continuing.OPTIONID);
            if (seconds < 0) {
                console.error(`optionID for ${item.detailedName()} has unhandled option ID ${continuing.OPTIONID}`);
                seconds = 1;
            }

            console.log(
                await ae.update({
                    "duration.seconds": seconds,
                    "duration.startTime": game.time.worldTime,
                    "flags.startTime": game.time.worldTime,
                }),
            );
        } else {
            console.log("No associated Active Effect", item);
        }
    }
}

/**
 * Create an uninitialized in-memory item.
 *
 * Caller can do further changes, such as linking items, and will need to call _postUpload
 *
 * @param {Object} param0
 * @returns
 */
export function cloneToEffectiveAttackItem({
    originalItem,
    effectiveRealCost,
    pushedRealPoints,
    effectiveStr,
    effectiveStrPushedRealPoints,
}) {
    const effectiveItemData = originalItem.toObject(false);
    effectiveItemData._id = null;
    const effectiveItem = new HeroSystem6eItem(effectiveItemData, { parent: originalItem.actor });
    effectiveItem.system._active = { __originalUuid: originalItem.uuid };

    // PH: FIXME: Doesn't include TK
    // PH: FIXME: Doesn't include items with STR minima
    // Does this item allow strength to be added and has the character decided to use strength to augment the damage?
    let strengthItem = null;
    if (effectiveStr > 0 && originalItem.system.usesStrength) {
        strengthItem = buildStrengthItem(effectiveStr, originalItem.actor, `STR used with ${originalItem.name}`);

        // Pushing?
        strengthItem.system._active.pushedRealPoints = effectiveStrPushedRealPoints;

        // PH: FIXME: We can get rid of the effectiveStr field in the active because we'll just have the actual STR item
        effectiveItem.system._active.effectiveStr = effectiveStr;
        effectiveItem.system._active.effectiveStrItem = strengthItem;

        effectiveItem.system._active.linkedEnd ??= [];
        effectiveItem.system._active.linkedEnd.push({
            item: strengthItem,
        });
    }

    // PH: FIXME: Need to link in TK as appropriate into STR?

    // Reduce or Push the item
    effectiveItem.changePowerLevel(effectiveRealCost);
    effectiveItem.system._active.pushedRealPoints = pushedRealPoints;

    return {
        effectiveItem,
        strengthItem,
    };
}

// for testing and pack-load-from-config macro
window.HeroSystem6eItem = HeroSystem6eItem;
