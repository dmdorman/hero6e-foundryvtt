import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";
import {
    collectActionDataBeforeToHitOptions,
    rollEffect,
    rollLuck,
    rollUnluck,
    userInteractiveVerifyOptionallyPromptThenSpendResources,
} from "../item/item-attack.mjs";
import { createSkillPopOutFromItem } from "../item/skill.mjs";
import { activateManeuver, maneuverCanBeAbortedTo, enforceManeuverLimits, maneuverHasBlockTrait } from "./maneuver.mjs";
import {
    adjustmentSourcesPermissive,
    adjustmentSourcesStrict,
    determineMaxAdjustment,
} from "../utility/adjustment.mjs";
import { HeroObjectCacheMixin } from "../utility/cache.mjs";
import {
    foundryVttDeleteProperty,
    getPowerInfo,
    hdcTimeOptionIdToSeconds,
    tokenEducatedGuess,
    whisperUserTargetsForActor,
} from "../utility/util.mjs";
import { roundFavorPlayerTowardsZero, roundFavorPlayerAwayFromZero } from "../utility/round.mjs";
import {
    buildStrengthItem,
    calculateApPerDieForItem,
    calculateDicePartsFromDcForItem,
    combatSkillLevelsForAttack,
    getEffectFormulaFromItem,
    getExtraMartialDcsOrZero,
    getManeuverEffect,
    getManueverEffectWithPlaceholdersReplaced,
    isManeuverThatDoesReplaceableDamageType,
    isRangedMartialManeuver,
} from "../utility/damage.mjs";
import {
    getRoundedUpDistanceInSystemUnits,
    getSystemDisplayUnits,
    convertSystemUnitsToMetres,
    gridUnitsToMeters,
    currentSceneUsesHexGrid,
} from "../utility/units.mjs";
import { HeroRoller } from "../utility/dice.mjs";
import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";
import { getItemDefenseVsAttack } from "../utility/defense.mjs";
import { overrideCanAct } from "../settings/settings-helpers.mjs";
import { HeroAdderModel } from "./HeroSystem6eTypeDataModels.mjs";
import { ItemVppConfig } from "../applications/apps/item-vpp-config.mjs";
import { calculateDicePartsForItem } from "../utility/damage.mjs";
import { tagObjectForPersistence } from "../migration.mjs";

export function initializeItemHandlebarsHelpers() {
    Handlebars.registerHelper("itemFullDescription", itemFullDescription);
    Handlebars.registerHelper("itemName", itemName);
    Handlebars.registerHelper("itemIsCombatManeuver", itemIsCombatManeuver);
    Handlebars.registerHelper("itemIsOptionalCombatManeuver", itemIsOptionalCombatManeuver);
    Handlebars.registerHelper("filterItem", filterItem);
    Handlebars.registerHelper("itemHasBehaviours", itemHasBehaviours);
    Handlebars.registerHelper("itemHasActionBehavior", itemHasActionBehavior);
    Handlebars.registerHelper("itemPostHitActionString", itemPostHitActionString);
    Handlebars.registerHelper("hasDefenseActiveEffect", itemHasDefenseActiveEffect);
    Handlebars.registerHelper("itemHeroValidationForProperty", itemHeroValidationForProperty);
}

function itemHeroValidationForProperty(item, property) {
    return item.heroValidation
        .filter((validation) => validation.property === property)
        .map((m) => `${m.message} For example: "${m.example}"`)
        .join(" ");
}

function itemHasDefenseActiveEffect(item) {
    if (!item) return false;
    const defenseChange = item.effects.find((ae) =>
        ae.changes.find((ch) =>
            getPowerInfo({
                xmlid: ch.key.match(/system\.characteristics\.([a-z]+)\.(max||value)/)?.[1].toUpperCase(),
                actor: item.actor,
                xmlTag: ch.key.match(/system\.characteristics\.([a-z]+)\.(max||value)/)?.[1].toUpperCase(), // only search for characteristic not adders and such
            })?.behaviors.includes("defense"),
        ),
    );
    if (defenseChange) {
        return true;
    }
    return false;
}

// Returns HTML so expects to not be escaped in handlebars (i.e. triple braces)
function itemFullDescription(item) {
    if (item.isSeparator) {
        return "";
    }

    let desc = item.system.description;
    if (item.system.NAME) {
        desc = `<i>${item.system.NAME}:</i> ${item.system.description}`;
    }

    return desc;
}

// Returns HTML so expects to not be escaped in handlebars (i.e. triple braces)
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

function itemIsCombatManeuver(item) {
    return item.isCombatManeuver;
}

function itemIsOptionalCombatManeuver(item) {
    return item.isCombatManeuver && !!getPowerInfo({ item: item })?.behaviors.includes("optional-maneuver");
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
        if (typeof desiredbehaviour !== "string") {
            continue;
        }

        if (
            (item.system.XMLID !== "MANEUVER" && item.baseInfo?.behaviors.includes(desiredbehaviour)) ||
            (item.system.XMLID === "MANEUVER" && item.baseInfo?.behaviorsByItem(item).includes(desiredbehaviour))
        ) {
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

        if (item.constructor.name !== "HeroSystem6eItem") {
            // Most likely a actorsheetv2 active effect
            return false;
        }

        if (actionBehavior === "to-hit") {
            return item.rollsToHit();
        } else if (actionBehavior === "activatable") {
            return item.isActivatable();
        } else if (actionBehavior === "showClipsReload") {
            return item.showClipsReload;
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
        const isAdjustment = item.isAdjustment;
        const isSenseAffecting = item.isSenseAffecting;
        const isManeuver = item.isCombatManeuver;

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
export class HeroSystem6eItem extends HeroObjectCacheMixin(Item) {
    static async chatListeners(html) {
        html.on("click", ".roll-damage", this.__onChatCardAction.bind(this));
    }

    // Perform preliminary operations before a Document of this type is created. Pre-creation operations only
    // occur for the client which requested the operation. Modifications to the pending document before it is
    // persisted should be performed with this.updateSource().
    async _preCreate(data, options, userId) {
        await super._preCreate(data, options, userId);

        // Initialize new CSLs
        if (this.isCsl) {
            const initializationChanges = this.initializeCsl(this.system.LEVELS);
            this.updateSource(foundry.utils.mergeObject(initializationChanges));
        }

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

        const is5e =
            (options.is5e ?? this.actor?.is5e ?? game.settings.get(HEROSYS.module, "DefaultEdition") === "five")
                ? true
                : false;

        this.updateSource({
            system: {
                versionHeroSystem6eCreated: game.system.version,
                is5e,
            },
        });
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

    prepareDerivedData() {
        super.prepareDerivedData();

        this.composeMemoizableObjectFunction("attackDefenseVs");
        this.composeMemoizableObjectFunction("characterPointCost");
        this.composeMemoizableObjectFunction("childIdx");
        this.composeMemoizableObjectFunction("childItems");
        this.composeMemoizableObjectFunction("findModsByXmlid");
        this.composeMemoizableObjectFunction("getItemDescription");
        this.composeMemoizableObjectFunction("heroValidation");
        this.composeMemoizableObjectFunction("parentItem");
        this.composeMemoizableObjectFunction("_realCost");
    }

    async setActiveEffects(options = {}) {
        try {
            // If there is no actor for this item, then this item is most likely in the Items collection and we can ignore active effects for it.
            if (!this.actor) {
                console.warn(`Skipping setActiveEffects because there is no actor`, this);
                return;
            } else if (!this.id) {
                console.warn(`Skipping setActiveEffects because there is no item.id`, this);
                return;
            }

            // ACTIVE EFFECTS
            if (this.id && this.baseInfo && this.baseInfo.type?.includes("movement")) {
                try {
                    console.log(`setActiveEffects movement`);
                    const activeEffect =
                        this.effects.find((ae) => ae.system.XMLID === this.system.XMLID) ??
                        this.effects.find((ae) => !ae.system.XMLID) ??
                        {};
                    activeEffect.name =
                        (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} +${this.system.LEVELS}`;
                    activeEffect.img = this.baseInfo?.img ?? "icons/svg/upgrade.svg";
                    activeEffect.description = this.system.description;
                    activeEffect.origin = this.uuid;
                    const changes = [
                        {
                            key: `system.characteristics.${this.system.XMLID.toLowerCase()}.max`,
                            value: parseInt(this.system.LEVELS),
                            mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                        },
                    ];
                    for (const usableas of this.modifiers.filter((o) => o.XMLID === "USABLEAS")) {
                        console.log(usableas?.XMLID, usableas?.ALIAS, usableas);
                        let foundMatch = false;
                        for (const movementKey of Object.keys(CONFIG.HERO.movementPowers)) {
                            console.log(movementKey);
                            if (
                                usableas.ALIAS?.match(new RegExp(movementKey, "i")) ||
                                usableas.COMMENTS?.match(new RegExp(movementKey, "i"))
                            ) {
                                changes.push({
                                    key: `system.characteristics.${movementKey.toLowerCase()}.max`,
                                    value: parseInt(this.system.LEVELS),
                                    mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                                    priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
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
                    activeEffect.disabled ??= !this.system.active;
                    activeEffect.system ??= { XMLID: this.system.XMLID };
                    activeEffect.changes = changes;

                    if (activeEffect.update) {
                        // Need to be careful because changes is an array
                        await activeEffect.update({ name: activeEffect.name, changes }, options);
                    } else {
                        await this.createEmbeddedDocuments("ActiveEffect", [activeEffect], options);
                    }
                } catch (e) {
                    console.error(e);
                }
            }

            if (this.id && this.type !== "characteristic" && this.baseInfo?.type?.includes("characteristic")) {
                const activeEffect =
                    this.effects.find((ae) => ae.system.XMLID === this.system.XMLID) ??
                    this.effects.find((ae) => !ae.system.XMLID) ??
                    {};
                const value = this.system.LEVELS;
                activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} +${value}`;
                activeEffect.img = "icons/svg/upgrade.svg";
                activeEffect.description = this.system.description;
                activeEffect.changes = [
                    {
                        key: `system.characteristics.${this.system.XMLID.toLowerCase()}.max`,
                        value: value,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ];
                activeEffect.transfer = true;
                activeEffect.disabled ??= !this.system.active;
                activeEffect.system ??= { XMLID: this.system.XMLID };

                if (activeEffect.update) {
                    const oldMax = this.actor.system.characteristics[this.system.XMLID.toLowerCase()].max;
                    await activeEffect.update({
                        name: activeEffect.name,
                        changes: activeEffect.changes,
                    });
                    const deltaMax = this.actor.system.characteristics[this.system.XMLID.toLowerCase()].max - oldMax;
                    const newValue =
                        this.actor.system.characteristics[this.system.XMLID.toLowerCase()].value + deltaMax;
                    if (this.actor.system.characteristics[this.system.XMLID.toLowerCase()].value !== newValue) {
                        await this.actor.update({
                            [`system.characteristics.${this.system.XMLID.toLowerCase()}.value`]: newValue,
                        });
                    }
                } else {
                    await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
                }
            }

            if (this.id && this.system.XMLID === "DENSITYINCREASE") {
                const noStrIncrease = this.modifiers.find((mod) => mod.XMLID === "NOSTRINCREASE");
                const noDefIncrease = this.modifiers.find((mod) => mod.XMLID === "NODEFINCREASE");
                // NODEFINCREASE allows for ED, PD, or EDPD as option.
                const noDefIncreasePd = noDefIncrease?.OPTIONID.includes("PD");
                const noDefIncreaseEd = noDefIncrease?.OPTIONID.includes("ED");

                const strAdd = noStrIncrease ? 0 : this.system.LEVELS * 5;
                const pdAdd = noDefIncreasePd ? 0 : this.system.LEVELS;
                const edAdd = noDefIncreaseEd ? 0 : this.system.LEVELS;

                const activeEffect =
                    this.effects.find((ae) => ae.system.XMLID === this.system.XMLID) ??
                    this.effects.find((ae) => !ae.system.XMLID) ??
                    {};
                activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} ${this.system.LEVELS}`;
                activeEffect.img = "icons/svg/upgrade.svg";
                activeEffect.changes = [
                    {
                        key: "system.characteristics.str.max",
                        value: strAdd,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.pd.max",
                        value: pdAdd,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.ed.max",
                        value: edAdd,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ];
                activeEffect.transfer = true;
                activeEffect.disabled ??= !this.system.active;
                activeEffect.system ??= { XMLID: this.system.XMLID };

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

            // Generic activeEffect (preferred; so far just GROWTH, 5e COMBAT_LEVELS)
            if (this.baseInfo?.activeEffect) {
                const activeEffect = this.baseInfo?.activeEffect(this);
                if (activeEffect) {
                    const currentAE =
                        this.effects.find((ae) => ae.system.XMLID === this.system.XMLID) ??
                        this.effects.find((ae) => !ae.system.XMLID) ??
                        {};
                    if (currentAE) {
                        if (currentAE.update) {
                            await currentAE.update({
                                name: activeEffect.name,
                                changes: activeEffect.changes,
                            });
                        } else {
                            await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
                        }
                    }
                }
            }

            // 6e Shrinking (1 m tall, 12.5 kg mass, -2 PER Rolls to perceive character, +2 DCV, takes +6m KB)
            // 5e Shrinking (1 m tall, 12.5 kg mass, -2 PER Rolls to perceive character, +2 DCV)
            if (this.id && this.system.XMLID === "SHRINKING") {
                const dcvAdd = Math.floor(this.system.LEVELS) * 2;

                const activeEffect =
                    this.effects.find((ae) => ae.system.XMLID === this.system.XMLID) ??
                    this.effects.find((ae) => !ae.system.XMLID) ??
                    {};
                activeEffect.name = (this.name ? `${this.name}: ` : "") + `${this.system.XMLID} ${this.system.value}`;
                activeEffect.img = "icons/svg/upgrade.svg";
                activeEffect.changes = [
                    {
                        key: "system.characteristics.dcv.max",
                        value: dcvAdd,
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ];
                activeEffect.transfer = true;
                activeEffect.system ??= { XMLID: this.system.XMLID };

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

            const hasDCV = this.actor.hasCharacteristic("DCV");
            const MOBILITY = this.findModsByXmlid("MOBILITY");
            if (this.id && MOBILITY && hasDCV) {
                const dcvValue = MOBILITY.OPTIONID === "BULKY" ? 0.5 : MOBILITY.OPTIONID === "IMMOBILE" ? 0 : null;

                const activeEffect =
                    this.effects.find((ae) => ae.system.XMLID === "MOBILITY") ??
                    this.effects.find((ae) => !ae.system.XMLID) ??
                    {};
                if (dcvValue !== null) {
                    activeEffect.name =
                        (this.name ? `${this.name}/${MOBILITY.parent.name || MOBILITY.parent.ALIAS}: ` : "") +
                        `${MOBILITY.OPTIONID} ${dcvValue}`;
                    activeEffect.img = "icons/svg/downgrade.svg";
                    activeEffect.changes = [
                        {
                            key: "system.characteristics.dcv.max",
                            value: dcvValue,
                            mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY,
                            priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.MULTIPLY,
                        },
                    ];
                    activeEffect.transfer = true;
                    activeEffect.disabled = !this.system.active;
                    activeEffect.system ??= {
                        XMLID: "MOBILITY",
                    };

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

                // REF: https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
                function generateUniqueLightColor(alphaSeed) {
                    function splitmix32(a) {
                        return function () {
                            a |= 0;
                            a = (a + 0x9e3779b9) | 0;
                            let t = a ^ (a >>> 16);
                            t = Math.imul(t, 0x21f0aaad);
                            t = t ^ (t >>> 15);
                            t = Math.imul(t, 0x735a2d97);
                            return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
                        };
                    }

                    function sumAsciiCodes(str) {
                        let sum = 0;
                        // Iterate through each character in the string
                        for (let i = 0; i < str.length; i++) {
                            // Use charCodeAt(i) to get the code of the character at index i
                            sum += str.charCodeAt(i);
                        }
                        return sum;
                    }

                    const numericSeed = sumAsciiCodes(alphaSeed);

                    const prng = splitmix32(numericSeed);

                    // Define a minimum value (e.g., 200) to ensure the color is light/whiteish
                    const min = 0;
                    // Max value is 255
                    const max = 50;

                    // Generate random values for R, G, and B within the desired range
                    const r = Math.floor(prng() * (max - min + 1)) + min;
                    const g = Math.floor(prng() * (max - min + 1)) + min;
                    const b = Math.floor(prng() * (max - min + 1)) + min;

                    // return Hex string color
                    return (
                        r.toString(16).padStart(2, 0) + g.toString(16).padStart(2, 0) + b.toString(16).padStart(2, 0)
                    );
                }

                const activeEffect =
                    this.effects.find((ae) => ae.system.XMLID === this.system.XMLID) ??
                    this.effects.find((ae) => !ae.system.XMLID) ??
                    {};

                activeEffect.name = (this.name ? `${this.name}: ` : "") + `LIGHT ${this.system.QUANTITY}`;
                activeEffect.img = "icons/svg/light.svg";
                activeEffect.changes = [
                    {
                        key: "ATL.light.bright",
                        value: parseFloat(this.system.QUANTITY),
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                    {
                        key: "ATL.light.color",
                        value: generateUniqueLightColor(this.uuid),
                        mode: CONFIG.HERO.ACTIVE_EFFECT_MODES.OVERRIDE,
                        priority: CONFIG.HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE,
                    },
                ];
                activeEffect.system ??= { XMLID: this.system.XMLID };
                activeEffect.disabled ??= true;

                if (activeEffect.update) {
                    await activeEffect.update({
                        name: activeEffect.name,
                        changes: activeEffect.changes,
                    });
                } else {
                    await this.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
                }
            }

            // Generic default toggle to on (if it doesn't use charges or END or part of multipower)
            if (
                this.isActivatable() &&
                this.system.active === undefined &&
                this.system.chargesMax > 0 &&
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

            // Sanity check for duplicate effects
            for (const ae1 of this.effects) {
                if (
                    this.effects.find(
                        (ae2) => ae1.system.XMLID && ae1.system.XMLID === ae2.system.XMLID && ae1.id !== ae2.id,
                    )
                ) {
                    console.error(`Duplicate ${ae1.system.XMLID} effects on ${this.name}`);
                }
            }
        } catch (e) {
            console.error(e, this);
            throw e;
        }
    }

    get heroValidation() {
        const _heroValidations = [];

        if (this.baseInfo) {
            if (this.baseInfo.heroValidation) {
                const v = this.baseInfo.heroValidation(this);
                if (v) {
                    _heroValidations.push(...v.map((m) => ({ ...m, itemId: this.id })));
                }

                for (const modifier of this.modifiers.filter((m) => m.baseInfo?.heroValidation)) {
                    const v2 = modifier.baseInfo.heroValidation(modifier);
                    _heroValidations.push(...v2.map((m) => ({ ...m, itemId: this.id })));
                }
            }
        } else {
            _heroValidations.push({
                property: "XMLID",
                message: `${this.detailedName()} does not appear to be a proper ${this.is5e ? `5e` : `6e`} ${this.type}`,
                severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
            });
        }

        // if (this.actor?.system.is5e !== this.system.is5e) {
        //     _heroValidations.push({
        //         property: "XMLID",
        //         message: `${this.system.XMLID} is ${this.system.is5e ? `5e` : `6e`} yet actor is ${this.actor.system.is5e ? `5e` : `6e`}`,
        //         severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
        //     });
        // }

        function invalidAdjustmentMessageBasedOnInput(item) {
            switch (item.system.XMLID) {
                case "TRANSFER":
                    return `Expecting characteristic abbreviations or power names connected by " -> ", " to ", or " TO "`;
                case "HEALING":
                    return `Expecting characteristic abbreviations separated by commas. SIMPLIFIED is also valid.`;
                default:
                    return `Expecting characteristic abbreviations or power names separated by commas.`;
            }
        }

        function invalidAdjustmentExampleBasedOnInput(item) {
            switch (item.system.XMLID) {
                case "TRANSFER":
                    return `STR, CON -> STR, CON`;
                default:
                    return `STR, CON`;
            }
        }

        // Adjustment Powers
        if (this.isAdjustment) {
            const result = this.splitAdjustmentSourceAndTarget();
            if (!result.valid) {
                _heroValidations.push({
                    property: "INPUT",
                    message: invalidAdjustmentMessageBasedOnInput(this),
                    example: invalidAdjustmentExampleBasedOnInput(this),
                    severity: CONFIG.HERO.VALIDATION_SEVERITY.WARNING,
                });
            } else {
                const maxAllowedEffects = this.numberOfSimultaneousAdjustmentEffects();
                if (
                    result.reducesArray.length > maxAllowedEffects.maxReduces ||
                    result.enhancesArray.length > maxAllowedEffects.maxEnhances
                ) {
                    _heroValidations.push({
                        property: "INPUT",
                        message: `Has too many adjustment targets defined`,
                        severity: CONFIG.HERO.VALIDATION_SEVERITY.INFO,
                    });
                }
            }
        }

        const e = this.system.debugModelProps();
        if (e) {
            _heroValidations.push({
                //property:
                message: `PLEASE REPORT THIS ERROR: ${e}`,
                severity: CONFIG.HERO.VALIDATION_SEVERITY.ERROR,
                itemId: this.id,
            });
        }

        return _heroValidations;
    }

    get validationCss() {
        function getKeyByValue(object, value) {
            return Object.keys(object).find((key) => object[key] === value);
        }
        const severityMax = Math.max(0, ...this.heroValidation.map((m) => m.severity ?? 0));

        if (severityMax > 0) {
            return `validation validation-${getKeyByValue(CONFIG.HERO.VALIDATION_SEVERITY, severityMax).toLocaleLowerCase()}`;
        }

        return "";
    }

    get validationTooltip() {
        return this.heroValidation.map((m) => m.message).join(", ");
    }

    setCarried() {
        if (this.system.CARRIED && this.system.active === undefined && this.end === 0) {
            this.system.active ??= true;
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

    get basePointsPlusAdders() {
        return this._basePoints + this._addersCost;
    }

    // Pre-process an update operation for a single Document instance. Pre-operation events only occur for the client
    // which requested the operation.
    async _preUpdate(changes, options, user) {
        // CSLs have multiple fields which are linked. Do that linking.
        if (this.isCsl) {
            // Reinitialize CSLs if their LEVELS have changed
            if (changes.system?.LEVELS != null && changes.system?.LEVELS !== this.system?.LEVELS) {
                const reinitializationChanges = this.initializeCsl(changes.system.LEVELS);
                foundry.utils.mergeObject(changes, reinitializationChanges);
            }

            // Update CSLs if their ADDER array has changed (in any way)
            if (changes.system?.ADDER != null) {
                const relinkChanges = this.linkBasedOnCustomAdders(changes.system.ADDER, this.actor?.cslItems || []);
                foundry.utils.mergeObject(changes, relinkChanges);
            }
        }

        // PSLs have multiple fields which are linked. Do that linking.
        if (this.isPsl) {
            // Update PSLs if their ADDER array has changed (in any way)
            if (changes.system?.ADDER != null) {
                const relinkChanges = this.linkBasedOnCustomAdders(changes.system.ADDER, this.actor?.pslItems || []);
                foundry.utils.mergeObject(changes, relinkChanges);
            }
        }

        await super._preUpdate(changes, options, user);
    }

    async _onUpdate(changed, options, userId) {
        // We favor effect.disabled over system.active (in fact shouldn't be changing system.active)
        if (this.effect && changed.system.active !== undefined) {
            console.error(`We are updating system.active instead of the effect.disabled`);
        }

        await super._onUpdate(changed, options, userId);

        if (!this.isOwner) {
            //console.log(`Skipping _onUpdate because this client is not an owner of ${this.actor.name}:${this.name}`);
            return;
        }

        if (game.userId !== userId) {
            console.log(`Skipping ${this.name} _onUpdate for user ${userId}`);
            return;
        }

        await this.setActiveEffects(options);

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
        // Reset charges
        const chargeItemModifier = this.system.chargeItemModifier;
        if (chargeItemModifier) {
            if (this.system.numCharges < this.system.chargesMax) {
                await this.system.setChargesAndSave(this.system.chargesMax);
            }

            if (chargeItemModifier.CLIPS && this.system.clips !== this.system.clipsMax - 1) {
                // Resetting to full charges requires the use of 1 clip
                await this.system.setClipsAndSave(this.system.clipsMax - 1);
            }

            if (this.isActive) {
                await this.toggle();
            }
        }

        if (this.isAblativeDefense) {
            await this.resetAblativeDefense();
        }

        if (this.system.XMLID === "ENDURANCERESERVE" && this.system.value !== this.system.LEVELS) {
            await this.update({
                ["system.value"]: this.system.LEVELS,
            });
        }

        if (this.isCsl) {
            const cslChanges = this.initializeCsl(this.system.LEVELS);
            await this.update(cslChanges);
        }

        // turn off items that use END, Charges, MP, etc

        if (!this.isCombatManeuver) {
            if (
                (this.end > 0 && this.system.XMLID !== "STR") ||
                (this.system.chargeItemModifier && this.parentItem?.system.XMLID !== "MULTIPOWER")
            ) {
                if (this.isActivatable()) {
                    if (this.isActive) {
                        // Was calling this.toggle(), but was slow and showed extra chatMessages during upload
                        await this.update({ "system.active": false });
                        for (const ae of this.effects) {
                            await ae.update({ disabled: true });
                        }
                    }
                }
            }
        }

        if (this.isCombatManeuver && this.system.active) {
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
        if (this.baseInfo?.behaviors.includes("to-hit")) return true;
        if (this.baseInfo?.behaviors.includes("success")) return true;
        return false;
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

    async roll(options = {}) {
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
                    return collectActionDataBeforeToHitOptions(this, options);

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
                    return collectActionDataBeforeToHitOptions(this, options);
            }
        } else if (this.baseInfo.behaviors.includes("dice")) {
            switch (this.system.XMLID) {
                case "LUCK":
                    return rollLuck(this);

                case "UNLUCK":
                    return rollUnluck(this);

                case "DEPENDENCE":
                case "SUSCEPTIBILITY":
                default:
                    ui.notifications.warn(`${this.system.XMLID} effect roll is not fully supported`);
                    return rollEffect(this);
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
                if (!(await rollRequiresASkillRollCheck(this))) {
                    return;
                }

                return createSkillPopOutFromItem(this, this.actor);
            } else if (hasSuccessRoll) {
                // Handle any type of non skill based success roll with a basic roll
                // TODO: Basic roll.
                return createSkillPopOutFromItem(this, this.actor);
            } else {
                ui.notifications.warn(
                    `${this.actor.name}: ${this.name} roll (${hasSuccessRoll}/${isSkill}) is not supported`,
                );
            }
        }
    }

    async chat() {
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
        if (typeof this.baseInfo?.rangeText === "function") {
            content += ` ${this.baseInfo.rangeText(this)}${getSystemDisplayUnits(this.is5e)}.`;
        } else if (!["MULTIPOWER", "COMPOUNDPOWER", "LIST"].includes(this.system.XMLID)) {
            const itemRange = this.system.range;
            switch (itemRange) {
                case CONFIG.HERO.RANGE_TYPES.SELF: {
                    if (!this.baseInfo?.type.includes("skill")) {
                        content += " Self.";
                    }

                    break;
                }

                case CONFIG.HERO.RANGE_TYPES.NO_RANGE:
                    content += " No Range.";
                    break;

                case CONFIG.HERO.RANGE_TYPES.LIMITED_RANGE:
                    {
                        const range = getRoundedUpDistanceInSystemUnits(
                            this.basePointsPlusAdders * 10,
                            this.actor?.system?.is5e,
                        );
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
                        const range = getRoundedUpDistanceInSystemUnits(
                            this.basePointsPlusAdders * 10,
                            this.actor?.system?.is5e,
                        );
                        content += ` Maximum Range ${range}${getSystemDisplayUnits(this.is5e)}.`;
                    }
                    break;

                case CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT:
                    content += " Line of Sight.";
                    break;

                default:
                    console.error("Unhandled range", this.baseInfo);
                    if (itemRange?.toLowerCase()) {
                        content += ` ${itemRange.toLowerCase()}`;
                    }
                    break;
            }
        }

        // Perceivability
        if (this.baseInfo.perceivability) {
            content += ` Perceivability: ${this.baseInfo.perceivability}.`;
        }

        // Duration
        content += ` Duration: ${this.system.duration}.`;

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

    async turnOn(options = {}) {
        if (!options.token && this.actor?.getActiveTokens().length > 0) {
            console.error(`turnOn: missing token`);
        }

        const item = this;

        // Make sure activeEffects are properly defined
        await this.setActiveEffects(options);

        // If this is a constant power where to show the "to-hit" then don't bother spending
        // resources or checking for requires a roll.
        // Also don't check VPP as we use "carried" to determine if we can toggle/roll.
        if (
            item.system.duration === CONFIG.HERO.DURATION_TYPES.CONSTANT &&
            item.baseInfo.behaviors.includes("to-hit")
        ) {
            await this.setActive(true);

            const speaker = ChatMessage.getSpeaker({ actor: item.actor });
            speaker["alias"] = item.actor.name;

            const chatData = {
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                content: `Turned on ${item.name}. Will consume resources on each phase.`,
                whisper: whisperUserTargetsForActor(item.actor),
                speaker,
            };
            await ChatMessage.create(chatData);
            return;
        }

        if (item.isActive) {
            console.warn(`${item.name} is already on`);
            return;
        }

        if (!this.actor.canAct(true, options.event)) {
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
            // TODO: confirm VPP costs
            // const currentPool = VPP.childItems
            //     .filter((i) => i.system.active)
            //     .reduce((accumulator, _item) => accumulator + _item.system.realCost, 0);
            // if (currentPool + parseInt(item.system?.realCost || 0) > parseInt(VPP.system.LEVELS || 0)) {
            //     if (overrideCanAct) {
            //         const token = tokenEducatedGuess({
            //             item: this,
            //         });
            //         const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
            //         //speaker.alias = actor.name;
            //         const chatData = {
            //             style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            //             author: game.user._id,
            //             content: `Unable to activate ${item.name} because it would exceed the ${VPP.name} active point pool of ${VPP.system.LEVELS}RC.`,
            //             speaker: speaker,
            //             whisper: whisperUserTargetsForActor(this.actor),
            //         };
            //         await ChatMessage.create(chatData);
            //     } else {
            //         const token = tokenEducatedGuess({
            //             item: this,
            //         });
            //         const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
            //         const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
            //         const chatData = {
            //             style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            //             author: game.user._id,
            //             content:
            //                 `Unable to activate ${item.name} because it would exceed the ${VPP.name} pool of ${VPP.system.LEVELS}RC.` +
            //                 `Use ${overrideKeyText} to override.` +
            //                 `<ul>${VPP.childItems
            //                     .filter((i) => i.system.active)
            //                     .map((item) => `<li>${parseInt(item.system?.realCost || 0)}RC: ${item.name}</li>`)
            //                     .join("")}</ul>` +
            //                 `<hr>${parseInt(item.system?.realCost || 0)}RC: ${item.name}`,
            //             speaker: speaker,
            //             whisper: whisperUserTargetsForActor(this.actor),
            //         };
            //         await ChatMessage.create(chatData);
            //         console.log(item, VPP, currentPool);
            //         return ui.notifications.error(
            //             `Unable to activate ${item.name} because it would exceed the ${VPP.name} pool of ${VPP.system.LEVELS}RC.`,
            //         );
            //     }
            // }
            // PH: FIXME: This check is wrong for 5e where the pool cost determines the max AP
            //const controlCost = parseInt(VPP.findModsByXmlid("CONTROLCOST")?.LEVELS || 0);
            // if (!item.is5e && parseInt(item.system?.activePoints || 0) > controlCost) {
            //     console.log(item, VPP, controlCost);
            //     if (overrideCanAct) {
            //         const token = tokenEducatedGuess({
            //             item: this,
            //         });
            //         const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
            //         //speaker.alias = actor.name;
            //         const chatData = {
            //             style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            //             author: game.user._id,
            //             content: `${item.name} was activated even though it exceed the ${VPP.name} control cost`,
            //             speaker: speaker,
            //             whisper: whisperUserTargetsForActor(this.actor),
            //         };
            //         await ChatMessage.create(chatData);
            //     } else {
            //         const token = tokenEducatedGuess({
            //             item: this,
            //         });
            //         const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
            //         const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;
            //         //speaker.alias = actor.name;
            //         const chatData = {
            //             style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            //             author: game.user._id,
            //             content:
            //                 `Unable to activate ${item.name} because it would exceed the ${VPP.name} control cost of ${controlCost}AP. ` +
            //                 `Use ${overrideKeyText} to override.`,
            //             speaker: speaker,
            //             whisper: whisperUserTargetsForActor(this.actor),
            //         };
            //         await ChatMessage.create(chatData);
            //         return ui.notifications.error(
            //             `Unable to activate ${item.name} because it would exceed the ${VPP.name} control cost of ${controlCost}AP.`,
            //         );
            //     }
            // }
        }

        const speaker = ChatMessage.getSpeaker({
            actor: item.actor,
            token: options.token,
        });

        const success = await rollRequiresASkillRollCheck(this, options.event);
        if (!success) {
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
        // if (this.system.XMLID === "INVISIBILITY") {
        //     // Invisibility status effect for SIGHTGROUP?
        //     if (this.system.OPTIONID === "SIGHTGROUP" && !this.actor.statuses.has("invisible")) {
        //         await this.actor.toggleStatusEffect(
        //             HeroSystem6eActorActiveEffects.statusEffectsObj.invisibleEffect.id,
        //             {
        //                 active: true,
        //             },
        //         );
        //     }
        // } else if (this.system.XMLID === "FLIGHT" || this.system.XMLID === "GLIDING") {
        //     await this.actor.toggleStatusEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.flyingEffect.id, {
        //         active: true,
        //     });
        // } else if (this.system.XMLID === "DESOLIDIFICATION") {
        //     await this.actor.toggleStatusEffect(
        //         HeroSystem6eActorActiveEffects.statusEffectsObj.desolidificationEffect.id,
        //         {
        //             active: true,
        //         },
        //     );
        // } else
        //
        if (["maneuver", "martialart"].includes(item.type)) {
            await activateManeuver(this);
        }

        await this.setActive(true);
    }

    async turnOff(options = {}) {
        if (!options.token && this.actor?.getActiveTokens().length > 0) {
            console.error(`turnOff: missing token`);
        }

        const item = this;

        if (!this.isActive) {
            console.warn(`${item.detailedName()} is already off`);
            return;
        }

        if (!this.isActivatable()) {
            console.warn(`${item.detailedName()} is not activatable, probably shouldn't be calling toggleOff`);
        }

        if (!options.silent) {
            // Let GM know power was deactivated
            const speaker = ChatMessage.getSpeaker({
                actor: item.actor,
                token: options.token,
            });
            const chatData = {
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                content: `Turned off ${item.name}`,
                whisper: whisperUserTargetsForActor(item.actor),
                speaker,
            };
            await ChatMessage.create(chatData);
        }

        await this.setActive(false);
    }

    async setActive(value) {
        if (this.effects.size > 0) {
            // Make sure ActiveEffects are current
            await this.setActiveEffects();
            // multiple ActiveEffects on an item are possible such as FLIGHT with BULKY FOCUS
            const changes = [];
            for (const ae of this.effects) {
                changes.push({ _id: ae.id, disabled: !value });
            }
            await this.updateEmbeddedDocuments("ActiveEffect", changes);
            if (this.effects.contents[0].disabled === value) {
                console.error(`${this.name} failed to update (async?).`);
            }
            return;
        }
        return this.update({ "system.active": value });
    }

    /**
     *
     * @param {Event} [event]
     * @returns {Promise<undefined>}
     */
    async toggle(options = {}) {
        let item = this;

        if (!item.isActive) {
            await this.turnOn(options);
        } else {
            await this.turnOff(options);
        }

        switch (this.type) {
            case "martialart":
            case "maneuver":
                await enforceManeuverLimits(this.actor, this);
                break;
        }

        // Generic set VALUE = MAX
        if (this.actor && game.actors.get(this.actor.id)) {
            for (const activeEffect of this.transferredEffects) {
                for (const change of activeEffect.changes) {
                    const maxValue = foundry.utils.getProperty(this.actor, change.key);
                    if (maxValue == undefined) {
                        console.error(`${change.key} is ${maxValue}`);
                        continue;
                    }
                    await this.actor.update({
                        [change.key.replace(".max", ".value")]: maxValue || 0,
                    });
                }
            }
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

    get isAblativeDefense() {
        return !!this.findModsByXmlid("ABLATIVE");
    }

    /**
     * Only valid if called on an ablative defense.
     *
     * @returns {string} - BODYONLY or BODYORSTUN
     */
    get ablativeType() {
        return this.findModsByXmlid("ABLATIVE").OPTIONID;
    }

    async resetAblativeDefense() {
        return this.update({
            "system.ablative": 0,
        });
    }

    get showClipsReload() {
        // Some things like maneuvers don't typically have CLIPS
        return this.system.chargeModifier?.CLIPS;
    }

    /**
     *
     * @returns {Promise<undefined>}
     */
    async changeClips(options = {}) {
        if (!options.token) {
            console.error("changeClips: unable to locate token");
        }
        const token = options.token ?? tokenEducatedGuess({ item: this });

        const chargeModifier = this.system.chargeModifier;
        if (!chargeModifier) {
            return ui.notifications.error(
                `${this.detailedName()} does not use charges so does not have clips. Please report.`,
            );
        } else if (!chargeModifier.CLIPS) {
            return ui.notifications.warn(`${this.detailedName()} does not use clips. Please report.`);
        } else if (this.system.clips < 1) {
            return ui.notifications.error(`${this.detailedName()} does not have 1 clip remaining.`);
        }

        // Reload the clip to 1 less clip that should be at full charges.
        const previousCharges = this.system.numCharges;
        await this.system.setChargesAndSave(this.system.chargesMax);
        await this.system.setClipsAndSave(this.system.clips - 1);

        const chatData = {
            author: game.user._id,
            speaker: ChatMessage.getSpeaker({ token: token, actor: this.actor }),
            style: CONST.CHAT_MESSAGE_STYLES.IC,
            content: `Change clips on <b>${this.name}</b>. ${(token ?? this.actor).name} drops the clip with ${previousCharges} charges. Reloading with a new clip with ${this.system.numCharges} charges. ${this.system.clips} clip(s) remain.`,
            whisper: whisperUserTargetsForActor(this.actor),
        };
        await ChatMessage.create(chatData);
    }

    async changeVpp(options = {}) {
        await ItemVppConfig.create({ item: this, token: options.token, tokenUuid: options.token?.uuid });
    }

    isPerceivable(perceptionSuccess) {
        if (["NAKEDMODIFIER", "LIST", "COMPOUNDPOWER"].includes(this.system.XMLID)) {
            return false;
        }

        if (this.system.XMLID.startsWith("__")) {
            return false;
        }

        // Power must be turned on
        if (this.baseInfo?.behaviors.includes("activatable") && !this.isActive) {
            return false;
        }

        // FOCUS
        const FOCUS = this.findModsByXmlid("FOCUS");
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

        if (this.system.duration === CONFIG.HERO.DURATION_TYPES.INSTANT) {
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

    findModByHcdId(id, xmlid) {
        for (const key of HeroSystem6eItem.ItemXmlChildTags) {
            if (this.system?.[key]) {
                // Intentionally using == here to take advantage of string/int equality
                const value = this.system[key].find((o) => o.ID == id);
                if (value) {
                    return value;
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
        return null;
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

    get baseInfo() {
        return this.system.baseInfo;
    }

    get is5e() {
        // If item has undefined is5e use actor.is5e
        if (this.actor && !this.system.is5e && this.system.is5e !== false) {
            console.warn(
                `${this.actor?.name}/${this.detailedName()} has is5e=${this.system.is5e} does not match actor=${this.actor?.system.is5e}`,
                this,
            );
            return this.actor?.is5e;
        }

        if (this.actor && this.actor?.is5e !== this.system.is5e) {
            console.error(
                `${this.actor?.name}/${this.detailedName()} has is5e=${this.system.is5e} does not match actor=${this.actor?.system.is5e}`,
                this,
            );
        }

        return this.system.is5e;
    }

    get aoeAttackParameters() {
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
                            levels = roundFavorPlayerAwayFromZero(1 + activePointsWithoutAoeAdvantage / 5);
                            break;

                        case "HEX":
                            levels = 1;
                            break;

                        case "LINE":
                            levels = roundFavorPlayerAwayFromZero((2 * activePointsWithoutAoeAdvantage) / 5);
                            break;

                        case "ANY":
                        case "RADIUS":
                            levels = Math.max(1, roundFavorPlayerAwayFromZero(activePointsWithoutAoeAdvantage / 10));
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

            const results = {
                ...aoeModifier,
                ...newAoe,
            };

            results.shortDesc = `${results.type} (${results.value}${results.isExplosion ? "e" : ""})`;

            return results;
        }
        return null;
    }

    /**
     * If activatable return true otherwise it is a damage maneuver and return false.
     * @returns boolean
     */
    isActivatableManeuver() {
        // FIXME: This is not stand alone, it only handles specific cases. Should default to false like isActivatable()
        // and handle any item.

        // Hero designer has a few ways of marking things as doing damage. For the prebuilt ones you can't look at DAMAGETYPE as it's always "0" even
        // for things like a Flying Dodge. So, we make our decision based on the EFFECT/WEAPONEFFECT. This means that custom maneuvers need to have the
        // correct EFFECT or WEAPONEFFECT specified for things to work.
        // NOTE: Doesn't appear that there is a [WEAPONNNDDC] or [WEAPONFLASHDC] but we're going to add it just in case
        const effect = getManeuverEffect(this);

        // Weapon Elements and anything without item.system.EFFECT
        if (!effect) {
            return false;
        }

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
        //TODO: If ALWAYSON then not isActivable, or at least grey out box to do so.  Perpahs make it so you can't turnOff in code too.

        if (this.baseInfo?.behaviors?.includes("activatable")) {
            return true;
        }

        if (this.type === "characteristic") {
            return false;
        }

        const itemEffects = this.effects.find((ae) => ae.flags[game.system.id]?.type !== "adjustment");
        if (itemEffects && !["martialart", "maneuver"].includes(this.type)) {
            return true;
        }

        // NOTE: item._id can be null in the case of a temporary/effective item.
        if (this.actor) {
            const actorEffects = this.actor.effects.find((o) => o.origin === this.actor.items.get(this._id)?.uuid);
            if (actorEffects) {
                return true;
            }
        } else {
            console.error(`${this.name} has no actor`);
        }

        // Careful isActivatableManeuver doesn't stand alone, it only handles specific cases.
        if (this.system.XMLID === "MANEUVER" && this.isActivatableManeuver()) {
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

        // Characteristics can be turned on or off
        if (this.baseInfo?.type.includes("characteristic")) {
            return true;
        }

        // persistent duration
        if (this.system.duration === CONFIG.HERO.DURATION_TYPES.PERSISTENT) {
            return true;
        }

        return false;
    }

    _postUploadDetails() {
        // TODO: Should move most of this stuff into prepareData
        const item = this;

        // Make sure we have an actor (like when creating compendiums)
        if (!item.actor) {
            return;
        }

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

    get attacksWith() {
        console.error(`Deprecated`);
        return this.system.attacksWith;
    }

    get defendsWith() {
        console.error(`Deprecated`);
        return this.system.defendsWith;
    }

    get css() {
        // css for actor-sheet-v2 item-row
        const row = [];

        // css for actor-sheet-v2 item-description
        const description = [];
        if (this.parentItem?.system.XMLID === "VPP") {
            if (this.vppUnSlotted) {
                description.push("vpp-unslotted");
            }
        }

        return { row: row.join(" "), description: description.join(" ") };
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

    get childDepth() {
        if (this.parentItem) {
            return this.parentItem.childDepth + 1;
        }
        return 0;
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

    get modifiers() {
        let _modifiers = [...(this.system.MODIFIER || [])];

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
                        //console.debug("Keeping child modifier instead of parent", pMod, mod);
                    }
                }
            }
        }
        return _modifiers;
    }

    get advantages() {
        return this.modifiers.filter((o) => o.cost >= 0);
    }

    get limitations() {
        return this.modifiers.filter((o) => o.cost < 0);
    }

    get adders() {
        return this.system?.ADDER || [];
    }

    get powers() {
        return this.system.POWER || [];
    }

    get vppPoolPoints() {
        // The Pool costs indicates the total amount of Real
        // Points’ worth of powers and abilities the character
        // can create with his VPP at any one time.
        if (this.system.XMLID !== "VPP") {
            console.error(`${this.name} is not a VPP`, this);
            return 0;
        }

        return this.system.LEVELS;
    }

    get vppControlPoints() {
        // No power in a VPP can have an Active
        // Point cost greater than the Control Cost.
        if (this.system.XMLID !== "VPP") {
            console.error(`${this.name} is not a VPP`, this);
            return 0;
        }

        // 6e has a CONTROLCOST adder; 5e is half of pool
        return this.findModsByXmlid("CONTROLCOST")?.LEVELS || roundFavorPlayerTowardsZero(this.system.LEVELS / 2);
    }

    get vppSlotted() {
        if (this.system.XMLID !== "VPP") {
            console.error(`${this.name} is not a VPP`, this);
            return false;
        }

        return this.system.CARRIED;
    }

    // used in HBS
    get vppUnSlotted() {
        try {
            if (this.parentItem?.system.XMLID === "VPP" && !this.system.CARRIED) {
                return true;
            }

            if (this.parentItem?.parentItem?.system.XMLID === "VPP" && !this.parentItem.system.CARRIED) {
                return true;
            }
        } catch (e) {
            console.error(e);
        }

        return false;
    }

    /**
     * Returns the base cost of an item. It's possible that it costs more beyond there (e.g. STR added etc)
     * @returns number
     */
    getBaseEndCost() {
        const isStrOrStrDamage = this.system.XMLID === "__STRENGTHDAMAGE" || this.system.XMLID === "STR";

        // STR (or any other characteristic only cost end when the native STR is used), PERKS, TALENTS, COMPLICATIONS, and martial maneuvers do not use endurance.
        if (
            !isStrOrStrDamage &&
            ["characteristic", "perk", "talent", "complication", "martialart"].includes(this.type)
        ) {
            return 0;
        }

        // Combat maneuvers cost 1 END
        else if (this.isCombatManeuver) {
            return 1;
        }

        // Everything else is based on 1 END per 10 active points except for strength which is 1 per 5 when using optional heroic rules.
        const endUnitSize = isStrOrStrDamage && game.settings.get(HEROSYS.module, "StrEnd") === "five" ? 5 : 10;

        const activePoints = this.system._active?.originalActivePoints ?? this._activePoints;

        // NOTE: When we push we are altering the actual active points, via LEVELS and modifiers, so we have to back it out.
        const unpushedActivePoints =
            activePoints - (this.system._active?.pushedRealPoints || 0) * (1 + this._limitationCost);
        const endCost = roundFavorPlayerTowardsZero(unpushedActivePoints / endUnitSize);

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
                {
                    let mdBonusFor5e = 0;
                    if (this.actor.is5e) {
                        mdBonusFor5e = roundFavorPlayerAwayFromZero(
                            parseInt(this.actor.system.characteristics.ego?.value) / 5 || 0,
                        );
                    }
                    description = `${system.ALIAS} ${system.LEVELS + mdBonusFor5e} points`;
                }
                break;

            case "POWERDEFENSE":
                description = `${system.ALIAS} ${system.LEVELS} points`;
                break;

            case "FLASHDEFENSE":
                description = `${system.OPTION_ALIAS} ${system.ALIAS} (${system.LEVELS} points)`;
                break;

            case "FOLLOWER":
                description = `${system.ALIAS}`;
                break;

            case "MINDSCAN":
                {
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                    description = `${diceFormula} ${system.ALIAS}`;
                }
                break;

            case "MENTALILLUSIONS":
                {
                    const diceFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                    description = `${system.ALIAS} ${diceFormula} points`;
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
                    if (this.is5e) {
                        description += `(up to ${parseInt(system.LENGTHLEVELS) + 1}" long and ${
                            parseInt(system.HEIGHTLEVELS) + 1
                        }" tall)`;
                    } else {
                        description += `(up to ${parseInt(system.LENGTHLEVELS) + 1}m long, and ${
                            parseInt(system.HEIGHTLEVELS) + 1
                        }m tall, and ${parseFloat(system.WIDTHLEVELS) + 0.5}m thick)`;
                    }
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
            case "FTL":
                {
                    const levels = parseInt(system.LEVELS || 0);
                    let lightYearsPerTimePeriod = ftlLevelsToLightYearsPerYear(levels);
                    let timePeriod;
                    if (lightYearsPerTimePeriod < 12) {
                        timePeriod = "year";
                    } else if (lightYearsPerTimePeriod < 52) {
                        lightYearsPerTimePeriod /= 12;
                        timePeriod = "month";
                    } else if (lightYearsPerTimePeriod < 365) {
                        lightYearsPerTimePeriod /= 52;
                        timePeriod = "week";
                    } else if (lightYearsPerTimePeriod < 365 * 24) {
                        lightYearsPerTimePeriod /= 365;
                        timePeriod = "day";
                    } else if (lightYearsPerTimePeriod < 365 * 24 * 60) {
                        lightYearsPerTimePeriod /= 365 * 24;
                        timePeriod = "hour";
                    } else if (lightYearsPerTimePeriod < 365 * 24 * 60 * 60) {
                        lightYearsPerTimePeriod /= 365 * 24 * 60;
                        timePeriod = "minute";
                    } else {
                        lightYearsPerTimePeriod /= 365 * 24 * 60 * 60;
                        timePeriod = "segment";
                    }

                    // Since it's only an approximation, just show whole numbers.
                    lightYearsPerTimePeriod = roundFavorPlayerAwayFromZero(lightYearsPerTimePeriod);

                    description = `${system.ALIAS} (${lightYearsPerTimePeriod} Light Year(s)/${timePeriod})`;
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
            case "WEAPON_FAMILIARITY":
                // TF:  Custom Adder, Small Motorized Ground Vehicles
                // WF:  Flails
                description = `${system.ALIAS}: `;
                break;

            case "PENALTY_SKILL_LEVELS":
                if (is5e) {
                    description = `${system.ALIAS}: +${system.LEVELS} vs ${system.INPUT} with ${system.OPTION_ALIAS}`;
                } else {
                    description = `+${system.LEVELS} ${system.OPTION_ALIAS}`;
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
                    description += `, ${system.OCV} OCV, ${system.DCV} DCV`;

                    const effectString = getManueverEffectWithPlaceholdersReplaced(this);
                    description += `, ${effectString}`;

                    const maneuverDcs = parseInt(system.DC || 0) + getExtraMartialDcsOrZero(this);
                    description +=
                        isManeuverThatDoesReplaceableDamageType(this) && maneuverDcs
                            ? `, ${maneuverDcs.signedStringHero()} DC`
                            : "";

                    if (isRangedMartialManeuver(this)) {
                        const range = parseInt(system.RANGE || 0);
                        description += `, Range ${range.signedStringHero()}`;
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
                // NOTE: the HD presentation is not good as it can be used for non killing weapons. Show DCs instead.
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
                description = `${system.ALIAS}, ${this.vppPoolPoints} base + ${this.vppControlPoints} control cost`;
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

            case "LACKOFWEAKNESS":
                description = `${system.ALIAS} (-${system.LEVELS}) for ${system.INPUT}`;
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
                const levels = system.LEVELS;
                description = `+${levels}/+${levels}d6 ${system.ALIAS} (${system.OPTION_ALIAS})`;
                break;
            }

            case "CHANGEENVIRONMENT": {
                // 5e includes a radius in the power. 6e requires purchasing it as a modifier.
                const radiusOfEffect = `${this.is5e ? ` ${Math.pow(2, system.LEVELS - 1)}${getSystemDisplayUnits(this.is5e)} radius` : ""}`;
                description = `${system.ALIAS}${radiusOfEffect}`;
                break;
            }

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
                    const _desc = system.OPTION_ALIAS || system.ALIAS || system.EFFECT || this.name || "";
                    description = (system.INPUT ? system.INPUT + " " : "") + _desc;

                    // Provide dice if this is an attack
                    if (this.baseInfo?.behaviors.includes("dice")) {
                        const damageFormula = getEffectFormulaFromItem(this, { ignoreDeadlyBlow: true });
                        if (damageFormula !== "0") {
                            if (description.indexOf(damageFormula) === -1) {
                                description = ` ${damageFormula} ${this.attackDefenseVs || ""}`;
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

                case "LACKOFWEAKNESS":
                    break;

                case "SOCIALLIMITATION":
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

                case "AIR":
                case "BEAMWEAPONS":
                case "COLDWEATHERVEHICLES":
                case "COMMONMARTIAL":
                case "COMMONMELEE":
                case "COMMONMISSILE":
                case "COMMONMOTORIZED":
                case "EARLYFIREARMS":
                case "EMPLACEDWEAPONS":
                case "ENERGYWEAPONS":
                case "MECHA":
                case "MUSCLEPOWEREDGROUNDVEHICLES":
                case "RECREATIONALVEHICLES":
                case "RIDINGANIMALS":
                case "SCIFI":
                case "SIEGEENGINES":
                case "SMALLARMS":
                case "UNCOMMONMARTIAL":
                case "UNCOMMONMELEE":
                case "UNCOMMONMISSILEWEAPONS":
                case "UNCOMMONMODERNWEAPONS":
                case "UNCOMMONMOTORIZEDGROUNDVEHICLES":
                case "WATER":
                    // TODO: This could be more generic, perhapse look for PRIVATE = FALSE

                    // These Transport Familiarity & Weapon Familiarity adders may contain subadders. If they do, then use the subadders
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

                case "OTHER": {
                    // ANIMAL_HANDLER
                    _adderArray.push(`${adder.ALIAS} ${adder.INPUT}`);
                    break;
                }

                default: {
                    const _adder = adder.ALIAS.trim();
                    if (_adder) {
                        _adderArray.push(_adder);
                    }
                    break;
                }
            }
        }

        if (_adderArray.length > 0) {
            switch (powerXmlId) {
                case "ANIMAL_HANDLER":
                    description += ` (${_adderArray.sort().join(", ")})`;
                    break;

                case "WEAPON_FAMILIARITY":
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

            if (this.isAdjustment) {
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
        if (this._activePoints !== this.characterPointCost) {
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

        // VPP show real cost of each child
        if (this.parentItem?.system.XMLID === "VPP") {
            description += ` Real Cost ${this.realCost}`;
        }

        // Cleanup punctuation
        description = (description || "")
            .replace(";,", ";")
            .replace("; ,", ";")
            .replace("; ;", ";")
            .replace(/;$/, "") // Remove ";" at the end of the description string
            .trim();

        // 5 point doubling rule note
        if (system.QUANTITY != null && system.QUANTITY > 1) {
            description += ` (x${system.QUANTITY} number of items)`;
        }

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

                    // Make sure we have the CHARGE modifier for this item,
                    // not one inherited from parent
                    const chargeModifier = item.system.chargeModifier;
                    if (!chargeModifier) {
                        break;
                    }

                    const itemWithChargeModifier = chargeModifier.parent.item;
                    if (!itemWithChargeModifier) {
                        console.error(`Unable to locate itemWithChargeModifier`, this);
                        break;
                    }

                    result += ", ";

                    if (itemWithChargeModifier.system.ID !== this.system.ID) {
                        result += "all slots ";
                    }

                    const chargesMax = itemWithChargeModifier.system.chargesMax;
                    const charges = itemWithChargeModifier.system.numCharges;
                    if (charges !== chargesMax) {
                        result += `${charges}/`;
                    }
                    result += chargesMax;

                    const recoverable = chargeModifier.RECOVERABLE;
                    if (recoverable) {
                        result += ` ${recoverable.ALIAS}`;
                    }

                    const boostable = chargeModifier.BOOSTABLE;
                    if (boostable) {
                        result += ` ${boostable.ALIAS}`;
                    }

                    const continuing = chargeModifier.CONTINUING;
                    if (continuing) {
                        result += ` ${continuing.ALIAS}`;
                    }

                    const fuel = chargeModifier.FUEL;
                    if (fuel) {
                        result += ` ${fuel.ALIAS}`;
                    }

                    result += chargesMax > 1 ? " Charges" : " Charge";

                    if (continuing) {
                        result += " lasting " + continuing.OPTION_ALIAS;
                    }

                    if (chargeModifier.CLIPS) {
                        const clips = itemWithChargeModifier.system.clips;
                        result += `, ${clips} Full clip${clips !== 1 ? "s" : ""} remaining`;
                    }
                }

                break;

            case "FOCUS":
                result += `, ${modifier.OPTION === modifier.OPTION_ALIAS ? `${modifier.OPTION}` : `${modifier.OPTION}/${modifier.OPTION_ALIAS || modifier.OPTIONID}`}`;
                break;

            case "ABLATIVE":
                {
                    const tresholdRoll =
                        this.system.ablative === 0
                            ? "Full Protection"
                            : this.system.ablative > 8
                              ? "No Protection"
                              : `Partial Protection with Activation Roll ${16 - this.system.ablative}-`;
                    result += `, ${modifier.ALIAS} (${tresholdRoll}) ${modifier.OPTION_ALIAS}`;
                }

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
            const areaOfEffect = item.aoeAttackParameters;
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
                    if (modifier.OPTION_ALIAS === "One Hex" && item.aoeAttackParameters.value > 1) {
                        result += "Radius; ";
                    } else if (modifier.OPTION_ALIAS === "Any Area" && !item.actor?.system?.is5e) {
                        result += "2m Areas; ";
                    } else if (modifier.OPTION_ALIAS === "Line") {
                        const width = item.aoeAttackParameters.width;
                        const height = item.aoeAttackParameters.height;

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
                        result += `${shape}; -1 DC/${item.aoeAttackParameters.dcFalloff}"; `;
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

        let BASECOST_total = modifier.BASECOST_total ?? modifier.BASECOST;

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

    getMakeAttack() {
        // AARON: Do we really need makeAttack?
        // Many of these properties can converted into get properties on the item and calculated on the fly.

        const xmlid = this.system.XMLID;
        let usesStrength = this.baseInfo.usesStrength;

        if (usesStrength == null) {
            if (!["maneuver", "martialart"].includes(this.type)) {
                console.warn(`getMakeAttack called on ${this.detailedName()} `);
            }
            usesStrength = false;
        }

        const results = {
            killing: false,
            knockbackMultiplier: 1,
            usesStrength: usesStrength,
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
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "DARKNESS") {
            results.knockbackMultiplier = 0;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "IMAGES") {
            results.knockbackMultiplier = 0;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "EGOATTACK") {
            results.knockbackMultiplier = 0;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.stunonly;
        } else if (
            xmlid === "MINDCONTROL" ||
            xmlid === "MENTALILLUSIONS" ||
            xmlid === "MINDSCAN" ||
            xmlid === "TELEPATHY" ||
            xmlid === "POSSESSION"
        ) {
            results.knockbackMultiplier = 0;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "CHANGEENVIRONMENT") {
            results.knockbackMultiplier = 0;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "FLASH") {
            results.knockbackMultiplier = 0;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        } else if (xmlid === "RKA") {
            results.killing = true;
        } else if (xmlid === "TRANSFORM") {
            results.knockbackMultiplier = 0;
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.effectonly;
        }

        const stunOnly = this.findModsByXmlid("STUNONLY");
        const noStun = this.modifiers.find((m) => m.XMLID === "LIMITEDPOWER" && m.OPTIONID === "NOSTUN");
        const nnd = this.findModsByXmlid("NND");
        const avld = this.findModsByXmlid("AVLD");
        if (stunOnly || nnd || avld) {
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.stunonly;
        }

        const doesBody = this.findModsByXmlid("DOESBODY");
        if (doesBody) {
            // NOTE: Does BODY also includes DOES KB
            results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.stunbody;
            results.knockbackMultiplier = 1;
        }

        if (noStun) {
            switch (results.stunBodyDamage) {
                case CONFIG.HERO.stunBodyDamages.stunbody:
                    results.stunBodyDamage = CONFIG.HERO.stunBodyDamages.bodyonly;
                    break;
                default:
                    console.error(`Unhandled NOSTUN for ${results.stunBodyDamage}`);
            }
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

        // Does Knockback
        const doesKb = this.findModsByXmlid("DOESKB");
        if (doesKb) {
            results.knockbackMultiplier = 1;
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
            results.usesTk = true;
        }

        // Damage effect/type modifiers
        const noStrBonus = this.findModsByXmlid("NOSTRBONUS");
        if (noStrBonus) {
            results.usesStrength = false;
        }

        return results;
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

            // REF: Social complication roll should not include severity #3078
            // const intensity = skillData.ADDER.find((adder) => adder.XMLID === "EFFECTS")?.OPTIONID;
            // let intensityValue = 0;

            // switch (intensity) {
            //     case "MINOR":
            //         intensityValue = 0;
            //         break;
            //     case "MAJOR":
            //         intensityValue = 5;
            //         break;
            //     case "SEVERE":
            //         intensityValue = 10;
            //         break;
            //     default:
            //         console.error(`unknown intensity ${intensity} for SOCIALLIMITATION`);
            // }

            tags.push({
                value: rollValue,
                name: `${occurChance} occurence`,
            });

            // tags.push({
            //     value: intensityValue,
            //     name: `${intensity} intensity`,
            // });

            //roll = `${rollValue + intensityValue}-`;
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
                    if (enhancedPerception.isActive) {
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
        const validList = Object.keys(validator({ actor: this.actor }));

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
            let splitSourcesAndTargets;
            if (!this.system.INPUT) {
                splitSourcesAndTargets = [];
            } else {
                splitSourcesAndTargets = this.system.INPUT.split(" -> ");
                if (splitSourcesAndTargets.length !== 2) {
                    splitSourcesAndTargets = this.system.INPUT.split(/ to /i);
                }
            }

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
            case 0.5:
                return 2;
            case 1.0:
                return 4;
            case 2.0:
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
        if (!this.baseInfo) {
            console.error(`${this?.actor.name}/${this.detailedName()}.baseInfo is missing`);
            return "-";
        }
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
        if (baseAttackItem.isAdjustment) {
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
        if (baseAttackItem.isSenseAffecting) {
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
            ui.notifications.error(
                `${this.detailedName()} has baseItem ${baseAttackItem.detailedName()}. Please report.`,
            );

            return "PD";
        }

        if (this.system.usesStrength) {
            return "PD";
        }

        if (this.system.EFFECT?.includes("[NNDDC]")) {
            return "NND";
        }

        if (this.system.EFFECT?.includes("Strike")) {
            return "PD";
        }

        if (this.system.EFFECT?.includes("WEAPONDC")) {
            return "PD";
        }

        if (this.system.EFFECT?.includes("Block")) {
            return "-";
        }

        if (this.system.EFFECT?.includes("Target Falls")) {
            return "-";
        }

        if (this.system.XMLID === "CHANGEENVIRONMENT") {
            return "-";
        }

        console.warn(`Unable to determine defense for ${this.detailedName()}`);
        return "-"; // Default
    }

    get isContainer() {
        if (this.isSeparator) return false;
        if (this.childItems.length) return true;

        // A backpack from MiscEquipment.hdp is a CUSTOMPOWER
        if (this.system.description.match(/can hold \d+kg/i)) return true;

        return !!this.baseInfo?.isContainer;
    }

    get isSeparator() {
        // It appears that some seperators can have childItems. Not sure why this is the case.
        return this.system.XMLID === "LIST" && this.system.ALIAS.trim() === "" && this.system.NAME === "";
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
        if (this.system?.killing === true) {
            return true;
        }
        if (this.system?.killing === false) {
            return false;
        }

        console.warn(
            `${this.actor.name}: Unable to determine KILLING property for ${this.system.XMLID}/${this.name}, using legacy values.`,
        );

        return false;
    }

    get doesNormalDamage() {
        return (
            !this.isEntangle &&
            !this.isSenseAffecting &&
            !this.isAdjustment &&
            !this.isEffectBased &&
            !this.doesKillingDamage
        );
    }

    get isEntangle() {
        return this.system.XMLID === "ENTANGLE";
    }

    get isTransform() {
        return this.system.XMLID === "TRANSFORM";
    }

    get isAdjustment() {
        return this.baseInfo?.type.includes("adjustment");
    }

    get isBodyBasedEffect() {
        return this.isTransform;
    }

    get isStunBasedEffect() {
        return (
            this.system.XMLID === "MENTALILLUSIONS" ||
            this.system.XMLID === "MINDCONTROL" ||
            this.system.XMLID === "MINDSCAN" ||
            this.system.XMLID === "TELEPATHY"
        );
    }

    get isEffectBased() {
        return this.isBodyBasedEffect || this.isStunBasedEffect;
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

    get showAttack() {
        try {
            if (!this.baseInfo) {
                return false;
            }

            if (this.disabledOIHID) {
                return false;
            }

            if (this.vppUnSlotted) {
                return false;
            }

            if (this.type === "equipment" && this.system.CARRIED !== true) {
                return false;
            }

            if (this.system.XMLID === "STRIKE") {
                return true;
            }

            if (this.isCombatManeuver) {
                return false;
            }

            if (this.system.XMLID === "HANDTOHANDATTACK") {
                // TODO: Collaborate with Peter.
                // Aaron would like to show the HTH attack, but roll as a STRIKE + HTH
                return false;
            }

            if (this.baseInfo.behaviors.includes("attack")) {
                return true;
            }

            if (this.baseInfo.behaviors.includes("to-hit")) {
                return true;
            }
        } catch (e) {
            console.error(e);
        }

        return false;
    }

    get isActive() {
        try {
            if (this.disabledOIHID) return false;
        } catch (e) {
            console.error(e);
        }

        // VPP unslotted
        if (this.vppUnSlotted) {
            return false;
        }

        // Favor disable status of associated ActiveEffect
        if (this.effects.size > 0) {
            const _disabled = this.effects.contents[0].disabled;
            for (const ae of this.effects) {
                if (ae.disabled !== _disabled) {
                    console.error(`ActiveEffect.disabled mismatch ${this.actor}/${this.name}/${ae.name}`, this);
                }
            }
            return !_disabled;
        }

        if (this.system.active === undefined) {
            console.warn(`${this.name} system.active === undefined, assuming true`);

            return true;
        }

        return this.system.active;
    }

    get compoundCostForDisplay() {
        if (this.system?.XMLID !== "COMPOUNDPOWER") return 0;

        let cost = this.characterPointCost;
        // for (const child of this.childItems) {
        //     cost += parseInt(child.system.characterPointCost);
        // }

        let costSuffix = "";

        // Is this in a framework?
        if (this.parentItem?.system.XMLID === "MULTIPOWER") {
            // Fixed
            if (this.system.ULTRA_SLOT) {
                costSuffix = this.actor?.system.is5e ? "u" : "f";
                cost = roundFavorPlayerTowardsZero(cost / 10.0);
            }

            // Variable
            else {
                costSuffix = this.actor?.system.is5e ? "m" : "v";
                cost = roundFavorPlayerTowardsZero(cost / 5.0);
            }
        }

        return roundFavorPlayerTowardsZero(cost) + costSuffix;
    }

    /**
     * Get the item's active cost for display purposes. To be similar to HD we round up (so 4.5 goes to 5).
     * However, be aware that HD keep the actual point cost expressed in 1 or 2 decimal points (based on 5e or 6e)
     */
    get activePointCostForDisplay() {
        return roundFavorPlayerAwayFromZero(this._activePoints);
    }

    /**
     * Get the item's real cost for display purposes. To be similar to HD we round up (so 4.5 goes to 5).
     * However, be aware that HD keep the actual point cost expressed in 1 or 2 decimal points (based on 5e or 6e)
     */
    get realPointCostForDisplay() {
        return roundFavorPlayerAwayFromZero(this._realCost);
    }

    /**
     * Get the item's character cost for display purposes. To be similar to HD we round up (so 4.5 goes to 5).
     * However, be aware that HD keep the actual point cost expressed in 1 or 2 decimal points (based on 5e or 6e)
     */
    get characterPointCostForDisplay() {
        const cost = this.characterPointCost || parseFloat(this.characterPointCost);

        return roundFavorPlayerAwayFromZero(cost);
    }

    get activePoints() {
        return this._activePoints;
    }

    get characterPointCost() {
        if (this.parentItem?.system.XMLID === "COMPOUNDPOWER") {
            return 0;
        }

        const cpCost = this._characterPointCost;

        // Consider the 5 point doubling cost
        const quantity = this.system.QUANTITY;
        let doublingsCost = 0;
        if (quantity != null && quantity > 1) {
            const doublings = Math.ceil(Math.log2(quantity));

            // The cost is always the cheaper of buying multiple quantities or paying the 5pt doubling cost.
            // We're multiplying, so remember to round.
            doublingsCost = roundFavorPlayerTowardsZero(Math.min(5 * doublings, cpCost * (quantity - 1)));
        }

        return cpCost + doublingsCost;
    }

    get realCost() {
        return this._realCost;
    }

    get _activePointsWithoutEndMods() {
        return this._activePointsForEnd;
    }

    get _advantages() {
        return this._advantageCost;
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
            cost += parseInt(child.system.characterPointCost);
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

        return roundFavorPlayerTowardsZero(cost) + costSuffix;
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
    get isSenseAffecting() {
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

        // Many ITEMs with no ADDERs costs min 1 point
        if (
            !["maneuver", "martialart", "characteristic"].includes(this.type) &&
            !["PERCEPTION", "__STRENGTHDAMAGE", "LIST"].includes(this.system.XMLID) &&
            this.adders.length === 0
        ) {
            if (_basePoints === 0) {
                console.warn(`Min cost is 1 pt for ${this.name}`, this);
            }
            _basePoints = Math.max(1, _basePoints);
        }

        return _basePoints;
    }

    get _addersCost() {
        if (this.system.EVERYMAN) return 0;
        if (this.system.NATIVE_TONGUE) return 0;

        let _cost = 0;

        if (this.baseInfo?.addersCost) {
            _cost = this.baseInfo.addersCost(this);
        } else {
            for (const adder of this.adders) {
                if (this.baseInfo?.categorized && this.system.FAMILIARITY) {
                    _cost += Math.max(1, adder.cost - 1);
                } else {
                    _cost += adder.cost;
                }
            }
        }

        // TRANSPORT_FAMILIARITY discounts
        // TODO: What if you have more than 1 TF, you only get 1 discount for a single TF
        if (this.system.XMLID === "TRANSPORT_FAMILIARITY") {
            // Combat Driving includes Familiarity with
            // one 1-CP class of vehicles that operate in two dimensions (but
            // if the character buys the full category, this “free” CP does not
            // reduce the cost).
            // TODO: This list is incomplete, need config.mjs entries for all TF's along with valid discounts
            const COMBAT_DRIVING = this.actor.items.find((item) => item.system.XMLID === "COMBAT_DRIVING");
            if (COMBAT_DRIVING) {
                const qualfyingCategoryForDiscount = this.adders.find(
                    (a) =>
                        [
                            "COMMONMOTORIZED",
                            "MUSCLEPOWEREDGROUNDVEHICLES",
                            "UNCOMMONMOTORIZEDGROUNDVEHICLES",
                            "COLDWEATHERVEHICLES",
                        ].includes(a.XMLID) && !a.SELECTED,
                );
                const qualfying1PointDiscount = qualfyingCategoryForDiscount?.adders.find((a) => a.BASECOST === 1);
                if (qualfying1PointDiscount) {
                    _cost = Math.max(0, _cost - 1);
                } else {
                    console.warn(`COMBAT_DRIVING discount found no matching 1-CP skill`, this);
                }
            }

            // Combat Piloting
            // includes Familiarity with one 1-CP class of vehicles that operate
            // in three dimensions (but if the character buys the full category,
            // this “free” CP does not reduce the cost).
            const COMBAT_PILOTING = this.actor.items.find((item) => item.system.XMLID === "COMBAT_PILOTING");
            if (COMBAT_PILOTING) {
                const qualfyingCategoryForDiscount = this.adders.find((a) => ["AIR"].includes(a.XMLID) && !a.SELECTED);
                const qualfying1PointDiscount = qualfyingCategoryForDiscount?.adders.find((a) => a.BASECOST === 1);
                if (qualfying1PointDiscount) {
                    _cost = Math.max(0, _cost - 1);
                } else {
                    console.warn(`COMBAT_PILOTING discount found no matching 1-CP skill`, this);
                }
            }

            // Combat Piloting
            // includes Familiarity with one 1-CP class of vehicles that operate
            // in three dimensions (but if the character buys the full category,
            // this “free” CP does not reduce the cost).
            const RIDING = this.actor.items.find((item) => item.system.XMLID === "RIDING");
            if (RIDING) {
                const qualfyingCategoryForDiscount = this.adders.find(
                    (a) => ["RIDINGANIMALS"].includes(a.XMLID) && !a.SELECTED,
                );
                const qualfying1PointDiscount = qualfyingCategoryForDiscount?.adders.find((a) => a.BASECOST === 1);
                if (qualfying1PointDiscount) {
                    _cost = Math.max(0, _cost - 1);
                } else {
                    console.warn(`RIDING discount found no matching 1-CP skill`, this);
                }
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
            ap = roundFavorPlayerTowardsZero(ap * advantageCosts);
        }

        ap = Math.max(this.baseInfo?.minimumCost || 0, ap);
        return ap;
    }

    get _activePointsForEnd() {
        const advantageCostsWithoutEnd = 1 + this._advantageCostWithoutEnd;
        const baseCostWithoutEnd = this._basePoints + this._addersCost - this._negativeCustomAddersCost;

        // We must round only if we multiply (FRed pg 7, 6e vol 1 pg 12)
        if (advantageCostsWithoutEnd !== 1) {
            return roundFavorPlayerTowardsZero(baseCostWithoutEnd * advantageCostsWithoutEnd);
        } else {
            return baseCostWithoutEnd;
        }
    }

    get _activePointsWithoutAoe() {
        const advantageCostsWithoutAoe = 1 + this._advantageCostWithoutAoe;
        const baseCostWithoutAoe = this._basePoints + this._addersCost - this._negativeCustomAddersCost;

        // We must round only if we multiply (FRed pg 7, 6e vol 1 pg 12)
        if (advantageCostsWithoutAoe !== 1) {
            return roundFavorPlayerTowardsZero(baseCostWithoutAoe * advantageCostsWithoutAoe);
        } else {
            return baseCostWithoutAoe;
        }
    }

    _activePointsWithoutExclusionList(exclusionList) {
        const advantageCostsWithoutExclusions = 1 + this._advantageCostExcludingList(exclusionList);
        const baseCostWithoutExclusions = this._basePoints + this._addersCost - this._negativeCustomAddersCost;

        // We must round only if we multiply (FRed pg 7, 6e vol 1 pg 12)
        if (advantageCostsWithoutExclusions !== 1) {
            return roundFavorPlayerTowardsZero(baseCostWithoutExclusions * advantageCostsWithoutExclusions);
        } else {
            return baseCostWithoutExclusions;
        }
    }

    get _advantagesAffectingDc() {
        let _cost = 0;

        for (const advantage of this.advantages) {
            if (!advantage.baseInfo) {
                console.log(
                    `${this.actor?.name}/${this.detailedName()}/${advantage.ALIAS}/${advantage.XMLID} is missing baseinfo`,
                );
                continue;
            }

            if (!advantage.baseInfo.dcAffecting) {
                console.error(
                    `${this.actor?.name}/${this.detailedName()}/${advantage.ALIAS}/${advantage.XMLID} is missing dcAffecting function`,
                );
                continue;
            }

            if (advantage.baseInfo.dcAffecting(advantage, this)) {
                _cost += advantage.cost;
            }
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
            return roundFavorPlayerTowardsZero(dcRaw);
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
            _cost = roundFavorPlayerTowardsZero(_cost / (1 + _limitationCost));
        }

        return _cost;
    }

    get elementalControl() {
        if (this.parentItem?.system.XMLID === "ELEMENTAL_CONTROL") {
            return this.parentItem;
        } else if (this.parentItem?.parentItem?.system.XMLID === "ELEMENTAL_CONTROL") {
            return this.parentItem.parentItem;
        }
        return null;
    }

    // Real Points are sometimes referred to as Character Points in HD, but they should not be as they are distinct.
    get _characterPointCost() {
        // VPP parent?
        if (this.parentItem?.system.XMLID === "VPP" || this.parentItem?.parentItem?.system.XMLID === "VPP") {
            return 0;
        }

        if (this.elementalControl) {
            if (this.baseInfo?.characterPointCostForElementalControl) {
                return this.baseInfo.characterPointCostForElementalControl(this);
            }
            const cp =
                (Math.max(this.elementalControl.system.BASECOST * 2, this.activePoints) -
                    this.elementalControl.system.BASECOST) /
                (1 + this._limitationCost);
            return roundFavorPlayerTowardsZero(cp);
        }

        let _cost = this._realCost;

        // Power cost in Power Framework is applied before limitations
        if (this.parentItem) {
            if (
                this.parentItem.system.XMLID === "MULTIPOWER" ||
                this.parentItem.parentItem?.system.XMLID === "MULTIPOWER"
            ) {
                // Fixed with minimum cost of 1
                if (this.system.ULTRA_SLOT || this.parentItem?.system.ULTRA_SLOT) {
                    _cost = Math.max(1.0, roundFavorPlayerTowardsZero(_cost / 10.0));
                }

                // Variable with minimum cost of 1
                else {
                    _cost = Math.max(1.0, roundFavorPlayerTowardsZero(_cost / 5.0));
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
            end = roundFavorPlayerTowardsZero((this.system._activePointsWithoutEndMods || this.activePoints) / 10);
            end = Math.max(1, roundFavorPlayerTowardsZero(end / 2));
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
                end = roundFavorPlayerTowardsZero(end / 2);
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

    get endPer1mMovement() {
        // All begin with all movements costing 1 END per fraction of 10m moved
        let end = 0.1;

        const increasedEnd = this.findModsByXmlid("INCREASEDEND");
        if (increasedEnd) {
            end *= parseInt(increasedEnd.OPTION.replace("x", ""));
        }

        const reducedEnd =
            this.findModsByXmlid("REDUCEDEND") || (this.parentItem && this.parentItem.findModsByXmlid("REDUCEDEND"));
        if (reducedEnd && reducedEnd.OPTION === "HALFEND") {
            end = roundFavorPlayerTowardsZero((this.system._activePointsWithoutEndMods || this.activePoints) / 10);
            end = Math.max(1, roundFavorPlayerTowardsZero(end / 2));
        } else if (reducedEnd && reducedEnd.OPTION === "ZERO") {
            end = 0;
        }

        return end;
    }

    /**
     * Given an autofire modifier, calculate the maximum number of shots allowed.
     *
     * @param {HeroSystem6eModifier} autofireMod
     * @returns
     */
    calcMaxAutofireShots(autofireMod) {
        const baseAutoFireShots = parseInt(autofireMod.OPTION_ALIAS.match(/\d+/)) || 1;
        const doubleAdder = autofireMod.adders.find((adder) => adder.XMLID === "DOUBLE");
        const numDoubles = doubleAdder ? doubleAdder.LEVELS : 0;

        return baseAutoFireShots * Math.pow(2, numDoubles);
    }

    /**
     * Return the effect attack item for this item.
     * If the item is using a martial arts weapon, then that's the effective attack item.
     * Anything else?
     */
    get effectiveAttackItem() {
        return this.system._active.maWeaponItem || this;
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

        const advantagesCopy = itemFrom.advantages
            .filter((advantage) => !advantagesToIgnore.includes(advantage.XMLID))
            .map((advantage) => advantage.clone());

        this.system.MODIFIER = this.system.MODIFIER.concat(advantagesCopy);

        // Stash a copy of what we've added in after the fact
        this.system._active.MODIFIER = (this.system._active.MODIFIER || []).concat(advantagesCopy);
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
     * Anything that doesn't have a damage effect (e.g. Darkness)
     */
    damageLevelTweaking(diceParts) {
        // Some powers really shouldn't be calling this function, but our system doesn't handle them yet. Until then
        // just do nothing for these powers.
        if (
            this.system.XMLID === "DARKNESS" ||
            this.system.XMLID === "CHANGEENVIRONMENT" ||
            this.system.XMLID === "POSSESSION"
        ) {
            return;
        }

        const plusOnePipAdderData = getPowerInfo({
            xmlid: "PLUSONEPIP",
            actor: this.actor,
            is5e: this.is5e,
            item: this,
            xmlTag: "ADDER",
        });
        const plusHalfDieAdderData = getPowerInfo({
            xmlid: "PLUSONEHALFDIE",
            actor: this.actor,
            is5e: this.is5e,
            item: this,
            xmlTag: "ADDER",
        });
        const minusOnePipAdderData = getPowerInfo({
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
            let xml = minusOnePipAdderData.xml;
            xml = replaceBaseCostForHalfDieAdderXml(this, xml);
            const newAdder = createModifierOrAdderFromXml(xml);
            this.system.ADDER.push(new HeroAdderModel(newAdder, { parent: this }));
        }

        // Set/clear a 1/2d6 adder
        const halfDieAdder = this.adders.find((adder) => adder.XMLID === "PLUSONEHALFDIE");
        if (!diceParts.halfDieCount && halfDieAdder) {
            // Remove the adder
            this.system.ADDER = this.system.ADDER.filter((adder) => adder.XMLID !== "PLUSONEHALFDIE");
        } else if (diceParts.halfDieCount && !halfDieAdder) {
            // Add the adder
            let xml = plusHalfDieAdderData.xml;
            xml = replaceBaseCostForHalfDieAdderXml(this, xml);
            const newAdder = createModifierOrAdderFromXml(xml);
            this.system.ADDER.push(new HeroAdderModel(newAdder, { parent: this }));
        }

        // Set/clear a +1 pip adder
        const onePipAdder = this.adders.find((adder) => adder.XMLID === "PLUSONEPIP");
        if (!diceParts.constant && onePipAdder) {
            // Remove the adder
            this.system.ADDER = this.system.ADDER.filter((adder) => adder.XMLID !== "PLUSONEPIP");
        } else if (diceParts.constant && !onePipAdder) {
            // Add the adder
            let xml = plusOnePipAdderData.xml;
            xml = replaceBaseCostForPipAdderXml(this, xml);
            const newAdder = createModifierOrAdderFromXml(xml);
            this.system.ADDER.push(new HeroAdderModel(newAdder, { parent: this }));
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

    /**
     * Does this item use OMCV for attacking?
     */
    get usesOmcv() {
        return this.system.attacksWith === "omcv";
    }

    /**
     * Assuming this item is an attack power, is it ranged?
     */
    get isRanged() {
        const range = this.system.range;
        return !(range === CONFIG.HERO.RANGE_TYPES.SELF || range === CONFIG.HERO.RANGE_TYPES.NO_RANGE);
    }

    /**
     * Assuming this item is an attack power, does it have no range?
     */
    get isHth() {
        const range = this.system.range;
        return range === CONFIG.HERO.RANGE_TYPES.NO_RANGE;
    }

    /**
     * Assuming this item is an attack power, is it a ranged power that doesn't use OMCV to hit?
     */
    get isRangedNonMental() {
        return this.isRanged && !this.usesOmcv;
    }

    /**
     * Assuming this item is an attack power, does it have no range and doesn't use OMCV to hit?
     */
    get isHthNonMental() {
        return this.isHth && !this.usesOmcv;
    }

    /**
     * Is this item a martial art maneuver
     */
    get isMartialManeuver() {
        return this.type === "martialart";
    }

    /**
     * Is this item a combat maneuver
     */
    get isCombatManeuver() {
        return this.type === "maneuver";
    }

    /**
     * Link the item's custom adders to other items
     *
     * @param {HeroAdderModel[]} adders - All system.ADDER which will not be mutated
     *
     * @returns {Object} updates - an accumulator of changes to commit to the database
     */
    linkBasedOnCustomAdders(adders, potentialMatchingItems) {
        const updates = {};

        // Setup targetId
        const allAdders = foundry.utils.deepClone(adders);
        const customAdders = allAdders.filter((a) => a.XMLID === "ADDER");
        for (const customAdder of customAdders) {
            const targetId = potentialMatchingItems.find((item) => {
                // A match has the exact name, ALIAS, or XMLID (ignoring case). The most precise
                // is thus providing a unique name - other options can potentially have multiple matches of which
                // we'll end up with the first. This could result in a situation where someone can not match
                // the attack they actually want.
                // NOTE: We do allow a case insensitve match
                const aliasToMatch = customAdder.ALIAS.toLowerCase();

                return (
                    item.name.toLowerCase() === aliasToMatch ||
                    item.system.ALIAS?.toLowerCase() === aliasToMatch ||
                    item.system.XMLID?.toLowerCase() === aliasToMatch
                );
            })?.id;

            if (!targetId && customAdder.BASECOST === 0 && customAdder.ALIAS) {
                console.warn(`Failed to match custom adder ${customAdder.ALIAS} for ${this.detailedName()}.`);
            }

            customAdder.targetId = targetId;
        }
        updates["system.ADDER"] = allAdders;

        return updates;
    }

    /**
     * Get all valid custom link adders for this item
     *
     * @returns HeroAdderModel[]
     */
    get customLinkAdders() {
        const customLinkAdders = this.adders.filter(
            (adder) => adder.XMLID === "ADDER" && adder.BASECOST === 0 && adder.ALIAS,
        );

        return customLinkAdders;
    }

    /**
     * Typically custom adders put into an item (e.g. CSL, PSL) just point to an item. However, we also allow
     * frameworks (MP, EC, VPP, and lists) to be pointed to as a shorthand for all the framework's slots. If any of the
     * adders point to a framework, expand it out to all of the slots of that framework.
     *
     * Return the expanded array of items that are valid for this item.
     */
    get customLinkAddersToExpandedItems() {
        const allowedItems = this.customLinkAddersToItems
            .filter(Boolean) // Remove any unfound adder -> item mappings
            .map((matchingItem) => {
                const isFrameworkItem = matchingItem.baseInfo?.type.includes("framework");
                if (isFrameworkItem) {
                    // All children
                    return matchingItem.childItems;
                }

                return matchingItem;
            })
            .filter(Boolean)
            .flat();

        return allowedItems;
    }

    /**
     * Return an array of custom adders to their matching item. It is possible for the array to have
     * undefined elements if there is no match.
     *
     * @returns HeroSystem6eItem|undefined[]
     */
    get customLinkAddersToItems() {
        return this.customLinkAdders.map((customLinkAdder) => {
            return this.actor?.items.find((item) => item.id === customLinkAdder.targetId);
        });
    }

    /**
     * Return an array of custom adders which don't match to an item.
     *
     * @returns HeroAdderModel[]
     */
    get customLinkAddersWithoutItems() {
        return this.customLinkAdders
            .map((customLinkAdder) => {
                const found = this.actor?.items.find((item) => item.id === customLinkAdder.targetId);
                return found ? undefined : customLinkAdder;
            })
            .filter(Boolean);
    }

    /**
     * Is the attack item listed in one of this item's custom link adders? If so, true else false.
     *
     * @param {HeroSystem6eItem} attackItem
     *
     * @returns boolean
     */
    isAttackItemInCustomLinkAddersAllowList(attackItem) {
        const lookingForId = attackItem.id ?? foundry.utils.parseUuid(attackItem.system._active?.__originalUuid)?.id;
        const attackMatchesCustomAdder = !!this.customLinkAddersToExpandedItems.find(
            (item) => item.id === lookingForId,
        );
        if (attackMatchesCustomAdder) {
            return true;
        }

        // As a convenience we automatically associate any CSLs which are in a compound power
        // to be considered attached to attack items inside the compound power.
        const isInCompoundItem = attackItem.parentItem?.system.XMLID === "COMPOUNDPOWER";
        if (isInCompoundItem) {
            // All attacks in this compound power
            const cslInSameCompoundPower = !!attackItem.parentItem.childItems.find((item) => item.id === this.id);
            if (cslInSameCompoundPower) {
                return true;
            }
        }

        return false;
    }

    /**
     * Does this item have CSL like behaviours:
     * COMBAT_LEVELS are standard 5e/6e CSLs
     * MENTAL_COMBAT_LEVELS are standard 6e "mental" only CSLs
     * Overall SKILL_LEVELS can be used for combat so behave like a CSL
     * WEAPON_MASTER is just a TALENT that is 6 CSLs/level that only affects DCs
     */
    get isCsl() {
        return (
            this.system.XMLID === "COMBAT_LEVELS" ||
            this.system.XMLID === "MENTAL_COMBAT_LEVELS" ||
            this.system.XMLID === "WEAPON_MASTER" ||
            (this.system.XMLID === "SKILL_LEVELS" && this.system.OPTIONID === "OVERALL")
        );
    }

    get isCslValidHeroValidation() {
        // If there are no mapped attacks, and there need to be, then the CSL won't work. The rules are:
        // 1. The CSL doesn't need to have custom adders because it supports an Infinite number of potential adders
        // 2. Are there no adders when they need to be provided for the CSL to work?
        // 3. We allow CSLs in COMPOUNDPOWERS to automatically work for all attacks within the COMPOUNDPOWER.
        const cslCustomAdders = this.customLinkAdders;
        return (
            this.maxCustomCslAdders === +Infinity ||
            cslCustomAdders.length > 0 ||
            this.parentItem?.system.XMLID === "COMPOUNDPOWER"
        );
    }

    /**
     * Do any (re)initialization required for the CSL. It is safe to call this with an already initialized CSL.
     *
     * @param {Number} numLevels - number of levels in the CSL like item
     *
     * @returns {Object} cslUpdates - an accumulator of changes to commit to the database
     */
    initializeCsl(numLevelsCouldBeString) {
        const cslUpdates = {};
        const numLevels = parseInt(numLevelsCouldBeString);

        // Weaponmaster adds +3 Damage Classes, but you need 2 csl DC for +1 real DC
        const expectedNumEntries = this.system.XMLID === "WEAPON_MASTER" ? 6 * numLevels : numLevels;

        // (Re)initialize csl array
        const allowedChoices = this.cslChoices;
        const selectedChoices = foundry.utils.deepClone(this.system._source.csl);
        selectedChoices.length = expectedNumEntries; // Truncate or expand the array as required

        // Make sure none of the selectedChoices are outside the possibleChoices set. If they are,
        // just set them to the first option of the possibleChoices (because who knows what is best).
        for (let i = 0; i < expectedNumEntries; ++i) {
            if (allowedChoices[selectedChoices[i]] === undefined) {
                selectedChoices[i] = Object.keys(allowedChoices)[0];
            }
        }
        cslUpdates["system.csl"] = selectedChoices;

        return cslUpdates;
    }

    /**
     * Must only be called on COMBAT_LEVELS, MENTAL_COMBAT_LEVELS, SKILL_LEVELS, or WEAPON_MASTER.
     *
     * @return {Object} A collection of all combat uses for this CSL (ocv, omcv, dcvRanged, dcvHth, dmcv, dc)
     */
    get cslChoices() {
        if (this.system.XMLID === "SKILL_LEVELS") {
            if (this.system.OPTIONID === "OVERALL") {
                return {
                    ocv: "ocv",
                    omcv: "omcv",
                    dcvRanged: "dcv ranged",
                    dcvHth: "dcv HTH",
                    dmcv: "dmcv",
                    dc: "dc",
                };
            } else {
                return {};
            }
        } else if (this.system.XMLID === "WEAPON_MASTER") {
            // Weapon master only grants DC skill levels. 6 provide +3 DC per the usual rules.
            return {
                dc: "dc",
            };
        }

        const combatUses = {};

        if (this.is5e) {
            // Most CSLs have all options, so start with that.
            combatUses.ocv = "ocv";
            combatUses.omcv = "omcv";
            combatUses.dcvRanged = "dcv ranged";
            combatUses.dcvHth = "dcv HTH";
            combatUses.dmcv = "dmcv";
            combatUses.dc = "dc";

            // 5e has a number of purely defensive options. Remove offensive options for those.
            const isOnlyDefensive =
                this.system.OPTIONID === "TWODCV" ||
                this.system.OPTIONID === "DCV" ||
                this.system.OPTIONID === "DECV" ||
                this.system.OPTIONID === "HTHDCV";
            if (isOnlyDefensive) {
                delete combatUses.ocv;
                delete combatUses.omcv;
                delete combatUses.dc;
            }

            // If this CSL is mental only, remove the non mental options.
            const isMentalOnly = this.system.OPTIONID === "MENTAL" || this.system.OPTIONID === "DECV";
            if (isMentalOnly) {
                delete combatUses.ocv;
                delete combatUses.dcvRanged;
                delete combatUses.dcvHth;
            }

            // If this CSL for sure has no mental, remove the mental options.
            const hasNoMental =
                ((this.system.OPTIONID === "TWODCV" || this.system.OPTIONID === "TWOOCV") &&
                    !this.csl5eCslDcvOcvTypes.find((type) => type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.mental)) ||
                this.system.OPTIONID === "HTH" ||
                this.system.OPTIONID === "RANGED" ||
                this.system.OPTIONID === "HTHDCV" ||
                this.system.OPTIONID === "DCV";
            if (hasNoMental) {
                delete combatUses.omcv;
                delete combatUses.dmcv;
            }

            // Inexpensive options don't provide dcv, dmcv, or dc options - only omcv or ocv.
            if (
                this.system.OPTIONID === "SINGLESINGLE" ||
                this.system.OPTIONID === "SINGLE" ||
                this.system.OPTIONID === "SINGLESTRIKE"
            ) {
                delete combatUses.dcvRanged;
                delete combatUses.dcvHth;
                delete combatUses.dmcv;
                delete combatUses.dc;
            }

            // Some options exclude DCV against HTH or Ranged.
            if (
                this.system.OPTIONID === "HTH" ||
                (this.system.OPTIONID === "HTHDCV" &&
                    !this.csl5eCslDcvOcvTypes.find((type) => type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.ranged)) ||
                ((this.system.OPTIONID === "TWODCV" || this.system.OPTIONID === "TWOOCV") &&
                    !this.csl5eCslDcvOcvTypes.find((type) => type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.ranged))
            ) {
                delete combatUses.dcvRanged;
            } else if (
                this.system.OPTIONID === "RANGED" ||
                (this.system.OPTIONID === "HTHDCV" &&
                    !this.csl5eCslDcvOcvTypes.find((type) => type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.hth)) ||
                ((this.system.OPTIONID === "TWODCV" || this.system.OPTIONID === "TWOOCV") &&
                    !this.csl5eCslDcvOcvTypes.find((type) => type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.hth))
            ) {
                delete combatUses.dcvHth;
            }
        } else {
            const isMental = this.system.XMLID === "MENTAL_COMBAT_LEVELS";
            if (isMental) {
                combatUses.omcv = "omcv";
                combatUses.dmcv = "dmcv";
                combatUses.dc = "dc";
            } else {
                combatUses.ocv = "ocv";
                combatUses.dcvRanged = "dcv ranged";
                combatUses.dcvHth = "dcv HTH";
                combatUses.dc = "dc";
            }

            // Some options exclude DCV against HTH or Ranged.
            if (this.system.OPTIONID === "HTH") {
                delete combatUses.dcvRanged;
            } else if (this.system.OPTIONID === "RANGED") {
                delete combatUses.dcvHth;
            }

            // Inexpensive options don't provide dcv, dmcv, or dc options - only omcv or ocv.
            if (this.system.OPTIONID === "SINGLE") {
                delete combatUses.dcvRanged;
                delete combatUses.dcvHth;
                delete combatUses.dmcv;
                delete combatUses.dc;
            }
        }

        return combatUses;
    }

    get csls() {
        const _csls = [];
        for (const csl of this.actor?.activeCslSkills || []) {
            if (csl.cslAppliesTo(this)) {
                _csls.push(csl);
            }
        }
        return _csls;
    }

    /**
     * Returns the maximum number of attacks the CSL can be applied against
     * @returns Number
     */
    get maxCustomCslAdders() {
        // Overall skill levels can be applied to an infinite number. Other skill levels apply to 0.
        if (this.system.XMLID === "SKILL_LEVELS") {
            if (this.system.OPTIONID === "OVERALL") {
                return +Infinity;
            }

            return 0;
        }

        if (this.is5e) {
            if (this.system.XMLID === "COMBAT_LEVELS") {
                if (
                    this.system.OPTIONID === "SINGLESINGLE" ||
                    this.system.OPTIONID === "SINGLE" ||
                    this.system.OPTIONID === "SINGLESTRIKE"
                ) {
                    return 1;
                } else if (this.system.OPTIONID === "STRIKE" || this.system.OPTIONID === "TIGHT") {
                    return 3;
                }

                // Most 5e CSLs don't have restrictions on them in terms of the number of items. The restriction
                // is based on "related" and that's not something that we can police.
                return +Infinity;
            }
        } else {
            // 6e
            switch (this.system.XMLID) {
                case "COMBAT_LEVELS":
                    if (this.system.OPTIONID === "SINGLE") {
                        return 1;
                    } else if (this.system.OPTIONID === "TIGHT") {
                        return 3;
                    } else if (this.system.OPTIONID === "BROAD") {
                        return 10; // Randomly picked. If they're for a multipower then just choose the multipower and that's 1.
                    } else {
                        return +Infinity;
                    }

                case "MENTAL_COMBAT_LEVELS":
                    if (this.system.OPTIONID === "SINGLE") {
                        return 1;
                    } else if (this.system.OPTIONID === "TIGHT") {
                        return 3;
                    } else {
                        return +Infinity;
                    }

                case "WEAPON_MASTER":
                    if (this.system.OPTIONID === "VERYLIMITED") {
                        return 3; // a 3 point "CSL" equivalent to "TIGHT"
                    } else if (this.system.OPTIONID === "LIMITED") {
                        return 10; // a 5 point "CSL" equivalent to "BROAD"
                    } else {
                        // All HTH and all Ranged can have unlimited number of custom adders
                        return +Infinity;
                    }

                default:
                // Intentionally fall through
            }
        }

        console.error(`Unhandled CSL ${this.detailedName()}/${this.is5e}`);
        return 0;
    }

    /**
     * Are there any items which are not allowed that are the target of this PSL's custom adders?
     *
     * @returns boolean
     */
    get notAllowedItemsInCslCustomAdders() {
        return this.customLinkAddersToExpandedItems.filter((item) => !this.cslAppliesTo(item));
    }

    get csl5eCslDcvOcvTypes() {
        if (
            !this.is5e ||
            this.system.XMLID !== "COMBAT_LEVELS" ||
            !(
                this.system.OPTIONID === "TWOOCV" ||
                this.system.OPTIONID === "TWODCV" ||
                this.system.OPTIONID === "HTHDCV"
            )
        ) {
            return [];
        }

        // Uses OPTION_ALIAS (free text) to get an array of the recognized types of this CSL.
        const cvTypes = Object.keys(CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES)
            .map((cvType) => (this.system.OPTION_ALIAS.toLowerCase().includes(cvType) ? cvType : ""))
            .filter(Boolean);

        if ((this.system.OPTIONID === "TWOOCV" || this.system.OPTIONID === "TWODCV") && cvTypes.length !== 2) {
            console.warn(
                `${this.actor?.name} Unknown 5e CSL TWOOCV/TWODCV type "${this.system.OPTION_ALIAS} for ${this.parentItem?.name}/${this.detailedName()}`,
                this,
            );
        } else if (this.system.OPTIONID === "HTHDCV" && cvTypes.length !== 1) {
            console.warn(
                `${this.actor?.name} Unknown 5e CSL HTHDCV type "${this.system.OPTION_ALIAS} for ${this.parentItem?.name}/${this.detailedName()}`,
                this,
            );
        }

        return cvTypes;
    }

    get cslWeaponMasterWeaponTypes() {
        if (
            this.is5e ||
            this.system.XMLID !== "WEAPON_MASTER" ||
            !(this.system.OPTIONID === "ANYHTH" || this.system.OPTIONID === "ANYRANGED")
        ) {
            return [];
        }

        // Uses OPTION_ALIAS (free text) to get an array of the recognized types of this CSL.
        const wmTypes = Object.keys(CONFIG.HERO.CSL_WEAPON_MASTER_WEAPON_TYPES)
            .map((wmType) => (this.system.OPTION_ALIAS.toLowerCase().includes(wmType) ? wmType : ""))
            .filter(Boolean);

        if (wmTypes.length !== 1) {
            console.warn(
                `${this.actor?.name} Unknown 6e Weapon Master ANYHTH/ANYRANGED type "${this.system.OPTION_ALIAS} for ${this.parentItem?.name}/${this.detailedName()}`,
                this,
            );
        }

        return wmTypes;
    }

    /**
     * Is this item a CSL and does it apply to the given attackItem
     *
     * @param {HeroSystem6eItem} attackItem
     *
     * @returns boolean
     */
    cslAppliesTo(attackItem) {
        if (!this.isCsl) {
            if (!this.actor?.name.startsWith("_Quench")) {
                console.error("This is not a CSL", this, attackItem);
            }
            return false;
        }

        // SKILL_LEVELS: OVERALL, the 5e 10pt or 6e 12pt, work for any kind of attack but no other form does.
        if (this.system.XMLID === "SKILL_LEVELS") {
            if (this.system.OPTIONID === "OVERALL") {
                return true;
            }

            return false;
        }

        // The rest of the CSL types are very different between 5e and 6e.
        if (this.is5e) {
            if (this.system.XMLID !== "COMBAT_LEVELS") {
                // Only CSLs should be able to make it here
                return false;
            }

            // Many CSL types do not require listing of allow items. Check if it's one of those.
            switch (this.system.OPTIONID) {
                case "ALL":
                    return true;

                case "MENTALRANGED":
                    return attackItem.usesOmcv || attackItem.isRangedNonMental;

                case "HTHMENTAL":
                    return attackItem.usesOmcv || attackItem.isHthNonMental;

                case "HTHRANGED":
                    return attackItem.isHthNonMental || attackItem.isRangedNonMental;

                case "MENTAL":
                    return attackItem.usesOmcv;

                case "RANGED":
                    return attackItem.isRangedNonMental;

                case "HTH":
                    return attackItem.isHthNonMental;

                case "MARTIAL":
                    return attackItem.isMartialManeuver;

                case "HTHDCV":
                case "TWODCV":
                case "TWOOCV": {
                    for (const type of this.csl5eCslDcvOcvTypes) {
                        if (type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.hth) {
                            if (attackItem.isHthNonMental) {
                                return true;
                            }
                        } else if (type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.ranged) {
                            if (attackItem.isRangedNonMental) {
                                return true;
                            }
                        } else if (type === CONFIG.HERO.CSL_5E_CV_LEVELS_TYPES.mental) {
                            if (attackItem.usesOmcv) {
                                return true;
                            }
                        }
                    }

                    // This attack does not appear to be in the supported types for this CSL
                    return false;
                }

                case "DCV":
                    return attackItem.isHthNonMental || attackItem.isRangedNonMental;

                case "DECV":
                    return attackItem.usesOmcv;

                default:
                // Drop through and be handled outside the switch
            }

            // The other types of CSLs support a limited number of attacks. We have to check that attackItem
            // in the allow list.
            if (
                this.system.OPTIONID === "BROAD" ||
                this.system.OPTIONID === "MAGIC" ||
                this.system.OPTIONID === "TIGHT" ||
                this.system.OPTIONID === "STRIKE" ||
                this.system.OPTIONID === "SINGLESTRIKE" ||
                this.system.OPTIONID === "SINGLE" ||
                this.system.OPTIONID === "SINGLESINGLE"
            ) {
                return this.isAttackItemInCustomLinkAddersAllowList(attackItem);
            }
        } else {
            // 6e
            switch (this.system.XMLID) {
                case "COMBAT_LEVELS":
                    // 6e CSLs are only good for non mental attacks
                    if (attackItem.usesOmcv) {
                        return false;
                    }

                    if (this.system.OPTIONID === "ALL") {
                        // The ALL level doesn't have to list the supported attacks - everything that is
                        // a non mental combat attack is supported.
                        return true;
                    } else if (this.system.OPTIONID === "RANGED") {
                        return attackItem.isRangedNonMental;
                    } else if (this.system.OPTIONID === "HTH") {
                        return attackItem.isHthNonMental;
                    }

                    // The other types of CSLs support a limited number of attacks. We have to check that its
                    // in the allow list.
                    if (
                        this.system.OPTIONID === "SINGLE" ||
                        this.system.OPTIONID === "TIGHT" ||
                        this.system.OPTIONID === "BROAD"
                    ) {
                        return this.isAttackItemInCustomLinkAddersAllowList(attackItem);
                    }

                    break;

                case "MENTAL_COMBAT_LEVELS":
                    // 6e MCSLs are only good for "mental" attacks
                    if (!attackItem.usesOmcv) {
                        return false;
                    }

                    // The BROAD level doesn't have to list the supported attacks - everything that is
                    // a mental attack is supported. This is similar to CSL's "ALL".
                    if (this.system.OPTIONID === "BROAD") {
                        return true;
                    }

                    // The other types of MCSLs support a limited number of attacks. We have to check that attackItem
                    // in the allow list.
                    if (this.system.OPTIONID === "SINGLE" || this.system.OPTIONID === "TIGHT") {
                        return this.isAttackItemInCustomLinkAddersAllowList(attackItem);
                    }

                    break;

                case "WEAPON_MASTER":
                    // Weapon master doesn't specifically prohibit mental levels in 6e but it would be stupid to use it for that as it
                    // would be cheaper overall to just buy MCSLs with the same limitations. Regardless, we prohibit "mental" powers as
                    // 6e vol 1 pg. 447 indicates it's made of CSLs which don't allow mental powers.
                    if (attackItem.usesOmcv) {
                        return false;
                    }

                    if (this.system.OPTIONID === "ANYHTH") {
                        const weaponTypes = this.cslWeaponMasterWeaponTypes;
                        if (weaponTypes.length !== 1) {
                            // Not a correctly specified weapon master talent
                            return false;
                        }

                        // Check if the weapon type matches
                        const weaponType = weaponTypes[0];
                        if (weaponType === CONFIG.HERO.CSL_WEAPON_MASTER_WEAPON_TYPES.killing) {
                            return attackItem.isHth && attackItem.doesKillingDamage;
                        } else if (weaponType === CONFIG.HERO.CSL_WEAPON_MASTER_WEAPON_TYPES.normal) {
                            return attackItem.isHth && attackItem.doesNormalDamage;
                        } else if (weaponType === CONFIG.HERO.CSL_WEAPON_MASTER_WEAPON_TYPES.explicit) {
                            return attackItem.isHth && this.isAttackItemInCustomLinkAddersAllowList(attackItem);
                        }
                    } else if (this.system.OPTIONID === "ANYRANGED") {
                        const weaponTypes = this.cslWeaponMasterWeaponTypes;
                        if (weaponTypes.length !== 1) {
                            // Not a correctly specified weapon master talent
                            return false;
                        }

                        // Check if the weapon type matches
                        const weaponType = weaponTypes[0];
                        if (weaponType === CONFIG.HERO.CSL_WEAPON_MASTER_WEAPON_TYPES.killing) {
                            return attackItem.isRanged && attackItem.doesKillingDamage;
                        } else if (weaponType === CONFIG.HERO.CSL_WEAPON_MASTER_WEAPON_TYPES.normal) {
                            return attackItem.isRanged && attackItem.doesNormalDamage;
                        } else if (weaponType === CONFIG.HERO.CSL_WEAPON_MASTER_WEAPON_TYPES.explicit) {
                            return attackItem.isRanged && this.isAttackItemInCustomLinkAddersAllowList(attackItem);
                        }
                    }

                    // The other types of WM support a limited number of attacks. We have to check that attackItem
                    // in the allow list.
                    else if (this.system.OPTIONID === "VERYLIMITED" || this.system.OPTIONID === "LIMITED") {
                        return this.isAttackItemInCustomLinkAddersAllowList(attackItem);
                    }

                    break;
            }
        }

        console.error(`Unhandled CSL ${this.detailedName()}/${this.is5e}`);
        return false;
    }

    get isPsl() {
        return this.system.XMLID === "PENALTY_SKILL_LEVELS";
    }

    psls(penaltyType) {
        return this.allPsls.filter((psl) => psl.pslPenaltyType === penaltyType);
    }

    get allPsls() {
        return (this.actor?.activePslSkills || []).filter((psl) => psl.pslAppliesTo(this));
    }

    get pslPenaltyType() {
        if (this.system.XMLID !== "PENALTY_SKILL_LEVELS") {
            return "";
        }

        // 5e uses INPUT. 6e uses OPTION_ALIAS (free text)
        const pslPenaltyTypeKey = Object.keys(CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES)
            .map((psl) => psl.toLowerCase())
            .find((o) => (this.system.OPTION_ALIAS + this.system.INPUT).toLowerCase().includes(o));

        if (!pslPenaltyTypeKey) {
            console.warn(
                `Unknown PSL type "${this.system.INPUT}" or "${this.system.OPTION_ALIAS} for ${this.parentItem?.name}/${this.name}`,
                this,
            );

            return "";
        }

        return CONFIG.HERO.PENALTY_SKILL_LEVELS_TYPES[pslPenaltyTypeKey];
    }

    /**
     * Are there any items which are not allowed that are the target of this PSL's custom adders?
     *
     * @returns boolean
     */
    get notAllowedItemsInPslCustomAdders() {
        return this.customLinkAddersToExpandedItems.filter((item) => !this.pslAppliesTo(item));
    }

    get isPslValidHeroValidation() {
        // If there are no mapped attacks, and there need to be, then the PSL won't work. The rules are:
        // 1. The PSL doesn't need to have custom adders because it supports an Infinite number of potential adders
        // 2. Are there no adders when they need to be provided for the PSL to work? DPSLs do not use custom adders.
        // 3. We allow PSLs in COMPOUNDPOWERS to automatically work for all attacks within the COMPOUNDPOWER.
        const pslCustomAdders = this.customLinkAdders;
        return (
            this.maxCustomPslAdders === +Infinity ||
            (!(this.system.OPTIONID === "SINGLEDCV" || this.system.OPTIONID === "GROUPDCV") &&
                pslCustomAdders.length > 0) ||
            ((this.system.OPTIONID === "SINGLEDCV" || this.system.OPTIONID === "GROUPDCV") &&
                pslCustomAdders.length === 0) ||
            this.parentItem?.system.XMLID === "COMPOUNDPOWER"
        );
    }

    /**
     * Is this item a PSL and does it apply to the given attackItem?
     *
     * @param {HeroSystem6eItem} attackItem
     *
     * @returns boolean
     */
    pslAppliesTo(attackItem) {
        if (!this.isPsl) {
            if (!this.actor?.name.startsWith("_Quench")) {
                console.error("This is not a PSL", this, attackItem);
            }
            return false;
        }

        // 6e Defensive PSLs don't apply to any attacks
        if (this.system.OPTIONID === "SINGLEDCV" || this.system.OPTIONID === "GROUPDCV") {
            return false;
        }

        if (this.system.OPTIONID === "SINGLE" || this.system.OPTIONID === "THREE" || this.system.OPTIONID === "TIGHT") {
            return this.isAttackItemInCustomLinkAddersAllowList(attackItem);
        } else if (this.system.OPTIONID === "ALL") {
            return true;
        }

        console.error(`Unknown OPTIONID ${this.system.OPTIONID} for ${this.detailedName()}`);
        return false;
    }

    /**
     * Returns the maximum number of attacks the CSL can be applied against
     *
     * @returns Number
     */
    get maxCustomPslAdders() {
        if (this.is5e) {
            if (this.system.XMLID === "PENALTY_SKILL_LEVELS") {
                switch (this.system.OPTIONID) {
                    case "SINGLE":
                        return 1;
                    case "TIGHT":
                        return 3; // To match CSLs
                    case "ALL":
                        // No restrictions
                        return +Infinity;
                }
            }
        } else {
            // 6e
            if (this.system.XMLID === "PENALTY_SKILL_LEVELS") {
                // 6e Defensive PSLs don't apply to any attacks so they need no custom adders
                if (this.system.OPTIONID === "SINGLEDCV" || this.system.OPTIONID === "GROUPDCV") {
                    return 0;
                }

                switch (this.system.OPTIONID) {
                    case "SINGLE":
                        return 1;
                    case "THREE":
                        return 3;
                    case "ALL":
                        // No restrictions
                        return +Infinity;
                }
            }
        }

        console.error(`Unhandled PSL ${this.detailedName()}/${this.is5e}`);
        return 0;
    }

    get combatSkillLevelsForAttack() {
        return combatSkillLevelsForAttack(this);
    }

    static migrateData(source) {
        // Many of these items should have been done during specific version migrations.
        // If migration is interrupted or ITEM is on sidebar (actorless) it may have been skipped.
        // SEE: migration.mjs:commitActorAndItemMigrateDataChangesByActor

        this.migrateData_missingOPTIONID(source);
        this.migrateData_missingXMLID(source);
        this.migrateData_4_0_26(source);
        this.migrateData_4_2_5(source);

        return super.migrateData(source);
    }

    static migrateData_missingOPTIONID(source) {
        try {
            // Super old HDC files don't use OPTIONID.

            // Early out for when we have an OPTIONID, no need to traverse all the ADDERs and such
            if (source.system?.OPTIONID) return;

            // Making an educated guess so "most" of our code references OPTIONID.
            if (source.system?.OPTION && !source.system?.OPTIONID) {
                foundry.utils.mergeObject(source, { "system.OPTIONID": source.system.OPTION.toUpperCase() });
                // Choosing not to persist at this time, but if item is edited, it will be persisted.
            }

            function recursiveOptionId(data) {
                if (!data) return;

                for (const mod of data.MODIFIER || []) {
                    if (mod.OPTION && !mod.OPTIONID) {
                        mod.OPTIONID = mod.OPTION.toUpperCase();
                    }
                }
                for (const adder of data.ADDER || []) {
                    if (adder.OPTION && !adder.OPTIONID) {
                        adder.OPTIONID = adder.OPTION.toUpperCase();
                    }
                }
                for (const power of data.POWER || []) {
                    if (power.OPTION && !power.OPTIONID) {
                        power.OPTIONID = power.OPTION.toUpperCase();
                    }
                }

                // recurse part
                for (const mod of data.MODIFIER || []) {
                    const mod2 = recursiveOptionId(mod);
                    if (mod2?.OPTION && !mod2.OPTIONID) {
                        mod2.OPTIONID = mod2.OPTION.toUpperCase();
                    }
                }
                for (const adder of data.ADDER || []) {
                    const adder2 = recursiveOptionId(adder);
                    if (adder2?.OPTION && !adder2.OPTIONID) {
                        adder2.OPTIONID = adder2.OPTION.toUpperCase();
                    }
                }
                for (const power of data.POWER || []) {
                    const power2 = recursiveOptionId(power);
                    if (power2?.OPTION && !power2.OPTIONID) {
                        power2.OPTIONID = power2.OPTION.toUpperCase();
                    }
                }
            }

            return recursiveOptionId(source.system);
        } catch (e) {
            console.error(e);
        }
    }

    static migrateData_missingXMLID(source) {
        // Invalid (super old) items are hard for us to handle,
        // So invalidate them.  Simple invalidation is to make this a invalid Item.type.
        // Implemented in 4.2.14 in Feb 2026.
        // Careful as source may be a list of updates instead of the entire item
        // so checking to see if name/img/ownership/ect was included.
        if (
            source.name &&
            source.img &&
            source.ownership &&
            source.sort &&
            source._stats &&
            source.system?.XMLID == null &&
            !source.type.startsWith("_")
        ) {
            source.type = `_${source.type}`;
            // Unable to persist because you can't write an invalid item type to the DB.
        }

        // We discussed deleting these item, or even the entire actor when
        // the upload version is older than 3.0.75 (or non-existent).
    }

    static migrateData_4_2_5(source) {
        // 4.2.5 migration
        // We used to store charge data as a object.
        // This has changed and we would like to salvage the current charges & clips.
        // A migration script re-writes this data and we should eventually be
        // able to remove this (Dec 23 2025 / migrateTo4_2_5)
        if (source.system?.charges?.max && !source.system._charges) {
            console.log(`${source.name} has deprecated charges object. Migrating.`);

            // Move system.charges.value to .system._charges
            if (!this._addDataFieldMigration(source, "system.charges.value", "system._charges")) {
                console.error(`Unable to migrate "system.charges.value: for ${source.name}/${source._id}`);
            }

            // Move system.charges.clips to .system._clips
            if (!this._addDataFieldMigration(source, "system.charges.clips", "system._clips")) {
                console.error(`Unable to migrate "system.charges.clips: for ${source.name}/${source._id}`);
            }

            // Delete the now migrated system.charges object.
            // This is the data that needs removed from that database. No longer needed as we migrated
            // important values to _charges and _clips.
            foundryVttDeleteProperty(source, "system.charges");

            // Signal to migration code that this object has changed and needs to be persisted to the DB
            tagObjectForPersistence(source);
        }
    }

    static migrateData_4_0_26(source) {
        // Remove the isHeroic property as it is now calculated on the fly
        if (source.system?.isHeroic !== undefined) {
            delete source.system.isHeroic;
            tagObjectForPersistence(source);
        }
    }

    async placeTemplate(message) {
        if (!this.aoe) throw Error("Attempted to create template with non-aoe item");
        return this.placeItemTemplate({ message });
    }

    async placeItemTemplate(options = {}) {
        const message = options.message;

        if (!canvas.ready) throw Error("No canvas");

        const areaOfEffect = this.aoeAttackParameters;
        if (!areaOfEffect) throw Error("No aoeAttackParameters");

        const aoeType = areaOfEffect.type;
        const aoeValue = areaOfEffect.value;
        const heroAoeTypeToFoundryAoeTypeConversions = {
            any: "rect",
            cone: "cone",
            line: "ray",
            radius: "circle",
            surface: "rect",
        };
        const templateType = heroAoeTypeToFoundryAoeTypeConversions[aoeType];
        const sizeConversionToMeters = convertSystemUnitsToMetres(1, this.actor?.is5e);
        const hexTemplates = game.settings.get(HEROSYS.module, "HexTemplates");
        const hexGrid = currentSceneUsesHexGrid();

        // NOTE: If we're using hex templates (i.e. 5e), the target hex is in should count as a distance of 1". This means that to convert to what FoundryVTT expects
        //       for distance we need to subtract 0.5"/1m from the radius.
        // NOTE: MeasuredTemplates assume that the distance is in grid units.
        const distanceInMeters = aoeValue * sizeConversionToMeters - (hexTemplates && hexGrid ? 1 : 0);
        const distanceInGridUnits = distanceInMeters / gridUnitsToMeters();

        const templateData = {
            t: templateType,
            author: game.user.id,
            distance: distanceInGridUnits,
            fillColor: game.user.color,
            flags: {
                [game.system.id]: {
                    messageId: message?.id,
                    purpose: "AoE",
                    item: this,
                },
            },
        };

        return canvas.templates.createPreview(templateData);
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

    // Create a unique HDC ID
    modifierOrAdderData.ID = new Date().getTime();

    // Ensure consistant tagName
    modifierOrAdderData.xmlTag = xmlDoc.children[0].tagName;

    return modifierOrAdderData;
}

/**
 * Replace the base cost for a particular item. This is sometimes required because when creating a 1/2 die
 * or 1d6-1 die adder will have a different base cost based on the item it's applying to. For instance a killing attack
 * will cost 10 ap and a normal sight flash is 1.5 ap.
 *
 * @param {String} xml
 */
export function replaceBaseCostForHalfDieAdderXml(item, xml) {
    const { baseApPerDie } = calculateApPerDieForItem(item);

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
            console.error(`${item.detailedName()} for ${item.actor.name} has unknown base active points per die`);
            break;
    }

    xml = xml.replace(/BASECOST="[\d.]+"/, `BASECOST="${baseCost}"`);

    return xml;
}

export function replaceBaseCostForPipAdderXml(item, xml) {
    const { baseApPerDie } = calculateApPerDieForItem(item);

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
            console.error(`${item.detailedName()} for ${item.actor.name} has unknown base active points per die`);
            break;
    }

    xml = xml.replace(/BASECOST="[\d.]+"/, `BASECOST="${baseCost}"`);

    return xml;
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

/**
 *
 * @param {HeroSystem6eItem} item
 * @param {Object} options
 * @returns {Boolean} - success
 *
 * The RaR is the Requires A Roll including Activation roll from 5e.
 * If the Activation roll is a simple throw then it is quite easily done.
 * If it is connected to a Skill or Characteristic then the correct roll must be discovered.
 * There are several places a player might put information to tie the RaR to an existing skill/characteristic.
 *
 * 1) ALIAS/Display: RaR has a Display in HD which is ALIAS here: an editable field which users are likely to change to indicate their selected roll, as it shows naturally on the sheet.
 * 2) OPTION/Options: the Options field in RaR that can also be edited.
 * 2--a ) OPTIONID/Options: the same drop-down gives and uneditable flag that indicates things like
 *    - Activation roll
 *    - Skill roll
 *    - Characteristic roll
 *    - PER roll
 *    - KS, PS, SS roll (Background skills)
 *    - and the difficulty -1/10 (default), -1/5 (hard), -1/20 (easy)
 * 3) COMMENTS/Comments: is an editable field that users might use to indicate the roll required.
 * 4) ROLLALIAS: is a 5e only editable field that users might use to indicate the roll required.
 *
 * the Skills to be matched will be generally be referenced as 'o' as they are considered in anonymous find functions.
 * ex: filterSkillRollItems which filters out skill items from skill enhancers and skill level bonuses.
 * Skills that are to be matched will be 'rollable' skills.
 * Most skills are only taken once, the user is warned if they purchase multiple copies of the same skill.
 * One exception is the POWERSKILL which is expected to be customized per power and purchased multiple times.
 * Likewise with the Background skills (KS, PS, SS) are a special case as they can be purchased multiple times with different INPUTs.
 * The Background skills are only matched when the RaR is looking for one of those specifically.
 * The RaR will have an OPTIONID of KS, PS, or SS which must match the skill's XMLID.
 *
 * 1) o.name/Name
 * 2) o.system.ALIAS/Display
 * 3) o.system.XMLID/XMLID
 * 4) o.system.INPUT/(Science/Knowledge/ (Background skills only)
 *
 *
 */
export async function rollRequiresASkillRollCheck(item, options = {}) {
    const rar = item.modifiers.find((o) => o.XMLID === "REQUIRESASKILLROLL" || o.XMLID === "ACTIVATIONROLL");
    if (!rar) {
        return true;
    }
    // todo why OPTION and not OPTIONID to look for background skills (OPTIONID can't be altered by user)
    const rarOptionIsBackground = rar.OPTION.substring(0, 2).toUpperCase();

    const filterSkillRollItems = (o) => {
        if (!o.isRollable()) {
            return false;
        }
        return (
            o.baseInfo?.type?.includes("skill") && // is a skill
            !o.baseInfo?.type?.includes("enhancer") && // is not an enhancer (scholar, scientist, etc.)
            o.system.XMLID !== "SKILL_LEVELS" && // is not a bonus to skills
            o.system.XMLID !== "COMBAT_LEVELS" // is not a bonus to combat
        );
    };

    // NaN if there is no number at the start of the OPTION (14 11 8 etc) for standard activation rolls
    const findRollValue = (rar) => {
        const value = parseInt(rar.OPTION, 10);
        return value;
    };

    const findSkillRoll = (rar) => {
        const rarAliasDisplay = rar.ALIAS?.toUpperCase() || ""; // From the "Display" field. ex: "Requires A Magic Roll"
        // OPTION_ALIAS is different in 5e: it is entered in the Type field
        const rarOptionsAlias = rar.OPTION_ALIAS?.toUpperCase() || ""; // From the "Options" field. ex: "Magic Roll, -1 per 5 Active Points modifier"
        const rarComments = rar.COMMENTS?.toUpperCase() || ""; // From Comments, begins blank, common use would be to enter just the skill name
        const rarRollAlias = rar.ROLLALIAS?.toUpperCase() || ""; // From the 5e "Roll" field. ex: "STR", "Acrobatics"

        const rar_AliasDisplay = rarAliasDisplay.replaceAll(" ", "_");
        const rar_OptionsAlias = rarOptionsAlias.replaceAll(" ", "_");
        const rar_Comments = rarComments.replaceAll(" ", "_");
        const rar_RollAlias = rarRollAlias.replaceAll(" ", "_");

        const matchRequiredSkillRoll = (o) => {
            // TODO
            // it might be worthwhile to also try with underscores in the XMLID '_' replaced with spaces ' ' to match better
            // or vice versa, put underscores in the stable RaR strings and search with underscores present
            // this is IN ADDITION to what's here now; dont replace this
            const xmlIdMatch =
                rarAliasDisplay.includes(o.system.XMLID) ||
                rarOptionsAlias.includes(o.system.XMLID) ||
                rarRollAlias.includes(o.system.XMLID) ||
                rarComments.includes(o.system.XMLID);
            if (xmlIdMatch) {
                return true;
            }
            const nameUpper = o.name?.toUpperCase() ?? "";
            const nameMatch =
                nameUpper &&
                rarOptionIsBackground !== nameUpper &&
                (rarAliasDisplay.includes(nameUpper) ||
                    rarOptionsAlias.includes(nameUpper) ||
                    rarRollAlias.includes(nameUpper) ||
                    rarComments.includes(nameUpper));
            if (nameMatch) {
                return true;
            }
            const aliasUpper = o.system.ALIAS?.toUpperCase() ?? "";
            const aliasMatch =
                aliasUpper &&
                rarOptionIsBackground !== aliasUpper &&
                (rarAliasDisplay.includes(aliasUpper) ||
                    rarOptionsAlias.includes(aliasUpper) ||
                    rarRollAlias.includes(aliasUpper) ||
                    rarComments.includes(aliasUpper));
            if (aliasMatch) {
                return true;
            }
            // Some skills have an underscore in them; the user might not have the name matched exactly
            // so if there is an underscore (as in SLEIGHT_OF_HAND), we check for that here
            const xml_Id_Match =
                /_/.test(o.system.XMLID) &&
                (rar_AliasDisplay.includes(o.system.XMLID) ||
                    rar_OptionsAlias.includes(o.system.XMLID) ||
                    rar_RollAlias.includes(o.system.XMLID) ||
                    rar_Comments.includes(o.system.XMLID));
            if (xml_Id_Match) {
                return true;
            }

            // TODO check 'Text'?
            // TODO check 'Type'?
            return false;
        };

        const backgroundSkillKeys = {
            // matches RaR OPTION to XMLID
            KS: "KNOWLEDGE_SKILL",
            SS: "SCIENCE_SKILL",
            PS: "PROFESSIONAL_SKILL",
        };

        const isBackgroundSkillType = () => {
            return rar.OPTIONID === "BASICRSR" || Object.keys(backgroundSkillKeys).includes(rarOptionIsBackground);
        };

        const matchBackgroundSkillType = (o) => {
            return rar.OPTIONID === "BASICRSR" || backgroundSkillKeys[rarOptionIsBackground] === o.system.XMLID;
        };

        const matchBackgroundSkillRoll = (o) => {
            if (!matchBackgroundSkillType(o)) {
                return false;
            }
            const inputUpper = o.system.INPUT?.toUpperCase() ?? "";
            const inputMatch =
                inputUpper &&
                rarOptionIsBackground !== inputUpper &&
                (rarAliasDisplay.includes(inputUpper) ||
                    rarOptionsAlias.includes(inputUpper) ||
                    rarComments.includes(inputUpper));
            if (inputMatch) {
                return true;
            }
            return matchRequiredSkillRoll(o);
        };

        if (rar.OPTIONID === "PER" || rar.ROLLALIAS === "PER") {
            return item.actor.items.find((o) => o.system.XMLID === "PERCEPTION");
        } else if (rar.OPTIONID.includes("LUCK")) {
            return item.actor.items.find((o) => o.system.XMLID === "LUCK");
        } else if (isBackgroundSkillType()) {
            return item.actor.items.find((o) => filterSkillRollItems(o) && matchBackgroundSkillRoll(o));
        }
        return item.actor.items.find((o) => filterSkillRollItems(o) && matchRequiredSkillRoll(o));
    };

    const findRollDivisor = (rar) => {
        // item.activePoints is a number
        if (rar.OPTIONID.includes("1PER5")) {
            return 5;
        }
        if (rar.OPTIONID.includes("1PER20")) {
            return 20;
        }
        const divisorOption = rar.ADDER.find((o) => {
            return o.XMLID === "MINUS1PER20" || o.XMLID === "MINUS1PER5";
        });

        if (divisorOption?.XMLID === "MINUS1PER20") {
            return 20;
        }
        if (divisorOption?.XMLID === "MINUS1PER5") {
            return 5;
        }
        // activation rolls have no minuses due to active points
        if (!isNaN(parseInt(rar.OPTION, 10))) {
            return NaN;
        }
        return 10;
    };

    const findRollMinus = (rar) => {
        const divisor = findRollDivisor(rar);
        if (isNaN(divisor)) {
            return 0;
        }
        return Math.floor(parseInt(item.activePoints) / divisor);
    };

    const characteristicKeys = Object.keys(item.actor.system.characteristics).filter(
        (k) => item.actor.system.characteristics[k].roll != null,
    );
    const rarDisplayMaybeHasCharKey = rar.ALIAS?.toLowerCase() || "";
    const rarOptionMaybeHasCharKey = rar.OPTION_ALIAS?.toLowerCase() || "";
    const rarCommentMaybeHasCharKey = rar.COMMENTS?.toLowerCase() || ""; // pre or presence, STR or Strength
    const rarRollAliasMaybeHasCharKey = rar.ROLLALIAS?.toLowerCase() || "";
    // The \b ensures the match is at the start of a word
    const characteristicKeyRegex = characteristicKeys.reduce((accumulator, currentKey) => {
        // For each key, create the RegExp object
        const regex = new RegExp(`\\b${currentKey}`, "i");
        accumulator[currentKey] = regex;
        return accumulator;
    }, {});

    const getRequiredCharacteristicKey = () => {
        // exact match in comments
        if (characteristicKeys.includes(rarCommentMaybeHasCharKey)) {
            // finds pre, not presence
            return rarCommentMaybeHasCharKey;
        }
        // comment would be Strength, Intelligence, Presence etc.
        const matchedKeyInComment = characteristicKeys.find((key) =>
            characteristicKeyRegex[key].test(rarCommentMaybeHasCharKey),
        );
        if (matchedKeyInComment) {
            return matchedKeyInComment;
        }
        const matchedKeyInName = characteristicKeys.find((key) =>
            characteristicKeyRegex[key].test(rarDisplayMaybeHasCharKey),
        );
        if (matchedKeyInName) {
            return matchedKeyInName;
        }
        const matchedKeyInRollAlias = characteristicKeys.find((key) =>
            characteristicKeyRegex[key].test(rarRollAliasMaybeHasCharKey),
        );
        if (matchedKeyInRollAlias) {
            return matchedKeyInRollAlias;
        }
        const matchedKeyInOption = characteristicKeys.find((key) =>
            characteristicKeyRegex[key].test(rarOptionMaybeHasCharKey),
        );
        return matchedKeyInOption ?? "";
    };

    const charKey = getRequiredCharacteristicKey();

    // if the RaR is an Activation roll, then we have the value we need
    let value = findRollValue(rar);
    let skill = undefined;
    let char = undefined;
    if (isNaN(value)) {
        if (rar.OPTIONID !== "CHAR") {
            skill = findSkillRoll(rar);
        }
        if (!skill) {
            char = item.actor.system.characteristics[charKey];
            if (char) {
                // if we weren't supposed to look for a char but we had to find one the rar is not constructed right
                // 5e BASICRSR is Skills and Characteristics
                if (rar.OPTIONID !== "CHAR" && rar.OPTIONID !== "BASICRSR") {
                    ui.notifications.warn(
                        `${item.actor.name} has a power ${item.name}, which is incorrectly built.  Skill Roll for ${charKey.toUpperCase()} should be a Characteristic Roll.`,
                    );
                }
            } else {
                // could not find a skill or characteristic to match
                const typeOfRollRequired = rar.OPTIONID !== "CHAR" ? "known skill" : "characteristic";
                ui.notifications.warn(
                    `${item.actor.name} has a power ${item.name}. Expecting '${rar.OPTION} roll', where ${rar.OPTION} is the name of a ${typeOfRollRequired} that can be rolled.
                    <br>Put the name of the ${typeOfRollRequired} into the Options or Comments of the Requires A Roll modifier for the best results.`,
                );
                if (!overrideCanAct) {
                    const actor = item.actor;
                    const token = actor.token;
                    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
                    speaker.alias = actor.name;
                    const overrideKeyText = game.keybindings.get(HEROSYS.module, "OverrideCanAct")?.[0].key;

                    const chatData = {
                        style: CONST.CHAT_MESSAGE_STYLES.IC,
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
    }
    // TODO: for refactor the above should return: skill, char, value, rollModifier so that the output can be constructed.

    let succeeded = false;
    let flavor = "";
    let cardHtml = "";
    let roller = null;
    const usefulAlias = rarOptionIsBackground !== skill?.system.ALIAS ? skill?.system.ALIAS : "";
    const skillName = skill?.system.INPUT || usefulAlias || skill?.name;
    const charName = charKey?.toUpperCase();
    const activationFrom = skill ? `${skillName}:` : char ? `${charName}:` : "";
    if (skill?.system.XMLID === "LUCK") {
        const { diceParts } = calculateDicePartsForItem(skill, {});

        roller = new HeroRoller()
            .modifyTo5e(skill.actor.system.is5e)
            .makeEffectRoll()
            .addDice(diceParts.d6Count >= 1 ? diceParts.d6Count : 0)
            .addHalfDice(diceParts.halfDieCount >= 1 ? diceParts.halfDieCount : 0)
            .addDiceMinus1(diceParts.d6Less1DieCount >= 1 ? diceParts.d6Less1DieCount : 0)
            .addNumber(diceParts.constant);

        await roller.roll();

        const lucky = roller.getEffectTerms();
        // Each “6” rolled counts as 1 point of Luck.
        const luck = lucky.reduce((accumulator, dieRoll) => {
            if (dieRoll === 6) {
                accumulator += 1;
            }
            return accumulator;
        }, 0);
        if (rar.OPTIONID === "ONELUCK") {
            succeeded = luck >= 1;
        } else if (rar.OPTIONID === "TWOLUCK") {
            succeeded = luck >= 2;
        } else if (rar.OPTIONID === "THREELUCK") {
            succeeded = luck >= 3;
        }
        flavor = `${item.name} (${activationFrom} rolled ${lucky} for ${luck} points) activation ${succeeded ? "succeeded" : "failed"} `;
    } else {
        if (skill) {
            // skill.system.roll is a string
            value = parseInt(skill.system.roll);
            if (isNaN(value)) {
                // sumthing wrong with the skill?
                value = 11;
            }
        } else if (char) {
            // a char.roll is an int
            value = char.roll;
        } else if (!value) {
            ui.notifications.warn(`${item.actor.name} has a power ${item.name}. ${rar.OPTION_ALIAS} is not supported.`);
            // Try to continue
            value = 11;
        }
        const minus = findRollMinus(rar);
        value -= minus;
        const successValue = parseInt(value);

        //TODO what about additional skill levels used to influence the activation roll?
        roller = new HeroRoller().makeSuccessRoll(true, successValue).addDice(3);
        await roller.roll();
        succeeded = roller.getSuccess();
        const autoSuccess = roller.getAutoSuccess();
        const total = roller.getSuccessTotal();
        const margin = successValue - total;

        const targetRoll = skill ? skill.system.roll : char ? char.roll : `${rar.OPTION_ALIAS}:${value}-`;
        const divisor = findRollDivisor(rar);
        const penalty = isNaN(divisor) ? "" : `, -1 per ${divisor} active points`;

        const penaltyString = penalty ? `${penalty}: -${minus}` : "";

        flavor = `${item.name} (${activationFrom}${targetRoll}${penaltyString}) activation ${
            succeeded ? "succeeded" : "failed"
        } by ${autoSuccess === undefined ? `${Math.abs(margin)}` : `rolling ${total}`}`;
    }
    cardHtml = await roller.render(flavor);

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

    if (!succeeded && options.resourcesUsedDescription) {
        cardHtml += `Spent ${options.resourcesUsedDescription}.`;
    }

    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC,
        rolls: roller.rawRolls(),
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

export async function rollAblativeActivationCheck(item) {
    const ablative = item.modifiers.find((o) => o.XMLID === "ABLATIVE");
    if (!ablative) {
        return true;
    }

    // Must be ablative
    let cardHtml;
    let rawRolls;
    let succeeded;
    const thresholdExceeded = item.system.ablative;
    if (thresholdExceeded > 0 && thresholdExceeded < 9) {
        const successValue = 16 - thresholdExceeded;

        //TODO what about additional skill levels used to influence the activation roll?
        const ablativeActivationRoller = new HeroRoller().makeSuccessRoll(true, successValue).addDice(3);

        await ablativeActivationRoller.roll();
        rawRolls = ablativeActivationRoller.rawRolls();

        succeeded = ablativeActivationRoller.getSuccess();
        const autoSuccess = ablativeActivationRoller.getAutoSuccess();
        const total = ablativeActivationRoller.getSuccessTotal();
        const margin = successValue - total;

        const flavor = `Ablative ${item.name} activation ${
            succeeded ? "succeeded" : "failed"
        } by ${autoSuccess === undefined ? `${Math.abs(margin)}` : `rolling ${total}`}`;

        cardHtml = await ablativeActivationRoller.render(flavor);
    } else if (thresholdExceeded === 0) {
        // Defense has not yet been ablated so it always works.
        cardHtml = `Unablated ${item.name} guaranteed activation`;
        succeeded = true;
    } else {
        // Defense has been fully ablated so it never works.
        cardHtml = `Fully ablated ${item.name} never activates`;
        succeeded = false;
    }

    const actor = item.actor;
    const token = actor.token;
    const speaker = ChatMessage.getSpeaker({ actor: actor, token });
    const chatData = {
        style: CONST.CHAT_MESSAGE_STYLES.IC,
        rolls: rawRolls,
        author: game.user._id,
        content: cardHtml,
        speaker: speaker,
    };

    await ChatMessage.create(chatData);

    return succeeded;
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

// PH: FIXME: should use energy blast if can't add STR to weapon or HANDTOHANDATTACK if can?
// PH: FIXME: Cloning the advantages?
export function buildItemAsClub(effectivePower, actor, name) {
    const clubItem = new HeroSystem6eItem(
        HeroSystem6eItem.itemDataFromXml(
            `<POWER XMLID="ENERGYBLAST" ID="1709333792635" BASECOST="0.0" LEVELS="1" ALIAS="${name} as club" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
            actor,
        ),
        {
            parent: actor,
        },
    );

    clubItem.name = name;

    return clubItem;
}

/**
 * Create an uninitialized in-memory item.
 *
 * Caller can do further changes, such as linking items
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
    // PH: FIXME: Add a way to create a new power type. Change the name of the function. Check CLUBWEAPON and
    //            probably want to give a warning if CLUBWEAPON is on and the attack is not a killing attack.
    // const clubWeaponActive = originalItem.actor?.items.find(
    //     (anItem) => anItem.isCombatManeuver && anItem.system.XMLID === "CLUBWEAPON" && anItem.isActive,
    // );

    let effectiveItem;
    const effectiveItemData = originalItem.toObject(false);
    effectiveItemData._id = null;
    effectiveItem = new HeroSystem6eItem(effectiveItemData, { parent: originalItem.actor });
    effectiveItem.system._active = { __originalUuid: originalItem.uuid };

    // PH: FIXME: Doesn't include TK
    // PH: FIXME: Doesn't include items with STR minima
    // Does this item allow strength to be added and has the character decided to use strength to augment the damage?
    let strengthItem = null;
    if (effectiveStr > 0 && originalItem.system.usesStrength) {
        strengthItem = buildStrengthItem(effectiveStr, originalItem.actor, `STR used with ${originalItem.name}`);

        // Pushing?
        strengthItem.system._active.pushedRealPoints = effectiveStrPushedRealPoints;

        effectiveItem.system._active.linkedEnd ??= [];
        effectiveItem.system._active.linkedEnd.push({
            item: strengthItem,
        });
    }

    // PH: FIXME: We can get rid of the effectiveStr field in the active because we'll just have the actual STR item
    effectiveItem.system._active.effectiveStr = effectiveStr;
    effectiveItem.system._active.effectiveStrItem = strengthItem;

    // PH: FIXME: Need to link in TK as appropriate into STR?

    // Reduce or Push the item
    effectiveItem.changePowerLevel(effectiveRealCost);
    effectiveItem.system._active.pushedRealPoints = pushedRealPoints;

    return {
        effectiveItem,
        strengthItem,
    };
}

/**
 *
 * @param {Object} effectiveObjectParameters
 * @param {HeroSystem6eItem} effectiveObjectParameters.originalItem
 * @param {Number} effectiveObjectParameters.effectiveRealCost
 * @param {Number} effectiveObjectParameters.pushedRealPoints
 * @param {Number} effectiveObjectParameters.effectiveStr
 * @param {Number} effectiveObjectParameters.effectiveStrPushedRealPoints
 * @param {String} effectiveObjectParameters.maWeaponId
 * @param {HeroSystem6eItem[]} effectiveObjectParameters.hthAttackItems
 * @param {HeroSystem6eItem[]} effectiveObjectParameters.nakedAdvantagesItems
 * @param {Object} effectiveObjectParameters.autofire
 * @param {Number} effectiveObjectParameters.autofire.shots
 * @param {Number} effectiveObjectParameters.autofire.maxShots
 *
 * @returns
 */
export function buildEffectiveObject(effectiveObjectParameters) {
    const { effectiveItem, strengthItem } = cloneToEffectiveAttackItem({
        originalItem: effectiveObjectParameters.originalItem,
        effectiveRealCost: effectiveObjectParameters.effectiveRealCost,
        pushedRealPoints: effectiveObjectParameters.pushedRealPoints,
        effectiveStr: effectiveObjectParameters.effectiveStr,
        effectiveStrPushedRealPoints: effectiveObjectParameters.effectiveStrPushedRealPoints,
    });

    // How many shots for this attack (aka autofire)
    effectiveItem.system._active.autofire = effectiveObjectParameters.autofire;

    // Martial Arts weapon being used?
    if (effectiveObjectParameters.maWeaponId) {
        effectiveItem.system._active.maWeaponItem = effectiveObjectParameters.originalItem.actor.items.find(
            (item) => item.id === effectiveObjectParameters.maWeaponId,
        );

        if (effectiveItem.system._active.maWeaponItem) {
            effectiveItem.system._active.linkedAssociated ??= [];
            effectiveItem.system._active.linkedAssociated.push({
                item: effectiveItem.system._active.maWeaponItem,
                uuid: effectiveItem.system._active.maWeaponItem.uuid,
            });
        }
    }

    // Active points for the base item. For maneuvers this could be STR or a weapon.
    const effectiveItemActivePointsBeforeHthAndNaAdvantages = effectiveItem.baseInfo.baseEffectDicePartsBundle(
        effectiveItem,
        {},
    ).baseAttackItem._activePoints;

    // Add any checked & appropriate Hand-to-Hand Attack advantages into the base item
    let hthAttackDisabledDueToStrength = false;
    Object.entries(effectiveObjectParameters.hthAttackItems)
        .filter((_, index, array) => {
            // If there is no strength item or effective strength is less than 3 then we don't have enough
            // strength applied to allow HTH Attacks
            // PH: FIXME: Should look at strengthItem's actual strength
            // PH: FIXME: Need to consider real weapons w/ STRMINIMUM
            if (!strengthItem || effectiveObjectParameters.effectiveStr < 3) {
                if (array[index][1]._canUseForAttack) {
                    hthAttackDisabledDueToStrength = true;
                }

                array[index][1]._canUseForAttack = false;
                array[index][1].reasonForCantUse = "Must use at least 3 (½d6) STR to add a hand-to-hand attack";

                return false;
            }

            array[index][1].reasonForCantUse = "";

            if (!array[index][1]._canUseForAttack) {
                return false;
            }

            return true;
        })
        .map(([uuid]) => fromUuidSync(uuid))
        .forEach((hthAttack) => {
            // 5e only: Can add advantages from HA to STR if HA's unmodified active points don't exceed the STR used.
            // 6e only: PH: FIXME: the HA becomes the base attack item.
            // PH: FIXME: Need to consider STRMINIMUM
            const haBaseCost = hthAttack._basePoints;
            if (hthAttack.is5e && haBaseCost >= effectiveItemActivePointsBeforeHthAndNaAdvantages) {
                // Endurance advantages and limitations don't apply to strength
                // Invisible Power Effects does not transfer to STR if on the HTH Attack
                const ignoreAdvantagesForHthAttack = ["INCREASEDEND", "REDUCEDEND", "INVISIBLE"];

                // PH: FIXME: AoE gets an increased radius based on STR used (so effectively double the radius)
                // PH: FIXME: AoE gets the radius built from the HA not based on the effective item
                effectiveItem.copyItemAdvantages(hthAttack, ignoreAdvantagesForHthAttack);
                strengthItem?.copyItemAdvantages(hthAttack, ignoreAdvantagesForHthAttack);
            } else if (hthAttack.is5e) {
                ui.notifications.warn(
                    `${hthAttack.detailedName()} has fewer unmodified active points (${haBaseCost}) than STR (${effectiveItemActivePointsBeforeHthAndNaAdvantages}). Advantages do not apply.`,
                );
            } else if (!hthAttack.is5e && hthAttack.advantages.length > 0) {
                ui.notifications.warn(
                    `6e Advantaged Hand-to-Hand Attacks not supported. Advantages for ${hthAttack.detailedName()} are not applied.`,
                );
            }

            effectiveItem.system._active.linkedAssociated ??= [];
            effectiveItem.system._active.linkedAssociated.push({
                item: hthAttack,
                uuid: hthAttack.uuid, // PH: FIXME: Do we want UUID? Much easier if actually an item.
            });
        });
    if (hthAttackDisabledDueToStrength) {
        ui.notifications.warn(`Must use at least 3 (½d6) STR to add a hand-to-hand attack`);
    }

    // Add any Naked Advantages into the base item
    // PH: FIXME: Typically the NA should reduce the duration of the power to instant although it can be bought up. Should consider modification of duration
    // PH: FIXME: Need to implement endurance usage. A REDUCE END NA will reduce the base attack's END use but otherwise the NA endurance usage is paid separately.
    let nakedAdvantagesDisabledDueToActivePoints = false;
    Object.entries(effectiveObjectParameters.nakedAdvantagesItems)
        .map(([uuid], index, array) => {
            const naItem = fromUuidSync(uuid);

            // Item the NA is being applied to must not exceed the AP of the NA was designed against.
            // TODO: This implies that one cannot push with a NA. Is this correct?
            const naEffectiveAgainstAp = parseInt(naItem.system.LEVELS || 0);

            // 5e and 6e have different rules as far as applying multiple naked advantages. 6e states that the effect of the first NA counts
            // as a part of the power's AP for the purposes of adding a 2nd NA. 5e (FRed) does not have this rule.
            const effectiveItemApForNaComparison = naItem.is5e
                ? effectiveItemActivePointsBeforeHthAndNaAdvantages
                : effectiveItem._activePoints;
            if (naEffectiveAgainstAp < effectiveItemApForNaComparison) {
                if (array[index][1]._canUseForAttack) {
                    nakedAdvantagesDisabledDueToActivePoints = true;
                }

                array[index][1]._canUseForAttack = false;
                array[index][1].reasonForCantUse =
                    `${naItem.detailedName()} is effective against ${naEffectiveAgainstAp} AP but the base attack is ${effectiveItemActivePointsBeforeHthAndNaAdvantages} AP`;

                return undefined;
            }

            array[index][1].reasonForCantUse = "";

            if (!array[index][1]._canUseForAttack) {
                return undefined;
            }

            effectiveItem.copyItemAdvantages(naItem, []);
            effectiveItem.system._active.linkedEnd ??= [];
            effectiveItem.system._active.linkedEnd.push({
                item: naItem,
                uuid: uuid, // PH: FIXME: Do we want UUID? Much easier if actually an item.
            });

            strengthItem?.copyItemAdvantages(naItem, []);

            // PH: FIXME: active points from NA should be automatically adjusted to reflect the AP in the effective item (i.e. 30 AP effective item
            //            shouldn't have to pay full END for NA that can affect up to 90 AP - it should just be dipped down to 30 AP)

            return naItem;
        })
        .filter(Boolean);

    if (nakedAdvantagesDisabledDueToActivePoints) {
        ui.notifications.warn(
            `Naked Advantages must be able to apply at least as many active points as the base attack${effectiveItem.is5e ? "" : " and other naked advantages"}`,
        );
    }

    return effectiveItem;
}

/**
 * FTL levels start at 0 (1 LY/Y) but don't behave quite right.
 * @param {Number} levels
 * @returns
 */
export function ftlLevelsToLightYearsPerYear(levels) {
    return levels < 7 ? Math.pow(2, levels) : 125 * Math.pow(2, levels - 7);
}

// for testing and pack-load-from-config macro
window.HeroSystem6eItem = HeroSystem6eItem;
