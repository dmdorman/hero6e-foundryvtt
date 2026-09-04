const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const { FilePicker } = foundry.applications.apps;
import {
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
            const { enhancesArray, reducesArray } = item.splitAdjustmentSourceAndTarget();

            const enhancesValidator = ["AID", "ABSORPTION", "SUCCOR", "TRANSFER"].includes(item.system.XMLID)
                ? adjustmentSourcesStrict
                : adjustmentSourcesPermissive;

            context.possibleEnhances = enhancesValidator({ actor: this.actor, is5e: item.is5e, item });
            context.possibleReduces = adjustmentSourcesPermissive({ actor: this.actor, is5e: item.is5e, item });

            context.enhances = enhancesArray.map((target) => target.toUpperCase());
            context.reduces = reducesArray.map((target) => target.toUpperCase());
        }

        if (configPowerInfo?.editOptions?.showAttacks?.(item) && item.actor) {
            // Enumerate attacks
            context.attacks = [];
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
                    }: ${attackOrFramework.system.description}`,
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

        // ENDURANCERESERVE has a REC rate
        context.isEnduranceReserve = item.system.XMLID === "ENDURANCERESERVE";
        if (context.isEnduranceReserve) {
            const power = item.system.POWER.find((o) => o.XMLID === "ENDURANCERESERVEREC");
            context.rec = parseInt(power?.LEVELS) || 0;
        }

        // VPP control cost is the LEVELS of a CONTROLCOST adder (6e); 5e derives it from the pool
        context.isVpp = item.system.XMLID === "VPP";
        if (context.isVpp) {
            context.vppControlCost = item.vppControlPoints;
            context.vppControlCostEditable = !!item.findModsByXmlid("CONTROLCOST");
        }

        return context;
    }

    async _renderFrame(options) {
        const frame = await super._renderFrame(options);

        // Add game.system.version to header
        const versionElement = document.createElement("div");
        versionElement.classList.add("game-system-version");
        versionElement.innerText = game.system.version;
        versionElement.setAttribute("data-tooltip", `Hero System version ${game.system.version}`);
        frame.querySelector("HEADER button")?.before(versionElement);

        return frame;
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);

        // Debugging
        globalThis.item = this.item;

        // Every editable input persists itself through this delegated change listener;
        // form-level submits contribute nothing (see _processFormData). The root element
        // persists across renders, so one listener covers every re-rendered part.
        this.element.addEventListener("change", (event) => {
            const input = event.target.closest(
                `input[name]:not([name=""]), textarea[name]:not([name=""]), select[name]:not([name=""])`,
            );
            if (!input || !this.isEditable) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.#onChangeInput(input);
        });
    }

    /**
     * Closing with an input still focused (Escape, programmatic close) never fires that input's
     * change event, which would silently drop the pending edit (#4439). Commit it first.
     */
    async close(options) {
        const active = document.activeElement;
        if (this.isEditable && active?.name && this.element?.contains(active)) {
            await this.#onChangeInput(active);
        }
        return super.close(options);
    }

    /**
     * AppV2 form submission serializes every named input on the sheet, so any submit (Enter key, ...)
     * would re-write dozens of fields the user never touched. Every editable input already persists
     * itself through the delegated change listener in _onFirstRender, so form-level submits contribute
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

    async #onChangeInput(input) {
        const name = input.name;
        const item = this.item;

        let value = input.type?.toLowerCase() === "checkbox" ? input.checked : input.value;
        if (input.dataset.dtype === "Number") {
            value = Number(value);
            // Revert to the original value, like the V1 sheet's NaN scrub did
            if (Number.isNaN(value)) {
                if (foundry.utils.hasProperty(item, name)) {
                    input.value = foundry.utils.getProperty(item, name);
                    return;
                }
                return this.render();
            }
        }

        // CHARGES and CLIPS route through their DataModel helpers
        if (name === "system.numCharges") {
            return item.system.setChargesAndSave(value);
        }
        if (name === "system.clipsTotal") {
            return item.system.setClipsTotalAndSave(value);
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

        // VPP control cost is the LEVELS of a CONTROLCOST adder
        if (name === "vppControlCost") {
            const CONTROLCOST = item.findModsByXmlid("CONTROLCOST");
            if (CONTROLCOST) {
                CONTROLCOST.LEVELS = parseInt(value) || 0;
                await item.update({ [`system.${CONTROLCOST.xmlTag}`]: item.system[CONTROLCOST.xmlTag] });
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

        const changes = { [name]: value };

        // SKILLS: EVERYMAN requires FAMILIARITY
        if (name === "system.EVERYMAN" && value && !item.system.FAMILIARITY) {
            changes["system.FAMILIARITY"] = true;
        }

        await item.update(changes);
    }

    async #toggleAttackAdder(attackId, checked) {
        const item = this.item;
        const attackItem = this.actor?.items.get(attackId);
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

    // Core DocumentSheetV2 ships an editImage action, but it persists the new path via a form
    // submit, which this sheet deliberately suppresses (_processFormData). Update directly instead.
    static async #onEditImage(event, target) {
        if (!this.isEditable) return;

        const attr = target.dataset.edit;
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

        // Options associated with TYPE (excluding enhancers for now).
        // addPower guarantees key/name (XMLID/ALIAS) on every config entry that has xml.
        const powers = item.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
        const powersOfType = powers.filter((o) => o.behaviors.includes(adderOrModifier) && o.xml);

        // Make sure we have options
        if (powersOfType.length === 0) {
            ui.notifications.warn(`Creating a new ${adderOrModifier.toUpperCase()} is currently unsupported`);
            return;
        }

        const optionHTML = powersOfType
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => `<option value='${a.key}'>${a.name}</option>`);

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
        const adderId = target.closest("[data-adder-id]")?.dataset.adderId;
        const modifierId = target.closest("[data-modifier-id]")?.dataset.modifierId;
        if (!adderId && !modifierId) {
            return null;
        }

        return (
            this.item.system.ADDER.find((m) => m.ID == adderId) ||
            this.item.system.MODIFIER.find((m) => m.ID == modifierId) ||
            null
        );
    }

    static async #onModifierEdit(event, target) {
        if (!this.isEditable) return;

        const adderOrModifier = this.#findAdderOrModifier(target);
        if (!adderOrModifier) {
            return ui.notifications.error(`Unable to edit adder/modifier.`);
        }

        // One editor per adder/modifier: refocus an existing window instead of stacking a duplicate
        const appId = `ItemModifierApplication-${this.item.id}-${adderOrModifier.ID}`;
        const existing = foundry.applications.instances.get(appId);
        if (existing) {
            return existing.render({ force: true });
        }
        await new ItemModifierApplicationV2({ item: this.item, mod: adderOrModifier }, { id: appId }).render(true);
    }

    static async #onModifierDelete(event, target) {
        if (!this.isEditable) return;

        const adderOrModifier = this.#findAdderOrModifier(target);
        if (!adderOrModifier) {
            return ui.notifications.error(`Unable to delete adder/modifier.`);
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
        if (!item.system._hdcXml) return;

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: `Restore ${item.name}` },
            content: `<p>Restore <b>${item.name}</b> from its original Hero Designer data?
                Current values (LEVELS, adders, modifiers, charges, notes) will be replaced.</p>`,
        });
        if (!confirmed) return;

        if (await item.restoreFromHdc()) {
            ui.notifications.info(`${item.name} restored from its original Hero Designer data.`);
        }
    }

    static async #onConvertToPower() {
        return this.#convertToType("power");
    }

    static async #onConvertToEquipment() {
        return this.#convertToType("equipment");
    }

    async #convertToType(targetType) {
        if (!this.isEditable) return;

        const item = this.item;
        if (item.parentItem) {
            return ui.notifications.error(
                `<b>${item.name}</b> is a child of <b>${item.parentItem.name}</b>.  Converting a child item type is not supported.`,
            );
        }

        if (item.actor && !item.isValidTypeConversion(targetType, item.actor)) {
            const conversionFailures = item.validationTypeConversionFailures(targetType, item.actor);
            console.error(conversionFailures);
            return ui.notifications.error(conversionFailures[0].message);
        }

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: `Confirm ${item.name} type change` },
            content: `Convert ${item.name} from a ${item.type} to ${targetType.toUpperCase()}`,
        });

        if (!confirmed) {
            return;
        }

        // Converts this item and its deep child tree in one batched transaction (render: false)
        await item.convertToType(targetType);
        this.render();
    }
}
