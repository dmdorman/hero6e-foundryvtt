const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { FilePicker } = foundry.applications.apps;
import {
    HeroSystem6eItem,
    createModifierOrAdderFromXml,
    replaceBaseCostForHalfDieAdderXml,
    replaceBaseCostForPipAdderXml,
} from "../../item/item.mjs";
import { adjustmentSourcesPermissive, adjustmentSourcesStrict } from "../../utility/adjustment.mjs";
import { HeroAdderModel, HeroModifierModel } from "../../item/HeroSystem6eTypeDataModels.mjs";
import { ItemModifierApplicationV2 } from "./item-modifier-application.mjs";

// REF: https://foundryvtt.wiki/en/development/guides/converting-to-appv2
// REF: https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide

const ADJUSTMENT_XMLIDS = ["ABSORPTION", "AID", "DISPEL", "DRAIN", "HEALING", "SUCCOR", "SUPPRESS", "TRANSFER"];

export class HeroSystemItemSheetV2 extends HandlebarsApplicationMixin(ItemSheetV2) {
    // Dynamic PARTS based on system.id
    static {
        Hooks.once("init", function () {
            HeroSystemItemSheetV2.initializeTemplate();
        });
    }

    static DEFAULT_OPTIONS = {
        classes: ["herosystem6e", "item-sheet-v2"],
        position: {
            width: 520,
            height: 660,
        },
        actions: {
            create: HeroSystemItemSheetV2.#onModifierCreate,
            delete: HeroSystemItemSheetV2.#onModifierDelete,
            edit: HeroSystemItemSheetV2.#onModifierEdit,
            editImage: HeroSystemItemSheetV2.#onEditImage,
            convertToPower: HeroSystemItemSheetV2.#onConvertToPower,
            convertToEquipment: HeroSystemItemSheetV2.#onConvertToEquipment,
            restoreFromHdc: HeroSystemItemSheetV2.#onRestoreFromHdc,
        },
        window: {
            resizable: true,
            controls: [
                {
                    action: "convertToPower",
                    icon: "fas fa-bolt",
                    label: "Convert to POWER",
                    ownership: "OWNER",
                    visible: HeroSystemItemSheetV2.#canConvertToPower,
                },
                {
                    action: "convertToEquipment",
                    icon: "fas fa-toolbox",
                    label: "Convert to EQUIPMENT",
                    ownership: "OWNER",
                    visible: HeroSystemItemSheetV2.#canConvertToEquipment,
                },
            ],
        },
    };

    static #canConvertToPower() {
        return this.isEditable && this.item.type === "equipment";
    }

    static #canConvertToEquipment() {
        return this.isEditable && ["power", "skill"].includes(this.item.type);
    }

    get title() {
        return `${this.item.type.toUpperCase()}:${this.item.system.XMLID}: ${this.item.name}`;
    }

    static initializeTemplate() {
        // HEROSYS.module isn't defined yet so using game.system.id
        const systemId = game.system.id;

        HeroSystemItemSheetV2.PARTS = {
            body: {
                template: `systems/${systemId}/templates/item/item-sheet-v2/item-sheet-v2.hbs`,
                scrollable: [".sheet-body"],
            },
        };
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const item = this.item;

        // the super defines source (roughly item.source), but we want the actual item for getters and such
        context.item = item;
        context.system = item.system;
        context.config = CONFIG.HERO;

        const configPowerInfo = item.baseInfo;
        context.editOptions = configPowerInfo?.editOptions;

        context.skillCharacteristicOptions = item.is5e
            ? CONFIG.HERO.skillCharacteristics5e
            : CONFIG.HERO.skillCharacteristics;

        if (item.isMartialManeuver) {
            context.martialArtsDamageTypeChoices = CONFIG.HERO.martialArtsDamageTypeChoices;
        }

        // A select list of possible adjustment targets on the character
        if (ADJUSTMENT_XMLIDS.includes(item.system.XMLID)) {
            const { enhances, reduces } = item.splitAdjustmentSourceAndTarget();

            const enhancesValidator = ["AID", "ABSORPTION", "SUCCOR", "TRANSFER"].includes(item.system.XMLID)
                ? adjustmentSourcesStrict
                : adjustmentSourcesPermissive;

            context.possibleEnhances = enhancesValidator({ actor: this.actor, is5e: item.is5e, item });
            context.possibleReduces = adjustmentSourcesPermissive({ actor: this.actor, is5e: item.is5e, item });

            context.enhances = enhances ? enhances.split(",").map((target) => target.toUpperCase().trim()) : [];
            context.reduces = reduces ? reduces.split(",").map((target) => target.toUpperCase().trim()) : [];
        }

        if (configPowerInfo?.editOptions?.showAttacks?.(item)) {
            // Enumerate attacks
            context.attacks = [];
            if (item.actor) {
                const cslChoices = item.cslChoices;

                // Actual items
                for (const attackOrFramework of item.actor.cslItems) {
                    // Make no attempt to disqualify frameworks although we could enumerate and exclude if nothing matches
                    if (attackOrFramework.type !== "framework" && item.system.XMLID !== "WEAPON_MASTER") {
                        // Is this attack a potentially good match? CSL needs to provide ocv to match attacks that use ocv
                        // and omcv for attacks that use omcv.
                        // If it matches neither, then it's probably a purely defensive CSL and it's ok to show no items.
                        const attacksWith = attackOrFramework.system.attacksWith;
                        if (!cslChoices[attacksWith]) {
                            continue;
                        }
                    }

                    // Check if there is an adder (if so attack is checked)
                    const adder = item.adders.find(
                        (a) => a.ALIAS == attackOrFramework.name && a.targetId === attackOrFramework.id,
                    );

                    context.attacks.push({
                        id: attackOrFramework.id,
                        name: attackOrFramework.name,
                        checked: adder ? true : false,
                        title: `${
                            attackOrFramework.system.XMLID +
                            (attackOrFramework.system.DISPLAY ? " (" + attackOrFramework.system.DISPLAY + ")" : "")
                        }: ${attackOrFramework.system.description.replace(/"/g, "&quot;")}`,
                    });
                }

                // If there are any custom adders which don't point to real powers include in the list so that
                // users can uncheck it and make the custom adder go away without having to delete the adder directly
                // as that's not intuitive.
                for (const incorrectCustomAdder of item.customLinkAddersWithoutItems) {
                    const name = `${incorrectCustomAdder.ALIAS} (Invalid)`;
                    context.attacks.push({
                        id: null,
                        name: name,
                        checked: true,
                        title: `The ${name} is invalid. Perhaps it was mispelt in Hero Designer or you have since deleted the linked item? Delete or edit the adder with this name from the ADDER section below.`,
                    });
                }
            }
        }

        // PENALTY_SKILL_LEVELS
        context.penaltyChoices = configPowerInfo?.editOptions?.penaltyChoices;

        // ENDURANCERESERVE has a REC rate
        context.isEnduranceReserve = item.system.XMLID === "ENDURANCERESERVE";
        if (context.isEnduranceReserve) {
            const power = item.system.POWER.find((o) => o.XMLID === "ENDURANCERESERVEREC");
            context.rec = parseInt(power?.LEVELS) || 0;
        }

        return context;
    }

    _onRender(context, options) {
        // Debugging
        globalThis.item = this.item;

        super._onRender(context, options);

        // Show the system version in the window header (the frame persists across re-renders)
        const windowTitle = this.element.querySelector(".window-header .window-title");
        if (windowTitle && !windowTitle.querySelector(".system-version")) {
            const version = document.createElement("span");
            version.className = "system-version";
            version.textContent = ` ${game.system.version}`;
            windowTitle.append(version);
        }

        if (!this.isEditable) return;

        // Every editable input persists itself through these per-input change listeners;
        // form-level submits contribute nothing (see _processFormData).
        // REF: https://foundryvtt.wiki/en/development/api/applicationv2
        const editableInputs = this.element.querySelectorAll(
            `input[name]:not([name=""]), textarea[name]:not([name=""]), select[name]:not([name=""])`,
        );
        for (const input of editableInputs) {
            input.addEventListener("change", (e) => this.#onChangeInput(e));
        }
    }

    /**
     * AppV2 form submission serializes every named input on the sheet, so any submit (Enter key, ...)
     * would re-write dozens of fields the user never touched. Every editable input already persists
     * itself through the per-input change listeners in _onRender, so form-level submits contribute
     * no form data. Programmatic submit({updateData}) calls still work: updateData is merged in
     * _prepareSubmitData after this returns.
     */
    _processFormData() {
        return {};
    }

    /**
     * Core _prepareSubmitData validates with clean:{addTypes:true, copy:false}, which injects
     * `type` even into an empty payload. Skip the update entirely when there is nothing real to write.
     */
    async _processSubmitData(event, form, submitData, options) {
        if (Object.keys(submitData ?? {}).every((k) => k === "type")) return;
        return super._processSubmitData(event, form, submitData, options);
    }

    async #onChangeInput(event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        const input = event.currentTarget;
        const name = input.name;
        const item = this.item;

        let value = input.type?.toLowerCase() === "checkbox" ? input.checked : input.value;
        if (input.dataset.dtype === "Number") {
            value = Number(value);
            // Revert to the original value, like the V1 sheet's NaN scrub did
            if (Number.isNaN(value)) return this.render();
        }

        // CHARGES and CLIPS route through their DataModel helpers
        if (name === "system.numCharges") {
            return item.system.setChargesAndSave(value);
        }
        if (name === "system.clips") {
            return item.system.setClipsAndSave(value);
        }

        // Endurance Reserve REC is the LEVELS of a nested ENDURANCERESERVEREC power
        if (name === "rec") {
            const ENDURANCERESERVEREC = item.findModsByXmlid("ENDURANCERESERVEREC");
            if (ENDURANCERESERVEREC) {
                ENDURANCERESERVEREC.LEVELS = parseInt(value) || 1;
                await item.update({ "system.POWER": item.system.POWER });
            }
            return;
        }

        // Attack toggles on CSL/PSL type items become custom adders
        if (name.startsWith("attacks.")) {
            return this.#toggleAttackAdder(name.slice("attacks.".length), input.checked);
        }

        // Adjustment source/target selects combine into system.INPUT
        if (/^(reduces|enhances)\.\d+$/.test(name)) {
            return this.#updateAdjustmentInput();
        }

        // OPTION selections cascade OPTIONID/OPTION_ALIAS/BASECOST/etc from editOptions.choices
        const choices = item.baseInfo?.editOptions?.choices;
        if (name === "system.OPTION" && choices) {
            const choice = choices.find((c) => c.OPTION === value);
            if (choice && item.system.OPTIONID !== choice.OPTIONID) {
                const changes = Object.keys(choice).reduce(
                    (accum, key) => {
                        accum[`system.${key}`] = choice[key];
                        return accum;
                    },
                    { "system.OPTION": value },
                );
                return item.update(changes);
            }
        }

        // CSL entries live in an ArrayField, which Foundry can only replace wholesale
        const cslMatch = name.match(/^system\.csl\.(\d+)$/);
        if (cslMatch) {
            const csl = [...item.system.csl];
            csl[Number(cslMatch[1])] = value;
            return item.update({ "system.csl": csl });
        }

        if (!foundry.utils.hasProperty(item, name)) {
            console.error(`Unhandled INPUT name="${name}"`);
            return;
        }
        await item.update({ [name]: value });

        // SKILLS: EVERYMAN requires FAMILIARITY
        if (item.system.EVERYMAN && !item.system.FAMILIARITY) {
            await item.update({ "system.FAMILIARITY": true });
        }
    }

    async #toggleAttackAdder(attackId, checked) {
        const item = this.item;
        const attackItem = this.actor?.items.find((o) => o.id === attackId);
        if (!attackItem) {
            console.error(`Attack not found`);
            return;
        }
        const adder = item.system.ADDER.find((a) => a.XMLID === "ADDER" && a.targetId === attackItem.id);

        // Create a custom adder that matches attack name
        if (!adder && checked) {
            const newAdder = {
                XMLID: "ADDER",
                ID: new Date().getTime(),
                ALIAS: attackItem.name,
                BASECOST: "0.0",
                LEVELS: "0",
                NAME: "",
                PRIVATE: false,
                SELECTED: true,
                BASECOST_total: 0,
                targetId: attackItem.id,
                xmlTag: "ADDER",
            };

            const newAdderArray = [...foundry.utils.deepClone(item.system._source.ADDER), newAdder];
            await item.update({ "system.ADDER": newAdderArray });
        } else if (adder && !checked) {
            // Delete custom adders that match attack name
            await item.update({
                "system.ADDER": foundry.utils
                    .deepClone(item.system._source.ADDER)
                    .filter((o) => o.targetId !== attackItem.id),
            });
        }
    }

    async #updateAdjustmentInput() {
        const reduces = Array.from(this.element.querySelectorAll(`select[name^="reduces."]`)).map((el) => el.value);
        const enhances = Array.from(this.element.querySelectorAll(`select[name^="enhances."]`)).map((el) => el.value);

        const newInputStr =
            this.item.system.XMLID === "TRANSFER"
                ? `${reduces.join(", ")} -> ${enhances.join(", ")}`
                : (reduces.length ? reduces : enhances).join(", ");

        return this.item.update({ "system.INPUT": newInputStr });
    }

    static async #onEditImage(event, target) {
        if (!this.isEditable) return;

        const attr = target.dataset.edit || "img";
        const current = foundry.utils.getProperty(this.document, attr);
        const { img } = this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ?? {};
        const fp = new FilePicker.implementation({
            current,
            type: "image",
            redirectToRoot: img ? [img] : [],
            callback: async (path) => {
                await this.document.update({ [attr]: path });
            },
            top: this.position.top + 40,
            left: this.position.left + 10,
        });
        return fp.browse();
    }

    static async #onModifierCreate(event, target) {
        if (!this.isEditable) return;

        const item = this.item;
        const adderOrModifier = target.dataset.type?.toLowerCase();
        if (!adderOrModifier) {
            return ui.notifications.error(`Unable to add adder/modifier.`);
        }

        // Options associated with TYPE (excluding enhancers for now)
        const powers = item.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
        const powersOfType = powers.filter((o) => o.behaviors.includes(adderOrModifier) && o.xml);

        // Make sure we have options
        if (powersOfType.length === 0) {
            ui.notifications.warn(`Creating a new ${adderOrModifier.toUpperCase()} is currently unsupported`);
            return;
        }

        const optionHTML = powersOfType
            .sort((a, b) => {
                const xmlA = new DOMParser().parseFromString(a.xml.trim(), "text/xml");
                const xmlB = new DOMParser().parseFromString(b.xml.trim(), "text/xml");
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
                const xmlA = new DOMParser().parseFromString(a.xml.trim(), "text/xml");
                const alias = xmlA.children[0].getAttribute("ALIAS");

                // Make sure XMLIDs match, if not then skip
                if (a.key != xmlA.children[0].getAttribute("XMLID")) {
                    console.warn(`XMLID mismatch`, a, xmlA.children[0]);
                    return "";
                }

                return `<option value='${a.key}'>${alias}</option>`;
            });

        const content = `
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
            </p>`;

        const inputData = await foundry.applications.api.DialogV2.input({
            window: {
                title: `Create ${adderOrModifier.toUpperCase()} for ${item.system.XMLID}`,
            },
            content,
        });
        if (!inputData?.xmlid) {
            return;
        }

        const power = powersOfType.find((o) => o.key == inputData.xmlid);
        if (!power) {
            ui.notifications.error(`Creating new ${adderOrModifier.toUpperCase()} failed`);
            return;
        }

        // We need special exceptions for 1d6-1, 1/2d6, and +1 modifiers as their BASECOST changes
        // based on what they're being added to.
        let xml = power.xml;
        if (inputData.xmlid === "MINUSONEPIP" || inputData.xmlid === "PLUSONEHALFDIE") {
            xml = replaceBaseCostForHalfDieAdderXml(item, xml);
        } else if (inputData.xmlid === "PLUSONEPIP") {
            xml = replaceBaseCostForPipAdderXml(item, xml);
        }

        const modifierOrAdderData = createModifierOrAdderFromXml(xml);

        // Track when added manually for diagnostic purposes
        modifierOrAdderData.versionHeroSystem6eManuallyCreated = game.system.version;

        let dataModelObject = null;
        if (modifierOrAdderData.xmlTag === "ADDER") {
            dataModelObject = new HeroAdderModel(modifierOrAdderData, { parent: item });
        } else if (modifierOrAdderData.xmlTag === "MODIFIER") {
            dataModelObject = new HeroModifierModel(modifierOrAdderData, { parent: item });
        }

        if (!dataModelObject || !dataModelObject.XMLID) {
            ui.notifications.error(`unable to create ${adderOrModifier}`);
            return;
        }

        // Add the MODIFIER or ADDER to the array
        await item.update({
            [`system.${adderOrModifier.toUpperCase()}`]:
                item.system[adderOrModifier.toUpperCase()].concat(dataModelObject),
        });
    }

    #findAdderOrModifier(target) {
        const xmlid = target.closest("[data-xmlid]")?.dataset.xmlid;
        const adderId = target.closest("[data-adder-id]")?.dataset.adderId;
        const modifierId = target.closest("[data-modifier-id]")?.dataset.modifierId;
        if (!adderId && !modifierId) {
            return null;
        }

        const adderOrModifier =
            this.item.system.ADDER.find((m) => m.ID == adderId) ||
            this.item.system.MODIFIER.find((m) => m.ID == modifierId);
        if (!adderOrModifier || adderOrModifier.XMLID !== xmlid) {
            return null;
        }
        return adderOrModifier;
    }

    static async #onModifierEdit(event, target) {
        if (!this.isEditable) return;

        const adderOrModifier = this.#findAdderOrModifier(target);
        if (!adderOrModifier) {
            return ui.notifications.error(`Unable to edit adder/modifier.`);
        }

        await new ItemModifierApplicationV2({ item: this.item, mod: adderOrModifier }).render(true);
    }

    static async #onModifierDelete(event, target) {
        if (!this.isEditable) return;

        const adderOrModifier = this.#findAdderOrModifier(target);
        if (!adderOrModifier) {
            return ui.notifications.error(`Unable to edit adder/modifier.`);
        }

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: {
                title:
                    game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title") +
                    ` ${adderOrModifier.ALIAS ?? adderOrModifier.XMLID}`,
            },
            content: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Content"),
        });

        if (confirmed) {
            await this.item.update({
                [`system.${adderOrModifier.xmlTag}`]: this.item.system[adderOrModifier.xmlTag]
                    .filter((o) => o.ID != adderOrModifier.ID)
                    .map((o) => o._source),
            });
        }
    }

    static async #onRestoreFromHdc() {
        if (!this.isEditable) return;

        const item = this.item;
        const xml = item.system._hdcXml;
        if (!xml) return;

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: `Restore ${item.name}` },
            content: `<p>Restore <b>${item.name}</b> from its original Hero Designer data?
                Current values (LEVELS, adders, modifiers, charges, notes) will be replaced.</p>`,
        });
        if (!confirmed) return;

        const itemData = HeroSystem6eItem.itemDataFromXml(xml, item.actor);

        // Guarantee arrays exist so a restore clears entries the XML doesn't carry
        itemData.system.ADDER ??= [];
        itemData.system.MODIFIER ??= [];
        itemData.system.POWER ??= [];

        // recursive:false both allows a type change (e.g. converted equipment) and drops
        // properties the original XML doesn't define
        await item.update({ name: itemData.name, type: itemData.type, system: itemData.system }, { recursive: false });

        if (item.actor) {
            await item.setActiveEffects();
        }

        ui.notifications.info(`${item.name} restored from its original Hero Designer data.`);
    }

    static async #onConvertToPower() {
        return this.#convertToType("power", "POWER");
    }

    static async #onConvertToEquipment() {
        return this.#convertToType("equipment", "EQUIPMENT");
    }

    async #convertToType(targetType, targetTypeLabel) {
        if (!this.isEditable) return;

        if (this.item.parentItem) {
            return ui.notifications.error(
                `<b>${this.item.name}</b> is a child of <b>${this.item.parentItem.name}</b>.  Converting a child item type is not supported.`,
            );
        }

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: `Confirm ${this.item.name} type change` },
            content: `Convert ${this.item.name} from a ${this.item.type} to ${targetTypeLabel}`,
        });

        if (!confirmed) {
            return;
        }

        await this.item.update(
            {
                type: targetType,
                system: foundry.utils.mergeObject(this.item.system.toObject(), { _type: targetType }),
            },
            { recursive: false },
        );

        for (const childItem of this.item.childItems) {
            await childItem.update(
                {
                    type: targetType,
                    system: foundry.utils.mergeObject(childItem.system.toObject(), { _type: targetType }),
                },
                { recursive: false },
            );
        }
    }
}
