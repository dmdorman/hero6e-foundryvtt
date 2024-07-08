// Rebuild 6e Compendium Macro

const debug = {
    power: true,
    perk: true,
    skill: true,
    talent: true,
};

async function createItem(itemData, folder) {
    if (!itemData.system) {
        console.warn("missing system", itemData);
        return;
    }

    // Track when added manually for diagnostic purposes
    itemData.system.versionHeroSystem6eManuallyCreated = game.system.version;

    // Stick this item in the proper folder
    itemData.folder = folder[0].id;
    const item = await Item.createDocuments([itemData], {
        pack: folder[0].pack, //"hero6efoundryvttv2packs.hero6ePowers",
    });

    //console.log(item[0]);
    await item[0]._postUpload();
}

//////////////////////////////////////////////////////////////////////////////
// POWERS

for (const packName of ["hero6efoundryvttv2packs.hero6ePowers", "hero6efoundryvttv2packs.hero5ePowers"]) {
    console.log(packName);

    const myPack = game.packs.get(packName);
    if (myPack.locked) {
        console.log("Skipping locked pack", myPack);
        continue;
    }

    await myPack.getIndex();

    // Delete items
    const itemIds = [];
    for (const item of myPack.index) {
        itemIds.push(item._id);
    }
    await Item.deleteDocuments(itemIds, {
        pack: packName,
    });

    // Delete folders
    while (myPack.folders.size > 0) {
        for (const folder of myPack.folders) {
            //console.log(folder);

            // Make sure there are no children
            if (folder.children.length === 0) {
                await Folder.deleteDocuments([folder._id], {
                    pack: packName,
                });
            }
        }
    }

    const bogusActor = {
        system: { is5e: packName.includes("5") ? true : false },
    };

    if (debug.power) {
        const folderPower = await Folder.createDocuments([{ name: "Power", type: "Item", color: "#ff0000" }], {
            pack: packName,
        });

        const folderPowerCharacteristic = await Folder.createDocuments(
            [
                {
                    name: "Characteristic",
                    type: "Item",
                    color: "#ff6666",
                    folder: folderPower[0].id,
                },
            ],
            {
                pack: packName,
            },
        );

        const folderPowerPerk = await Folder.createDocuments(
            [
                {
                    name: "Perk",
                    type: "Item",
                    color: "#ff6666",
                    folder: folderPower[0].id,
                },
            ],
            {
                pack: packName,
            },
        );

        const folderPowerSkill = await Folder.createDocuments(
            [
                {
                    name: "Skill",
                    type: "Item",
                    color: "#ff6666",
                    folder: folderPower[0].id,
                },
            ],
            {
                pack: packName,
            },
        );

        const folderPowerTalent = await Folder.createDocuments(
            [
                {
                    name: "Talent",
                    type: "Item",
                    color: "#ff6666",
                    folder: folderPower[0].id,
                },
            ],
            {
                pack: packName,
            },
        );

        for (const power of (bogusActor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e).filter(
            (o) =>
                o.type != undefined &&
                !o.type.includes("martial") &&
                !o.type.includes("framework") &&
                !o.type.includes("enhancer") &&
                !o.type.includes("disadvantage") &&
                !o.behaviors.includes("modifier") &&
                !o.behaviors.includes("adder") &&
                o.xml,
        )) {
            // Only include powers where XML is defined
            const itemData = HeroSystem6eItem.itemDataFromXml(power.xml, bogusActor);
            console.log(power, itemData, bogusActor);
            if (power.type.includes("characteristic")) {
                await createItem(itemData, folderPowerCharacteristic);
            } else if (power.type.includes("perk")) {
                await createItem(itemData, folderPowerPerk);
            } else if (power.type.includes("skill")) {
                await createItem(itemData, folderPowerSkill);
            } else if (power.type.includes("talent")) {
                await createItem(itemData, folderPowerTalent);
            } else {
                await createItem(itemData, folderPower);
            }
            // console.log(itemData);
            // break;
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    // PERKS
    if (debug.perk) {
        const folderPerk = await Folder.createDocuments([{ name: "Perk", type: "Item", color: "#0000aa" }], {
            pack: packName,
        });

        for (const power of (bogusActor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e).filter(
            (o) => o.type.includes("perk") && o.xml,
        )) {
            // Only include powers where XML is defined
            const itemData = HeroSystem6eItem.itemDataFromXml(power.xml, bogusActor);
            await createItem(itemData, folderPerk);
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    // SKILLS
    if (debug.skill) {
        const folderSkill = await Folder.createDocuments([{ name: "Skill", type: "Item", color: "#00aa00" }], {
            pack: packName,
        });

        for (const power of (bogusActor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e).filter(
            (o) => o.type.includes("skill") && o.xml,
        )) {
            // Only include powers where XML is defined
            const itemData = HeroSystem6eItem.itemDataFromXml(power.xml, bogusActor);
            await createItem(itemData, folderSkill);
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    // TALENT
    if (debug.talent) {
        const folderTalent = await Folder.createDocuments([{ name: "Talent", type: "Item", color: "#00aaaa" }], {
            pack: packName,
        });

        for (const power of (bogusActor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e).filter(
            (o) => o.type.includes("talent") && o.xml,
        )) {
            // Only include powers where XML is defined
            const itemData = HeroSystem6eItem.itemDataFromXml(power.xml, bogusActor);
            await createItem(itemData, folderTalent);
        }
    }
}
