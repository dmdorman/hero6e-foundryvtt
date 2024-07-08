import { HeroSystem6eItem } from "./item/item.mjs";
import { determineCostPerActivePoint } from "./utility/adjustment.mjs";
import { RoundFavorPlayerUp } from "./utility/round.mjs";
import { HeroProgressBar } from "./utility/progress-bar.mjs";
import { HeroSystem6eActor } from "./actor/actor.mjs";
import { CreateHeroCompendiums } from "./heroCompendiums.mjs";

function getAllActorsInGame() {
    return [
        ...game.actors.contents,
        ...game.scenes.contents
            .map((scene) => scene.tokens)
            .map((token) => token.actorLink)
            .filter((actorLink) => actorLink),
    ];
}

let skippedBecauseOld = 0;

async function migrateToVersion(migratesToVersion, lastMigration, queue, queueType, asyncFn) {
    if (!lastMigration || foundry.utils.isNewerVersion(migratesToVersion, lastMigration)) {
        const originalTotal = queue.length;
        const migrationProgressBar = new HeroProgressBar(
            `Migrating ${originalTotal} ${queueType} to ${migratesToVersion}`,
            originalTotal + 1,
        );

        while (queue.length > 0) {
            const queueElement = queue.pop();

            migrationProgressBar.advance(
                `Migrating ${queueType} ${originalTotal - queue.length} of ${originalTotal} to ${migratesToVersion}`,
            );

            // Skip super old actors without versionHeroSystem6eUpload
            if (queueElement instanceof HeroSystem6eActor) {
                if (!queueElement.system?.versionHeroSystem6eUpload) {
                    // Wel hold on a sec what about actors created without uploads?
                    if (
                        !foundry.utils.isNewerVersion(
                            queueElement.system.versionHeroSystem6eCreated || "0.0.0",
                            "3.0.34",
                        )
                    ) {
                        skippedBecauseOld++;

                        if (skippedBecauseOld < 3) {
                            ui.notifications.warn(
                                `The Actor "${queueElement.name}" was uploaded with an older HeroSystem version and is no longer supported.  Please re-upload from HDC.`,
                            );
                        } else {
                            if (skippedBecauseOld === 3) {
                                ui.notifications.warn(
                                    `Several additional actors are no longer supported.  Please re-upload them from their HDCs.`,
                                );
                            }
                            console.warn(
                                `The Actor "${queueElement.name}" was uploaded with an older HeroSystem version and has limited support.  Please re-upload from HDC.`,
                            );
                        }
                        continue;
                    }
                }
            }

            await asyncFn(queueElement);
        }

        migrationProgressBar.close(`Done migrating ${originalTotal} ${queueType} to ${migratesToVersion}`);
    }
}

export async function migrateWorld() {
    const lastMigration = game.settings.get(game.system.id, "lastMigration");

    // Don't bother trying to migrate an world with no actors or items
    if (game.actors.size === 0 && game.items.size === 0) return;

    // Chat Card for GM about new version
    let content = `Version ${game.system.version} of ${game.system.name} has been installed. Details can be read at <a href="https://github.com/dmdorman/hero6e-foundryvtt/blob/main/CHANGELOG.md">Changelog</a>.<br /><br />If you find any problems, are missing things, or just would like a feature that is lacking, please report these <a href="https://github.com/dmdorman/hero6e-foundryvtt/issues">HERE</a>.<br /><br />There is also a <a href="https://discord.com/channels/609528652878839828/770825017729482772">Discord channel</a> where you can interactively communicate with others using ${game.system.name}.`;

    // if (installedVersion != "1") {
    //     content += '<h2><b>Short Summery of update:</b></h2>';
    //     content += '<ul>';
    //     content += newfunctions;
    //     content += '</ul>';
    // }
    const chatData = {
        user: game.user._id,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        content: content,
    };

    await ChatMessage.create(chatData);

    // Create or Re-create Compendium
    CreateHeroCompendiums();

    // Fix any invalid actor types
    for (let invalidId of game.actors.invalidDocumentIds) {
        let invalidActor = game.actors.getInvalid(invalidId);

        const validType = Actor.TYPES.filter((o) => o != "character" && o != "base").map((o) => o.replace("2", ""));

        if (!validType.includes(invalidActor.type)) {
            await invalidActor.update({ type: "npc" });
            await ui.notifications.error(
                `${invalidActor.name} had an invalid actor type.  It was changed to 'npc'.  Reload world to access token.`,
            );
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
                ui.notifications.info(`Migrating actor data 3.0.35 (${queue.length} remaining)`);
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
                ui.notifications.info(`Migrating actor data 3.0.49 (${queue.length} remaining)`);
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
        if (!game.settings.get(game.system.id, "bar3")) {
            game.settings.set(game.system.id, "bar3", true);
            // Refresh tokens to make sure they show the 3rd bar
            for (const token of game.scenes.current?.tokens || []) {
                token.object.refresh();
            }
        }

        const queue = getAllActorsInGame();
        let dateNow = new Date();

        for (const [index, actor] of queue.entries()) {
            if (new Date() - dateNow > 4000) {
                ui.notifications.info(`Migrating actor's items to 3.0.53: (${queue.length - index} actors remaining)`);
                dateNow = new Date();
            }

            await migrate_actor_items_to_3_0_53(actor);
        }
    }

    // if lastMigration < 3.0.54
    // Update item.system.class from specific adjustment powers to the general adjustment
    // Active Effects for adjustments changed format
    if (foundry.utils.isNewerVersion("3.0.54", lastMigration)) {
        const queue = getAllActorsInGame();
        let dateNow = new Date();

        for (const [index, actor] of queue.entries()) {
            if (new Date() - dateNow > 4000) {
                ui.notifications.info(
                    `Migrating actor's items and active effects to 3.0.54: (${queue.length - index} actors remaining)`,
                );
                dateNow = new Date();
            }

            await migrate_actor_items_to_3_0_54(actor);
            await migrate_actor_active_effects_to_3_0_54(actor);
        }
    }

    // if lastMigration < 3.0.59
    // Active Effects for adjustments changed format
    // d6-1 and 1/2d6 are now distinctly different extra dice
    if (foundry.utils.isNewerVersion("3.0.59", lastMigration)) {
        const queue = getAllActorsInGame();
        let dateNow = new Date();

        for (const [index, actor] of queue.entries()) {
            if (new Date() - dateNow > 4000) {
                ui.notifications.info(
                    `Migrating actor's active effects to 3.0.59: (${queue.length - index} actors remaining)`,
                );
                dateNow = new Date();
            }

            await migrate_actor_active_effects_to_3_0_59(actor);
            await migrate_actor_items_to_3_0_59(actor);
        }
    }

    // if lastMigration < 3.0.62
    // Correct maneuvers for 5e and 6e.
    await migrateToVersion(
        "3.0.62",
        lastMigration,
        getAllActorsInGame(),
        "actors' maneuvers",
        async (actor) => await migrate_actor_maneuvers_to_3_0_62(actor),
    );

    // if lastMigration < 3.0.63
    // move to new item.system.range values
    await migrateToVersion(
        "3.0.63",
        lastMigration,
        getAllActorsInGame(),
        "actors' items' range",
        async (actor) => await migrate_actor_items_to_3_0_63(actor),
    );

    // if lastMigration < 3.0.66
    // move to corrected new item.system.range values
    await migrateToVersion(
        "3.0.66",
        lastMigration,
        getAllActorsInGame(),
        "actors' items' range",
        async (actor) => await migrate_actor_items_to_3_0_66(actor),
    );

    // if lastMigration < 3.0.75
    // The string "false" returns true.  Very confusing.
    // Was causing issues with consuming END for INVISIBILTY each phase.
    // Removed string "false" from template.json
    await migrateToVersion(
        "3.0.75",
        lastMigration,
        getAllActorsInGame(),
        "actors' items' active/false",
        async (actor) => await migrate_actor_items_to_3_0_75(actor),
    );

    // FOR ALL VERSION MIGRATIONS
    // Reparse actors and all all their items (description, cost, etc) on every migration
    await migrateToVersion(
        game.system.version,
        undefined,
        getAllActorsInGame(),
        "rebuilding actors and their items",
        async (actor) => await rebuildActors(actor),
    );

    await ui.notifications.info(`Migration complete to ${game.system.version}`);
}

async function rebuildActors(actor) {
    try {
        if (!actor) return false;

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

        actor._postUpload();
    } catch (e) {
        console.log(e);
        if (game.user.isGM && game.settings.get(game.system.id, "alphaTesting")) {
            await ui.notifications.warn(`Migration failed for ${actor?.name}. Recommend re-uploading from HDC.`);
        }
    }
}

async function migrate_actor_items_to_3_0_75(actor) {
    for (const item of actor.items) {
        // The string "false" returns true.  Very confusing.
        // Was causing issues with consuming END for INVISIBILTY each phase.
        // Removed string "false" from template.json
        if (item.system.active === "false") {
            await item.update({
                "item.system.active": true,
            });
        }
    }
}

async function migrate_actor_items_to_3_0_66(actor) {
    for (const item of actor.items) {
        const configPowerInfo = migrationOnly_Pre_XXX_getPowerInfo({
            item: item,
        });
        if (configPowerInfo) {
            item.system.range = configPowerInfo.range;
        } else {
            continue;
        }

        // Range Modifiers "self", "no range", "standard", or "los" based on base power.
        // It is the modified up or down but the only other types that should be added are:
        // "range based on str" or "limited range"
        const ranged = !!item.findModsByXmlid("RANGED");
        const noRange = !!item.findModsByXmlid("NORANGE");
        const limitedRange =
            item.findModsByXmlid("RANGED")?.OPTIONID === "LIMITEDRANGE" || // Advantage form
            !!item.findModsByXmlid("LIMITEDRANGE"); // Limitation form
        const rangeBasedOnStrength =
            item.findModsByXmlid("RANGED")?.OPTIONID === "RANGEBASEDONSTR" || // Advantage form
            !!item.findModsByXmlid("RANGEBASEDONSTR"); // Limitation form
        const los = !!item.findModsByXmlid("LOS");
        const normalRange = !!item.findModsByXmlid("NORMALRANGE");
        const usableOnOthers = !!item.findModsByXmlid("UOO");
        const boecv = !!item.findModsByXmlid("BOECV");

        // Based on EGO combat value comes with line of sight
        if (boecv) {
            item.system.range = "los";
        }

        // Self only powers cannot be bought to have range unless they become usable on others at which point
        // they gain no range.
        if (item.system.range === "self") {
            if (usableOnOthers) {
                item.system.range = "no range";
            }
        }

        // No range can be bought to have range.
        if (item.system.range === "no range") {
            if (ranged) {
                item.system.range = "standard";
            }
        }

        // Standard range can be bought up or bought down.
        if (item.system.range === "standard") {
            if (noRange) {
                item.system.range = "no range";
            } else if (los) {
                item.system.range = "los";
            } else if (limitedRange) {
                item.system.range = "limited range";
            } else if (rangeBasedOnStrength) {
                item.system.range = "range based on str";
            }
        }

        // Line of sight can be bought down
        if (item.system.range === "los") {
            if (normalRange) {
                item.system.range = "standard";
            } else if (rangeBasedOnStrength) {
                item.system.range = "range based on str";
            } else if (limitedRange) {
                item.system.range = "limited range";
            } else if (noRange) {
                item.system.range = "no range";
            }
        }

        await item.update({
            "system.range": item.system.range,
        });
    }
}

/**
 * items now have an item.system.range property
 * @param {Object} actor
 */
async function migrate_actor_items_to_3_0_63(actor) {
    for (const item of actor.items) {
        const configPowerInfo = migrationOnly_Pre_XXX_getPowerInfo({
            item: item,
        });
        if (configPowerInfo) {
            item.system.range = configPowerInfo.range;
        } else {
            continue;
        }

        const noRange = item.findModsByXmlid("NORANGE");
        const limitedRange = item.findModsByXmlid("LIMITEDRANGE");
        const rangeBasedOnStrength = item.findModsByXmlid("RANGEBASEDONSTR");
        const los = item.findModsByXmlid("LOS");
        const normalRange = item.findModsByXmlid("NORMALRANGE");
        const noRangeModifiers = item.findModsByXmlid("NORANGEMODIFIER");
        const usableOnOthers = item.findModsByXmlid("UOO");

        // Based on EGO combat value gets line of sight by default
        const boecv = item.findModsByXmlid("BOECV");
        if (boecv) {
            item.system.range = "los";
        }

        // Self only powers cannot be bought to have range unless they become usable on others at which point
        // they gain no range.
        if (item.system.range === "self") {
            if (usableOnOthers) {
                item.system.range = "no range";
            }
        }

        // No range can be bought to have range.
        if (item.system.range === "no range") {
            const ranged = item.findModsByXmlid("RANGED");
            if (ranged) {
                item.system.range = "standard";
            }
        }

        // Standard range can be bought up or bought down.
        if (item.system.range === "standard") {
            if (noRange) {
                item.system.range = "no range";
            } else if (los) {
                item.system.range = "los";
            } else if (limitedRange) {
                item.system.range = "limited range";
            } else if (rangeBasedOnStrength) {
                item.system.range = "range based on str";
            } else if (noRangeModifiers) {
                item.system.range = "no range modifiers";
            }
        }

        // Line of sight can be bought down
        if (item.system.range === "los") {
            if (normalRange) {
                item.system.range = "limited normal range";
            } else if (rangeBasedOnStrength) {
                item.system.range = "range based on str";
            } else if (noRange) {
                item.system.range = "no range";
            }
        }

        await item.update({
            "system.range": item.system.range,
        });
    }
}

async function migrate_actor_maneuvers_to_3_0_62(actor) {
    // Delete a previous maneuvers then add all maneuvers again for the system version for this actor.
    const deletePromises = actor.items
        .filter((item) => item.type === "maneuver")
        .map(async (maneuver) => {
            return maneuver.delete();
        });
    await Promise.all(deletePromises);

    // Add all maneuvers for this actor's system version.
    const powerList = actor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;

    powerList
        .filter((power) => power.type.includes("maneuver"))
        .forEach(async (maneuver) => {
            const name = maneuver.name;
            const XMLID = maneuver.key;

            const maneuverDetails = maneuver.maneuverDesc;
            const PHASE = maneuverDetails.phase;
            const OCV = maneuverDetails.ocv;
            const DCV = maneuverDetails.dcv;
            const EFFECT = maneuverDetails.effects;

            const itemData = {
                name,
                type: "maneuver",
                system: {
                    PHASE,
                    OCV,
                    DCV,
                    EFFECT,
                    active: false, // TODO: This is probably not always true. It should, however, be generated in other means.
                    description: EFFECT,
                    XMLID,
                },
            };

            // Skip if temporary actor (Quench)
            if (actor.id) {
                const item = await HeroSystem6eItem.create(itemData, {
                    parent: actor,
                });
                if (maneuverDetails.attack) {
                    await item.makeAttack();
                }
                await item._postUpload();
            }
        });
}

// 1/2 d6 and 1d6-1 are not the same roll but are the same DC - make them distinct
async function migrate_actor_items_to_3_0_59(actor) {
    for (const item of actor.items) {
        let newValue;
        if (item.findModsByXmlid("PLUSONEHALFDIE")) {
            newValue = "half";
        } else if (item.findModsByXmlid("MINUSONEPIP")) {
            // +1d6-1 is equal to +1/2 d6 DC-wise but is uncommon.
            newValue = "one-pip";
        }

        if (item.system.extraDice && newValue) {
            await item.update({
                "system.extraDice": newValue,
            });
        }
    }
}

async function migrate_actor_active_effects_to_3_0_59(actor) {
    for (const activeEffect of actor.temporaryEffects) {
        if (activeEffect.flags?.type === "adjustment" && activeEffect.flags.version === 2) {
            const newFormatAdjustmentActiveEffect = foundry.utils.deepClone(activeEffect);

            // Rename property.
            newFormatAdjustmentActiveEffect.flags.adjustmentActivePoints = activeEffect.flags.activePoints;
            delete newFormatAdjustmentActiveEffect.flags.activePoints;

            // New property
            let activePointsThatShouldBeAffected = 0;
            const nameMatch = newFormatAdjustmentActiveEffect.name.match(/^.+ ([0-9]+) .+ \([0-9]+ AP\) \[.*\]/);
            if (nameMatch) {
                activePointsThatShouldBeAffected =
                    parseInt(nameMatch[1]) * Math.sign(newFormatAdjustmentActiveEffect.flags.adjustmentActivePoints);
            }

            newFormatAdjustmentActiveEffect.flags.affectedPoints = activePointsThatShouldBeAffected;

            // Delete old active effect and create the new one
            await activeEffect.delete();
            await actor.addActiveEffect(newFormatAdjustmentActiveEffect);
        }
    }
}

async function migrate_actor_active_effects_to_3_0_54(actor) {
    for (const activeEffect of actor.temporaryEffects) {
        // Is it possibly an old style adjustment effect?
        if (activeEffect.changes.length > 0 && activeEffect.flags.target) {
            const origin = await fromUuid(activeEffect.origin);
            const item = origin instanceof HeroSystem6eItem ? origin : null;

            const powerInfo = migrationOnly_Pre3_0_61_getPowerInfo({
                actor: actor,
                xmlid: activeEffect.flags?.XMLID,
                item: item,
            });

            // Confirm the power associated with is an adjustment power type
            if (!powerInfo || !powerInfo.powerType.includes("adjustment")) {
                continue;
            }

            // Make sure it's not a new style adjustment active effect already (just a dev possibility)
            if (activeEffect.flags.type === "adjustment") {
                continue;
            }

            const presentAdjustmentActiveEffect = activeEffect;
            const potentialCharacteristic = presentAdjustmentActiveEffect.flags.keyX;

            const costPerActivePoint = determineCostPerActivePoint(
                potentialCharacteristic,
                null, // TODO: Correct, as we don't support powers right now?
                actor,
            );
            const activePointsThatShouldBeAffected = Math.trunc(
                presentAdjustmentActiveEffect.flags.activePoints / costPerActivePoint,
            );

            // The new format differentiates between beneficial adjustments as negative activePoints whereas
            // the old format considers this value to always be >= 0.
            const activePoints =
                activeEffect.flags.XMLID === "ABSORPTION" ||
                activeEffect.flags.XMLID === "AID" ||
                activeEffect.flags.XMLID === "HEALING" ||
                (activeEffect.flags.XMLID === "TRANSFER" &&
                    activeEffect.flags.target === presentAdjustmentActiveEffect.flags.keyY)
                    ? -presentAdjustmentActiveEffect.flags.activePoints
                    : presentAdjustmentActiveEffect.flags.activePoints;

            const newFormatAdjustmentActiveEffect = {
                name: `${presentAdjustmentActiveEffect.flags.XMLID} ${Math.abs(
                    activePointsThatShouldBeAffected,
                )} ${presentAdjustmentActiveEffect.flags.target.toUpperCase()} (${Math.abs(
                    presentAdjustmentActiveEffect.flags.activePoints,
                )} AP) [by ${presentAdjustmentActiveEffect.flags.source}]`,
                id: presentAdjustmentActiveEffect.id, // No change
                icon: presentAdjustmentActiveEffect.icon, // No change
                changes: presentAdjustmentActiveEffect.changes, // No change but for 5e there may be additional indices (see below)
                duration: presentAdjustmentActiveEffect.duration, // No change even though it might be wrong for transfer it's too complicated to try to figure it out
                flags: {
                    type: "adjustment", // New
                    version: 2, // New

                    activePoints: activePoints, // Differentiate between negative and positive adjustments
                    XMLID: presentAdjustmentActiveEffect.flags.XMLID, // No change
                    source: presentAdjustmentActiveEffect.flags.source, // No change
                    target: [presentAdjustmentActiveEffect.flags.target], // Now an array
                    key: presentAdjustmentActiveEffect.flags.keyX, // Name change
                    // NOTE: Dropping keyY
                },
                origin: presentAdjustmentActiveEffect.origin, // No change
            };

            // If 5e we may have additional changes
            if (actor.system.is5e && actor.system.characteristics?.[potentialCharacteristic]) {
                if (potentialCharacteristic === "dex") {
                    const charValue = actor.system.characteristics[potentialCharacteristic].value;
                    const lift = RoundFavorPlayerUp(
                        (charValue - actor.system.characteristics[potentialCharacteristic].core) / 3,
                    );

                    newFormatAdjustmentActiveEffect.changes.push({
                        key: actor.system.characteristics[potentialCharacteristic]
                            ? `system.characteristics.ocv.max`
                            : "system.value",
                        value: lift,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    });
                    newFormatAdjustmentActiveEffect.flags.target.push("ocv");

                    newFormatAdjustmentActiveEffect.changes.push({
                        key: actor.system.characteristics[potentialCharacteristic]
                            ? `system.characteristics.dcv.max`
                            : "system.value",
                        value: lift,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    });
                    newFormatAdjustmentActiveEffect.flags.target.push("dcv");

                    const changes = {
                        [`system.characteristics.${newFormatAdjustmentActiveEffect.flags.target[1]}.value`]:
                            actor.system.characteristics.ocv.value + lift,
                        [`system.characteristics.${newFormatAdjustmentActiveEffect.flags.target[2]}.value`]:
                            actor.system.characteristics.dcv.value + lift,
                    };

                    await actor.update(changes);
                } else if (potentialCharacteristic === "ego") {
                    const charValue = actor.system.characteristics[potentialCharacteristic].value;
                    const lift = RoundFavorPlayerUp(
                        (charValue - actor.system.characteristics[potentialCharacteristic].core) / 3,
                    );

                    newFormatAdjustmentActiveEffect.changes.push({
                        key: actor.system.characteristics[potentialCharacteristic]
                            ? `system.characteristics.omcv.max`
                            : "system.value",
                        value: lift,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    });
                    newFormatAdjustmentActiveEffect.flags.target.push("omcv");

                    newFormatAdjustmentActiveEffect.changes.push({
                        key: actor.system.characteristics[potentialCharacteristic]
                            ? `system.characteristics.dmcv.max`
                            : "system.value",
                        value: lift,
                        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                    });
                    newFormatAdjustmentActiveEffect.flags.target.push("dmcv");

                    const changes = {
                        [`system.characteristics.${newFormatAdjustmentActiveEffect.flags.target[1]}.value`]:
                            actor.system.characteristics.omcv.value + lift,
                        [`system.characteristics.${newFormatAdjustmentActiveEffect.flags.target[2]}.value`]:
                            actor.system.characteristics.dmcv.value + lift,
                    };

                    await actor.update(changes);
                }
            }

            // Delete old active effect and create the new one
            await presentAdjustmentActiveEffect.delete();
            await actor.addActiveEffect(newFormatAdjustmentActiveEffect);
        }
    }
}

async function migrate_actor_items_to_3_0_54(actor) {
    for (const item of actor.items) {
        // Give all adjustment powers the new "adjustment" class for simplicity.
        if (
            item.system.XMLID === "ABSORPTION" ||
            item.system.XMLID === "AID" ||
            item.system.XMLID === "DISPEL" ||
            item.system.XMLID === "DRAIN" ||
            item.system.XMLID === "HEALING" ||
            item.system.XMLID === "TRANSFER" ||
            item.system.XMLID === "SUPPRESS"
        ) {
            await item.update({
                "system.class": "adjustment",
            });
        }
    }
}

async function migrate_actor_items_to_3_0_53(actor) {
    for (const item of actor.items) {
        // Get rid of item.system.characteristic and replace with
        // item.system.CHARACTERISTIC
        if (!item.system.CHARACTERISTIC && item.system.characteristic) {
            await item.update({
                "system.CHARACTERISTIC": item.system.characteristic.toUpperCase(),
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
            item.system.NAME?.toUpperCase().trim() === item.system.ALIAS?.toUpperCase().trim() &&
            item.name.toUpperCase().trim() === item.system.ALIAS?.toUpperCase().trim()
        ) {
            await item.update({
                "system.NAME": "",
            });
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
        console.error(e);
        if (game.user.isGM && game.settings.get(game.system.id, "alphaTesting")) {
            await ui.notifications.warn(`Migration failed for ${actor?.name}. Recommend re-uploading from HDC.`);
        }
    }
}

async function migrateActor_3_0_49(actor) {
    try {
        if (!actor) return;
        if (!actor.system.is5e) return;

        for (let item of actor.items.filter((o) => o.type === "maneuver")) {
            let entry = migrationOnly_combatManeuvers[item.name];
            if (!entry) {
                for (let key of Object.keys(migrationOnly_combatManeuvers)) {
                    if (key.toUpperCase().replace(" ", "") === item.name.toUpperCase().replace(" ", "")) {
                        entry = migrationOnly_combatManeuvers[key];
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
                    newEffect = EFFECT.replace(`v/${divisor}`, `v/${divisor / 2}`);
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
                    if (game.user.isGM && game.settings.get(game.system.id, "alphaTesting")) {
                        await ui.notifications.warn(
                            `Migration failed for ${actor?.name}. ${item.name} not recognized.`,
                        );
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
        if (game.user.isGM && game.settings.get(game.system.id, "alphaTesting")) {
            await ui.notifications.warn(`Migration failed for ${actor?.name}. Recommend re-uploading from HDC.`);
        }
    }
}

function migrationOnly_Pre3_0_61_getPowerInfo(options) {
    const xmlid =
        options.xmlid || options.item?.system?.XMLID || options.item?.system?.xmlid || options.item?.system?.id;

    const actor = options?.actor || options?.item?.actor;
    if (!actor) {
        // This has a problem if we're passed in an XMLID for a power as we don't know the actor so we don't know if it's 5e or 6e
        console.warn(`${xmlid} for ${options.item?.name} has no actor provided. Assuming 6e.`);
    }

    const powerList = actor?.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    let powerInfo = powerList.find((o) => o.key === xmlid);

    if (!powerInfo && options?.item?.type == "maneuver") {
        powerInfo = {
            type: ["maneuver"],
            perceivability: "obvious",
            duration: "instant",
            costEnd: false,
            target: "target's dcv",
        };
    }

    // TODO: Why are we modifying the power entries from config here?
    if (powerInfo) {
        powerInfo.xmlid = xmlid;
        powerInfo.XMLID = xmlid;
    }

    // LowerCase
    if (powerInfo?.duration) powerInfo.duration = powerInfo.duration.toLowerCase();

    return powerInfo;
}

// This is good enough for everything for the time being. Added to migration
// in 3.0.63.
export function migrationOnly_Pre_XXX_getPowerInfo(options) {
    const xmlid =
        options.xmlid || options.item?.system?.XMLID || options.item?.system?.xmlid || options.item?.system?.id;

    const actor = options?.actor || options?.item?.actor;
    if (!actor) {
        // This has a problem if we're passed in an XMLID for a power as we don't know the actor so we don't know if it's 5e or 6e
        console.warn(`${xmlid} for ${options.item?.name} has no actor provided. Assuming 6e.`);
    }

    const powerList = actor?.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    let powerInfo = powerList.find((o) => o.key === xmlid);

    // TODO: Why are we modifying the power entries from config here?
    if (powerInfo) {
        powerInfo.xmlid = xmlid;
        powerInfo.XMLID = xmlid;
    }

    // LowerCase
    // TODO: Make powers correct and remove this
    if (powerInfo?.duration) powerInfo.duration = powerInfo.duration.toLowerCase();

    return powerInfo;
}

const migrationOnly_combatManeuvers = {
    // Maneuver : [phase, OCV, DCV, Effects, Attack]
    Block: ["1/2", "+0", "+0", "Blocks HTH attacks, Abort", true],
    Brace: ["0", "+2", "1/2", "+2 OCV only to offset the Range Modifier"],
    Disarm: ["1/2", "-2", "+0", "Disarm target, requires STR vs. STR Roll", true],
    Dodge: ["1/2", "--", "+3", "Dodge all attacks, Abort", true],
    Grab: ["1/2", "-1", "-2", "Grab Two Limbs; can Squeeze, Slam, or Throw", true],
    "Grab By": ["1/2 †", "-3", "-4", "Move and Grab object, +(v/10) to STR", true],
    Haymaker: ["1/2*", "+0", "-5", "+4 Damage Classes to any attack"],
    "Move By": ["1/2 †", "-2", "-2", "((STR/2) + (v/10))d6; attacker takes 1/3 damage", true],
    "Move Through": ["1/2 †", "-v/10", "-3", "(STR + (v/6))d6; attacker takes 1/2 or full damage", true],
    //"Multiple Attack": ["1", "var", "1/2", "Attack one or more targets multiple times"],
    Set: ["1", "+1", "+0", "Take extra time to aim a Ranged attack at a target"],
    Shove: ["1/2", "-1", "-1", "Push target back 1m per 5 STR used", true],
    Strike: ["1/2", "+0", "+0", "STR damage or by weapon type", true],
    Throw: ["1/2", "+0", "+0", "Throw object or character, does STR damage", true],
    Trip: ["1/2", "-1", "-2", "Knock a target to the ground, making him Prone", true],
    //"Other Attacks": ["1/2", "+0", "+0", ""],
};
