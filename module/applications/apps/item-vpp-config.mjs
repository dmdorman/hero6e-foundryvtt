import { HEROSYS } from "../../herosystem6e.mjs";

import { HeroApplication } from "../api/application.mjs";

import { whisperUserTargetsForActor } from "../../utility/util.mjs";

// REF: https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide
// REF: https://foundryvtt.wiki/en/development/api/applicationv2
// REF: DrawSteel item-grant-configuration-dialog.mjs

export class ItemVppConfig extends HeroApplication {
    constructor(options) {
        if (!(options.item?.system?.XMLID === "VPP")) {
            throw new Error("A VPP item must be passed as an option.");
        }

        // uniqueId to prevent duplicate forms for same item
        options.id = `item-vpp-config-${options.item.uuid.replace(/\./g, "-")}`;

        super(options);
        this.#item = options.item;
        this.#tokenUuid = options.tokenUuid;

        // For debugging
        globalThis.item = this.#item;
    }

    static DEFAULT_OPTIONS = {
        classes: ["vpp-config"],
        window: {
            icon: "fa-solid fa-cog",
            title: "Title",
        },
    };

    _configureRenderOptions(options) {
        // This fills in `options.parts` with an array of ALL part keys by default
        // So we need to call `super` first
        super._configureRenderOptions(options);

        // Window title
        foundry.utils.mergeObject(options, {
            window: {
                title: `VPP SLOT SELECT: ${this.item.name}`,
            },
        });
    }

    static initializeTemplate() {
        ItemVppConfig.PARTS = {
            body: {
                template: `systems/${HEROSYS.module}/templates/apps/item-vpp-config.hbs`,
            },
            footer: {
                template: "templates/generic/form-footer.hbs",
            },
        };
    }

    #item;
    get item() {
        return this.#item;
    }

    #tokenUuid;

    #vppSlottedIds = [];

    get vppSlottedItems() {
        return this.#item.childItems.filter((i) => this.#vppSlottedIds.includes(i.id));
    }

    get vppUnSlottedItems() {
        return this.#item.childItems.filter((i) => !this.#vppSlottedIds.includes(i.id));
    }

    get vppSlottedCost() {
        return this.vppSlottedItems.reduce((accumulator, currentValue) => accumulator + currentValue.realCost, 0);
    }

    async _prepareContext(options) {
        if (options.isFirstRender) {
            this.#vppSlottedIds = this.item.childItems.filter((i) => i.system.CARRIED).map((i) => i.id);
        }

        return super._prepareContext(options);
    }

    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);

        switch (partId) {
            case "body":
                context.item = this.item;
                context.vppUnSlottedItems = this.vppUnSlottedItems;
                context.vppSlottedItems = this.vppSlottedItems;
                context.vppPoolPoints = this.item.vppPoolPoints;
                context.vppSlottedCost = this.vppSlottedCost;
                break;
            case "footer":
                context.buttons = [
                    {
                        type: "submit",
                        label: "Confirm",
                        icon: "fa-solid fa-fw fa-check",
                        //disabled: this.advancement.chooseN == null || this.totalChosen !== this.advancement.chooseN,
                    },
                ];
                break;
        }

        return context;
    }

    async _onSubmitForm(formConfig, event) {
        await super._onSubmitForm(formConfig, event);

        // Update VPP items
        const changes = [];
        const changeContent = [];
        for (const vppItem of this.item.childItems) {
            const vppSlotted = this.#vppSlottedIds.includes(vppItem.id);
            if (vppItem.system.vppSlotted !== vppSlotted) {
                changes.push({ _id: vppItem.id, ["system.CARRIED"]: vppSlotted });
                changeContent.push(`<li>${vppItem.name}: ${!vppItem.system.CARRIED ? "Slotted" : "Unslottted"}</li>`);
            }
        }
        if (changes.length > 0) {
            await this.item.actor.updateEmbeddedDocuments("Item", changes);

            const chatData = {
                author: game.user._id,
                style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
                content: `${this.item.name} slots were changed. Variable power pool points: ${this.vppSlottedCost} of ${this.item.vppPoolPoints}. <ul>${changeContent.join("")}</ul>`,
                whisper: whisperUserTargetsForActor(this.item.actor),
                speaker: ChatMessage.getSpeaker({ actor: this.item.actor, token: fromUuidSync(this.#tokenUuid) }),
            };
            await ChatMessage.create(chatData);
        }
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        function vppButtonHandler(ev, context) {
            if (!ev.target.closest("form")) {
                console.error("unable to locate form", context);
                return;
            }
            switch (ev.target.id) {
                case "slotPowerButton": {
                    const selected = Array.from(
                        ev.target.closest("form").querySelectorAll("#vppUnslottedPowerSelect option:checked"),
                    );
                    const selectedIds = selected.map((o) => o.value);
                    context.#vppSlottedIds.push.apply(context.#vppSlottedIds, selectedIds);
                    break;
                }
                case "unslotPowerButton": {
                    const selected = Array.from(
                        ev.target.closest("form").querySelectorAll("#vppSlottedPowerSelect option:checked"),
                    );
                    const selectedIds = selected.map((o) => o.value);
                    context.#vppSlottedIds = context.#vppSlottedIds.filter((id) => !selectedIds.includes(id));
                    break;
                }
                case "defaultButton":
                    context.#vppSlottedIds = [];
                    for (const slotItem of context.item.childItems) {
                        if (context.vppSlottedCost + slotItem.realCost <= context.item.vppPoolPoints) {
                            context.#vppSlottedIds.push(slotItem.id);
                        }
                    }
                    break;
                default:
                    console.warn(`${ev.target.id} is unhandled`);
            }
            context.render();
        }

        function vppSelectHandler(ev, context) {
            if (!ev.target.closest("form")) {
                console.error("unable to locate form", context);
                return;
            }

            // Clear all select options upon SELECT 'blur'
            if (ev.type === "blur") {
                for (const el of ["#vppUnslottedPowerSelect", "#vppSlottedPowerSelect"]) {
                    ev.target
                        .closest("form")
                        .querySelectorAll(`${el} option:checked`)
                        .forEach((opt) => (opt.selected = false));
                }
            }

            const vppUnSlotted = Array.from(
                ev.target.closest("form").querySelectorAll("#vppUnslottedPowerSelect option:checked"),
            );
            const vppSlotted = Array.from(
                ev.target.closest("form").querySelectorAll("#vppSlottedPowerSelect option:checked"),
            );

            context.element.querySelector("#slotPowerButton").disabled = vppUnSlotted.length === 0;
            context.element.querySelector("#unslotPowerButton").disabled = vppSlotted.length === 0;
        }

        // Add EventListeners
        const vppSelectControls = this.form.querySelectorAll("button.vpp-select-control");
        for (const vppSelectButton of vppSelectControls) {
            // Careful "click" doesn't work because blur occurs before click, but mousedown occurs before blur.
            vppSelectButton.addEventListener("mousedown", (ev) => vppButtonHandler(ev, this));
        }
        const vppSelects = this.form.querySelectorAll("select");
        for (const vppSelect of vppSelects) {
            vppSelect.addEventListener("change", (ev) => vppSelectHandler(ev, this));
            vppSelect.addEventListener("blur", (ev) => vppSelectHandler(ev, this));
        }
    }
}
