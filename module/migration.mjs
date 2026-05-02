import { HeroProgressBar } from "./utility/progress-bar.mjs";
import { CreateHeroCompendiums } from "./heroCompendiums.mjs";
import { HeroItemCharacteristic } from "./item/HeroSystem6eTypeDataModels.mjs";

// Signal to migration code that this object has changed and needs to be persisted to the DB
const needToPersistToDb = "persistMigrationToDb";

export function tagObjectForPersistence(source) {
    // Notice that this value is never saved to the database
    const needToCommitMigrationToDbField = `flags.${game.system.id || "hero6efoundryvttv2"}.${needToPersistToDb}`;
    foundry.utils.setProperty(source, needToCommitMigrationToDbField, true);
}

/**
 * Returns all unlinked tokens in the game
 *
 * @returns {HeroSystem6eTokenDocument[]}
 */
function getActorsFromUnlinkedTokensInGame() {
    return game.scenes.contents
        .map((scene) => [...scene.tokens.filter((token) => token.actor && !token.actorLink).map((t) => t.actor)])
        .flat()
        .filter(Boolean);
}

/**
 * Get all actors listed in the Actor tab
 *
 * @returns {HeroSystem6eActor[]}
 */
function getSideBarActorsInGame() {
    return game.actors.contents;
}

function getAllActorsInGame() {
    return [...getSideBarActorsInGame(), ...getActorsFromUnlinkedTokensInGame()];
}

async function willNotMigrate(lastMigration) {
    // We no longer support migration of things which are too old so that migration doesn't become too complicated.
    // If anything is too old (based on the elements it supports) then we won't update anything. That list is:
    // - Last migrated version is before 3.0.76 which is the last version that had custom migration methods
    if (!foundry.utils.isNewerVersion(lastMigration, "3.0.75")) {
        const message = `<strong>FATAL ERROR</strong><br>The compendia, actors, and items in this world were were created with an older ${game.system.title || game.system.name} version that is no longer supported for automatic migration. Please re-upload everything from HDC or migrate through one, or more, supported versions (3.0.76 - 4.0.5) before upgrading to ${game.system.version}.`;

        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: message,
        };

        await Promise.all([ChatMessage.create(chatData), ui.notifications.error(message)]);

        return true;
    }

    return false;
}

/**
 * Run asyncFn against all elements of the provided queue if:
 *  * a lastMigration isn't provided or if
 *  * the lastMigration < migratesToVersion
 *
 * @param {string} migratesToVersion
 * @param {string} lastMigration
 * @param {Array<Object>} queue
 * @param {string} queueType
 * @param {async fn(queueElement)} asyncFn
 */
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

            try {
                await asyncFn(queueElement);
            } catch (error) {
                console.error(
                    `Exception executing migration (${migratesToVersion}) function ${asyncFn.name} with queue (${queue.length}): `,
                    error,
                    queueElement,
                );
            }
        }

        migrationProgressBar.close(`Done migrating ${originalTotal} ${queueType} to ${migratesToVersion}`);
    }
}

export async function migrateWorld() {
    // Only the primary GM should be running migrations
    if (!game.users.activeGM?.isSelf) {
        return;
    }

    const lastMigration = game.settings.get(game.system.id, "lastMigration");

    // NOTE: If there has never been a migration then the lastMigration is "1.0.0". We don't need to give a warning in this case
    // as we know that this system was not around then.
    // Newly created worlds have a lastMigration === "1.0.0" and we should CreateHeroCompendiums
    if (lastMigration === "1.0.0") {
        await CreateHeroCompendiums();
        return;
    }

    if (await willNotMigrate(lastMigration)) {
        return;
    }

    // Delete invalidItems from unlinked tokens without actors.
    // Mostly to avoid future errors, not sure why we keep any "delta" from unlinked tokens without actors.
    const tokensWithInvalidItems = [
        ...game.scenes.contents
            .map((scene) => [...scene.tokens.filter((t) => !t.actor && t.delta?.items?.invalidDocumentIds.size > 0)])
            .flat(),
    ];
    if (tokensWithInvalidItems) {
        const migrationProgressBar = new HeroProgressBar(
            `Deleting invlaid items from unlinked tokens`,
            tokensWithInvalidItems + 1,
        );
        for (const token of tokensWithInvalidItems) {
            console.debug(`Deleting ${token.delta.items.invalidDocumentIds.size} invalid items from ${token.name}`);
            for (const id of token.delta.items.invalidDocumentIds) {
                try {
                    const item = token.delta.items.getInvalid(id);
                    console.log(item);
                    await item.delete();
                } catch (e) {
                    console.error(e);
                }
            }
            migrationProgressBar.advance(
                `Deleted invalid items from ${token.name} (${tokensWithInvalidItems.length} left)`,
            );
        }
        migrationProgressBar.close(`Done deleting invalid items from unlinked tokens`);
    }

    // Chat Card for GM about new version
    const content = `Version ${
        game.system.version
    } of <a href="https://github.com/dmdorman/hero6e-foundryvtt/blob/main/README.md">${
        game.system.title || game.system.name
    }</a> has been installed. Details about recent changes can be viewed at <a href="https://github.com/dmdorman/hero6e-foundryvtt/blob/main/CHANGELOG.md">CHANGELOG</a>.<br><br>If you find any problems, are missing things, or just would like a feature that is lacking, please report these <a href="https://github.com/dmdorman/hero6e-foundryvtt/issues">HERE</a>.<br><br>Check out our <a href="https://www.youtube.com/channel/UCcmq0WFFNZNhRSGwuEHOgRg">YouTube channel</a>.  There is also a <a href="https://discord.com/channels/609528652878839828/770825017729482772">Discord channel</a> where you can interactively communicate with others using <a href="https://github.com/dmdorman/hero6e-foundryvtt/blob/main/README.md">${
        game.system.title || game.system.name
    }</a>.`;
    const chatData = {
        author: game.user._id,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        content: content,
    };
    await ChatMessage.create(chatData);

    // Create or recreate Compendiums
    await CreateHeroCompendiums();

    // Migrate maneuvers for all things that have strength (PC, NPC) but ignore Vehicles and automatons since we don't give them free stuff at this point.
    let _start = Date.now();
    await migrateToVersion(
        "4.0.14",
        lastMigration,
        getAllActorsInGame(),
        "rebuilding all built in maneuvers for PC and NPCs",
        async (actor) => await replaceActorsBuiltInManeuvers(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.0.14`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.0.15",
        lastMigration,
        getAllActorsInGame().filter((actor) => actor.type === "automaton"),
        "adding freebees for Automatons",
        async (actor) => await addManeuversForAutomaton(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.0.15`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.0.16",
        lastMigration,
        getAllActorsInGame().filter(
            (actor) => actor.system.is5e && (actor.type === "automaton" || actor.type === "pc" || actor.type === "npc"),
        ),
        "adding other attacks for 5e automaton, pc, and npc",
        async (actor) => await addOtherAttacksManeuversForAutomatonPcNpc(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.0.16`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.0.26",
        lastMigration,
        getAllActorsInGame(),
        "removing STR placeholder",
        async (actor) => await removeStrengthPlaceholderAndCreateActivePropertyAndRemoveHeroicProperty(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.0.26`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.1.0",
        lastMigration,
        getAllActorsInGame(),
        "flag scopes",
        async (actor) => await flagScopes(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.1.0`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.1.13",
        lastMigration,
        getAllActorsInGame(),
        "remove placeholder weapon item",
        async (actor) => await removePlaceholderWeaponItem(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.1.13`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.2.0",
        lastMigration,
        getAllActorsInGame(),
        "coerce is5e===undefined to boolean value",
        async (actor) => await migrateTo4_2_0(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.2.0`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.2.5",
        lastMigration,
        getAllActorsInGame(),
        "edition migration and Overall SKILL LEVELS",
        async (actor) => await migrateTo4_2_5(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.2.5`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.2.9",
        lastMigration,
        getAllActorsInGame(),
        "Combat Skill Levels",
        async (actor) => await migrateTo4_2_9(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.2.9`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.2.12",
        lastMigration,
        getAllActorsInGame(),
        "Weapon Master",
        async (actor) => await migrateTo4_2_12(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.2.12`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.2.14",
        lastMigration,
        getAllActorsInGame(),
        "Combat Skill Levels",
        async (actor) => await migrateTo4_2_14(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.2.14`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.2.17",
        lastMigration,
        getAllActorsInGame(),
        "Penalty Skill Levels",
        async (actor) => await migrateTo4_2_17(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.2.17`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.2.18",
        lastMigration,
        getAllActorsInGame(),
        "Delete Invalid Item Types",
        async (actor) => await deleteInvalidItems4_2_18(actor),
    );
    await migrateToVersion(
        "4.2.18",
        lastMigration,
        Array.from(game.items.invalidDocumentIds).map((id) => game.items.getInvalid(id)),
        "Delete Invalid Item Types (side bar items)",
        async (item) => await deleteItemsWithInvalidTypesFromSideBar4_2_18(item),
    );
    await migrateToVersion(
        "4.2.18",
        lastMigration,
        getAllActorsInGame(),
        "Maneuvers",
        async (actor) => await migrateActorManeuvers4_2_18(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.2.18`, "background: #1111FF; color: #FFFFFF");

    await migrateToVersion(
        "4.3.5",
        lastMigration,
        getAllActorsInGame(),
        "Untrained Skill",
        async (actor) => await migrateTo4_3_5(actor),
    );
    console.log(`%c Took ${Date.now() - _start}ms to migrate to version 4.3.5`, "background: #1111FF; color: #FFFFFF");

    // Because migrations are done by {Actor,Item}.migrateData for all the objects, we need to commit those changes to the DB.
    await migrateToVersion(
        game.system.version,
        lastMigration,
        getAllActorsInGame(),
        "commit actor object migration",
        async (actor) => await commitActorAndItemMigrateDataChangesByActor(actor),
    );

    // Migrate items
    await migrateToVersion(
        game.system.version,
        lastMigration,
        Array.from(game.items),
        "commit items collection object migration",
        async (item) => await commitItemsCollectionMigrateDataChanges(item),
    );

    console.log(
        `%c Took ${Date.now() - _start}ms to finalize object migration to version ${game.system.version}`,
        "background: #1111FF; color: #FFFFFF",
    );

    await ui.notifications.info(`Migration complete to ${game.system.version}`);

    // Invalid sidebar Items
    try {
        for (const id of game.items.invalidDocumentIds) {
            const item = game.items.getInvalid(id);
            if (["misc", "attack", "movement", "defense"].includes(item.type)) {
                console.log(item);
                console.warn(`changing ${item.name} type from "${item.type}" to "power"`, item);
                await item.update({ type: "power", name: `[INVALID] ${item.name}`, "==system": item.system });
            } else {
                console.error("unexpected item.type", item);
            }
            ui.notifications.error(
                `There were ${game.items.invalidDocumentIds.size} items that are no longer supported in the sidebar. These items were re-typed to be POWERs and prefixed with [INVALID]. These items probably won't work.`,
            );
        }
    } catch (e) {
        console.error(e);
    }
}

/**
 * Check if needToPersistToDb has been set for Actor or Item objects. If so, persist.
 * REF: https://discord.com/channels/170995199584108546/811676497965613117/1437162678224162836
 */
async function commitActorAndItemMigrateDataChangesByActor(actor) {
    const promises = [];

    const actorUpdates = [];
    const itemUpdates = [];

    if (actor.flags[game.system.id]?.[needToPersistToDb]) {
        const { _id, system, flags } = actor.toObject();
        delete flags[game.system.id][needToPersistToDb];
        actorUpdates.push({ _id, "==system": system, "==flags": flags });
    }
    promises.push(Actor.implementation.updateDocuments(actorUpdates));

    for (const item of actor.items) {
        if (item.flags[game.system.id]?.[needToPersistToDb]) {
            const { _id, system, flags } = item.toObject();
            delete flags[game.system.id][needToPersistToDb];
            itemUpdates.push({ _id, "==system": system, "==flags": flags });
        }
    }

    promises.push(Item.implementation.updateDocuments(itemUpdates, { parent: actor }));

    return Promise.all(promises);
}

/**
 * Check if needToPersistToDb has been set for Item objects in the Items collection.
 * These are items in the sidebar and have no associated actor.
 */
async function commitItemsCollectionMigrateDataChanges(item) {
    if (item.flags[game.system.id]?.[needToPersistToDb]) {
        const { system, flags } = item.toObject();
        delete flags[game.system.id][needToPersistToDb];
        await item.update({ "==system": system, "==flags": flags });
    }
}

async function deleteInvalidItems4_2_18(actor) {
    try {
        await deleteItemsWithInvalidTypesFromActor4_2_18(actor);
    } catch (e) {
        console.error(e);
    }
}

// These document types are no longer supported.
// The types starting with underscores have been invalidated in item.migrateData.
const invalidItemTypesToDelete4_2_18 = ["attack", "defense", "movement", "misc"];

async function deleteItemsWithInvalidTypesFromActor4_2_18(actor) {
    const deletingItemPromises = [];

    try {
        for (const itemId of actor.items.invalidDocumentIds) {
            const item = actor.items.getInvalid(itemId);
            if (invalidItemTypesToDelete4_2_18.includes(item.type) || item.type.startsWith("_")) {
                console.warn(
                    `Deleting item ${actor.name}/${item.name} with invalid type ${item.type} found during 4.2.18 migration`,
                );
                deletingItemPromises.push(item.delete());
            } else {
                console.error(
                    `Unexpected item ${actor.name}/${item.name} with invalid type=${item.type} found during 4.2.18 migration`,
                );
            }
        }
    } catch (e) {
        console.error(e);
    }

    return Promise.all(deletingItemPromises);
}

/**
 * There were some issues with the descriptions of BRACE, MULTIPLEATTACK, RAPIDFIRE, SET, and SETANDBRACE
 * @param {*} actor
 */
async function migrateActorManeuvers4_2_18(actor) {
    try {
        await readdHeroSystemManeuvers_4_2_18(actor);
    } catch (e) {
        console.error(e);
    }
}

async function readdHeroSystemManeuvers_4_2_18(actor) {
    // Consider linked and unlinked actors differently.
    if (actor.token) {
        // Don't migrate unlinked token items - we will instead delete them to make them equal to the prototype token's values.
        const maneuversToDelete = actor.token.delta._source.items
            .filter((item) => item.type === "maneuver")
            .filter((i) => !actor.token.baseActor.items.map((i) => i.id).includes(i._id) && !i._tombstone);
        const idsToDelete = maneuversToDelete.map((i) => i._id);
        return actor.deleteEmbeddedDocuments("Item", idsToDelete);
    } else {
        // Delete all existing maneuvers from our linked actors
        const existingManeuverIds = actor.items
            .filter((power) => power.type?.includes("maneuver"))
            .map((item) => item.id);
        await actor.deleteEmbeddedDocuments("Item", existingManeuverIds);

        // Add all maneuvers for this version
        const powerList = actor.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
        const maneuverList = powerList.filter((power) => power.type?.includes("maneuver"));
        const maneuverItemsData = maneuverList.map((maneuverBaseInfo) =>
            buildManeuverItemData_4_2_18(actor, maneuverBaseInfo),
        );
        return actor.createEmbeddedDocuments("Item", maneuverItemsData);
    }
}

function buildManeuverItemData_4_2_18(actor, maneuver) {
    const name = maneuver.name;
    const XMLID = maneuver.key;

    const maneuverDetails = maneuver.maneuverDesc;
    const ADDSTR = maneuverDetails.addStr;
    const DC = maneuverDetails.dc;
    const DCV = maneuverDetails.dcv;
    const EFFECT = maneuverDetails.effects;
    const OCV = maneuverDetails.ocv;
    const PHASE = maneuverDetails.phase;
    const RANGE = maneuverDetails.range || "0";
    const USEWEAPON = maneuverDetails.useWeapon; // "No" if unarmed or not offensive maneuver
    const WEAPONEFFECT = maneuverDetails.weaponEffect; // Not be present if not offensive maneuver

    const itemData = {
        name,
        type: "maneuver",
        system: {
            active: false, // TODO: This is probably not always true. It should, however, be generated in other means.
            description: EFFECT,
            is5e: actor.is5e,
            ADDSTR,
            DC,
            DCV,
            DISPLAY: name, // Not sure we should allow editing of basic maneuvers
            EFFECT,
            OCV,
            PHASE,
            RANGE,
            USEWEAPON,
            WEAPONEFFECT,
            XMLID,
            // MARTIALARTS consists of a list of MANEUVERS, the MARTIALARTS MANEUVERS have more props than our basic ones.
            // Adding in some of those props as we may enhance/rework the basic maneuvers in the future.
            //  <MANEUVER XMLID="MANEUVER" ID="1705867725258" BASECOST="4.0" LEVELS="0" ALIAS="Block" POSITION="1"
            //  MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes"
            //  INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Block" OCV="+2"
            //  DCV="+2" DC="0" PHASE="1/2" EFFECT="Block, Abort" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0"
            //  MAXSTR="0" STRMULT="1" USEWEAPON="Yes" WEAPONEFFECT="Block, Abort">
        },
    };

    if (!itemData.name) {
        console.error("Missing name", itemData);
        return;
    }

    return itemData;
}

async function deleteItemsWithInvalidTypesFromSideBar4_2_18(item) {
    try {
        if (invalidItemTypesToDelete4_2_18.includes(item.type) || item.type.startsWith("_")) {
            console.warn(
                `Deleting item ${item.name} with invalid type ${item.type} found during 4.2.18 migration:`,
                item,
            );
            await item.delete();
        } else {
            console.error(`Unexpected item with invalid type=${item.type} found during 4.2.18 migration:`, item);
        }
    } catch (e) {
        console.error(e);
    }
}

async function migrateTo4_2_17(actor) {
    try {
        await fixupPslChoices4_2_17(actor);
    } catch (e) {
        console.error(e);
    }
}

// PSLs, prior to this, did not have links. Add them.
async function fixupPslChoices4_2_17(actor) {
    const itemUpdates = [];

    for (const item of actor.items) {
        if (!item.isPsl) {
            continue;
        }

        const pslUpdates = {};
        let changes = false;

        // Setup targetId
        const allAdders = foundry.utils.deepClone(item.system._source.ADDER);
        for (const customAdder of allAdders.filter((a) => a.XMLID === "ADDER")) {
            const targetId = (item.actor?.pslItems || []).find((item) => {
                // A match has the exact name, ALIAS, or XMLID (ignoring case). The most precise
                // is thus providing a unique name - other options can potentially have multiple matches of which
                // we'll end up with the first. This could result in a situation where someone can not match
                // the attack they actually want.
                // NOTE: We do allow a case insensitve match
                const aliasToMatch = customAdder.ALIAS.toLowerCase();

                return (
                    item.name.toLowerCase() === aliasToMatch ||
                    item.system.ALIAS?.toLowerCase() === aliasToMatch ||
                    item.system.XMLID?.toLowerCase() === aliasToMatch
                );
            })?.id;

            if (!targetId && customAdder.BASECOST === 0 && customAdder.ALIAS) {
                console.warn(`Failed to match custom adder ${customAdder.ALIAS} for PSL ${item.detailedName()}.`);
            }

            if (customAdder.targetId !== targetId) {
                customAdder.targetId = targetId;
                changes = true;
            }
        }
        pslUpdates["system.ADDER"] = allAdders;

        if (changes) {
            pslUpdates._id = item._id;
            itemUpdates.push(pslUpdates);
        }
    }

    return itemUpdates.length > 0
        ? Item.implementation.updateDocuments(itemUpdates, { parent: actor })
        : Promise.resolve(true);
}

async function migrateTo4_3_5(actor) {
    try {
        // We only want to add the untrained skill for prototype actors, not unlinked actors.
        if (!actor.token) {
            const _untrainedSkillItem = actor.items.find((item) => item.system.XMLID === "UNTRAINED");
            if (!_untrainedSkillItem) {
                await actor.addUntrainedSkill();
            }
        }
    } catch (e) {
        console.error(e);
    }
}

async function migrateTo4_2_14(actor) {
    try {
        await fixupCslChoices4_2_14(actor);
    } catch (e) {
        console.error(e);
    }
}

// Many CSLs have invalid choices in their internal structure. Fix them.
// Note that this is very similar to fixupCslChoices_4_2_9 except it has bug fixes that caused the
// 4.2.9 migration to not run properly for some actors/items
async function fixupCslChoices4_2_14(actor) {
    const itemUpdates = [];

    for (const item of actor.items) {
        if (!item.isCsl) {
            continue;
        }

        // We have a bug in isCsl right now that shows all SKILL_LEVELS as CSLs. Work around it for the time being.
        if (item.system.XMLID === "SKILL_LEVELS" && item.system.OPTIONID !== "OVERALL") {
            continue;
        }

        const cslUpdates = {};
        let changes = false;

        // Initialize csl array making sure that the selectedChoice is a valid allowedChoices.
        const allowedChoices = item.cslChoices;
        const selectedChoices = foundry.utils.deepClone(item.system._source.csl || []); // NOTE: Very old items won't even have a csl array
        const expectedNumEntries = Math.max(selectedChoices.length, item.system.LEVELS);
        selectedChoices.length = expectedNumEntries; // Truncate or expand the array as required

        // Make sure none of the selectedChoices are outside the possibleChoices set. If they are,
        // just set them to the first option of the possibleChoices (because who knows what is best).
        for (let i = 0; i < expectedNumEntries; ++i) {
            if (allowedChoices[selectedChoices[i]] === undefined) {
                selectedChoices[i] = Object.keys(allowedChoices)[0];
                changes = true;
            }
        }
        cslUpdates["system.csl"] = selectedChoices;

        // Setup targetId
        const allAdders = foundry.utils.deepClone(item.system._source.ADDER);
        for (const customAdder of allAdders.filter((a) => a.XMLID === "ADDER")) {
            const targetId = (item.actor?.cslItems || []).find((item) => {
                // A match has the exact name, ALIAS, or XMLID (ignoring case). The most precise
                // is thus providing a unique name - other options can potentially have multiple matches of which
                // we'll end up with the first. This could result in a situation where someone can not match
                // the attack they actually want.
                // NOTE: We do allow a case insensitve match
                const aliasToMatch = customAdder.ALIAS.toLowerCase();

                return (
                    item.name.toLowerCase() === aliasToMatch ||
                    item.system.ALIAS?.toLowerCase() === aliasToMatch ||
                    item.system.XMLID?.toLowerCase() === aliasToMatch
                );
            })?.id;

            if (!targetId && customAdder.BASECOST === 0 && customAdder.ALIAS) {
                console.warn(`Failed to match custom adder ${customAdder.ALIAS} for CSL ${item.detailedName()}.`);
            }

            if (customAdder.targetId !== targetId) {
                customAdder.targetId = targetId;
                changes = true;
            }
        }
        cslUpdates["system.ADDER"] = allAdders;

        if (changes) {
            cslUpdates._id = item._id;
            itemUpdates.push(cslUpdates);
        }
    }

    return itemUpdates.length > 0
        ? Item.implementation.updateDocuments(itemUpdates, { parent: actor })
        : Promise.resolve(true);
}

async function migrateTo4_2_12(actor) {
    try {
        await refreshWeaponMaster(actor);
    } catch (e) {
        console.error(e);
    }
}

async function refreshWeaponMaster(actor) {
    // Weapon Master acts like a CSL and is now supported. Need the csl prop array built.
    try {
        const weaponMasterItems = actor.items.filter((item) => item.system.XMLID === "WEAPON_MASTER");

        for (const item of weaponMasterItems) {
            try {
                const numEntries = 6 * item.system.LEVELS;
                const csl = new Array(numEntries);
                for (let idx = 0; idx < csl.length; idx++) {
                    csl[idx] = "dc";
                }
                await item.update({ [`system.csl`]: csl });
            } catch (e) {
                console.error(e, item);
            }
        }
    } catch (e) {
        console.error(e, actor);
    }
}

async function migrateTo4_2_9(actor) {
    try {
        await fixupCslChoices4_2_9(actor);
    } catch (e) {
        console.error(e);
    }
}

// Many CSLs have invalid choices in their internal structure. Fix them.
async function fixupCslChoices4_2_9(actor) {
    const itemUpdates = [];

    for (const item of actor.items) {
        if (!item.isCsl) {
            continue;
        }

        // We have a bug in isCsl right now that shows all SKILL_LEVELS as CSLs. Work around it for the time being.
        if (item.system.XMLID === "SKILL_LEVELS" && item.system.OPTIONID !== "OVERALL") {
            continue;
        }

        const cslUpdates = {};
        let changes = false;

        // Initialize csl array making sure that the selectedChoice is a valid allowedChoices.
        const allowedChoices = item.cslChoices;
        const selectedChoices = foundry.utils.deepClone(item.system._source.csl);
        const expectedNumEntries = Math.max(selectedChoices.length, item.system.LEVELS);
        selectedChoices.length = expectedNumEntries; // Truncate or expand the array as required

        // Make sure none of the selectedChoices are outside the possibleChoices set. If they are,
        // just set them to the first option of the possibleChoices (because who knows what is best).
        for (let i = 0; i < expectedNumEntries; ++i) {
            if (allowedChoices[selectedChoices[i]] === undefined) {
                selectedChoices[i] = Object.keys(allowedChoices)[0];
                changes = true;
            }
        }
        cslUpdates["system.csl"] = selectedChoices;

        // Setup targetId
        const allAdders = foundry.utils.deepClone(item.system._source.ADDER);
        for (const customAdder of allAdders.filter((a) => a.XMLID === "ADDER")) {
            const targetId = (item.actor?.cslItems || []).find((item) => {
                // A match has the exact name, ALIAS, or XMLID (ignoring case). The most precise
                // is thus providing a unique name - other options can potentially have multiple matches of which
                // we'll end up with the first. This could result in a situation where someone can not match
                // the attack they actually want.
                const aliasToMatch = `^${customAdder.ALIAS}$`;

                return (
                    `${item.name}`.match(new RegExp(aliasToMatch, "i")) ||
                    `${item.system.ALIAS}`.match(new RegExp(aliasToMatch, "i")) ||
                    `${item.system.XMLID}`.match(new RegExp(aliasToMatch, "i"))
                );
            })?.id;

            if (!targetId && customAdder.BASECOST === 0 && customAdder.ALIAS) {
                console.warn(`Failed to match custom adder ${customAdder.ALIAS} for CSL ${item.detailedName()}.`);
            }

            if (customAdder.targetId !== targetId) {
                customAdder.targetId = targetId;
                changes = true;
            }
        }
        cslUpdates["system.ADDER"] = allAdders;

        if (changes) {
            cslUpdates._id = item._id;
            itemUpdates.push(cslUpdates);
        }
    }

    return itemUpdates.length > 0
        ? Item.implementation.updateDocuments(itemUpdates, { parent: actor })
        : Promise.resolve(true);
}

async function migrateTo4_2_5(actor) {
    try {
        await replaceFreeStuffWithProperEdition(actor);
        await refreshSkillLevelsOverall(actor);
    } catch (e) {
        console.error(e);
    }
}

async function migrateTo4_2_0(actor) {
    try {
        await addPerceptionXmlTag(actor);
        await coerceIs5eToBoolean(actor);
        await addXmlidToCharacteristics(actor);
        //await convertCharacteristicsToItem(actor);
    } catch (e) {
        console.error(e);
    }
}

async function replaceFreeStuffWithProperEdition(actor) {
    // Check for any 5e/6e mismatched free items
    const mismatchItem = actor.items.find(
        (item) =>
            (item.system.XMLID === "PERCEPTION" || item.type === "maneuver") &&
            (item.system.is5e !== actor.system.is5e || !item.baseInfo),
    );

    if (mismatchItem) {
        // Add perception and maneuvers (also removes all mismatched free items)
        await actor.addFreeStuff();
    }
}

async function refreshSkillLevelsOverall(actor) {
    // SKILL_LEVELS (4.2.5) has an OVERALL that acts like a CSL.  Need the csl prop array built.
    try {
        const overallSkillLevelItems = actor.items.filter(
            (item) => item.system.XMLID === "SKILL_LEVELS" && item.system.OPTIONID === "OVERALL",
        );

        for (const item of overallSkillLevelItems) {
            try {
                const LEVELS = item.system.LEVELS;
                if (item.system.csl.length !== LEVELS) {
                    const csl = new Array(LEVELS);
                    for (let idx = 0; idx < csl.length; idx++) {
                        csl[idx] = item.system.csl?.[idx] || Object.keys(item.cslChoices)[0];
                    }
                    await item.update({ [`system.csl`]: csl });
                }
            } catch (e) {
                console.error(e, item);
            }
        }
    } catch (e) {
        console.error(e, actor);
    }
}

async function addXmlidToCharacteristics(actor) {
    const changes = {};
    for (const key of Object.keys(actor.system).filter((o) => o.match(/[A-Z]/))) {
        const char = actor.system[key];
        if (char instanceof HeroItemCharacteristic && !char.XMLID) {
            changes[`system.${key}.XMLID`] = key;
            changes[`system.${key}.xmlTag`] = key;
        }
    }
    if (Object.keys(changes).length > 0) {
        await actor.update(changes);
    }
}

async function addPerceptionXmlTag(actor) {
    const perception = actor.items.find((i) => i.system.XMLID === "PERCEPTION" && i.system.xmlTag !== "SKILL");
    if (perception) {
        await perception.update({ "system.xmlTag": "SKILL" });
    }
    return;
}

// https://github.com/dmdorman/hero6e-foundryvtt/issues/2812
async function coerceIs5eToBoolean(actor) {
    if (!actor.system.is5e && actor.system.is5e !== false) {
        await actor.update({ "system.is5e": false });
    }

    const itemUpdates = [];
    for (const item of actor.items.filter((i) => !i.system.is5e && i.system.is5e !== false)) {
        if (!item.baseInfo) {
            if (["maneuver", "attack"].includes(item.type)) {
                console.error(
                    `${actor.name}/${item.detailedName()} deleting invalid ${actor.system.is5e ? "5e" : "6e"} ${item.type}`,
                );
                await item.delete();
                continue;
            }
            console.error(`${actor.name}/${item.detailedName()} has no baseInfo`);
        }
        itemUpdates.push({ _id: item.id, "system.is5e": actor.system.is5e });
    }

    if (itemUpdates.length > 0) {
        await actor.updateEmbeddedDocuments("Item", itemUpdates);
    }
}

// We no longer need __InternalManeuverPlaceholderWeapon as we now have effective attack items. Delete
// it from all actors.
async function removePlaceholderWeaponItem(actor) {
    return actor?.items.find((item) => item.name === "__InternalManeuverPlaceholderWeapon")?.delete();
}

// V13 requires scopes on all flags. Scoped flags work just fine in V12.
// While not absolutely necessasry, we will move all unscoped flags
// into the game.system.id (typically 'hero6efoundryvttv2') scope so any ongoing effects/statuses/movementState/etc don't get lost.
async function flagScopes(actor) {
    try {
        if (!actor) return false;

        const actorUpdates = [];
        for (const prop of Object.keys(actor.flags).filter((f) => f !== game.system.id)) {
            actorUpdates[`flags.-=${prop}`] = null;
            actorUpdates[`flags.${game.system.id}.${prop}`] = actor.flags[prop];
        }
        if (actorUpdates.length > 0) {
            await actor.update(actorUpdates);
        }

        const itemUpdates = [];
        for (const item of actor.items.filter((i) => Object.keys(i.flags).length > 0)) {
            for (const prop of Object.keys(item.flags).filter((f) => f !== game.system.id)) {
                itemUpdates[`flags.-=${prop}`] = null;
                itemUpdates[`flags.${game.system.id}.${prop}`] = item.flags[prop];
            }
        }
        if (itemUpdates.length > 0) {
            await actor.updateEmbeddedDocuments("Item", itemUpdates);
        }

        const effectUpdates = [];
        for (const effect of actor.effects.filter((i) => Object.keys(i.flags).length > 0)) {
            for (const prop of Object.keys(effect.flags).filter((f) => f !== game.system.id)) {
                effectUpdates[`flags.-=${prop}`] = null;
                effectUpdates[`flags.${game.system.id}.${prop}`] = effect.flags[prop];
            }
        }
        if (effectUpdates.length > 0) {
            await actor.updateEmbeddedDocuments("ActiveEffect", effectUpdates);
        }

        // NOTE: we are not upgrading combat & combatants (see warning in 4.1.0 changelog)
    } catch (e) {
        console.error(e);
    }
}

async function removeStrengthPlaceholderAndCreateActivePropertyAndRemoveHeroicProperty(actor) {
    try {
        if (!actor) return false;

        // Remove the isHeroic property as it is now calculated on the fly
        await actor.update({ "system.-=isHeroic": null });

        // Delete strength placeholder as we need many of them so will be creating them on the fly.
        await actor.items.find((item) => item.system.ALIAS === "__InternalStrengthPlaceholder")?.delete();

        // Create the _active object for all items
        const updates = actor.items
            .map((item) => {
                if (!item.system._active) {
                    return { _id: item._id, "system._active": {} };
                }

                return undefined;
            })
            .filter(Boolean);

        await actor.updateEmbeddedDocuments("Item", updates);
    } catch (e) {
        const msg = `Migration of actors to 4.0.26 failed for ${actor?.name}. Please report.`;
        console.error(msg, e);
        if (game.user.isGM && game.settings.get(game.system.id, "alphaTesting")) {
            await ui.notifications.warn(msg);
        }
    }
}

async function replaceActorsBuiltInManeuvers(actor) {
    try {
        if (!actor) return false;

        const timer = {};

        // Remove all built in maneuvers
        timer.deleteStart = Date.now();
        await actor.deleteEmbeddedDocuments(
            "Item",
            actor.items.filter((power) => power.type?.includes("maneuver")).map((o) => o.id),
        );
        timer.deleteEnd = Date.now();

        if (actor.type !== "pc" && actor.type !== "npc") {
            return;
        }

        // Add in all built in maneuvers
        timer.maneuversStart = Date.now();
        await actor.addHeroSystemManeuvers();
        timer.maneuversEnd = Date.now();
    } catch (e) {
        const msg = `Migration of maneuvers to 4.0.14 failed for ${actor?.name}. Please report.`;
        console.error(msg, e);
        if (game.user.isGM && game.settings.get(game.system.id, "alphaTesting")) {
            await ui.notifications.warn(msg);
        }
    }
}

/**
 * Automatons had maneuvers stripped out in 4.0.14's migration. Add them back in.
 * @param {*} actor
 * @returns
 */
async function addManeuversForAutomaton(actor) {
    try {
        if (!actor) return false;

        // Delete perception if it has it so that we can start with a blank slate.
        await actor.items.find((item) => item.system.XMLID === "PERCEPTION")?.delete();

        // Add perception and maneuvers
        await actor.addFreeStuff();
    } catch (e) {
        const msg = `Adding freebees to Automaton in 4.0.15 failed for ${actor?.name}. Please report.`;
        console.error(msg, e);
        if (game.user.isGM && game.settings.get(game.system.id, "alphaTesting")) {
            await ui.notifications.warn(msg);
        }
    }
}

/**
 * 5e Automatons, NPCs, and PCs were missing the OTHERATTACKS maneuver accidentally.
 * @param {*} actor
 * @returns
 */
async function addOtherAttacksManeuversForAutomatonPcNpc(actor) {
    try {
        if (!actor) return false;

        // If doesn't already have this maneuver
        const alreadyHasOtherAttacksManeuver = actor.items.find((item) => item.system.XMLID === "OTHERATTACKS");
        if (alreadyHasOtherAttacksManeuver) {
            return false;
        }

        // Add the maneuver
        const otherAttacksManeuver = CONFIG.HERO.powers5e.find((power) => power.key === "OTHERATTACKS");
        await actor.addManeuver(otherAttacksManeuver);
    } catch (e) {
        const msg = `Adding OTHERATTACKS in 4.0.16 failed for ${actor?.name}. Please report.`;
        console.error(msg, e);
        if (game.user.isGM && game.settings.get(game.system.id, "alphaTesting")) {
            await ui.notifications.warn(msg);
        }
    }
}
