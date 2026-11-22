const { Item, Macro } = foundry.documents;

const { CompendiumCollection } = foundry.documents.collections;

export async function CreateHeroCompendiums() {
    if (!game.user.isGM) return;

    try {
        await CreateHeroItems("five");
        await CreateHeroItems("six");
        await CreateHeroMacros();
    } catch (e) {
        console.error(e);
    }
}

window.CreateHeroCompendiums = CreateHeroCompendiums;

async function createItem(itemDataArray, packId) {
    try {
        await Item.createDocuments(itemDataArray, {
            pack: packId,
        });
    } catch (e) {
        console.error(e);
    }
}

async function CreateHeroMacros() {
    const label = "HeroMacro";
    const metadata = { label: label, name: label.slugify({ strict: true }), type: "Macro" };

    // Delete compendium and re-create it.
    let pack = game.packs.get(`world.${metadata.name}`);
    if (pack) {
        await pack.configure({ locked: false });
        await pack.deleteCompendium();
    }
    pack = await CompendiumCollection.createCompendium(metadata);

    // V13 seems to default new compendiums to locked
    if (pack.locked) {
        await pack.configure({ locked: false });
    }

    const macroItemsArray = [];

    macroItemsArray.push({
        img: "icons/svg/regen.svg",
        name: "Full Health all owned tokens in scene",
        type: "script",
        command: `
        const confirmed = await foundry.applications.api.DialogV2.confirm({
  window: { title: "Full Health" },
  content: '<p>You are about to heal ' + game.scenes.current.tokens.filter(o=>o.isOwner).length + ' tokens in this scene. This is the same as clicking "Full Health" on each actor sheet. This includes setting all characteristics to max, removing status effects and removing temporary effects.  Do you want to continue?</p>',
});
if (confirmed) {
  for(const token of game.scenes.current.tokens.filter(o=>o.isOwner)) {
    console.log(token);
    token.actor?.fullHealth();
  }
}
        `,
        flags: {
            [`${game.system.id}.versionHeroSystem6eManuallyCreated`]: game.system.version,
        },
    });

    macroItemsArray.push({
        img: "icons/tools/scribal/magnifying-glass.webp",
        name: "Pan canvas to last Actor opened",
        type: "script",
        command: `const user_token = window.actor.getActiveTokens()[0];
if(user_token)
{
  canvas.animatePan({ x : user_token.x, y : user_token.y, scale:1});
  canvas.ping(user_token.center);
}
        `,
        flags: {
            [`${game.system.id}.versionHeroSystem6eManuallyCreated`]: game.system.version,
        },
    });

    await Macro.createDocuments(macroItemsArray, {
        pack: pack.metadata.id,
    });

    // Lock Compendium
    await pack.configure({ locked: true });
}

async function CreateHeroItems(edition) {
    // 5e vs 6e
    edition ??= game.settings.get(game.system.id, "DefaultEdition");
    const powers = edition === "five" ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;
    const bogusActor = {
        system: { is5e: edition === "five" ? true : false },
    };

    const label = `HeroItems ${edition === "five" ? "5e" : "6e"}`;
    const metadata = { label: label, name: label.slugify({ strict: true }), type: "Item" };

    // Delete legacy edition-less HeroItem compendium
    const legacyHeroItemPack = game.packs.get("world.heroitems");
    if (legacyHeroItemPack) {
        await legacyHeroItemPack.configure({ locked: false });
        await legacyHeroItemPack.deleteCompendium();
    }

    // Delete compendium so we can recreate it.
    const existingPack = game.packs.get(`world.${metadata.name}`);
    if (existingPack) {
        await existingPack.configure({ locked: false });
        await existingPack.deleteCompendium();
    }

    // Create a new compendium
    const pack = await CompendiumCollection.createCompendium(metadata);
    const folderRootId = null;

    if (pack.locked) {
        await pack.configure({ locked: false });
    }

    async function createFolderGetId(name, color, parentFolderId) {
        const folder = await foundry.documents.Folder.create(
            { name, type: "Item", color, folder: parentFolderId },
            {
                pack: pack.metadata.id,
            },
        );

        return folder.id;
    }

    function standardPrepareItemsForFolder(folderId) {
        return function (power) {
            const itemData = HeroSystem6eItem.itemDataFromXml(power.xml, bogusActor);
            itemData.system.versionHeroSystem6eManuallyCreated = game.system.version;
            itemData.folder = folderId;

            return itemData;
        };
    }

    //////////////////////////////////////////////////////////////////////////////
    // POWERS and skill, perk, characteristic, and talent sub folders
    const folderPowersId = await createFolderGetId("Powers", CONFIG.HERO.folderColors["Powers"], folderRootId);

    const preparedPowers = [];

    const allPowers = powers.filter(
        (power) =>
            power.type != undefined &&
            !power.type.includes("martial") &&
            !power.type.includes("enhancer") &&
            !power.type.includes("disadvantage") &&
            !power.behaviors.includes("modifier") &&
            !power.behaviors.includes("adder") &&
            power.xml &&
            !power.key.startsWith("__"),
    );
    for (const power of allPowers) {
        const itemData = HeroSystem6eItem.itemDataFromXml(power.xml, bogusActor);
        itemData.system.versionHeroSystem6eManuallyCreated = game.system.version;
        if (power.type.includes("characteristic")) {
            continue; //itemData.folder = folderPowersCharacteristicsId;
        } else if (power.type.includes("perk")) {
            continue;
        } else if (power.type.includes("skill") && !power.xml.includes("<POWER")) {
            // FINDWEAKNESS special case requires the <POWER check
            continue;
        } else if (power.type.includes("talent")) {
            continue;
        } else if (power.type.includes("martial") || power.xml.includes("<MANEUVER")) {
            continue;
        } else if (itemData.system.XMLID !== "LIST") {
            // LIST will not be in a folder (to match SEPARATOR below)
            itemData.folder = folderPowersId;
        }

        preparedPowers.push(itemData);
    }

    // SEPARATOR is a LIST with no name
    const seperatorItemData = HeroSystem6eItem.itemDataFromXml(
        powers.find((power) => power.key === "LIST")?.xml,
        bogusActor,
    );
    if (seperatorItemData.name) {
        seperatorItemData.name = "Separator";
        seperatorItemData.system.ALIAS = "";
        seperatorItemData.system.NAME = "";
        preparedPowers.push(seperatorItemData);
    } else {
        console.error(`Failed to create separator item`);
    }

    //////////////////////////////////////////////////////////////////////////////
    // PERKS and PERK ENHANCERS as separate folder
    const folderPerksId = await createFolderGetId("Perks", CONFIG.HERO.folderColors["Perks"], folderRootId);
    const folderPerkEnhancersId = await createFolderGetId(
        "Perk Enhancers",
        CONFIG.HERO.folderColors["Perks.Enhancers"],
        folderPerksId,
    );

    const allPerks = powers.filter((power) => power.type?.includes("perk") && power.xml);
    const allPerksExceptPerkEnhancers = allPerks.filter((perk) => !perk.type.includes("enhancer"));
    const allPerkEnhancers = allPerks.filter((perk) => perk.type.includes("enhancer"));
    const preparedPerks = [
        ...allPerksExceptPerkEnhancers.map(standardPrepareItemsForFolder(folderPerksId)),
        ...allPerkEnhancers.map(standardPrepareItemsForFolder(folderPerkEnhancersId)),
    ];

    //////////////////////////////////////////////////////////////////////////////
    // SKILLS and SKILL ENHANCERS as separate folder
    const folderSkillsId = await createFolderGetId("Skills", CONFIG.HERO.folderColors["Skills"], folderRootId);
    const folderSkillEnhancersId = await createFolderGetId(
        "Skill Enhancers",
        CONFIG.HERO.folderColors["Skills.Enhancers"],
        folderSkillsId,
    );

    // FINDWEAKNESS is a POWER that behaves like a SKILL
    const allSkills = powers.filter(
        (power) => power.type?.includes("skill") && power.xml && !power.xml.includes("<POWER"),
    );
    const allSkillsExceptSkillEnhancers = allSkills.filter((skill) => !skill.type.includes("enhancer"));
    const allSkillEnhancers = allSkills.filter((skill) => skill.type.includes("enhancer"));
    const preparedSkills = [
        ...allSkillsExceptSkillEnhancers.map(standardPrepareItemsForFolder(folderSkillsId)),
        ...allSkillEnhancers.map(standardPrepareItemsForFolder(folderSkillEnhancersId)),
    ];

    //////////////////////////////////////////////////////////////////////////////
    // TALENTS
    const folderTalentsId = await createFolderGetId("Talents", CONFIG.HERO.folderColors["Talents"], folderRootId);

    const allTalents = powers.filter((power) => power.type?.includes("talent") && power.xml);
    const preparedTalents = allTalents.map(standardPrepareItemsForFolder(folderTalentsId));

    //////////////////////////////////////////////////////////////////////////////
    // DISADVANTAGES/COMPLICATIONS
    const folderDisadvantagesId = await createFolderGetId(
        edition === "five" ? "Disadvantages" : "Complications",
        CONFIG.HERO.folderColors["Disadvantages"],
        folderRootId,
    );

    // PH: FIXME: Some disadvantages are adders etc. Perhaps we should better describe them? Exclude them based on missing name here.
    const allDisadvantages = powers.filter((power) => power.type?.includes("disadvantage") && power.xml);
    const preparedDisadvantages = allDisadvantages
        .map(standardPrepareItemsForFolder(folderDisadvantagesId))
        .filter((preparedItem) => preparedItem.name);

    // Compendium should be unlocked, but for some reason it may not be
    if (pack.locked) {
        console.error(`${pack.name} compendium was unexpectedly locked`);
        await pack.configure({ locked: false });
    }

    // Create the array of items in the compendium
    try {
        await createItem(
            [...preparedPowers, ...preparedPerks, ...preparedSkills, ...preparedTalents, ...preparedDisadvantages],
            pack.metadata.id,
        );
    } catch (e) {
        console.error(e);
    }

    // Lock Compendium
    await pack.configure({ locked: true });
}
