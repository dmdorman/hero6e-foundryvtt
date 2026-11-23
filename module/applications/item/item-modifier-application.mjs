import { HeroAppMixin } from "../api/hero-app-mixin.mjs";
import { declaresNumberContract, rejectNumericInput, validateNumericInput } from "../../utility/numeric-input.mjs";

/**
 * Drop from a submitted payload any text the cell's own number contract refuses.
 *
 * @param {HTMLFormElement} form The submitted form.
 * @param {object} [expandedMod] The `mod` branch of the submitted data, edited in place.
 * @returns {void}
 */
function dropRejectedNumberFields(form, expandedMod) {
    if (!expandedMod) {
        return;
    }

    for (const input of form.querySelectorAll('input[name^="mod."]')) {
        if (!declaresNumberContract(input)) {
            continue;
        }

        const field = input.name.slice("mod.".length);
        const result = validateNumericInput(input);

        if (result.ok) {
            // The submitted text may carry a leading zero or spaces, so write the parsed number.
            expandedMod[field] = result.value;
            continue;
        }

        rejectNumericInput(input, result);
        delete expandedMod[field];
    }
}

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class ItemModifierApplicationV2 extends HeroAppMixin(HandlebarsApplicationMixin(ApplicationV2)) {
    // Dynamic PARTS based on system.id
    static {
        Hooks.once("init", function () {
            ItemModifierApplicationV2.initializeTemplate();
        });
    }

    constructor({ item, mod }, options = {}) {
        super(options);
        this.item = item;
        // Item updates replace the source ADDER/MODIFIER arrays wholesale, so modOrig serves as
        // the stable identity (ID/xmlTag/baseInfo) while the edited entry is re-resolved from
        // current source on every use.
        this.modOrig = mod;
    }

    static DEFAULT_OPTIONS = {
        classes: ["item-modifier-application"],
        tag: "form",
        form: {
            handler: ItemModifierApplicationV2.#onSubmit,
            submitOnChange: true, // submit when any input changes
            closeOnSubmit: false, // do not close when submitted
        },
        position: {
            width: 450,
            height: "auto",
        },
        window: {
            resizable: true,
        },
    };

    static initializeTemplate() {
        // HEROSYS.module isn't defined yet so using game.system.id
        const systemId = game.system.id;

        ItemModifierApplicationV2.PARTS = {
            body: {
                template: `systems/${systemId}/templates/item/item-modifier-application.hbs`,
                scrollable: [""],
            },
        };
    }

    get title() {
        return `Edit ${this.modOrig.XMLID} of ${this.item.system.XMLID}`;
    }

    #currentModSource() {
        return this.item._source.system[this.modOrig.xmlTag]?.find((m) => m.ID == this.modOrig.ID);
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        if (!this.modOrig.baseInfo) {
            ui.notifications.error(`${this.modOrig.XMLID} missing baseInfo`, this);
        }

        context.item = this.item;
        context.mod = this.#currentModSource() ?? this.modOrig._source;
        context.editOptions = this.modOrig.baseInfo?.editOptions;

        return context;
    }

    static async #onSubmit(event, form, formData) {
        const expandedData = foundry.utils.expandObject(formData.object);

        const xmlTag = this.modOrig.xmlTag;
        const newArray = foundry.utils.deepClone(this.item._source.system[xmlTag]);
        const modSource = newArray.find((m) => m.ID == this.modOrig.ID);
        if (!modSource) {
            return ui.notifications.error(`Unable to edit ${this.modOrig.XMLID}; it no longer exists on the item.`);
        }

        dropRejectedNumberFields(form, expandedData.mod);

        foundry.utils.mergeObject(modSource, expandedData.mod ?? {});

        // OPTION selections cascade OPTIONID/OPTION_ALIAS/BASECOST from editOptions.choices
        const choices = this.modOrig.baseInfo?.editOptions?.choices;
        if (choices) {
            const choiceSelected = choices.find((o) => o.OPTION === modSource.OPTION);
            if (choiceSelected) {
                modSource.OPTIONID = choiceSelected.OPTIONID;
                modSource.OPTION_ALIAS = choiceSelected.OPTION_ALIAS;
                modSource.BASECOST = choiceSelected.BASECOST || modSource.BASECOST;
            }
        }

        await this.item.update({ [`system.${xmlTag}`]: newArray });

        // Show any changes from dropdowns
        this.render();
    }
}
