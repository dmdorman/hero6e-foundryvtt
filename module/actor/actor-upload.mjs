import { HeroItemCharacteristic } from "../item/HeroSystem6eTypeDataModels.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { HeroProgressBar } from "../utility/progress-bar.mjs";
import { UploadPerformance } from "../utility/upload-performance.mjs";
import { formatDuration, getPowerInfo, utf8ToBase64, whisperUserTargetsForActor } from "../utility/util.mjs";
import { xmlToJsonNode } from "../utility/xml-to-json.mjs";

const { FilePicker } = foundry.applications.apps;
const { Item } = foundry.documents;

export async function uploadActorFromXml(actor, xml, options = {}) {
    // allowTokenActor: managed flows (the GM mass HDC reset) re-import a synthetic token
    // actor's own stored HDC; interactive uploads still belong on the prototype actor.
    if (actor.token && !options.allowTokenActor) {
        ui.notifications.error("Upload a linked actor is not supported. Use the prototype actor on the right sidebar.");
        return;
    }

    // Captured before any mutation so an upload failure can report the actor's original state and the incoming HDC.
    const originalActorJson = actor.id ? JSON.stringify(actor.toObject()) : null;
    const incomingHdcXml = typeof xml === "string" ? xml : new XMLSerializer().serializeToString(xml);

    // Transient marker (not the persisted uploading flag): the flag deliberately stays set
    // after a failed upload for the sheet's error display, and keying the per-item
    // active-effect guard off it would leave that actor's AE sync disabled forever.
    actor._uploadSweepActive = true;

    const uploadPerformance = new UploadPerformance("Parse XML");
    actor.lastUploadPerformance = uploadPerformance;

    // Shared state the stages build up: xml/heroJson/root from parsing, changes accumulated
    // for the core actor writes, item split results, retained pre-upload values.
    // silent covers both managed flows and quench runs: no chat, no progress UI.
    const ctx = {
        actor,
        options,
        silent: !!(options.silent || options.quenchUpload),
        uploadPerformance,
        xml,
        changes: {},
    };

    try {
        if (!parseHdcXml(ctx)) {
            // Managed flows (mass HDC reset) have no UI to notice the parser error and
            // would otherwise count this as a successful reset
            if (options.silent) {
                throw new Error("HDC failed to parse");
            }
            return;
        }
        captureRetainedValues(ctx);
        createUploadProgressBar(ctx);
        announceUploadStart(ctx);
        prepareCoreChanges(ctx);
        await applyEditionAndActorType(ctx);
        await applyCharacteristics(ctx);
        await rebuildAndAddFreeStuff(ctx);
        await syncItems(ctx);
        await applyActiveEffectsSweep(ctx);
        await applyVppSlotDefaults(ctx);
        await restoreFullHealth(ctx);
        await restoreRetainedResources(ctx);
        validateItems(ctx);
        await uploadImage(ctx);
        await saveCoreChanges(ctx);
        await restoreRetainedDamage(ctx);
        await finalizeUpload(ctx);
        await confirmDeleteExtraItems(ctx);
        reportDataModelErrors(ctx);
    } catch (e) {
        console.error(e);
        ui.notifications.error(`${actor.name} had errors during upload.`);
        if (actor.id) {
            await actor.setFlag(
                game.system.id,
                "uploadingError",
                e.stack.replace(/http(s)?:[/[a-z0-9_.-:()]+\//gi, ""),
            );

            // Diagnostic context for bug reports. base64 encode blobs so they survive copy/paste intact.
            await actor.setFlag(
                game.system.id,
                "uploadingErrorContext",
                buildUploadErrorContext({
                    actorBase64: originalActorJson ? utf8ToBase64(originalActorJson) : null,
                    hdcBase64: incomingHdcXml ? utf8ToBase64(incomingHdcXml) : null,
                }),
            );

            // Make sure we show the error we just posted to DB.
            // Needed for when the delete extra items has an error.
            await actor.setFlag(game.system.id, "uploading", true);
        }
    } finally {
        actor._uploadSweepActive = false;

        // Deferred from per-item _onUpdate during the sweep — owed even after a failed
        // upload, or the actor keeps stale encumbrance and token vision
        try {
            if (actor.id) {
                await actor.applyEncumbrancePenalty();
            }
            for (const token of actor.getActiveTokens()) {
                token.document._prepareDetectionModes();
                token.renderFlags.set({ refreshVisibility: true });
            }
        } catch (e) {
            console.error("Deferred encumbrance/vision refresh after upload failed", e);
        }
    }
}

// Environment block for the uploadingErrorContext flag; the sheet's error report reads these keys back.
export function buildUploadErrorContext(extra = {}) {
    return {
        foundry: game.release?.display || game.version,
        foundryBuild: game.release?.build ?? null,
        system: game.system.version,
        ...extra,
    };
}

function parseHdcXml(ctx) {
    // Convert xml string to xml document (if necessary)
    if (typeof ctx.xml === "string") {
        const parser = new DOMParser();
        ctx.xml = parser.parseFromString(ctx.xml.trim(), "text/xml");
    }

    // Check for parser error
    if (ctx.xml.getElementsByTagName("parsererror")?.[0]) {
        console.error(ctx.xml.getElementsByTagName("parsererror")[0].innerText);
        ui.notifications.error(`Parser Error. Verify file is a valid HDC file`);
        return false;
    }

    // Convert XML into JSON
    ctx.heroJson = {};
    xmlToJsonNode(ctx.heroJson, ctx.xml.children);

    ctx.root = ctx.heroJson.CHARACTER ?? ctx.heroJson.PREFAB; // Support loading a HDP as a HDC

    return true;
}

// Keep track of damage & charge uses, which we will apply at end of the upload
function captureRetainedValues(ctx) {
    const { actor } = ctx;

    ctx.retainValuesOnUpload = {
        body: parseInt(actor.system.characteristics?.body?.max) - parseInt(actor.system.characteristics?.body?.value),
        stun: parseInt(actor.system.characteristics?.stun?.max) - parseInt(actor.system.characteristics?.stun?.value),
        end: parseInt(actor.system.characteristics?.end?.max) - parseInt(actor.system.characteristics?.end?.value),
        hap: actor.system.hap?.value,
        heroicIdentity: actor.system.heroicIdentity ?? true,
        resources: actor.items
            .filter(
                (item) =>
                    (item.system.chargeItemModifier &&
                        (item.system._charges !== item.system.chargesMax ||
                            item.system._clips !== item.system.clipsMax)) ||
                    item.system.ablative > 0 ||
                    (item.system.XMLID === "ENDURANCERESERVE" && item.system.LEVELS !== item.system.value),
            )
            .map((o) => ({
                id: o.id,
                name: o.name,
                _charges: o.system._charges,
                _clips: o.system._clips,
                ablative: o.system.ablative,
                value: o.system.value,
            })),

        was5e: actor.is5e,
    };
}

function createUploadProgressBar(ctx) {
    const { actor, root, silent, uploadPerformance } = ctx;

    // Ticks delivered before close: one per HDC item on update/create (trued up via
    // addToMax once the exact split is known — compound children add items the root
    // arrays don't count), plus the fixed single-tick stage advances below
    // (VPP, fullHealth, validate, image, core save, custom adders).
    const fixedStageTicks = 6;
    ctx.hdcItemEstimate =
        (root.DISADVANTAGES?.length || 0) +
        (root.EQUIPMENT?.length || 0) +
        (root.MARTIALARTS?.length || 0) +
        (root.PERKS?.length || 0) +
        (root.POWERS?.length || 0) +
        (root.SKILLS?.length || 0) +
        (root.TALENTS?.length || 0);

    ctx.uploadProgressBar = new HeroProgressBar(
        `${actor.name}: Processing HDC file`,
        fixedStageTicks + ctx.hdcItemEstimate,
        {
            suppressUi: silent,
            tracker: uploadPerformance,
        },
    );
}

// Let GM know actor is being uploaded (unless it is a quench test; missing ID)
function announceUploadStart(ctx) {
    const { actor, silent } = ctx;

    if (!silent && actor.id) {
        // Fire and forget
        ChatMessage.create({
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            author: game.user._id,
            speaker: ChatMessage.getSpeaker({ actor }),
            whisper: whisperUserTargetsForActor(actor),
            content: `<b>${game.user.name}</b> is uploading <b>${actor.name}</b>`,
        });
    }
}

function prepareCoreChanges(ctx) {
    const { actor, options, root, uploadProgressBar, retainValuesOnUpload } = ctx;
    const changes = ctx.changes;

    // Character name is what's in the sheet or, if missing, what is already in the actor sheet.
    const characterName =
        root.CHARACTER_INFO.CHARACTER_NAME || options?.file?.name?.replace(/\.hdc$/i, "") || actor.name;
    actor.name = characterName;
    changes["name"] = characterName;
    uploadProgressBar.advance(`${characterName}: Name, fileInfo`, 0);

    // Flags (add them into the change set to cut down on update calls)
    changes[`flags.${game.system.id}.uploading`] = true;
    changes[`flags.${game.system.id}.file`] = {
        lastModifiedDate: options?.file?.lastModified,
        name: options?.file?.name,
        size: options?.file?.size,
        type: options?.file?.type,
        webkitRelativePath: options?.file?.webkitRelativePath,
        uploadedBy: game.user.name,
    };

    // Need to get the base64 image before we delete IMAGE, deepClone doesn't work as expected.
    uploadProgressBar.advance(`${actor.name}: Preprocess image`, 0);
    ctx.filename = root.IMAGE?.FileName;
    const extension = ctx.filename?.split(".").pop();
    ctx.base64 = "data:image/" + extension + ";base64," + ctx.xml.getElementsByTagName("IMAGE")?.[0]?.textContent;

    // Keep raw XML data without IMAGE. Intentionally mutates the parsed document
    // (deepClone can't copy an XMLDocument); the base64 image was captured above.
    const image = ctx.xml.getElementsByTagName("IMAGE")[0];
    image?.parentNode?.removeChild(image);
    actor.system._hdcXml = new XMLSerializer().serializeToString(ctx.xml);
    changes["system._hdcXml"] = actor.system._hdcXml;

    // Heroic Action Points (always keep the value)
    changes["system.hap.value"] = retainValuesOnUpload.hap;

    // Heroic Identity
    changes["system.heroicIdentity"] = retainValuesOnUpload.heroicIdentity;

    // game system version
    actor.system.versionHeroSystem6eUpload = game.system.version;
    changes["system.versionHeroSystem6eUpload"] = game.system.version;
}

// is5e
// keep track independently of item.system.is5e as targetType can reload it
// Assume true for those super old HDC files
async function applyEditionAndActorType(ctx) {
    const { actor, root, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: is5e`, 0);

    if (!actor.id) {
        return;
    }

    // Delete maneuvers (or any other existing items) that don't
    // match template prior to possibly changing is5e
    if (actor.is5ePreview(root.TEMPLATE) !== actor.system.is5e) {
        const itemsToDeleteIs5e = actor.items
            .filter((i) => i.system.is5e !== actor.is5ePreview(root.TEMPLATE))
            .map((m) => m.id);
        if (itemsToDeleteIs5e.length > 0) {
            console.warn(`Deleting ${itemsToDeleteIs5e.length} is5e mismatches`);
            await actor.deleteEmbeddedDocuments("Item", itemsToDeleteIs5e, {
                render: false,
            });
        }
    }

    // We can't delay this with the changes array because any items based on this actor needs this value.
    // Specifically compound power is a problem if we don't set is5e properly for a 5e actor.
    await actor.update(
        {
            ...ctx.changes,
            "system.is5e": actor.is5ePreview(root.TEMPLATE),
            "system.CHARACTER.BASIC_CONFIGURATION": root.BASIC_CONFIGURATION,
            "system.CHARACTER.CHARACTER_INFO": root.CHARACTER_INFO,
            "system.CHARACTER.TEMPLATE": root.TEMPLATE,
            "system.CHARACTER.version": root.version,
        },
        {
            render: true, // Need render to make sure the actor sidebar actor.name gets updated #4010
        },
    );
    ctx.changes = {};

    if (actor.is5e !== actor.system.is5e) {
        if (actor.name.startsWith("_Quench")) {
            console.error(`${actor.name} is5e mismatch`);
        }

        // Finally update is5e
        await actor.update({ "system.is5e": actor.is5e }, { render: false });
    }

    const targetType = actor._templateType
        .replace("builtIn.", "")
        .replace("6E", "")
        .replace(".hdt", "")
        .toLowerCase()
        .replace("base", "base2")
        .replace("normal", "pc")
        .replace("superheroic", "pc")
        .replace("heroic", "pc")
        .replace("standardsuper", "pc") // super old HDC
        .replace("main", "pc") // custom template
        .replace("competentpc", "pc"); // super old HDC

    if (targetType && actor.type.replace("npc", "pc") !== targetType) {
        if (Object.keys(game.system.documentTypes.Actor).includes(targetType)) {
            // REF: https://github.com/foundryvtt/foundryvtt/issues/13090
            // AARON WAS HERE on 4/4/2026: Update fails, likely a foundry bug.
            // Error: The type of a Document may only be changed if the system field
            //        is also updated with a ForcedReplacement operator.
            // A subsequent upload works, not ready for publish.
            await actor.update(
                {
                    type: targetType,
                    system: foundry.utils.mergeObject(actor.system.toObject(), { _type: targetType }),
                },
                { recursive: false },
            );
        } else {
            ui.notifications.error(`${targetType} is not a valid actor type`);
        }
    }
}

async function applyCharacteristics(ctx) {
    const { actor, root, uploadProgressBar } = ctx;

    if (!root?.CHARACTERISTICS) {
        return;
    }

    const changesNormal = {};
    const changesFiguredOrCalculated = {};
    uploadProgressBar.advance(`${actor.name}: CHARACTERISTICS`, 0);

    for (const [key, value] of Object.entries(root.CHARACTERISTICS)) {
        const _baseInfo = getPowerInfo({ XMLID: key, actor, xmlTag: key });

        actor.system[key] = new HeroItemCharacteristic(value, { parent: actor });

        if (_baseInfo?.behaviors.includes("calculated") || _baseInfo?.behaviors.includes("figured")) {
            changesFiguredOrCalculated[`system.${key}`] = actor.system[key];
        } else {
            changesNormal[`system.${key}`] = actor.system[key];
        }
    }
    delete root.CHARACTERISTICS;

    if (actor.id) {
        // Update normal values first
        await actor.update(changesNormal);

        // Then any figured or calculated characteristics
        await actor.update(changesFiguredOrCalculated);
    }
}

async function rebuildAndAddFreeStuff(ctx) {
    const { actor, options, uploadProgressBar } = ctx;

    if (options.rebuild) {
        uploadProgressBar.advance(`${actor.name}: Deleting existing items when rebuilding`, 0);
        await deleteItemsAndOrphanedEffects(actor, actor.items.contents, { render: false });
    }

    // NOTE: not concurrent with item creation because we create things in here that are
    // absolutely required by later items (e.g. strength placeholder).
    uploadProgressBar.advance(`${actor.name}: addFreeStuff`, 0);

    await actor.addFreeStuff();

    uploadProgressBar.advance(`${actor.name}: addFreeStuff completed`, 0);
}

async function syncItems(ctx) {
    const { actor, heroJson, uploadPerformance, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: Evaluating items`, 0);

    let itemsToCreate = HeroSystem6eItem.parseItemsFromHeroJsonToItemDataArray(heroJson, actor);

    uploadProgressBar.advance(`${actor.name}: Evaluated Items`, 0);

    uploadProgressBar.advance(`${actor.name}: Updating Items`, 0);

    // Working on a merge to update previously existing items.
    // Add existing item.id (if it exists), which we will use for the pending update.
    // There may be an item that was converted to equipment/power
    // system.ID is natively a string from HDC but coerced to Number in the dataModel,
    // so both maps key on String; first match wins to mirror items.find.
    const existingItemsByHdcId = new Map();
    const existingItemsById = new Map();
    for (const item of actor.items) {
        if (!existingItemsByHdcId.has(String(item.system.ID))) {
            existingItemsByHdcId.set(String(item.system.ID), item);
        }
        existingItemsById.set(item.id, item);
    }
    itemsToCreate = itemsToCreate.map((m) =>
        foundry.utils.mergeObject(m, {
            _id: existingItemsByHdcId.get(String(m.system.ID))?.id,
        }),
    );
    const itemsToUpdate = itemsToCreate.filter((o) => o._id);
    itemsToCreate = itemsToCreate.filter((o) => !o._id);

    // True up the estimate now that the exact item tick count is known
    uploadProgressBar.addToMax(itemsToUpdate.length + itemsToCreate.length - ctx.hdcItemEstimate);

    // Make sure itemsToUpdate have ADDER/MODIFIER/POWER array
    // Which allows a new HDC to remove ADDER during update, without it will never clear
    for (const itemToUpdate of itemsToUpdate) {
        itemToUpdate.system.ADDER ??= [];
        itemToUpdate.system.MODIFIER ??= [];
        itemToUpdate.system.POWER ??= [];
    }

    // If item.type is different then:
    // The type of a Document can be changed only if the system field
    // is force-replaced (==) or updated with {recursive: false}
    for (const item of itemsToUpdate) {
        const itemExisting = existingItemsById.get(item._id);
        if (itemExisting?.type !== item.type) {
            await ui.notifications.warn(`${item.name} changed from type=${itemExisting.type} to type=${item.type}`);

            try {
                const systemData = typeof item.system?.toObject === "function" ? item.system.toObject() : item.system;
                await itemExisting.update(
                    {
                        type: item.type,
                        system: foundry.utils.mergeObject(systemData, { _type: item.type }),
                    },
                    { recursive: false },
                );
            } catch (e) {
                console.error(e);
                ui.notifications.error(
                    `Failed to change ${item.name} from type=${itemExisting.type} to type=${item.type}`,
                );
            }
        }
    }

    // If a skill was previously marked as EVERYMAN, but now isn't we
    // need to remove the EVERYMAN value as for some reason HDC doesn't
    // specifically include EVERYMAN="No".  Seems like a HD bug.
    for (const item of itemsToUpdate.filter((item) => !item.system.EVERYMAN)) {
        const itemExisting = existingItemsById.get(item._id);
        if (itemExisting.system.EVERYMAN) {
            // HDC didn't reference EVERYMAN
            // so we will specify it as null (false)
            // so the update below will set the expected value
            console.warn(`Adding EVERYMAN to ${item.name} skill`);
            item.system.EVERYMAN = null;
        }
    }

    // If a TEXT was previously defined, but now isn't we
    // need to remove it as for some reason HDC doesn't
    // specifically include it.
    for (const item of itemsToUpdate.filter((item) => !item.system.TEXT)) {
        const itemExisting = existingItemsById.get(item._id);
        if (itemExisting.system.TEXT) {
            console.warn(`Adding TEXT to ${item.name}/${item.system.XMLID}`);
            item.system.TEXT = "";
        }
    }

    // If it was a childItem and now isn't
    // need to remove PARENTID as HDC doesn't
    // specifically include it.
    for (const item of itemsToUpdate.filter((item) => !item.system.PARENTID)) {
        const itemExisting = existingItemsById.get(item._id);
        if (itemExisting.system.PARENTID) {
            item.system.PARENTID = null;
        }
    }

    // update existing document, overwriting any MODIFIERS, etc
    await actor.updateEmbeddedDocuments("Item", itemsToUpdate);

    uploadProgressBar.advance(`${actor.name}: Updated Items`, itemsToUpdate.length);

    uploadProgressBar.advance(`${actor.name}: Creating Items`, 0);

    uploadPerformance.count("itemsUpdated", itemsToUpdate.length);
    uploadPerformance.count("itemsCreated", itemsToCreate.length);

    if (actor.id) {
        await actor.createEmbeddedDocuments("Item", itemsToCreate, { render: false, renderSheet: false });
    } else {
        // Temporary actor: createEmbeddedDocuments would silently create world items.
        for (const itemData of itemsToCreate) {
            const item = new HeroSystem6eItem(itemData, { parent: actor });
            actor.items.set(item.system.ID?.toString() || item.system.XMLID, item);
        }
    }

    uploadProgressBar.advance(`${actor.name}: Created Items`, itemsToCreate.length);

    ctx.itemsToCreate = itemsToCreate;
    ctx.itemsToUpdate = itemsToUpdate;
}

async function applyActiveEffectsSweep(ctx) {
    const { actor, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: Processing non characteristics`, 0);

    uploadProgressBar.advance(`${actor.name}: applyActiveEffects`, 0);
    const deferredEffectCreates = new Map();
    for (const item of actor.items) {
        // Authoritative sweep: bypasses the guard that suppresses the concurrent
        // per-item syncs the upload's own writes would otherwise trigger.
        await item.setActiveEffects({ render: false, duringUpload: true, deferredEffectCreates });
    }
    if (deferredEffectCreates.size > 0) {
        const effectUpdates = [];
        for (const [itemId, pendingEffects] of deferredEffectCreates) {
            const item = actor.items.get(itemId);
            if (!item) continue;
            effectUpdates.push({
                _id: itemId,
                // Full array replace, so existing effects must be carried along. Pending
                // data is normalized through the document constructor: it runs the same
                // migrateData a create would (e.g. legacy changes -> system.changes),
                // which an update delta would otherwise prune.
                effects: [
                    ...item.effects.map((ae) => ae.toObject()),
                    ...pendingEffects.map((effectData) =>
                        foundry.utils.mergeObject(
                            new CONFIG.ActiveEffect.documentClass(effectData, { parent: item }).toObject(),
                            { _id: foundry.utils.randomID() },
                        ),
                    ),
                ],
            });
        }
        await actor.updateEmbeddedDocuments("Item", effectUpdates, { render: false });
    }

    uploadProgressBar.advance(`${actor.name}: applySizeEffect`, 0);
    await actor.applySizeEffect();
}

async function applyVppSlotDefaults(ctx) {
    const { actor, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: VPP Slots auto selection`, 0);
    for (const vppItem of actor.items.filter((i) => i.system.XMLID === "VPP")) {
        // If no vppSlots then pick defaults (currently always defaults)
        if (!vppItem.childItems.find((i) => i.system.CARRIED)) {
            let vppSlottedCost = 0;
            const vppChanges = [];
            for (const slotItem of vppItem.childItems) {
                if (vppSlottedCost + slotItem.realCost <= vppItem.vppPoolPoints) {
                    vppChanges.push({ _id: slotItem.id, "system.CARRIED": true });
                    vppSlottedCost += slotItem.realCost;
                } else {
                    vppChanges.push({ _id: slotItem.id, "system.CARRIED": false });
                }
            }
            await actor.updateEmbeddedDocuments("Item", vppChanges);
        }
    }
    uploadProgressBar.advance(`${actor.name}: VPP iSlots auto selection complete`, 1);
}

// Make sure any powers with characteristic properties
// reflect in current VALUE.
// But we want to keep temporary effects (drains, aids, etc)
// so players can upload new HDC files without wiping out mid session AE's.
// Similar to retained data, were retaining (by not deleting) the temporary effects.
async function restoreFullHealth(ctx) {
    const { actor, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: Full Health`, 0);
    await actor.fullHealth({ keepTemporaryEffects: true });

    // Kluge to ensure characteristic values match max
    try {
        if (actor.id) {
            const changes = {};
            for (const [key, value] of Object.entries(actor._getFullHealthCharacteristicValues())) {
                if (actor.system.characteristics[key].value !== value) {
                    changes[`system.characteristics.${key}.value`] = value;
                }
            }
            if (Object.keys(changes).length > 0) {
                await actor.update(changes);
            }
        }
    } catch (e) {
        console.error(e);
    }
    uploadProgressBar.advance(`${actor.name}: Full Health complete`, 1);
}

async function restoreRetainedResources(ctx) {
    const { actor, retainValuesOnUpload, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: retainValuesOnUpload charges and ablative`, 0);
    const resourceUpdates = [];
    for (const resourceData of retainValuesOnUpload.resources) {
        const item = actor.items.get(resourceData.id);
        if (!item) {
            console.warn(`Unable to locate ${resourceData.name} to consume charges after upload.`);
            continue;
        }

        // Notice if charges or clips is lower than before we take the min #3302
        const update = {
            _id: item.id,
            "system._charges": Math.min(item.system.chargesMax, resourceData._charges),
            "system._clips": Math.min(item.system.clipsMax, resourceData._clips),
            "system.ablative": Math.max(item.system.ablative, resourceData.ablative),
        };
        if (item.system.XMLID === "ENDURANCERESERVE") {
            update["system.value"] = Math.min(item.system.value, resourceData.value);
        }
        resourceUpdates.push(update);
    }
    if (resourceUpdates.length > 0) {
        await actor.updateEmbeddedDocuments("Item", resourceUpdates);
    }
}

// Validate everything that's been imported
function validateItems(ctx) {
    const { actor, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: Validating powers`);

    for (const item of actor.items) {
        const power = item.baseInfo;

        // Power needs to exist
        if (!power) {
            ui.notifications.error(`${actor.name}/${item.detailedName()} has unknown power XMLID. Please report.`, {
                console: true,
                permanent: true,
            });
        } else if (!power.behaviors) {
            ui.notifications.error(
                `${actor.name}/${item.detailedName()} does not have behaviors defined. Please report.`,
                { console: true, permanent: true },
            );
        }
    }

    uploadProgressBar.advance(`${actor.name}: Processed non characteristics`, 0);
    uploadProgressBar.advance(`${actor.name}: Processed all items`, 0);
}

async function uploadImage(ctx) {
    const { actor, options, root, filename, base64, uploadProgressBar } = ctx;
    const changes = ctx.changes;

    uploadProgressBar.advance(`${actor.name}: Uploading image`, 0);

    if (actor.img.startsWith("tokenizer/") && game.modules.get("vtta-tokenizer")?.active) {
        await ui.notifications.warn(
            `Skipping image upload, because this token (${actor.name}) appears to be using tokenizer.`,
        );
    } else if (root.IMAGE) {
        const path = "worlds/" + game.world.id + "/tokens";
        let relativePathName = path + "/" + filename;

        // Create a directory if it doesn't already exist
        try {
            await FilePicker.createDirectory("user", path);
        } catch (error) {
            console.debug("create directory error", error);
        }

        // Set the image, uploading if not already in the file system
        try {
            const imageFileExists = (await FilePicker.browse("user", path)).files.includes(encodeURI(relativePathName));
            if (!imageFileExists) {
                await foundry.helpers.media.ImageHelper.uploadBase64(base64, filename, path);

                // FORGE stuff (because users add things into their own directories)
                if (typeof ForgeAPI !== "undefined") {
                    const forgeUser = (await ForgeAPI.status()).user;
                    relativePathName = `https://assets.forge-vtt.com/${forgeUser}/${relativePathName}`;
                }
            }

            changes["img"] = relativePathName;

            // Update any tokens images that might exist
            for (const token of actor.getActiveTokens()) {
                await token.document.update({
                    "texture.src": relativePathName,
                });
            }
        } catch (e) {
            console.error(e);
            ui.notifications.warn(
                `${actor.name} failed to upload ${filename}. Make sure user has [Use File Browser] and [Upload New Files] permissions. Also make sure the folder isn't in [Privacy Mode] indicated with a purple background within FoundryVTT.`,
            );
        }

        delete root.IMAGE;
    } else {
        // No image provided. Make sure we're using the default token.
        // Note we are overwriting any image that may have been there previously.
        // If they really want the image to stay, they should put it in the HDC file.
        // Prompt before overwriting token image #2831

        if (actor.img !== CONST.DEFAULT_TOKEN && !options.keepExistingImage) {
            new foundry.applications.api.DialogV2({
                window: { title: "Choose token image" },
                content: `
                <p>This HDC file does not include an image.</p>
                <p>Do you want to keep the existing token image or clear the image (${CONST.DEFAULT_TOKEN})?</p>`,
                buttons: [
                    {
                        action: "keepImage",
                        label: "Keep Existing Image",
                        default: true,
                    },
                    {
                        action: "defaultImage",
                        label: "Clear",
                        callback: async () => {
                            await actor.update({ ["img"]: CONST.DEFAULT_TOKEN });
                            // Update any tokens images that might exist
                            for (const token of actor.getActiveTokens()) {
                                await token.document.update({
                                    "texture.src": CONST.DEFAULT_TOKEN,
                                });
                            }
                        },
                    },
                ],
                submit: (result) => {
                    console.log(`User picked option: ${result}`);
                },
            }).render({ force: true });
        }
    }

    uploadProgressBar.advance(`${actor.name}: Uploaded image`);
}

async function saveCoreChanges(ctx) {
    const { actor, root, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: Saving core changes`, 0);

    // Non ITEMS stuff in CHARACTER (with data model this becomes less important)
    ctx.changes = {
        ...ctx.changes,
        "system.CHARACTER": root,
        "system.versionHeroSystem6eUpload": game.system.version,
    };

    if (actor.prototypeToken) {
        ctx.changes[`prototypeToken.name`] = actor.name;
        if (ctx.changes.img) {
            ctx.changes[`prototypeToken.texture.src`] = ctx.changes.img;
        }
    }

    // Save all our changes (unless temporary actor/quench)
    if (actor.id) {
        await actor.update(ctx.changes);
    }

    // Ghosts fly (or anything with RUNNING=0 and FLIGHT)
    if (actor.system.characteristics?.running?.value === 0 && actor.system.characteristics?.running?.base === 0) {
        for (const flight of actor.items.filter((i) => i.system.XMLID === "FLIGHT")) {
            await flight.toggle();
        }
    }

    // Kluge to ensure everything has a SPD.
    // For example a BASE has an implied SPD of three
    actor.system.characteristics.spd ??= {
        core: 3,
    };

    uploadProgressBar.advance(`${actor.name}: Saved core changes`);
}

async function restoreRetainedDamage(ctx) {
    const { actor, options, retainValuesOnUpload, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: Restoring retained damage`, 0);

    if (actor.id && !options.rebuild) {
        const retainedDamageChanges = {};
        for (const key of ["body", "stun", "end"]) {
            if (!actor.hasCharacteristic(key.toUpperCase())) continue;
            if (retainValuesOnUpload[key] == undefined) continue;
            if (actor.system.characteristics[key] == undefined) continue;

            actor.system.characteristics[key].value -= retainValuesOnUpload[key];
            retainedDamageChanges[`system.characteristics.${key}.value`] = actor.system.characteristics[key].value;
        }
        if (Object.keys(retainedDamageChanges).length > 0) {
            await actor.update(retainedDamageChanges, { render: false });
        }
    }
    uploadProgressBar.advance(`${actor.name}: Restored retained damage`, 0);
}

async function finalizeUpload(ctx) {
    const { actor, silent, uploadPerformance, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: Linking Custom Adders`, 0);
    await linkCustomAddersForUpload(actor);
    uploadProgressBar.advance(`${actor.name}: Linked Custom Adders`, 1);

    if (actor.id) {
        await actor.update({
            [`flags.${game.system.id}.uploading`]: false,
            [`flags.${game.system.id}.uploadingError`]: null,
            [`flags.${game.system.id}.uploadingErrorContext`]: null,
        });
    }

    // If we have control of this token, reacquire to update movement types
    const myToken = actor.getActiveTokens()?.[0];
    if (canvas.tokens.controlled.find((t) => t.id == myToken?.id)) {
        myToken.release();
        myToken.control();
    }

    uploadProgressBar.close(`Uploaded ${actor.name}`);

    for (const slow of uploadPerformance.slowMarks()) {
        console.warn(`uploadFromXml slow stage: ${slow.label} ${Math.round(slow.ms)}ms`);
    }

    // Let GM know actor was uploaded (unless it is a quench test or missing ID)
    if (!silent && actor.id) {
        // Fire and forget
        ChatMessage.create({
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            author: game.user._id,
            speaker: ChatMessage.getSpeaker({ actor }),
            whisper: whisperUserTargetsForActor(actor),
            content: `Took ${formatDuration(uploadPerformance.settledTotalMs)} for <b>${game.user.name}</b> to upload <b>${actor.name}</b>.`,
        });
    }
}

// Item deletion sometimes skips actor-level effect cleanup (FoundryVTT 13 bug?), so drop
// those effects in the same pass — one batch instead of a turnOff per item, each of which
// is 1-2 writes that re-run full data prep (51s on a large actor).
async function deleteItemsAndOrphanedEffects(actor, items, operation) {
    const deletedItemUuids = new Set(items.map((item) => item.uuid));
    const orphanEffectIds = actor.effects.filter((ae) => deletedItemUuids.has(ae.origin)).map((ae) => ae.id);
    if (orphanEffectIds.length > 0) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", orphanEffectIds, { render: false });
    }
    await actor.deleteEmbeddedDocuments(
        "Item",
        items.map((item) => item.id),
        operation,
    );
}

// Delete any old items that weren't updated, added or part of freeStuff
async function confirmDeleteExtraItems(ctx) {
    const { actor, itemsToCreate, itemsToUpdate, options } = ctx;

    if (!actor.id) {
        return;
    }

    const updatedIds = new Set(itemsToUpdate.map((o) => o._id));
    const createdHdcIds = new Set(itemsToCreate.map((p) => String(p.system.ID)));
    const itemsToDelete = actor.items.filter(
        (item) =>
            !updatedIds.has(item.id) &&
            !createdHdcIds.has(String(item.system.ID)) &&
            !item.isCombatManeuver &&
            !item.baseInfo.behaviors?.includes("non-hd"),
    );
    if (itemsToDelete.length === 0) {
        return;
    }

    if (options.skipExtraItemsPrompt) {
        console.log(
            `${actor.name} kept ${itemsToDelete.length} items not in the HDC`,
            itemsToDelete.map((item) => item.name),
        );
        return;
    }

    const unorderedList =
        `<div style="max-height:200px;overflow-y:scroll"><ul>` +
        itemsToDelete
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((m) => `<li title='${m.system.description}'>${m.type.toUpperCase()}: ${m.name}</li>`)
            .join("") +
        `</ul></div>`;
    const content = `The following items were not included in the HDC file. Do you want to delete them? ${unorderedList}`;
    const confirmDeleteExtra = await foundry.applications.api.DialogV2.confirm({
        window: { title: `${actor.name}: Delete extra items?` },
        content: content,
    });

    if (confirmDeleteExtra) {
        console.log(`Deleting ${itemsToDelete.length} items because they were not present in the HDC file.`);
        await deleteItemsAndOrphanedEffects(actor, itemsToDelete);
    } else {
        // Fire and forget (no await on this ChatMessage)
        ChatMessage.create({
            style: CONFIG.HERO.CHAT_MESSAGE_DEFAULT_STYLE,
            author: game.user._id,
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<b>${actor.name}</b> kept a few items that were not in the HDC upload: ${unorderedList}`,
            whisper: whisperUserTargetsForActor(actor),
        });
    }
}

// DataModel check
function reportDataModelErrors(ctx) {
    const { actor, uploadProgressBar } = ctx;

    uploadProgressBar.advance(`${actor.name}: Processing debugModelProps`, 0);
    let dataModelErrorCount = 0;
    for (const item of actor.items) {
        const e = item.system.debugModelProps();
        if (e) {
            if (dataModelErrorCount++ === 0) {
                ui.notifications.error(`${actor.name}. ${e}<br>Please report`, { permanent: true });
            } else {
                // the console.error inside debugModelProps will log the rest
            }
        }
    }
    // After close: still marks timing, must not add a tick the total never promised
    uploadProgressBar.advance(`${actor.name}: Processed debugModelProps`, 0);
}

async function linkCustomAddersForUpload(actor) {
    // CSLs
    const cslInitializationUpdates = [];
    for (const csl of actor.allCslSkills) {
        const cslChangesToLink = csl.linkBasedOnCustomAdders(csl.system._source.ADDER, actor.cslItems);
        if (csl._id != null) {
            cslChangesToLink._id = csl._id;
            cslInitializationUpdates.push(cslChangesToLink);
        } else {
            foundry.utils.mergeObject(csl, cslChangesToLink);
        }
    }
    if (cslInitializationUpdates.length > 0) {
        await Item.implementation.updateDocuments(cslInitializationUpdates, { parent: actor });
    }

    // PSLs
    const pslInitializationUpdates = [];
    for (const psl of actor.allPslSkills) {
        const pslChangesToLink = psl.linkBasedOnCustomAdders(psl.system._source.ADDER, actor.pslItems);
        if (psl._id != null) {
            pslChangesToLink._id = psl._id;
            pslInitializationUpdates.push(pslChangesToLink);
        } else {
            foundry.utils.mergeObject(psl, pslChangesToLink);
        }
    }
    if (pslInitializationUpdates.length > 0) {
        await Item.implementation.updateDocuments(pslInitializationUpdates, { parent: actor });
    }
}
