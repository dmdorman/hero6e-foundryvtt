//import { RoundFavorPlayerDown, RoundFavorPlayerUp } from "../utility/round.mjs";
import { getPowerInfo } from "../utility/util.mjs";
import { HeroSystem6eItem } from "./item.mjs";

const { NumberField, StringField, ObjectField, BooleanField, ArrayField, EmbeddedDataField } = foundry.data.fields;

class HeroItemAdderModCommonModel extends foundry.abstract.DataModel {
    // constructor(data, context) {
    //     super(data, context);

    // }

    /** @inheritdoc */
    static defineSchema() {
        return {
            XMLID: new StringField(),
            xmlid: new StringField(),
            ID: new StringField(),
            BASECOST: new StringField(),
            LEVELS: new NumberField({ integer: true }),
            ALIAS: new StringField(),
            POSITION: new NumberField({ integer: true }),
            MULTIPLIER: new StringField(),
            GRAPHIC: new StringField(),
            COLOR: new StringField(),
            SFX: new StringField(),
            SHOW_ACTIVE_COST: new BooleanField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            INCLUDE_NOTES_IN_PRINTOUT: new BooleanField(),
            NAME: new StringField(),
            SHOWALIAS: new BooleanField(),
            PRIVATE: new BooleanField(),
            REQUIRED: new BooleanField(),
            INCLUDEINBASE: new BooleanField(),
            DISPLAYINSTRING: new BooleanField(),
            GROUP: new BooleanField(),
            SELECTED: new BooleanField(),
            _hdcXml: new StringField(),
            xmlTag: new StringField(),
            LVLCOST: new StringField(),
            FORCEALLOW: new BooleanField(),
            COMMENTS: new StringField(),
            LVLVAL: new StringField(),
            QUANTITY: new NumberField({ integer: true }),
            AFFECTS_TOTAL: new StringField(),
            PARENTID: new StringField(),
            INPUT: new StringField(),
            AFFECTS_PRIMARY: new BooleanField(),
            LINKED_ID: new StringField(),
            ROLLALIAS: new StringField(),
            TYPE: new StringField(),
            DISPLAY: new StringField(),
        };
    }
    get hdcHTMLCollection() {
        try {
            return this._hdcXml ? new DOMParser().parseFromString(this._hdcXml, "text/xml") : null;
        } catch (e) {
            console.error(e);
        }
        return null;
    }

    // Make sure all the attributes in the HDC XML are in our data model
    debugModelProps() {
        if (this._hdcXml) {
            for (const attribute of this.hdcHTMLCollection.firstChild.attributes) {
                if (this[attribute.name] === undefined) {
                    console.error(`${this.xmlTag} HeroItemAdderModCommonModel is missing ${attribute.name} property.`);
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
    }

    #baseInfo = null;

    get baseInfo() {
        // cache getPowerInfo
        this.#baseInfo ??= getPowerInfo({ XMLID: this.XMLID, is5e: this.item?.is5e, xmlTag: this.xmlTag });
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

    get cost() {
        console.error(`Unhandled cost`);
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

export class HeroAdderModel extends HeroItemAdderModCommonModel {
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

        // TRANSPORT_FAMILIARITY (possibly others) may have a maximum cost per category
        if (this.SELECTED === false && this.item?.type === "skill") {
            const maxCost = parseFloat(this.BASECOST) || 0;
            if (maxCost > 0 && _cost > maxCost) {
                if (this.item?.system.XMLID !== "TRANSPORT_FAMILIARITY") {
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

class HeroModifierModelCommon extends HeroItemAdderModCommonModel {
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

        // Some MODIFIERs have MODIFIERs (CONTINUOUSCONCENTRATION & ACTIVATEONLY)
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

class HeroPowerModel extends HeroItemAdderModCommonModel {
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

export class HeroSystem6eItemTypeDataModelGetters extends foundry.abstract.TypeDataModel {
    get description() {
        return this.parent.getItemDescription();
    }

    get hdcHTMLCollection() {
        try {
            return this._hdcXml ? new DOMParser().parseFromString(this._hdcXml, "text/xml") : null;
        } catch (e) {
            console.error(e);
        }
        return null;
    }

    get hdcJson() {
        return HeroSystem6eItem.itemDataFromXml(this._hdcXml, this.parent.actor);
    }

    // Make sure all the attributes in the HDC XML are in our data model
    debugModelProps() {
        if (this._hdcXml) {
            for (const attribute of this.hdcHTMLCollection.firstChild.attributes) {
                if (this[attribute.name] === undefined) {
                    console.error(
                        `${this.parent.type} HeroSystem6eItemTypeDataModelGetters is missing ${attribute.name} property.`,
                    );
                }

                for (const adder of this.ADDER) {
                    adder.debugModelProps();
                }
                for (const modifier of this.MODIFIER) {
                    modifier.debugModelProps();
                }
                for (const power of this.POWER) {
                    power.debugModelProps();
                }
            }
        }
    }

    #baseInfo = null;

    get baseInfo() {
        // cache getPowerInfo
        this.#baseInfo ??= getPowerInfo({ item: this.parent, xmlTag: this.xmlTag });
        return this.#baseInfo;
    }

    get item() {
        return this.parent;
    }

    get activePoints() {
        return this.parent.calcItemPoints().activePoints;
    }

    get characterPointCost() {
        return this.parent.calcItemPoints().characterPointCost;
    }

    get realCost() {
        return this.parent.calcItemPoints().realCost;
    }

    get _activePointsWithoutEndMods() {
        return this.parent.calcItemPoints()._activePointsWithoutEndMods;
    }

    get _advantages() {
        return this.parent.calcItemPoints()._advantages;
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
        return this.parent.getMakeAttack().stunBodyDamage;
    }
}

export class HeroSystem6eItemTypeDataModelProps extends HeroSystem6eItemTypeDataModelGetters {
    static defineSchema() {
        return {
            AFFECTS_TOTAL: new BooleanField(),
            ADD_MODIFIERS_TO_BASE: new StringField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            ADDER: new ArrayField(new EmbeddedDataField(HeroAdderModel)),
            ALIAS: new StringField(),
            BASECOST: new StringField(),
            COLOR: new StringField(),
            GRAPHIC: new StringField(),
            ID: new StringField(),
            INPUT: new StringField(),
            LEVELS: new NumberField({ integer: true }),
            MODIFIER: new ArrayField(new EmbeddedDataField(HeroModifierModel)),
            MULTIPLIER: new StringField(),
            NAME: new StringField(),
            NOTES: new StringField(),
            PARENTID: new StringField(),
            POSITION: new NumberField({ integer: true }),
            POWER: new ArrayField(new EmbeddedDataField(HeroPowerModel)),
            SFX: new StringField(),
            XMLID: new StringField(),
            xmlid: new StringField(),
            SHOW_ACTIVE_COST: new BooleanField(),
            INCLUDE_NOTES_IN_PRINTOUT: new BooleanField(),
            _active: new ObjectField(), // action
            _hdcXml: new StringField(),
            is5e: new BooleanField(),
            xmlTag: new StringField(),
            USE_END_RESERVE: new BooleanField(),
            FREE_POINTS: new NumberField({ integer: true }),
        };
    }
}

export class HeroSystem6eItemPower extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),
            AFFECTS_PRIMARY: new BooleanField(),
            AFFECTS_TOTAL: new BooleanField(),
            ACTIVE: new StringField(),
            BODYLEVELS: new StringField(),
            DEFENSE: new StringField(),
            DOESBODY: new StringField(),
            DOESDAMAGE: new StringField(),
            DOESKNOCKBACK: new StringField(),
            DURATION: new StringField(),
            ED: new StringField(),
            EDLEVELS: new NumberField({ integer: true }),
            END: new StringField(),
            ENDCOLUMNOUTPUT: new StringField(),
            FDLEVELS: new StringField(),
            GROUP: new StringField(),
            HEIGHTLEVELS: new StringField(),
            INT: new StringField(),
            KILLING: new StringField(),
            LENGTHLEVELS: new StringField(),
            MDLEVELS: new NumberField({ integer: true }),
            NUMBER: new StringField(),
            OCV: new StringField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            PD: new StringField(),
            PDLEVELS: new NumberField({ integer: true }),
            POINTS: new StringField(),
            POWDLEVELS: new NumberField({ integer: true }),
            PRE: new StringField(),
            QUANTITY: new StringField(),
            RANGE: new StringField(),
            STR: new StringField(),
            TARGET: new StringField(),
            USECUSTOMENDCOLUMN: new StringField(),
            USESTANDARDEFFECT: new BooleanField(),
            ULTRA_SLOT: new StringField(),
            VISIBLE: new StringField(),
            WIDTHLEVELS: new StringField(),

            // Skill
            CHARACTERISTIC: new StringField(),
            EVERYMAN: new BooleanField(),
            FAMILIARITY: new BooleanField(),
            INTBASED: new StringField(),
            LEVELSONLY: new BooleanField(),
            PROFICIENCY: new BooleanField(),
            ROLL: new StringField(),
            TEXT: new StringField(),
            TYPE: new StringField(),

            // Perk
            BASEPOINTS: new StringField(),
            DISADPOINTS: new StringField(),

            // Talent
            //CHARACTERISTIC: new StringField(),
            //GROUP: new StringField(),
            //OPTIONID: new StringField(),
            //POWER: new StringField(),
            //QUANTITY: new StringField(),
            //ROLL: new StringField(),
            //TEXT: new StringField(),
        };
    }
}

export class HeroSystem6eItemEquipment extends HeroSystem6eItemPower {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),
            CARRIED: new StringField(),
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
            EVERYMAN: new BooleanField(),
            FAMILIARITY: new BooleanField(),
            INTBASED: new BooleanField(),
            LEVELSONLY: new BooleanField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            PROFICIENCY: new BooleanField(),
            ROLL: new StringField(),
            TEXT: new StringField(),
            TYPE: new StringField(),
            NATIVE_TONGUE: new BooleanField(),
        };
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
            DISADPOINTS: new StringField(),
            INTBASED: new StringField(),
            NUMBER: new StringField(),
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
            ADDSTR: new BooleanField(),
            DC: new StringField(),
            DCV: new StringField(),
            DISPLAY: new StringField(),
            EFFECT: new StringField(),
            OCV: new StringField(),
            PHASE: new StringField(),
            USEWEAPON: new BooleanField(),
            WEAPONEFFECT: new StringField(),
            XMLID: new StringField(),
            _active: new ObjectField(), // action
            is5e: new BooleanField(),
        };
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
            ADDSTR: new BooleanField(),
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
            RANGE: new StringField(),
            STRMULT: new StringField(),
            USEWEAPON: new BooleanField(),
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
        return this.parent.getMakeAttack().stunBodyDamage;
    }
}

export class HeroSystem6eItemDisadvantage extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        //const { ObjectField, StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return { ...super.defineSchema() };
    }
}

export class HeroSystem6eItemTalent extends HeroSystem6eItemTypeDataModelProps {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        //const { ObjectField, StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return {
            ...super.defineSchema(),

            AFFECTS_PRIMARY: new BooleanField(),
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
