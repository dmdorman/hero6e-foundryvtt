// Import Modules
import { HERO } from "./config.mjs";
import { HeroSystem6eActor } from "./actor/actor.mjs";
import { HeroSystemActorSheet } from "./actor/actor-sheet.mjs";
import { HeroSystemActorSavuoriSheet } from "./actor/actor-savuori-sheet.mjs";

import {
    HeroSystem6eToken,
    HeroSystem6eTokenDocument,
} from "./actor/actor-token.mjs";
import {
    HeroSystem6eItem,
    initializeItemHandlebarsHelpers,
} from "./item/item.mjs";
import { HeroSystem6eItemSheet } from "./item/item-sheet.mjs";
//import { HeroSystem6eItem2Sheet } from "./item/item2-sheet.mjs";
import * as chat from "./chat.mjs";
import * as macros from "./macros.mjs";
import { HeroSystem6eCardHelpers } from "./card/card-helpers.mjs";
import { HeroSystem6eActorActiveEffects } from "./actor/actor-active-effects.mjs";
import HeroSystem6eMeasuredTemplate from "./measuretemplate.mjs";
import { HeroSystem6eCombat } from "./combat.mjs";
import { HeroSystem6eCombatTracker } from "./combatTracker.mjs";
import SettingsHelpers from "./settings/settings-helpers.mjs";
import { HeroSystem6eTokenHud } from "./bar3/tokenHud.mjs";
import { extendTokenConfig } from "./bar3/extendTokenConfig.mjs";
import { HeroRuler } from "./ruler.mjs";
import { initializeHandlebarsHelpers } from "./handlebars-helpers.mjs";
import {
    // getPowerInfo,
    expireEffects,
    getCharacteristicInfoArrayForActor,
} from "./utility/util.mjs";
import { migrateWorld } from "./migration.mjs";
import // performAdjustment,
// renderAdjustmentChatCards,
"./utility/adjustment.mjs";

import "./utility/chat-dice.mjs";

import "./testing/testing-main.mjs";

Hooks.once("init", async function () {
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
        macros: macros,
        rollItemMacro: rollItemMacro,
        CreateCustomAttack: CreateCustomAttack,
        config: HERO,
    };

    CONFIG.HERO = HERO;

    CONFIG.Combat.documentClass = HeroSystem6eCombat;
    CONFIG.Combat.defeatedStatusId = "dead";

    // V11 now support ActiveEffects on items without
    // the need to transfer the effect to the actor.
    CONFIG.ActiveEffect.legacyTransferral = false;

    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula:
            "@characteristics.dex.value + (@characteristics.spd.value / 100)",
        decimals: 2,
    };

    // debug
    // CONFIG.debug.hooks = true;

    // Define custom Entity classes
    CONFIG.Actor.documentClass = HeroSystem6eActor;
    CONFIG.Item.documentClass = HeroSystem6eItem;
    CONFIG.Token.documentClass = HeroSystem6eTokenDocument;
    CONFIG.Token.objectClass = HeroSystem6eToken;
    CONFIG.MeasuredTemplate.objectClass = HeroSystem6eMeasuredTemplate;
    // We can't use the information from system.json in a static context; so we change the load path here.
    CONFIG.statusEffects = HeroSystem6eActorActiveEffects.getEffects(
        HEROSYS.module,
    );

    CONFIG.ActiveEffect.documentClass = HeroSystem6eActorActiveEffects;
    CONFIG.ui.combat = HeroSystem6eCombatTracker;

    CONFIG.Canvas.rulerClass = HeroRuler;

    SettingsHelpers.initLevelSettings();

    initializeHandlebarsHelpers();
    initializeItemHandlebarsHelpers();

    // Register sheet application classes
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("herosystem6e", HeroSystemActorSheet, {
        makeDefault: true,
    });
    Actors.registerSheet("herosystem6e", HeroSystemActorSavuoriSheet, {
        makeDefault: false,
    });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("herosystem6e", HeroSystem6eItemSheet, {
        makeDefault: true,
    });
    // Items.registerSheet("herosystem6e", HeroSystem6eItem2Sheet, {
    //     makeDefault: false,
    // });

    // If you need to add Handlebars helpers, here are a few useful examples:
    Handlebars.registerHelper("concat", function () {
        var outStr = "";
        for (var arg in arguments) {
            if (typeof arguments[arg] != "object") {
                outStr += arguments[arg];
            }
        }
        return outStr;
    });

    Handlebars.registerHelper("toLowerCase", function (str) {
        return str?.toLowerCase();
    });

    Handlebars.registerHelper("toUpperCase", function (str) {
        return str?.toUpperCase();
    });

    Handlebars.registerHelper("is_active_segment", function (actives, index) {
        return actives?.[index];
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
    ];
    // Handlebars Templates and Partials
    loadTemplates(templatePaths);
});

Hooks.once("ready", async function () {
    // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
    Hooks.on("hotbarDrop", (bar, data, slot) =>
        createHeroSystem6eMacro(bar, data, slot),
    );

    if (
        typeof SimpleCalendar != "undefined" &&
        game.user.isGM &&
        SimpleCalendar.api.getCurrentCalendar().general
            .gameWorldTimeIntegration != "mixed"
    ) {
        console.log(
            SimpleCalendar.api.getCurrentCalendar().general
                .gameWorldTimeIntegration,
        );
        return ui.notifications.warn(
            `Recommend setting Simple Calendar GameWorldTimeIntegration = Mixed`,
        );
    }
});

Hooks.on("renderChatMessage", (app, html, data) => {
    // Display action buttons
    chat.displayChatActionButtons(app, html, data);
    HeroSystem6eCardHelpers.onMessageRendered(html);
});
Hooks.on("renderChatLog", (app, html) =>
    HeroSystem6eCardHelpers.chatListeners(html),
);
Hooks.on("renderChatPopout", (app, html) =>
    HeroSystem6eCardHelpers.chatListeners(html),
);

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
                if (combat.combatants.find((o) => o.actorId === document.id)) {
                    // Reroll Initiative (based on new spd/dex/ego/int changes)
                    await combat.rollAll();

                    // Setup Turns in combat tracker based on new spd/dex/ego/int changes)
                    // Should no longer be needed now that SPD is part of initiative (handled via rollAll/combat:rollInitiative)
                    //await combat.setupTurns();
                }
            }
        }
    }
});

Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
    registerPackageDebugFlag(HEROSYS.ID);
});

export class HEROSYS {
    static ID = "HEROSYS";

    static #module = undefined;

    static get module() {
        if (HEROSYS.#module === undefined) {
            console.error(`HEROSYS.module accessed before it is assigned`);
            ui.notifications.error(
                `HEROSYS.module accessed before it is assigned`,
            );
        }
        return HEROSYS.#module;
    }

    static set module(value) {
        if (HEROSYS.#module !== undefined) {
            console.error(`HEROSYS.module assigned after it is assigned`);
            ui.notifications.error(
                `HEROSYS.module accessed before it is assigned`,
            );
        }
        HEROSYS.#module = value;
    }

    static log(force, ...args) {
        const shouldLog =
            force || game.settings.get(game.system.id, "alphaTesting");

        if (shouldLog) {
            console.log(this.ID, "|", ...args);
        }
    }

    static trace(force, ...args) {
        const shouldTrace =
            force || game.settings.get(game.system.id, "alphaTesting");

        if (shouldTrace) {
            console.trace(this.ID, "|", ...args);
        }
    }
}

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
    let macro = game.macros.find(
        (m) =>
            m.command === command && m.name === item.name && m.img === item.img,
    );
    if (!macro) {
        macro = await Macro.create({
            name: item.name,
            type: "script",
            img: item.img,
            command: command,
            flags: { "herosystem6e.itemMacro": true },
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
    "dice": 1,
    "extraDice": "zero",
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
    "stunBodyDamage": "stunbody"
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
                return ui.notifications.info(
                    `Added ${item.name} to ${actor.name}`,
                );
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
              (i) =>
                  i.name === itemName &&
                  (!itemType ||
                      i.type == itemType ||
                      i.system.subType === itemType),
          )
        : null;

    // The selected actor does not have an item with this name.
    if (!item) {
        item = null;
        // Search all owned tokens for this item
        for (let token of canvas.tokens.ownedTokens) {
            actor = token.actor;
            item = actor.items.find(
                (i) =>
                    i.name === itemName &&
                    (!itemType ||
                        i.type == itemType ||
                        i.system.subType === itemType),
            );
            if (item) {
                break;
            }
        }

        if (!item)
            return ui.notifications.warn(
                `Your controlled Actor does not have an ${
                    itemType || "item"
                } named ${itemName}`,
            );
    }

    // Trigger the item roll
    return item.roll();
}

// The default Foundry cone angle is 53.13 degrees.
// This will set the default angle to 60 degrees.
// REF: https://github.com/dmdorman/hero6e-foundryvtt/issues/40
Hooks.on("setup", () => (CONFIG.MeasuredTemplate.defaults.angle = 60));

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

    if (
        foundry.utils.isNewerVersion(
            game.system.version.replace("-alpha", ""),
            lastMigration,
        )
    ) {
        migrateWorld();

        // Update lastMigration
        await game.settings.set(
            game.system.id,
            "lastMigration",
            game.system.version.replace("-alpha", ""),
        );
    }
});

// New Actor Dialog
Hooks.on("renderDialog", (dialog, html) => {
    if (
        html[0].querySelector(".window-title").textContent !=
            "Create New Actor" &&
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
    html.find("header h4").append(`<span>${game.system.version}</span>`);

    try {
        if (data?.actor?.system?.versionHeroSystem6eUpload) {
            html.find("header h4").append(
                ` <span title='Actor version at time of HDC upload'>(${
                    data?.actor?.system?.versionHeroSystem6eUpload || ""
                })</span>`,
            );
        }
    } catch (err) {
        console.log(err);
    }

    let element = document.createElement("a");
    element.setAttribute(`data-id`, data.actor.id);
    element.title = data.actor.type.toUpperCase().replace("2", "");
    element.addEventListener("click", () => {
        const actor = game.actors.get(event.target.dataset.id);
        actor.ChangeType();
    });

    element.innerHTML = `<i class="fal fa-user-robot"></i>Type`;

    html.find("header h4").after(element);
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
            return actor.ChangeType();
        },
    };
    html.push(menu);
});

//Modify TokenHUD (need 3 bars: end, stun, body)
Hooks.on("renderTokenHUD", HeroSystem6eTokenHud);
Hooks.on("renderTokenConfig", extendTokenConfig);

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
    const start = new Date();

    // Ensure that this only runs for 1 user to we don't have multiple user attempting to
    // initiate actions. For simplicity we will limit it to the GM.
    if (!game.user.isGM) return;
    if (!lastDate) game.user.getFlag(game.system.id, "lastDate") || 0;

    let deltaSeconds = parseInt(options || 0);
    secondsSinceRecovery += deltaSeconds;

    const multiplier = Math.floor(secondsSinceRecovery / 12);
    secondsSinceRecovery = Math.max(
        0,
        secondsSinceRecovery - secondsSinceRecovery * multiplier,
    );

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
        if (
            token.actor &&
            (!token.actorLink || !actors.find((o) => o.id === token.actor.id))
        ) {
            actors.push(token.actor);
        }
    }

    for (const actor of actors) {
        try {
            // Create a natural body healing if needed (requires permissions)
            const naturalBodyHealing = actor.temporaryEffects.find(
                (o) => o.flags.XMLID === "naturalBodyHealing",
            );
            if (
                actor.type === "pc" &&
                !naturalBodyHealing &&
                parseInt(actor.system.characteristics.body.value) <
                    parseInt(actor.system.characteristics.body.max)
            ) {
                const bodyPerMonth = parseInt(
                    actor.system.characteristics.rec.value,
                );
                const secondsPerBody = Math.floor(2.628e6 / bodyPerMonth);
                const activeEffect = {
                    name: `Natural Body Healing (${bodyPerMonth}/month)`,
                    id: "naturalBodyHealing",
                    icon: `systems/${HEROSYS.module}/icons/heartbeat.svg`,
                    duration: {
                        seconds: secondsPerBody,
                    },
                    flags: {
                        XMLID: "naturalBodyHealing",
                    },
                };
                await actor.addActiveEffect(activeEffect);
            }

            //let adjustmentChatMessages = [];

            // Active Effects
            if (!actor.inCombat) {
                await expireEffects(actor);
            }

            // for (const ae of actor.temporaryEffects) {
            //     // Determine XMLID, ITEM, ACTOR
            //     let origin = await fromUuid(ae.origin);
            //     let item = origin instanceof HeroSystem6eItem ? origin : null;
            //     let aeActor =
            //         origin instanceof HeroSystem6eActor
            //             ? origin
            //             : item?.actor || actor;
            //     let XMLID = ae.flags.XMLID || item?.system?.XMLID;

            //     let powerInfo = getPowerInfo({
            //         actor: aeActor,
            //         xmlid: XMLID,
            //         item: item,
            //     });

            //     if (
            //         !powerInfo &&
            //         ae.statuses.size === 0 &&
            //         game.settings.get(game.system.id, "alphaTesting") &&
            //         ae.duration?.seconds < 3.154e7 * 100
            //     ) {
            //         return ui.notifications.warn(
            //             `Unable to determine XMLID for ${ae.name} active effect.`,
            //         );
            //     }

            //     // With Simple Calendar you can move time ahead in large steps.
            //     // Need to loop as multiple fades may be required.
            //     let d = ae._prepareDuration();
            //     while (d.remaining != null && d.remaining <= 0) {
            //         // Add duration to startTime
            //         ae.duration.startTime += d.duration;
            //         d = ae._prepareDuration();
            //         await ae.update({ duration: ae.duration });

            //         // What is this effect related to?
            //         if (ae.flags.type === "adjustment") {
            //             // Fade by 5 Active Points
            //             let _fade;
            //             if (ae.flags.adjustmentActivePoints < 0) {
            //                 _fade = Math.max(
            //                     ae.flags.adjustmentActivePoints,
            //                     -5,
            //                 );
            //             } else {
            //                 _fade = Math.min(
            //                     ae.flags.adjustmentActivePoints,
            //                     5,
            //                 );
            //             }

            //             if (item) {
            //                 adjustmentChatMessages.push(
            //                     await performAdjustment(
            //                         item,
            //                         ae.flags.target[0],
            //                         -_fade,
            //                         "None - Effect Fade",
            //                         "",
            //                         true,
            //                         actor,
            //                     ),
            //                 );
            //             } else {
            //                 // The item must have been deleted which makes it impossible to properly adjust the
            //                 // adjustment power. Just delete it and soldier on.
            //                 ui.notifications.warn(
            //                     `The originating item ${ae.origin} of adjustment ${ae.name} appears to have been deleted. Deleting adjustment's active effect.`,
            //                 );
            //                 ae.delete();
            //                 break;
            //             }

            //             // TODO: FIXME: Dirty hack. If the amount remaining in the active effect is 0 we know that
            //             // performAdjustment has deleted the active effect. In this case exit the loop so that
            //             // we don't keep operating on an old view of a deleted active effect.
            //             // Healing doesn't fade. The lockout just ends which guarantees a deleted effect.
            //             if (
            //                 ae.flags.adjustmentActivePoints === 0 ||
            //                 ae.flags.XMLID === "HEALING"
            //             ) {
            //                 break;
            //             }
            //         } else if (ae.flags.XMLID === "naturalBodyHealing") {
            //             let bodyValue = parseInt(
            //                 actor.system.characteristics.body.value,
            //             );
            //             let bodyMax = parseInt(
            //                 actor.system.characteristics.body.max,
            //             );
            //             bodyValue = Math.min(bodyValue + 1, bodyMax);

            //             await actor.update({
            //                 "system.characteristics.body.value": bodyValue,
            //             });

            //             if (bodyValue === bodyMax) {
            //                 ae.delete();
            //                 break;
            //             }
            //         } else {
            //             // Default is to delete the expired AE
            //             if (powerInfo) {
            //                 await ae.delete();
            //                 break;
            //             }
            //         }
            //     }
            // }

            // await renderAdjustmentChatCards(adjustmentChatMessages);
            // adjustmentChatMessages = [];

            // Out of combat recovery.  When SimpleCalendar is used to advance time.
            // This simple routine only handles increments of 12 seconds or more.
            const automation = game.settings.get(HEROSYS.module, "automation");
            if (
                !actor.inCombat &&
                (automation === "all" ||
                    (automation === "npcOnly" && actor.type == "npc") ||
                    (automation === "pcEndOnly" && actor.type === "pc")) &&
                getCharacteristicInfoArrayForActor(actor).find(
                    (o) => o.key === "END",
                ) &&
                multiplier > 0
            ) {
                if (
                    parseInt(actor.system.characteristics.end.value) <
                        parseInt(actor.system.characteristics.end.max) ||
                    parseInt(actor.system.characteristics.stun.value) <
                        parseInt(actor.system.characteristics.stun.max)
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

                    if (
                        actor.type === "pc" ||
                        parseInt(actor.system.characteristics.stun.value) > -10
                    ) {
                        const rec =
                            parseInt(actor.system.characteristics.rec.value) *
                            multiplier;
                        const endValue = Math.min(
                            parseInt(actor.system.characteristics.end.max),
                            parseInt(actor.system.characteristics.end.value) +
                                rec,
                        );
                        const stunValue = Math.min(
                            parseInt(actor.system.characteristics.stun.max),
                            parseInt(actor.system.characteristics.stun.value) +
                                rec,
                        );

                        await actor.removeActiveEffect(
                            HeroSystem6eActorActiveEffects.stunEffect,
                        );

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
                for (const item of actor.items.filter(
                    (o) => o.system.XMLID === "ENDURANCERESERVE",
                )) {
                    const ENDURANCERESERVEREC = item.findModsByXmlid(
                        "ENDURANCERESERVEREC",
                    );
                    if (ENDURANCERESERVEREC) {
                        const newValue = Math.min(
                            item.system.max,
                            item.system.value +
                                parseInt(
                                    ENDURANCERESERVEREC.LEVELS * multiplier,
                                ),
                        );
                        if (newValue > item.system.value) {
                            await item.update({
                                "system.value": newValue,
                            });
                        }
                    }
                }
            }

            // Charges Recover each day
            if (today > lastDate) {
                const itemsWithCharges = actor.items.filter(
                    (item) => item.system.charges?.max,
                );
                let content = "";
                for (const item of itemsWithCharges) {
                    let value = parseInt(item.system.charges.value);
                    let max = parseInt(item.system.charges.max);
                    if (value < max) {
                        content += `${actor.name}/${item.name} ${value} to ${max} charges.  `;
                        item.update({ "system.charges.value": max });
                    }
                }

                if (content) {
                    const chatData = {
                        user: game.user.id, //ChatMessage.getWhisperRecipients('GM'),
                        whisper: [
                            ...ChatMessage.getWhisperRecipients(actor.name),
                            ...ChatMessage.getWhisperRecipients("GM"),
                        ],
                        speaker: ChatMessage.getSpeaker({ actor: actor }),
                        blind: true,
                        content: content,
                    };
                    //await
                    ChatMessage.create(chatData);
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
    const deltaMs = new Date() - start;
    if (game.settings.get(game.system.id, "alphaTesting") && deltaMs > 100) {
        ui.notifications.warn(
            `updateWorldTime took ${deltaMs} ms.  This routine handles adjustment fades and END/BODY recovery for all actors, and all tokens on this scene.  If this occurs on a regular basis, then there may be a performance issue that needs to be addressed by the developer.`,
        );
    }
});
