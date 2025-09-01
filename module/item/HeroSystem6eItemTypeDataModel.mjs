//import { RoundFavorPlayerDown, RoundFavorPlayerUp } from "../utility/round.mjs";
import { getPowerInfo } from "../utility/util.mjs";

const { NumberField, StringField, ObjectField, BooleanField, ArrayField, EmbeddedDataField } = foundry.data.fields;

class HeroItemAdderModCommonModel extends foundry.abstract.DataModel {
    /** @inheritdoc */
    static defineSchema() {
        return {
            XMLID: new StringField(),
            ID: new StringField(),
            BASECOST: new StringField(),
            LEVELS: new NumberField({ integer: true }),
            ALIAS: new StringField(),
            POSITION: new StringField(),
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
            _hdc: new StringField(),
            xmlTag: new StringField(),
            LVLCOST: new StringField(),
            FORCEALLOW: new BooleanField(),
            COMMENTS: new StringField(),
            LVLVAL: new StringField(),
            // ADDER: new ArrayField(new EmbeddedDataField(HeroAdderModel)), // stack size exceeded
            // MODIFIER: new ArrayField(new EmbeddedDataField(HeroModifierModel)), // stack size exceeded
            // POWER: new ArrayField(new EmbeddedDataField(HeroPowerModel)), // stack size exceeded
        };
    }
    get hdc() {
        try {
            return this._hdc ? new DOMParser().parseFromString(this._hdc, "text/xml") : null;
        } catch (e) {
            console.error(e);
        }
        return null;
    }

    // Make sure all the attributes in the HDC XML are in our data model
    debugModelProps() {
        if (this._hdc) {
            for (const attribute of this.hdc.firstChild.attributes) {
                if (this[attribute.name] === undefined) {
                    console.error(`${this.xmlTag} model is missing ${attribute.name} property.`);
                }
            }

            // for (const adder of this.ADDER) {
            //     adder.debugModelProps();
            // }
            // for (const modifier of this.MODIFIER) {
            //     modifier.debugModelProps();
            // }
            // for (const power of this.POWER) {
            //     power.debugModelProps();
            // }
        }
    }

    #baseInfo = null;

    get baseInfo() {
        // cache getPowerInfo
        this.#baseInfo ??= getPowerInfo({ XMLID: this.XMLID, xmlTag: this.xmlTag });
        return this.#baseInfo;
    }

    get cost() {
        return 0;
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

class HeroAdderModel extends HeroItemAdderModCommonModel {
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

    get BASECOST_total() {
        return this.cost;
    }
}

class HeroModifierModel2 extends HeroItemAdderModCommonModel {}

class HeroModifierModel extends HeroItemAdderModCommonModel {
    static defineSchema() {
        return {
            ...super.defineSchema(),
            ADDER: new ArrayField(new EmbeddedDataField(HeroAdderModel)),
            MODIFIER: new ArrayField(new EmbeddedDataField(HeroModifierModel2)),
            //POWER: new ArrayField(new EmbeddedDataField(HeroPowerModel)),
        };
    }
}

class HeroPowerModel extends HeroItemAdderModCommonModel {}

export class HeroSystem6eItemTypeDataModelGetters extends foundry.abstract.TypeDataModel {
    get description() {
        return this.parent.getItemDescription();
    }

    get hdc() {
        try {
            return this._hdc ? new DOMParser().parseFromString(this._hdc, "text/xml") : null;
        } catch (e) {
            console.error(e);
        }
        return null;
    }

    // Make sure all the attributes in the HDC XML are in our data model
    debugModelProps() {
        if (this._hdc) {
            for (const attribute of this.hdc.firstChild.attributes) {
                if (this[attribute.name] === undefined) {
                    console.error(`${this.parent.type} model is missing ${attribute.name} property.`);
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
            POSITION: new StringField(),
            POWER: new ArrayField(new EmbeddedDataField(HeroPowerModel)),
            SFX: new StringField(),
            XMLID: new StringField(),
            SHOW_ACTIVE_COST: new BooleanField(),
            INCLUDE_NOTES_IN_PRINTOUT: new BooleanField(),
            _active: new ObjectField(), // action
            _hdc: new StringField(),
            is5e: new BooleanField(),
            xmlTag: new StringField(),
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
            ACTIVE: new StringField(),
            BODYLEVELS: new StringField(),
            DEFENSE: new StringField(),
            DOESBODY: new StringField(),
            DOESDAMAGE: new StringField(),
            DOESKNOCKBACK: new StringField(),
            DURATION: new StringField(),
            ED: new StringField(),
            EDLEVELS: new StringField(),
            END: new StringField(),
            ENDCOLUMNOUTPUT: new StringField(),
            FDLEVELS: new StringField(),
            GROUP: new StringField(),
            HEIGHTLEVELS: new StringField(),
            INT: new StringField(),
            KILLING: new StringField(),
            LENGTHLEVELS: new StringField(),
            MDLEVELS: new StringField(),
            NUMBER: new StringField(),
            OCV: new StringField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            PD: new StringField(),
            PDLEVELS: new StringField(),
            POINTS: new StringField(),
            POWDLEVELS: new StringField(),
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
