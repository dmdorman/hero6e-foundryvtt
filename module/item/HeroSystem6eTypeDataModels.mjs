import { HeroSystem6eActor } from "../actor/actor.mjs";
import { getPowerInfo, squelch, hdcTextNumberToNumeric } from "../utility/util.mjs";
import { HeroSystem6eItem } from "./item.mjs";
import { calculateVelocityInSystemUnits } from "../heroRuler.mjs";
import { HeroObjectCacheMixin } from "../utility/cache.mjs";
import {
    getManueverEffectWithPlaceholdersReplaced,
    getFullyQualifiedEffectFormulaFromItem,
    combatSkillLevelsForAttack,
} from "../utility/damage.mjs";
import { maneuverHasBlockTrait, maneuverHasFlashEffectTrait } from "./maneuver.mjs";
import { roundFavorPlayerAwayFromZero } from "../utility/round.mjs";

// XML parsing is expensive when done frequently during actions like loading characters.
// Use this for storing the parsed value and then clear it out after 10 seconds.
// NOTE: This is a kludge. The 10 seconds is based on the fact we don't really want to keep
//       cached versions of the result around for a long period of time as they use lots of memory.
//       A better long term solution would be to have a unique data type that had a timed cache in it.
class TimeClearedCache {
    #TIMEOUT_VALUE = 10000;
    #cacheValue = null;
    #timerId = null;

    get cacheValue() {
        return this.#cacheValue;
    }

    set cacheValue(value) {
        this.#cacheValue = value;

        // Clear out the cache sometime after it's set.
        if (!this.#timerId) {
            this.#timerId = setTimeout(() => {
                this.#cacheValue = null;
                this.#timerId = null;
            }, this.#TIMEOUT_VALUE);
        }
    }
}

const _chargeOptionIdToLevel = Object.freeze({
    ONE: -7,
    TWO: -6,
    THREE: -5,
    FOUR: -4,
    SIX: -3,
    EIGHT: -2,
    TWELVE: -1,
    SIXTEEN: 0,
    THIRTYTWO: 1,
    SIXTYFOUR: 2,
    ONETWENTYFIVE: 3,
    TWOFIFTY: 4,
    FIVEHUNDRED: 5,
    ONETHOUSAND: 6,
    TWOTHOUSAND: 7,
    FOURTHOUSAND: 8,
    EIGHTTHOUSAND: 9,
    SIXTEENTHOUSAND: 10,
});

export function getChargeOptionIdToLevel(optionId) {
    const level = _chargeOptionIdToLevel[optionId];
    if (level == null) {
        console.error(`OPTIONID ${optionId} doesn't have an entry in _chargeOptionIdToLevel`);
        return 0;
    }

    return level;
}

const { StringField, ObjectField, BooleanField, ArrayField, EmbeddedDataField, SchemaField } = foundry.data.fields;

class HeroNumberField extends foundry.data.fields.NumberField {
    _applyChangeMultiply(value, delta) {
        return roundFavorPlayerAwayFromZero(value * delta);
    }
}

class HeroItemModCommonModel extends foundry.abstract.DataModel {
    // constructor(data, context) {
    //     super(data, context);

    // }

    /** @inheritdoc */
    static defineSchema() {
        return {
            XMLID: new StringField(),
            ID: new HeroNumberField({ integer: true }),
            BASECOST: new HeroNumberField({ integer: false }),
            LEVELS: new HeroNumberField({ integer: true }),
            ALIAS: new StringField(),
            TEXT: new StringField(),
            POSITION: new HeroNumberField({ integer: true }),
            MULTIPLIER: new HeroNumberField({ integer: false }),
            GRAPHIC: new StringField(),
            COLOR: new StringField(),
            SFX: new StringField(),
            SHOW_ACTIVE_COST: new BooleanField({ initial: null, nullable: true }),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            INCLUDE_NOTES_IN_PRINTOUT: new BooleanField({ initial: null, nullable: true }),
            NAME: new StringField(),
            SHOWALIAS: new BooleanField({ initial: null, nullable: true }),
            PRIVATE: new BooleanField({ initial: null, nullable: true }),
            REQUIRED: new BooleanField({ initial: null, nullable: true }),
            INCLUDEINBASE: new BooleanField({ initial: null, nullable: true }),
            DISPLAYINSTRING: new BooleanField({ initial: null, nullable: true }),
            GROUP: new BooleanField({ initial: null, nullable: true }),
            SELECTED: new BooleanField({ initial: null, nullable: true }),
            _hdcXml: new StringField(),
            xmlTag: new StringField(),
            LVLCOST: new HeroNumberField({ integer: false }),
            FORCEALLOW: new BooleanField({ initial: null, nullable: true }),
            COMMENTS: new StringField(),
            LVLVAL: new HeroNumberField({ integer: false }),
            QUANTITY: new HeroNumberField({ integer: true }),
            AFFECTS_TOTAL: new StringField(),
            PARENTID: new HeroNumberField({ integer: true }),
            INPUT: new StringField(),
            AFFECTS_PRIMARY: new BooleanField({ initial: null, nullable: true }),
            LINKED_ID: new HeroNumberField({ integer: true }),
            ROLLALIAS: new StringField(),
            ROLLALIAS2: new StringField(),
            TYPE: new StringField(),
            TYPE2: new StringField(),
            DISPLAY: new StringField(),
            SCALE: new StringField(),
            CLIPS_COST: new HeroNumberField({ integer: false }),
            targetId: new StringField(), // CSL
        };
    }

    #cachedParsedXml = new TimeClearedCache();

    get hdcHTMLCollection() {
        try {
            if (this._hdcXml) {
                if (!this.#cachedParsedXml.cacheValue) {
                    this.#cachedParsedXml.cacheValue = new DOMParser().parseFromString(this._hdcXml, "text/xml");
                }
                return this.#cachedParsedXml.cacheValue;
            }
            return null;
        } catch (e) {
            console.error(e);
        }
        return null;
    }

    // Make sure all the attributes in the HDC XML are in our data model
    debugModelProps() {
        try {
            if (this._hdcXml) {
                for (const attribute of this.hdcHTMLCollection.firstChild.attributes) {
                    if (this.schema.fields[attribute.name] === undefined) {
                        const e = `${this.xmlTag} HeroItemModCommonModel is missing ${attribute.name} property.  Fix then reload ${this.actor.name}.`;
                        console.error(e);
                        return e;
                    }
                }

                for (const adder of this.ADDER || []) {
                    adder.debugModelProps();
                }
                for (const modifier of this.MODIFIER || []) {
                    modifier.debugModelProps();
                }
                for (const power of this.POWER || []) {
                    power.debugModelProps();
                }
            }
        } catch (e) {
            console.error(e);
            return e;
        }
    }

    #baseInfo = null;

    get baseInfo() {
        // cache getPowerInfo
        // Notice we are trying to infer xmlTag for legacy support (EXPLOSION on Viperia)
        this.#baseInfo ??= getPowerInfo({
            XMLID: this.XMLID,
            item: this.item,
            xmlTag:
                this.xmlTag ??
                (this.constructor.name.match(/MODIFIER/i) ? "MODIFIER" : undefined) ??
                (this.constructor.name.match(/ADDER/i) ? "ADDER" : undefined),
        });
        return this.#baseInfo;
    }

    get item() {
        if (this.parent instanceof HeroSystem6eItem) {
            return this.parent;
        }
        if (!this.parent) {
            console.error("unable to find item");
            return null;
        }
        return this.parent.item;
    }

    get actor() {
        return this.item.actor;
    }

    get cost() {
        console.error(`Unhandled cost in ${this.constructor.toString()}`);
        return 0;
    }

    get BASECOST_total() {
        return this.cost;
    }

    get adders() {
        return this.ADDER || [];
    }

    get modifiers() {
        return this.MODIFIER || [];
    }

    get powers() {
        return this.POWER || [];
    }
}

export class HeroAdderModelCommon extends HeroItemModCommonModel {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            clips: new HeroNumberField({ integer: true, min: 0, initial: 0, nullable: false }),
        };
    }

    get cost() {
        let _cost = 0;
        if (this.SELECTED !== false) {
            // Custom costs calculations
            if (this.baseInfo?.cost) {
                _cost = this.baseInfo.cost(this, this.item);
            } else {
                // Generic cost calculations
                _cost = parseFloat(this.BASECOST);

                let costPerLevel = this.baseInfo?.costPerLevel ? this.baseInfo?.costPerLevel(this) : 0;
                const levels = parseInt(this.LEVELS) || 0;
                // Override default costPerLevel?
                if (this.LVLCOST && levels > 0) {
                    const _costPerLevel = parseFloat(this.LVLCOST || 0) / parseFloat(this.LVLVAL || 1) || 1;
                    costPerLevel = _costPerLevel;
                }
                _cost += levels * costPerLevel;
            }
        }

        // Some parent modifiers need to override/tweak the adder costs (WEAPONSMITH)
        if (this.parent?.baseInfo?.adderCostAdjustment) {
            _cost = this.parent.baseInfo.adderCostAdjustment({ adder: this, adderCost: _cost });
        }

        // Some ADDERs have ADDERs (for example TRANSPORT_FAMILIARITY)
        for (const adder of this.adders) {
            _cost += adder.cost;
        }

        // TRANSPORT_FAMILIARITY (and others) may have a maximum cost per category
        if (this.SELECTED === false && this.item?.type === "skill") {
            const maxCost = parseFloat(this.BASECOST) || 0;
            if (maxCost > 0 && _cost > maxCost) {
                if (
                    this.item.system.XMLID !== "TRANSPORT_FAMILIARITY" &&
                    this.item.system.XMLID !== "WEAPON_FAMILIARITY" &&
                    this.item.system.XMLID !== "SURVIVAL" &&
                    this.item.system.XMLID !== "GAMBLING" &&
                    !(this.item.system.XMLID === "COMPUTER_PROGRAMMING" && this.item.is5e) &&
                    !(this.item.system.XMLID === "SYSTEMS_OPERATION" && this.item.is5e)
                ) {
                    console.warn(
                        `We found another example of a skill with category limitations ${this.item.system.XMLID}`,
                    );
                }
                _cost = Math.min(maxCost, _cost);
            }
        }

        return _cost;
    }
}

export class HeroAdderModel2 extends HeroAdderModelCommon {}

export class HeroAdderModel extends HeroAdderModelCommon {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            ADDER: new ArrayField(new EmbeddedDataField(HeroAdderModel2)),
            //MODIFIER: new ArrayField(new EmbeddedDataField(HeroModifierModel2)),
            //POWER: new ArrayField(new EmbeddedDataField(HeroPowerModel)),
        };
    }
}

class HeroModifierModelCommon extends HeroItemModCommonModel {
    get cost() {
        let _cost = 0;
        // Custom costs calculations
        if (this.baseInfo?.cost) {
            _cost = this.baseInfo.cost(this, this.item);
        } else {
            // Generic cost calculations
            _cost = parseFloat(this.BASECOST);

            let costPerLevel = this.baseInfo?.costPerLevel(this) || 0;
            const levels = parseInt(this.LEVELS) || 0;
            if (!costPerLevel && this.LVLCOST) {
                console.warn(
                    `${this.item?.actor.name}/${this.item?.detailedName()}/${this.XMLID}: is missing costPerLevel, using LVLCOST & LVLVAL`,
                );
                costPerLevel = parseFloat(this.LVLCOST || 0) / parseFloat(this.LVLVAL || 1) || 1;
            }
            _cost += levels * costPerLevel;
        }

        // Some MODIFIERs have ADDERs
        for (const adder of this.adders) {
            _cost += adder.cost;
        }

        // Some MODIFIERs have MODIFIERs (CONTINUOUSCONCENTRATION, ACTIVATEONLY, etc.)
        for (const modifier of this.modifiers) {
            _cost += modifier.cost;
        }

        // Some modifiers have a minimumLimitation (REQUIRESASKILLROLL)
        if (this.baseInfo?.minimumLimitation) {
            if (this.baseInfo?.minimumLimitation < 0) {
                _cost = Math.min(this.baseInfo?.minimumLimitation, _cost);
            } else {
                _cost = Math.max(this.baseInfo?.minimumLimitation, _cost);
            }
        }

        return _cost;
    }

    get addersDescription() {
        const textArray = [];
        for (const _adder of this.adders) {
            if (_adder.addersDescription) {
                textArray.push(_adder.addersDescription(_adder));
            } else {
                textArray.push(_adder.OPTION_ALIAS || _adder.ALIAS);
            }
        }
        return textArray.join(", ");
    }
    get BOOSTABLE() {
        return this.ADDER.find((adder) => adder.XMLID === "BOOSTABLE");
    }

    get CLIPS() {
        return this.ADDER.find((adder) => adder.XMLID === "CLIPS");
    }

    get INCREASEDRELOAD() {
        return this.ADDER.find((adder) => adder.XMLID === "INCREASEDRELOAD");
    }

    get CONTINUING() {
        return this.ADDER.find((adder) => adder.XMLID === "CONTINUING");
    }

    get FUEL() {
        return this.ADDER.find((adder) => adder.XMLID === "FUEL");
    }

    get RECOVERABLE() {
        return this.ADDER.find((adder) => adder.XMLID === "RECOVERABLE");
    }
}

class HeroModifierModel2 extends HeroModifierModelCommon {}

export class HeroModifierModel extends HeroModifierModelCommon {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            ADDER: new ArrayField(new EmbeddedDataField(HeroAdderModel)),
            MODIFIER: new ArrayField(new EmbeddedDataField(HeroModifierModel2)),
            //POWER: new ArrayField(new EmbeddedDataField(HeroPowerModel)),
        };
    }
}

class HeroPowerModel extends HeroItemModCommonModel {
    get cost() {
        let _cost = 0;

        // There may be confusion between a POWER and a POWER modifier (connecting power).
        // Errors may result in cost functions.
        try {
            // Custom costs calculations
            if (this.baseInfo?.cost) {
                _cost = this.baseInfo.cost(this);
            } else {
                // Generic cost calculations
                _cost = parseFloat(this.BASECOST);

                const costPerLevel = this.baseInfo?.costPerLevel(this) || 0;
                const levels = parseInt(this.LEVELS) || 0;
                _cost += levels * costPerLevel;
            }

            // POWER-adders do not have ADDER (that we are aware of)
            for (const adder of this.adders) {
                _cost += adder.cost;
            }
        } catch (e) {
            console.error(e);
        }

        return _cost;
    }
}

export class HeroSystem6eItemTypeDataModelGetters extends HeroObjectCacheMixin(foundry.abstract.TypeDataModel) {
    prepareDerivedData() {
        super.prepareDerivedData();

        this.composeMemoizableObjectFunction("damage");
        this.composeMemoizableObjectFunction("description");
        this.composeMemoizableObjectFunction("dcvDetails");
        this.composeMemoizableObjectFunction("effect");
        this.composeMemoizableObjectFunction("ocvDetails");
        this.composeMemoizableObjectFunction("range");
    }

    get description() {
        try {
            return this.parent.getItemDescription();
        } catch (e) {
            console.error(e, this);
            return e.message ?? "error";
        }
    }

    #cachedParsedXml = new TimeClearedCache();

    get hdcHTMLCollection() {
        try {
            if (this._hdcXml) {
                if (!this.#cachedParsedXml.cacheValue) {
                    this.#cachedParsedXml.cacheValue = new DOMParser().parseFromString(this._hdcXml, "text/xml");
                }
                return this.#cachedParsedXml.cacheValue;
            }
            return null;
        } catch (e) {
            console.error(e);
        }
        return null;
    }

    get hdcJson() {
        return HeroSystem6eItem.itemDataFromXml(this._hdcXml, this.parent.actor);
    }

    get range() {
        let range = this.baseInfo?.rangeForItem(this.item);
        try {
            if (!range) {
                // This should never happen, missing something from CONFIG.mjs?  Perhaps with super old actors?
                console.error(`Missing range`, this);
                return CONFIG.HERO.RANGE_TYPES.SELF;
            }

            // Short circuit if there are no modifiers
            if (this.MODIFIER === undefined) {
                return range;
            }

            // Range Modifiers "self", "no range", "standard", or "los" based on base power.
            // It is the modified up or down but the only other types that should be added are:
            // "range based on str" or "limited range"
            const RANGED = this.MODIFIER.find((o) => o.XMLID === "RANGED");
            const NORANGE = this.MODIFIER.find((o) => o.XMLID === "NORANGE");
            const limitedRange =
                RANGED?.OPTIONID === "LIMITEDRANGE" || // Advantage form
                !!this.MODIFIER.find((o) => o.XMLID === "LIMITEDRANGE"); // Limitation form
            const rangeBasedOnStrength =
                RANGED?.OPTIONID === "RANGEBASEDONSTR" || // Advantage form
                !!this.MODIFIER.find((o) => o.XMLID === "RANGEBASEDONSTR"); // Limitation form
            const LOS = this.MODIFIER.find((o) => o.XMLID === "LOS");
            const NORMALRANGE = this.MODIFIER.find((o) => o.XMLID === "NORMALRANGE");
            const UOO = this.MODIFIER.find((o) => o.XMLID === "UOO");
            const BOECV = this.MODIFIER.find((o) => o.XMLID === "BOECV");

            // Based on EGO combat value comes with line of sight
            if (BOECV) {
                range = CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT;
            }

            // Self only powers cannot be bought to have range unless they become usable on others at which point
            // they gain no range.
            if (range === CONFIG.HERO.RANGE_TYPES.SELF) {
                if (UOO) {
                    range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
                }
            }

            // No range can be bought to have range.
            if (range === CONFIG.HERO.RANGE_TYPES.NO_RANGE) {
                if (RANGED) {
                    range = CONFIG.HERO.RANGE_TYPES.STANDARD;
                }
            }

            // Standard range can be bought up or bought down.
            if (range === CONFIG.HERO.RANGE_TYPES.STANDARD) {
                if (NORANGE) {
                    range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
                } else if (LOS) {
                    range = CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT;
                } else if (limitedRange) {
                    range = CONFIG.HERO.RANGE_TYPES.LIMITED_RANGE;
                } else if (rangeBasedOnStrength) {
                    range = CONFIG.HERO.RANGE_TYPES.RANGE_BASED_ON_STR;
                }
            }

            // Line of sight can be bought down
            if (range === CONFIG.HERO.RANGE_TYPES.LINE_OF_SIGHT) {
                if (NORMALRANGE) {
                    range = CONFIG.HERO.RANGE_TYPES.STANDARD;
                } else if (rangeBasedOnStrength) {
                    range = CONFIG.HERO.RANGE_TYPES.RANGE_BASED_ON_STR;
                } else if (limitedRange) {
                    range = CONFIG.HERO.RANGE_TYPES.LIMITED_RANGE;
                } else if (NORANGE) {
                    range = CONFIG.HERO.RANGE_TYPES.NO_RANGE;
                }
            }
        } catch (e) {
            console.error(e);
        }

        return range;
    }

    get duration() {
        const hasContinuous = this.item.findModsByXmlid("CONTINUOUS");
        const hasPersistent = this.item.findModsByXmlid("PERSISTENT");
        const hasInherent = this.item.findModsByXmlid("INHERENT");
        const hasActivationRoll = this.item.findModsByXmlid("ACTIVATIONROLL"); // 5e
        const hasRequiresASkillRoll = this.item.findModsByXmlid("REQUIRESASKILLROLL"); // 6e
        const hasConstsEndurance = this.item.findModsByXmlid("COSTSEND");
        const hasNonPersistent = this.item.findModsByXmlid("NONPERSISTENT");
        const hasInstant = this.item.findModsByXmlid("INSTANT");
        let duration = this.item.baseInfo.duration;

        if (duration === CONFIG.HERO.DURATION_TYPES.INSTANT && hasContinuous) {
            duration = CONFIG.HERO.DURATION_TYPES.CONSTANT;
        }

        if (duration === CONFIG.HERO.DURATION_TYPES.CONSTANT && hasPersistent) {
            duration = CONFIG.HERO.DURATION_TYPES.PERSISTENT;
        }

        if (duration === CONFIG.HERO.DURATION_TYPES.PERSISTENT && hasInherent) {
            duration = CONFIG.HERO.DURATION_TYPES.INHERENT;
        }

        if (duration === CONFIG.HERO.DURATION_TYPES.PERSISTENT && (hasActivationRoll || hasRequiresASkillRoll)) {
            duration = CONFIG.HERO.DURATION_TYPES.CONSTANT;
        }

        if (duration === CONFIG.HERO.DURATION_TYPES.PERSISTENT && hasConstsEndurance) {
            duration = CONFIG.HERO.DURATION_TYPES.CONSTANT;
        }

        if (duration === CONFIG.HERO.DURATION_TYPES.PERSISTENT && hasNonPersistent) {
            duration = CONFIG.HERO.DURATION_TYPES.CONSTANT;
        }

        if (duration === CONFIG.HERO.DURATION_TYPES.CONSTANT && hasInstant) {
            duration = CONFIG.HERO.DURATION_TYPES.INSTANT;
        }

        return duration;
    }

    get #rollProps() {
        if (!this.item.hasSuccessRoll()) {
            return {};
        }

        // TODO: Can this be simplified. Should we add some test cases?
        // TODO: Luck and unluck...

        // No Characteristic = no roll (Skill Enhancers for example) except for FINDWEAKNESS
        const { roll, tags } = !this.CHARACTERISTIC
            ? this.item._getNonCharacteristicsBasedRollComponents(this)
            : this.item._getSkillRollComponents(this);
        return { roll, tags };
    }

    get roll() {
        return this.#rollProps.roll;
    }

    get tags() {
        return this.#rollProps.tags;
    }

    // Make sure all the attributes in the HDC XML are in our data model
    debugModelProps() {
        try {
            if (this._hdcXml) {
                for (const attribute of this.hdcHTMLCollection.firstChild.attributes) {
                    if (this.schema.fields[attribute.name] === undefined) {
                        const e = `${this.parent.type}/${this.XMLID}/${this.item?.system?.ALIAS} HeroSystem6eItemTypeDataModelGetters is missing ${attribute.name} property.`;
                        console.error(e);
                        return e;
                    }

                    if (this.ADDER) {
                        for (const adder of this.ADDER) {
                            if (adder.debugModelProps) {
                                adder.debugModelProps();
                            } else {
                                console.error(`debugModelProps is missing`);
                            }
                        }
                    }

                    if (this.MODIFIER) {
                        for (const modifier of this.MODIFIER) {
                            if (modifier.debugModelProps) {
                                modifier.debugModelProps();
                            } else {
                                console.error(`debugModelProps is missing`);
                            }
                        }
                    }

                    if (this.POWER) {
                        for (const power of this.POWER) {
                            power.debugModelProps();
                        }
                    }
                }
            }
        } catch (e) {
            console.error(e);
            return e;
        }
    }

    #baseInfo = null;

    get baseInfo() {
        // cache getPowerInfo
        this.#baseInfo ??= getPowerInfo({ item: this.parent, xmlTag: this.xmlTag });
        if (!this.#baseInfo) {
            if (!squelch(this.id)) {
                console.warn(`${this.item.name}/${this.XMLID} has no baseInfo`);
            }
        }
        return this.#baseInfo;
    }

    get item() {
        return this.parent;
    }

    get actor() {
        return this.item.actor;
    }

    get activePoints() {
        return this.item.activePoints;
    }

    get characterPointCost() {
        return this.item.characterPointCost;
    }

    get realCost() {
        return this.item.realCost;
    }

    get _activePointsWithoutEndMods() {
        return this.item._activePointsWithoutEndMods;
    }

    get _advantages() {
        return this.item._advantages;
    }

    get killing() {
        return this.item.getMakeAttack().killing;
    }

    get knockbackMultiplier() {
        return this.item.getMakeAttack().knockbackMultiplier;
    }

    get usesStrength() {
        return this.item.getMakeAttack().usesStrength;
    }

    get usesTk() {
        return this.item.getMakeAttack().usesTk;
    }

    get piercing() {
        return this.item.getMakeAttack().piercing;
    }

    get penetrating() {
        return this.item.getMakeAttack().penetrating;
    }

    get stunBodyDamage() {
        return this.item.getMakeAttack().stunBodyDamage;
    }

    get endEstimate() {
        return this.item.end;
    }

    get end() {
        console.warn(`${this.item.name} system.end property is deprecated`);
        return this.item.end;
    }

    get ocvEstimated() {
        console.error("deprecated ocvEstimated");
        return 0;
    }

    get dcvEstimated() {
        console.error("deprecated dcvEstimated");
        return 0;
    }

    get noHitLocations() {
        if (["maneuver", "martialart"].includes(this.item.type)) {
            // Flash doesn't have a hit location
            if (maneuverHasFlashEffectTrait(this.item)) {
                return true;
            }

            // Block doesn't use a hit location
            if (maneuverHasBlockTrait(this.item)) {
                return true;
            }
        }

        // Specific power overrides.
        switch (this.item.system.XMLID) {
            case "CHOKE":
            case "DISARM":
            case "DIVEFORCOVER":
            case "GRAB":
            case "GRABBY":
            case "SHOVE":
            case "THROW":
            case "TRIP":
            case "ENTANGLE":
            case "DARKNESS":
            case "IMAGES":
            case "ABSORPTION":
            case "AID":
            case "SUCCOR":
            case "DISPEL":
            case "DRAIN":
            case "HEALING":
            case "SUPPRESS":
            case "TRANSFER":
            case "EGOATTACK":
            case "MINDCONTROL":
            case "MENTALILLUSIONS":
            case "MINDSCAN":
            case "TELEPATHY":
            case "CHANGEENVIRONMENT":
            case "FLASH":
            case "TRANSFORM":
            case "SUSCEPTIBILITY":
            case "LUCK":
            case "UNLUCK":
            case "FORCEWALL":
                return true;
        }

        return false;
    }

    #genericDetails = function (prop) {
        const propUpper = prop.toUpperCase();
        const propLower = prop.toLowerCase();
        const _details = {
            tags: [],
        };

        if (!["OCV", "OMCV", "DCV", "DMCV"].includes(propUpper)) {
            console.error("unexpected prop", prop);
        }

        if (!propUpper || this[propUpper] === "--") {
            return {};
        }

        const cv = parseInt(this.actor?.system.characteristics[propLower]?.value || 0);
        if (cv !== 0) {
            _details.tags.push({ name: propUpper, value: cv });
        }

        if ((parseInt(this[propUpper]) || 0) !== 0) {
            _details.tags.push({ name: this.item.name, value: parseInt(this[propUpper]) });
        }

        // Unclear when this would get used (maneuver?)
        if (this[propLower] === "-v/10") {
            // Educated guess for token
            const token =
                this.actor?.getActiveTokens().find((t) => canvas.tokens.controlled.find((c) => c.id === t.id)) ||
                this.actor?.getActiveTokens()[0];
            const velocity = calculateVelocityInSystemUnits(this.actor, token);
            if (velocity !== 0) {
                _details.tags.push({ name: "Velocity", value: -parseInt(velocity / 10) });
            }
        }

        for (const cslDetail of combatSkillLevelsForAttack(this.item).details) {
            if (cslDetail[propLower]) {
                _details.tags.push({ name: cslDetail.item.name, value: parseInt(cslDetail[propLower]) });
            }
        }

        _details.value = _details.tags.reduce((accum, currItem) => accum + currItem.value, 0);
        _details.tooltip = _details.tags.map((m) => `${m.value.signedStringHero()} ${m.name}`).join("<br>");

        return _details;
    };

    get ocvDetails() {
        return this.#genericDetails(this.attacksWith);
    }

    get dcvDetails() {
        return this.#genericDetails(this.defendsWith);
    }

    get damage() {
        // Potential performance improvment, move to prepareData?
        return getFullyQualifiedEffectFormulaFromItem(this.item, {});
    }

    get effect() {
        let _effect = this.USEWEAPON ? this.WEAPONEFFECT : this.EFFECT;
        if (!_effect) return null;

        const maneuverEffect = getManueverEffectWithPlaceholdersReplaced(this.item);

        return maneuverEffect;
    }

    get uses() {
        console.error("deprecated");
        return this.attacksWith;
    }

    /**
     * What does this item use as its attack combat value, OCV or OMCV?
     *
     * WARNING: It is invalid to call this on a non attack power and expect it to have a correct value
     *
     * @returns {"ocv"|"omcv"}
     */
    get attacksWith() {
        let _attacksWith = "ocv";

        if (this.baseInfo?.type.includes("mental")) {
            _attacksWith = "omcv";
        }

        // Alternate Combat Value (e.g. uses OMCV against DCV)

        // 6e uses Altnernate Combat Value modifier
        const acv = this.item.findModsByXmlid("ACV");
        if (acv) {
            switch (acv.OPTIONID) {
                case "MENTALOCV": // uses OCV against DMCV
                case "MENTALOCVDCV": //uses OCV against DCV
                case "NONMENTALDMCV": // uses OCV against DMCV
                    return "ocv";

                case "MENTALDCV": // uses OMCV against DCV
                case "NONMENTALOMCVDMCV": // uses OMCV against DMCV
                case "NONMENTALOMCV": // uses OMCV against DCV
                    return "omcv";
            }

            console.error(`${this.item?.detailedName()} has unhandled ACV OPTIONID "${acv.system.OPTIONID}"`);

            return _attacksWith;
        }

        // 5e uses Based on Ego Combat Value modifier
        const boecv = this.item.findModsByXmlid("BOECV");
        if (boecv) {
            return "omcv";
        }

        return _attacksWith;
    }

    get targets() {
        console.error("deprecated");
        return this.defendsWith;
    }

    get defendsWith() {
        let _defendsWith = "dcv";

        if (this.baseInfo.type.includes("mental")) {
            _defendsWith = "dmcv";
        }

        // 6e uses Alternate Combat Value (uses OMCV against DCV)
        const acv = this.item.findModsByXmlid("ACV");
        if (acv) {
            switch (acv.OPTIONID) {
                case "MENTALOCV": // uses OCV against DMCV
                case "NONMENTALOMCVDMCV": // uses OMCV against DMCV
                case "NONMENTALDMCV": // uses OCV against DMCV
                    return "dmcv";

                case "MENTALDCV": // uses OMCV against DCV
                case "MENTALOCVDCV": // uses OCV against DCV
                case "NONMENTALOMCV": // uses OMCV against DCV
                    return "dcv";
            }

            console.error(`${this.item?.detailedName()} has unhandled ACV OPTIONID "${acv.system.OPTIONID}"`);

            return _defendsWith;
        }

        // 5e uses Based on Ego Combat Value modifier
        const boecv = this.item.findModsByXmlid("BOECV");
        if (boecv) {
            // 5e TELEKINESIS is DCV (REF: FRED pg 231)
            if (this.item.is5e && this.item.system.XMLID === "TELEKINESIS") {
                return "dcv";
            }

            // Everything else: When you use EGO to attack, you defend with EGO (pg FRED pg 374)
            return "dmcv";
        }

        return _defendsWith;
    }

    get ocv() {
        // Powers never/rarely give OCV bonus
        return 0;
    }

    get dcv() {
        // Powers never/rarely give DCV bonus
        return 0;
    }

    get chargeModifier() {
        return this.chargeItemModifier || this.chargeItemParentModifier;
    }

    get chargeItemModifier() {
        const modFromItemGetter = this.item.modifiers.find((m) => m.XMLID === "CHARGES");
        if (!modFromItemGetter) {
            return modFromItemGetter;
        }
        const itemChargeMod = this.item.system.MODIFIER.find(
            (m) => m.XMLID === "CHARGES" && m.ID === modFromItemGetter.ID,
        );

        return itemChargeMod;
    }

    get chargeItemParentModifier() {
        const modFromItemGetter = this.item.modifiers.find((m) => m.XMLID === "CHARGES");

        if (!modFromItemGetter) {
            return modFromItemGetter;
        }

        const parentChargeMod = this.item.parentItem?.system.MODIFIER.find(
            (m) => m.XMLID === "CHARGES" && m.ID === modFromItemGetter.ID,
        );
        //console.log(`CHARGE from parent [${this.item.parentItem.name}]`);
        return parentChargeMod;
    }
}

export class HeroSystem6eItemTypeDataModelProps extends HeroSystem6eItemTypeDataModelGetters {
    static defineSchema() {
        return {
            AFFECTS_TOTAL: new BooleanField({ initial: null, nullable: true }),
            ADD_MODIFIERS_TO_BASE: new StringField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            ADDER: new ArrayField(new EmbeddedDataField(HeroAdderModel)),
            ALIAS: new StringField(),
            TEXT: new StringField(),
            BASECOST: new HeroNumberField({ integer: false }),
            COLOR: new StringField(),
            GRAPHIC: new StringField(),
            ID: new HeroNumberField({ integer: true }),
            INPUT: new StringField(),
            LEVELS: new HeroNumberField({ integer: true }),
            MODIFIER: new ArrayField(new EmbeddedDataField(HeroModifierModel)),
            MULTIPLIER: new HeroNumberField({ integer: false }),
            NAME: new StringField(),
            NOTES: new StringField(),
            PARENTID: new HeroNumberField({ integer: true }),
            POSITION: new HeroNumberField({ integer: true }),
            POWER: new ArrayField(new EmbeddedDataField(HeroPowerModel)),

            SFX: new StringField(),
            XMLID: new StringField(),
            SHOW_ACTIVE_COST: new BooleanField({ initial: null, nullable: true }),
            INCLUDE_NOTES_IN_PRINTOUT: new BooleanField({ initial: null, nullable: true }),
            _active: new ObjectField(), // action  (consider renaming)
            _hdcXml: new StringField(),
            is5e: new BooleanField({ initial: null, nullable: true }),
            xmlTag: new StringField(),
            USE_END_RESERVE: new BooleanField({ initial: null, nullable: true }),
            FREE_POINTS: new HeroNumberField({ integer: true }),
            value: new HeroNumberField({ integer: true }), // ENEDURANCERESERVE
            //max: new HeroNumberField({ integer: true }), // ENEDURANCERESERVE (use LEVELS instead)
            active: new BooleanField({ initial: true, nullable: true }), // is power,skill,equipment active (consider renaming)
            collapse: new BooleanField({ initial: false }), // TODO: Make collapsing items per use, not part of DB
            csl: new ArrayField(new StringField()), // Combat Skill levels
            checked: new BooleanField({ initial: false }), // DEADLYBLOW
            CARRIED: new BooleanField({ nullable: true }), // Typically for equipment; extending to include VPP
            FILE_ASSOCIATION: new StringField({ nullable: true }), // Follower file association in HDC
            errors: new ArrayField(new StringField()), // During upload we sometimes put stuff in here for debugging

            _charges: new HeroNumberField({ initial: 0, integer: true }),
            _clips: new HeroNumberField({ initial: 1, integer: true }),
            ablative: new HeroNumberField({ initial: 0, integer: true }), // Store # of times threshold has been exceeded
        };
    }

    get numCharges() {
        // Charges with a MP are typically on the parentItem not the slot
        // so we use a helper to get the right one.
        if (!this.item.system.chargeModifier) {
            //console.error(`${this.item.name} has no CHARGE modifier`, this);
            return 0;
        }

        const itemWithChargeModifier = this.item.system.chargeModifier.parent.item;
        if (!itemWithChargeModifier) {
            //console.error(`${this.name} has no itemWithChargeModifier`, this);
            return 0;
        }

        return itemWithChargeModifier.system._charges ?? 0;
    }

    get chargesMax() {
        if (!this.item.system.chargeModifier) {
            //console.error(`${this.name} has no CHARGE modifier`, this);
            return 0;
        }

        // OPTION_ALIAS is a free form text field.
        // OPTIONID is a word that we will convert to a number.
        const OPTIONID = hdcTextNumberToNumeric(this.item.system.chargeModifier.OPTIONID);
        const OPTION_ALIAS = parseInt(this.item.system.chargeModifier.OPTION_ALIAS) || 0;
        const chargesMax = Math.min(OPTIONID, OPTION_ALIAS);
        return chargesMax;
    }

    get clips() {
        // Charges with a MP are typically on the parentItem not the slot
        // so we use a helper to get the right one.
        if (!this.item.system.chargeModifier) {
            //console.error(`${this.item.name} charges, yet no CHARGE modifier was found`, this);
            return 0;
        }

        const itemWithChargeModifier = this.item.system.chargeModifier.parent.item;
        if (!itemWithChargeModifier) {
            //console.error(`${this.name} has no itemWithChargeModifier`, this);
            return 0;
        }

        if (!itemWithChargeModifier.findModsByXmlid("CLIPS")) {
            //console.error(`${this.name} has no CLIPS adder`, this);
            return 0;
        }

        return itemWithChargeModifier.system._clips;
    }

    get clipsMax() {
        if (!this.item.system.chargeModifier) {
            //console.error(`${this.name} has no CHARGE modifier`, this);
            return 0;
        }

        if (!this.item.system.chargeModifier.CLIPS) {
            //console.error(`${this.name} has no CLIPS modifier`, this);
            return 0;
        }

        // Max clips gain 2x clips for each level where charges modifier cost + clips adder cost is <= -0.
        // Max clips gain 4x clips for each level where charges modifer cost + clips adder cost is > -0. Not clear if that's just the crossing or for all steps thereafter as well.
        // NOTE: All adders are considered before clip cost for figuring number of clips.
        const chargeAdders = this.item.system.chargeModifier.adders;
        const adderCostExcludingClips = chargeAdders
            .filter((adder) => adder.XMLID !== "CLIPS")
            .reduce((accum, adder) => accum + adder.cost, 0);
        const addersLevelsExcludingClips =
            adderCostExcludingClips * -4 + (this.item.system.chargeModifier.OPTIONID === "ONE" ? 1 : 0);
        const chargeLevelsExcludingClips =
            getChargeOptionIdToLevel(this.item.system.chargeModifier.OPTIONID) - addersLevelsExcludingClips;
        const clipLevels = this.item.system.chargeModifier.CLIPS?.LEVELS || 0;
        const levelsAsLimitation =
            chargeLevelsExcludingClips < 0 ? Math.min(clipLevels, Math.abs(chargeLevelsExcludingClips)) : 0;
        const levelsAsAdvantage =
            chargeLevelsExcludingClips >= 0 ? clipLevels : Math.max(0, clipLevels + chargeLevelsExcludingClips);
        const clipsMax = Math.pow(2, levelsAsLimitation) * Math.pow(4, levelsAsAdvantage);
        return clipsMax;
    }

    async setChargesAndSave(value) {
        if (!this.item.system.chargeModifier) {
            console.error(`${this.name} called setChargesAndSave but has no CHARGE modifier`, this);
            return;
        }
        const itemWithChargeModifier = this.item.system.chargeModifier.parent.item;
        if (!itemWithChargeModifier) {
            console.error(`${this.name} was unable to find itemWithChargeModifier`, this);
            return;
        }

        return itemWithChargeModifier.update({ "system._charges": value });
    }

    async setClipsAndSave(value) {
        if (!this.item.system.chargeModifier) {
            console.error(`${this.name} called setChargesAndSave but has no CHARGE modifier`, this);
            return;
        }
        if (!this.item.system.chargeModifier.CLIPS) {
            console.error(`${this.name} called setChargesAndSave but has no CLIPS modifier`, this);
            return;
        }
        const itemWithChargeModifier = this.item.system.chargeModifier.parent.item;
        if (!itemWithChargeModifier) {
            console.error(`${this.name} was unable to find itemWithChargeModifier`, this);
            return;
        }

        return itemWithChargeModifier.update({ "system._clips": value });
    }
}

export class HeroSystem6eItemPower extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),
            AFFECTS_PRIMARY: new BooleanField({ initial: null, nullable: true }),
            AFFECTS_TOTAL: new BooleanField({ initial: null, nullable: true }),
            ACTIVE: new StringField(), // XMLID=DETECT
            BODYLEVELS: new StringField(),
            DEFENSE: new StringField(),
            DOESBODY: new StringField(),
            DOESDAMAGE: new StringField(),
            DOESKNOCKBACK: new StringField(),
            DURATION: new StringField(),
            ED: new StringField(),
            EDLEVELS: new HeroNumberField({ integer: true }),
            END: new StringField(),
            ENDCOLUMNOUTPUT: new StringField(),
            FDLEVELS: new StringField(),
            GROUP: new StringField(),
            HEIGHTLEVELS: new StringField(),
            INT: new StringField(),
            KILLING: new StringField(),
            LENGTHLEVELS: new StringField(),
            MDLEVELS: new HeroNumberField({ integer: true }),
            NUMBER: new HeroNumberField({ integer: true, positive: true }),
            OCV: new StringField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            PD: new StringField(),
            PDLEVELS: new HeroNumberField({ integer: true }),
            POINTS: new StringField(),
            POWDLEVELS: new HeroNumberField({ integer: true }),
            PRE: new StringField(),
            QUANTITY: new HeroNumberField({ integer: true }),
            RANGE: new StringField(),
            STR: new StringField(),
            TARGET: new StringField(),
            USECUSTOMENDCOLUMN: new StringField(),
            USESTANDARDEFFECT: new BooleanField({ initial: null, nullable: true }),
            ULTRA_SLOT: new StringField(),
            VISIBLE: new StringField(),
            WIDTHLEVELS: new StringField(),

            // Skill
            CHARACTERISTIC: new StringField(),
            EVERYMAN: new BooleanField({ initial: null, nullable: true }),
            FAMILIARITY: new BooleanField({ initial: null, nullable: true }),
            INTBASED: new StringField(),
            LEVELSONLY: new BooleanField({ initial: null, nullable: true }),
            PROFICIENCY: new BooleanField({ initial: null, nullable: true }),
            ROLL: new StringField(),
            TYPE: new StringField(),

            // Perk
            BASEPOINTS: new StringField(),
            DISADPOINTS: new HeroNumberField({ integer: true, min: 0 }),
        };
    }
}

export class HeroSystem6eItemEquipment extends HeroSystem6eItemPower {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),
            CARRIED: new BooleanField({ nullable: true }),
            EVER: new StringField(),
            PRICE: new StringField(),
            SKILL: new StringField(),
            WEIGHT: new StringField(),
        };
    }
}

export class HeroSystem6eItemSkill extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),
            CHARACTERISTIC: new StringField(),
            EVERYMAN: new BooleanField({ initial: null, nullable: true }),
            FAMILIARITY: new BooleanField({ initial: null, nullable: true }),
            INTBASED: new BooleanField({ initial: null, nullable: true }),
            LEVELSONLY: new BooleanField({ initial: null, nullable: true }),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            PROFICIENCY: new BooleanField({ initial: null, nullable: true }),
            ROLL: new StringField(),
            TEXT: new StringField(),
            TYPE: new StringField(),
            NATIVE_TONGUE: new BooleanField({ initial: null, nullable: true }),
            active: new BooleanField({ initial: true, nullable: true }), // should be part of  HeroSystem6eItemTypeDataModelProps and not needed here
        };
    }

    static migrateData(source) {
        // Some old (possibly manually created SKILLS) have LEVELS defined incorrectly by current requirements.
        // These are so old that we don't even have XMLID's, so these skills likely don't work.
        // Keeping migration for now to avoid errors. https://github.com/dmdorman/hero6e-foundryvtt/issues/3675
        if (source.LEVELS !== undefined && isNaN(source.LEVELS)) {
            if (typeof source.LEVELS === "object") {
                if (source.LEVELS.value !== undefined) {
                    source.LEVELS = source.LEVELS.value;
                    return;
                }
            }
        }

        return source;
    }
}

export class HeroSystem6eItemPerk extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        //const { ObjectField, StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),
            BASEPOINTS: new StringField(),
            DISADPOINTS: new HeroNumberField({ integer: true, min: 0 }),
            INTBASED: new StringField(),
            NUMBER: new HeroNumberField({ integer: true, positive: true }),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            ROLL: new StringField(),
            TEXT: new StringField(),
        };
    }
}
export class HeroSystem6eItemManeuver extends HeroSystem6eItemTypeDataModelGetters {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        const { StringField } = foundry.data.fields;
        // Note that the return is just a simple object
        return {
            ADDSTR: new BooleanField({ initial: null, nullable: true }),
            DC: new StringField(),
            DCV: new StringField(),
            DISPLAY: new StringField(),
            EFFECT: new StringField(),
            OCV: new StringField(),
            PHASE: new StringField(),
            USEWEAPON: new BooleanField({ initial: null, nullable: true }),
            WEAPONEFFECT: new StringField(),
            XMLID: new StringField(),

            // NOTE: These don't exist in the HDC XML (because maneuvers aren't in there). We do
            //       need them, because we can copy advantages from Hand-to-Hand attacks.
            ADDER: new ArrayField(new EmbeddedDataField(HeroAdderModel)),
            MODIFIER: new ArrayField(new EmbeddedDataField(HeroModifierModel2)),

            _active: new ObjectField(), // action
            is5e: new BooleanField({ initial: null, nullable: true }),
            active: new BooleanField({ initial: null, nullable: true }),
        };
    }

    get ocv() {
        return parseInt(this.OCV) || 0;
    }

    get dcv() {
        return parseInt(this.DCV) || 0;
    }
}

export class HeroSystem6eItemMartialArt extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        //const { ObjectField, StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),

            ACTIVECOST: new StringField(),
            ADDSTR: new BooleanField({ initial: null, nullable: true }),
            CATEGORY: new StringField(),
            CUSTOM: new StringField(),
            DAMAGETYPE: new StringField(),
            DC: new StringField(),
            DCV: new StringField(),
            DISPLAY: new StringField(),
            EFFECT: new StringField(),
            MAXSTR: new StringField(),
            OCV: new StringField(),
            PHASE: new StringField(),
            RANGE: new HeroNumberField(),
            STRMULT: new StringField(),
            TEXT: new StringField(),
            USEWEAPON: new BooleanField({ initial: null, nullable: true }),
            WEAPONEFFECT: new StringField(),
        };
    }

    get killing() {
        return this.parent.getMakeAttack().killing;
    }

    get knockbackMultiplier() {
        return this.parent.getMakeAttack().knockbackMultiplier;
    }

    get usesStrength() {
        return this.parent.getMakeAttack().usesStrength;
    }

    get piercing() {
        return this.parent.getMakeAttack().piercing;
    }

    get penetrating() {
        return this.parent.getMakeAttack().penetrating;
    }

    get stunBodyDamage() {
        console.warn("can we use inherited stunBodyDamage?");
        return this.parent.getMakeAttack().stunBodyDamage;
    }

    // PH: This is almost the same as what it is overriding. Remove the options for this function and move things into item to combine.
    get damage() {
        return getFullyQualifiedEffectFormulaFromItem(this.item, { ignoreDeadlyBlow: true });
    }

    get ocv() {
        return parseInt(this.OCV) || 0;
    }

    get dcv() {
        return parseInt(this.DCV) || 0;
    }
}

export class HeroSystem6eItemDisadvantage extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        //const { ObjectField, StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),
            SHOWALIAS: new BooleanField({ initial: null, nullable: true }), // Disadvantages Normal Characteristic Maxima
            PRIVATE: new BooleanField({ initial: null, nullable: true }), // Disadvantages Normal Characteristic Maxima
            GROUP: new BooleanField({ initial: null, nullable: true }), // Disadvantages Normal Characteristic Maxima
            SELECTED: new BooleanField({ initial: null, nullable: true }), // Disadvantages Normal Characteristic Maxima
            REQUIRED: new BooleanField({ initial: null, nullable: true }), // Disadvantages Normal Characteristic Maxima
            INCLUDEINBASE: new BooleanField({ initial: null, nullable: true }), // Disadvantages Normal Characteristic Maxima
            DISPLAYINSTRING: new BooleanField({ initial: null, nullable: true }), // Disadvantages Normal Characteristic Maxima
        };
    }
}

export class HeroSystem6eItemTalent extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        //const { ObjectField, StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),

            AFFECTS_PRIMARY: new BooleanField({ initial: null, nullable: true }),
            CHARACTERISTIC: new StringField(),
            GROUP: new StringField(),

            QUANTITY: new StringField(),
            ROLL: new StringField(),
            TEXT: new StringField(),
        };
    }
}

export class HeroSystem6eItemComplication extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        //const { ObjectField, StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return { ...super.defineSchema() };
    }
}

export class HeroSystem6eItemMisc extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        //const { ObjectField, StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return { ...super.defineSchema() };
    }
}

export class HeroItemCharacteristic extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            XMLID: new StringField(),
            ID: new HeroNumberField({ integer: true }),
            BASECOST: new HeroNumberField({ integer: false }),
            LEVELS: new HeroNumberField({ integer: true }),
            ALIAS: new StringField(),
            POSITION: new HeroNumberField({ integer: true }),
            MULTIPLIER: new HeroNumberField({ integer: false }),
            GRAPHIC: new StringField(),
            COLOR: new StringField(),
            SFX: new StringField(),
            SHOW_ACTIVE_COST: new BooleanField({ initial: null, nullable: true }),
            INCLUDE_NOTES_IN_PRINTOUT: new BooleanField({ initial: null, nullable: true }),
            NAME: new StringField(),
            AFFECTS_PRIMARY: new BooleanField({ initial: null, nullable: true }),
            AFFECTS_TOTAL: new BooleanField({ initial: null, nullable: true }),
            _hdcXml: new StringField(),
            is5e: new BooleanField({ initial: null, nullable: true }),
            xmlTag: new StringField(),
        };
    }

    // native characteristics don't use _active as we don't currently allow
    // them to be modified, although perhaps _STRENGTHDAMAGE can be reworked to do so.
    get _active() {
        return {};
    }

    get active() {
        return true;
    }

    #baseInfo = null;

    get baseInfo() {
        // cache getPowerInfo
        this.#baseInfo ??= getPowerInfo({ item: this, xmlTag: this.xmlTag });
        // if (!this.#baseInfo) {
        //     debugger;
        // }
        return this.#baseInfo;
    }

    get actor() {
        if (this.parent instanceof HeroSystem6eActor) {
            return this.parent;
        }
        if (this.parent.parent instanceof HeroSystem6eActor) {
            return this.parent.parent;
        }
        return null;
    }

    #cachedParsedXml = new TimeClearedCache();

    get hdcHTMLCollection() {
        try {
            if (this._hdcXml) {
                if (!this.#cachedParsedXml.cacheValue) {
                    this.#cachedParsedXml.cacheValue = new DOMParser().parseFromString(this._hdcXml, "text/xml");
                }
                return this.#cachedParsedXml.cacheValue;
            }
            return null;
        } catch (e) {
            console.error(e);
        }
        return null;
    }

    get name() {
        return `Natural ${this.XMLID}`;
    }

    get description() {
        return `${this.LEVELS + this.#baseInfo.base(this.actor)} ${this.baseInfo?.name}`;
    }

    // Allows HeroItemCharacteristic to be accessed like an item.
    // Used with conditionalDefenses
    get system() {
        return this;
    }

    debugModelProps() {
        try {
            if (this._hdcXml) {
                for (const attribute of this.hdcHTMLCollection.firstChild.attributes) {
                    if (this.schema.fields[attribute.name] === undefined) {
                        const e = `${this.xmlTag} HeroItemCharacteristic is missing ${attribute.name} property.`;
                        console.error(e);
                        return e;
                    }
                }
            }
        } catch (e) {
            console.error(e);
            return e;
        }
    }
}

export class HeroActorCharacteristic extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            max: new HeroNumberField({ integer: true, initial: 0 }),
            value: new HeroNumberField({ integer: true, initial: 0 }),
            characteristicMax: new HeroNumberField({ integer: true, nullable: true }),
        };
    }

    get levels() {
        return this.actor.system[this.KEY]?.LEVELS || 0;
    }

    get baseInt() {
        // Only expected to be used for 5e SPD as we need the integer version
        return Math.floor(this.base);
    }

    /**
     * base is the starting points you get for free
     */
    get base() {
        // Some 5e characteristics are calcuated or figured
        if (this.actor.is5e) {
            if (this.baseInfo?.behaviors.includes("calculated")) {
                if (this.#baseInfo.calculated5eCharacteristic) {
                    return this.#baseInfo.calculated5eCharacteristic(this.actor);
                }
            } else if (this.baseInfo?.behaviors.includes("figured")) {
                return this.baseInfo.figured5eCharacteristic(this.actor);
            }
        }

        // Not every actor will have all characteristics
        // return null when this characteristic isn't valid

        return this.baseInfo.base?.(this.actor) ?? null;
    }

    get basePlusLevels() {
        // Need to add in LEVELS
        return (this.base ?? 0) + (this.item?.LEVELS ?? 0);
    }

    get baseItemsContributingToFiguredCharacteristics() {
        return this.actor.items.filter(
            (item) =>
                item.system.XMLID === this.KEY &&
                !item.findModsByXmlid("NOFIGURED") &&
                item.effects.find((e) => e.disabled === false),
        );
    }

    baseSumFiguredCharacteristicsFromItems(divisor) {
        // Each item is rounded seperately
        try {
            const powersWithThisCharacteristic = this.baseItemsContributingToFiguredCharacteristics;
            return powersWithThisCharacteristic.reduce((accumulator, currentItem) => {
                return accumulator + roundFavorPlayerAwayFromZero(currentItem.system.LEVELS / divisor);
            }, 0);
        } catch (e) {
            console.error(e);
        }
        return 0;
    }

    baseSumFiguredCharacteristicsNoRoundingFromItems(divisor) {
        // Each item is rounded seperately
        try {
            const powersWithThisCharacteristic = this.baseItemsContributingToFiguredCharacteristics;
            return powersWithThisCharacteristic.reduce((accumulator, currentItem) => {
                return accumulator + currentItem.system.LEVELS / divisor;
            }, 0);
        } catch (e) {
            console.error(e);
        }
        return 0;
    }

    get realCost() {
        if (this.baseInfo?.cost) {
            return this.baseInfo.cost(this);
        }
        const cost = Math.round(this.levels * (this.baseInfo?.costPerLevel(this.item) || 0));
        return cost;
    }

    get roll() {
        if (this.baseInfo?.behaviors.includes("success")) {
            const newRoll = Math.round(9 + this.value * 0.2);
            if (!this.actor.is5e && this.value < 0) {
                return 9;
            }
            return newRoll;
        }
        return null;
    }

    get valueTitle() {
        // Active Effects may be blocking updates
        const ary = [];
        const activeEffects = this.actor.appliedEffects.filter((ae) =>
            ae.changes.find((p) => p.key === `system.characteristics.${this.key}.value`),
        );
        let _valueTitle = "";
        for (const ae of activeEffects) {
            ary.push(`<li>${ae.name}</li>`);
        }
        if (ary.length > 0) {
            _valueTitle = "<b>PREVENTING CHANGES</b>\n<ul class='left'>";
            _valueTitle += ary.join("\n ");
            _valueTitle += "</ul>";
            _valueTitle += "<small><i>Click to unblock</i></small>";
        }
        return _valueTitle;
    }

    get maxTitle() {
        // Active Effects may be blocking updates
        const ary = [];
        const activeEffects = Array.from(this.actor.allApplicableEffects()).filter(
            (ae) => ae.changes.find((p) => p.key === `system.characteristics.${this.key}.max`) && !ae.disabled,
        );

        for (const ae of activeEffects) {
            ary.push(`<li>${ae.name}</li>`);
            // if (ae._prepareDuration().duration) {
            //     const change = ae.changes.find((o) => o.key === `system.characteristics.${this.key}.max`);
            //     if (change.mode === CONFIG.HERO.ACTIVE_EFFECT_MODES.ADD) {
            //         characteristic.delta += parseInt(change.value);
            //     }
            //     if (change.mode === CONFIG.HERO.ACTIVE_EFFECT_MODES.MULTIPLY) {
            //         characteristic.delta += parseInt(this.max) * parseInt(change.value) - parseInt(this.max);
            //     }
            // }
        }
        let _maxTitle = "";
        if (ary.length > 0) {
            _maxTitle = "<b>PREVENTING CHANGES</b>\n<ul class='left'>";
            _maxTitle += ary.join("\n ");
            _maxTitle += "</ul>";
            _maxTitle += "<small><i>Click to unblock</i></small>";
        }
        return _maxTitle;
    }

    get notes() {
        if (this.baseInfo?.notes) {
            return this.baseInfo.notes(this);
        }
        return null;
    }

    get XMLID() {
        return this.key?.toUpperCase();
    }

    get key() {
        return this.schema.name;
    }

    get KEY() {
        return this.schema.name.toUpperCase();
    }

    get item() {
        if (this.parent instanceof HeroActorCharacteristic) {
            return this.parent;
        }
        if (this.parent.parent[this.XMLID]) {
            return this.parent.parent[this.XMLID];
        }
        return null;
    }

    #baseInfo = null;
    get baseInfo() {
        // cache getPowerInfo
        const key = this.schema.name?.toUpperCase();
        this.#baseInfo ??= getPowerInfo({ XMLID: key, is5e: this.actor?.is5e, xmlTag: key });
        return this.#baseInfo;
    }

    get actor() {
        if (this.parent.parent.parent instanceof HeroSystem6eActor) {
            return this.parent.parent.parent;
        }
        return null;
    }
}

export class HeroCharacteristicsModel extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            str: new EmbeddedDataField(HeroActorCharacteristic),
            dex: new EmbeddedDataField(HeroActorCharacteristic),
            con: new EmbeddedDataField(HeroActorCharacteristic),
            int: new EmbeddedDataField(HeroActorCharacteristic),
            ego: new EmbeddedDataField(HeroActorCharacteristic),
            pre: new EmbeddedDataField(HeroActorCharacteristic),
            com: new EmbeddedDataField(HeroActorCharacteristic),
            ocv: new EmbeddedDataField(HeroActorCharacteristic),
            dcv: new EmbeddedDataField(HeroActorCharacteristic),
            omcv: new EmbeddedDataField(HeroActorCharacteristic),
            dmcv: new EmbeddedDataField(HeroActorCharacteristic),
            spd: new EmbeddedDataField(HeroActorCharacteristic),
            pd: new EmbeddedDataField(HeroActorCharacteristic),
            ed: new EmbeddedDataField(HeroActorCharacteristic),
            rec: new EmbeddedDataField(HeroActorCharacteristic),
            end: new EmbeddedDataField(HeroActorCharacteristic),
            body: new EmbeddedDataField(HeroActorCharacteristic),
            stun: new EmbeddedDataField(HeroActorCharacteristic),

            running: new EmbeddedDataField(HeroActorCharacteristic),
            swimming: new EmbeddedDataField(HeroActorCharacteristic),
            leaping: new EmbeddedDataField(HeroActorCharacteristic),

            flight: new EmbeddedDataField(HeroActorCharacteristic),
            ftl: new EmbeddedDataField(HeroActorCharacteristic), // Faster Than Light
            gliding: new EmbeddedDataField(HeroActorCharacteristic),
            swinging: new EmbeddedDataField(HeroActorCharacteristic),
            teleportation: new EmbeddedDataField(HeroActorCharacteristic),
            tunneling: new EmbeddedDataField(HeroActorCharacteristic),

            basesize: new EmbeddedDataField(HeroActorCharacteristic),
            def: new EmbeddedDataField(HeroActorCharacteristic), // 5e Base and Vehicles
            size: new EmbeddedDataField(HeroActorCharacteristic), // Vehicle
        };
    }
}

export class HeroActorCharacterBasicConfigurationModel extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            BASE_POINTS: new HeroNumberField(),
            DISAD_POINTS: new HeroNumberField(),
            EXPERIENCE: new HeroNumberField(),
            EXPORT_TEMPLATE: new ObjectField(),
            RULES: new ObjectField(),
            xmlTag: new StringField(),
            _hdcXml: new StringField(),
        };
    }
}

export class HeroActorCharacterInfoModel extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            ALTERNATE_IDENTITIES: new StringField(),
            APPEARANCE: new StringField(),
            BACKGROUND: new StringField(),
            CAMPAIGN_NAME: new StringField(),
            CAMPAIGN_USE: new StringField(),
            CHARACTER_NAME: new StringField(),
            EYE_COLOR: new StringField(),
            GENRE: new StringField(),
            GM: new StringField(),
            HAIR_COLOR: new StringField(),
            HEIGHT: new HeroNumberField(),
            NOTES1: new StringField(),
            NOTES2: new StringField(),
            NOTES3: new StringField(),
            NOTES4: new StringField(),
            NOTES5: new StringField(),
            PERSONALITY: new StringField(),
            PLAYER_NAME: new StringField(),
            QUOTE: new StringField(),
            TACTICS: new StringField(),
            WEIGHT: new HeroNumberField(),
            RULES: new ObjectField(),
            xmlTag: new StringField(),
            _hdcXml: new StringField(),
        };
    }

    get height() {
        // HEIGHT is stored in inches in the HDC XML, so we convert to cm if metric units is enabled.
        const metricUnits = game.settings.get(game.system.id, "metricUnits");
        return metricUnits ? this.HEIGHT * 2.54 : this.HEIGHT;
    }
    // set height(value) {
    //     const metricUnits = game.settings.get(game.system.id, "metricUnits");
    //     this.HEIGHT = metricUnits ? value / 2.54 : value;
    // }

    get weight() {
        // WEIGHT is stored in pounds in the HDC XML, so we convert to kg if metric units is enabled.
        const metricUnits = game.settings.get(game.system.id, "metricUnits");
        return metricUnits ? Math.round(this.WEIGHT * 0.45359237) : this.WEIGHT;
    }
    // set weight(value) {
    //     const metricUnits = game.settings.get(game.system.id, "metricUnits");
    //     this.WEIGHT = metricUnits ? value / 0.45359237 : value;
    // }
}

export class HeroActorTemplateModel extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            version: new StringField(),
            extends: new StringField(),
            id: new StringField(),
            originalPath: new StringField(),
            MAINAPP: new ObjectField(),
            CHARACTERISTICS: new ObjectField(),
            SKILLS: new ObjectField(),
            SKILL_ENHANCERS: new ObjectField(),
            MARTIAL_ARTS: new ObjectField(),
            PERKS: new ObjectField(),
            TALENTS: new ObjectField(),
            POWERS: new ObjectField(),
            MODIFIERS: new ObjectField(),
            DISADVANTAGES: new ObjectField(),
            _name: new StringField(),
        };
    }

    get name() {
        return this.extends ?? this._name ?? this.originalPath;
    }
}

export class HeroActorCharacterModel extends foundry.abstract.DataModel {
    static defineSchema() {
        return {
            BASIC_CONFIGURATION: new EmbeddedDataField(HeroActorCharacterBasicConfigurationModel),
            CHARACTER_INFO: new EmbeddedDataField(HeroActorCharacterInfoModel),
            TEMPLATE: new EmbeddedDataField(HeroActorTemplateModel), // Most HDC files this is a string
            version: new StringField(),
            xmlTag: new StringField(),
            _hdcXml: new StringField(),
        };
    }

    static migrateData(source) {
        // Most TEMPLATEs are just a string but sometimes they are an object.
        // So we are coercing strings to the object as ObjectField can't be a simple string.
        // TODO: With Millennium cityCity check to see if this item/skill really works, if not we should delete these.
        if (typeof source.TEMPLATE === "string") {
            source.TEMPLATE = { _name: source.TEMPLATE };
        }

        // Super Old HDC files store template in a different location
        else if (typeof source.BASIC_CONFIGURATION?.TEMPLATE === "string") {
            source.TEMPLATE = { _name: source.BASIC_CONFIGURATION.TEMPLATE };
        }

        return source;
    }
}

export class HeroActorModel extends HeroObjectCacheMixin(foundry.abstract.TypeDataModel) {
    static defineSchema() {
        return {
            CHARACTER: new EmbeddedDataField(HeroActorCharacterModel),

            // Plan is to eventually use the Actor.Item version of these
            STR: new EmbeddedDataField(HeroItemCharacteristic),
            DEX: new EmbeddedDataField(HeroItemCharacteristic),
            CON: new EmbeddedDataField(HeroItemCharacteristic),
            INT: new EmbeddedDataField(HeroItemCharacteristic),
            EGO: new EmbeddedDataField(HeroItemCharacteristic),
            PRE: new EmbeddedDataField(HeroItemCharacteristic),
            COM: new EmbeddedDataField(HeroItemCharacteristic),
            OCV: new EmbeddedDataField(HeroItemCharacteristic),
            DCV: new EmbeddedDataField(HeroItemCharacteristic),
            OMCV: new EmbeddedDataField(HeroItemCharacteristic),
            DMCV: new EmbeddedDataField(HeroItemCharacteristic),
            SPD: new EmbeddedDataField(HeroItemCharacteristic),
            PD: new EmbeddedDataField(HeroItemCharacteristic),
            ED: new EmbeddedDataField(HeroItemCharacteristic),
            REC: new EmbeddedDataField(HeroItemCharacteristic),
            END: new EmbeddedDataField(HeroItemCharacteristic),
            BODY: new EmbeddedDataField(HeroItemCharacteristic),
            STUN: new EmbeddedDataField(HeroItemCharacteristic),

            RUNNING: new EmbeddedDataField(HeroItemCharacteristic),
            SWIMMING: new EmbeddedDataField(HeroItemCharacteristic),
            LEAPING: new EmbeddedDataField(HeroItemCharacteristic),

            BASESIZE: new EmbeddedDataField(HeroItemCharacteristic),
            DEF: new EmbeddedDataField(HeroItemCharacteristic), // 5e Base and Vehicle
            SIZE: new EmbeddedDataField(HeroItemCharacteristic), // vehicle
            hap: new SchemaField({
                value: new HeroNumberField({ integer: true, nullable: true }),
            }),

            characteristics: new EmbeddedDataField(HeroCharacteristicsModel),
            versionHeroSystem6eUpload: new StringField(),
            versionHeroSystem6eCreated: new StringField(),
            is5e: new BooleanField({ initial: null, nullable: true }),
            heroicIdentity: new BooleanField({ initial: null, nullable: true }),
            initiativeCharacteristic: new StringField(),
            _hdcXml: new StringField(),
        };
    }

    prepareDerivedData() {
        super.prepareDerivedData();
    }

    #cachedParsedXml = new TimeClearedCache();

    get hdcHTMLCollection() {
        try {
            if (this._hdcXml) {
                if (!this.#cachedParsedXml.cacheValue) {
                    this.#cachedParsedXml.cacheValue = new DOMParser().parseFromString(this._hdcXml, "text/xml");
                }
                return this.#cachedParsedXml.cacheValue;
            }
            return null;
        } catch (e) {
            console.error(e);
        }
        return null;
    }

    get actor() {
        return this.parent;
    }

    // static migrateData(source) {
    //     if (source.)
    //     console.log(source);
    //     return super.migrateData(source);
    // }

    // migrateDataSafe(source) {
    //     console.log(source);
    //     debugger;
    // }

    debugModelProps() {
        try {
            // Not sure what to do here as we don't follow the XML -> JSON -> DataModel exacly the same
            // if (this._hdcXml) {
            //     for (const attribute of this.hdcHTMLCollection.children[0].attributes) {
            //         if (this.schema.fields[attribute.name] === undefined) {
            //             console.error(`${this.xmlTag} HeroActorModel is missing ${attribute.name} property.`);
            //         }
            //     }
            // }
            for (const item of this.actor.items) {
                if (item.system.debugModelProps) {
                    item.system.debugModelProps();
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}
