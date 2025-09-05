// Import Modules
import { HERO } from "./config.mjs";
import * as chat from "./chat.mjs";
import HeroSystem6eMeasuredTemplate from "./measuretemplate.mjs";
import { HeroSystem6eCombat } from "./combat.mjs";
import { HeroSystem6eCombatTracker } from "./combatTracker.mjs";
import { HeroSystem6eCombatant } from "./combatant.mjs";
import { HeroRuler } from "./heroRuler.mjs";
import { HeroTokenRuler } from "./heroTokenRuler.mjs";
import { initializeHandlebarsHelpers } from "./handlebars-helpers.mjs";
import { migrateWorld } from "./migration.mjs";
import { HeroSystem6eItemDirectory } from "./itemDirectory.mjs";
import { HeroSystem6eCompendium } from "./compendium.mjs";
import { HeroSystem6eCompendiumDirectory } from "./compendiumDirectory.mjs";
import { CreateHeroCompendiums } from "./heroCompendiums.mjs";
import { setPerceptionModes } from "./utility/vision.mjs";
import { HeroPointVisionSource } from "./utility/vision.mjs";
import { EffectsPanel } from "./effects-panel.mjs";
import { GenericRoller } from "./genericRoller.mjs";

import { HeroSystem6eActor } from "./actor/actor.mjs";
import { HeroSystemActorSheet } from "./actor/actor-sheet.mjs";
import { HeroSystemActorSavuoriSheet } from "./actor/actor-savuori-sheet.mjs";
import { HeroSystem6eToken, HeroSystem6eTokenDocument } from "./actor/actor-token.mjs";
import {
    HeroSystem6eActorActiveEffects,
    HeroSystem6eActorActiveEffectsSystemData,
} from "./actor/actor-active-effects.mjs";
import { HeroSystemActiveEffectConfig } from "./actor/active-effect-config.mjs";

import { HeroSystem6eItem, initializeItemHandlebarsHelpers } from "./item/item.mjs";
import { HeroSystem6eItemTypeDataModelMisc } from "./item/HeroSystem6eItemTypeDataModelMisc.mjs";
import {
    HeroActorModel,
    HeroSystem6eItemPower,
    HeroSystem6eItemEquipment,
    HeroSystem6eItemSkill,
    HeroSystem6eItemManeuver,
    HeroSystem6eItemTalent,
    HeroSystem6eItemPerk,
    HeroSystem6eItemMartialArt,
    HeroSystem6eItemDisadvantage,
    HeroSystem6eItemComplication,
    HeroItemCharacteristic,
} from "./item/HeroSystem6eTypeDataModels.mjs";
import { HeroSystem6eItemSheet } from "./item/item-sheet.mjs";

//import { HeroSystem6eCardHelpers } from "./card/card-helpers.mjs";

import SettingsHelpers from "./settings/settings-helpers.mjs";

import { expireEffects, getCharacteristicInfoArrayForActor } from "./utility/util.mjs";
import "./utility/adjustment.mjs";
import "./utility/chat-dice.mjs";

import "./testing/testing-main.mjs";
import { HeroSystem6eEndToEndTest } from "./testing/end-to-end.mjs";

import { isGameV13OrLater } from "./utility/compatibility.mjs";
import { HeroSocketHandler } from "./heroSocketHandler.mjs";
import { HeroSystem6eChatMessage } from "./heroChatMessage.mjs";

// V13 SignedString does not add a plus before a zero, also uses a non-standard minus sign.
// V12 SignedString works great, unclear why V13 change it.
// So we will create our own signedString.
function signedStringHero() {
    const n = this.toLocaleString(game.i18n.lang);
    //if (this === 0) return n;
    if (this < 0)
        //return n.replace("-", "−"); // Minus sign character
        return n;
    else return `+${n}`;
}
Object.defineProperties(Number.prototype, {
    signedStringHero: { value: signedStringHero },
});

// v13 has namespaced these. Remove when support is no longer provided. Also remove from eslint template.
const FoundryVttActors = foundry.documents?.collections?.Actors || Actors;
const FoundryVttItems = foundry.documents?.collections?.Items || Items;
const FoundryVttActorSheet = foundry.appv1?.sheets?.ActorSheet || ActorSheet;
const FoundryVttItemSheet = foundry.appv1?.sheets?.ItemSheet || ItemSheet;
const FoundryVttDocumentSheetConfig = foundry.applications?.apps?.DocumentSheetConfig || DocumentSheetConfig;
const foundryVttLoadTemplates = foundry.applications?.handlebars?.loadTemplates || loadTemplates;

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
}

Hooks.once("init", async function () {
    // Compatibility warnings for initial release of v13
    // In chrome use -/Deprecated since Version 13/ as a console log filter
    // Some v13 warning still slip in during initial load, re-applying filter is a temp fix.

    // CONFIG.debug.hooks = true;
    CONFIG.debug.combat = true;

    // Custom HeroSystem VisionMode
    setPerceptionModes();

    game.CreateHeroCompendiums = CreateHeroCompendiums;
    HEROSYS.module = game.system.id;
    game.herosystem6e = {
        applications: {
            HeroSystem6eItemSheet,
        },
        entities: {
            HeroSystem6eActor,
            HeroSystem6eItem,
            HeroSystem6eTokenDocument,
            HeroSystem6eToken,
        },
        rollItemMacro: rollItemMacro,
        CreateCustomAttack: CreateCustomAttack,
        config: HERO,
    };

    CONFIG.HERO = HERO;

    CONFIG.Combat.documentClass = HeroSystem6eCombat;
    CONFIG.Combatant.documentClass = HeroSystem6eCombatant;
    CONFIG.Combat.defeatedStatusId = "dead";
    CONFIG.ChatMessage.documentClass = HeroSystem6eChatMessage;

    // V11 now support ActiveEffects on items without
    // the need to transfer the effect to the actor.
    CONFIG.ActiveEffect.legacyTransferral = false;

    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "@characteristics.dex.value + (@characteristics.spd.value / 100)",
        decimals: 2,
    };

    // debug
    // CONFIG.debug.hooks = true;
    // CONFIG.debug.combat = true;
    // CONFIG.debug.time = true;

    // Define custom Entity classes
    CONFIG.Actor.documentClass = HeroSystem6eActor;
    CONFIG.Item.documentClass = HeroSystem6eItem;
    CONFIG.Token.documentClass = HeroSystem6eTokenDocument;
    CONFIG.Token.objectClass = HeroSystem6eToken;
    CONFIG.MeasuredTemplate.objectClass = HeroSystem6eMeasuredTemplate;
    CONFIG.ActiveEffect.documentClass = HeroSystem6eActorActiveEffects;
    if (foundry.canvas.placeables) {
        CONFIG.Token.rulerClass = HeroTokenRuler; //V13
        CONFIG.Token.rulerClass.applyHeroMovementConfig();
    }
    CONFIG.Canvas.rulerClass = HeroRuler; // END Use & calculateVelocityInSystemUnits

    CONFIG.Canvas.visionSourceClass = HeroPointVisionSource;

    Object.assign(CONFIG.ActiveEffect.dataModels, {
        // REF: https://foundryvtt.wiki/en/development/api/DataModel
        base: HeroSystem6eActorActiveEffectsSystemData,
    });

    Object.assign(CONFIG.Actor.dataModels, {
        automaton: HeroActorModel,
        computer: HeroActorModel,
        pc: HeroActorModel,
        npc: HeroActorModel,
    });

    Object.assign(CONFIG.Item.dataModels, {
        // The keys are the types defined in our template.json
        power: HeroSystem6eItemPower,
        equipment: HeroSystem6eItemEquipment,
        skill: HeroSystem6eItemSkill,
        maneuver: HeroSystem6eItemManeuver,
        talent: HeroSystem6eItemTalent,
        perk: HeroSystem6eItemPerk,
        martialart: HeroSystem6eItemMartialArt,
        disadvantage: HeroSystem6eItemDisadvantage,
        complication: HeroSystem6eItemComplication,
        misc: HeroSystem6eItemTypeDataModelMisc,
        characteristic: HeroItemCharacteristic,
    });

    HeroRuler.initialize();

    SettingsHelpers.initLevelSettings();

    initializeHandlebarsHelpers();
    initializeItemHandlebarsHelpers();

    // Register sheet application classes
    FoundryVttActors.unregisterSheet("core", FoundryVttActorSheet);
    FoundryVttActors.registerSheet("herosystem6e", HeroSystemActorSheet, {
        makeDefault: true,
    });
    FoundryVttActors.registerSheet("herosystem6e", HeroSystemActorSavuoriSheet, {
        makeDefault: false,
    });
    FoundryVttItems.unregisterSheet("core", FoundryVttItemSheet);
    FoundryVttItems.registerSheet("herosystem6e", HeroSystem6eItemSheet, {
        makeDefault: true,
    });

    //Not sure why ActiveEffect.registerSheet is missing.
    FoundryVttDocumentSheetConfig.registerSheet(ActiveEffect, "herosystem6e", HeroSystemActiveEffectConfig, {
        makeDefault: true,
        label: "HeroSystemActiveEffectConfig",
    });

    const templatePaths = [
        `systems/${HEROSYS.module}/templates/item/item-common-partial.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-effects-partial.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-attack-partial.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-sheet-partial.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-partial-active-points.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-partial-adders-modifiers.hbs`,
        `systems/${HEROSYS.module}/templates/item/item-partial-common.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-attacks.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-characteristics.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-defenses.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-martialarts.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-martialarts-item.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-maneuvers.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-movement.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-other.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-other-perks.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-other-talents.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-other-complications.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-other-effects.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-other-top.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-powers.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-powers-item.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-skills.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-equipment.hbs`,
        `systems/${HEROSYS.module}/templates/actor/actor-sheet-partial-equipment-item.hbs`,
        `systems/${HEROSYS.module}/templates/actor/active-effect-config.hbs`,
        // `systems/${HEROSYS.module}/templates/sidebar/partials/document-partial.hbs`,
        `systems/${HEROSYS.module}/templates/system/effects-panel.hbs`,
        `systems/${HEROSYS.module}/templates/system/hero-generic-roller.hbs`,
        `systems/${HEROSYS.module}/templates/chat/defense-tags-partial.hbs`,
        `systems/${HEROSYS.module}/templates/combat/header.hbs`,
        `systems/${HEROSYS.module}/templates/combat/tracker.hbs`,
        `systems/${HEROSYS.module}/templates/combat/tracker-single.hbs`,
        `systems/${HEROSYS.module}/templates/combat/footer.hbs`,
    ];
    // Handlebars Templates and Partials
    foundryVttLoadTemplates(templatePaths);

    // Assign the Sidebar subclasses
    CONFIG.ui.items = HeroSystem6eItemDirectory;
    CONFIG.ui.compendium = HeroSystem6eCompendiumDirectory;
    HeroSystem6eCombatTracker.initializeTemplate();
    CONFIG.ui.combat = HeroSystem6eCombatTracker;

    GenericRoller.Initialize();
    HeroSocketHandler.Initialize();

    // Insert EffectsPanel template into DOM tree so it can render
    if (parseInt(game.version.split(".")[0] || 0) === 12) {
        // Template element for effects-panel
        const ui = document.querySelector("#ui-top");
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
        ui.notifications.warn(
            'The Core FoundryVTT setting, "Square Grid Diagonals", needs to be "Exact (√2)" for correct measurement and behavior for scenes with square grids.',
            { permanent: true },
        );
    }
});

// The renderChatMessage hook is deprecated. Please use renderChatMessageHTML instead, which now passes an HTMLElement argument instead of jQuery.
// Deprecated since Version 13
// Backwards-compatible support will be removed in Version 15
if (isGameV13OrLater()) {
    Hooks.on("renderChatMessageHTML", (app, html, data) => {
        // Display action buttons
        chat.displayChatActionButtons(app, $(html), data);
        //HeroSystem6eCardHelpers.onMessageRendered($(html));
    });
} else {
    Hooks.on("renderChatMessage", (app, html, data) => {
        // Display action buttons
        chat.displayChatActionButtons(app, html, data);
        //HeroSystem6eCardHelpers.onMessageRendered(html);
    });
}

// Hooks.on("renderChatLog", (app, html) => HeroSystem6eCardHelpers.chatListeners(html));
// Hooks.on("renderChatPopout", (app, html) => HeroSystem6eCardHelpers.chatListeners(html));

// When actor SPD is changed we need to setupTurns again
Hooks.on("updateActor", async (document, change /*, _options, _userId */) => {
    if (
        change?.system?.characteristics?.spd?.value ||
        change?.system?.characteristics?.dex?.value ||
        change?.system?.characteristics?.ego?.value ||
        change?.system?.characteristics?.int?.value ||
        change?.system?.initiativeCharacteristic
    ) {
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
    // Make sure active token is centered in combat tracker when changing Sidebar
    if (app.tabName === "combat" && game.combat?.active && app.scrollToTurn) {
        app.scrollToTurn();
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

async function CreateCustomAttack(actor) {
    if (!actor) return ui.notifications.error("You must select token or actor");
    await Dialog.prompt({
        content: `<h1>${actor.name}</h1><label>Enter Item Data</label><textarea rows="20" cols="200">
{
    "name": "Custom Attack",
    "system": {
    "modifiers": [],
    "end": 1,
    "adders": [],
    "XMLID": "ENERGYBLAST",
    "ALIAS": "Blast",
    "LEVELS": {
        "value": "1",
        "max": "1"
    },
    "MULTIPLIER": "1.0",
    "basePointsPlusAdders": 5,
    "activePoints": 5,
    "realCost": 2,
    "subType": "attack",
    "class": "energy",
    "killing": false,
    "knockbackMultiplier": 1,
    "targets": "dcv",
    "uses": "ocv",
    "usesStrength": true,
    "areaOfEffect": {
        "type": "none",
        "value": 0
    },
    "piercing": 0,
    "penetrating": 0,
    "ocv": "+0",
    "dcv": "+0",
    "stunBodyDamage": "Stun and Body"
    }
}

</textarea>`,
        callback: async function (html) {
            let value = html.find("textarea").val();
            try {
                let json = JSON.parse(value);
                console.log(json);
                json.type = "attack";

                let item = await Item.create(json, { parent: actor });
                item.updateItemDescription();
                return ui.notifications.info(`Added ${item.name} to ${actor.name}`);
            } catch (e) {
                return ui.notifications.error(e);
            }
        },
    });
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
    let item = actor
        ? actor.items.find(
              (i) => i.name === itemName && (!itemType || i.type == itemType || i.system.subType === itemType),
          )
        : null;

    // The selected actor does not have an item with this name.
    if (!item) {
        item = null;
        // Search all owned tokens for this item
        for (let token of canvas.tokens.ownedTokens) {
            actor = token.actor;
            item = actor.items.find(
                (i) => i.name === itemName && (!itemType || i.type == itemType || i.system.subType === itemType),
            );
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

// The default Foundry cone angle is 53.13 degrees.
// This will set the default angle to 60 degrees.
// REF: https://github.com/dmdorman/hero6e-foundryvtt/issues/40
Hooks.on("setup", () => (CONFIG.MeasuredTemplate.defaults.angle = 60));

Hooks.on("setup", async () => {
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
        migrateWorld();

        // Update lastMigration
        await game.settings.set(game.system.id, "lastMigration", game.system.version.replace("-alpha", ""));
    }

    // Testing
    window.HeroSystem6eEndToEndTest = new HeroSystem6eEndToEndTest();
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

    // rename base2 to base (v11)
    let base2 = html[0].querySelector("option[value*='base2']");
    if (base2) base2.text = base2.text.replace("2", "");
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

    // Change Type
    if (game.user.isGM) {
        let element = document.createElement("a");
        element.setAttribute(`data-id`, data.actor.id);
        element.title = data.actor.type.toUpperCase().replace("2", "");
        element.addEventListener("click", (event) => {
            const actor = game.actors.get(event.target.dataset.id);
            actor.changeType();
        });

        element.innerHTML = `<i class="fal fa-user-robot"></i>${data.actor?.system?.CHARACTER?.TEMPLATE?.replace("builtIn.", "").replace(".hdt", "") || "Type"}`;

        html.find("header h4").after(element);
    }
});

Hooks.on("renderItemSheet", (dialog, html) => {
    html.find("header h4").append(`<span>${game.system.version}<span>`);
});

Hooks.on("getActorDirectoryEntryContext", (_dialog, html) => {
    const menu = {
        name: "Change Type",
        icon: '<i class="fas fa-cog"></i>',
        callback: async function (target) {
            const dataset = { ...target[0].dataset };
            const actor = game.actors.get(dataset.entryId);
            return actor.changeType();
        },
    };
    html.push(menu);
});

//Modify TokenHUD (need 3 bars: end, stun, body)
// Hooks.on("renderTokenHUD", HeroSystem6eTokenHud);
// Hooks.on("renderTokenConfig", extendTokenConfig);

// Expire ActiveEffects
let secondsSinceRecovery = 0;
let lastDate = 0;

/**
 * Handle follow-up actions when the official World time is changed
 * @param {number} worldTime      The new canonical World time.
 * @param {object} options        Options passed from the requesting client where the change was made
 * @param {string} userId         The ID of the User who advanced the time
 */
Hooks.on("updateWorldTime", async (worldTime, options) => {
    //console.log(`updateWorldTime`, game.time.worldTime);
    const start = Date.now();

    // Ensure that this only runs for 1 user to we don't have multiple user attempting to
    // initiate actions. For simplicity we will limit it to the GM.
    if (!game.user.isGM) return;
    if (!lastDate) game.user.getFlag(game.system.id, "lastDate") || 0;

    let deltaSeconds = parseInt(options || 0);
    secondsSinceRecovery += deltaSeconds;

    const multiplier = Math.floor(secondsSinceRecovery / 12);
    secondsSinceRecovery = Math.max(0, secondsSinceRecovery - secondsSinceRecovery * multiplier);

    // Charges and Body use days
    const dt = new Date(worldTime * 1000);
    dt.setHours(0);
    dt.setMinutes(0);
    dt.setSeconds(0);
    dt.setMilliseconds(0);
    const today = dt.valueOf();

    // All actors plus any unlinked actors in active scene
    const actors = Array.from(game.actors);
    const currentTokens = game.scenes.current?.tokens || [];
    for (const token of currentTokens) {
        if (token.actor && (!token.actorLink || !actors.find((o) => o.id === token.actor.id))) {
            actors.push(token.actor);
        }
    }

    for (const actor of actors) {
        try {
            // Create a natural body healing if needed (requires permissions)
            const naturalBodyHealing = actor.temporaryEffects.find(
                (o) => o.flags[game.system.id]?.XMLID === "naturalBodyHealing",
            );
            if (
                actor.type === "pc" &&
                !naturalBodyHealing &&
                parseInt(actor.system.characteristics.body.value) < parseInt(actor.system.characteristics.body.max)
            ) {
                const bodyPerMonth = parseInt(actor.system.characteristics.rec.value);
                const secondsPerBody = Math.floor(2.628e6 / bodyPerMonth);
                const activeEffect = {
                    name: `Natural Body Healing (${bodyPerMonth}/month)`,
                    id: "naturalBodyHealing",
                    img: `systems/${HEROSYS.module}/icons/heartbeat.svg`,
                    duration: {
                        seconds: secondsPerBody,
                    },
                    flags: {
                        [`${game.system.id}`]: {
                            XMLID: "naturalBodyHealing",
                            expiresOn: "segmentStart",
                        },
                    },
                };
                await actor.addActiveEffect(activeEffect);
            }

            // Active Effects
            // When in combat we expire effects on onStartTurn, but for some async reason gameTime cause issues if they are first in the segment.
            // So we will expireEffects here if this actor is the current combatant.
            // if (
            //     !actor.inCombat ||
            //     game.combats.viewed.combatant?.actorId === actor.id ||
            //     actor.temporaryEffects.find((o) => o.name === "TakeRecovery")
            // ) {
            //     if (actor.inCombat) {
            //         console.debug(`calling expireEffects for ${actor.name} who is inCombat`);
            //     }
            //     await expireEffects(actor);
            // } else {
            //     if (actor.inCombat) {
            //         // We are only expiring temporary effects in expireEffects.
            //         // Drains should expire on worldTime regardless of combat status, which we currently don't do.
            //         console.debug(
            //             `skipping expireEffects for ${actor.name} who is inCombat. ${game.combats.viewed.combatant?.actorId !== actor.id ? "Not active combatant" : ""}`,
            //         );
            //     }
            // }
            // Always expire effects
            // AARON: We are now expecting flags[game.system.id].expiresOn property
            await expireEffects(actor, "segment");

            // Out of combat recovery.  When SimpleCalendar is used to advance time.
            // This simple routine only handles increments of 12 seconds or more.
            const automation = game.settings.get(HEROSYS.module, "automation");
            if (
                !actor.inCombat &&
                (automation === "all" ||
                    (automation === "npcOnly" && actor.type == "npc") ||
                    (automation === "pcEndOnly" && actor.type === "pc")) &&
                getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "END") &&
                multiplier > 0
            ) {
                if (
                    parseInt(actor.system.characteristics.end.value) < parseInt(actor.system.characteristics.end.max) ||
                    parseInt(actor.system.characteristics.stun.value) < parseInt(actor.system.characteristics.stun.max)
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

                    if (actor.type === "pc" || parseInt(actor.system.characteristics.stun.value) > -10) {
                        const rec = parseInt(actor.system.characteristics.rec.value) * multiplier;
                        const endValue = Math.min(
                            parseInt(actor.system.characteristics.end.max),
                            parseInt(actor.system.characteristics.end.value) + rec,
                        );
                        const stunValue = Math.min(
                            parseInt(actor.system.characteristics.stun.max),
                            parseInt(actor.system.characteristics.stun.value) + rec,
                        );

                        await actor.removeActiveEffect(HeroSystem6eActorActiveEffects.statusEffectsObj.stunEffect);

                        await actor.update(
                            {
                                "system.characteristics.end.value": endValue,
                                "system.characteristics.stun.value": stunValue,
                            },
                            { render: true },
                        );
                    }
                }

                // END RESERVE
                for (const item of actor.items.filter((o) => o.system.XMLID === "ENDURANCERESERVE")) {
                    const ENDURANCERESERVEREC = item.findModsByXmlid("ENDURANCERESERVEREC");
                    if (ENDURANCERESERVEREC) {
                        const newValue = Math.min(
                            item.system.max,
                            item.system.value + parseInt(ENDURANCERESERVEREC.LEVELS * multiplier),
                        );
                        if (newValue > item.system.value) {
                            await item.update({
                                "system.value": newValue,
                            });
                        }
                    }
                }
            }

            // Update Flash name?
            const flashEffects = actor.temporaryEffects.filter((o) =>
                ["FLASH", "MANEUVER"].includes(o.flags[game.system.id]?.XMLID),
            );
            for (const flashAe of flashEffects) {
                const senseAffectingItem = fromUuidSync(flashAe.origin);

                // Double check maneuver to make sure it is a flash
                if (
                    senseAffectingItem?.system.XMLID === "MANEUVER" &&
                    !senseAffectingItem?.system.EFFECT.includes("FLASH")
                ) {
                    break;
                }
                if (senseAffectingItem) {
                    const d = flashAe._prepareDuration();
                    if (d.remaining > 0) {
                        const newName = `${senseAffectingItem.system.XMLID.replace(
                            "MANEUVER",
                            senseAffectingItem.system.ALIAS,
                        )} ${senseAffectingItem.system.OPTIONID} ${d.remaining} segments remaining [${senseAffectingItem.actor.name}]`;
                        flashAe.update({ name: newName });
                    } else {
                        const cardHtml = `${flashAe.name.replace(/\d+ segments remaining/, "")} has expired.`;
                        const chatData = {
                            //author: game.user._id,
                            content: cardHtml,
                            speaker: ChatMessage.getSpeaker({ actor }),
                        };
                        await ChatMessage.create(chatData);

                        await flashAe.delete();
                    }
                }
            }

            // Power Toggles with charges
            // Aaron was unable to make the AE transfer from item to actor and also expire, so we handle them here.
            // There is an opportunity to improve/refactor this.
            for (const aeWithCharges of actor.temporaryEffects.filter((o) =>
                o.parent instanceof HeroSystem6eItem ? o.parent.findModsByXmlid("CONTINUING") : false,
            )) {
                if (!aeWithCharges.parent.isActive) {
                    console.error(`${aeWithCharges.name} is inactive and will not expire.`);
                    continue;
                }
                if (
                    game.time.worldTime >=
                    aeWithCharges.flags[game.system.id]?.startTime + aeWithCharges.duration.seconds
                ) {
                    await aeWithCharges.parent.toggle();
                } else {
                    if (game.ready) game[HEROSYS.module].effectPanel.refresh();
                }
            }
        } catch (e) {
            console.error(e, actor, actor?.temporaryEffects[0]);
        }
    }

    if (today != lastDate) {
        lastDate = today;
        game.user.setFlag(game.system.id, "lastDate", lastDate);
    }

    // If there are lots of actors updateWorldTime may result in performance issues.
    // Notify GM when this is a concern.
    const deltaMs = Date.now() - start;
    if (game.settings.get(game.system.id, "alphaTesting") && deltaMs > 100) {
        ui.notifications.warn(
            `updateWorldTime took ${deltaMs} ms.  This routine handles adjustment fades and END/BODY recovery for all actors, and all tokens on this scene.  If this occurs on a regular basis, then there may be a performance issue that needs to be addressed by the developer.`,
        );
    }
});

// If compendium is created you have to reload to get the new application class.
// This is known issue https://discord.com/channels/170995199584108546/670336275496042502/1255649814096511107
Hooks.once("setup", function () {
    console.log(`Hooks.on "setup"`);
    // Apply custom application for Compendiums for parent/child features
    game.packs.filter((p) => p.metadata.type === "Item").forEach((p) => (p.applicationClass = HeroSystem6eCompendium));
});

Hooks.on("getCombatTrackerEntryContext", function (html, menu) {
    const entry = {
        name: "COMBAT.CombatantRemoveHero",
        icon: '<i class="fas fa-trash"></i>',
        callback: (li) => {
            const combat = game.combats.viewed;
            const combatant = combat.combatants.get(li.data("combatant-id"));
            const tokenId = combatant?.tokenId;
            if (tokenId) {
                const combatantIds = combat.combatants.reduce((ids, c) => {
                    if (tokenId === c.tokenId) ids.push(c.id);
                    return ids;
                }, []);
                return combat.deleteEmbeddedDocuments("Combatant", combatantIds);
            }
        },
    };
    menu.findSplice((o) => o.name === "COMBAT.CombatantRemove");
    menu.push(entry);
});
