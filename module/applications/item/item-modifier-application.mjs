const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class ItemModifierApplicationV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    // Dynamic PARTS based on system.id
    static {
        Hooks.once("init", function () {
            ItemModifierApplicationV2.initializeTemplate();
        });
    }

    constructor({ item, mod }, options = {}) {
        super(options);
        this.item = item;
        this.modOrig = mod;
        // Item updates replace the source ADDER/MODIFIER arrays wholesale, so hold on to the
        // identity of the edited entry and re-resolve it from current source on every use.
        this.modId = mod.ID;
        this.xmlTag = mod.xmlTag;

        globalThis.mod = this.modOrig; // Global mod is the database view and not the in process changes
    }

    static DEFAULT_OPTIONS = {
        classes: ["herosystem6e", "item-modifier-application"],
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
        return this.item._source.system[this.xmlTag]?.find((m) => m.ID == this.modId);
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        if (!this.modOrig.baseInfo) {
            ui.notifications.error(`${this.modOrig.XMLID} missing baseInfo`, this);
        }

        context.item = this.item;
        context.mod = this.#currentModSource() ?? this.modOrig._source;
        context.editOptions = foundry.utils.deepClone(this.modOrig.baseInfo?.editOptions);

        return context;
    }

    static async #onSubmit(event, form, formData) {
        const expandedData = foundry.utils.expandObject(formData.object);

        const newArray = foundry.utils.deepClone(this.item._source.system[this.xmlTag]);
        const modSource = newArray.find((m) => m.ID == this.modId);
        if (!modSource) {
            return ui.notifications.error(`Unable to edit ${this.modOrig.XMLID}; it no longer exists on the item.`);
        }

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

        await this.item.update({ [`system.${this.xmlTag}`]: newArray });

        // Show any changes from dropdowns
        this.render();
    }
}
