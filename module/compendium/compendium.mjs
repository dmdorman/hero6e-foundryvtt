export class HeroSystem6eCompendium extends foundry.applications.sidebar.apps.Compendium {
    static HERO_COMPENDIUM_INDEX_FIELDS = ["system.PARENTID", "system.XMLID", "system.ID", "system.is5e"];
    static HERO_CONTAINER_XMLIDS = ["LIST", "COMPOUNDPOWER", "MULTIPOWER", "VPP"];

    #dragDrop;

    constructor(options = {}) {
        super(options);
        this.#dragDrop = this.#createDragDropHandlers();
    }

    /** @override (sorta)*/
    static get DEFAULT_OPTIONS() {
        const superDefaultOptions = super.DEFAULT_OPTIONS;
        return foundry.utils.mergeObject(superDefaultOptions, {
            classes: [...superDefaultOptions.classes, "hero-system-compendium"],
            dragDrop: [
                {
                    dragSelector: ".directory-item, .folder",
                    dropSelector: ".directory-list, .folder, .directory, section.window-content",
                },
            ],
        });
    }

    #createDragDropHandlers() {
        return this.options.dragDrop.map((dragDropHandler) => {
            dragDropHandler.permissions = {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this),
            };
            dragDropHandler.callbacks = {
                dragstart: this._onDragStart.bind(this),
                dragover: this._onDragOver?.bind(this) ?? ((ev) => ev.preventDefault()),
                drop: this._onDrop.bind(this),
                dragenter: this._onDragEnter?.bind(this) ?? ((ev) => ev.preventDefault()),
                dragleave: this._onDragLeave?.bind(this) ?? (() => {}),
            };
            return new foundry.applications.ux.DragDrop(dragDropHandler);
        });
    }

    /** @override */
    async _prepareContext(options) {
        // 1. Ensure required index fields exist before parts prepare their context
        const hasFields = HeroSystem6eCompendium.HERO_COMPENDIUM_INDEX_FIELDS.every(
            (field) => this.collection.index.get(this.collection.index.keys().next().value)?.[field] !== undefined,
        );

        if (!hasFields && this.collection.index.size > 0) {
            await this.collection.getIndex({
                fields: HeroSystem6eCompendium.HERO_COMPENDIUM_INDEX_FIELDS,
                force: true,
            });
        }

        return super._prepareContext(options);
    }

    /** @override */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);

        // 2. Tree filtering runs specifically when rendering the "directory" part
        if (partId === "directory" && context.tree) {
            const folderNames = new Set(Array.from(this.collection.folders.values()).map((f) => f.name));

            const filterEntries = (entries) => {
                if (!entries || !Array.isArray(entries)) return entries;

                return entries.filter((entry) => {
                    const entryId = entry.id || entry._id;
                    const indexEntry = this.collection.index.get(entryId);
                    const itemName = indexEntry?.name;
                    const xmlId = indexEntry?.system?.XMLID;

                    const isContainer = HeroSystem6eCompendium.HERO_CONTAINER_XMLIDS.includes(xmlId);

                    return !(isContainer && folderNames.has(itemName));
                });
            };

            if (context.tree.entries) {
                context.tree.entries = filterEntries(context.tree.entries);
            }

            const filterNodes = (nodes) => {
                if (!nodes || !Array.isArray(nodes)) return;

                for (const node of nodes) {
                    if (node.entries) {
                        node.entries = filterEntries(node.entries);
                    }
                    if (node.children) {
                        filterNodes(node.children);
                    }
                }
            };

            if (context.tree.children) {
                filterNodes(context.tree.children);
            }
        }

        return context;
    }

    /** @override */
    async _onRender(context, options) {
        await super._onRender(context, options);

        const element = this.element;
        if (!element) return;

        this.#dragDrop.forEach((d) => d.bind(element));

        // 1. Remove creation action buttons
        element
            .querySelectorAll(
                '.create-button, [data-action="createFolder"], [data-action="createEntry"], button.icon-plus',
            )
            .forEach((btn) => btn.remove());

        // 2. Add edition classes on item entries
        const itemElements = element.querySelectorAll(".directory-item:not(.folder), .entry, .directory-entry");
        itemElements.forEach((itemEl) => {
            if (itemEl.classList.contains("folder")) return;

            const entryId = itemEl.dataset.entryId || itemEl.dataset.documentId || itemEl.dataset.id;
            if (!entryId) return;

            const indexEntry = this.collection.index.get(entryId);
            if (indexEntry && HeroSystem6eCompendium.HERO_CONTAINER_XMLIDS.includes(indexEntry.system?.XMLID)) return;

            const system = indexEntry?.system || {};
            const edition = system.is5e ? "5" : "6";

            itemEl.classList.add(`hero-edition-${edition}`);
        });

        // 3. Add edition classes and edit controls on folder headers
        const folderElements = element.querySelectorAll(".folder");
        folderElements.forEach((folderEl) => {
            const headerEl = folderEl.querySelector(".folder-header") || folderEl;
            const folderNameEl = folderEl.querySelector(".folder-name");
            if (!folderNameEl) return;

            const folderName = folderNameEl.textContent.trim();

            const parentEntry = Array.from(this.collection.index.values()).find(
                (o) =>
                    (o.name === folderName || o.name?.trim() === folderName) &&
                    HeroSystem6eCompendium.HERO_CONTAINER_XMLIDS.includes(o.system?.XMLID),
            );

            const system = parentEntry?.system || {};
            const edition = system.is5e ? "5" : "6";

            headerEl.classList.add(`hero-edition-${edition}`);

            if (parentEntry) {
                const xmlId = parentEntry.system.XMLID.toLowerCase();
                folderEl.classList.add("hero-parent-folder", `hero-folder-${xmlId}`);
                headerEl.classList.add("hero-parent-header", `hero-header-${xmlId}`);

                let controlsEl =
                    folderEl.querySelector(".folder-controls") ||
                    folderEl.querySelector(".directory-item-controls") ||
                    headerEl;
                if (controlsEl && !controlsEl.querySelector(".hero-compound-edit")) {
                    const editBtn = document.createElement("a");
                    editBtn.className = "hero-compound-edit item-control";
                    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                    editBtn.title = `Edit ${parentEntry.name} Sheet`;

                    editBtn.addEventListener("click", async (ev) => {
                        ev.stopPropagation();
                        const doc = await this.collection.getDocument(parentEntry._id);
                        if (doc) doc.sheet.render(true);
                    });

                    const actionBtn = controlsEl.querySelector("[data-action], .fa-suitcase, .fa-backpack, button, a");
                    if (actionBtn && actionBtn !== editBtn) {
                        controlsEl.insertBefore(editBtn, actionBtn);
                    } else {
                        controlsEl.appendChild(editBtn);
                    }
                }
            }
        });
    }

    /** @override */
    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.getDragEventData(event);
        if (!data || data.type !== "Item") {
            return super._onDrop(event);
        }

        event.preventDefault();
        event.stopPropagation();

        let item;
        let actor = null;
        if (data.actorId) {
            actor = game.actors.get(data.actorId);
            item = actor?.items.get(data.uuid?.split(".").pop()) ?? (await fromUuid(data.uuid));
        } else {
            item = await fromUuid(data.uuid);
        }

        if (!item) {
            console.error("Missing item for drop UUID:", data.uuid);
            return;
        }

        const compendiumName = this.collection.metadata.label || this.collection.title;

        if (item.system?.isFreeStuff || item.isFreeStuff) {
            ui.notifications.warn(
                `<b>${item.name}</b> was not added to <b>${compendiumName}</b> because it is already included for all appropriate actors.`,
            );
            return;
        }

        const target = event.target.closest(".directory-item, .folder");
        const closestFolder = target ? target.closest(".folder") : null;
        if (closestFolder) closestFolder.classList.remove("droptarget");

        let folderTarget = closestFolder ? await fromUuid(closestFolder.dataset.uuid) : null;

        const childItems =
            item.childItems?.length > 0
                ? item.childItems
                : actor
                  ? actor.items.filter((i) => i.system?.PARENTID === item.system?.ID || i.system?.PARENTID === item.id)
                  : [];

        if (folderTarget) {
            // Determine the target item type required by the folder name/category
            const targetType = this._getCategoryTypeFromFolderName(folderTarget.name);

            if (targetType) {
                // Collect the root item and all child items to validate as a complete unit
                const itemsToValidate = [item, ...childItems];

                // Check if any item in the tree fails the conversion/folder validity check
                const invalidItems = itemsToValidate.filter((i) => {
                    return !i.isValidTypeConversion(targetType);
                });

                if (invalidItems.length > 0) {
                    const invalidNames = Array.from(new Set(invalidItems.map((i) => i.name))).join(", ");
                    return ui.notifications.warn(
                        `Cannot place contents into <b>${folderTarget.name}</b>. Incompatible item(s): <b>${invalidNames}</b>.`,
                    );
                }
            }
        }

        const packId = this.collection.collection;

        // Internal drop: Item is already in this compendium
        if (item.pack && item.pack === packId) {
            if (folderTarget) {
                const docId = data.uuid.split(".").pop();
                const doc = await this.collection.getDocument(docId);
                if (doc) {
                    await doc.update({ folder: folderTarget.id });

                    // Re-index with system fields and re-render
                    await this.collection.getIndex({
                        fields: HeroSystem6eCompendium.HERO_COMPENDIUM_INDEX_FIELDS,
                        force: true,
                    });
                    this.render();
                }
            }
            return;
        }

        // External drop: Item came from outside this compendium
        if (!folderTarget && item.type) {
            let itemTypeKey = item.type.toLowerCase();
            let categoryName = "";

            if (itemTypeKey === "disadvantage") {
                categoryName = "Disadvantages";
            } else if (itemTypeKey === "complication") {
                categoryName = "Complications";
            } else if (itemTypeKey === "martialarts" || itemTypeKey === "martial art") {
                categoryName = "Martial Arts";
            } else {
                if (!itemTypeKey.endsWith("s")) itemTypeKey += "s";
                categoryName = itemTypeKey.charAt(0).toUpperCase() + itemTypeKey.slice(1);
            }

            const folderColor =
                CONFIG.HERO?.folderColors?.[categoryName] ??
                CONFIG.HERO?.folderColors?.[item.type] ??
                (categoryName === "Complications" || categoryName === "Disadvantages"
                    ? "#ffcc00"
                    : categoryName === "Martial Arts"
                      ? "#d35400"
                      : null);

            folderTarget = Array.from(this.collection.folders.values()).find(
                (f) => f.name.toLowerCase() === categoryName.toLowerCase() && !f.folder,
            );

            if (!folderTarget) {
                folderTarget = await Folder.create(
                    {
                        type: "Item",
                        name: categoryName,
                        folder: null,
                        color: folderColor,
                    },
                    { pack: packId },
                );
            }
        }

        if (childItems.length === 0) {
            await HeroSystem6eItem.create(
                {
                    ...item.toObject(),
                    folder: folderTarget?.id ?? null,
                },
                { pack: packId },
            );
        } else {
            await this.dropFrameworkItem(folderTarget, item, childItems, actor);
        }

        // Force complete index update with required system fields before re-rendering tree
        await this.collection.getIndex({
            fields: HeroSystem6eCompendium.HERO_COMPENDIUM_INDEX_FIELDS,
            force: true,
        });
        this.render();
    }

    /**
     * Map folder names to their expected system item type for validation checks
     * @param {string} folderName
     * @returns {string|null}
     */
    _getCategoryTypeFromFolderName(folderName) {
        const lower = folderName.toLowerCase();
        if (lower.includes("perk")) return "perk";
        if (lower.includes("disadvantage") || lower.includes("complication")) return "disadvantage";
        if (lower.includes("skill")) return "skill";
        if (lower.includes("martial")) return "martialarts";
        if (lower.includes("power")) return "power";
        if (lower.includes("equipment")) return "equipment";
        return null;
    }

    async dropFrameworkItem(folderTarget, item, childItems = [], actor = null) {
        const packId = this.collection.collection;
        const compendiumName = this.collection.metadata.label || this.collection.title;

        const newFolder = await Folder.create(
            { type: "Item", name: item.name, folder: folderTarget?.id ?? null },
            { pack: packId },
        );

        await HeroSystem6eItem.create(
            {
                ...item.toObject(),
                folder: newFolder?.id,
            },
            { pack: packId },
        );

        for (const child of childItems) {
            if (child.system?.isFreeStuff || child.isFreeStuff) {
                ui.notifications.warn(
                    `<b>${child.name}</b> was not added to <b>${compendiumName}</b> because it is already included for all appropriate actors.`,
                );
                continue;
            }

            const nestedChildren =
                child.childItems?.length > 0
                    ? child.childItems
                    : actor
                      ? actor.items.filter(
                            (i) => i.system?.PARENTID === child.system?.ID || i.system?.PARENTID === child.id,
                        )
                      : [];

            if (nestedChildren.length > 0) {
                await this.dropFrameworkItem(newFolder, child, nestedChildren, actor);
            } else {
                await HeroSystem6eItem.create(
                    {
                        ...child.toObject(),
                        folder: newFolder?.id,
                    },
                    { pack: packId },
                );
            }
        }
    }

    /**
     * Handle folder deletion by updating index and re-rendering context tree
     * @override
     */
    async _onDeleteFolders(folders) {
        // Allow core to remove the folder from the pack
        await super._onDeleteFolders(folders);

        // Force a re-index of custom system fields for reparented items
        await this.collection.getIndex({
            fields: HeroSystem6eCompendium.HERO_COMPENDIUM_INDEX_FIELDS,
            force: true,
        });

        this.render();
    }

    /** @override */
    _configureRenderOptions(options) {
        super._configureRenderOptions(options);

        // Ensure index is refreshed if documents or folders change underneath
        this.collection.getIndex({
            fields: HeroSystem6eCompendium.HERO_COMPENDIUM_INDEX_FIELDS,
        });
    }

    /** @override */
    _getFolderContextOptions() {
        const options = super._getFolderContextOptions();

        // 1. Remove "FOLDER.Remove" (Remove Folder & keep contents)
        const filteredOptions = options.filter((option) => option.label !== "FOLDER.Remove");

        // 2. Intercept "FOLDER.Delete" (Delete All) to fix core's orphan bug
        const deleteAllOption = filteredOptions.find((option) => option.label === "FOLDER.Delete");

        if (deleteAllOption) {
            deleteAllOption.callback = async (header) => {
                const folderId = header.closest(".folder")?.dataset.folderId;
                const folder = this.collection.folders.get(folderId);
                if (!folder) return;

                const confirmed = await foundry.applications.api.DialogV2.confirm({
                    window: { title: `${game.i18n.localize("FOLDER.Delete")}: ${folder.name}` },
                    content: `<p>Are you sure? This will permanently delete <strong>${folder.name}</strong> and all items inside it.</p>`,
                    rejectClose: false,
                });

                if (!confirmed) return;

                // Find all items belonging directly or recursively to this folder
                const childFolderIds = new Set([folderId]);
                for (const f of this.collection.folders.values()) {
                    if (f.folder?.id === folderId || childFolderIds.has(f.folder?.id)) {
                        childFolderIds.add(f.id);
                    }
                }

                // Gather document IDs stored inside these folders
                const itemIdsToDelete = this.collection.index
                    .filter((indexEntry) => childFolderIds.has(indexEntry.folder))
                    .map((indexEntry) => indexEntry._id);

                // Delete all contained documents explicitly first
                if (itemIdsToDelete.length > 0) {
                    await HeroSystem6eItem.deleteDocuments(itemIdsToDelete, { pack: this.collection.collection });
                }

                // Delete the folder record itself
                await folder.delete();

                // Re-index custom fields and refresh view
                await this.collection.getIndex({
                    fields: HeroSystem6eCompendium.HERO_COMPENDIUM_INDEX_FIELDS,
                    force: true,
                });
                this.render();
            };
        }

        return filteredOptions;
    }
}
