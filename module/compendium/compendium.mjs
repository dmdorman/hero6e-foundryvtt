const HERO_CONTAINER_XMLIDS = ["LIST", "COMPOUNDPOWER", "MULTIPOWER", "VPP"];

export class HeroSystem6eCompendium extends foundry.applications.sidebar.apps.Compendium {
    /** @override */
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        classes: ["hero-system-compendium"],
    });

    /** @override */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);

        if (partId === "directory" && context.tree) {
            const folderNames = new Set(Array.from(this.collection.folders.values()).map((f) => f.name));

            const filterEntries = (entries) => {
                if (!entries || !Array.isArray(entries)) return entries;

                return entries.filter((entry) => {
                    const entryId = entry.id || entry._id;
                    const indexEntry = this.collection.index.get(entryId);
                    const itemName = indexEntry?.name;
                    const xmlId = indexEntry?.system?.XMLID;

                    const isContainer = HERO_CONTAINER_XMLIDS.includes(xmlId);

                    if (isContainer && folderNames.has(itemName)) {
                        return false;
                    }
                    return true;
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

        const folderElements = element.querySelectorAll(".directory-item.folder");

        folderElements.forEach((folderEl) => {
            const folderNameEl = folderEl.querySelector(".folder-name");
            if (!folderNameEl) return;
            const folderName = folderNameEl.textContent.trim();

            const parentEntry = Array.from(this.collection.index.values()).find(
                (o) => o.name === folderName && HERO_CONTAINER_XMLIDS.includes(o.system?.XMLID),
            );

            if (!parentEntry) return;

            const xmlId = parentEntry.system.XMLID.toLowerCase();
            folderEl.classList.add("hero-parent-folder", `hero-folder-${xmlId}`);

            const headerEl = folderEl.querySelector(".folder-header");
            if (headerEl) {
                headerEl.classList.add("hero-parent-header", `hero-header-${xmlId}`);
            }

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
        });
    }
}
