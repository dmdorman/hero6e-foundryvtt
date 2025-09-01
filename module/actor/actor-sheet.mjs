import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActor } from "./actor.mjs";

import { cloneToEffectiveAttackItem, HeroSystem6eItem } from "../item/item.mjs";
import { dehydrateAttackItem, userInteractiveVerifyOptionallyPromptThenSpendResources } from "../item/item-attack.mjs";

import { getActorDefensesVsAttack } from "../utility/defense.mjs";
import { presenceAttackPopOut } from "../utility/presence-attack.mjs";
import { onManageActiveEffect } from "../utility/effects.mjs";
import { getPowerInfo, getCharacteristicInfoArrayForActor, whisperUserTargetsForActor } from "../utility/util.mjs";
import { characteristicValueToDiceParts } from "../utility/damage.mjs";
import { HeroRoller } from "../utility/dice.mjs";
import { getSystemDisplayUnits } from "../utility/units.mjs";
import { RoundFavorPlayerUp } from "../utility/round.mjs";

// v13 has namespaced these. When we remove this backwards compatibility then the eslint exception can be cleaned up.
const FoundryVttTextEditor = foundry.applications.ux?.TextEditor.implementation || TextEditor;
const FoundryVttActorSheet = foundry.appv1?.sheets?.ActorSheet || ActorSheet;
const foundryVttRenderTemplate = foundry.applications?.handlebars?.renderTemplate || renderTemplate;

export class HeroSystemActorSheet extends FoundryVttActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["actor-sheet"],
            template: `systems/${HEROSYS.module}/templates/actor/actor-sheet.hbs`,
            tabs: [
                {
                    navSelector: ".sheet-navigation",
                    contentSelector: ".sheet-body",
                    initial: "Attacks",
                },
            ],
            scrollY: [".sheet-body"],
            closeOnSubmit: false, // do not close when submitted
            submitOnChange: true, // submit when any input changes
            itemFilters: {}, // used to track item search filters on some tabs
        });
    }

    static sampleAttacks = {};

    /** @override */
    async getData(options = {}) {
        window.actor = this.actor;

        const data = super.getData(options);

        data.token = options?.token;
        data.isOwner = this.object.isOwner;
        data.gameSystemId = game.system.id;
        data.actor.flags[game.system.id] ??= {};
        if (data.actor.flags[game.system.id].uploading) {
            return data;
        }

        data.system = data.actor.system;

        // Unlinked actors can end up with duplicate items when prototype actor is re-uploaded.
        // This should NEVER happen, but checking to make sure.
        const kludgeDuplicateItemNames = [];
        for (const item of this.actor.items) {
            try {
                const item2 = this.actor.items.find(
                    (i) => i.system.ID === item.system.ID && i.id !== item.id && item.name === i.name,
                );
                if (item2) {
                    if (item2.link.includes("Scene.")) {
                        console.warn(`Duplciate item ${item2.detailedName()}`, item2);
                        kludgeDuplicateItemNames.push(item2.detailedName());
                    }
                }
            } catch (e) {
                console.warn(e);
            }
        }
        if (kludgeDuplicateItemNames.length > 0) {
            ui.notifications.warn(
                `${this.actor.name} has ${kludgeDuplicateItemNames.length} duplicate items. This can occur when the prototype actor is uploaded and unlinked tokens are on a scene.`,
            );
        }

        try {
            // Show an unsupported actor warning when the sheet opens. An actor can be unsupported if:
            // 1) It was uploaded and is of an unsupported version (system.versionHeroSystem6eUpload is undefined)
            // 2) Has not been uploaded but was created long enough ago that a basic character isn't supported (right now this is pre 3.0.64 but it
            //    probably should have been introduced at the same time we introduced the upload check).
            if (
                !data.actor.system.versionHeroSystem6eUpload &&
                !foundry.utils.isNewerVersion(data.actor.system.versionHeroSystem6eCreated, "3.0.63") &&
                this._priorState <= 0
            ) {
                await ui.notifications.error(
                    `The Actor "${data.actor.name}" was uploaded with an older HeroSystem version and is no longer supported.  Please delete this actor and/or re-upload from HDC`,
                );
            }

            // Items returned by the super have been neutered, we want the full class so we can use parentItem and childItem getters.
            data.items = Array.from(data.actor.items).sort((a, b) => (a.sort || 0) - (b.sort || 0));

            // const equipmentWeightPercentage =
            //     parseInt(game.settings.get(game.system.id, "equipmentWeightPercentage")) / 100.0;

            // Alpha Testing (use to show/hide effects)
            data.alphaTesting = game.settings.get(game.system.id, "alphaTesting");

            // Equipment & MartialArts are uncommon.  If there isn't any, then don't show the navigation tab.
            data.hasEquipment = false;
            data.hasMartialArts = false;

            // NPC or PC dropdown
            data.isGM = game.user.isGM;

            // enrichedData
            for (const field of [
                "BIOGRAPHY",
                "BACKGROUND",
                "PERSONALITY",
                "QUOTE",
                "TACTICS",
                "CAMPAIGN_USE",
                "APPEARANCE",
            ]) {
                data[`enriched${field}`] = await FoundryVttTextEditor.enrichHTML(
                    data.actor.system.CHARACTER?.CHARACTER_INFO?.[field],
                    { async: true },
                );
            }

            data.pointsTitle = "";
            data.activePointsTitle = "";
            if (data.actor.pointsDetail) {
                for (const [key, value] of Object.entries(data.actor.pointsDetail)) {
                    data.pointsTitle += `${key.replace("equipment", "[equipment]")}: ${value}\n`;
                }
            }
            if (data.actor.activePointsDetail) {
                for (const [key, value] of Object.entries(data.actor.activePointsDetail)) {
                    data.activePointsTitle += `${key}: ${value}\n`;
                }
            } else {
                data.activePointsTitle = "Total Active Points (estimate)";
            }

            // FIXME: This is the cost of a major amount of rework done that should be calculated once when either the HDC or the system changes.
            // override actor.items (which is a map) to an array with some custom properties
            for (let item of data.actor.items) {
                // Update Attack Details (estimateOCV, DCV, Damage)
                item._postUploadDetails();

                if (item.type === "martialart") {
                    data.hasMartialArts = true;
                } else if (item.type === "equipment") {
                    data.hasEquipment = true;
                }
            }

            if (data.hasEquipment) {
                data.weightTotal = `${this.actor.encumbrance} kg`;
                data.priceTotal = `$${this.actor.netWorth}`;
            }

            // Characteristics
            const characteristicSet = [];

            const powers = getCharacteristicInfoArrayForActor(this.actor);
            const isAutomatonWithNoStun = !!this.actor.items.find(
                (power) =>
                    power.system.XMLID === "AUTOMATON" &&
                    (power.system.OPTION === "NOSTUN1" || power.system.OPTION === "NOSTUN2"),
            );

            for (const powerInfo of powers) {
                const characteristic = {
                    ...data.actor.system.characteristics[powerInfo.key.toLowerCase()],
                };

                characteristic.key = powerInfo.key.toLowerCase();
                characteristic.value = parseInt(characteristic.value) || 0;
                characteristic.max = parseInt(characteristic.max) || 0;

                characteristic.base = this.actor.getCharacteristicBase(powerInfo.key.toUpperCase());

                characteristic.name = powerInfo.name || powerInfo.key.toUpperCase();
                characteristic.costTitle = powerInfo.cost
                    ? `${powerInfo.cost} * (${characteristic.core} - ${characteristic.base})`
                    : null;
                characteristic.behaviors = powerInfo.behaviors;

                // Notes
                if (powerInfo.key === "STR") {
                    const strDetails = this.actor.strDetails();
                    characteristic.notes = `lift ${strDetails.strLiftText}, running throw ${
                        strDetails.strThrow
                    }${getSystemDisplayUnits(data.actor.is5e)}`;
                }

                if (powerInfo.key === "LEAPING") {
                    characteristic.notes = `${Math.max(0, characteristic.value)}${getSystemDisplayUnits(
                        data.actor.system.is5e,
                    )} forward, ${Math.max(0, Math.round(characteristic.value / 2))}${getSystemDisplayUnits(
                        data.actor.system.is5e,
                    )} upward`;
                }

                if (["SIZE", "BASESIZE"].includes(powerInfo.key)) {
                    const sizeDetails = this.actor.sizeDetails();
                    characteristic.notes = sizeDetails.description;
                }

                characteristic.delta = characteristic.max - characteristic.core;
                if (data.actor.system.is5e) {
                    if (powerInfo.key.toLowerCase() === "pd") {
                        characteristic.notes = `5e figured STR/5${isAutomatonWithNoStun ? " and /3 again" : ""}`;
                    }

                    if (powerInfo.key.toLowerCase() === "ed") {
                        characteristic.notes = `5e figured CON/5${isAutomatonWithNoStun ? " and /3 again" : ""}`;
                    }

                    if (powerInfo.key.toLowerCase() === "spd") {
                        characteristic.notes = "5e figured 1 + DEX/10";
                    }

                    if (powerInfo.key.toLowerCase() === "rec") {
                        characteristic.notes = "5e figured STR/5 + CON/5";
                    }

                    if (powerInfo.key.toLowerCase() === "end") {
                        characteristic.notes = "5e figured 2 x CON";
                    }

                    if (powerInfo.key.toLowerCase() === "stun") {
                        characteristic.notes = "5e figured BODY+STR/2+CON/2";
                    }

                    if (["ocv", "dcv"].includes(powerInfo.key.toLowerCase())) {
                        characteristic.notes = "5e calculated DEX/3";
                        characteristic.delta = characteristic.max - characteristic.base;
                    }

                    if (["omcv", "dmcv"].includes(powerInfo.key.toLowerCase())) {
                        characteristic.notes = "5e calculated EGO/3";
                    }
                }

                // Active Effects may be blocking updates
                let ary = [];
                let activeEffects = Array.from(this.actor.allApplicableEffects()).filter(
                    (ae) =>
                        ae.changes.find(
                            (p) => p.key === `system.characteristics.${powerInfo.key.toLowerCase()}.value`,
                        ) && !ae.disabled,
                );
                for (const ae of activeEffects) {
                    ary.push(`<li>${ae.name}</li>`);
                }
                if (ary.length > 0) {
                    characteristic.valueTitle = "<b>PREVENTING CHANGES</b>\n<ul class='left'>";
                    characteristic.valueTitle += ary.join("\n ");
                    characteristic.valueTitle += "</ul>";
                    characteristic.valueTitle += "<small><i>Click to unblock</i></small>";
                }

                ary = [];
                activeEffects = Array.from(this.actor.allApplicableEffects()).filter(
                    (ae) =>
                        ae.changes.find((p) => p.key === `system.characteristics.${powerInfo.key.toLowerCase()}.max`) &&
                        !ae.disabled,
                );

                for (const ae of activeEffects) {
                    ary.push(`<li>${ae.name}</li>`);
                    if (ae._prepareDuration().duration) {
                        const change = ae.changes.find(
                            (o) => o.key === `system.characteristics.${powerInfo.key.toLowerCase()}.max`,
                        );
                        if (change.mode === CONST.ACTIVE_EFFECT_MODES.ADD) {
                            characteristic.delta += parseInt(change.value);
                        }
                        if (change.mode === CONST.ACTIVE_EFFECT_MODES.MULTIPLY) {
                            characteristic.delta +=
                                parseInt(characteristic.max) * parseInt(change.value) - parseInt(characteristic.max);
                        }
                    }
                }
                if (ary.length > 0) {
                    characteristic.maxTitle = "<b>PREVENTING CHANGES</b>\n<ul class='left'>";
                    characteristic.maxTitle += ary.join("\n ");
                    characteristic.maxTitle += "</ul>";
                    characteristic.maxTitle += "<small><i>Click to unblock</i></small>";
                }

                characteristicSet.push(characteristic);
            }
            data.characteristicSet = characteristicSet;

            // Defense (create fake attacks and get defense results)
            let defense = {};

            // Make a fake actor to hold the fake attacks we're going to create. Give it the
            // same HERO system version as the actor related to this sheet.
            // TODO: Is there a better way to calculate defense without creating fake attacks?

            // Defense PD
            const pdAttack = await this.#createStaticFakeAttack(
                "pd",
                `<POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                </POWER>`,
            );
            const {
                defenseValue: defenseValuePD,
                resistantValue: resistantValuePD,
                damageReductionValue: damageReductionValuePD,
                damageNegationValue: damageNegationValuePD,
                defenseTags: defenseTagsPD,
            } = getActorDefensesVsAttack(this.actor, pdAttack);
            defense.PD = defenseValuePD;
            for (const tag of defenseTagsPD.filter(
                (o) => o.operation === "add" && (!o.options?.resistant || o.options?.resistantAdvantage),
            )) {
                defense.PDtags = `${defense.PDtags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.rPD = resistantValuePD;
            for (const tag of defenseTagsPD.filter((o) => o.operation === "add" && o.options?.resistant)) {
                defense.rPDtags = `${defense.rPDtags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.drp = damageReductionValuePD;
            for (const tag of defenseTagsPD.filter((o) => o.operation === "pct")) {
                defense.drptags = `${defense.drptags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.dnp = damageNegationValuePD;
            for (const tag of defenseTagsPD.filter((o) => o.operation === "subtract")) {
                defense.dnptags = `${defense.dnptags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }

            // Defense ED
            const edAttack = await this.#createStaticFakeAttack(
                "ed",
                `<POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            </POWER>`,
            );
            const {
                defenseValue: defenseValueED,
                resistantValue: resistantValueED,
                damageReductionValue: damageReductionValueED,
                damageNegationValue: damageNegationValueED,
                defenseTags: defenseTagsED,
            } = getActorDefensesVsAttack(this.actor, edAttack);
            defense.ED = defenseValueED;
            for (const tag of defenseTagsED.filter((o) => o.operation === "add" && !o.options?.resistant)) {
                defense.EDtags = `${defense.EDtags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.rED = resistantValueED;
            for (const tag of defenseTagsED.filter((o) => o.operation === "add" && o.options?.resistant)) {
                defense.rEDtags = `${defense.rEDtags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.dre = damageReductionValueED;
            for (const tag of defenseTagsED.filter((o) => o.operation === "pct")) {
                defense.dretags = `${defense.dretags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.dne = damageNegationValueED;
            for (const tag of defenseTagsED.filter((o) => o.operation === "subtract")) {
                defense.dnetags = `${defense.dnetags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }

            // Defense MD
            const mdAttack = await this.#createStaticFakeAttack(
                "md",
                `<POWER XMLID="EGOATTACK" ID="1695575160315" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                </POWER>`,
            );
            const {
                defenseValue: defenseValueMD,
                resistantValue: resistantValueMD,
                damageReductionValue: damageReductionValueMD,
                damageNegationValue: damageNegationValueMD,
                defenseTags: defenseTagsMD,
            } = getActorDefensesVsAttack(this.actor, mdAttack);
            defense.MD = defenseValueMD;
            for (const tag of defenseTagsMD.filter((o) => o.operation === "add" && !o.options?.resistant)) {
                defense.MDtags = `${defense.MDtags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.rMD = resistantValueMD;
            for (const tag of defenseTagsMD.filter((o) => o.operation === "add" && o.options?.resistant)) {
                defense.rMDtags = `${defense.rMDtags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.drm = damageReductionValueMD;
            for (const tag of defenseTagsMD.filter((o) => o.operation === "pct")) {
                defense.drmtags = `${defense.drmtags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }
            defense.dnm = damageNegationValueMD;
            for (const tag of defenseTagsMD.filter((o) => o.operation === "subtract")) {
                defense.dnmtags = `${defense.dnmtags || ""}${tag.value.signedStringHero()} ${tag.name} ${tag.shortDesc}\n`;
            }

            // Defense POWD
            const drainAttack = await this.#createStaticFakeAttack(
                "drain",
                `<POWER XMLID="DRAIN" ID="1703727634494" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                </POWER>`,
            );
            const {
                defenseValue: defenseValuePOWD,
                resistantValue: resistantValuePOWD,
                defenseTags: defenseTagsPOWD,
            } = getActorDefensesVsAttack(this.actor, drainAttack);
            defense.POWD = defenseValuePOWD;
            for (const tag of defenseTagsPOWD.filter((o) => o.operation === "add" && !o.options?.resistant)) {
                defense.POWDtags = `${defense.POWDtags || ""}${tag.value.signedStringHero()} ${tag.name} ${
                    tag.shortDesc
                }\n`;
            }
            defense.rPOWD = resistantValuePOWD;
            for (const tag of defenseTagsPOWD.filter((o) => o.operation === "add" && o.options?.resistant)) {
                defense.rPOWDtags = `${defense.rPOWDtags || ""}${tag.value.signedStringHero()} ${tag.name} ${
                    tag.shortDesc
                }\n`;
            }

            data.defense = defense;

            // Get all applicable effects (from actor and all items)
            data.allTemporaryEffects = Array.from(this.actor.allApplicableEffects())
                .filter((o) => o.duration.duration > 0 || o.statuses.size)
                .sort((a, b) => a.name.localeCompare(b.name));
            data.allConstantEffects = this.actor.getConstantEffects();
            data.allPersistentEffects = this.actor.getPersistentEffects();
            data.allInherentEffects = this.actor.getInherentEffects();
            data.allMiscEffects = this.actor.getMiscEffects();

            // Add defenses (without active effects) to actorEffects.
            // This provides a nice way to see ALL powers that are effecting
            // the actor regardless of how they are implemented.
            const defensePowers = data.actor.items.filter(
                (o) => (o.system.subType || o.type) === "defense" && !o.effects.size,
            );
            for (const d of defensePowers) {
                d.disabled = !d.isActive;
                switch (d.duration) {
                    case "instant":
                        // Might Vary
                        switch (d.system.XMLID) {
                            case "FORCEWALL":
                                data.allPersistentEffects.push(d);
                                break;
                            default:
                                data.allTemporaryEffects.push(d);
                        }

                        break;
                    case "constant":
                        data.allConstantEffects.push(d);
                        break;
                    case "persistent":
                        data.allPersistentEffects.push(d);
                        break;
                    case "inherent":
                        data.allInherentEffects.push(d);
                        break;

                    default:
                        data.allConstantEffects.push(d);

                        if (game.settings.get(game.system.id, "alphaTesting")) {
                            if (!d.baseInfo) {
                                ui.notifications.warn(
                                    `${this.actor.name}: ${d.detailedName()} has no powerInfo/config.`,
                                    d,
                                );
                            } else {
                                ui.notifications.warn(
                                    `${this.actor.name}: ${d.detailedName()} has no duration specified.`,
                                    d,
                                );
                            }
                        }
                }
            }

            // Active Point Summary
            data.activePointSummary = [];
            for (const key of Object.keys(this.actor.system.characteristics)) {
                const char = this.actor.system.characteristics[key];
                const powerInfo = getPowerInfo({
                    xmlid: key.toUpperCase(),
                    actor: this.actor,
                    xmlTag: key.toUpperCase(),
                });
                let valueTop = Math.max(char.value, char.max);
                let activePoints = valueTop * (powerInfo?.cost || 0);
                if (activePoints > 0) {
                    data.activePointSummary.push({
                        name: powerInfo?.name || key,
                        activePoints: activePoints,
                    });
                }
            }

            for (const item of this.actor.items.filter((o) => o.type !== "maneuver")) {
                if (!item.baseInfo) {
                    // Don't bother warning about super old items
                    if (item.system.XMLID) {
                        console.warn(`${item?.system?.XMLID} (${item?.name}) has no powerInfo`);
                    }
                    continue;
                }

                const activePoints = item.activePoints;
                if (activePoints > 0) {
                    let name = item.name;
                    if (item.name.toUpperCase().indexOf(item.system.XMLID) == -1) {
                        name += ` (${item.system.XMLID})`;
                    }

                    if (!item.system.XMLID.startsWith("__")) {
                        data.activePointSummary.push({
                            name: name,
                            activePoints: activePoints,
                        });
                    }
                }
            }

            data.activePointSummary.sort((a, b) => b.activePoints - a.activePoints);
            let topActivePoints = data.activePointSummary?.[0]?.activePoints;
            data.activePointSummary = data.activePointSummary.filter((o) => o.activePoints >= topActivePoints * 0.5);

            // Display Heroic Action Points
            data.useHAP = game.settings.get(game.system.id, "HAP");

            // Not all actor types have END & STUN
            data.hasEND = powers.find((o) => o.key === "END");
            data.hasSTUN = powers.find((o) => o.key === "STUN");

            // Endurance Reserve
            data.endReserve = this.actor.items.find((o) => o.system.XMLID === "ENDURANCERESERVE");
        } catch (ex) {
            console.error(ex);
        }

        return data;
    }

    async _onDragStart(...args) {
        return await super._onDragStart(...args);
    }

    async _onDropFolder(event, data) {
        // The default super doesn't add the items in the correct order.
        // Perhaps we can use the super in the future as we improve editing, manual item sorting, etc.

        // Add parent items first (there should be only one, but I suppose there could be more, which we may not handle perfectly)
        // Also note that we are largely using the folder structure to determine parent/child relationship.

        const folder = await fromUuid(data.uuid);

        await this.dropFrameworkFolder(folder);
    }

    async dropFrameworkFolder(folder, parentId) {
        // Start with folders within folders
        // for (const subFolder of folder.children) {
        //     await this.dropFrameworkFolder(subFolder.folder);
        // }

        let itemsToAdd = folder.contents;

        // Compendiums only have the index entry, so need to get the whole item
        if (folder.pack || !itemsToAdd?.[0].id) {
            itemsToAdd = await game.packs.get(folder.pack).getDocuments({ folder: folder.id });
        }

        if (itemsToAdd.length === 0 && folder.children) {
            for (const childFolder of folder.children) {
                await this.dropFrameworkFolder(childFolder.folder, null);
            }
        }

        const parentData = itemsToAdd.find(
            (i) => i.baseInfo.type.includes("framework") || i.baseInfo.type.includes("compound"),
        );
        if (parentData) {
            if (parentData.system.is5e !== this.actor.system.is5e) {
                ui.notifications.warn(
                    `${parentData.name} is a ${parentData.system.is5e ? "5e" : "6e"} item.  ${this.actor.name} is a ${
                        this.actor.system.is5e ? "5e" : "6e"
                    } actor.  Mixing 5e/6e may have unpredictable results.`,
                );
            }
            await this.dropFrameworkItem(
                parentData,
                parentId,
                itemsToAdd.filter((o) => o.id != parentData?.id),
            );
        } else {
            for (const itemData of itemsToAdd) {
                if (itemData.system.is5e !== this.actor.system.is5e) {
                    ui.notifications.warn(
                        `${itemData.name} is a ${itemData.system.is5e ? "5e" : "6e"} item.  ${this.actor.name} is a ${
                            this.actor.system.is5e ? "5e" : "6e"
                        } actor.  Mixing 5e/6e may have unpredictable results.`,
                    );
                }
                await this.dropFrameworkItem(itemData);
            }
        }
    }

    async dropFrameworkItem(item, parentId, children) {
        // Make sure we get new system.ID's
        const itemData = item.toObject();
        itemData.system.ID = new Date().getTime().toString();
        delete itemData.system.PARENTID;
        if (parentId) {
            itemData.system.PARENTID = parentId;
        }
        delete itemData.system.childIdx;
        if (children) {
            await this._onDropItemCreate(itemData);
            for (const subFolder of item.folder.children) {
                await this.dropFrameworkFolder(subFolder.folder, itemData.system.ID);
            }
            for (const childItem of children) {
                await this.dropFrameworkItem(childItem, itemData.system.ID, null);
            }
        } else {
            await this._onDropItemCreate(itemData);
        }
    }

    /** @override */
    async _onDropItem(event, data) {
        // return super._onDropItem(event, data);
        if (!this.actor.isOwner) return false;
        const item = await Item.implementation.fromDropData(data);
        if (!item) return;

        const sameActor = item.actor?.id === this.actor.id;
        if (sameActor) {
            // check if we are dragging in or out of a parent item
            if (!item.isContainer || item.system.XMLID === "COMPOUNDPOWER") {
                const dropTarget = event.target.closest("[data-item-id]");
                const item2 = item.actor.items.find((o) => o.id === dropTarget?.dataset.itemId);
                if (!item.system.PARENTID && item2?.isContainer) {
                    ui.notifications.info(`<b>${item.name}</b> was moved into to parent <b>${item2.name}</b>`);
                    await item.update({ "system.PARENTID": item2.system.ID });
                } else if (item.system.PARENTID && !item2?.system.PARENTID) {
                    ui.notifications.info(
                        `<b>${item.name}</b> was removed from parent <b>${item.parentItem.name}</b>.`,
                    );
                    await item.update({ "system.-=PARENTID": null, type: item.parentItem.type });
                } else if (!item.isContainer && item2?.isContainer) {
                    ui.notifications.info(`<b>${item.name}</b> was moved into to parent <b>${item2.name}</b>`);
                    await item.update({ "system.PARENTID": item2.system.ID });
                }
            }

            // Recalculate costs
            await item._postUpload();
            await this.actor._postUpload();

            return super._onDropItem(event, data);
        }

        if (item.type === "maneuver") {
            ui.notifications.error(`You cannot drop a MANEUVER onto an actor.`);
            return;
        }

        // Does the XMLID exist in the receiving actor's game edition (e.g. the SUPPRESS XMLID exists only in 5e)?
        const baseInfoCheck = getPowerInfo({
            xmlid: item.system.XMLID,
            is5e: this.actor.is5e,
            xmlTag: item.xmlTag,
        });
        if (!baseInfoCheck) {
            ui.notifications.error(
                `${item.system.XMLID} is a ${item.is5e ? "5e" : "6e"} only item and cannot be dropped onto a ${this.actor.is5e ? "5e" : "6e"} actor.`,
            );
            return;
        }

        await this.DropItemFramework(item);
    }

    async DropItemFramework(item, parentId) {
        const itemData = item.toObject();

        // Create new system.ID
        itemData.system.ID = new Date().getTime().toString();

        // Remove system.PARENTID
        delete itemData.system.PARENTID;
        if (parentId) {
            itemData.system.PARENTID = parentId;
        }
        delete itemData.system.childIdx; // Not really used as of 3.0.100, but good to clean up any older items

        // Handle item sorting within the same Actor
        // TODO: Allow drag/drop to change order
        if (this.actor.uuid === item.parent?.uuid) return this._onSortItem(event, itemData);

        if (itemData.system.is5e !== undefined && itemData.system.is5e !== this.actor.is5e) {
            ui.notifications.warn(
                `${itemData.name} is a ${itemData.system.is5e ? "5e" : "6e"} item.  ${this.actor.name} is a ${
                    this.actor.system.is5e ? "5e" : "6e"
                } actor.  Mixing 5e/6e may have unpredictable results.`,
            );
        }

        // Create the owned item
        await this._onDropItemCreate(itemData, itemData.system.PARENTID);

        const actor = this.actor;
        const token = actor.token;
        const dropName = token?.name || actor.getActiveTokens()?.[0]?.name || actor.name;
        const dragName =
            item.actor?.token?.name ||
            item.actor?.getActiveTokens()?.[0]?.name ||
            item.actor?.name ||
            item.compendium?.name ||
            (item.uuid.startsWith("Item.") ? "ItemSidebar" : null);
        const chatData = {
            author: game.user._id,
            whisper: [...whisperUserTargetsForActor(actor), ...whisperUserTargetsForActor(item.actor)],
        };

        // Delete original if equipment and it belonged to an actor (as opposed to item sidebar or compendium)?
        if (item.type === "equipment" && item.actor) {
            item.delete();
            chatData.content = `<b>${item.name}</b> was transferred from <b>${dragName}</b> to <b>${dropName}</b>.`;
        } else {
            chatData.content = `<b>${item.name}</b> was copied from <b>${dragName}</b> to <b>${dropName}</b>.`;
        }
        ChatMessage.create(chatData);

        // Is this a parent item with children?
        for (const child of item.childItems) {
            await this.DropItemFramework(child, itemData.system.ID);
        }
    }

    /** @override */
    // eslint-disable-next-line no-unused-vars
    async _onDropItemCreate(itemData, event) {
        const itemDataArray = itemData instanceof Array ? itemData : [itemData];
        for (const i of itemDataArray) {
            // Make sure newly dropped items are not active
            if (i.system.active) {
                i.system.active = false;
            }
            // Remove all active effects, _postUpload will recreate them if necessary
            i.effects = [];
        }

        // Does the XMLID exist in the receiving actor's game edition (e.g. the SUPPRESS XMLID exists only in 5e)?
        for (const itemData of itemDataArray) {
            const baseInfoCheck = getPowerInfo({
                xmlid: itemData.system.XMLID,
                is5e: this.actor.is5e,
                xmlTag: itemData.xmlTag,
            });
            if (!baseInfoCheck) {
                ui.notifications.error(
                    `${itemData.system.XMLID} is not valid for ${this.actor.is5e ? "5e" : "6e"}. "${itemData.name}" was not transferred to ${this.actor.name} `,
                );
                return;
            }
        }

        // STACKABLE EQUIPMENT: If this is EQUIPMENT and destination has similar, and it has CHARGES then add the charges.
        if (itemDataArray.length === 1) {
            const stackItem = itemDataArray[0];
            if (stackItem.type === "equipment") {
                const charges = stackItem.system.MODIFIER.find((o) => o.XMLID === "CHARGES");
                const levels = parseInt(charges?.OPTION_ALIAS);
                if (levels > 0) {
                    const existingItem = this.actor.items.find(
                        (o) =>
                            o.type === "equipment" &&
                            o.system.XMLID === stackItem.system.XMLID &&
                            o.system.ALIAS === stackItem.system.ALIAS &&
                            o.findModsByXmlid("CHARGES"),
                    );
                    if (existingItem) {
                        console.log(`Adding charges instead of a new item`, existingItem);
                        await existingItem.update({
                            [`system.charges.value`]: existingItem.system.charges.value + levels,
                            [`system.charges.max`]: existingItem.system.charges.max + levels,
                        });

                        return [existingItem];
                    }
                }
            }
        }

        const newItems = await this.actor.createEmbeddedDocuments("Item", itemDataArray);
        for (const newItem of newItems) {
            await newItem._postUpload();
        }

        return newItems;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Rollable items
        html.find(".item-rollable").click(this._onItemRoll.bind(this));

        // Rollable characteristic
        html.find(".characteristic-roll").click(this._onCharacteristicSuccessRoll.bind(this));

        // Full characteristic
        html.find(".characteristic-full").click(this._onPrimaryCharacteristicFullRoll.bind(this));

        // Casual characteristic
        html.find(".characteristic-casual").click(this._onPrimaryCharacteristicCasualRoll.bind(this));

        // Toggle items
        html.find(".item-toggle").click(this._onItemToggle.bind(this));

        // Edit Items
        html.find(".item-edit").click(this._onItemEdit.bind(this));

        // Delete Items
        html.find(".item-delete").click(this._onItemDelete.bind(this));

        // Create Items
        html.find(".item-create").click(this._onItemCreate.bind(this));

        // Collapse
        html.find(".item-collapse").click(this._onItemCollapse.bind(this));

        // Expand
        html.find(".item-expand").click(this._onItemExpand.bind(this));

        // Upload HDC file
        html.find(".upload-button").change(this._uploadCharacterSheet.bind(this));

        html.find(".recovery-button").click(this._onRecovery.bind(this));
        html.find(".presence-button").click(this._onPresenceAttack.bind(this));
        html.find(".full-health-button").click(this._onFullHealth.bind(this));
        html.find(".actor-description-button").click(this._onActorDescription.bind(this));

        // Active Effects
        html.find(".effect-create").click(this._onEffectCreate.bind(this));
        html.find(".effect-delete").click(this._onEffectDelete.bind(this));
        html.find(".effect-edit").click(this._onEffectEdit.bind(this));
        html.find(".effect-toggle").click(this._onEffectToggle.bind(this));

        html.find(".item-chat").click(this._onItemChat.bind(this));

        html.find("td.characteristic-locked").click(this._onUnBlockCharacteristic.bind(this));

        // Drag events for macros.
        if (this.actor.isOwner) {
            const handler = (ev) => this._onDragStart(ev);

            html.find("tr.item").each((i, el) => {
                el.setAttribute("draggable", true);
                el.addEventListener("dragstart", handler, false);
            });
        }
    }

    /** @override */
    async _updateObject(event, formData) {
        event.preventDefault();

        let expandedData = foundry.utils.expandObject(formData);

        // If we are updating, don't bother with anything special
        if (this.actor.flags[game.system.id]?.updating) {
            await super._updateObject(event, expandedData);
            return;
        }

        // Left Sidebar of actor sheet has Xsystem characteristics
        const characteristics = getCharacteristicInfoArrayForActor(this.actor).filter((o) =>
            ["BODY", "STUN", "END"].includes(o.key),
        );
        try {
            for (const _char of characteristics) {
                const characteristic = _char.key.toLowerCase();
                if (!this.actor.system.characteristics) {
                    console.log("Missing this.actor.system.characteristics");
                } else if (!this.actor.system.characteristics?.[characteristic]) {
                    console.log(`Missing this.actor.system.characteristics[${characteristic}]`);
                } else if (!expandedData.Xsystem?.characteristics?.[characteristic]) {
                    console.log(`Missing expandedData.Xsystem.characteristics[${characteristic}]`);
                } else {
                    if (
                        this.actor.system.characteristics[characteristic] &&
                        expandedData.Xsystem.characteristics?.[characteristic].value !==
                            this.actor.system.characteristics[characteristic].value
                    ) {
                        expandedData.system.characteristics[characteristic].value =
                            expandedData.Xsystem.characteristics[characteristic].value;
                    }
                }
            }

            // Left Sidebar may have EndReserve
            if (expandedData?.endReserve) {
                const endReserveId = Object.keys(expandedData.endReserve)?.[0];
                const endReserve = this.actor.items.find((o) => o.id === endReserveId);
                if (endReserve) {
                    await endReserve.update({
                        "system.value": parseInt(expandedData.endReserve[endReserveId].value || 0),
                    });
                }
            }

            this.options.itemFilters.power = expandedData.itemFilters?.power;
            this.options.itemFilters.skill = expandedData.itemFilters?.skill;
            this.options.itemFilters.equipment = expandedData.itemFilters?.equipment;
            this.options.itemFilters.martial = expandedData.itemFilters?.martial;
        } catch (e) {
            console.error(e);
        }

        // Do all the standard things like updating item properties that match the name of input boxes
        await super._updateObject(event, expandedData); //formData);

        await this.render();
    }

    async _onItemRoll(event) {
        event.preventDefault();
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        item.roll(event, { token: this.token });
    }

    async _onItemChat(event) {
        event.preventDefault();
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        item.chat();
    }

    async _onCharacteristicSuccessRoll(event) {
        event.preventDefault();
        const element = event.currentTarget.closest("button");
        const dataset = element.dataset;
        const charRoll = parseInt(element.textContent.slice(0, -1));

        const heroRoller = new HeroRoller().makeSuccessRoll().addDice(3);
        await heroRoller.roll();

        const margin = charRoll - heroRoller.getSuccessTotal();
        const autoSuccess = heroRoller.getAutoSuccess();
        const useAutoSuccess = autoSuccess !== undefined;
        const success = useAutoSuccess ? autoSuccess : margin >= 0;

        const flavor = `${dataset.label.toUpperCase()} (${charRoll}-) characteristic roll ${
            success ? "succeeded" : "failed"
        } ${useAutoSuccess ? `due to automatic ${autoSuccess ? "success" : "failure"}` : `by ${Math.abs(margin)}`}`;

        const cardHtml = await heroRoller.render(flavor);

        const actor = this.actor;
        const token = actor.token;
        const speaker = ChatMessage.getSpeaker({ actor: actor, token });
        speaker.alias = actor.name;

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            rolls: heroRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    async _onPrimaryCharacteristicRoll(event, characteristicValue, flavor) {
        const element = event.currentTarget.closest("button");
        const dataset = element.dataset;
        const isStrengthRoll = dataset.label === "str";

        // Strength use consumes resources. No other characteristic roll does.
        if (isStrengthRoll) {
            await this._onStrengthCharacteristicRoll(characteristicValue, flavor);
        } else {
            await this._onPrimaryNonStrengthCharacteristicRoll(characteristicValue, flavor);
        }
    }

    async _onPrimaryNonStrengthCharacteristicRoll(characteristicValue, flavor) {
        // NOTE: Characteristic rolls can't have +1 to their roll.
        const diceParts = characteristicValueToDiceParts(characteristicValue);
        const characteristicRoller = new HeroRoller()
            .makeBasicRoll()
            .addDice(diceParts.d6Count)
            .addHalfDice(diceParts.halfDieCount ? 1 : 0);

        await characteristicRoller.roll();

        const cardHtml = await characteristicRoller.render(flavor);

        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        speaker.alias = this.actor.name;

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            rolls: characteristicRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    async _onStrengthCharacteristicRoll(characteristicValue, flavor) {
        // STR should have an item for potential damage, just like a strike and should consume resources
        const originalStrikeItem = this.actor.items.find((o) => o.system.XMLID === "STRIKE");
        if (!originalStrikeItem) {
            return ui.notifications.error(`Unable to find STRIKE item for ${this.actor.name}. Cannot perform attack`);
        }

        // Create a temporary strike attack linked to a strength item.
        const { effectiveItem: effectiveAttackItem, strengthItem: effectiveStrengthItem } = cloneToEffectiveAttackItem({
            originalItem: originalStrikeItem,
            effectiveRealCost: originalStrikeItem._realCost,
            pushedRealPoints: originalStrikeItem._realCost,
            effectiveStr: characteristicValue,
            effectiveStrPushedRealPoints: 0,
        });
        effectiveAttackItem._postUpload();
        effectiveStrengthItem._postUpload();

        // Strength use consumes resources. No other characteristic roll does.
        const {
            error: resourceError,
            warning: resourceWarning,
            resourcesUsedDescription,
            resourcesUsedDescriptionRenderedRoll,
        } = await userInteractiveVerifyOptionallyPromptThenSpendResources(effectiveAttackItem, {});
        if (resourceError) {
            return ui.notifications.error(`${effectiveAttackItem.name} ${resourceError}`);
        } else if (resourceWarning) {
            return ui.notifications.warn(`${effectiveAttackItem.name} ${resourceWarning}`);
        }

        // NOTE: Characteristic rolls can't have +1 to their roll.
        const diceParts = characteristicValueToDiceParts(characteristicValue);
        const characteristicRoller = new HeroRoller()
            .makeNormalRoll()
            .addDice(diceParts.d6Count)
            .addHalfDice(diceParts.halfDieCount ? 1 : 0);

        await characteristicRoller.roll();
        const damageRenderedResult = await characteristicRoller.render();

        const cardData = {
            flavor,
            item: effectiveAttackItem,
            targetEntangle: "true",

            resourcesUsedDescription: resourcesUsedDescription
                ? `Spent ${resourcesUsedDescription}${resourcesUsedDescriptionRenderedRoll}`
                : "",

            actor: this.actor,

            renderedDamageRoll: damageRenderedResult,

            bodyDamage: characteristicRoller.getBodyTotal(),
            stunDamage: characteristicRoller.getStunTotal(),

            rollerJSON: characteristicRoller.toJSON(),

            itemJsonStr: dehydrateAttackItem(effectiveAttackItem),
            actionDataJSON: JSON.stringify({}), // Kludge

            user: game.user,
        };

        // render card
        const template = `systems/${HEROSYS.module}/templates/chat/item-damage-card.hbs`;
        const cardHtml = await foundryVttRenderTemplate(template, cardData);
        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        speaker.alias = this.actor.name;

        const chatData = {
            style: CONST.CHAT_MESSAGE_STYLES.IC, //CONST.CHAT_MESSAGE_STYLES.OOC
            rolls: characteristicRoller.rawRolls(),
            author: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
    }

    async _onPrimaryCharacteristicFullRoll(event) {
        event.preventDefault();
        const element = event.currentTarget.closest("button");
        const dataset = element.dataset;
        const characteristicValue = this.actor.system.characteristics[dataset.label].value;
        await this._onPrimaryCharacteristicRoll(
            event,
            characteristicValue,
            `Full ${dataset.label.toUpperCase()} Roll (${characteristicValue} ${dataset.label.toUpperCase()})`,
        );
    }

    async _onPrimaryCharacteristicCasualRoll(event) {
        event.preventDefault();
        const element = event.currentTarget.closest("button");
        const dataset = element.dataset;
        const characteristicValue = this.actor.system.characteristics[dataset.label].value;
        const halfCharacteristicValue = RoundFavorPlayerUp(+(Math.round(characteristicValue / 2 + "e+2") + "e-2")); //REF: https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary
        await this._onPrimaryCharacteristicRoll(
            event,
            halfCharacteristicValue,
            `Casual ${dataset.label.toUpperCase()} Roll (${halfCharacteristicValue} ${dataset.label.toUpperCase()})`,
        );
    }

    async _onItemToggle(event) {
        event.preventDefault();
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        item.toggle(event);
    }

    async _onItemEdit(event) {
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        item.sheet.render(true);
    }

    async _onItemDelete(event) {
        const itemId = $(event.currentTarget.closest("[data-item-id]")).data().itemId;
        const item = this.actor.items.get(itemId);

        const content = `You are about to delete <b>${item.name}</b>${
            item.childItems.length ? ` and all <b>${item.childItems.length}</b> of it's sub items` : ""
        }. ${game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Content")}`;

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title"),
            content: content,
        });

        if (confirmed) {
            // Delete subitems
            for (const child of item.childItems) {
                for (const child2 of child.childItems) {
                    child2.delete();
                }
                child.delete();
            }

            item.delete();
            this.render();
        }
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        //const data = foundry.utils.duplicate(header.dataset);

        const actor = this.actor;

        // Initialize a default name.
        const name = `New ${type.capitalize()}`;

        // Options associated with TYPE (excluding enhancers for now)
        const powers = actor.system.is5e ? CONFIG.HERO.powers5e : CONFIG.HERO.powers6e;

        // TYPE is really an ACTOR SHEET TAB (or section) name, which is loosely associated with item.type
        // If type = power or equipment then we should show ALL powers we know except for disadvantages, maneuvers, and martialArts.
        const powersOfType = ["power", "equipment"].includes(type)
            ? powers.filter(
                  (o) =>
                      o.type != undefined &&
                      !o.type.includes("martial") &&
                      !o.type.includes("framework") &&
                      !o.type.includes("enhancer") &&
                      !o.behaviors.includes("modifier") &&
                      !o.behaviors.includes("adder") &&
                      o.xml,
              )
            : powers.filter((o) => o.type.includes(type) && !o.type.includes("enhancer") && o.xml);

        // Make sure we have options
        if (powersOfType.length === 0) {
            ui.notifications.warn(`Creating a new ${type.toUpperCase()} is currently unsupported`);
            return;
        }

        const optionHTML = powersOfType
            .sort((a, b) => {
                const parserA = new DOMParser();
                const xmlA = parserA.parseFromString(a.xml.trim(), "text/xml");
                const parserB = new DOMParser();
                const xmlB = parserB.parseFromString(b.xml.trim(), "text/xml");
                const nameA = xmlA.children[0].getAttribute("ALIAS");
                const nameB = xmlB.children[0].getAttribute("ALIAS");
                if (nameA < nameB) {
                    return -1;
                }
                if (nameA > nameB) {
                    return 1;
                }

                // names must be equal
                return 0;
            })
            .map(function (a) {
                const parserA = new DOMParser();
                const xmlA = parserA.parseFromString(a.xml.trim(), "text/xml");
                const alias = xmlA.children[0].getAttribute("ALIAS");

                // Make sure XMLID's match, if not then skip
                if (a.key != xmlA.children[0].getAttribute("XMLID")) {
                    console.warn(`XMLID mismatch`, a, xmlA.children[0]);
                    return "";
                }

                return `<option value='${a.key}'>${alias}</option>`;
            });

        // Need to select a specific XMLID
        const form = `
            <form>
            <p>
            <label>Select ${type}:</label>
            <br>
                <select name="xmlid">
                    ${optionHTML}
                </select>
            </p>
            </form>`;

        const d = new Dialog({
            title: name,
            content: form,
            buttons: {
                create: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Create",
                    callback: async function (html) {
                        const formElement = html[0].querySelector("form");
                        const formData = new FormDataExtended(formElement);
                        const formDataObject = formData.object;
                        if (formDataObject.xmlid === "none") return;

                        const power = powers.find((o) => o.key == formDataObject.xmlid);
                        if (!power) {
                            ui.notifications.error(`Creating new ${type.toUpperCase()} failed`);
                            return;
                        }

                        // Warn if xml is missing as the item is likely missing properties that we are expecting
                        if (!power.xml) {
                            ui.notifications.warn(
                                `${power.key.toUpperCase()} is missing default properties.  This may cause issues with automation and cost calculations.`,
                            );
                        }

                        // Prepare the item object.  Use xml if configured.
                        let itemData = power.xml
                            ? HeroSystem6eItem.itemDataFromXml(power.xml, actor)
                            : {
                                  name: power.name || power.key,
                                  system: {
                                      XMLID: power.key.toUpperCase(),
                                      ALIAS: power.ALIAS || power.name || power.key,
                                  },
                              };

                        // Make sure type matches TAB (consider power vs equipment)
                        itemData.type = type;

                        // Make sure we have a system object
                        if (!itemData.system) {
                            ui.notifications.error(`Creating new ${type.toUpperCase()} failed`);
                            return;
                        }

                        // Track when added manually for diagnostic purposes
                        itemData.system.versionHeroSystem6eManuallyCreated = game.system.version;

                        // Create a unique ID
                        itemData.system.ID = new Date().getTime().toString();

                        // Finally, create the item!
                        const newItem = await HeroSystem6eItem.create(itemData, {
                            parent: actor,
                        });
                        await newItem._postUpload();
                        return;
                    },
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel",
                    callback: () => console.log(`Cancel ${type.capitalize()} itemCreate`),
                },
            },
        });
        d.render(true);
    }

    async _onItemCollapse(event) {
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        await item.update({ "system.collapse": true });
    }

    async _onItemExpand(event) {
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        await item.update({ "system.collapse": false });
    }

    async _onEffectCreate(event) {
        onManageActiveEffect(event, this.actor);
    }

    async _onEffectDelete(event) {
        onManageActiveEffect(event, this.actor);
    }

    async _onEffectToggle(event) {
        onManageActiveEffect(event, this.actor);
    }

    async _onEffectEdit(event) {
        onManageActiveEffect(event, this.actor);
    }

    async _onRecovery() {
        this.actor.TakeRecovery({ asAction: true });
    }

    async _onPresenceAttack() {
        presenceAttackPopOut(this.actor);
    }

    async _onFullHealth() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.fullHealthConfirm.Title") + ` [${this.actor.name}]`,
            content: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.fullHealthConfirm.Content"),
        });
        if (!confirmed) return;
        return this.actor.FullHealth();
    }

    async _onActorDescription() {
        let content = `${this.actor.system.CHARACTER?.CHARACTER_INFO?.APPEARANCE || ""}`;
        const perceivable = [];
        for (let item of this.actor.items) {
            const p = item.isPerceivable(false); // inobivous is not included
            if (p) {
                perceivable.push(
                    `<b${p === "maybe" ? ` style="color:blue" title="Inobvious requires PERCEPTION roll"` : ""}>${item.parentItem ? `${item.parentItem.name}: ` : ""}${item.name}</b> ${item.system.description}`,
                );
            }
        }
        if (perceivable.length > 0) {
            perceivable.sort();
            content += "<ul>";
            for (let p of perceivable) {
                content += `<li>${p}</li>`;
            }
            content += "</ul>";
        }

        const token = this.actor.token;
        const speaker = ChatMessage.getSpeaker({ actor: this.actor, token });
        const chatData = {
            author: game.user._id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: content,
            speaker: speaker,
        };
        return ChatMessage.create(chatData);
    }

    async _uploadCharacterSheet(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = async function (event) {
            const contents = event.target.result;

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(contents, "text/xml");
            await this.actor.uploadFromXml(xmlDoc, { file });
        }.bind(this);
        reader.readAsText(file);
    }

    async _onUnBlockCharacteristic(event) {
        event.preventDefault();

        // The event will not be generated from the disabled input (since disabled elements
        // don't generally allow mouse events) but rather from the enclosing td element.
        // Find its child input element
        const input = event.target.querySelector("input");

        // Find all associated Active Effects
        const activeEffects = Array.from(this.actor.allApplicableEffects()).filter((o) =>
            o.changes.find((p) => p.key === input.name),
        );
        for (const ae of activeEffects.filter((ae) => !ae.disabled)) {
            // Delete status
            if (ae.statuses) {
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title"),
                    content: `Remove ${ae.name}?`,
                });

                if (confirmed) {
                    const actionsToAwait = [];

                    if (ae.flags?.[game.system.id]?.type === "adjustment" && ae.flags[game.system.id]?.version >= 3) {
                        const parent = ae.parent;
                        for (const target of ae.flags[game.system.id].target) {
                            if (parent.system.characteristics[target]) {
                                // Target is a characteristic or movement
                                const actor = parent;
                                const newMax =
                                    actor.system.characteristics[target].max + ae.flags[game.system.id]?.affectedPoints;
                                const presentValue = actor.system.characteristics[target].value;

                                let newValue = 0;
                                if (ae.flags[game.system.id]?.affectedPoints < 0) {
                                    // This is a positive adjustment. When it goes away
                                    // the points are lost but anything already lost doesn't go away.
                                    newValue = Math.min(presentValue, newMax);
                                } else {
                                    // This is a negative adjustment. When it goes away
                                    // the points come back.
                                    newValue = presentValue + ae.flags[game.system.id]?.affectedPoints;
                                }

                                if (newValue !== presentValue) {
                                    const change = {};
                                    change[`system.characteristics.${target}.value`] = newValue;
                                    actionsToAwait.push(actor.update(change));
                                }
                            }
                        }
                    }
                    // Clicking to remove PD AE, removes checkbox to re-active it. #1469
                    // We will disable the AE on items, or delete AE on actors
                    if (ae.parent instanceof HeroSystem6eActor) {
                        actionsToAwait.push(ae.delete());
                    } else {
                        actionsToAwait.push(ae.update({ disabled: true }));
                    }
                    await Promise.all(actionsToAwait);
                }
                continue;
            }

            // Delete Temporary Effects
            if (parseInt(ae.duration?.seconds || 0) > 0) {
                let confirmed = await Dialog.confirm({
                    title: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title"),
                    content: `Delete ${ae.name}?`,
                });

                if (confirmed) {
                    await ae.delete();
                }
                continue;
            }

            // Turn off Permanent powers
            if (ae.parent instanceof HeroSystem6eItem) {
                let confirmed = await Dialog.confirm({
                    title: "Turn off?",
                    content: `Turn off ${ae.name}?`,
                });

                if (confirmed) {
                    await ae.parent.toggle(event);
                }
                continue;
            }
        }

        await this.actor.applyEncumbrancePenalty();
    }

    async #createStaticFakeAttack(damageType, xml) {
        const is5e = this.actor.is5e;
        const attackKey = `${damageType}Attack${is5e ? "5e" : "6e"}`;
        const defenseCalculationActorKey = `defenseCalculationActor${is5e ? "5e" : "6e"}`;

        // This typically happens during upload.  Don't save anything in static.
        if (is5e === undefined) {
            const defenseCalculationActor = new HeroSystem6eActor({
                name: "Defense Calculation Actor",
                type: "pc",
                system: { is5e },
            });
            const attack = (HeroSystemActorSheet.sampleAttacks[attackKey] = new HeroSystem6eItem(
                HeroSystem6eItem.itemDataFromXml(xml, defenseCalculationActor),
                { parent: defenseCalculationActor },
            ));
            await attack._postUpload();
            console.debug(`${attackKey}: Undefined is5e`);
        }

        HeroSystemActorSheet.sampleAttacks[defenseCalculationActorKey] ??= new HeroSystem6eActor(
            {
                name: "Defense Calculation Actor",
                type: "pc",
                system: { is5e },
            },
            {},
        );
        const defenseCalculationActor = HeroSystemActorSheet.sampleAttacks[defenseCalculationActorKey];

        if (!HeroSystemActorSheet.sampleAttacks[attackKey]) {
            HeroSystemActorSheet.sampleAttacks[attackKey] = new HeroSystem6eItem(
                HeroSystem6eItem.itemDataFromXml(xml, defenseCalculationActor),
                { parent: defenseCalculationActor },
            );
            await HeroSystemActorSheet.sampleAttacks[attackKey]._postUpload();
            //console.debug(`${attackKey}: Created`);
        } else {
            //console.debug(`${attackKey}: used cache`);
        }
        return HeroSystemActorSheet.sampleAttacks[attackKey];
    }
}
