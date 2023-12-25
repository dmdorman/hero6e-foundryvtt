import { HeroSystem6eItem } from "./item/item.js";
import { getPowerInfo } from "./utility/util.js";

function getAllActorsInGame() {
    return [
        ...game.actors.contents,
        ...game.scenes.contents
            .map((scene) => scene.tokens)
            .map((token) => token.actorLink)
            .filter((actorLink) => actorLink),
    ];
}

export async function migrateWorld() {
    const lastMigration = game.settings.get(game.system.id, "lastMigration");

    // Don't bother trying to migrate an world with no actors or items
    if (game.actors.size === 0 && game.items.size === 0) return;

    // if lastMigration < 2.2.0-alpha
    if (foundry.utils.isNewerVersion("2.2.0", lastMigration)) {
        await ui.notifications.info(`Migrating actor data 2.2.0`);
        //migrateActorTypes()
        migrateKnockback();
        migrateRemoveDuplicateDefenseMovementItems();
    }

    // if lastMigration < 3.0.0-alpha
    if (foundry.utils.isNewerVersion("3.0.0", lastMigration)) {
        await ui.notifications.info(`Migrating actor data 3.0.0`);
        for (let actor of game.actors.contents) {
            await oldForMigrationOnly_updateItemSubTypes(actor, true);
        }
    }

    // if lastMigration < 3.0.4
    // Remove all transferred effects
    if (foundry.utils.isNewerVersion("3.0.4", lastMigration)) {
        await ui.notifications.info(`Migrating actor data 3.0.4`);
        for (let actor of game.actors.contents) {
            for (let effect of actor.effects.filter((o) => o.origin)) {
                await effect.delete();
            }
        }
    }

    // if lastMigration < 3.0.9
    // Charges
    if (foundry.utils.isNewerVersion("3.0.9", lastMigration)) {
        await ui.notifications.info(`Migrating actor data 3.0.9`);
        for (let actor of game.actors.contents) {
            for (let item of actor.items.filter(
                (o) => (o.system.end || "").toString().indexOf("[") === 0,
            )) {
                let _end = item.system.end;
                let _charges = parseInt(_end.match(/\d+/) || 0);
                if (_charges) {
                    const charges = {
                        value: _charges,
                        max: _charges,
                        recoverable: _end.indexOf("rc") > -1 ? true : false,
                    };
                    await item.update({
                        "system.end": 0,
                        "system.charges": charges,
                    });
                }
            }
        }
    }

    // if lastMigration < 3.0.15
    // Martial Arts and missing XMLID
    if (foundry.utils.isNewerVersion("3.0.15", lastMigration)) {
        await ui.notifications.info(`Migrating actor data  3.0.15`);
        for (let actor of game.actors.contents) {
            try {
                for (let item of actor.items) {
                    let changes = {};

                    // Martial Arts
                    if (item.type === "maneuver" && !item.system.XMLID) {
                        let entry = CONFIG.HERO.combatManeuvers[item.name];
                        //if (!entry) entry = CONFIG.HERO.combatManeuversOptional[item.name];
                        if (entry) {
                            //const name = entry[0];
                            const v = entry;
                            const PHASE = v[0];
                            const OCV = v[1];
                            const DCV = v[2];
                            const EFFECT = v[3];
                            const attack = v[4];

                            item.system = {
                                ...item.system,
                                PHASE,
                                OCV,
                                DCV,
                                EFFECT,
                                active: false,
                                description: EFFECT,
                                XMLID: item.name.toUpperCase().replace(" ", ""), // A fake XMLID
                                adders: [],
                                modifiers: [],
                                powers: [],
                            };

                            if (attack) {
                                await item.makeAttack();
                            }
                            changes["system"] = item.system;
                        }
                    }

                    // Missing XMLID
                    if (!item.system.XMLID) {
                        if (
                            item.type === "skill" &&
                            item.name === "Perception"
                        ) {
                            item.system.XMLID = "PERCEPTION";
                            item.system.adders ??= [];
                            item.system.modifiers ??= [];
                            item.system.powers ??= [];
                            item.system.description = "";
                            changes["system"] = item.system;
                        } else if (item.type === "movement") {
                            item.system.XMLID = (
                                item.system.type || item.system.class
                            ).toUpperCase();
                            changes["system.XMLID"] = item.system.XMLID;
                        } else if (item.system.rules) {
                            item.system.XMLID = item.system.rules;
                            changes["system.XMLID"] = item.system.XMLID;
                        } else if (item.type === "attack") {
                            // Has been empty for quite some time. Presumably nothing to migrate
                            // and want to intentionally do nothing.
                        } else {
                            let fakeItem = {
                                system: foundry.utils.deepClone(item.system),
                            };
                            fakeItem.system.XMLID = item.name.toUpperCase();
                            let configPowerInfo = getPowerInfo({
                                item: fakeItem,
                            });
                            if (!configPowerInfo) {
                                fakeItem.system.XMLID =
                                    fakeItem.system.XMLID.replace(/ /g, "_")
                                        .replace("(", "")
                                        .replace(")", "");
                                configPowerInfo = getPowerInfo({
                                    item: fakeItem,
                                });
                            }
                            if (!configPowerInfo) {
                                fakeItem.system.XMLID =
                                    fakeItem.system.XMLID.replace("SKILL_", "");
                                configPowerInfo = getPowerInfo({
                                    item: fakeItem,
                                });
                            }
                            if (!configPowerInfo) {
                                if (fakeItem.system.XMLID === "TF")
                                    fakeItem.system.XMLID =
                                        "TRANSPORT_FAMILIARITY";
                                if (fakeItem.system.XMLID === "WF")
                                    fakeItem.system.XMLID =
                                        "WEAPON_FAMILIARITY";
                                configPowerInfo = getPowerInfo({
                                    item: fakeItem,
                                });
                            }
                            if (
                                configPowerInfo &&
                                configPowerInfo.powerType.includes(item.type)
                            ) {
                                item.system.XMLID = configPowerInfo.xmlid;
                                changes["system.XMLID"] = item.system.XMLID;
                            } else {
                                // Not enough info to make a good guess
                                //console.log(item.name, fakeItem.system.XMLID, item.system);
                            }
                        }
                    }

                    if (Object.keys(changes).length > 0) {
                        await item.update(changes, { hideChatMessage: true });
                    }
                }
            } catch (e) {
                console.log(e);
            }
        }
    }

    // Fix any invalid actor types
    for (let invalidId of game.actors.invalidDocumentIds) {
        let invalidActor = game.actors.getInvalid(invalidId);

        const validType = Actor.TYPES.filter(
            (o) => o != "character" && o != "base",
        ).map((o) => o.replace("2", ""));

        if (!validType.includes(invalidActor.type)) {
            await invalidActor.update({ type: "npc" });
            await ui.notifications.error(
                `${invalidActor.name} had an invalid actor type.  It was changed to 'npc'.  Reload world to access token.`,
            );
        }
    }

    // if lastMigration < 3.0.35
    // Overhaul of data structure.  Raw HDC upload (all uppercase props)
    if (foundry.utils.isNewerVersion("3.0.35", lastMigration)) {
        let d = new Date();
        let queue = [];

        ui.notifications.info(`Migrating actor data 3.0.35`);
        for (const actor of game.actors.contents) {
            queue.push(actor);
        }

        for (const scene of game.scenes.contents) {
            for (const token of scene.tokens) {
                if (!token.actorLink) {
                    queue.push(token.actor);
                }
            }
        }

        while (queue.length > 0) {
            if (new Date() - d > 4000) {
                ui.notifications.info(
                    `Migrating actor data 3.0.35 (${queue.length} remaining)`,
                );
                d = new Date();
            }
            const actor = queue.pop();
            await migrateActor_3_0_35(actor);
        }
    }

    // if lastMigration < 3.0.42
    // Overhaul of data structure.  Raw HDC upload (all uppercase props)
    if (foundry.utils.isNewerVersion("3.0.42", lastMigration)) {
        let d = new Date();
        let queue = [];

        ui.notifications.info(`Migrating actor data 3.0.42`);
        for (const actor of game.actors.contents) {
            queue.push(actor);
        }

        for (const scene of game.scenes.contents) {
            for (const token of scene.tokens) {
                if (!token.actorLink) {
                    queue.push(token.actor);
                }
            }
        }

        while (queue.length > 0) {
            if (new Date() - d > 4000) {
                ui.notifications.info(
                    `Migrating actor data 3.0.35 (${queue.length} remaining)`,
                );
                d = new Date();
            }
            const actor = queue.pop();
            await migrateActor_3_0_42(actor);
        }
    }

    // if lastMigration < 3.0.49
    // 5e maneuvers with velocity are half of 6e
    if (foundry.utils.isNewerVersion("3.0.49", lastMigration)) {
        let d = new Date();
        let queue = [];

        ui.notifications.info(`Migrating actor data 3.0.49`);
        for (const actor of game.actors.contents) {
            queue.push(actor);
        }

        for (const scene of game.scenes.contents) {
            for (const token of scene.tokens) {
                if (!token.actorLink) {
                    queue.push(token.actor);
                }
            }
        }

        while (queue.length > 0) {
            if (new Date() - d > 4000) {
                ui.notifications.info(
                    `Migrating actor data 3.0.49 (${queue.length} remaining)`,
                );
                d = new Date();
            }
            const actor = queue.pop();
            await migrateActor_3_0_49(actor);
        }
    }

    // if lastMigration < 3.0.53
    // Default bar3 to TRUE for existing worlds
    // All item's system.characteristic replaced with system.CHARACTERISTIC
    if (foundry.utils.isNewerVersion("3.0.53", lastMigration)) {
        console.log("bar3");
        if (!game.settings.get(game.system.id, "bar3")) {
            game.settings.set(game.system.id, "bar3", true);
            // Refresh tokens to make sure they show the 3rd bar
            for (const token of game.scenes.current.tokens) {
                token.object.refresh();
            }
        }

        const queue = getAllActorsInGame();
        let dateNow = new Date();

        for (const [index, actor] of queue.entries()) {
            if (new Date() - dateNow > 4000) {
                ui.notifications.info(
                    `Migrating actor's items to 3.0.53: (${
                        queue.length - index
                    } actors remaining)`,
                );
                dateNow = new Date();
            }

            await migrate_actor_items_to_3_0_53(actor);
        }
    }

    // Reparse all items (description, cost, etc) on every migration
    {
        let d = new Date();
        const queue = getAllActorsInGame();

        ui.notifications.info(`Migrating actor data`);

        while (queue.length > 0) {
            if (new Date() - d > 4000) {
                ui.notifications.info(
                    `Migrating actor data (${queue.length} remaining)`,
                );
                d = new Date();
            }
            const actor = queue.pop();
            await migrateActorCostDescription(actor);
        }
    }

    await ui.notifications.info(`Migrating complete.`);
}

async function migrateActorCostDescription(actor) {
    try {
        if (!actor) return false;

        if (actor.name === `Jack "Iron Shin" Daniels`)
            console.log.apply(actor.name);

        let itemsChanged = false;
        for (let item of actor.items) {
            await item._postUpload();
        }

        if (itemsChanged || !actor.system.pointsDetail) {
            const oldPointsDetail = actor.system.pointsDetail;
            await actor.CalcActorRealAndActivePoints();
            if (oldPointsDetail != actor.system.pointsDetail) {
                await actor.update(
                    {
                        "system.points": actor.system.points,
                        "system.activePoints": actor.system.activePoints,
                        "system.pointsDetail": actor.system.pointsDetail,
                    },
                    { render: false },
                    { hideChatMessage: true },
                );
            }
        }
    } catch (e) {
        console.log(e);
        if (
            game.user.isGM &&
            game.settings.get(game.system.id, "alphaTesting")
        ) {
            await ui.notifications.warn(
                `Migration failed for ${actor?.name}. Recommend re-uploading from HDC.`,
            );
        }
    }
}

async function migrate_actor_items_to_3_0_53(actor) {
    for (const item of actor.items) {
        // Get rid of item.system.characteristic and replace with
        // item.system.CHARACTERISTIC
        if (!item.system.CHARACTERISTIC && item.system.characteristic) {
            await item.update({
                "system.CHARACTERISTIC":
                    item.system.characteristic.toUpperCase(),
            });
        }

        if (item.system.characteristic) {
            await item.update({
                "system.-=characteristic": null,
            });
        }

        // In the past, we filled in item.system.NAME based on item.system.ALIAS.
        // We no longer need this as our visualizations should be decoupled from data.
        if (
            item.system.NAME?.toUpperCase().trim() ===
                item.system.ALIAS?.toUpperCase().trim() &&
            item.name.toUpperCase().trim() ===
                item.system.ALIAS?.toUpperCase().trim()
        ) {
            await item.update({
                "system.NAME": "",
            });
        }
    }
}

async function migrateActor_3_0_35(actor) {
    try {
        if (!actor) return;
        for (let item of actor.items) {
            let changes = {};

            // LEVELS is now the raw number from HDC file and value/max are working numbers
            if (item.system.LEVELS?.value || item.system.LEVELS?.value === 0) {
                changes["system.value"] = item.system.LEVELS.value;
                changes["system.max"] = item.system.LEVELS.max;
                changes["system.LEVELS"] = item.system.LEVELS.max;
            }

            // POWER, MODIFIER, ADDER
            if (item.system.powers) {
                for (const m of item.system.powers) {
                    if (m.modifiers) {
                        m.MODIFIER = m.modifiers;
                    }
                    if (m.adders) {
                        m.ADDER = m.adders;
                    }
                }
                changes["system.POWER"] = item.system.powers;
            }
            if (item.system.modifiers) {
                for (const m of item.system.modifiers) {
                    if (m.modifiers) {
                        m.MODIFIER = m.modifiers;
                    }
                    if (m.adders) {
                        m.ADDER = m.adders;
                    }
                }
                changes["system.MODIFIER"] = item.system.modifiers;
            }
            if (item.system.adders) {
                for (const m of item.system.adders) {
                    if (m.modifiers) {
                        m.MODIFIER = m.modifiers;
                    }
                    if (m.adders) {
                        m.ADDER = m.adders;
                    }
                }
                changes["system.ADDER"] = item.system.adders;
            }

            await item.update(changes, { hideChatMessage: true });
        }
    } catch (e) {
        console.log(e);
        if (
            game.user.isGM &&
            game.settings.get(game.system.id, "alphaTesting")
        ) {
            await ui.notifications.warn(
                `Migration failed for ${actor?.name}. Recommend re-uploading from HDC.`,
            );
        }
    }
}

async function migrateActor_3_0_42(actor) {
    try {
        if (!actor) return;

        for (let item of actor.items) {
            let changes = {};

            // LEVELS is now the raw number from HDC file and value/max are working numbers
            if (typeof item.system.LEVELS === "object") {
                changes["system.value"] = parseInt(item.system.LEVELS.value);
                changes["system.max"] = parseInt(item.system.LEVELS.max);
                changes["system.LEVELS"] = item.system.LEVELS.max;
            }

            // POWER, MODIFIER, ADDER
            if (item.system.powers && !item.system.POWER) {
                for (const m of item.system.powers) {
                    if (m.modifiers) {
                        m.MODIFIER = m.modifiers;
                    }
                    if (m.adders) {
                        m.ADDER = m.adders;
                    }
                }
                changes["system.POWER"] = item.system.powers;
            }
            if (item.system.modifiers && !item.system.MODIFIER) {
                for (const m of item.system.modifiers) {
                    if (m.modifiers) {
                        m.MODIFIER = m.modifiers;
                    }
                    if (m.adders) {
                        m.ADDER = m.adders;
                    }
                }
                changes["system.MODIFIER"] = item.system.modifiers;
            }
            if (item.system.adders && !item.system.ADDER) {
                for (const m of item.system.adders) {
                    if (m.modifiers) {
                        m.MODIFIER = m.modifiers;
                    }
                    if (m.adders) {
                        m.ADDER = m.adders;
                    }
                }
                changes["system.ADDER"] = item.system.adders;
            }

            if (changes.length > 0) {
                await item.update(changes, { hideChatMessage: true });
            }
        }
    } catch (e) {
        console.log(e);
        if (
            game.user.isGM &&
            game.settings.get(game.system.id, "alphaTesting")
        ) {
            await ui.notifications.warn(
                `Migration failed for ${actor?.name}. Recommend re-uploading from HDC.`,
            );
        }
    }
}

async function migrateActor_3_0_49(actor) {
    try {
        if (!actor) return;
        if (!actor.system.is5e) return;

        for (let item of actor.items.filter((o) => o.type === "maneuver")) {
            let entry = CONFIG.HERO.combatManeuvers[item.name];
            if (!entry) {
                for (let key of Object.keys(CONFIG.HERO.combatManeuvers)) {
                    if (
                        key.toUpperCase().replace(" ", "") ===
                        item.name.toUpperCase().replace(" ", "")
                    ) {
                        entry = CONFIG.HERO.combatManeuvers[key];
                        await item.update({ name: key });
                        break;
                    }
                }
            }
            if (entry) {
                const EFFECT = entry[3];
                let newEffect = EFFECT;
                if (EFFECT.match(/v\/(\d+)/)) {
                    let divisor = EFFECT.match(/v\/(\d+)/)[1];
                    newEffect = EFFECT.replace(
                        `v/${divisor}`,
                        `v/${divisor / 2}`,
                    );
                }
                if (item.system.EFFECT != newEffect) {
                    await item.update({ "system.EFFECT": newEffect });
                }
                const attack = entry[4];
                if (attack && item.system.subType != "attack") {
                    await item.makeAttack();
                }
            } else {
                if (["Multiple Attack", "Other Attacks"].includes(item.name)) {
                    await item.delete();
                } else {
                    if (
                        game.user.isGM &&
                        game.settings.get(game.system.id, "alphaTesting")
                    ) {
                        await ui.notifications.warn(
                            `Migration failed for ${actor?.name}. ${item.name} not recognized.`,
                        );
                    }
                }
            }
        }
    } catch (e) {
        console.log(e);
        if (
            game.user.isGM &&
            game.settings.get(game.system.id, "alphaTesting")
        ) {
            await ui.notifications.warn(
                `Migration failed for ${actor?.name}. Recommend re-uploading from HDC.`,
            );
        }
    }
}

async function migrateRemoveDuplicateDefenseMovementItems() {
    ui.notifications.info(`Migrating actor data.`);

    let count = 0;
    for (let actor of game.actors.contents) {
        if (await migrateActorDefenseMovementData(actor)) count++;
    }

    ui.notifications.info(`${count} actors migrated.`);
}

async function migrateActorDefenseMovementData(actor) {
    let itemsToDelete = [];

    // Place a migrationTag in the actor with today's date.
    // This allows us to skip this migration in the future.
    // Specifically it allows custom defenses to be manually added
    // without deleting it eveytime world loads.
    //if (actor.system.migrationTag != migrationTag) {
    for (let item of actor.items.filter(
        (o) => o.type == "defense" || o.type == "movement",
    )) {
        // Try not to delete items that have been manually created.
        // We can make an educated guess by looking for XMLID
        if (
            item.system.xmlid ||
            item.system.XMLID ||
            item.system.rules == "COMBAT_LUCK" ||
            item.type == "movement"
        ) {
            itemsToDelete.push(item.id);
        }
    }

    // Apply AE to movement items
    let itemsToCreate = [];
    for (let item of actor.items) {
        const configPowerInfo = getPowerInfo({ item: item });
        if (configPowerInfo && configPowerInfo.powerType.includes("movement")) {
            // You can't just add AE to items owned by actor. A flaw in Foundry v10.
            // So we will create a new item with proper AE, then delete the old item.
            let itemData = item.toJSON();
            itemData.system.active = true;
            oldForMigrationOnly_createEffects(itemData, actor);
            itemsToCreate.push(itemData);
            itemsToDelete.push(item.id);
        }
    }

    await actor.deleteEmbeddedDocuments("Item", itemsToDelete);
    await HeroSystem6eItem.create(itemsToCreate, { parent: actor });

    return itemsToDelete.length > 0;
}

// Change Attack knockback to knockbackMultiplier
async function migrateKnockback() {
    let updates = [];
    for (let actor of game.actors) {
        for (let item of actor.items) {
            if (item.type === "attack") {
                if (
                    item.system.knockback &&
                    parseInt(item.system.knockbackMultiplier) == 0
                ) {
                    updates.push({
                        _id: item.id,
                        system: { knockbackMultiplier: 1, knockback: null },
                    });
                }
            }
        }
        if (updates.length > 0) {
            await Item.updateDocuments(updates, { parent: actor });
            ui.notifications.info(
                `${updates.length} attacks migrated for ${actor.name}.`,
            );
            updates = [];
        }
    }
}

export async function oldForMigrationOnly_makeAttack(item) {
    ui.notifications.warn(`Old makeAttack(${item.name}) called.`);

    const xmlid = item.system.XMLID || item.system.xmlid || item.system.rules;

    // Confirm this is an attack
    const configPowerInfo = getPowerInfo({ xmlid: xmlid, actor: item.actor });

    let changes = {};

    // Name
    let description = item.system.ALIAS;
    let name =
        item.system.NAME ||
        description ||
        configPowerInfo?.xmlid ||
        item.system.name ||
        item.name;
    changes[`name`] = name;

    let levels =
        parseInt(item.system.LEVELS?.value) || parseInt(item.system.DC) || 0;
    const input = item.system.INPUT;

    const ocv =
        parseInt(item.system.ocv) ||
        parseInt(item.system.OCV) ||
        item.system.OCV ||
        0;
    const dcv =
        parseInt(item.system.dcv) ||
        parseInt(item.system.DCV) ||
        item.system.DCV ||
        0;

    // Check if this is a MARTIAL attack.  If so then EXTRA DC's may be present
    if (item.system.XMLID == "MANEUVER") {
        let EXTRADC = null;

        // HTH
        if (item.system.CATEGORY == "Hand To Hand") {
            EXTRADC = item.actor.items.find(
                (o) =>
                    o.system.XMLID == "EXTRADC" &&
                    o.system.ALIAS.indexOf("HTH") > -1,
            );
        }
        // Ranged is not implemented yet

        // Extract +2 HTH Damage Class(es)
        if (EXTRADC) {
            let match = EXTRADC.system.ALIAS.match(/\+\d+/);
            if (match) {
                levels += parseInt(match[0]);
            }
        }
    }

    // Check if TELEKINESIS + WeaponElement (BAREHAND) + EXTRADC  (WillForce)
    if (item.system.XMLID == "TELEKINESIS") {
        if (
            item.actor.items.find(
                (o) =>
                    o.system.XMLID == "WEAPON_ELEMENT" &&
                    o.system.adders.find((o) => o.XMLID == "BAREHAND"),
            )
        ) {
            let EXTRADC = item.actor.items.find(
                (o) =>
                    o.system.XMLID == "EXTRADC" &&
                    o.system.ALIAS.indexOf("HTH") > -1,
            );
            // Extract +2 HTH Damage Class(es)
            if (EXTRADC) {
                let match = EXTRADC.system.ALIAS.match(/\+\d+/);
                if (match) {
                    levels += parseInt(match[0]) * 5; // Below we take these levels (as STR) and determine dice
                }
            }
        }
    }

    // Active cost is required for endurance calculation.
    // It should include all advantages (which we don't handle very well at the moment)
    // However this should be calculated during power upload (not here)
    // let activeCost = (levels * 5)
    // let end = Math.round(activeCost / 10 - 0.01);
    //changes[`system.activeCost`] = activeCost

    changes[`system.subType`] = "attack";
    changes[`system.class`] = input === "ED" ? "energy" : "physical";
    changes[`system.dice`] = levels;
    changes[`system.extraDice`] = "zero";
    changes[`system.killing`] = false;
    changes[`system.knockbackMultiplier`] = 1;
    changes[`system.targets`] = "dcv";
    changes[`system.uses`] = "ocv";
    changes[`system.usesStrength`] = true;
    changes[`system.areaOfEffect`] = { type: "none", value: 0 };
    changes[`system.piercing`] = 0;
    changes[`system.penetrating`] = 0;
    changes[`system.ocv`] = ocv;
    changes[`system.dcv`] = dcv;
    changes["system.stunBodyDamage"] = "stunbody";

    // BLOCK and DODGE typically do not use STR
    if (["maneuver", "martialart"].includes(item.type)) {
        if (
            item.system.EFFECT?.toLowerCase().indexOf("block") > -1 ||
            item.system.EFFECT?.toLowerCase().indexOf("dodge") > -1
        ) {
            changes[`system.usesStrength`] = false;
        }
    }

    // ENTANGLE (not implemented)
    if (xmlid == "ENTANGLE") {
        changes[`system.class`] = "entangle";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
        changes[`system.knockbackMultiplier`] = 0;
    }

    // DARKNESS (not implemented)
    if (xmlid == "DARKNESS") {
        changes[`system.class`] = "darkness";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // IMAGES (not implemented)
    if (xmlid == "IMAGES") {
        changes[`system.class`] = "images";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // DRAIN (not implemented)
    if (xmlid == "DRAIN") {
        changes[`system.class`] = "drain";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // AID (not implemented)
    if (xmlid == "AID") {
        changes[`system.class`] = "aid";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // TRANSFER
    if (xmlid == "TRANSFER") {
        changes[`system.class`] = "transfer";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // MINDSCAN
    if (xmlid == "MINDSCAN") {
        changes[`system.class`] = "mindscan";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // DISPEL
    if (xmlid == "DISPEL") {
        changes[`system.class`] = "dispel";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // MENTALBLAST
    if (xmlid == "EGOATTACK") {
        changes[`system.class`] = "mental";
        changes[`system.targets`] = "dmcv";
        changes[`system.uses`] = "omcv";
        changes[`system.knockbackMultiplier`] = 0;
        changes[`system.usesStrength`] = false;
        changes["system.stunBodyDamage"] = "stunonly";
        changes["system.noHitLocations"] = true;
    }

    // MINDCONTROL
    if (xmlid == "MINDCONTROL") {
        changes[`system.class`] = "mindcontrol";
        changes[`system.targets`] = "dmcv";
        changes[`system.uses`] = "omcv";
        changes[`system.knockbackMultiplier`] = 0;
        changes[`system.usesStrength`] = false;
        changes["system.stunBodyDamage"] = "stunonly";
        changes["system.noHitLocations"] = true;
    }

    // CHANGEENVIRONMENT
    if (xmlid == "CHANGEENVIRONMENT") {
        changes[`system.class`] = "change enviro";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // FLASH
    if (xmlid == "FLASH") {
        changes[`system.class`] = "flash";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // AVAD
    const avad = item.system?.modifiers
        ? item.system.modifiers.find((o) => o.XMLID === "AVAD")
        : null;
    if (avad) {
        changes[`system.class`] = "avad";
    }

    // Armor Piercing
    let ARMORPIERCING = item.system.modifiers.find(
        (o) => o.XMLID == "ARMORPIERCING",
    );
    if (ARMORPIERCING) {
        changes[`system.piercing`] = parseInt(ARMORPIERCING.LEVELS);
    }

    // Penetrating
    let PENETRATING = item.system.modifiers.find(
        (o) => o.XMLID == "PENETRATING",
    );
    if (PENETRATING) {
        changes[`system.penetrating`] = parseInt(PENETRATING.LEVELS);
    }

    // No Knockback
    let NOKB = item.system.modifiers.find((o) => o.XMLID == "NOKB");
    if (NOKB) {
        changes[`system.knockbackMultiplier`] = 0;
    }

    // Double Knockback
    let DOUBLEKB = item.system.modifiers.find((o) => o.XMLID == "DOUBLEKB");
    if (DOUBLEKB) {
        changes[`system.knockbackMultiplier`] = 2;
    }

    // Explosion
    if (item.hasExplosionAdvantage()) {
        if (game.settings.get(game.system.id, "alphaTesting")) {
            ui.notifications.warn(
                `EXPLOSION not implemented during HDC upload of ${item.actor.name}`,
            );
        }
    }

    // Alternate Combat Value (uses OMCV against DCV)
    let ACV = item.system.modifiers.find((o) => o.XMLID == "ACV");
    if (ACV) {
        if (ACV.OPTION_ALIAS === "uses OMCV against DCV") {
            changes[`system.uses`] = "omcv";
            changes[`system.targets`] = "dcv";
        }
        if (ACV.OPTION_ALIAS === "uses OCV against DMCV") {
            changes[`system.uses`] = "ocv";
            changes[`system.targets`] = "dmcv";
        }
        if (ACV.OPTION_ALIAS === "uses OMCV against DCV") {
            changes[`system.uses`] = "omcv";
            changes[`system.targets`] = "dcv";
        }
    }

    if (
        item.system.adders &&
        item.system.adders.find((o) => o.XMLID == "PLUSONEPIP")
    ) {
        changes[`system.extraDice`] = "pip";
    }

    if (
        item.system.adders &&
        item.system.adders.find((o) => o.XMLID == "PLUSONEHALFDIE")
    ) {
        changes[`system.extraDice`] = "half";
    }

    if (
        item.system.adders &&
        item.system.adders.find((o) => o.XMLID == "MINUSONEPIP")
    ) {
        // Typically only allowed for killing attacks.
        //  Appears that +1d6-1 is roughly equal to +1/2 d6
        changes[`system.extraDice`] = "half";
    }

    const aoe = item.system.modifiers.find((o) => o.XMLID == "AOE");
    if (aoe) {
        changes[`system.areaOfEffect`] = {
            type: aoe.OPTION_ALIAS.toLowerCase(),
            value: parseInt(aoe.LEVELS),
        };
    }

    if (xmlid === "HKA" || item.system.EFFECT?.indexOf("KILLING") > -1) {
        changes[`system.killing`] = true;

        // Killing Strike uses DC=2 which is +1/2d6.
        // For now just recalculate that, but ideally rework this function to use DC instead of dice.
        let pips = parseInt(item.system.DC || item.system.LEVELS.value * 3);
        changes["system.dice"] = Math.floor(pips / 3);
        if (pips % 3 == 1) {
            changes["system.extraDice"] = "pip";
        }
        if (pips % 3 == 2) {
            changes["system.extraDice"] = "half";
        }
    }

    if (xmlid === "TELEKINESIS") {
        // levels is the equivalent strength
        changes[`system.extraDice`] = "zero";
        changes[`system.dice`] = 0;
        changes[`system.extraDice`] = "zero";
        changes[`name`] = name + " (TK strike)";
        changes[`system.usesStrength`] = false;
        changes[`system.usesTk`] = true;
    }

    if (xmlid === "ENERGYBLAST") {
        changes[`system.usesStrength`] = false;
    }

    if (xmlid === "RKA") {
        changes[`system.killing`] = true;
        changes[`system.usesStrength`] = false;
    }

    const noStrBonus = item.system.modifiers.find(
        (o) => o.XMLID == "NOSTRBONUS",
    );
    if (noStrBonus) {
        changes[`system.usesStrength`] = false;
    }

    const stunOnly = item.system.modifiers.find((o) => o.XMLID == "STUNONLY");
    if (stunOnly) {
        changes["system.stunBodyDamage"] = "stunonly";
    }

    if (item._id) {
        await item.update(changes, { hideChatMessage: true });
    }

    // Possibly a QUENCH test
    for (let change of Object.keys(changes).filter((o) => o != "_id")) {
        let target = item;
        for (let key of change.split(".")) {
            if (typeof target[key] == "object") {
                target = target[key];
            } else {
                target[key] = changes[change];
            }
        }
    }
}

export async function oldForMigrationOnly_createEffects(itemData, actor) {
    const configPowerInfo = getPowerInfo({
        xmlid: itemData.system.XMLID || itemData.system.rules,
        actor: actor || this?.actor,
    });

    // Not every powers will have effects
    if (!configPowerInfo) return;
    if (!configPowerInfo?.powerType) return;

    const xmlid = configPowerInfo.xmlid;
    const key = xmlid.toLowerCase();

    // Characteristics (via ActiveEffects)
    if (configPowerInfo?.powerType?.includes("characteristic")) {
        let levels = itemData.system.LEVELS?.value;
        // Add LEVELS to MAX
        let activeEffect = {
            name: `${key.toUpperCase()}+${levels}`,
            origin: itemData.uuid,
            //id: newPower.system.rules,
            icon: "icons/svg/upgrade.svg",
            changes: [
                {
                    key: "system.characteristics." + key + ".max",
                    value: parseInt(levels),
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ],
            flags: {
                XMLID: xmlid.toUpperCase() || itemData.system.XMLID,
            },
            disabled: !itemData.system.AFFECTS_TOTAL,
            transfer: true,
        };
        if (
            activeEffect.name
                .toLowerCase()
                .indexOf(itemData.name.toLowerCase()) == -1
        ) {
            activeEffect.name = itemData.name + " " + activeEffect.name;
        }

        itemData.effects = [activeEffect];
        return;
    }

    // Movement Powers
    if (configPowerInfo?.powerType?.includes("movement")) {
        const key = itemData.system.XMLID.toLowerCase();
        let levels = itemData.system.LEVELS?.value;

        let activeEffect = {
            name: `${key.toUpperCase()}+${levels}`,
            icon: "icons/svg/upgrade.svg",
            changes: [
                {
                    key: `system.characteristics.${key}.max`,
                    value: parseInt(itemData.system.LEVELS?.value),
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ],
            transfer: true,
        };
        if (
            activeEffect.name
                .toLowerCase()
                .indexOf(itemData.name.toLowerCase()) == -1
        ) {
            activeEffect.name = itemData.name + " " + activeEffect.name;
        }

        itemData.effects = [activeEffect];
        return;
    }

    if (xmlid === "DENSITYINCREASE") {
        const levels = parseInt(parseInt(itemData.system.LEVELS?.value));

        const strAdd = Math.floor(levels) * 5;
        const pdAdd = Math.floor(levels);
        const edAdd = Math.floor(levels);

        let activeEffect = {
            name: itemData.name,
            icon: "icons/svg/upgrade.svg",
            changes: [
                {
                    key: "system.characteristics.str.max",
                    value: strAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    key: "system.characteristics.pd.max",
                    value: pdAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    key: "system.characteristics.ed.max",
                    value: edAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ],
            transfer: true,
        };

        itemData.effects = [activeEffect];
        return;
    }
}

async function oldForMigrationOnly_updateItemSubTypes(actor, removeDups) {
    // Update Item SubType
    for (const item of actor.items) {
        const configPowerInfo = getPowerInfo({ item: item });

        // Defenses
        if (configPowerInfo && configPowerInfo.powerType?.includes("defense")) {
            await item.update(
                { "system.subType": "defense", "system.showToggle": true },
                { hideChatMessage: true },
            );
        }

        // Is this a movement power?
        if (
            configPowerInfo &&
            configPowerInfo.powerType?.includes("movement")
        ) {
            await item.update(
                { "system.subType": "movement", "system.showToggle": true },
                { hideChatMessage: true },
            );
        }

        // Is this an attack power?
        if (configPowerInfo && configPowerInfo.powerType?.includes("attack")) {
            if (item.system.subType != "attack" || !item.system.dice) {
                await oldForMigrationOnly_makeAttack(item);
                await item.update(
                    { "system.subType": "attack", "system.showToggle": true },
                    { hideChatMessage: true },
                );
            }
        }

        // Remove duplicate attacks
        if (removeDups && item.type == "attack") {
            const power = actor.items.find(
                (o) => o.name == item.name && o.system.subType == "attack",
            );
            if (power) {
                await item.delete();
            }
        }

        // Skills
        if (configPowerInfo && configPowerInfo.powerType?.includes("skill")) {
            await item.update(
                { "system.subType": "skill" },
                { hideChatMessage: true },
            );
        }
    }
}
