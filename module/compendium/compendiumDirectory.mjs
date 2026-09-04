import { xmlToJsonNode } from "../utility/xml-to-json.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { getPowerInfo } from "../utility/util.mjs";
import { HeroSystem6eCompendium } from "./compendium.mjs";

const { DialogV2 } = foundry.applications.api;
const { CompendiumDirectory } = foundry.applications.sidebar.tabs;
const { CompendiumCollection } = foundry.documents.collections;
const { renderTemplate } = foundry.applications.handlebars;
const { FormDataExtended } = foundry.applications.ux;

/**
 * Custom Compendium Directory sidebar tab for Hero System 6e.
 * Extends core CompendiumDirectory to support direct Hero Designer Prefab (.hdp) batch uploads.
 */
export class HeroSystem6eCompendiumDirectory extends CompendiumDirectory {
    constructor(...args) {
        super(...args);
    }

    /**
     * Handle creation of a new compendium entry from the sidebar directory.
     * Overrides core behavior to support both standard compendium creation
     * and batch-uploading Hero Designer prefab (.hdp) or character (.hdc) files
     * to automatically generate and populate an Item compendium.
     *
     * @param {PointerEvent} event - The originating click event.
     * @param {HTMLElement} [target] - The target element that triggered the action.
     * @returns {Promise<void>}
     */
    async _onCreateEntry(event, target) {
        try {
            event.preventDefault();
            event.stopPropagation();

            target = target || event.target;
            const { folderId } = target.closest(".directory-item")?.dataset ?? {};

            // Prepare Document Type selections
            const types = CONST.COMPENDIUM_DOCUMENT_TYPES.map((documentName) => ({
                value: documentName,
                label: game.i18n.localize(getDocumentClass(documentName).metadata.label),
            }));
            game.i18n.sortObjects(types, "label");

            const folders = game.packs._formatFolderSelectOptions();

            // Render create template (handles v12/v13+ extension compatibility)
            const templatePath = `templates/sidebar/compendium-create.${
                game.version.split(".")[0] === "12" ? "html" : "hbs"
            }`;
            const htmlString = await renderTemplate(templatePath, {
                types,
                folders,
                folder: folderId,
                hasFolders: folders.length,
            });

            // Wrap the rendered HTML in a container element
            const content = document.createElement("div");
            content.innerHTML = htmlString;

            // Build the Hero Designer file upload form-group cleanly using elements
            const formGroup = document.createElement("div");
            formGroup.className = "form-group";

            const label = document.createElement("label");
            label.innerText = "Hero Designer Prefabs";

            const formFields = document.createElement("div");
            formFields.className = "form-fields";

            const inputFile = document.createElement("input");
            inputFile.name = "upload";
            inputFile.className = "upload";
            inputFile.type = "file";
            inputFile.accept = "*.*";
            inputFile.multiple = true;

            const hint = document.createElement("p");
            hint.className = "hint";
            hint.innerText =
                "Alternatively, select Hero Designer Prefab (.hdp) or character (.hdc) files using '*.*' to automatically generate and populate this compendium (compendium name will be overwritten by the file data, and document type will always be an Item pack).";

            formFields.appendChild(inputFile);
            formGroup.appendChild(label);
            formGroup.appendChild(formFields);
            formGroup.appendChild(hint);

            // Append to the bottom of the inner dialog content container (above the submit footer)
            const dialogContent = content.querySelector(".dialog-content") || content.querySelector("form");
            if (dialogContent) {
                dialogContent.appendChild(formGroup);
            } else {
                content.appendChild(formGroup);
            }

            /**
             * Attach file listener when the creation dialog renders
             */
            const handleRender = (_event, dialog) => {
                const inputUpload = dialog.element.querySelector("input.upload");

                inputUpload?.addEventListener("change", async (evt) => {
                    const files = Array.from(evt.target.files);

                    // Process each uploaded file sequentially
                    for (const file of files) {
                        try {
                            const contents = await file.text();
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(contents, "text/xml");

                            await HeroSystem6eCompendiumDirectory.uploadFromXml(xmlDoc, folderId);
                        } catch (err) {
                            console.error(`Failed to process Hero Designer file: ${file.name}`, err);
                        }
                    }

                    // Close the prompt window on upload completion
                    dialog.close();
                });
            };

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

            // If user closed dialog or uploaded files directly, bypass standard creation
            if (!metadata || metadata.upload) return;

            const targetFolderId = metadata.folder;
            delete metadata.folder;

            if (!metadata.label) {
                const count = game.packs.size;
                metadata.label = game.i18n.format(count ? "DOCUMENT.NewCount" : "DOCUMENT.New", {
                    count: count + 1,
                    type: game.i18n.localize("PACKAGE.TagCompendium"),
                });
            }

            // Create standard compendium pack
            const pack = await CompendiumCollection.createCompendium(metadata);

            // Assign for future sidebar double-clicks
            if (pack.metadata.type === "Item" || pack.documentName === "Item") {
                pack.applicationClass = HeroSystem6eCompendium;
            }

            if (targetFolderId) await pack.setFolder(targetFolderId);

            // Instantiate and render directly so _prepareContext runs immediately
            const app = new HeroSystem6eCompendium({ collection: pack });
            app.render(true);
        } catch (e) {
            console.error("Error creating compendium entry via HeroSystem6eCompendiumDirectory:", e);
            super._onCreateEntry(event, target);
        }
    }

    /**
     * Parses an XML Document object or string into a Compendium Pack filled with HeroSystem items and folders.
     * @param {XMLDocument|string} xml - XML document or raw string
     * @param {string} [targetFolderId] - ID of parent compendium folder
     * @returns {Promise<CompendiumCollection|void>}
     */
    static async uploadFromXml(xml, targetFolderId) {
        // Convert string to XML Document if necessary
        if (typeof xml === "string") {
            const parser = new DOMParser();
            xml = parser.parseFromString(xml.trim(), "text/xml");
        }

        // Convert XML representation into JSON tree
        const heroJson = {};
        xmlToJsonNode(heroJson, xml.children);

        // Standard prefabs use PREFAB, but renamed HDC files may fall back to CHARACTER
        const PREFAB = heroJson.PREFAB ?? heroJson.CHARACTER;
        const compendiumName = PREFAB?.CHARACTER_INFO?.CHARACTER_NAME?.trim();

        if (!compendiumName) {
            console.error("HeroSystem6e | Missing CHARACTER_NAME in XML Document:", xml);
            ui.notifications.error("Unable to parse Compendium Name from file.");
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

        // Determine item containers (lists, compound powers, frameworks)
        const isContainer = (itemData) => {
            const xmlId = itemData.system?.XMLID;
            if (["LIST", "COMPOUNDPOWER"].includes(xmlId)) return true;

            const powerInfo = getPowerInfo({
                xmlid: xmlId,
                is5e: itemData.system?.is5e,
            });
            return powerInfo?.type?.includes("framework") || powerInfo?.type?.includes("compound");
        };

        // Extract and sanitize item definitions from JSON
        let itemsToCreate = HeroSystem6eItem.parseItemsFromHeroJsonToItemDataArray(heroJson);

        // Remove empty containers without children
        itemsToCreate = itemsToCreate.filter(
            (i) => !isContainer(i) || itemsToCreate.some((i2) => i2.system.PARENTID === i.system.ID),
        );

        if (itemsToCreate.length === 0) {
            return ui.notifications.error(`${compendiumName} contains no valid items to import.`);
        }

        // Handle pre-existing compendium with identical generated name
        const packName = `world.${metadata.name}`;
        const existingPack = game.packs.get(packName);

        if (existingPack) {
            const confirmed = await DialogV2.confirm({
                window: { title: "Overwrite Compendium Entry" },
                content: `<p><strong>"${metadata.label}"</strong> already exists. Overwrite it?</p>`,
                rejectClose: false,
            });

            if (!confirmed) return;

            console.debug(`HeroSystem6e | Overwriting compendium ${packName}.`);
            await existingPack.configure({ locked: false });
            await existingPack.deleteCompendium();

            // Wait for database unbind and removal from global collection
            let retries = 0;
            while (game.packs.has(packName) && retries < 10) {
                await new Promise((resolve) => setTimeout(resolve, 50));
                retries++;
            }
        }

        // Create new compendium pack with safe name availability
        const pack = await CompendiumCollection.createCompendium(metadata);

        // Explicitly assign custom ApplicationV2 class before rendering
        if (pack.metadata.type === "Item" || pack.documentName === "Item") {
            pack.applicationClass = HeroSystem6eCompendium;
        }

        if (targetFolderId) {
            await pack.setFolder(targetFolderId);
        }

        ui.notifications.info(`Creating compendium ${pack.metadata.label} from Hero Designer file...`);

        const folders = {};

        try {
            for (const itemData of itemsToCreate) {
                // Determine root folder name based on type (e.g., POWER -> Powers)
                const folderTypeKey = itemData.type.toUpperCase();

                if (!folders[folderTypeKey]) {
                    const formattedName = `${folderTypeKey}S`.replace("EQUIPMENTS", "EQUIPMENT").titleCase();

                    folders[folderTypeKey] = await Folder.create(
                        {
                            type: "Item",
                            name: formattedName,
                            color: CONFIG.HERO?.folderColors?.[formattedName] ?? null,
                            sorting: "m", // Manual sorting matching HDP structure
                        },
                        { pack: pack.metadata.id },
                    );
                }

                // Parent folder assignment for sub-containers vs child items
                if (isContainer(itemData)) {
                    const parentFolder =
                        pack.contents.find((o) => o.system.ID === itemData.system.PARENTID)?.folder ||
                        folders[folderTypeKey];

                    const subFolder = await Folder.create(
                        {
                            type: "Item",
                            name: itemData.name,
                            folder: parentFolder?.id,
                            sorting: "m",
                            sort: itemData.sort,
                        },
                        { pack: pack.metadata.id },
                    );

                    itemData.folder = subFolder.id;
                } else if (itemData.system.PARENTID) {
                    // Child items bind to their parent container's folder if present
                    const parentFolder = pack.contents.find((o) => o.system.ID === itemData.system.PARENTID)?.folder;
                    itemData.folder = parentFolder ? parentFolder.id : folders[folderTypeKey]?.id;
                } else {
                    // Standard root-level items without a PARENTID go directly to the category folder
                    itemData.folder = folders[folderTypeKey]?.id;
                }

                await HeroSystem6eItem.create(itemData, { pack: pack.metadata.id });
            }

            ui.notifications.info(`Compendium ${pack.metadata.label} created successfully.`);

            // Instantiate and render your custom ApplicationV2 class directly
            const app = new HeroSystem6eCompendium({ collection: pack });
            app.render(true);

            return pack;
        } catch (e) {
            console.error("HeroSystem6e | Compendium generation failed:", e);
            ui.notifications.error(`Failed to upload compendium <b>${pack.metadata.label}</b>.`);
        }
    }
}
