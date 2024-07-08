import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eItem } from "./item.mjs";
import { editSubItem, deleteSubItem } from "../powers/powers.mjs";
import {
    adjustmentSourcesPermissive,
    adjustmentSourcesStrict,
} from "../utility/adjustment.mjs";
import { ItemModifierFormApplication } from "../item/item-modifier-application.mjs";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class HeroSystem6eItemSheet extends ItemSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["herosystem6e", "sheet", "item"],
            width: 520,
            height: 660,
            scrollY: [".sheet-body"],
        });
    }

    /** @override */
    get template() {
        const path = `systems/${HEROSYS.module}/templates/item`;

        if (
            [
                "ABSORPTION",
                "AID",
                "DISPEL",
                "DRAIN",
                "HEALING",
                "SUCCOR",
                "SUPPRESS",
                "TRANSFER",
            ].includes(this.item.system.XMLID)
        ) {
            return `${path}/item-${this.item.type}-adjustment-sheet.hbs`;
        }

        if (["ENDURANCERESERVE"].includes(this.item.system.XMLID)) {
            return `${path}/item-${
                this.item.type
            }-${this.item.system.XMLID.toLowerCase()}-sheet.hbs`;
        }

        // if (
        //     ["MENTAL_COMBAT_LEVELS", "COMBAT_LEVELS"].includes(
        //         this.item.system.XMLID,
        //     )
        // ) {
        //     return `${path}/item-${this.item.type}-combat-levels-sheet.hbs`;
        // }

        // Trying to see if we can get most items to use the generic power sheet
        if (["skill"].includes(this.item.type)) {
            return `${path}/item-power-sheet.hbs`;
        }

        return `${path}/item-${this.item.type}-sheet.hbs`;
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        const data = super.getData();

        // Grab the item's data.
        //const itemData = data.data

        // Re-define the template data references.
        // data.item = itemData
        // data.data = itemData.data
        // data.config = CONFIG.HERO

        // Grab the item
        const item = data.item;

        // Re-define the template data references.
        //data.item = item
        data.system = item.system;
        data.config = CONFIG.HERO;
        data.alphaTesting = game.settings.get(game.system.id, "alphaTesting");

        // Easy reference to ActiveEffects with an origin of this item
        if (this.actor) {
            data.effects = this.actor.effects.filter(
                (o) => o.origin === item.uuid,
            );
        } else {
            data.effects = this.document.effects;
        }

        // Signed OCV and DCV
        if (data.system.ocv != undefined) {
            data.system.ocv = ("+" + parseInt(data.system.ocv)).replace(
                "+-",
                "-",
            );
        }
        if (data.system.dcv != undefined) {
            data.system.dcv = ("+" + parseInt(data.system.dcv)).replace(
                "+-",
                "-",
            );
        }

        const configPowerInfo = item.baseInfo;
        data.sheet = { ...(configPowerInfo?.sheet || {}) };
        data.editOptions = configPowerInfo?.editOptions;

        // SFX
        const sfx = [
            "Default",
            "Acid",
            "Alien",
            "Air/Wind",
            "Animal",
            "Body Control",
            "Chi",
            "Cosmic Energy",
            "Cyberkinesis",
            "Darkness",
            "Density Alteration",
            "Dimensional Manipulation",
            "Earth/Stone",
            "Electricity",
            "Emotion Control",
            "Fire/Heat",
            "Force",
            "Gravity",
            "Ice/Cold",
            "Illusion",
            "Kinetic Energy",
            "Light",
            "Luck",
            "Magic/Mystic",
            "Magnetism",
            "Martial Arts",
            "Matter Manipulation",
            "Mental/Psionic",
            "Metamorphic",
            "Precognition",
            "Radiation",
            "Serum Based",
            "Shape Alteration",
            "Size Alteration",
            "Sleep/Dream",
            "Solar/Celestial",
            "Sonic",
            "Speedster",
            "Strength/Toughness",
            "Stretching",
            "Telekinetic",
            "Teleportation",
            "Time",
            "Vibration",
            "Water",
            "Weather",
            "Wood/Plant",
            "Miscellaneous",
        ];

        data.sheet.SFX = {
            selectOptions: sfx.reduce((current, item) => {
                current[item] = item;
                return current;
            }, {}),
        };

        // A select list of possible adjustment targets on the character
        if (
            item.system.XMLID === "ABSORPTION" ||
            item.system.XMLID === "AID" ||
            item.system.XMLID === "HEALING" ||
            item.system.XMLID === "DISPEL" ||
            item.system.XMLID === "DRAIN" ||
            item.system.XMLID === "SUCCOR" ||
            item.system.XMLID === "SUPPRESS" ||
            item.system.XMLID === "TRANSFER"
        ) {
            const { enhances, reduces } = item.splitAdjustmentSourceAndTarget();

            const enhancesValidator =
                item.system.XMLID === "AID" ||
                item.system.XMLID === "ABSORPTION" ||
                item.system.XMLID === "SUCCOR" ||
                item.system.XMLID === "TRANSFER"
                    ? adjustmentSourcesStrict
                    : adjustmentSourcesPermissive;

            data.possibleEnhances = enhancesValidator(
                this.actor,
                this.item.is5e,
            );
            data.possibleReduces = adjustmentSourcesPermissive(
                this.actor,
                this.item.is5e,
            );

            data.enhances = enhances
                ? enhances
                      .split(",")
                      .map((target) => target.toUpperCase().trim())
                : [];
            data.reduces = reduces
                ? reduces
                      .split(",")
                      .map((target) => target.toUpperCase().trim())
                : [];
        }

        // Combat Skill Levels & Mental Combat Levels
        if (
            ["MENTAL_COMBAT_LEVELS", "COMBAT_LEVELS"].includes(
                this.item.system.XMLID,
            )
        ) {
            let _ocv = "ocv";
            let _dcv = "dcv";
            if (this.item.system.XMLID === "MENTAL_COMBAT_LEVELS") {
                _ocv = "omcv";
                _dcv = "dmcv";
            }
            data.cslChoices = { [_ocv]: _ocv };
            if (this.item.system.OPTION != "SINGLE") {
                data.cslChoices[_dcv] = _dcv;
                data.cslChoices.dc = "dc";
            }

            // Make sure CSL's are defined
            if (!item.system.csl) {
                item.system.csl = {};
                for (let c = 0; c < parseInt(item.system.LEVELS || 0); c++) {
                    item.system.csl[c] = _ocv;
                }
                item.update({ "system.csl": item.system.csl });
            }

            // CSL radioBoxes names
            data.csl = [];
            for (let c = 0; c < parseInt(item.system.LEVELS || 0); c++) {
                data.csl.push({
                    name: `system.csl.${c}`,
                    value: item.system.csl[c],
                });
            }

            // Enumerate attacks
            // data.attacks = [];
            // if (!item.system.attacks) item.system.attacks = {};
            // for (let attack of item.actor.items.filter(
            //     (o) =>
            //         (o.type === "attack" || o.system.subType === "attack") &&
            //         o.system.uses === _ocv,
            // )) {
            //     if (!item.system.attacks[attack.id]) {
            //         item.system.attacks[attack.id] = false;
            //     }
            //     data.attacks.push({
            //         name: attack.name,
            //         id: attack.id,
            //         checked: item.system.attacks[attack.id],
            //     });
            // }
        }

        if (configPowerInfo?.editOptions?.showAttacks) {
            // Enumerate attacks
            data.attacks = [];
            if (item.actor) {
                for (const attack of item.actor.items.filter(
                    (o) =>
                        (o.type === "attack" ||
                            o.system.subType === "attack") &&
                        (!o.baseInfo.behaviors.includes("optional-maneuver") ||
                            game.settings.get(
                                HEROSYS.module,
                                "optionalManeuvers",
                            )),
                )) {
                    // Check if there is an adder (if so attack is checked)
                    const adder = (this.item.system.ADDER || []).find(
                        (o) =>
                            o.ALIAS === attack.system.ALIAS ||
                            o.ALIAS == attack.name,
                    );

                    data.attacks.push({
                        id: attack.id,
                        name: attack.system.NAME || attack.name,
                        checked: adder ? true : false,
                        title: `${
                            attack.system.XMLID +
                            (attack.system.DISPLAY
                                ? " (" + attack.system.DISPLAY + ")"
                                : "")
                        }: ${attack.system.description.replace(
                            /"/g,
                            "&quot;",
                        )}`,
                    });
                }

                // Not sure if we should SORT or not
                // data.attacks.sort((a, b) => {
                //     if (a.name.toUpperCase() < b.name.toUpperCase()) {
                //         return -1;
                //     }
                //     if (a.name.toUpperCase() > b.name.toUpperCase()) {
                //         return 1;
                //     }
                //     return 0;
                // });
            }
        }

        // PENALTY_SKILL_LEVELS
        data.penaltyChoices = item.baseInfo?.editOptions?.penaltyChoices;

        // ENDURANCERESERVE has a REC rate
        if (item.system.XMLID == "ENDURANCERESERVE") {
            const power = item.system.POWER.find(
                (o) => o.XMLID === "ENDURANCERESERVEREC",
            );
            data.rec = parseInt(power?.LEVELS) || 0;
        }

        return data;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Roll handlers, click handlers, etc. would go here.
        html.find(".rollable").click(this._onSheetAction.bind(this));

        // Add sub 'Item'
        html.find(".item-create").click(this._onSubItemCreate.bind(this));

        // Update Inventory Item
        html.find(".item-edit").click(this._onEditItem.bind(this));

        // Delete Inventory Item
        html.find(".item-delete").click(this._onDeleteItem.bind(this));

        // Active Effects
        html.find(".effect-create").click(this._onEffectCreate.bind(this));
        html.find(".effect-delete").click(this._onEffectDelete.bind(this));
        html.find(".effect-edit").click(this._onEffectEdit.bind(this));
        html.find(".effect-toggle").click(this._onEffectToggle.bind(this));

        // Modifiers
        html.find(".modifier-create").click(this._onModifierCreate.bind(this));
        html.find(".modifier-edit").click(this._onModifierEdit.bind(this));
        html.find(".modifier-delete").click(this._onModifierDelete.bind(this));
    }

    async _onModifierCreate(event) {
        event.preventDefault();
        const action = $(event.currentTarget)
            .closest(".modifier-create")
            .data().action;

        if (!action) {
            return ui.notifications.error(`Unable to add adder/modifier.`);
        }

        // Options associated with TYPE (excluding enhancers for now)
        const powers = this.item.actor.system.is5e
            ? CONFIG.HERO.powers5e
            : CONFIG.HERO.powers6e;

        const adderOrModifier = action.replace("create", "").toLowerCase();
        const item = this.item;

        const powersOfType = powers.filter(
            (o) => o.behaviors.includes(adderOrModifier) && o.xml,
        );

        // Make sure we have options
        if (powersOfType.length === 0) {
            ui.notifications.warn(
                `Creating a new ${adderOrModifier.toUpperCase()} is currently unsupported`,
            );
            return;
        }

        const optionHTML = powersOfType
            .sort((a, b) => {
                const parserA = new DOMParser();
                const xmlA = parserA.parseFromString(a.xml.trim(), "text/xml");
                const parserB = new DOMParser();
                const xmlB = parserB.parseFromString(b.xml.trim(), "text/xml");
                const nameA = xmlA.children[0].getAttribute("ALIAS");
                const nameB = xmlB.children[0].getAttribute("ALIAS");
                if (nameA < nameB) {
                    return -1;
                }
                if (nameA > nameB) {
                    return 1;
                }

                // names must be equal
                return 0;
            })
            .map(function (a) {
                const parserA = new DOMParser();
                const xmlA = parserA.parseFromString(a.xml.trim(), "text/xml");
                const alias = xmlA.children[0].getAttribute("ALIAS");

                // Make sure XMLID's match, if not then skip
                if (a.key != xmlA.children[0].getAttribute("XMLID")) {
                    console.warn(`XMLID mismatch`, a, xmlA.children[0]);
                    return "";
                }

                return `<option value='${a.key}'>${alias}</option>`;
            });

        // Need to select a specific XMLID
        const form = `
            <form>
            <p>
                Adding ADDERs and MODIFIERs is limited and has not been fully vetted.  
                Invalid adders/modifiers are likely to be ignored and may cause automation issues.
                Cost and Active Points may not be updated.
            </p>
            <p>
            <label>Select ${adderOrModifier}:</label>
            <br>
                <select name="xmlid">
                    ${optionHTML}
                </select>
            </p>
            </form>`;

        const d = new Dialog({
            title: `Create ${adderOrModifier.toUpperCase()} for ${
                this.item.system.XMLID
            }`,
            content: form,
            buttons: {
                create: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Create",
                    callback: async function (html) {
                        const formElement = html[0].querySelector("form");
                        const formData = new FormDataExtended(formElement);
                        const formDataObject = formData.object;
                        if (formDataObject.xmlid === "none") return;

                        const power = powers.find(
                            (o) => o.key == formDataObject.xmlid,
                        );
                        if (!power) {
                            ui.notifications.error(
                                `Creating new ${adderOrModifier.toUpperCase()} failed`,
                            );
                            return;
                        }

                        // Warn if xml is missing as the item is likely missing properties that we are expecting
                        if (!power.xml) {
                            ui.notifications.warn(
                                `${power.key.toUpperCase()} is missing default properties.  This may cause issues with automation and cost calculations.`,
                            );
                        }

                        // Prepare the modifier object. This is not really an item, but a MODIFER or ADDER
                        // Using a simplied version of HeroSystemItem6e.itemDataFromXml for now.
                        let modifierData = {};
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(
                            power.xml,
                            "text/xml",
                        );
                        for (const attribute of xmlDoc.children[0].attributes) {
                            switch (attribute.value) {
                                case "Yes":
                                case "YES":
                                    modifierData[attribute.name] = true;
                                    break;
                                case "No":
                                case "NO":
                                    modifierData[attribute.name] = false;
                                    break;
                                // case "GENERIC_OBJECT":
                                //     modifierData[attribute.name] =
                                //     modifierData.tagName.toUpperCase(); // e.g. MULTIPOWER
                                //     break;
                                default:
                                    modifierData[attribute.name] =
                                        attribute.value.trim();
                            }
                        }

                        // Track when added manually for diagnostic purposes
                        modifierData.versionHeroSystem6eManuallyCreated =
                            game.system.version;

                        // Create a unique ID
                        modifierData.ID = new Date().getTime().toString();

                        // Add the modifer (create array if necessary)
                        item.system[adderOrModifier.toUpperCase()] ??= [];
                        item.system[adderOrModifier.toUpperCase()].push(
                            modifierData,
                        );

                        await item._postUpload();
                        await item.actor.CalcActorRealAndActivePoints();
                        return;
                    },
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel",
                    callback: () =>
                        console.log(
                            `Cancel ${adderOrModifier.capitalize()} ${adderOrModifier} create`,
                        ),
                },
            },
        });
        d.render(true);
    }

    async _onModifierEdit(event) {
        event.preventDefault();
        const xmlid = $(event.currentTarget)
            .closest("[data-xmlid]")
            .data().xmlid;
        const adderId = $(event.currentTarget)
            .closest("[data-adder]")
            ?.data()?.adder;
        const modifierId = $(event.currentTarget)
            .closest("[data-modifier]")
            ?.data()?.modifier;
        const id = adderId || modifierId;
        if (!xmlid || !id) {
            return ui.notifications.error(`Unable to edit adder/modifier.`);
        }

        const templateData = {
            item: this.item,
            mod: this.item.findModById(id, xmlid),
        };
        await new ItemModifierFormApplication(templateData).render(true);
    }

    async _onModifierDelete(event) {
        event.preventDefault();
        const xmlid = $(event.currentTarget)
            .closest("[data-xmlid]")
            .data().xmlid;
        const adderId = $(event.currentTarget)
            .closest("[data-adder]")
            ?.data()?.adder;
        const modifierId = $(event.currentTarget)
            .closest("[data-modifier]")
            ?.data()?.modifier;
        const id = adderId || modifierId;
        if (!id) {
            return ui.notifications.error(`Unable to delete modifier/adder.`);
        }

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize(
                "HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title",
            ),
            content: game.i18n.localize(
                "HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Content",
            ),
        });

        if (confirmed) {
            await this.item.deleteModById(id, xmlid);

            // if (this.item.system.charges && xmlid === "CHARGES") {
            //     delete this.item.system.charges;
            //     await this.item.update({ system: this.item.system });
            // }

            await this.item._postUpload();
            await this.item.actor.CalcActorRealAndActivePoints();

            this.render();
        }
    }

    /**
     * Handle mouse click events for character sheet actions
     * @param {MouseEvent} event    The originating click event
     * @private
     */
    _onSheetAction(event) {
        event.preventDefault();
        const button = event.currentTarget;
        switch (button.dataset.action) {
            case "hit-roll":
                return Dialog.confirm({
                    title: `${game.i18n.localize("DND5E.CurrencyConvert")}`,
                    content: `<p>${game.i18n.localize(
                        "DND5E.CurrencyConvertHint",
                    )}</p>`,
                    yes: () => this.actor.convertCurrency(),
                });
            case "rollDeathSave":
                return this.actor.rollDeathSave({ event });
            case "rollInitiative":
                return this.actor.rollInitiative({ createCombatants: true });
        }
    }

    async _updateObject(event, formData) {
        event.preventDefault();

        const expandedData = foundry.utils.expandObject(formData);

        const clickedElement = $(event.currentTarget);
        const form = clickedElement.closest("form[data-id]");
        const id = form.data()?.id;

        if (!id) {
            return;
        }

        // If name is empty then create a default one
        if (!expandedData.name) {
            formData.name = this.item.system.DISPLAY || this.item.system.XMLID;
        }

        // Do all the standard things like updating item properies that match the name of input boxes
        await super._updateObject(event, formData);

        // OPTION_ALIAS may need updating
        let clearAdderAttacks = false; // Clear all attacks and infer new attacks when OPTIONID is changed
        if (
            this.item.getBaseInfo()?.editOptions?.choices &&
            expandedData.system.OPTIONID
        ) {
            const choiceSelected = this.item
                .getBaseInfo()
                .editOptions.choices.find(
                    (o) => o.OPTIONID === expandedData.system.OPTIONID,
                );
            // only update OPTION and OPTION_ALIAS when OPTION has changed.
            // This allows for custom OPTION_ALIAS text for things like DEADLYBLOW.
            if (this.item.system.OPTION != choiceSelected.OPTION) {
                this.item.system.OPTION = choiceSelected.OPTION;
                this.item.system.OPTION_ALIAS = choiceSelected.OPTION_ALIAS;
                this.item.system.BASECOST =
                    choiceSelected.BASECOST || this.item.system.BASECOST;
                clearAdderAttacks = true;
            }
        }

        // ALIAS should match name
        this.item.system.ALIAS = this.item.name;

        // Endurance Reserve
        if (expandedData.rec) {
            const ENDURANCERESERVEREC = this.item.findModsByXmlid(
                "ENDURANCERESERVEREC",
            );
            if (ENDURANCERESERVEREC) {
                this.item.system.value = parseInt(expandedData.rec) || 1;
                await this.item.update({
                    "system.value": this.item.system.value,
                });
            }
        }

        // A select list of possible adjustment targets on the character
        if (
            (expandedData.reduces || expandedData.enhances) &&
            (this.item.system.XMLID === "ABSORPTION" ||
                this.item.system.XMLID === "AID" ||
                this.item.system.XMLID === "HEALING" ||
                this.item.system.XMLID === "DISPEL" ||
                this.item.system.XMLID === "DRAIN" ||
                this.item.system.XMLID === "SUPPRESS" ||
                this.item.system.XMLID === "SUCCOR" ||
                this.item.system.XMLID === "TRANSFER")
        ) {
            let newInputStr;

            if (this.item.system.XMLID === "TRANSFER") {
                newInputStr = `${Object.values(expandedData.reduces).join(
                    ", ",
                )} -> ${Object.values(expandedData.enhances).join(", ")}`;
            } else {
                newInputStr = Object.values(
                    expandedData.reduces || expandedData.enhances,
                ).join(", ");
            }

            await this.item.update({ "system.INPUT": newInputStr });
        }

        // Turn attack toggles into adders
        if (expandedData.attacks) {
            for (const [attackId, checked] of Object.entries(
                expandedData.attacks,
            )) {
                const attackItem = this.actor.items.find(
                    (o) => o.id === attackId,
                );
                const adder = (this.item.system.ADDER || []).find(
                    (adder) =>
                        adder.XMLID === "ADDER" &&
                        adder.ALIAS ===
                            (attackItem.system.ALIAS || attackItem.name),
                );

                // Create a custom adders that matches attack name
                if (!adder && checked) {
                    const newAdder = {
                        XMLID: "ADDER",
                        ID: new Date().getTime().toString(),
                        ALIAS: attackItem.system.ALIAS || attackItem.name,
                        BASECOST: "0.0",
                        LEVELS: "0",
                        NAME: "",
                        PRIVATE: false,
                        SELECTED: true,
                        BASECOST_total: 0,
                    };
                    this.item.system.ADDER ??= [];
                    this.item.system.ADDER.push(newAdder);
                }

                // Delete custom adders that matches attack name
                if (adder && !checked) {
                    this.item.system.ADDER = this.item.system.ADDER.filter(
                        (o) =>
                            o.ALIAS !=
                            (attackItem.system.ALIAS || attackItem.name),
                    );
                }
            }
        }

        // Clear all attacks from ADDERs
        // _postUpload will guess proper attacks
        if (clearAdderAttacks) {
            this.item.system.ADDER = (this.item.system.ADDER || []).filter(
                (o) => o.XMLID != "ADDER" || !parseFloat(o.BASECOST) == 0,
            );
        }

        // SKILLS (LEVELSONLY, FAMILIARITY, EVERYMAN, PROFICIENCY)
        // Generally rely on HBS to enforce valid combinations.
        if (this.item.system.EVERYMAN && !this.item.system.FAMILIARITY) {
            await this.item.update({ "system.FAMILIARITY": true });
        }

        // HD lite (currently only SKILL) uses generic _postUpload
        // TODO: Much of the above is likely not necessary as _postUpload does alot
        await this.item._postUpload();
        if (this.item.actor) {
            await this.item.actor.CalcActorRealAndActivePoints();
        }
    }

    async _onSubItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const data = foundry.utils.duplicate(header.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;

        if (type === "effect") {
            if (!this.actor) {
                return ui.notifications.warn(
                    `Active Effects not handled on items not associated with an actor.`,
                );
            }

            // Active Effects are quirky.
            // It appears in v10 that you cannot createEmbeddedDocuments on an Item already
            // embedded in an Actor.
            // If an Item with AEs is added to an actor, all the AEs on that item
            // are transferred to the actor.
            // Only AEs on actors are used.
            // If you modify an AE on an item already embedded to an actor
            // the actor doesn't receive the updates.
            // The AEs on actor/item are not linked.
            // There is a work around, by keeping track of the AE origin

            let activeEffect = new ActiveEffect().toObject();
            activeEffect.label = "New Effect";
            activeEffect.origin = this.item.uuid;

            await this.actor.createEmbeddedDocuments("ActiveEffect", [
                activeEffect,
            ]);

            // This will update the AE effects on an Item that is attached to an actor
            // but since the updated AEs don't transfer to the actor automatically, seems pointless.
            // You could manually update the corresponding actor as well, perhaps a future feature.
            // await this.item.update({
            //   effects:
            //     [
            //       activeEffect
            //     ]
            // })

            return;
        }

        // Prepare the item object.
        const itemData = {
            name,
            type,
            data,
        };
        const newItem = new HeroSystem6eItem(itemData);

        const id =
            Date.now().toString(32) + Math.random().toString(16).substring(2);
        const changes = {};
        changes[`system.subItems.${type}.${id}.system`] = newItem.system;
        changes[`system.subItems.${type}.${id}.img`] = this.item.img;
        changes[`system.subItems.${type}.${id}.name`] = name;
        changes[`system.subItems.${type}.${id}._id`] = this.item._id + "-" + id;

        return await this.item.update(changes);
    }

    async _onEditItem(event) {
        await editSubItem(event, this.item);
    }

    async _onDeleteItem(event) {
        await deleteSubItem(event, this.item);
    }

    async _onEffectCreate(event) {
        event.preventDefault();
        return await this.actor.createEmbeddedDocuments("ActiveEffect", [
            {
                label: "New Effect",
                icon: "icons/svg/aura.svg",
                origin: this.actor.uuid,
                //"duration.rounds": li.dataset.effectType === "temporary" ? 1 : undefined,
                disabled: true,
            },
        ]);
    }

    async _onEffectDelete(event) {
        event.preventDefault();
        const effectId = $(event.currentTarget)
            .closest("[data-effect-id]")
            .data().effectId;
        const effect = this.item.effects.get(effectId);

        if (!effect) return;

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize(
                "HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title",
            ),
            content: game.i18n.localize(
                "HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Content",
            ),
        });

        if (confirmed) {
            await effect.delete();
            this.render();
        }
    }

    async _onEffectToggle() {
        return this.item.toggle();
    }

    async _onEffectEdit(event) {
        event.preventDefault();
        const effectId = $(event.currentTarget)
            .closest("[data-effect-id]")
            .data().effectId;
        let effect = this.document.effects.get(effectId);
        if (!effect && this.document.actor) {
            effect = this.document.actor.effects.get(effectId);
        }

        effect.sheet.render(true);
    }
}
