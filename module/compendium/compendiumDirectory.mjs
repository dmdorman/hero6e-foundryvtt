import { HeroSystem6eActor } from "../actor/actor.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { getPowerInfo } from "../utility/util.mjs";

const { DialogV2 } = foundry.applications.api;
const { CompendiumDirectory } = foundry.applications.sidebar.tabs;
const { CompendiumCollection } = foundry.documents.collections;
const { renderTemplate } = foundry.applications.handlebars;
const { FormDataExtended } = foundry.applications.ux;

export class HeroSystem6eCompendiumDirectory extends CompendiumDirectory {
    constructor(...args) {
        super(...args);
    }

    async _onCreateEntry(event, target) {
        try {
            event.preventDefault();
            event.stopPropagation();
            //const li = event.currentTarget.closest(".directory-item");
            //const targetFolderId = li ? li.dataset.folderId : null;
            target = target || event.target;
            const { folderId } = target.closest(".directory-item")?.dataset ?? {};

            const types = CONST.COMPENDIUM_DOCUMENT_TYPES.map((documentName) => {
                return {
                    value: documentName,
                    label: game.i18n.localize(getDocumentClass(documentName).metadata.label),
                };
            });
            game.i18n.sortObjects(types, "label");
            const folders = game.packs._formatFolderSelectOptions();

            let html = await renderTemplate(
                `templates/sidebar/compendium-create.${game.version.split(".")[0] === "12" ? "html" : "hbs"}`,
                {
                    types,
                    folders,
                    folder: folderId,
                    hasFolders: folders.length,
                },
            );
            html = html.replace(
                "Document.</p>",
                `Document.</p><label>Hero Designer Prefabs</label><input name="upload" class="upload" type="file" accept=".hdp" multiple></input>`,
            );

            // DialogV2RenderCallback
            function handleRender(event, dialog) {
                const inputUpload = dialog.element.querySelector("input.upload");
                inputUpload.addEventListener("change", (event) => {
                    const files = Array.from(event.target.files);
                    console.log(event, files);

                    files.forEach((file) => {
                        const reader = new FileReader();
                        reader.onload = async function (event) {
                            const contents = event.target.result;

                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(contents, "text/xml");

                            HeroSystem6eCompendiumDirectory.uploadFromXml(xmlDoc);
                        }.bind(this);

                        reader.readAsText(file);
                    });

                    // Close Create Compendium message box
                    $(event.currentTarget).closest(".window-content").find("button").click();
                });
            }

            const content = document.createElement("div");
            content.innerHTML = html;
            const metadata = await DialogV2.prompt({
                content,
                id: "create-compendium",
                window: { title: "COMPENDIUM.Create" },
                position: { width: 480 },
                ok: {
                    label: "COMPENDIUM.Create",
                    callback: (_event, button) => new FormDataExtended(button.form).object,
                },
                render: handleRender,
            });
            if (!metadata) return;
            if (metadata.upload) return;
            const targetFolderId = metadata.folder;
            delete metadata.folder;
            if (!metadata.label) {
                const count = game.packs.size;
                metadata.label = game.i18n.format(count ? "DOCUMENT.NewCount" : "DOCUMENT.New", {
                    count: count + 1,
                    type: game.i18n.localize("PACKAGE.TagCompendium"),
                });
            }
            const pack = await CompendiumCollection.createCompendium(metadata);
            if (targetFolderId) await pack.setFolder(targetFolderId);
        } catch (e) {
            console.error(e);
            super._onCreateEntry(event, target);
        }
    }

    static async uploadFromXml(xml, targetFolderId) {
        // Convert xml string to xml document (if necessary)
        if (typeof xml === "string") {
            const parser = new DOMParser();
            xml = parser.parseFromString(xml.trim(), "text/xml");
        }

        // Convert XML into JSON
        const heroJson = {};
        HeroSystem6eActor._xmlToJsonNode(heroJson, xml.children);

        // Properly build prefabs use PREFAB, but if an HDC file was simply renamed it may use CHARACTER as the root.
        const PREFAB = heroJson.PREFAB ?? heroJson.CHARACTER;

        // Character name is what's in the sheet or, if missing, what is already in the actor sheet.
        const compendiumName = PREFAB?.CHARACTER_INFO.CHARACTER_NAME.trim();

        if (!compendiumName || compendiumName.length === 0) {
            console.error("Missing CHARACTER_NAME ", xml);
            return;
        }

        const metadata = {
            label: compendiumName,
            name: compendiumName.slugify({ strict: true }),
            type: "Item",
            flags: {
                [`${game.system.id}.versionHeroSystem6eCreated`]: game.system.version,
            },
        };

        // Lets make sure the file has usable items before creating the compendium
        let itemsToCreate = HeroSystem6eItem.parseItemsFromHeroJsonToItemDataArray(heroJson);

        function isContainer(itemData) {
            // getPowerInfo can be expensive so a few shortcuts
            if (["LIST", "COMPOUNDPOWER"].includes(itemData.system.XMLID)) {
                return true;
            }

            // May not be needed, but included for now
            const powerInfo = getPowerInfo({
                xmlid: itemData.system.XMLID,
                is5e: itemData.system.is5e,
            });
            return powerInfo.type.includes("framework") || powerInfo.type.includes("compound");
        }

        // Remove any containers without children (likely a LIST or SEParator)
        itemsToCreate = itemsToCreate.filter(
            (i) => !isContainer(i) || itemsToCreate.find((i2) => i2.system.PARENTID === i.system.ID),
        );

        if (itemsToCreate.length === 0) {
            return ui.notifications.error(`${compendiumName} has no items from which to create a compendium.`);
        }

        // Does the compendium already exist? If so, prompt for delete.
        // Delete compendium so we can recreate it.
        const packName = `world.${metadata.name}`;
        const existingPack = game.packs.get(packName);
        if (existingPack) {
            const confirmed = await foundry.applications.api.DialogV2.confirm({
                window: { title: "Overwrite Compendium Entry" },
                content: `<p>"<strong>${metadata.label}</strong>" already exists in this compendium. Overwrite it?</p>`,
                rejectClose: false,
            });
            if (!confirmed) {
                return;
            }

            console.debug(`Overwriting existing compendium ${packName} on upload.`);
            await existingPack.configure({ locked: false });
            await existingPack.deleteCompendium();
        }

        // Create Compendium
        const pack = await CompendiumCollection.createCompendium(metadata);

        if (targetFolderId) {
            await pack.setFolder(targetFolderId);
        }

        ui.notifications.info(`Creating compendium ${pack.metadata.label} from Hero Designer Prefab file.`);

        const folders = [];

        try {
            for (const itemData of itemsToCreate) {
                // Create new root folder if needed
                const folderName = itemData.type.toUpperCase();
                if (!folders[folderName]) {
                    const name = `${folderName}S`.replace("EQUIPMENTS", "EQUIPMENT").titleCase();
                    folders[folderName] = await Folder.create(
                        {
                            type: "Item",
                            name: name,
                            color: CONFIG.HERO.folderColors[name],
                            sorting: "m", // Sort documents in this folder in the order of the HDP rather than alphabetically.
                        },
                        { pack: pack.metadata.id },
                    );
                }

                // If a container then make a new subfolder for it, in the proper folder structure
                if (isContainer(itemData)) {
                    const parentFolder =
                        pack.contents.find((o) => o.system.ID === itemData.system.PARENTID)?.folder ||
                        folders[folderName];
                    const subFolder = await Folder.create(
                        { type: "Item", name: itemData.name, folder: parentFolder, sorting: "m", sort: itemData.sort },
                        { pack: pack.metadata.id },
                    );
                    itemData.folder = subFolder.id;
                }

                // Is a child?
                else if (itemData.system.PARENTID) {
                    const parentFolder = pack.contents.find((o) => o.system.ID === itemData.system.PARENTID)?.folder;
                    if (parentFolder) {
                        itemData.folder = parentFolder.id;
                    } else {
                        console.warn(
                            `${itemData.system.ALIAS} ID=${itemData.system.ID} has an invalid PARENTID reference`,
                        );
                    }
                } else {
                    const parentFolder =
                        pack.contents.find((o) => o.system.ID === itemData.system.PARENTID)?.folder ||
                        folders[folderName];
                    itemData.folder = parentFolder.id;
                }

                await HeroSystem6eItem.create(itemData, { pack: pack.metadata.id });
            }

            ui.notifications.info(`Compendium ${pack.metadata.label} finished upload.`);
            pack.render(true);
        } catch (e) {
            console.log(e);
            ui.notifications.error(`Compendium <b>${pack.metadata.label}</b> failed to upload.`);
        }
    }
}
