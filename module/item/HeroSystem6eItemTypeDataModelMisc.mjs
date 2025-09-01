// export class HeroSystem6eItemTypeDataModelEntry extends foundry.abstract.TypeDataModel {
//     static defineSchema() {
//         const fields = foundry.data.fields;
//         // Note that the return is just a simple object
//         return {
//             XMLID: new fields.StringField(),
//         };
//     }
// }

class HeroItemAdderModCommonModel extends foundry.abstract.DataModel {
    /** @inheritdoc */
    static defineSchema() {
        const { StringField } = foundry.data.fields;
        return {
            XMLID: new StringField(),
            ID: new StringField(),
            BASECOST: new StringField(),
            LEVELS: new StringField(),
            ALIAS: new StringField(),
            POSITION: new StringField(),
            MULTIPLIER: new StringField(),
            GRAPHIC: new StringField(),
            COLOR: new StringField(),
            SFX: new StringField(),
            SHOW_ACTIVE_COST: new StringField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            OPTION_ALIAS: new StringField(),
            INCLUDE_NOTES_IN_PRINTOUT: new StringField(),
            NAME: new StringField(),
            SHOWALIAS: new StringField(),
            PRIVATE: new StringField(),
            REQUIRED: new StringField(),
            INCLUDEINBASE: new StringField(),
            DISPLAYINSTRING: new StringField(),
            GROUP: new StringField(),
            SELECTED: new StringField(),
        };
    }

    get aaron() {
        return this.XMLID + "aaron";
    }

    /** @inheritdoc */
    // toString() {
    //     const letter = this.value === 1 ? (this.letter ?? "") : "";
    //     return this.value + letter;
    // }
}

class HeroAdderModel extends HeroItemAdderModCommonModel {}

class HeroModifierModel extends HeroItemAdderModCommonModel {}

class HeroPowerModel extends HeroItemAdderModCommonModel {}

export class HeroSystem6eItemTypeDataModelMisc extends foundry.abstract.TypeDataModel {
    /// https://foundryvtt.wiki/en/development/api/DataModel

    static defineSchema() {
        const { StringField, ArrayField, EmbeddedDataField } = foundry.data.fields;
        // Note that the return is just a simple object
        return {
            ACTIVECOST: new StringField(),
            ADDER: new ArrayField(new EmbeddedDataField(HeroAdderModel)),
            ADDSTR: new StringField(),
            ALIAS: new StringField(),
            BASECOST: new StringField(),
            CATEGORY: new StringField(),
            CHARACTERISTIC: new StringField(),
            COLOR: new StringField(),
            CUSTOM: new StringField(),
            DAMAGETYPE: new StringField(),
            EDLEVELS: new StringField(),
            DC: new StringField(),
            DCV: new StringField(),
            DISPLAY: new StringField(),
            DISPLAYINSTRING: new StringField(),
            ACTIVE: new StringField(),
            EFFECT: new StringField(),
            FAMILIARITY: new StringField(),
            GRAPHIC: new StringField(),
            GROUP: new StringField(),
            MDLEVELS: new StringField(),
            ID: new StringField(),
            POWDLEVELS: new StringField(),
            INCLUDE_NOTES_IN_PRINTOUT: new StringField(),
            LENGTHLEVELS: new StringField(),
            INCLUDEINBASE: new StringField(),
            INPUT: new StringField(),
            LEVELS: new StringField(),
            HEIGHTLEVELS: new StringField(),
            BODYLEVELS: new StringField(),
            LEVELSONLY: new StringField(),
            MAXSTR: new StringField(),
            WIDTHLEVELS: new StringField(),
            MODIFIER: new ArrayField(new EmbeddedDataField(HeroModifierModel)),
            MULTIPLIER: new StringField(),
            INTBASED: new StringField(),
            EVERYMAN: new StringField(),
            NAME: new StringField(),
            NOTES: new StringField(),
            OCV: new StringField(),
            OPTION_ALIAS: new StringField(),
            OPTION: new StringField(),
            OPTIONID: new StringField(),
            PARENTID: new StringField(),
            PDLEVELS: new StringField(),
            PHASE: new StringField(),
            POSITION: new StringField(),
            POWER: new ArrayField(new EmbeddedDataField(HeroPowerModel)),
            PRIVATE: new StringField(),
            PROFICIENCY: new StringField(),
            QUANTITY: new StringField(),
            RANGE: new StringField(),
            REQUIRED: new StringField(),
            SELECTED: new StringField(),
            STRMULT: new StringField(),
            SFX: new StringField(),
            SHOW_ACTIVE_COST: new StringField(),
            SHOWALIAS: new StringField(),
            USEWEAPON: new StringField(),
            USESTANDARDEFFECT: new StringField(),
            WEAPONEFFECT: new StringField(),
            XMLID: new StringField(),

            //_hdc: new StringField({}), // STORE RAW XML (strip off image)
        };
    }

    get adders() {
        return this.ADDER.map((a) => ({ a, cost: 0 }));
    }

    static migrateData(data) {
        const proficiencies = data.proficiencies ?? {};
        if ("weapons" in proficiencies) {
            proficiencies.weapons = proficiencies.weapons.map((weapon) => {
                return weapon === "bmr" ? "boomerang" : weapon;
            });
        }

        return super.migrateData(data);
    }
}
