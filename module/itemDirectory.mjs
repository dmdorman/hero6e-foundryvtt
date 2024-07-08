// eslint-disable-next-line no-undef
export class HeroSystem6eItemDirectory extends ItemDirectory {
    async _handleDroppedFolder(target, data) {
        console.log("_handleDroppedFolder", target, data);
        super._handleDroppedFolder(target, data);
    }

    async _handleDroppedEntry(target, data) {
        console.log("_handleDroppedEntry", target, data);

        const item = await fromUuid(data.uuid);
        if (!item) {
            console.error("missing item", data.uuid);
            return;
        }

        // Don't allow framework items to be moved within ItemDirectory (they should drag/drop the folder)
        if (item.childItems && item.uuid.startsWith("Item")) {
            return ui.notifications.warn(
                `"Drag/drop <b>${item.name}</b> item is not allowed in item sidebar. Use folder instead"`,
            );
        }

        // Do super if there is no parent or if this framework is already in ItemDirectory
        if (!item.childItems) {
            return super._handleDroppedEntry(target, data);
        }

        // Find folder we ard dropping to
        const closestFolder = target ? target.closest(".folder") : null;
        if (closestFolder) closestFolder.classList.remove("droptarget");
        const folderTarget = closestFolder ? await fromUuid(closestFolder.dataset.uuid) : null;

        // Create new folder
        await this.dropFrameworkItem(folderTarget, item);
    }

    async dropFrameworkItem(folderTarget, item) {
        if (item.childItems) {
            const newFolder = await Folder.create({ type: "Item", name: item.name, folder: folderTarget?.id });
            await HeroSystem6eItem.create({
                ...item.toObject(),
                folder: newFolder?.id,
            });
            for (const childItem of item.childItems) {
                await this.dropFrameworkItem(newFolder, childItem);
            }
        } else {
            await HeroSystem6eItem.create({
                ...item.toObject(),
                folder: folderTarget?.id,
            });
        }
    }
}
