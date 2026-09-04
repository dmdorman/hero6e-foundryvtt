import { getActorDefensesVsAttack } from "../../utility/defense.mjs";
import { HeroSystem6eActor } from "../../actor/actor.mjs";
import { HeroSystem6eItem } from "../../item/item.mjs";
import {
    getPowerInfo,
    getCharacteristicInfoArrayForActor,
    tokenEducatedGuess,
    whisperUserTargetsForActor,
} from "../../utility/util.mjs";
import { HeroSystem6eCompendium } from "../../compendium/compendium.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { DragDrop } = foundry.applications.ux;
const { FilePicker } = foundry.applications.apps;

// REF: https://foundryvtt.wiki/en/development/guides/converting-to-appv2
// REF: https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide

export class HeroSystemActorSheetV2 extends HandlebarsApplicationMixin(ActorSheetV2) {
    // Dynamic PARTS based on system.id
    static {
        Hooks.once("init", async function () {
            HeroSystemActorSheetV2.initializeTemplate();
        });
    }

    static DEFAULT_OPTIONS = {
        //id: "foo-form",
        // form: {
        //     //handler: TemplateApplication.#onSubmit,
        //     closeOnSubmit: false, // do not close when submitted
        // },
        classes: ["herosystem6e", "actor-sheet-v2"],
        position: {
            width: 800,
            height: 717,
        },
        actions: {
            actorDescription: HeroSystemActorSheetV2.#onActorDescription,
            actorToggle: HeroSystemActorSheetV2.#onActorToggle,
            carried: HeroSystemActorSheetV2.#onCarried,
            clear: HeroSystemActorSheetV2.#onClear,
            clips: HeroSystemActorSheetV2.#onClips,
            configureActorType: HeroSystemActorSheetV2.#onConfigureActorType,
            configureToken: HeroSystemActorSheetV2.#onConfigureToken,
            createActiveEffect: HeroSystemActorSheetV2.#onCreateActiveEffect,
            deleteAllActiveEffects: HeroSystemActorSheetV2.#onDeleteAllActiveEffects,
            deleteAllTemporaryEffects: HeroSystemActorSheetV2.#onDeleteAllTemporaryEffects,
            downloadUploadError: HeroSystemActorSheetV2.#onDownloadUploadError,
            fullHealth: HeroSystemActorSheetV2.#onFullHealth,
            presenceAttack: HeroSystemActorSheetV2.#onPresenceAttack,
            recovery: HeroSystemActorSheetV2.#onRecovery,
            roll: HeroSystemActorSheetV2.#onRoll,
            rollCharacteristicSuccess: HeroSystemActorSheetV2.#onRollCharacteristicSuccess,
            rollCharacteristicFull: HeroSystemActorSheetV2.#onCharacteristicFullRoll,
            rollCharacteristicCasual: HeroSystemActorSheetV2.#onCharacteristicCasualRoll,
            toggle: HeroSystemActorSheetV2.#onToggle,
            toggleChevron: HeroSystemActorSheetV2.#onToggleChevron,
            toggleEffect: HeroSystemActorSheetV2.#onToggleEffect,
            toggleItemContainer: HeroSystemActorSheetV2.#onToggleItemContainer,
            togglePortrait: HeroSystemActorSheetV2.#onTogglePortrait,
            toggleStatus: HeroSystemActorSheetV2.#onToggleStatus,
            updateActorImage: HeroSystemActorSheetV2.#onUpdateActorImage,
            updateTokenImage: HeroSystemActorSheetV2.#onUpdateTokenImage,
            vpp: HeroSystemActorSheetV2.#onVpp,
        },
        //tag: "form", // The default is "div"
        window: {
            resizable: true,
            //     icon: "fas fa-gear", // You can now add an icon to the header
            //     title: "FOO.form.title",
            contentClasses: ["standard-form"],
            controls: [
                {
                    action: "configureActorType",
                    icon: "fal fa-user-robot",
                    label: "Actor type",
                    ownership: "OWNER",
                    visible: HeroSystemActorSheetV2.#canConfigureActorType,
                },
            ],
            tabs: [
                {
                    navSelector: ".sheet-navigation",
                    contentSelector: ".sheet-body",
                    initial: "Attacks",
                },
            ],
        },
        dragDrop: [
            {
                //dragSelector: '[data-drag="true"]',
                dropSelector: "a[data-tab]", //".drop-zone",
            },
        ],
    };

    #dragDrop;

    constructor(options = {}) {
        super(options);
        this.#dragDrop = this.#createDragDropHandlers();
    }

    #createDragDropHandlers() {
        return this.options.dragDrop.map((dragDropHandler) => {
            dragDropHandler.permissions = {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this),
            };
            dragDropHandler.callbacks = {
                dragstart: this._onDragStart.bind(this),
                dragover: this._onDragOver.bind(this),
                drop: this._onDrop.bind(this),
                dragenter: this._onDragEnter.bind(this),
                dragleave: this._onDragLeave.bind(this),
            };
            return new DragDrop(dragDropHandler);
        });
    }

    // REF: foundry.applications.api.DocumentSheetV2
    static #canConfigureSheet() {
        if (!this.options.sheetConfig || !this.isEditable) return false;
        const document = this.document;
        return !!document.collection?.has(document.id) && !document.flags.core?.sheetLock;
    }

    static #canConfigureActorType() {
        // Do not allow changing actor type of unlinked token actor
        return HeroSystemActorSheetV2.#canConfigureSheet && !this.actor.token;
    }

    static async #onActorDescription() {
        await this.actor.actorDescriptionToChat({ token: this.token });
    }

    static async #onDownloadUploadError() {
        const error = this.actor.getFlag(game.system.id, "uploadingError");
        if (!error) return;

        const context = this.actor.getFlag(game.system.id, "uploadingErrorContext") ?? {};
        const foundryBuild = context.foundryBuild ?? game.release?.build ?? null;
        const report = [
            `Actor: ${this.actor.name}`,
            `Foundry: ${context.foundry ?? game.release?.display ?? game.version}${foundryBuild != null ? ` (build ${foundryBuild})` : ``}`,
            `System: ${game.system.id} ${context.system ?? game.system.version}`,
            ``,
            `Error:`,
            error,
        ];
        if (context.actorBase64) {
            report.push(``, `Original actor state (base64):`, context.actorBase64);
        }
        if (context.hdcBase64) {
            report.push(``, `New HDC (base64):`, context.hdcBase64);
        }

        const filename = `${this.actor.name.slugify({ strict: true }) || "actor"}-upload-error.txt`;
        foundry.utils.saveDataToFile(report.join("\n"), "text/plain", filename);
        ui.notifications.info(`Downloaded upload error report for ${this.actor.name}.`);
    }

    static async #onFullHealth() {
        const resetRebuildDisabled = this.actor.token || !this.actor.system._hdcXml;
        const contentFullHealth = `
            <p>
                <b>FULL HEALTH</b>: Set everything to original HDC values and remove all conditions and effects.
                BODY, END, STUN, charges, and other values are not retained.
                It will not remove items.
                This is intended for use when healing an actor after combat or when resetting an NPC between encounters.
            </p>`;

        const contentRestore = `<p>
                <b>RESTORE</b>: ${!this.actor.token ? `<b style='color:red;'>This is not an unlinked actor.</b>` : ``}
                Restore this unlinked actor to match its prototype actor.
                BODY, END, STUN, charges, and other values will be changed to match the prototype actor.
                Items will be added or deleted to match the prototype actor.
                This is intended for restoring the items of this unlinked actor after combat or when resetting an NPC between encounters.
            </p>`;

        const contentReset = `<p>
                <b>RESET</b>: ${this.actor.token ? `<b style='color:red;'>Not supported for unlinked actors.</b>` : ``}
                ${this.actor.system._hdcXml ? `A copy of the original HDC was saved when the actor was created.` : `<b style='color:red;'>A copy of the original HDC is not available.</b>`}
                BODY, END, STUN, charges, and other values will be retained.
                Any missing items will be re-created based on the original HDC.
                You will be prompted to keep any newly acquired items.
                This the same as re-uploading the HDC file except the existing image is retained.
                This is intended for use when an actor is somehow corrupted and the original HDC file is unavailable.
            </p>`;

        const contentRebuild = `<p>
                <b>REBUILD</b>: ${this.actor.token ? `<b style='color:red;'>Not supported for unlinked actors.</b>` : ``}
                ${this.actor.system._hdcXml ? `A copy of the original HDC was saved when the actor was created.` : `<b style='color:red;'>A copy of the original HDC is not available.</b>`}
                BODY, END, STUN, charges, and other values are not retained.
                Any missing items will be re-created based on the original HDC.
                Items will be added or deleted to match the original HDC.
                This is similar to deleting and re-uploading the HDC file except the existing image is retained.
                This is intended for use when an actor is somehow corrupted and the original HDC file is unavailable.
            </p>
        `;

        const content = contentFullHealth + contentRestore + contentReset + contentRebuild;

        const action = await foundry.applications.api.DialogV2.wait({
            window: {
                maxWidth: "200px",
                title:
                    game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.fullHealthConfirm.Title") + ` [${this.actor.name}]`,
            },
            position: {
                width: 600,
            },
            content,
            buttons: [
                {
                    icon: "fas fa-heart-crack",
                    label: "Full Health",
                    action: "fullHealth",
                    tooltip: "",
                },
                {
                    icon: "fa-duotone fa-regular fa-cards-blank",
                    label: "Restore",
                    action: "restore",
                    disabled: !this.actor.token,
                },
                {
                    icon: "fas fa-rotate-left",
                    label: "Reset Actor",
                    action: "reset",
                    disabled: resetRebuildDisabled,
                },
                {
                    icon: "fas fa-hammer",
                    label: "Rebuild",
                    action: "rebuild",
                    disabled: resetRebuildDisabled,
                },
            ],
        });

        switch (action) {
            case "fullHealth":
                return this.actor.fullHealth();
            case "restore":
                return this.actor.restoreUnlinkedActorToMatchPrototype();
            case "reset":
                return this.actor.resetActor();
            case "rebuild":
                return this.actor.rebuildActor();
        }
    }

    static #onRecovery() {
        this.actor.TakeRecovery({ asAction: true, token: this.token });
    }

    static #onPresenceAttack() {
        this.actor.presenceAttack({ token: this.token });
    }

    static #onConfigureActorType() {
        this.actor.changeTypeDialog({
            classes: Array.from(this.classList).filter((c) => c.includes("herosystem") || c.includes("theme")),
        });
    }

    static #onConfigureToken() {
        this.token.sheet.render({ force: true });
    }

    static #onCreateActiveEffect() {
        const activeEffect = {
            name: "New Effect",
            img: "icons/svg/aura.svg",
        };
        this.actor.createEmbeddedDocuments("ActiveEffect", [activeEffect]);
    }

    static async #onDeleteAllTemporaryEffects() {
        const confirm = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete all Temporary Effects" },
            content:
                `<h4>Are you sure?</h4><p>This will permanently delete all ${this.actor.temporaryEffects.length} ` +
                `temporary effects.</p>`,
        });

        if (confirm) {
            await this.actor.deleteEmbeddedDocuments(
                "ActiveEffect",
                this.actor.temporaryEffects.map((ae) => ae.id),
            );
        }
    }

    static async #onDeleteAllActiveEffects() {
        const confirm = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete all activeEffects" },
            content:
                `<h4>Are you sure?</h4><p>This will attempt to permanently delete all ${Array.from(this.actor.allApplicableEffects()).length} ` +
                `active effects.  Some effects will get re-applied.  This may break some powers and/or automation, requiring a re-upload of HDC or FullHealth+Rebuild to fix.</p>`,
        });

        if (confirm) {
            // Intentionally not bulk deleting as we may have errors and we want to delete
            // as many as possible even if some fail instead of failing the entire operation
            // if any single delete fails
            for (const ae of this.actor.allApplicableEffects()) {
                try {
                    await ae.delete();
                } catch (error) {
                    console.error("Error deleting active effect:", error);
                }
            }
        }
    }

    /*
        Override Foundry as we want to be able to config both token and prototype token
    */
    _getHeaderControls() {
        const controls = super._getHeaderControls();

        if (!controls.find((c) => c.action === "configureToken")) {
            controls.splice(1, 0, {
                action: "configureToken",
                icon: "fa-regular fa-circle-user",
                label: "DOCUMENT.Token",
                ownership: "OWNER",
                visible: true,
            });
        }

        return controls;
    }

    get title() {
        return `${this.actor.type.toUpperCase()}: ${this.actor.name}`;
    }

    static initializeTemplate() {
        // HEROSYS.module isn't defined yet so using game.system.id
        const systemId = game.system.id;

        HeroSystemActorSheetV2.PARTS = {
            aside: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-aside-v2.hbs`,
            },
            header: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-header-v2.hbs`,
            },
            tabs: {
                // Foundry-provided generic template
                template: `templates/generic/tab-navigation.hbs`,
                // classes: ['sysclass'], // Optionally add extra classes to the part for extra customization
            },
            attacks: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-attacks-v2.hbs`,
                scrollable: [""],
            },
            defenses: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-defenses-v2.hbs`,
                scrollable: [""],
            },
            movements: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-movements-v2.hbs`,
                scrollable: [""],
            },
            martial: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-martial-v2.hbs`,
                scrollable: [""],
            },
            skills: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-skills-v2.hbs`,
                scrollable: [""],
            },
            maneuvers: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-maneuvers-v2.hbs`,
                scrollable: [""],
            },
            powers: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-powers-v2.hbs`,
                scrollable: [""],
            },
            characteristics: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-characteristics-v2.hbs`,
                scrollable: [""],
            },
            equipment: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-equipment-v2.hbs`,
                scrollable: [""],
            },
            perks: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-perks-v2.hbs`,
                scrollable: [""],
            },
            talents: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-talents-v2.hbs`,
                scrollable: [""],
            },
            disadvantages: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-disadvantages-v2.hbs`,
                scrollable: [""],
            },
            background: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-background-v2.hbs`,
                scrollable: [""],
            },
            effects: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-effects-v2.hbs`,
                scrollable: [""],
            },
            conditions: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-conditions-v2.hbs`,
                scrollable: [""],
            },
            other: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-other-v2.hbs`,
                scrollable: [""],
            },
            analysis: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-analysis-v2.hbs`,
                scrollable: [""],
            },
            invalid: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-invalid-v2.hbs`,
                scrollable: [""],
            },

            uploading: {
                template: `systems/${systemId}/templates/actor/actor-sheet-v2-parts/actor-sheet-uploading-v2.hbs`,
                scrollable: [""],
            },
        };
    }

    #tokenUuid;

    // Fixed-position context menus are appended to document.body (via the popover API), not to this
    // sheet's element, so ApplicationV2 teardown does not remove them. Track them to close on _onClose.
    #contextMenus = [];

    get token() {
        // If it's an unlinked NPC, super.token instantly returns the synthetic token document
        const nativeToken = super.token;
        if (nativeToken) return nativeToken;

        // If it's a linked PC, super.token is null, so it falls back to your saved UUID or guess
        return fromUuidSync(this.#tokenUuid) ?? tokenEducatedGuess({ actor: this.actor });
    }

    static TABS = {
        primary: {
            tabs: [
                { id: "attacks" },
                { id: "defenses" },
                { id: "movements" },
                { id: "martial" },
                { id: "skills" },
                { id: "maneuvers" },
                { id: "powers" },
                { id: "equipment" },
                { id: "characteristics" },
                { id: "perks" },
                { id: "talents" },
                { id: "disadvantages" },
                { id: "background" },
                { id: "effects" },
                { id: "conditions" },
                { id: "other" },
                { id: "analysis" },
                { id: "invalid", cssClass: "validation-error" },
            ],
            labelPrefix: "ActorSheet.Tabs", // Optional. Prepended to the id to generate a localization key
            initial: "attacks", // Set the initial tab
        },
    };

    _items = {};

    async _preparePartContext(partId, context) {
        globalThis.sheet = this;
        //globalThis.token = this.token;
        context = await super._preparePartContext(partId, context);
        context.tab = context.tabs[partId];
        context.actor ??= this.actor;
        context.token ??= this.token;
        context.gameSystemId ??= game.system.id;
        context.items = null;

        try {
            switch (partId) {
                case "aside":
                    this.#prepareContextDefenseSummary(context);
                    context.endReserve = this.actor.items.find((o) => o.system.XMLID === "ENDURANCERESERVE");
                    context.portraitToggleState = this.portraitToggleState;
                    break;

                case "header":
                    this.#prepareContextCharacterPointTooltips(context);
                    break;

                case "tabs":
                    for (const tabName of HeroSystemActorSheetV2.TABS.primary.tabs.map((m) => m.id)) {
                        context.tabs[tabName].cssClass = context.tabs[tabName].cssClass?.split(" ") ?? [];
                        if (this.actor.flags[game.system.id]?.uploading) {
                            context.tabs[tabName].cssClass.push("uploading-blur");
                        }

                        if (!this._items[tabName] || this._items[tabName].length === 0) {
                            context.tabs[tabName].cssClass.push("empty");
                        }

                        // 5e disadvantages
                        if (tabName === "disadvantages" && !this.actor.is5e) {
                            context.tabs[tabName].label = "Complications";
                        }

                        const hv = this.#heroValidationCssForTab(this._items[tabName]);
                        if (hv) {
                            context.tabs[tabName].cssClass.push(hv);
                        }
                        context.tabs[tabName].cssClass = context.tabs[tabName].cssClass.join(" ");
                    }

                    if (!this._items["invalid"]?.length) {
                        delete context.tabs["invalid"];
                    }

                    break;

                case "other":
                    // really nothing to do
                    break;

                case "attacks":
                case "defenses":
                case "movements":
                case "martial":
                case "skills":
                case "maneuvers":
                case "powers":
                case "equipment":
                case "characteristics":
                case "perks":
                case "talents":
                case "disadvantages":
                case "invalid":
                    context.items = this._items[partId];
                    context.searchValue = this.searchValues[partId];
                    break;

                case "background":
                    context.enriched ??= {};
                    context.enriched.BACKGROUND = await foundry.applications.ux.TextEditor.enrichHTML(
                        this.actor.system.CHARACTER.CHARACTER_INFO.BACKGROUND,
                        {
                            relativeTo: this.document,
                        },
                    );
                    context.metricUnits = game.settings.get(game.system.id, "metricUnits");
                    break;

                case "effects":
                    context.allTemporaryEffects = Array.from(this.actor.allApplicableEffects())
                        .filter((ae) => ae.isTemporary)
                        .sort((a, b) => a.name.localeCompare(b.name));
                    context.allConstantEffects = this.actor.getConstantEffects();
                    context.allPersistentEffects = this.actor.getPersistentEffects();
                    context.allInherentEffects = this.actor.getInherentEffects();
                    context.allMiscEffects = this.actor.getMiscEffects();
                    break;

                case "conditions":
                    context.statuses = await this._prepareStatusEffects();
                    break;

                case "analysis":
                    context.analysis = await this._prepareAnalysis();
                    break;

                case "uploading":
                    break;

                default:
                    console.warn(`unhandled part=${partId}`);
                    break;
            }

            //this.#heroValidationCssByItemType(context);

            // Sort items
            if (context.items) {
                context.items = context.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
            }
        } catch (e) {
            console.error(e);
        }
        return context;
    }

    async _prepareContext(options) {
        window.actor = this.actor;

        const context = await super._prepareContext(options);

        try {
            // Early out if we are uploading (if we continue we will likely run into issues
            // requiring ?. optional chaining)
            if (this.actor.flags[game.system.id]?.uploading) {
                return context;
            }

            // Check for missing data model properties.
            // At some point we `can` probably get rid of this check.
            if (this.actor.system.debugModelProps) {
                this.actor.system.debugModelProps();
            }

            context.actor = this.actor;
            context.token = options?.token;
            context.isOwner = this.actor.isOwner;
            context.isGM = game.user.isGM;
            context.gameSystemId = game.system.id;
            context.alphaTesting = game.settings.get(game.system.id, "alphaTesting");
            context.useHAP = game.settings.get(game.system.id, "HAP");

            this._items = {
                attacks: this.actor.items.filter((item) => item.showAttack),
                defenses: this.actor.items.filter((item) => item.baseInfo?.behaviors.includes("defense")),
                movements: this.actor.items.filter((item) => item.baseInfo?.type.includes("movement")),
                martial: this.actor.items.filter((item) => item.type === "martialart" && !item.parentItem),
                skills: this.actor.items.filter((item) => item.type === "skill" && !item.parentItem),
                maneuvers: this.actor.items
                    .filter((item) => item.type === "maneuver" && !item.parentItem)
                    .sort((a, b) => a.name.localeCompare(b.name)),
                powers: this.actor.items.filter((item) => item.type === "power" && !item.parentItem),
                equipment: this.actor.items.filter((item) => item.type === "equipment" && !item.parentItem),
                characteristics: getCharacteristicInfoArrayForActor(this.actor)
                    .filter(
                        (baseInfo) =>
                            !["FLIGHT", "GLIDING", "FTL", "SWINGING", "TUNNELING", "TELEPORTATION"].includes(
                                baseInfo?.key,
                            ),
                    )
                    .map((o) => this.actor.system.characteristics[o.key.toLowerCase()]),
                perks: this.actor.items.filter((item) => item.type === "perk" && !item.parentItem),
                talents: this.actor.items.filter((item) => item.type === "talent" && !item.parentItem),
                disadvantages: this.actor.items.filter((item) => item.type === "disadvantage" && !item.parentItem),
                background: Object.keys(this.actor.system.CHARACTER.CHARACTER_INFO)
                    .filter((key) => key.match(/[A-Z_]+/))
                    .filter((key) => this.actor.system.CHARACTER.CHARACTER_INFO[key]),
                effects: Array.from(this.actor.allApplicableEffects()),
                conditions: this.actor.statuses.size > 0,
                analysis: this.actor.items.find((item) => item.system.activePoints > 0),
                other: [true], // don't consider this empty
                invalid: this.actor.invalidItems,
            };
        } catch (e) {
            console.error(e);
        }

        return context;
    }

    // Character & Active Points tooltip details
    #prepareContextCharacterPointTooltips(context) {
        try {
            context.pointsTitle = "";
            context.activePointsTitle = "";
            if (context.actor.pointsDetail) {
                for (const [key, value] of Object.entries(context.actor.pointsDetail)) {
                    context.pointsTitle += `${key.replace("equipment", "[equipment]")}: ${value}\n`;
                }
            }
            if (context.actor.activePointsDetail) {
                for (const [key, value] of Object.entries(context.actor.activePointsDetail)) {
                    context.activePointsTitle += `${key}: ${value}\n`;
                }
            } else {
                context.activePointsTitle = "Total Active Points (estimate)";
            }
        } catch (e) {
            console.error(e);
        }
    }

    #prepareContextDefenseSummary(context) {
        try {
            // Defense (create fake attacks and get defense results)
            const defense = {};

            // Make a fake actor to hold the fake attacks we're going to create. Give it the
            // same HERO system version as the actor related to this sheet.
            // TODO: Is there a better way to calculate defense without creating fake attacks?

            // Defense PD
            const pdAttack = this.#createStaticFakeAttack(
                "pd",
                `<POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            </POWER>`,
            );
            const {
                defenseValue: defenseValuePD,
                resistantValue: resistantValuePD,
                damageReductionValue: damageReductionValuePD,
                damageNegationValue: damageNegationValuePD,
                defenseTags: defenseTagsPD,
            } = getActorDefensesVsAttack(this.actor, pdAttack);
            defense.PD = defenseValuePD;
            for (const tag of defenseTagsPD.filter(
                (o) => o.operation === "add" && (!o.options?.resistant || o.options?.resistantAdvantage),
            )) {
                defense.PDtags = `${defense.PDtags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.rPD = resistantValuePD;
            for (const tag of defenseTagsPD.filter((o) => o.operation === "add" && o.options?.resistant)) {
                defense.rPDtags = `${defense.rPDtags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.drp = damageReductionValuePD;
            for (const tag of defenseTagsPD.filter((o) => o.operation === "pct")) {
                defense.drptags = `${defense.drptags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.dnp = damageNegationValuePD;
            for (const tag of defenseTagsPD.filter((o) => o.operation === "subtract")) {
                defense.dnptags = `${defense.dnptags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }

            // Defense ED
            const edAttack = this.#createStaticFakeAttack(
                "ed",
                `<POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
        </POWER>`,
            );
            const {
                defenseValue: defenseValueED,
                resistantValue: resistantValueED,
                damageReductionValue: damageReductionValueED,
                damageNegationValue: damageNegationValueED,
                defenseTags: defenseTagsED,
            } = getActorDefensesVsAttack(this.actor, edAttack);
            defense.ED = defenseValueED;
            for (const tag of defenseTagsED.filter((o) => o.operation === "add" && !o.options?.resistant)) {
                defense.EDtags = `${defense.EDtags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.rED = resistantValueED;
            for (const tag of defenseTagsED.filter((o) => o.operation === "add" && o.options?.resistant)) {
                defense.rEDtags = `${defense.rEDtags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.dre = damageReductionValueED;
            for (const tag of defenseTagsED.filter((o) => o.operation === "pct")) {
                defense.dretags = `${defense.dretags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.dne = damageNegationValueED;
            for (const tag of defenseTagsED.filter((o) => o.operation === "subtract")) {
                defense.dnetags = `${defense.dnetags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }

            // Defense MD
            const mdAttack = this.#createStaticFakeAttack(
                "md",
                `<POWER XMLID="EGOATTACK" ID="1695575160315" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            </POWER>`,
            );
            const {
                defenseValue: defenseValueMD,
                resistantValue: resistantValueMD,
                damageReductionValue: damageReductionValueMD,
                damageNegationValue: damageNegationValueMD,
                defenseTags: defenseTagsMD,
            } = getActorDefensesVsAttack(this.actor, mdAttack);
            defense.MD = defenseValueMD;
            for (const tag of defenseTagsMD.filter((o) => o.operation === "add" && !o.options?.resistant)) {
                defense.MDtags = `${defense.MDtags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.rMD = resistantValueMD;
            for (const tag of defenseTagsMD.filter((o) => o.operation === "add" && o.options?.resistant)) {
                defense.rMDtags = `${defense.rMDtags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.drm = damageReductionValueMD;
            for (const tag of defenseTagsMD.filter((o) => o.operation === "pct")) {
                defense.drmtags = `${defense.drmtags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.dnm = damageNegationValueMD;
            for (const tag of defenseTagsMD.filter((o) => o.operation === "subtract")) {
                defense.dnmtags = `${defense.dnmtags || ""}${tag.value.signedString()} ${tag.name} ${tag.shortDesc}\n`;
            }

            // Defense POWD
            const drainAttack = this.#createStaticFakeAttack(
                "drain",
                `<POWER XMLID="DRAIN" ID="1703727634494" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            </POWER>`,
            );
            const {
                defenseValue: defenseValuePOWD,
                resistantValue: resistantValuePOWD,
                defenseTags: defenseTagsPOWD,
            } = getActorDefensesVsAttack(this.actor, drainAttack);
            defense.POWD = defenseValuePOWD;
            for (const tag of defenseTagsPOWD.filter((o) => o.operation === "add" && !o.options?.resistant)) {
                defense.POWDtags = `${defense.POWDtags || ""}${tag.value.signedString()} ${tag.name} ${
                    tag.shortDesc
                }\n`;
            }
            defense.rPOWD = resistantValuePOWD;
            for (const tag of defenseTagsPOWD.filter((o) => o.operation === "add" && o.options?.resistant)) {
                defense.rPOWDtags = `${defense.rPOWDtags || ""}${tag.value.signedString()} ${tag.name} ${
                    tag.shortDesc
                }\n`;
            }

            context.defense = defense;
        } catch (e) {
            console.error(e);
        }
    }

    // Static variable to hold all the sampleAttacks that we use to create defense summary
    static sampleAttacks = {};

    #createStaticFakeAttack(damageType, xml) {
        const is5e = this.actor.is5e;
        const attackKey = `${damageType}Attack${is5e ? "5e" : "6e"}`;
        const defenseCalculationActorKey = `defenseCalculationActor${is5e ? "5e" : "6e"}`;

        // This typically happens during upload.  Don't save anything in static.
        if (is5e === undefined) {
            return;
        }

        HeroSystemActorSheetV2.sampleAttacks[defenseCalculationActorKey] ??= new HeroSystem6eActor(
            {
                name: "Defense Calculation Actor",
                type: "pc",
                system: { is5e },
            },
            {},
        );
        const defenseCalculationActor = HeroSystemActorSheetV2.sampleAttacks[defenseCalculationActorKey];

        if (!HeroSystemActorSheetV2.sampleAttacks[attackKey]) {
            HeroSystemActorSheetV2.sampleAttacks[attackKey] = new HeroSystem6eItem(
                HeroSystem6eItem.itemDataFromXml(xml, defenseCalculationActor),
                { parent: defenseCalculationActor },
            );
            //console.debug(`${attackKey}: Created`);
        } else {
            //console.debug(`${attackKey}: used cache`);
        }
        return HeroSystemActorSheetV2.sampleAttacks[attackKey];
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);

        // options.token is populated by the canvas click event (works for linked & unlinked)
        // this.token captures native unlinked sheets as a clean structural fallback
        // tokenEducatedGuess catches sidebar directory clicks where no token context exists
        const initialToken = options.token ?? this.token ?? tokenEducatedGuess({ actor: this.actor });

        if (initialToken) {
            this.#tokenUuid = initialToken.uuid;
        }

        this.#contextMenus = [
            // General right click on row
            this._createContextMenu(this._getDocumentListContextOptions, "[data-document-uuid]", {
                hookName: "getDocumentListContextOptions",
                parentClassHooks: false,
                fixed: true,
            }),

            // Same menu but for the specific vertical ellipsis control
            this._createContextMenu(this._getDocumentListContextOptions, '[data-action="documentListContext"]', {
                hookName: "getDocumentListContextOptions",
                parentClassHooks: false,
                fixed: true,
                eventName: "click",
            }),
        ];
    }

    _onClose(options) {
        super._onClose(options);

        // Fixed context menus live on document.body and survive sheet teardown; close them explicitly.
        for (const menu of this.#contextMenus) {
            if (menu?.element) menu.close({ animate: false });
        }
    }

    _onRender(context, options) {
        // The ActorSheetV2 super handles DragDrop with the .draggable class of items.
        // This includes dragging items to actor sheet and dragging withing item-list.
        super._onRender(context, options);

        // Uploading class for section.window-content
        // this.element.querySelector("section.window-content").childNodes.forEach((el) => {
        //     if (el.className !== "uploading") {
        //         if (this.actor.flags[game.system.id].uploading) {
        //             el.classList.add("uploading-blur");
        //         }
        //     } else {
        //         console.error(el);
        //     }
        // });

        // We will add additional DragDrop support for dragging items between different tabs (which represent different item.type).
        this.#dragDrop.forEach((d) => d.bind(this.element));

        // Edit profile image on click
        // if (this.actor.isOwner) {
        //     this.element
        //         .querySelector("img[data-edit].profile-img")
        //         ?.addEventListener("click", this._onEditImage.bind(this));
        // }

        // item-description-expand chevron expand collapse
        this.element.querySelectorAll('[data-action="toggleDocumentDescription"]').forEach((el) => {
            el.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopImmediatePropagation();
                ev.target.closest("li").classList.toggle("expanded");
            });
        });

        // Edit input buttons
        // REF: https://foundryvtt.wiki/en/development/api/applicationv2
        const editableInputButtons = this.element.querySelectorAll(
            `input[name]:not([name=""]), textarea[name]:not([name=""]), select[name]:not([name=""])`,
        );
        for (const input of editableInputButtons) {
            // Sidebar uses "Xsystem" to avoid duplicates with the characteristics tab
            const attributeName = input.name.replace("Xsystem", "system");
            if (foundry.utils.hasProperty(this.actor, attributeName)) {
                if (attributeName.endsWith("HEIGHT")) {
                    input.addEventListener("change", async (e) => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        const metricUnits = game.settings.get(game.system.id, "metricUnits");
                        const newValue = e.currentTarget.value / (metricUnits ? 2.54 : 1);
                        await this.actor.update({ [`${attributeName}`]: newValue });
                    });
                } else if (attributeName.endsWith("WEIGHT")) {
                    input.addEventListener("change", async (e) => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        const metricUnits = game.settings.get(game.system.id, "metricUnits");
                        const newValue = e.currentTarget.value / (metricUnits ? 0.45359237 : 1);
                        await this.actor.update({ [`${attributeName}`]: newValue });
                    });
                } else {
                    input.addEventListener("change", async (e) => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        const newValue = e.currentTarget.value;
                        await this.actor.update({ [`${attributeName}`]: newValue });
                    });
                }
            } else if (attributeName.startsWith("endReserve")) {
                const endItem = this.actor.items.find(
                    (item) => item.id === attributeName.match(/endReserve\.([a-zA-z0-9]+)\.value/)?.[1],
                );
                if (endItem) {
                    input.addEventListener("change", async (e) => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        const newValue = e.currentTarget.value;
                        await endItem.update({ "system.value": newValue });
                    });
                } else {
                    console.error(`Unhandled INPUT name="${attributeName}`);
                }
            } else {
                console.error(`Unhandled INPUT name="${attributeName}`);
            }

            this.setChevronStatus(this.element);
        }

        // UPLOAD
        this.element
            .querySelector('[data-action="upload"]')
            ?.addEventListener("change", async (event) => this._uploadCharacterSheet(event), false);

        // SEARCH
        this.element.querySelectorAll('[data-action="search"]').forEach((el) => {
            el.addEventListener("keydown", this.#debouncedSearch, { passive: true });
            if (el.value) {
                this.#onSearch({ target: el });
            }
        });

        // DRAGDROP
        //this.dragDrop.bind(this.element);
    }

    _postRender(context, options) {
        super._postRender(context, options);

        // Somewhere between _onRender and _postRender Foundry disables inputs for non-owners.
        // Re-enable search inputs here for non-owners.
        if (!this.actor.isOwner) {
            this.element.querySelectorAll(`input[data-action="search"]`).forEach((el) => (el.disabled = false));
        }
    }

    /**
     * AppV2 form submission serializes every named input on the sheet, so any submit (Enter key,
     * ClientDocument#sortRelative, ...) would re-write dozens of fields the user never touched.
     * Those writes are not no-ops: an unchanged system.<KEY>.LEVELS in the payload makes
     * _apply5eCalculatedCharacteristics resync that characteristic to base+LEVELS, silently
     * reverting adjustment (AID/DRAIN) results on value/max. Every editable input on this sheet
     * already persists itself through the per-input change listeners in _onRender, so form-level
     * submits contribute no form data. Programmatic submit({updateData}) calls still work:
     * updateData is merged in _prepareSubmitData after this returns.
     */
    _processFormData() {
        return {};
    }

    /**
     * Core _prepareSubmitData validates with clean:{addTypes:true, copy:false}, which injects
     * `type` even into an empty payload. Writing that lone `type` is not harmless: the actor's
     * _preUpdate runs its KO/stun-threshold logic whenever changed.type is present. Skip the
     * update entirely when there is nothing real to write.
     */
    async _processSubmitData(event, form, submitData, options) {
        if (Object.keys(submitData ?? {}).every((k) => k === "type")) return;
        return super._processSubmitData(event, form, submitData, options);
    }

    /**
     * Define whether a user is able to begin a dragstart workflow for a given drag selector
     * @param {string} selector       The candidate HTML selector for dragging
     * @returns {boolean}             Can the current user drag this selector?
     * @protected
     */
    _canDragStart() {
        return this.actor.isOwner;
    }

    /**
     * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
     * @param {string} selector       The candidate HTML selector for the drop target
     * @returns {boolean}             Can the current user drop on this selector?
     * @protected
     */
    _canDragDrop() {
        return this.actor.isOwner;
    }

    /**
     * Callback actions which occur at the beginning of a drag start workflow.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    async _onDragStart(event) {
        await super._onDragStart(event);
        const element = event.currentTarget.closest("[data-document-uuid]");
        if (element) {
            const item = fromUuidSync(element.dataset.documentUuid);
            if (!item) {
                return;
            }
            const dragData = item.toDragData();
            event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        }
    }

    _onDragEnter(event) {
        event.preventDefault();
        const target = event.currentTarget.closest("nav a");
        if (target) target.classList.add("drag-hover");
    }

    _onDragLeave(event) {
        event.preventDefault();
        const target = event.currentTarget.closest("nav a");
        if (target) target.classList.remove("drag-hover");
    }

    /**
     * Deeply compares an incoming item against existing actor items to find an identical match for QUANTITY stacking.
     * Instantiates a temporary in-memory Actor document containing deep-cloned parent and child items
     * so that system getters resolve correctly without mutating the original drop payloads.
     *
     * @param {Object} itemData - The incoming item data object intended for creation.
     * @param {Item|Object} [sourceItem=null] - The original item document or data (used to accurately fetch child items).
     * @param {Object} [options={}] - Configuration options routing the drop context.
     * @param {string} [options.targetType] - The UI tab or target type the item is being dropped onto (e.g., "equipment").
     * @param {Object[]} [itemsToProcess=[]] - The full raw batch of items being dropped, used to link container children in-memory.
     * @returns {Promise<Item|null>} Resolves to the matching existing Item document on the actor, or null if no match is found.
     */
    async _findExistingMatchingItem(itemData, sourceItem = null, options = {}, itemsToProcess = []) {
        const isTopLevel = !itemData.system.PARENTID;
        if (!isTopLevel) return null;

        const targetType = options.targetType || itemData.type;
        if (targetType !== "equipment" && itemData.type !== "equipment") return null;
        if (itemData.type === "list" || itemData.system?.XMLID === "LIST") return null;

        // 1. Clone itemData safely
        const clonedItemData = foundry.utils.deepClone(itemData);
        const parentSystemId = clonedItemData.system?.ID || clonedItemData.system?.id;

        const possibleIds = new Set(
            [parentSystemId, clonedItemData.system?.ID, sourceItem?.system?.ID, clonedItemData._id].filter(Boolean),
        );

        // 2. Deep-clone children from the drop pool before modifying anything for our temp evaluation actor
        const directChildren = itemsToProcess
            .filter((i) => {
                const childParentId = i.system?.PARENTID || i.system?.parentId || i.parent_id;
                return childParentId && possibleIds.has(childParentId);
            })
            .map((i) => {
                const clonedChild = foundry.utils.deepClone(i);
                if (parentSystemId && clonedChild.system) {
                    clonedChild.system.PARENTID = parentSystemId;
                }
                return clonedChild;
            });

        // 3. Spin up the temporary in-memory Actor using cloned data exclusively
        const tempActorClass = game.actors.documentClass;
        const tempActor = new tempActorClass(
            {
                name: "TempEvaluationActor",
                type: this.actor.type || "character",
                items: [clonedItemData, ...directChildren],
            },
            { parent: null },
        );

        const tempItem =
            tempActor.items.get(clonedItemData._id) ||
            tempActor.items.contents.find(
                (i) => (i.system?.XMLID || i.type) === (clonedItemData.system?.XMLID || clonedItemData.type),
            );

        if (!tempItem) return null;

        const getDocumentTreeSignature = async (itemDoc, sourceRaw = null) => {
            let children = itemDoc.childItems || [];

            if (children.length === 0) {
                if (sourceRaw && sourceRaw.childItems) {
                    children = sourceRaw.childItems;
                } else if (itemDoc.pack) {
                    children = await itemDoc.childItemsFromPack();
                }
            }

            const cleanCollection = (arr) =>
                (arr ?? [])
                    .map((entry) => ({
                        XMLID: (entry.XMLID || entry.xmlid || "").toUpperCase(),
                        OPTION: (entry.OPTION || entry.option || "").toString().toUpperCase(),
                        BASECOST: entry.BASECOST ?? entry.baseCost ?? 0,
                    }))
                    .sort((a, b) => a.XMLID.localeCompare(b.XMLID));

            const childSigs = [];
            for (const child of children) {
                const childDoc =
                    child instanceof foundry.abstract.Document
                        ? child
                        : tempActor.items.get(child._id) ||
                          new tempActor.items.documentClass(child, { parent: tempActor });
                childSigs.push(await getDocumentTreeSignature(childDoc));
            }
            childSigs.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

            const sig = {
                xmlid: itemDoc.system?.XMLID || itemDoc.type,
                name: (itemDoc.name ?? "").replace(/\s*\(.*?\)/g, "").trim(),
                activePoints: itemDoc.system?.ACTIVEPOINTS ?? itemDoc.system?.activePoints ?? 0,
                modifiers: cleanCollection(itemDoc.system?.MODIFIER),
                adders: cleanCollection(itemDoc.system?.ADDER),
                children: childSigs,
            };

            return sig;
        };

        const incomingTree = await getDocumentTreeSignature(tempItem, sourceItem);
        const incomingSig = JSON.stringify(incomingTree);

        for (const existingItem of this.actor.items) {
            if (
                existingItem.type !== itemData.type ||
                existingItem.system?.XMLID !== itemData.system?.XMLID ||
                existingItem.system?.PARENTID
            ) {
                continue;
            }

            const existingTree = await getDocumentTreeSignature(existingItem);
            const existingSig = JSON.stringify(existingTree);

            if (existingSig === incomingSig) {
                return existingItem;
            } else {
                console.groupCollapsed(
                    `[Stacking Diff Check] Mismatch found between incoming "${itemData.name}" and existing "${existingItem.name}"`,
                );
                console.log("Full Incoming Signature:", incomingTree);
                console.log("Full Existing Signature:", existingTree);
                console.log("Incoming Children:", incomingTree.children);
                console.log("Existing Children:", existingTree.children);
                console.groupEnd();
            }
        }

        return null;
    }

    /**
     * Asynchronously prepares, sanitizes, and normalizes an array of item data for insertion onto the actor.
     * Handles ID generation, parent-child ID linkage for containers/compound powers, ruleset validation,
     * compendium default resets, and checks for stackable equipment/containers via QUANTITY using recursive tree matching.
     *
     * @param {Item[]|Object[]} itemsToProcess - Array of source items or raw item data objects being dropped.
     * @param {Object} [options={}] - Configuration options for the drop operation.
     * @param {string} [options.targetType] - The UI tab or target type the item is being dropped onto (e.g., "equipment").
     * @param {boolean} [options.isCompendiumDrop] - True if the item originates from a compendium pack.
     * @returns {Promise<Object[]>} Resolves to a fully prepared array of item data ready for embedded creation.
     *                              The returned array includes a `stackedInfo` property containing stacking metadata.
     */
    async _prepareDroppedItemData(itemsToProcess, options = {}) {
        const itemsToCreate = [];
        const idMapping = new Map();
        const stackedItemsInfo = [];
        const skippedParentIds = new Set();

        const droppedIds = new Set(itemsToProcess.map((i) => i.system?.ID).filter(Boolean));

        for (const sourceItem of itemsToProcess) {
            if (sourceItem.system?.PARENTID && skippedParentIds.has(sourceItem.system.PARENTID)) {
                continue;
            }

            console.log(
                "Entering _prepareDroppedItemData::itemsToProcess for:",
                sourceItem.name,
                sourceItem.system?.XMLID,
            );
            const itemData = foundry.utils.deepClone(sourceItem);

            delete itemData._id;
            delete itemData.ownership;
            delete itemData.flags;
            delete itemData.folder;

            if (itemData.system?.PARENTID && !droppedIds.has(itemData.system.PARENTID)) {
                delete itemData.system.PARENTID;
            }

            const oldSystemId = itemData.system?.ID;
            const newId = new Date().getTime() + itemsToCreate.length;

            if (oldSystemId) {
                idMapping.set(oldSystemId, newId);
            }
            itemData.system.ID = newId;

            if (itemData.system.active) itemData.system.active = false;
            if (itemData.effects) itemData.effects = [];

            if (options.targetType) {
                itemData.type = options.targetType;
            }

            // PERFORMANCE OPTIMIZATION: Only call getPowerInfo if xmlTag is missing
            if (!itemData.system.xmlTag) {
                const baseInfoCheck = getPowerInfo({
                    xmlid: itemData.system.XMLID,
                    is5e: this.actor.is5e,
                    xmlTag: itemData.system.xmlTag,
                });
                if (!baseInfoCheck) {
                    throw new Error(
                        `${itemData.system.XMLID} is not valid for ${this.actor.is5e ? "5e" : "6e"}. "${itemData.name}" was not transferred.`,
                    );
                }
                itemData.system.xmlTag = baseInfoCheck.xmlTag;
            }

            if (options.isCompendiumDrop) {
                const resetUpdates = HeroSystem6eItem._prepareOriginalResetData(itemData);
                for (const [key, value] of Object.entries(resetUpdates)) {
                    foundry.utils.setProperty(itemData, key, value);
                }
            }

            const isTopLevel = !itemData.system.PARENTID;
            const targetType = options.targetType || itemData.type;
            const isEquipmentTab = targetType === "equipment";
            const containerXmlids = ["COMPOUNDPOWER", "VPP", "MULTIPOWER", "MP"];
            const isStackableType =
                itemData.type === "equipment" || containerXmlids.includes(itemData.system?.XMLID?.toUpperCase());

            if (isStackableType && isTopLevel && isEquipmentTab) {
                const existingItem = await this._findExistingMatchingItem(
                    itemData,
                    sourceItem,
                    options,
                    itemsToProcess,
                );

                if (existingItem) {
                    const currentQty = existingItem.system.QUANTITY ?? 1;
                    const dropQty = itemData.system.QUANTITY ?? 1;
                    const newQty = currentQty + dropQty;

                    await existingItem.update({ "system.QUANTITY": newQty });

                    stackedItemsInfo.push({
                        name: itemData.name,
                        oldQty: currentQty,
                        dropQty: dropQty,
                        newQty: newQty,
                    });

                    if (oldSystemId) {
                        skippedParentIds.add(oldSystemId);
                    }

                    continue;
                }
            }

            itemsToCreate.push(itemData);
        }

        for (const itemData of itemsToCreate) {
            if (itemData.system.PARENTID) {
                if (idMapping.has(itemData.system.PARENTID)) {
                    itemData.system.PARENTID = idMapping.get(itemData.system.PARENTID);
                } else {
                    delete itemData.system.PARENTID;
                }
            }
        }

        itemsToCreate.stackedInfo = stackedItemsInfo;
        return itemsToCreate;
    }

    /**
     * Callback actions which occur when a dragged element is dropped on a target.
     * @param {DragEvent} event       The originating DragEvent
     * @protected
     */
    async _onDrop(event) {
        event.stopPropagation();
        event.preventDefault();

        const target = event.currentTarget.closest("nav a");
        if (target) target.classList.remove("drag-hover");

        const data = foundry.applications.ux.TextEditor.getDragEventData(event);
        switch (data?.type) {
            case "Item":
                await this._onDropItem(event, data);
                break;

            case "Folder":
                await this.onDropFolder(await fromUuid(data.uuid), null);
                break;

            default:
                console.warn(`Unhandled _onDrop type=${data?.type}`);
                break;
        }
    }

    async onDropFolder(folder) {
        console.log("Entering onDropFolder for:", folder.name);
        let itemsToDrop = folder.contents;
        const pack = game.packs.get(folder.pack);

        const target = event.target ?? event.currentTarget;
        const droppedOnTab = target?.closest?.("[data-tab]")?.dataset?.tab.replace(/(?<!analysi)s$/, "");
        const targetType = droppedOnTab ?? this.tabGroups.primary.replace(/s$/, "").replace("martial", "martialart");

        if (folder.pack || !itemsToDrop?.[0].id) {
            function getFolderIds(f) {
                let ids = [f.id];
                const subfolders = pack.folders.filter((sub) => sub.folder?.id === f.id);
                for (const sub of subfolders) {
                    ids = ids.concat(getFolderIds(sub));
                }
                return ids;
            }
            const allFolderIds = getFolderIds(folder);
            itemsToDrop = await pack.getDocuments({ folder__in: allFolderIds });
        }

        let topItems = itemsToDrop.filter((i) => !i.system.PARENTID);

        if (!topItems.length) {
            const matchingContainer = itemsToDrop.find(
                (i) => i.name === folder.name && HeroSystem6eCompendium.HERO_CONTAINER_XMLIDS.includes(i.system?.XMLID),
            );
            if (matchingContainer) topItems = [matchingContainer];
        }

        if (!topItems.length) {
            throw new Error("Expecting at least one item");
        }

        const rawItemsData = itemsToDrop.map((i) => i.toObject());

        try {
            const itemsToCreate = await this._prepareDroppedItemData(rawItemsData, {
                targetType,
                isCompendiumDrop: Boolean(folder.pack),
            });

            const chatData = {
                author: game.user._id,
                style: CONST.CHAT_MESSAGE_STYLES.OTHER,
                content: `These <b>${targetType}</b> items were added to <b>${this.actor.name}</b> from the ${topItems[0].uuid.startsWith("Item.") ? "<b>Item Sidebar</b>" : `<b>${pack.metadata.label ?? pack.metadata.name}</b> compendium`}: <ul>${topItems.map((item) => `<li>${item.name}</li>`).join("")}</ul>`,
                whisper: whisperUserTargetsForActor(this.actor),
                speaker: ChatMessage.getSpeaker({ actor: this.actor, token: this.token }),
            };
            ChatMessage.create(chatData);

            await this.actor.createEmbeddedDocuments("Item", itemsToCreate);
        } catch (error) {
            console.error(error);
            ui.notifications.error(error.message);
        }
    }

    async _onDropItem(event, data) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (!this.actor.isOwner) {
            console.warn(`not owner`);
            return false;
        }

        const item = await fromUuid(data.uuid);
        if (!item) {
            console.error(`Missing item`);
            return;
        }
        console.log("Entering _onDropItem for:", item.name, item.type);

        // Dropping directly onto a specific tab
        const target = event.currentTarget ?? event.target;
        const targetTab = target?.closest("[data-tab]")?.dataset?.tab;
        if (targetTab) {
            return this._onDropItemOnTab(event, data, item, targetTab);
        }

        // Intra-actor dropping (containers / reordering)
        const sameActor = item.actor?.id === this.actor.id;
        if (sameActor) {
            const dropTarget = event.target.closest("[data-document-uuid]");
            if (!item.isContainer || item.system.XMLID === "COMPOUNDPOWER") {
                const dropTargetItem = await fromUuid(dropTarget?.dataset.documentUuid);
                if (!item.system.PARENTID && dropTargetItem?.isContainer) {
                    ui.notifications.info(`<b>${item.name}</b> was moved into parent <b>${dropTargetItem.name}</b>`);
                    await item.update({ "system.PARENTID": dropTargetItem.system.ID });
                } else if (item.system.PARENTID && !dropTargetItem?.system.PARENTID) {
                    ui.notifications.info(
                        `<b>${item.name}</b> was removed from parent <b>${item.parentItem?.name}</b>.`,
                    );
                    await item.update({ "system.PARENTID": new foundry.data.operators.ForcedDeletion() });
                } else if (!item.isContainer && dropTargetItem?.isContainer) {
                    ui.notifications.info(`<b>${item.name}</b> was moved into parent <b>${dropTargetItem.name}</b>`);
                    await item.update({ "system.PARENTID": dropTargetItem.system.ID });
                } else if (
                    dropTargetItem?.parentItem &&
                    !item.parentItem &&
                    item.childItems?.length === 0 &&
                    dropTargetItem.childItems?.length === 0
                ) {
                    ui.notifications.info(
                        `<b>${item.name}</b> was moved into parent <b>${dropTargetItem.parentItem.name}</b>`,
                    );
                    await item.update({ "system.PARENTID": dropTargetItem.parentItem.system.ID });
                }
            }
            return super._onDropItem(event, item);
        }

        // General sheet drop validations
        if (item.isCombatManeuver) {
            ui.notifications.error(`You cannot drop a MANEUVER onto an actor.`);
            return;
        }

        const baseInfoCheck = getPowerInfo({
            xmlid: item.system.XMLID,
            is5e: this.actor.is5e,
            xmlTag: item.system.xmlTag,
        });
        if (!baseInfoCheck) {
            ui.notifications.error(
                `${item.system.XMLID} is a ${item.is5e ? "5e" : "6e"} only item and cannot be dropped onto a ${this.actor.is5e ? "5e" : "6e"} actor.`,
            );
            return;
        }

        await this.DropItemFramework(item, {});
    }

    async _onDropItemOnTab(event, data, item, targetTab) {
        console.log("Entering _onDropItemOnTab for:", item.name, item.type);
        event.preventDefault();
        event.stopImmediatePropagation();

        if (!item) {
            console.error(`Missing item`);
            return;
        }

        const targetType = targetTab.replace(/s$/, "").replace("martial", "martialart");
        if (!item.isValidTypeConversion(targetType, this.actor)) {
            const conversionFailures = item.validationTypeConversionFailures(targetType, this.actor);
            console.error(conversionFailures);
            return ui.notifications.error(conversionFailures[0].message);
        }

        const sameActor = item.actor?.id === this.actor.id;
        if (!sameActor) {
            const baseInfoCheck = getPowerInfo({
                xmlid: item.system.XMLID,
                is5e: this.actor.is5e,
                xmlTag: item.system.xmlTag,
            });
            if (!baseInfoCheck) {
                ui.notifications.error(
                    `${item.system.XMLID} is a ${item.is5e ? "5e" : "6e"} only item and cannot be dropped onto a ${this.actor.is5e ? "5e" : "6e"} actor.`,
                );
                return;
            }
            return this.DropItemFramework(item, { type: targetType });
        }

        if (!item.actor) {
            console.error(`${item.name} is missing parent actor`);
            return;
        }

        try {
            await item.update({ "system.PARENTID": new foundry.data.operators.ForcedDeletion() }, { render: false });
            await item.convertToType(targetType);
        } catch (error) {
            console.error(error);
            ui.notifications.error(
                `${item.detailedName()} for ${this.actor.name} failed to be converted to type ${targetType}`,
            );
        }
    }

    /**
     * Main framework entry point for dropping, converting, validating, and logging dropped items.
     * Centralizes whisper targets, actor lookups, and single-source chat message dispatching.
     *
     * @param {Item} item         - The item being dropped.
     * @param {Object} options    - Configuration options for the drop (e.g., target type, parent ID).
     * @returns {Promise<void>}
     */
    async DropItemFramework(item, options) {
        console.log("Entering DropItemFramework for:", item.name, item.type);
        const itemData = item.toObject();
        itemData.system.ID = new Date().getTime();

        const targetType = options.type ?? this.tabGroups.primary.replace(/s$/, "").replace("martial", "martialart");
        if (item.isValidTypeConversion(targetType, this.actor)) {
            itemData.type = targetType;
        } else {
            const conversionFailures = item.validationTypeConversionFailures(targetType, this.actor);
            console.error(conversionFailures);
            return ui.notifications.error(conversionFailures[0].message);
        }

        const baseInfoCheck = getPowerInfo({
            xmlid: itemData.system.XMLID,
            is5e: this.actor.is5e,
            xmlTag: itemData.system.xmlTag,
        });
        itemData.system.xmlTag ??= baseInfoCheck?.xmlTag;

        delete itemData.system.PARENTID;
        if (options.PARENTID) {
            itemData.system.PARENTID = options.PARENTID;
        }
        delete itemData.system.childIdx;

        if (this.actor.uuid === item.parent?.uuid) return this._onSortItem(event, itemData);

        if (itemData.system.is5e !== undefined && itemData.system.is5e !== this.actor.is5e) {
            ui.notifications.warn(
                `${itemData.name} is a ${itemData.system.is5e ? "5e" : "6e"} item. ${this.actor.name} is a ${this.actor.system.is5e ? "5e" : "6e"} actor. Mixing 5e/6e may have unpredictable results.`,
            );
        }

        // --- EQUIPMENT INFO ---
        if (itemData.type !== "equipment") {
            const existingItem = this._findExistingMatchingItem(itemData, item);
            if (existingItem) {
                ui.notifications.info(
                    `${itemData.name} was added as a duplicate item. If you want to track QUANTITY, items must be placed on the equipment tab.`,
                );
            }
        }

        if (options.isCompendiumDrop) {
            const resetUpdates = HeroSystem6eItem._prepareOriginalResetData(itemData);
            for (const [key, value] of Object.entries(resetUpdates)) {
                foundry.utils.setProperty(itemData, key, value);
            }
        }

        // Process item creation or quantity stacking via helper
        const dropResult = await this._onDropItemCreate(itemData, item);
        const stackedInfo = dropResult?.stackedInfo;

        const actor = this.actor;
        const token = actor.token;
        const dropName = token?.name || actor.getActiveTokens()?.[0]?.name || actor.name;

        const dragName = (() => {
            if (item.pack) {
                const pack = game.packs.get(item.pack);
                return pack?.metadata?.label ?? item.pack;
            }
            return (
                item.actor?.token?.name ||
                item.actor?.getActiveTokens()?.[0]?.name ||
                item.actor?.name ||
                (item.uuid.startsWith("Item.") ? "ItemSidebar" : "Compendium")
            );
        })();

        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            whisper: [...whisperUserTargetsForActor(this.actor), ...whisperUserTargetsForActor(item.actor)],
            speaker: ChatMessage.getSpeaker({ actor: this.actor, token: this.token }),
        };
        chatData.whisper = Array.from(new Map(chatData.whisper.map((user) => [user.id, user])).values());

        const targetTab = itemData.type;

        // Construct the single, appropriate chat message based on drop behavior
        if (stackedInfo) {
            chatData.content =
                `<b>${stackedInfo.name}</b> was copied from <b>${dragName}</b>${item.pack ? " compendium" : ""}.<br>` +
                `Its QUANTITY was increased by <b>${stackedInfo.dropQty}</b> ` +
                `(from ${stackedInfo.oldQty} to ${stackedInfo.newQty}) ` +
                `on the <b>${targetTab}</b> tab of <b>${dropName}</b>.`;
            ChatMessage.create(chatData);
        } else if (item.type === "equipment" && item.actor) {
            item.delete();
            chatData.content = `<b>${item.name}</b> was transferred from <b>${dragName}</b> to the <b>${targetTab}</b> tab of <b>${dropName}</b>.`;
            ChatMessage.create(chatData);
        } else {
            chatData.content = `<b>${item.name}</b> was copied from <b>${dragName}</b>${item.pack ? " compendium" : ""} to the <b>${targetTab}</b> tab of <b>${dropName}</b>.`;
            ChatMessage.create(chatData);
        }

        // Only drop/create child items if a new parent was actually created.
        // If stackedInfo is present, the parent already existed and incremented its quantity,
        // so its existing children shouldn't be duplicated!
        if (!stackedInfo) {
            for (const child of item.pack ? await item.childItemsFromPack() : item.childItems) {
                await this.DropItemFramework(child, {
                    PARENTID: itemData.system.ID,
                    type: itemData.type,
                    isCompendiumDrop: Boolean(item.pack),
                });
            }
        }
    }

    /**
     * Handles the creation or quantity-stacking of dropped items on the actor.
     * If an identical equipment item exists, its quantity is increased rather than creating a duplicate.
     *
     * @param {Object} itemData - The sanitized and prepared item data object to create.
     * @returns {Promise<Object>} An object containing the created document(s) and any stacking metadata.
     * @protected
     */
    async _onDropItemCreate(itemData, sourceItem) {
        console.log("Entering _onDropItemCreate for:", itemData.name, itemData.type);
        const isTopLevel = !itemData.system.PARENTID;
        const targetType = itemData.type;

        // Await the helper since it now handles asynchronous compendium pack child fetching
        const existingItem = await this._findExistingMatchingItem(itemData, targetType, sourceItem);

        if (existingItem && isTopLevel && targetType === "equipment") {
            const currentQty = existingItem.system.QUANTITY ?? 1;
            const dropQty = itemData.system.QUANTITY ?? 1;
            const newQty = currentQty + dropQty;

            await existingItem.update({ "system.QUANTITY": newQty });

            return {
                items: [],
                stackedInfo: {
                    name: itemData.name,
                    oldQty: currentQty,
                    dropQty: dropQty,
                    newQty: newQty,
                },
            };
        }

        const newItems = await this.actor.createEmbeddedDocuments("Item", [itemData]);
        return { items: newItems, stackedInfo: null };
    }

    async _uploadCharacterSheet(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = async function (event) {
            const contents = event.target.result;

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(contents, "text/xml");
            await this.actor.uploadFromXml(xmlDoc, { file });
        }.bind(this);
        reader.readAsText(file);
    }

    static SEARCH_DELAY = 200;

    #debouncedSearch = foundry.utils.debounce(this.#onSearch.bind(this), this.constructor.SEARCH_DELAY);

    searchValues = [];

    #onSearch(ev) {
        // If we are uploading don't bother with search as it slows things
        // down and generates unhelpful errors
        if (this.actor.getFlag(game.system.id, "uploading")) return;

        const filter = ev.target.value;
        const regex = new RegExp(RegExp.escape(filter), "i");

        // Effects tab, which has multiple item-list elements
        const itemLists = ev.target.closest(".tab")?.querySelectorAll(".item-list");
        if (itemLists.length === 0) {
            console.error(`unable to find itemList`);
            return;
        }
        for (const itemList of itemLists) {
            const applicationPart = itemList.closest("[data-application-part]")?.dataset.applicationPart;
            if (applicationPart) {
                this.searchValues[applicationPart] = filter;
            } else {
                console.error(`unable to find applicationPart`);
            }

            for (const li of itemList.children) {
                const item = this._getEmbeddedDocument(li);
                if (!item) {
                    console.error(`onSearch: Unable to locate item`);
                    continue;
                }

                try {
                    if (item.documentName === "Item") {
                        if (
                            item.name.match(regex) ||
                            item.system.XMLID.match(regex) ||
                            item.system.description.match(regex) ||
                            item.parentItem?.system.description.match(regex)
                        ) {
                            li.classList.remove("hidden");
                        } else {
                            li.classList.add("hidden");
                        }
                    } else if (item.documentName === "ActiveEffect") {
                        const activeEffect = item; // makes code a bit easier to read.
                        if (activeEffect.nameExtended.match(regex) || activeEffect.XMLID?.match(regex)) {
                            li.classList.remove("hidden");
                        } else {
                            li.classList.add("hidden");
                        }
                    } else {
                        console.error(`Unknown documentName=${item.documentName}`);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
    }

    _getDocumentListContextOptions() {
        // name is auto-localized
        return [
            {
                name: "Edit",
                icon: '<i class="fa-solid fa-fw fa-edit"></i>',
                //condition: () => this.actor.isOwner,
                callback: async (target) => {
                    const document = this._getEmbeddedDocument(target);
                    await document.sheet.render({ force: true });
                },
            },
            {
                name: "Display in chat",
                icon: '<i class="fa-solid fa-fw fa-share-from-square"></i>',
                condition: (target) => {
                    const document = this._getEmbeddedDocument(target);
                    return !!document.system.description;
                },
                callback: async (target) => {
                    const document = this._getEmbeddedDocument(target);
                    await document.chat();
                    // await DrawSteelChatMessage.create({
                    //     content: `@Embed[${document.uuid} caption=false]`,
                    //     speaker: DrawSteelChatMessage.getSpeaker({ actor: this.actor }),
                    //     title: document.name,
                    //     flags: {
                    //         core: { canPopout: true },
                    //     },
                    // });
                },
            },
            {
                name: "Delete",
                icon: '<i class="fa-solid fa-fw fa-trash"></i>',
                condition: (target) => {
                    const document = this._getEmbeddedDocument(target);
                    return this.actor.isOwner && !document.isFreeStuff;
                },
                callback: async (target) => {
                    const document = this._getEmbeddedDocument(target);
                    await document.deleteDialog({
                        classes: Array.from(this.classList).filter(
                            (c) => c.includes("herosystem") || c.includes("theme"),
                        ),
                    });
                },
            },

            // {
            //     name: "Roll (all in one; alpha test)",
            //     icon: '<i class="fa-solid fa-fw fa-dice"></i>',
            //     condition: () => this.actor.isOwner,
            //     callback: async (target) => {
            //         const document = this._getEmbeddedDocument(target);
            //         await document.roll({ event: this.event, token: this.token, allInOne: true });
            //     },
            // },
        ];
    }

    _getEmbeddedDocument(target) {
        const documentUuid = target.closest("[data-document-uuid]").dataset.documentUuid;

        // fromUuidSync doesn't allow  retrieving embedded compendium documents, so manually retrieving each child document from the base document.
        const { collection, embedded, documentId } = foundry.utils.parseUuid(documentUuid);
        let document = collection.get(documentId);
        while (document && embedded.length > 1) {
            const [embeddedName, embeddedId] = embedded.splice(0, 2);
            document = document.getEmbeddedDocument(embeddedName, embeddedId);
        }

        return document;
    }

    static async #onCarried(event, target) {
        event.preventDefault();
        const item = this._getEmbeddedDocument(target);
        if (!item) {
            console.error("onCarried: Unable to locate item");
        }
        await item.update({ "system.CARRIED": !item.system.CARRIED });
    }

    static async #onClear(event, target) {
        const inputSearch = target.closest("div.search").querySelector("input");
        if (inputSearch) {
            inputSearch.value = "";
            const itemList = target.closest(".tab.active").querySelector(".item-list");
            const applicationPart = itemList?.closest("[data-application-part]")?.dataset.applicationPart;
            if (applicationPart) {
                this.searchValues[applicationPart] = null;
            } else {
                console.error(`unable to find applicationPart`);
            }
            for (const li of itemList.children) {
                li.classList.remove("hidden");
            }
        }
    }

    static async #onClips(event, target) {
        const item = this._getEmbeddedDocument(target);
        if (!item) {
            console.error("onClips: Unable to locate item");
        }
        await item.changeClips({ event: this.event, token: this.token });
    }

    static async #onRoll(event, target) {
        const item = this._getEmbeddedDocument(target);
        if (!item) {
            console.error("onRoll: Unable to locate item");
        }
        await item.roll({ event: this.event, token: this.token });
    }

    static async #onRollCharacteristicSuccess(event, target) {
        const label = target.closest("[data-label]").dataset.label;
        await this.actor.onCharacteristicSuccessRoll({ event, label, token: this.token });
    }

    static async #onCharacteristicFullRoll(event, target) {
        const label = target.closest("[data-label]").dataset.label;
        await this.actor.onCharacteristicFullRoll({ event, label, token: this.token });
    }

    static async #onCharacteristicCasualRoll(event, target) {
        const label = target.closest("[data-label]").dataset.label;
        await this.actor.onCharacteristicCasualRoll({ event, label, token: this.token });
    }

    static async #onActorToggle(event, target) {
        event.preventDefault();
        const attribute = target.name;
        const value = foundry.utils.getProperty(this.actor, attribute);
        if (value === undefined) {
            console.error(`Unhandled actor.${attribute}`);
            return;
        }
        await this.actor.update({ [`${attribute}`]: !value });
    }

    static async #onToggle(event, target) {
        event.preventDefault();
        const item = this._getEmbeddedDocument(target);
        if (!item) {
            console.error("onToggle: Unable to locate item");
        }
        await item.toggle({ event: this.event, token: this.token });
    }

    chevronCollapsedStatus = {};
    async setChevronStatus(target) {
        // Loop thru all the item chevrons and expand/collapse their children
        for (const [key, value] of Object.entries(this.chevronCollapsedStatus)) {
            const item = fromUuidSync(key);
            if (!item) {
                console.error("unable to find item");
                continue;
            }

            const formElement = target.closest("form");
            const parentElement = formElement.querySelector(`li[data-document-uuid="${item.uuid}"]`);
            if (!parentElement) {
                console.error("unable to find parentEl");
                continue;
            }
            if (value) {
                parentElement.classList.add("collapsed");
            } else {
                parentElement.classList.remove("collapsed");
            }

            const listElement = parentElement.closest("ol.item-list");
            if (!listElement) {
                console.error("unable to find itemList");
                continue;
            }

            for (const child of item.childItems) {
                const childElement = listElement.querySelector(`li[data-document-uuid="${child.uuid}"]`);
                if (!childElement) {
                    console.error("unable to find item child element");
                    continue;
                }
                if (value) {
                    childElement.classList.add("collapsed-child");
                } else {
                    childElement.classList.remove("collapsed-child");
                }
            }
        }
    }

    static async #onToggleChevron(event, target) {
        const item = this._getEmbeddedDocument(target);
        if (!item) {
            console.error("onToggleChevron: Unable to locate item");
        }
        this.chevronCollapsedStatus[item.uuid] = !this.chevronCollapsedStatus[item.uuid];
        await this.setChevronStatus(target);
        //target.closest("li").classList.toggle("collapsed");
    }

    static async #onToggleEffect(event, target) {
        event.preventDefault();
        const effect = this._getEmbeddedDocument(target);
        if (!effect) {
            console.error("onToggleEffect: Unable to locate effect");
        }
        await effect.update({ disabled: !effect.disabled });
    }

    static async #onVpp(event, target) {
        const item = this._getEmbeddedDocument(target);
        if (!item) {
            console.error("onVpp: Unable to locate item");
        }
        await item.changeVpp({ event: this.event, token: this.token });
    }

    static async #onToggleItemContainer(event, target) {
        const item = this._getEmbeddedDocument(target);
        if (!item) {
            console.error("onToggleItemContainer: Unable to locate item");
        }
        target.closest("li").classList.toggle("collapsed");
    }

    static async #onToggleStatus(event, target) {
        const status = target.dataset.statusId;
        await this.actor.toggleStatusEffect(status);
    }

    /**
     * Handle changing a Document's image.
     * @param {MouseEvent} event  The click event.
     * @returns {Promise<FilePicker>}
     * @protected
     */
    static async #onUpdateActorImage(event, target) {
        const attr = target.dataset.edit;
        const current = foundry.utils.getProperty(this.object, attr);
        const { img } = this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ?? {};
        const fp = new FilePicker.implementation({
            current,
            type: "image",
            redirectToRoot: img ? [img] : [],
            callback: async (path) => {
                await this.document.update({ img: path });
            },
            top: this.position.top + 40,
            left: this.position.left + 10,
        });
        return fp.browse();
    }

    static async #onUpdateTokenImage(event, target) {
        if (window.Tokenizer) {
            if (this.document.isToken) return window.Tokenizer.tokenizeSceneToken(this);
            else return window.Tokenizer.tokenizeActor(this.actor);
        }

        const attr = target.dataset.edit;
        const current = foundry.utils.getProperty(this.object, attr);
        const { img } = this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ?? {};
        const fp = new FilePicker.implementation({
            current,
            type: "image",
            redirectToRoot: img ? [img] : [],
            callback: async (path) => {
                target.src = path;
                if (this.token) {
                    await (this.token.document || this.token).update({ ["texture.src"]: path });
                }
                if (!this.document.isToken) {
                    await this.document.update({ ["prototypeToken.texture.src"]: path });
                }
            },
            top: this.position.top + 40,
            left: this.position.left + 10,
        });
        return fp.browse();
    }

    portraitToggleState = "portrait";

    static async #onTogglePortrait /*event, target*/() {
        const stateEnum = ["portrait", "token"];

        if (!this.portraitToggleState || !stateEnum.includes(this.portraitToggleState)) {
            this.portraitToggleState = stateEnum[0];
            return;
        }

        const currentIdx = stateEnum.indexOf(this.portraitToggleState);
        const nextIdx = (currentIdx + 1) % stateEnum.length;

        this.portraitToggleState = stateEnum[nextIdx];
        await this.render({ parts: ["aside"] });
    }

    #heroValidationCssForTab(items) {
        if (!items || items.length === 0) {
            return "";
        }

        // Expecting an Array
        if (items.constructor.name !== "Array") {
            return "";
        }

        // Are these Effects
        if (items[0].documentName === "ActiveEffect") {
            const severityMax = Math.max(
                0,
                ...items
                    .reduce((accumulator, currentArray) => {
                        return accumulator.concat(currentArray.heroValidation);
                    }, [])
                    .map((m) => m.severity ?? 0),
            );
            if (severityMax > 0) {
                function getKeyByValue(object, value) {
                    return Object.keys(object).find((key) => object[key] === value);
                }
                return `validation validation-${getKeyByValue(CONFIG.HERO.VALIDATION_SEVERITY, severityMax).toLocaleLowerCase()}`;
            }
            return "";
        }

        // Make sure these are Items
        if (items[0].documentName !== "Item") {
            return "";
        }

        // Need to be careful here as a SKILL in a COMPOUNDPOWER as a piece of EQUIPMENT
        // doesn't show in SKILL tab
        try {
            function getKeyByValue(object, value) {
                return Object.keys(object).find((key) => object[key] === value);
            }

            let itemsWithChildren = items;
            for (const item of items) {
                itemsWithChildren = [...itemsWithChildren, ...item.childItems];
                for (const item2 of item.childItems) {
                    itemsWithChildren = [...itemsWithChildren, ...item2.childItems];
                    for (const item3 of item2.childItems) {
                        itemsWithChildren = [...itemsWithChildren, ...item3.childItems];
                    }
                }
            }

            const validationsOfType = itemsWithChildren.reduce((accumulator, currentArray) => {
                return accumulator.concat(currentArray.heroValidation);
            }, []);

            if (!validationsOfType) {
                return "";
            }

            const severityMax = Math.max(0, ...validationsOfType.map((m) => m.severity ?? 0));

            if (severityMax > 0) {
                return `validation validation-${getKeyByValue(CONFIG.HERO.VALIDATION_SEVERITY, severityMax).toLocaleLowerCase()}`;
            }
        } catch (e) {
            console.error(e);
        }

        return "";
    }

    async _prepareStatusEffects() {
        /** @type {Record<string, StatusInfo>} */
        const statusInfo = {};
        for (const status of CONFIG.statusEffects) {
            // Only display if it would show in the token HUD *and* it has an assigned _id
            //if (!status._id || !ActiveEffect.implementation.validHud(status, this.actor)) continue;
            statusInfo[status.id] = {
                _id: status._id,
                name: status.name,
                img: status.img,
                disabled: false,
                active: "",
            };

            if (status.rule) {
                const page = await fromUuid(status.rule);
                statusInfo[status.id].tooltip = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
                    page.text.content,
                    { relativeTo: this.actor },
                );
            }
        }

        // If the actor has the status and it's not from the canonical statusEffect
        // Then we want to force more individual control rather than allow toggleStatusEffect
        const allApplicableEffects = Array.from(this.actor.allApplicableEffects());
        for (const effect of allApplicableEffects) {
            if (!effect.active) continue;
            for (const id of effect.statuses) {
                if (!(id in statusInfo)) continue;
                statusInfo[id].active = "active";
                if (!Object.values(statusInfo).some((s) => s._id === effect._id)) statusInfo[id].disabled = true;
            }
        }

        return statusInfo;
    }

    async _prepareAnalysis() {
        const analysis = {};
        // Active Point Summary
        analysis.activePointSummary = [];
        for (const powerInfo of getCharacteristicInfoArrayForActor(this.actor)) {
            const char = this.actor.system.characteristics[powerInfo.key.toLowerCase()];
            if (!char) {
                console.error(`${powerInfo.key} not found in actor.system.characteristics`);
                continue;
            }
            let valueTop = Math.max(char.value, char.max);
            let activePoints = valueTop * (powerInfo?.cost || 0);
            if (activePoints > 0) {
                analysis.activePointSummary.push({
                    name: powerInfo.name,
                    activePoints: activePoints,
                });
            }
        }

        for (const item of this.actor.items.filter((o) => !o.isCombatManeuver)) {
            if (!item.baseInfo) {
                // Don't bother warning about super old items
                if (item.system.XMLID) {
                    console.warn(`${item?.system?.XMLID} (${item?.name}) has no powerInfo`);
                }
                continue;
            }

            const activePoints = item.activePoints;
            if (activePoints > 0) {
                let name = item.name;
                if (item.name.toUpperCase().indexOf(item.system.XMLID) == -1) {
                    name += ` (${item.system.XMLID})`;
                }

                if (!item.system.XMLID.startsWith("__")) {
                    analysis.activePointSummary.push({
                        name: name,
                        activePoints: activePoints,
                    });
                }
            }
        }

        analysis.activePointSummary.sort((a, b) => b.activePoints - a.activePoints);
        let topActivePoints = analysis.activePointSummary?.[0]?.activePoints;
        analysis.activePointSummary = analysis.activePointSummary.filter(
            (o) => o.activePoints >= topActivePoints * 0.5,
        );

        return analysis;
    }

    //#dragDrop = this.#createDragDropHandlers();

    /**
     * Create drag-and-drop workflow handlers for this Application.
     * @returns {DragDrop[]}     An array of DragDrop handlers.
     * @private
     */
    // #createDragDropHandlers() {
    //     return this.options.dragDrop.map((d) => {
    //         d.permissions = {
    //             dragstart: this._canDragStart.bind(this),
    //             drop: this._canDragDrop.bind(this),
    //         };
    //         d.callbacks = {
    //             dragstart: this._onDragStart.bind(this),
    //             dragover: this._onDragOver.bind(this),
    //             drop: this._onDrop.bind(this),
    //         };
    //         return new DragDrop.implementation(d);
    //     });
    // }

    // Optional: Add getter to access the private property

    /**
     * Returns an array of DragDrop instances
     * @type {DragDrop[]}
     */
    // get dragDrop() {
    //     return this.#dragDrop;
    // }

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
}
