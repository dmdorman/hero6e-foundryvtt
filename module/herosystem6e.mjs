import { HeroSystem6eTemplateLayer } from "./canvas-layer.mjs";
import * as chat from "./chat.mjs";
import "./chat/delayed-attack-cards.mjs";
import { HeroSystem6eCombat } from "./combat.mjs";
import { HeroSystem6eCombatTracker } from "./combatTracker.mjs";
import { HeroSystem6eCombatant } from "./combatant.mjs";

import { HeroSystem6eCombatSingle, migrateCombatsToSingleCombatantTracker } from "./combat-single.mjs";
import { HeroSystem6eCombatTrackerSingle } from "./combatTracker-single.mjs";
import { HeroSystem6eCombatantSingle } from "./combatant-single.mjs";

import { HeroSystem6eCompendium } from "./compendium/compendium.mjs";
import { HeroSystem6eCompendiumDirectory } from "./compendium/compendiumDirectory.mjs";
import { HERO } from "./config.mjs";
import { EffectsPanel } from "./effects-panel.mjs";
import { initializeHandlebarsHelpers } from "./handlebars-helpers.mjs";
import { HeroSystem6eChatMessage } from "./heroChatMessage.mjs";
import { CreateHeroCompendiums } from "./heroCompendiums.mjs";
import { HeroSocketHandler } from "./heroSocketHandler.mjs";
import { HeroTokenRuler } from "./heroTokenRuler.mjs";
import { HeroPointVisionSource, setPerceptionModes } from "./herovision/vision.mjs";
import { initializeHeroVisionV14 } from "./herovision/hero-vision-14.mjs";

import { HeroSystem6eItemDirectory } from "./itemDirectory.mjs";
import HeroSystem6eMeasuredTemplate from "./measuretemplate.mjs";
import { migrateWorld } from "./migration.mjs";

import { HeroSystemActiveEffectConfig } from "./actor/active-effect-config.mjs";
import {
    HeroSystem6eActorActiveEffects,
    HeroSystem6eActorActiveEffectsSystemData,
} from "./actor/actor-active-effects.mjs";
import { HeroSystem6eActor } from "./actor/actor.mjs";
import { HeroSystemActorSheetV2 } from "./applications/actor/actor-sheet-v2.mjs";

import { GenericRoller } from "./heroRoller/genericRoller.mjs";

import { ItemVppConfig } from "./applications/apps/item-vpp-config.mjs";
import { HeroSystemItemSheetV2 } from "./applications/item/item-sheet-v2.mjs";
import { HeroSystem6eRegionDocument } from "./heroRegion.mjs";

import {
    HeroActorModel,
    HeroItemCharacteristic,
    HeroSystem6eItemDisadvantage,
    HeroSystem6eItemEquipment,
    HeroSystem6eItemManeuver,
    HeroSystem6eItemMartialArt,
    HeroSystem6eItemPerk,
    HeroSystem6eItemPower,
    HeroSystem6eItemSkill,
    HeroSystem6eItemTalent,
} from "./item/HeroSystem6eTypeDataModels.mjs";
import { HeroSystem6eItem, initializeItemHandlebarsHelpers } from "./item/item.mjs";

import SettingsHelpers from "./settings/settings-helpers.mjs";

import { testingMockRollInitialize } from "./heroRoller/dice-testing-helper.mjs";
import "./testing/testing-main.mjs";

import { HeroSystem6eToken, HeroSystem6eTokenDocument } from "./token/actor-token.mjs";
import { HeroSystemTokenHud } from "./token/heroSystemTokenHud.mjs";

import "./heroRoller/chat-dice.mjs";
import { HeroRoll } from "./heroRoller/dice.mjs";
import "./utility/adjustment.mjs";
import { HeroCompatibility } from "./utility/compatibility.mjs";
import { expireEffects } from "./utility/util.mjs";

const { Macro } = foundry.documents;
const { Actors, Items } = foundry.documents.collections;

export class HEROSYS {
    static ID = "HEROSYS";

    static #module = undefined;

    static get module() {
        if (HEROSYS.#module === undefined) {
            console.error(`HEROSYS.module accessed before it is assigned`);
            ui.notifications.error(`HEROSYS.module accessed before it is assigned`);
        }
        return HEROSYS.#module;
    }

    static set module(value) {
        if (HEROSYS.#module !== undefined) {
            console.error(`HEROSYS.module assigned after it is assigned`);
            ui.notifications.error(`HEROSYS.module accessed before it is assigned`);
        }
        HEROSYS.#module = value;
    }

    static log(force, ...args) {
        const shouldLog = force || game.settings.get(game.system.id, "alphaTesting");

        if (shouldLog) {
            console.log(this.ID, "|", ...args);
        }
    }

    static trace(force, ...args) {
        const shouldTrace = force || game.settings.get(game.system.id, "alphaTesting");

        if (shouldTrace) {
            console.trace(this.ID, "|", ...args);
        }
    }

    static get isSingleCombatantTrackerEnabled() {
        // World-scoped only: the combat document classes must match on every client (#4553).
        // The client-scoped alphaTesting setting merely reveals the config option.
        return game.settings.get(game.system.id, "singleCombatantTracker");
    }
}

Hooks.once("init", async function () {
    // Compatibility warnings for initial release of v13
    // In chrome use -/Deprecated since Version 13/ as a console log filter
    // Some v13 warning still slip in during initial load, re-applying filter is a temp fix.

    // CONFIG.debug.hooks = true;
    CONFIG.debug.combat = true;

    // V13 & V14 differences in how chat messages are displayed
    HERO.CHAT_MESSAGE_DEFAULT_STYLE = game.version.startsWith("13")
        ? CONST.CHAT_MESSAGE_STYLES.IC
        : CONST.CHAT_MESSAGE_STYLES.OOC;

    // Custom HeroSystem VisionMode
    setPerceptionModes();
    initializeHeroVisionV14();

    // HEROSYS
    HEROSYS.module = game.system.id;
    game.herosystem6e = {
        applications: {
            HeroSystemItemSheetV2,
        },
        entities: {
            HeroSystem6eActor,
            HeroSystem6eItem,
            HeroSystem6eTokenDocument,
            HeroSystem6eToken,
        },
        rollItemMacro: rollItemMacro,
        config: HERO,
        migrateCombatsToSingleCombatantTracker,
    };
    CONFIG.HERO = { ...CONFIG.HERO, ...HERO };

    SettingsHelpers.initLevelSettings();

    // Hero Custom Expiry Events
    Object.assign(CONFIG.ActiveEffect.expiryEvents, {
        "hero.segmentStart": "HERO.ExpirySegmentStart", // "Segment Start"
        "hero.segmentEnd": "HERO.ExpirySegmentEnd", // "Segment End"
        "hero.nextTurnStart": "HERO.ExpiryNextTurnStart", // "Actor's Next Turn Start"
        "hero.nextPhaseEnd": "HERO.ExpiryNextPhaseEnd", // Clears the "aborted" action lock safely
    });

    // Compendiums
    game.CreateHeroCompendiums = CreateHeroCompendiums;

    if (HEROSYS.isSingleCombatantTrackerEnabled) {
        CONFIG.Combat.documentClass = HeroSystem6eCombatSingle;
        CONFIG.Combatant.documentClass = HeroSystem6eCombatantSingle;
        CONFIG.ui.combat = HeroSystem6eCombatTrackerSingle;
    } else {
        CONFIG.Combat.documentClass = HeroSystem6eCombat;
        CONFIG.Combatant.documentClass = HeroSystem6eCombatant;
        HeroSystem6eCombatTracker.initializeTemplate();
        CONFIG.ui.combat = HeroSystem6eCombatTracker;
    }

    CONFIG.Combat.defeatedStatusId = "dead";
    CONFIG.ChatMessage.documentClass = HeroSystem6eChatMessage;

    // templatePreview
    CONFIG.Canvas.layers.templates.layerClass = HeroSystem6eTemplateLayer;

    CONFIG.Region.documentClass = HeroSystem6eRegionDocument;

    // V11 now support ActiveEffects on items without
    // the need to transfer the effect to the actor.
    CONFIG.ActiveEffect.legacyTransferral = false;

    // The system expires effects itself (expireEffects). Keep core's ActiveEffectRegistry from
    // persisting duration.expired on lapsed effects — with the default "update" action it
    // suppresses adjustments before their fade runs on the actor's Phase (#4524), and the
    // stale flag re-suppresses them on every later lapse since nothing ever clears it.
    // TODO: Fix this in the AE overhaul for V14
    CONFIG.ActiveEffect.expiryAction = null;

    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "@characteristics.dex.value + (@characteristics.spd.value / 100)",
        decimals: 2,
    };

    // Define custom Entity classes
    CONFIG.Actor.documentClass = HeroSystem6eActor;
    CONFIG.Item.documentClass = HeroSystem6eItem;
    CONFIG.Token.documentClass = HeroSystem6eTokenDocument;
    CONFIG.Token.hudClass = HeroSystemTokenHud;

    // v13 onwards. Remove if check when v12 support dropped.
    if (CONFIG.Token.movement) {
        CONFIG.Token.movement.actions = HeroSystemTokenHud.initializeMovementActions(HEROSYS.module);
        CONFIG.Token.movement.defaultAction = "RUNNING";
    }

    CONFIG.Token.objectClass = HeroSystem6eToken;
    CONFIG.MeasuredTemplate.objectClass = HeroSystem6eMeasuredTemplate;
    CONFIG.ActiveEffect.documentClass = HeroSystem6eActorActiveEffects;
    CONFIG.Token.rulerClass = HeroTokenRuler; //V13

    if (!HeroCompatibility.isV14) {
        CONFIG.Canvas.visionSourceClass = HeroPointVisionSource;
    }

    Object.assign(CONFIG.ActiveEffect.dataModels, {
        // REF: https://foundryvtt.wiki/en/development/api/DataModel
        base: HeroSystem6eActorActiveEffectsSystemData,
    });

    Object.assign(CONFIG.Actor.dataModels, {
        ai: HeroActorModel,
        automaton: HeroActorModel,
        base2: HeroActorModel,
        computer: HeroActorModel,
        pc: HeroActorModel,
        npc: HeroActorModel,
        vehicle: HeroActorModel,
    });

    Object.assign(CONFIG.Item.dataModels, {
        // The keys are the types defined in our system.json
        power: HeroSystem6eItemPower,
        equipment: HeroSystem6eItemEquipment,
        skill: HeroSystem6eItemSkill,
        maneuver: HeroSystem6eItemManeuver,
        talent: HeroSystem6eItemTalent,
        perk: HeroSystem6eItemPerk,
        martialart: HeroSystem6eItemMartialArt,
        disadvantage: HeroSystem6eItemDisadvantage,
        characteristic: HeroItemCharacteristic,
    });

    initializeHandlebarsHelpers();
    initializeItemHandlebarsHelpers();

    Actors.registerSheet("herosystem6e", HeroSystemActorSheetV2, {
        makeDefault: true,
        themes: {
            "": "Default",
            light: "Light",
            dark: "Dark",
            hc: "High Contrast",
        },
        label: "HeroSystem v2",
    });

    Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
    Items.registerSheet("herosystem6e", HeroSystemItemSheetV2, {
        makeDefault: true,
        themes: {
            "": "Default",
            light: "Light",
            dark: "Dark",
            hc: "High Contrast",
        },
        label: "HeroSystem V2",
    });

    //Not sure why ActiveEffect.registerSheet is missing.
    foundry.applications.apps.DocumentSheetConfig.registerSheet(
        ActiveEffect,
        "herosystem6e",
        HeroSystemActiveEffectConfig,
        {
            makeDefault: true,
            label: "HeroSystemActiveEffectConfig",
        },
    );

    const templatePaths = [
        `systems/${HEROSYS.module}/templates/attack/remove-power-from-automaton.hbs`,

        `systems/${HEROSYS.module}/templates/chat/defense-tags-partial.hbs`,

        `systems/${HEROSYS.module}/templates/combat/header.hbs`,
        `systems/${HEROSYS.module}/templates/combat/tracker.hbs`,
        `systems/${HEROSYS.module}/templates/combat/footer.hbs`,

        `systems/${HEROSYS.module}/templates/item/item-action-icons-partial.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-information-modification-icons-partial.hbs`,

        `systems/${HEROSYS.module}/templates/item/item-sheet-v2/item-partial-common-v2.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-sheet-v2/item-partial-active-points-v2.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-sheet-v2/item-partial-adders-modifiers-v2.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-sheet-v2/item-sheet-actions-partial-v2.hbs`,

        `systems/${HEROSYS.module}/templates/system/effects-panel.hbs`,
        `systems/${HEROSYS.module}/templates/system/hero-generic-roller.hbs`,

        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-search-partial-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-defenses-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-movements-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-martial-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-skills-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-maneuvers-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-powers-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-equipment-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-characteristics-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-perks-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-talents-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-disadvantages-partial-item-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-item-actions-partial-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-item-cost-v2.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-item-description-v2.hbs`,

        `systems/${HEROSYS.module}/templates/actor/actor-sheet-v2-parts/actor-sheet-effects-partial-item-v2.hbs`,
    ];
    // Handlebars Templates and Partials
    foundry.applications.handlebars.loadTemplates(templatePaths);

    ItemVppConfig.initializeTemplate();

    // Assign the Sidebar subclasses
    CONFIG.ui.items = HeroSystem6eItemDirectory;
    CONFIG.ui.compendium = HeroSystem6eCompendiumDirectory;

    GenericRoller.Initialize();
    HeroSocketHandler.Initialize();

    // Insert EffectsPanel template into DOM tree so it can render
    if (parseInt(game.version.split(".")[0] || 0) === 12) {
        // Template element for effects-panel
        const ui = document.querySelector("#ui-right-column-1");
        if (ui) {
            const template = document.createElement("template");
            template.setAttribute("id", "hero-effects-panel");
            ui.insertAdjacentElement("afterend", template);
        }
    } else if (parseInt(game.version.split(".")[0] || 0) > 12) {
        // Template element for effects-panel
        const ui = document.querySelector("#ui-right-column-1");
        if (ui) {
            const template = document.createElement("template");
            template.setAttribute("id", "hero-effects-panel");
            ui?.insertAdjacentElement("afterend", template);
        }
    }

    game[HEROSYS.module] ??= {};
    game[HEROSYS.module].effectPanel = new EffectsPanel();
});

// Functionality that requires localization to have been loaded
Hooks.once("i18nInit", () => {
    // Override the default statusEffects
    CONFIG.statusEffects = HeroSystem6eActorActiveEffects.initialize(HEROSYS.module);

    HeroRoll.initialize();
    testingMockRollInitialize();
});

Hooks.on("canvasReady", () => {
    if (game.settings.get(game.system.id, "effectsPanel")) {
        // Effect Panel singleton application
        game[HEROSYS.module].effectPanel.render(true);
        if (!canvas.scene) return;
        if (game.ready) canvas.scene.reset();
    }
});

Hooks.once("ready", async function () {
    if (game.settings.get(game.system.id, "alphaTesting")) {
        CONFIG.compatibility.mode = 0;
        CONFIG.debug.combat = true;
    }

    // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
    Hooks.on("hotbarDrop", (bar, data, slot) => createHeroSystem6eMacro(bar, data, slot));

    if (
        typeof SimpleCalendar != "undefined" &&
        game.user.isGM &&
        SimpleCalendar.api.getCurrentCalendar().general.gameWorldTimeIntegration != "mixed"
    ) {
        console.log(SimpleCalendar.api.getCurrentCalendar().general.gameWorldTimeIntegration);
        return ui.notifications.warn(`Recommend setting Simple Calendar GameWorldTimeIntegration = Mixed`);
    }

    // When using a square grid for scenes, the system needs the realistic square diagonals. Warn users if they don't have that setting.
    if (game.settings.get("core", "gridDiagonals") !== CONST.GRID_DIAGONALS.EXACT) {
        ui.notifications.info(
            'The Core FoundryVTT setting, "Square Grid Diagonals", was set to be "Exact (√2)" for correct measurement and behavior for scenes with square grids.',
        );
        await game.settings.set("core", "gridDiagonals", CONST.GRID_DIAGONALS.EXACT);
    }
});

Hooks.on("renderChatMessageHTML", (app, html, data) => {
    // Display action buttons
    chat.displayChatActionButtons(app, $(html), data);
    //HeroSystem6eCardHelpers.onMessageRendered($(html));

    // Lightning Reflexes segment prompts: wire the whispered Act Early button
    html.querySelectorAll("button.hero-lr-act-early").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const combat = game.combats.get(button.dataset.combatId);
            const combatant = combat?.combatants.get(button.dataset.combatantId);
            if (!combat?.started || !combatant?.isOwner) return;
            if (combat.lrElevationState?.(combatant) !== "available") {
                return ui.notifications.warn(
                    `The Lightning Reflexes window for ${combatant.name} has passed this Segment.`,
                );
            }
            combat.toggleLrElevation(combatant.id);
        });
    });

    // Deferred voluntary SPD change: the GM's "apply immediately" escape hatch
    html.querySelectorAll("button.hero-spd-apply-now").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            if (!game.user.isGM) return;
            const combat = game.combats.get(button.dataset.combatId);
            combat?.applyPendingSpdNow?.(button.dataset.combatantId);
        });
    });

    // Wound-up Haymaker: interruption cancel (owner or GM)
    html.querySelectorAll("button.hero-haymaker-cancel").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const combat = game.combats.get(button.dataset.combatId);
            combat?.cancelHaymaker?.(button.dataset.combatantId);
        });
    });

    // Delayed action (Extra Time): interruption cancel (owner or GM)
    html.querySelectorAll("button.hero-delayed-cancel").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const combat = game.combats.get(button.dataset.combatId);
            combat?.cancelDelayedAction?.(button.dataset.combatantId, button.dataset.delayedId ?? null);
        });
    });

    // Delayed action: resolve immediately (owner/GM fiat)
    html.querySelectorAll("button.hero-delayed-now").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const combat = game.combats.get(button.dataset.combatId);
            combat?.resolveDelayedActionNow?.(button.dataset.combatantId, button.dataset.delayedId ?? null);
        });
    });

    // The hero-delayed-roll / hero-delayed-fail buttons are wired in
    // chat/delayed-attack-cards.mjs (its own renderChatMessageHTML hook).
});

// Hooks.on("renderChatLog", (app, html) => HeroSystem6eCardHelpers.chatListeners(html));
// Hooks.on("renderChatPopout", (app, html) => HeroSystem6eCardHelpers.chatListeners(html));

// When actor SPD/DEX (or other initiative inputs) change we need to setupTurns again
Hooks.on("updateActor", async (document, change /*, _options, _userId */) => {
    const initiativeRelevant =
        change?.system?.characteristics?.spd?.value !== undefined ||
        change?.system?.characteristics?.dex?.value !== undefined ||
        change?.system?.characteristics?.ego?.value !== undefined ||
        change?.system?.characteristics?.int?.value !== undefined ||
        change?.system?.initiativeCharacteristic !== undefined;
    if (!initiativeRelevant) return;

    if (!HEROSYS.isSingleCombatantTrackerEnabled) {
        for (const combat of game.combats) {
            if (combat.active) {
                const _combatants = combat.combatants.filter((o) => o.actorId === document.id);
                if (_combatants) {
                    // Reroll Initiative (based on new spd/dex/ego/int changes)
                    //await combat.rollAll();
                    await combat.rollInitiative(_combatants.map((o) => o.id));
                    await combat.extraCombatants();

                    // Setup Turns in combat tracker based on new spd/dex/ego/int changes)
                    // Should no longer be needed now that SPD is part of initiative (handled via rollAll/combat:rollInitiative)
                    //await combat.setupTurns();
                }
            }
        }
        return;
    }

    // Single tracker: re-sort on live priorities and keep the pointer on the active
    // combatant. The stored actingPriority threshold is deliberately untouched — it
    // is what stops already-acted combatants from being re-admitted (and unacted
    // ones from being skipped) when priorities move mid-segment. SPD semantics
    // (lockouts, voluntary deferral) are owned by the segment-boundary poll.
    for (const combat of game.combats) {
        if (!combat.active || !combat.started) continue;
        const combatants = combat.combatants.filter((o) => o.actorId === document.id);
        if (combatants.length === 0) continue;
        if (!game.users.activeGM?.isSelf) {
            combat.collection.render();
            continue;
        }
        const activeId = combat.combatant?.id ?? null;
        const updates = combatants
            .map((c) => ({ _id: c.id, initiative: combat.getInitiativePriority(c, combat.segment) }))
            .filter((u) => combat.combatants.get(u._id)?.initiative !== u.initiative);
        if (updates.length > 0) await combat.updateEmbeddedDocuments("Combatant", updates);
        await combat.resyncTurnPointer?.(activeId);
    }
});

Hooks.on("closeTokenConfig", async (tokenConfig) => {
    // We may have changed the disposition, so re-render the combat tracker
    if (game.combat?.active) {
        if (game.combat.combatants.find((o) => o.tokenId === tokenConfig.token.id)) {
            game.combat.collection.render();
        }
    }
});

Hooks.on("changeSidebarTab", async (app) => {
    if (!HEROSYS.isSingleCombatantTrackerEnabled) {
        // Make sure active token is centered in combat tracker when changing Sidebar
        if (app.tabName === "combat" && game.combat?.active && app.scrollToTurn) {
            app.scrollToTurn();
        }
    }
});

Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
    registerPackageDebugFlag(HEROSYS.ID);
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
function createHeroSystem6eMacro(bar, data, slot) {
    // Check if we want to override the default macro (open sheet)
    if (data.type === "Item" && typeof data.uuid === "string") {
        const item = fromUuidSync(data.uuid);
        if (item.isRollable()) {
            handleMacroCreation(bar, data, slot, item);
            return false;
        }
    }
}

async function handleMacroCreation(bar, data, slot, item) {
    HEROSYS.log(false, "createHeroSystem6eMacro", item);
    if (!item) return;
    if (!item.roll) return;

    // Create the macro command
    const command = `game.herosystem6e.rollItemMacro("${item.name}", "${item.type}");`;
    let macro = game.macros.find((m) => m.command === command && m.name === item.name && m.img === item.img);
    if (!macro) {
        macro = await Macro.create({
            name: item.name,
            type: "script",
            img: item.img,
            command: command,
            flags: { [`${game.system.id}.herosystem6e.itemMacro`]: true },
        });
    }
    game.user.assignHotbarMacro(macro, slot);
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName, itemType) {
    const speaker = ChatMessage.getSpeaker();
    let actor;
    if (speaker.token) actor = game.actors.tokens[speaker.token];
    if (!actor) actor = game.actors.get(speaker.actor);
    let item = actor ? actor.items.find((i) => i.name === itemName && (!itemType || i.type == itemType)) : null;

    // The selected actor does not have an item with this name.
    if (!item) {
        item = null;
        // Search all owned tokens for this item
        for (let token of canvas.tokens.ownedTokens) {
            actor = token.actor;
            item = actor.items.find((i) => i.name === itemName && (!itemType || i.type == itemType));
            if (item) {
                break;
            }
        }

        if (!item)
            return ui.notifications.warn(
                `Your controlled Actor does not have an ${itemType || "item"} named ${itemName}`,
            );
    }

    // Trigger the item roll
    return item.roll();
}

Hooks.on("setup", async () => {
    // The default Foundry cone angle is 53.13 degrees.
    // This will set the default angle to 60 degrees.
    // REF: https://github.com/dmdorman/hero6e-foundryvtt/issues/40
    CONFIG.MeasuredTemplate.defaults.angle = 60;

    // Found undefined item name in old Raymond game
    // This Should never happen, but it did and prevents game.ready
    // Every item requires a name and an id.
    // Shouldn't be able to create an item without name + id.
    const allActorsInGame = [
        ...game.actors.contents,
        ...game.scenes.contents
            .map((scene) => scene.tokens)
            .map((token) => token.actorLink)
            .filter((actorLink) => actorLink),
    ];
    for (const actor of allActorsInGame) {
        const noNameItems = actor.items.filter((i) => i.name == undefined);
        if (noNameItems.length > 0) {
            console.error(`noNameItems found`, noNameItems);
            const promises = noNameItems.map((o) => o.delete());
            await Promise.all(promises);
            ui.notifications.error(`Deleted items with an undefined name. Refresh may be necessary.`, {
                permanent: true,
            });
        }
    }
});

// Migration Script
// For now we will migrate EVERY time
// TODO: add version setting check
// REF: https://www.youtube.com/watch?v=Hl23n3MvtaI
Hooks.once("ready", async function () {
    if (!game.user.isGM) {
        return;
    }

    // Check if we have already migrated
    const lastMigration = game.settings.get(game.system.id, "lastMigration");

    if (foundry.utils.isNewerVersion(game.system.version.replace("-alpha", ""), lastMigration)) {
        await migrateWorld();

        // Update lastMigration
        await game.settings.set(game.system.id, "lastMigration", game.system.version.replace("-alpha", ""));
    }
});

// New Actor Dialog
Hooks.on("renderDialog", (dialog, html) => {
    if (
        html[0].querySelector(".window-title").textContent != "Create New Actor" &&
        html[0].querySelector(".window-title").textContent != "Create New Item"
    )
        return;

    // Remove legacy actor types
    const characterOption = html[0].querySelector("option[value*='character']");
    if (characterOption) characterOption.remove();

    // Remove legacy/improper item types
    // TODO: Replace with a list of valid powers instead of a freeform item, which probably doesn't work anyway.
    const attackOption = html[0].querySelector("option[value*='attack']");
    if (attackOption) attackOption.remove();
    const defenseOption = html[0].querySelector("option[value*='defense']");
    if (defenseOption) defenseOption.remove();
    const maneuverOption = html[0].querySelector("option[value*='maneuver']");
    if (maneuverOption) maneuverOption.remove();
    const miscOption = html[0].querySelector("option[value*='misc']");
    if (miscOption) miscOption.remove();
    const movementOption = html[0].querySelector("option[value*='movement']");
    if (movementOption) movementOption.remove();
    const characteristicOption = html[0].querySelector("option[value*='characteristic']");
    if (characteristicOption) characteristicOption.remove();

    // rename base2 to base (v11)
    let base2 = html[0].querySelector("option[value*='base2']");
    if (base2) base2.text = base2.text.replace("2", "");
});

Hooks.on("renderDialogV2", (dialog, html) => {
    const attackOption = html.querySelector("option[value*='attack']");
    if (attackOption) attackOption.remove();
    const defenseOption = html.querySelector("option[value*='defense']");
    if (defenseOption) defenseOption.remove();
    const maneuverOption = html.querySelector("option[value*='maneuver']");
    if (maneuverOption) maneuverOption.remove();
    const miscOption = html.querySelector("option[value*='misc']");
    if (miscOption) miscOption.remove();
    const movementOption = html.querySelector("option[value*='movement']");
    if (movementOption) movementOption.remove();
    const characteristicOption = html.querySelector("option[value*='characteristic']");
    if (characteristicOption) characteristicOption.remove();
});

Hooks.on("renderActorSheet", (dialog, html, data) => {
    // Show versions
    html.find("header h4").append(`<span>${game.system.version}</span>`);

    try {
        if (data?.actor?.system?.versionHeroSystem6eUpload) {
            html.find("header h4").append(
                ` <span title='Actor version at time of HDC upload'>(${
                    data?.actor?.system?.versionHeroSystem6eUpload || ""
                })</span>`,
            );
        } else if (data?.actor?.system?.versionHeroSystem6eCreated) {
            html.find("header h4").append(
                ` <span title='Actor version at time of creation'>(${
                    data?.actor?.system?.versionHeroSystem6eCreated || ""
                })</span>`,
            );
        }
    } catch (err) {
        console.log(err);
    }

    // // Change Type
    // if (game.user.isGM) {
    //     const element = document.createElement("a");
    //     element.classList = "header-button control";
    //     element.setAttribute(`data-id`, data.actor.uuid);
    //     element.title = data.actor.type.toUpperCase().replace("2", "");
    //     element.addEventListener("click", async (event) => {
    //         event.preventDefault();
    //         const actor = fromUuidSync(event.target.dataset.id);
    //         if (!actor) {
    //             ui.notifications.error(`Actor ${event.target.dataset.id} was not found`);
    //             return;
    //         }
    //         //await actor.changeType();
    //     });

    //     element.innerHTML = `<i class="fal fa-user-robot"></i>${data.actor?.template?.replace("builtIn.", "").replace(".hdt", "") || "Type"} `;

    //     html.find("header h4").after(element);
    // }
});

Hooks.on("getActorDirectoryEntryContext", (_dialog, html) => {
    const menu = {
        name: "Change Type",
        icon: '<i class="fas fa-cog"></i>',
        callback: async function (target) {
            const dataset = { ...target[0].dataset };
            const actor = game.actors.get(dataset.entryId);
            return actor.changeTypeDialog();
        },
    };
    html.push(menu);
});

//Modify TokenHUD (need 3 bars: end, stun, body)
// Hooks.on("renderTokenHUD", HeroSystem6eTokenHud);
// Hooks.on("renderTokenConfig", extendTokenConfig);

// Expire ActiveEffects
// TODO: Rework to call _outOfCombatRecovery (with multiplier) only on post12?
// Notice we don't store secondsSinceRecovery in the database, so it varies based on
// when the game was last loaded.
// Not likely a problem, since out of combat STUN/END accuracy isn't typically important.
let secondsSinceRecovery = 0;

/**
 * Cheap non-empty equivalent of actor.getTemporaryEffects() (no Array.from/filter/sort).
 * Intentionally ignores `active` so suppressed temporary item effects still qualify.
 * @param {HeroSystem6eActor} actor
 * @returns {boolean}
 */
function actorHasTemporaryEffects(actor) {
    for (const ae of actor.allApplicableEffects()) {
        if (ae.isTemporary) return true;
    }
    return false;
}

// The tracker derives row names and images live from the token, but core only
// re-renders it on combat/actor updates — a token rename or art swap otherwise
// waits for the next unrelated render (#3319, #3727)
Hooks.on("updateToken", (tokenDoc, change) => {
    if (!("name" in change) && !foundry.utils.hasProperty(change, "texture.src")) return;
    if (!ui.combat?.viewed?.combatants.some((c) => c.tokenId === tokenDoc.id)) return;
    ui.combat.render();
});

// Foundry does not await async hook callbacks, so rapid time advances (combat clicking,
// large calendar jumps) can otherwise overlap and double-process the same effects.
let worldTimeWorkChain = Promise.resolve();

/**
 * Handle follow-up actions when the official World time is changed
 * @param {number} worldTime      The new canonical World time.
 * @param {number} dt             The time delta in seconds.
 */
Hooks.on("updateWorldTime", (worldTime, dt) => {
    // Ensure that this only runs for 1 user to we don't have multiple user attempting to
    // initiate actions. For simplicity we will limit it to the GM.
    if (game.user !== game.users.activeGM) return;

    worldTimeWorkChain = worldTimeWorkChain
        .then(() => _processWorldTimeUpdate(dt))
        .catch((e) => console.error(`updateWorldTime processing failed: ${e.message}`, e));
});

async function _processWorldTimeUpdate(dt) {
    //console.log(`updateWorldTime`, game.time.worldTime);
    const _start = Date.now();

    const deltaSeconds = parseInt(dt || 0);
    secondsSinceRecovery += deltaSeconds;

    // Recoveries occur every 12 seconds; bank any remainder toward the next advance.
    const multiplier = Math.max(0, Math.floor(secondsSinceRecovery / 12));
    secondsSinceRecovery = Math.max(0, secondsSinceRecovery - 12 * multiplier);

    await reRenderSheetsWithTemporyEffects();

    // All actors plus any unlinked actors in active scene
    const _actorCollection = Date.now();
    const actors = Array.from(game.actors);
    const worldActorIds = new Set(actors.map((o) => o.id));
    const currentTokens = game.scenes.current?.tokens || [];
    for (const token of currentTokens) {
        if (token.actor && (!token.actorLink || !worldActorIds.has(token.actor.id))) {
            actors.push(token.actor);
        }
    }
    console.debug(`updateWorldTime.actorCollection took ${Date.now() - _actorCollection} ms`);

    // Recovery only matters when 12+ seconds have accumulated; _outOfCombatRecovery
    // keeps its own inCombat/automation gates.
    const runRecovery = multiplier > 0;
    let processedCount = 0;
    const _startExpire1 = {};
    for (const actor of actors) {
        try {
            // Most actors need nothing on a time tick.
            const hasTempEffects = actorHasTemporaryEffects(actor);
            if (!hasTempEffects && !runRecovery) continue;
            processedCount++;

            if (hasTempEffects) {
                // Expire effects that expire on segment end
                const _ee = Date.now();
                await expireEffects(actor, "segment");
                _startExpire1.ee = (_startExpire1.ee ?? 0) + (Date.now() - _ee);
            }

            if (runRecovery) {
                // Out of combat recovery.  When SimpleCalendar is used to advance time.
                // This simple routine only handles increments of 12 seconds or more.
                const _oocr = Date.now();
                await _outOfCombatRecovery(actor, multiplier);
                _startExpire1.oocr = (_startExpire1.oocr ?? 0) + (Date.now() - _oocr);
            }

            if (hasTempEffects) {
                // Expire continuing charges
                const _ecc = Date.now();
                await _expireContinuingCharges(actor);
                _startExpire1.ecc = (_startExpire1.ecc ?? 0) + (Date.now() - _ecc);
            }
        } catch (e) {
            console.error(e, actor, actor?.temporaryEffects[0]);
        }
    }
    console.debug(`updateWorldTime processed ${processedCount}/${actors.length} actors`);
    console.debug(`updateWorldTime.expireEffects took ${_startExpire1.ee ?? 0} ms`);
    console.debug(`updateWorldTime.outOfCombatRecovery took ${_startExpire1.oocr ?? 0} ms`);
    console.debug(`updateWorldTime.expireContinuingCharges took ${_startExpire1.ecc ?? 0} ms`);

    // If there are lots of actors updateWorldTime may result in performance issues.
    // Notify GM when this is a concern.
    const deltaMs = Date.now() - _start;
    if (deltaMs > 100) {
        const msg = `updateWorldTime took ${deltaMs} ms.  This routine handles adjustment fades and END/BODY recovery for all actors, and all tokens on this scene.  If this occurs on a regular basis, then there may be a performance issue that needs to be addressed by the developer.`;
        if (game.settings.get(game.system.id, "alphaTesting")) {
            ui.notifications.warn(msg);
        } else {
            console.warn(msg);
        }
    } else {
        console.debug(`updateWorldTime took ${deltaMs} ms`);
    }
}

async function reRenderSheetsWithTemporyEffects() {
    try {
        const _start = Date.now();
        // Re-render any open actor sheets so we can see the updated time remaining.
        for (const actorSheet of Array.from(foundry.applications.instances.values()).filter(
            (app) => app.document?.documentName === "Actor",
        )) {
            if (actorSheet.actor.temporaryEffects.length > 0) {
                // Fire and forget (intentionally not awaiting)
                actorSheet.render();
            }
        }

        // Re-render any open actor sheets so we can see the updated time remaining.
        for (const activeEffectSheet of Array.from(foundry.applications.instances.values()).filter(
            (app) => app.document?.documentName === "ActiveEffect",
        )) {
            if (activeEffectSheet.document.isTemporary) {
                // Fire and forget (intentionally not awaiting)
                activeEffectSheet.render();
            }
        }
        console.debug(`updateWorldTime.reRenderSheetsWithTemporaryEffects took ${Date.now() - _start} ms`);
    } catch (e) {
        console.error("Error re-rendering sheets on updateWorldTime", e);
    }
}

async function _expireContinuingCharges(actor) {
    let needsRefresh = false;
    for (const aeWithCharges of actor.temporaryEffects.filter((o) =>
        o.parent instanceof HeroSystem6eItem ? o.parent.findModsByXmlid("CONTINUING") : false,
    )) {
        if (!aeWithCharges.parent.isActive) {
            console.error(`${aeWithCharges.name} is inactive and will not expire.`);
            continue;
        }
        if (game.time.worldTime >= aeWithCharges.flags[game.system.id]?.startTime + aeWithCharges.duration.seconds) {
            await aeWithCharges.parent.toggle();
        } else {
            needsRefresh = true;
        }
    }
    if (needsRefresh && game.ready) game[HEROSYS.module].effectPanel.refresh();
}

/**
 *
 * @param {HeroSystem6eActor} actor
 * @param {Number} multiplier - integer number of turns
 * @returns
 */
async function _outOfCombatRecovery(actor, multiplier) {
    // If GM rewinds time, then goes forward again,
    // some actors may get "bonus" recoveries.
    // TODO: Somehow keep track of last recovery time so they don't get
    // unearned recoveries.  A simple last recovery timestamp isn't likely
    // sufficient as the GM may want to rewind time intentionally with Simple Calendar, then
    // allow normal forward time progression from that point forward.
    // Perhaps clear any recovery timestamp when combat ends, although we
    // can have more than one combat.

    //TODO: Can we simplify this and call actor.TakeRecovery?  May have to pass a multiplier.
    const startDate = Date.now();
    let recoveryDate;
    let enduranceReserveDate;
    if (actor.inCombat) return;
    // Actor#inCombat only consults the *viewed* combat (game.combat = ui.combat.viewed).
    // Actors in any other started combat get their recoveries from Post-Segment 12, so a
    // worldTime advance must not also recover them.
    if (game.combats.some((c) => c.started && c.getCombatantsByActor(actor).length > 0)) return;
    if (multiplier <= 0) return;

    const automation = game.settings.get(HEROSYS.module, "automation");

    if (
        automation === "all" ||
        (automation === "npcOnly" && actor.type == "npc") ||
        (automation === "pcEndOnly" && actor.type === "pc")
    ) {
        recoveryDate = Date.now();
        const rec = parseInt(actor.getCharacteristic("rec").value) * multiplier;
        if (rec > 0) {
            const actorUpdates = {};

            if (
                actor.hasCharacteristic("STUN") &&
                actor.getCharacteristic("stun").value < actor.getCharacteristic("stun").max
            ) {
                // If this is an NPC and their STUN <= 0 then leave them be.
                // Typically, you should only use the Recovery Time Table for
                // PCs. Once an NPC is Knocked Out below the -10 STUN level
                // they should normally remain unconscious until the fight ends.

                // TODO: Implement optional longer term recovery
                // For STUN:
                // From 0 to -10 they get 1 recovery every phase and post 12
                // From -11 to -20 they get 1 recovery post 12
                // From -21 to -30 they get 1 recovery per minute
                // From -31 they're completely out at the GM's discretion

                if (actor.type === "pc" || parseInt(actor.getCharacteristic("stun").value) > -10) {
                    const stunValue = Math.min(
                        parseInt(actor.getCharacteristic("stun").max),
                        parseInt(actor.getCharacteristic("stun").value) + rec,
                    );
                    foundry.utils.setProperty(actorUpdates, "system.characteristics.stun.value", stunValue);
                }
            }

            if (
                actor.hasCharacteristic("END") &&
                actor.getCharacteristic("end").value < actor.getCharacteristic("end").max
            ) {
                const endValue = Math.min(
                    parseInt(actor.getCharacteristic("end").max),
                    parseInt(actor.getCharacteristic("end").value) + rec,
                );
                foundry.utils.setProperty(actorUpdates, "system.characteristics.end.value", endValue);
            }

            if (Object.keys(actorUpdates).length > 0) {
                // Intentionally not awaiting.
                // Trying to keep updateWorldTime loop as quick as possible.
                // This actor isn't in combat and unlikely to have actor sheet open, so not time sensitive.
                // Stun effect (if any) should be removed during actor.onUpdate
                actor.update(actorUpdates);
            }
        }

        // END RESERVE
        // TODO: Check for negative REC
        // TODO: Use effectiveLevels
        enduranceReserveDate = Date.now();
        for (const enduranceReserveItem of actor.items.filter((o) => o.system.XMLID === "ENDURANCERESERVE")) {
            const ENDURANCERESERVEREC = enduranceReserveItem.findModsByXmlid("ENDURANCERESERVEREC");
            if (ENDURANCERESERVEREC) {
                const newValue = Math.min(
                    enduranceReserveItem.system.LEVELS,
                    enduranceReserveItem.system.value + parseInt(ENDURANCERESERVEREC.LEVELS * multiplier),
                );
                if (isNaN(newValue)) {
                    console.error(`${actor.name} ENDURANCERESERVEREC`);
                    break;
                }
                if (newValue > enduranceReserveItem.system.value) {
                    // Intentionally not awaiting.
                    // Trying to keep updateWorldTime loop as quick as possible.
                    // This actor isn't in combat and unlikely to have actor sheet open, so not time sensitive.
                    enduranceReserveItem.update({
                        "system.value": newValue,
                    });
                }
            }
        }
    }
    const endDate = Date.now();
    const deltaDate = endDate - startDate;
    if (deltaDate > 100) {
        console.warn(
            `${actor.name} took ${deltaDate}ms to process _outOfCombatRecovery. recoveryDate=${recoveryDate - startDate}.  enduranceReserve=${enduranceReserveDate - startDate}.`,
        );
    }
}

// If compendium is created you have to reload to get the new application class.
// This is known issue https://discord.com/channels/170995199584108546/670336275496042502/1255649814096511107
Hooks.once("setup", function () {
    // Apply custom application for Compendiums for parent/child features
    game.packs.filter((p) => p.metadata.type === "Item").forEach((p) => (p.applicationClass = HeroSystem6eCompendium));
});
