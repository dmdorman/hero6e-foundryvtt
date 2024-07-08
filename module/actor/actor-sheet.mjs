import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActor } from "./actor.mjs";

import { HeroSystem6eItem } from "../item/item.mjs";

import { determineDefense } from "../utility/defense.mjs";
import { presenceAttackPopOut } from "../utility/presence-attack.mjs";
import { onManageActiveEffect } from "../utility/effects.mjs";
import { getPowerInfo, getCharacteristicInfoArrayForActor } from "../utility/util.mjs";
import { CombatSkillLevelsForAttack, convertToDcFromItem, getDiceFormulaFromItemDC } from "../utility/damage.mjs";
import { HeroRoller } from "../utility/dice.mjs";
import { getSystemDisplayUnits } from "../utility/units.mjs";
import { calculateVelocityInSystemUnits } from "../ruler.mjs";

export class HeroSystemActorSheet extends ActorSheet {
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

    /** @override */
    async getData() {
        const data = super.getData();

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
                ui.notifications.warn(
                    `The Actor "${data.actor.name}" was uploaded with an older HeroSystem version and is no longer supported.  Please re-upload from HDC.`,
                );
            }

            const equipmentWeightPercentage =
                parseInt(game.settings.get(game.system.id, "equipmentWeightPercentage")) / 100.0;

            // Alpha Testing (use to show/hide effects)
            data.alphaTesting = game.settings.get(game.system.id, "alphaTesting");

            // Equipment & MartialArts are uncommon.  If there isn't any, then don't show the navigation tab.
            data.hasEquipment = false;
            data.hasMartialArts = false;

            // NPC or PC dropdown
            data.isGM = game.user.isGM;

            // enrichedData
            for (let field of [
                "BIOGRAPHY",
                "BACKGROUND",
                "PERSONALITY",
                "QUOTE",
                "TACTICS",
                "CAMPAIGN_USE",
                "APPEARANCE",
            ]) {
                data[`enriched${field}`] = await TextEditor.enrichHTML(
                    data.actor.system.CHARACTER?.CHARACTER_INFO?.[field],
                    { async: true },
                );
            }

            let weightTotal = 0;
            let priceTotal = 0;

            data.pointsTitle = "";
            data.activePointsTitle = "";
            if (data.actor.system.pointsDetail) {
                for (let [key, value] of Object.entries(data.actor.system.pointsDetail)) {
                    data.pointsTitle += `${key.replace("equipment", "[equipment]")}: ${value}\n`;
                }
            }
            if (data.actor.system.activePointsDetail) {
                for (let [key, value] of Object.entries(data.actor.system.activePointsDetail)) {
                    data.activePointsTitle += `${key}: ${value}\n`;
                }
            } else {
                data.activePointsTitle = "Total Active Points (estimate)";
            }

            // override actor.items (which is a map) to an array with some custom properties
            let items = [];
            for (let item of data.actor.items) {
                // showToggle
                const itemEffects = item.effects.find(() => true);
                if (itemEffects) {
                    item.system.showToggle = true;
                    item.system.active = !itemEffects.disabled;
                }

                const actorEffects = data.actor.effects.find((o) => o.origin === this.actor.items.get(item._id).uuid);
                {
                    if (actorEffects) {
                        item.system.showToggle = true;
                        item.system.active = !actorEffects.disabled;
                    }
                }
                if (item.baseInfo?.behaviors?.includes("activatable")) {
                    item.system.showToggle = true;
                }

                // Item in a Framework?
                if (item.parentItem) {
                    // const parentPosition =
                    //     item.parentItem.system.XMLID === "COMPOUNDPOWER"
                    //         ? -1 // Compound power starts at a random position. Sub powers start at 0.
                    //         : parseInt(item.parentItem.system.POSITION);
                    //item.system.childIdx = parseInt(item.system.POSITION) - parseInt(parentPosition);
                    item.system.childIdx = item.parentItem.childItems.findIndex((o) => o.id === item.id) + 1;

                    if (item.parentItem?.parentItem) {
                        item.system.childIdx = `${item.parentItem.system.childIdx}.${item.system.childIdx}`;
                    }
                }

                // Endurance
                item.system.endEstimate = parseInt(item.system.end) || 0;

                // Damage
                if (
                    item.type == "attack" ||
                    item.type == "maneuver" ||
                    item.system.subType === "attack" ||
                    item.system.XMLID === "martialart"
                ) {
                    item.flags.tags = {};

                    // Combat Skill Levels
                    const csls = CombatSkillLevelsForAttack(item);
                    let cslSummary = {};

                    for (const csl of csls) {
                        for (const prop of ["ocv", "omcv", "dcv", "dmcv", "dc"]) {
                            cslSummary[prop] = csl[prop] + parseInt(cslSummary[prop] || 0);

                            if (csl[prop] != 0) {
                                if (item.flags.tags[prop]) {
                                    item.flags.tags[prop] += "\n";
                                } else {
                                    item.flags.tags[prop] = "";
                                }
                                item.flags.tags[prop] = `${item.flags.tags[prop]}${csl[prop].signedString()} ${
                                    prop === "dc" ? "DC " : ""
                                }${csl.item.name}`;
                            }
                        }
                    }
                    let { dc, end } = convertToDcFromItem(item);
                    item.system.endEstimate = Math.max(item.system.endEstimate, end);

                    // text description of damage
                    item.system.damage = getDiceFormulaFromItemDC(item, dc);

                    // Standard Effect
                    if (item.system.USESTANDARDEFFECT) {
                        let stun = parseInt(item.system.value * 3);
                        if (
                            item.findModsByXmlid("PLUSONEHALFDIE") ||
                            item.findModsByXmlid("MINUSONEPIP") ||
                            item.findModsByXmlid("PLUSONEPIP")
                        ) {
                            stun += 1;
                        }
                        item.system.damage = stun;
                    }

                    if (dc > 0) {
                        if (item.system.killing) {
                            item.system.damage += "K";
                        } else {
                            item.system.damage += "N";
                        }
                    }

                    // Signed OCV and DCV
                    if (item.system.ocv != undefined && item.system.uses === "ocv") {
                        switch (item.system.ocv) {
                            case "--":
                                item.system.ocvEstimated = "";
                                break;

                            case "-v/10":
                                {
                                    item.system.ocv = ("+" + parseInt(item.system.ocv)).replace("+-", "-");

                                    const tokens = item.actor.getActiveTokens();
                                    const token = tokens[0];
                                    const velocity = calculateVelocityInSystemUnits(item.actor, token);

                                    item.system.ocvEstimated = (
                                        parseInt(cslSummary.ocv) + parseInt(velocity / 10)
                                    ).signedString();

                                    if (parseInt(velocity / 10) != 0) {
                                        if (item.flags.tag.ocv) {
                                            item.flags.tagsocv += "\n";
                                        } else {
                                            item.flags.tags.ocv = "";
                                        }
                                        item.flags.tags.ocv = `${item.flags.tags.ocv}${parseInt(
                                            velocity / 10,
                                        ).signedString()} Velocity`;
                                    }
                                }
                                break;

                            default:
                                item.system.ocv = parseInt(item.system.ocv).signedString();
                                item.system.ocvEstimated = (
                                    parseInt(item.system.ocv) + parseInt(cslSummary.ocv || cslSummary.omcv || 0)
                                ).signedString();

                                if (parseInt(item.system.ocv) != 0) {
                                    if (item.flags.tags.ocv) {
                                        item.flags.tags.ocv += "\n";
                                    } else {
                                        item.flags.tags.ocv = "";
                                    }
                                    item.flags.tags.ocv = `${item.flags.tags.ocv}${item.system.ocv} ${item.name}`;
                                }
                        }
                    }

                    if (item.system.dcv != undefined && item.system.uses === "ocv") {
                        item.system.dcv = parseInt(item.system.dcv).signedString();
                        item.system.dcvEstimated = (
                            parseInt(item.system.dcv) + parseInt(cslSummary.dcv || cslSummary.dmcv || 0)
                        ).signedString();

                        if (parseInt(item.system.dcv) != 0) {
                            if (item.flags.tags.dcv) {
                                item.flags.tags.dcv += "\n";
                            } else {
                                item.flags.tags.dcv = "";
                            }
                            item.flags.tags.dcv = `${item.flags.tags.dcv}${item.system.dcv} ${item.name}`;
                        }
                    }

                    if (item.system.uses === "omcv") {
                        const omcv = parseInt(item.actor?.system.characteristics.omcv?.value || 0);
                        item.system.ocvEstimated = (omcv + parseInt(cslSummary.omcv || 0)).signedString();
                        if (omcv != 0) {
                            if (item.flags.tags.omcv) {
                                item.flags.tags.omcv += "\n";
                            } else {
                                item.flags.tags.omcv = "";
                            }
                            item.flags.tags.omcv = `${item.flags.tags.omcv}${omcv.signedString()} OMCV`;
                        }

                        const dmcv = parseInt(item.actor?.system.characteristics.dmcv?.value || 0);
                        item.system.dcvEstimated = (dmcv + parseInt(cslSummary.dmcv || 0)).signedString();
                        if (dmcv != 0) {
                            if (item.flags.tags.dmcv) {
                                item.flags.tags.dmcv += "\n";
                            } else {
                                item.flags.tags.dmcv = "";
                            }
                            item.flags.tags.dmcv = `${item.flags.tags.dmcv}${dmcv.signedString()} DMCV`;
                        }
                    }

                    // Set +1 OCV
                    const setManeuver = item.actor.items.find(
                        (o) => o.type == "maneuver" && o.name === "Set" && o.system.active,
                    );
                    if (setManeuver) {
                        item.system.ocvEstimated = (parseInt(item.system.ocvEstimated) + 1).signedString();

                        if (item.flags.tags.ocv) {
                            item.flags.tags.ocv += "\n";
                        } else {
                            item.flags.tags.ocv = "";
                        }
                        item.flags.tags.ocv += `+1 Set`;
                    }

                    // Haymaker -5 DCV
                    const haymakerManeuver = item.actor.items.find(
                        (o) => o.type == "maneuver" && o.name === "Haymaker" && o.system.active,
                    );
                    if (haymakerManeuver) {
                        item.system.dcvEstimated = (parseInt(item.system.dcvEstimated) - 4).signedString();

                        if (item.flags.tags.dcv) {
                            item.flags.tags.dcv += "\n";
                        } else {
                            item.flags.tags.dcv = "";
                        }
                        item.flags.tags.dcv += `-4 Haymaker`;
                    }

                    item.system.phase = item.system.PHASE;
                }

                // Defense
                if (item.type == "defense") {
                    item.system.description =
                        CONFIG.HERO.defenseTypes[item.system.defenseType] ||
                        CONFIG.HERO.defenseTypes5e[item.system.defenseType];
                }

                if (item.type == "martialart") {
                    data.hasMartialArts = true;
                }

                if (item.type == "equipment") {
                    data.hasEquipment = true;

                    item.system.weight = (parseFloat(item.system.WEIGHT || 0) * equipmentWeightPercentage).toFixed(1);

                    if (item.system.active) {
                        weightTotal += parseFloat(item.system.weight || 0);
                    }
                    if (parseFloat(item.system.weight || 0) > 0) {
                        item.system.WEIGHTtext = parseFloat(item.system.weight) + "kg";
                    } else {
                        item.system.WEIGHTtext = "";
                    }

                    priceTotal += parseFloat(item.system.PRICE || 0);
                    if (parseFloat(item.system.PRICE || 0) > 0) {
                        item.system.PRICEtext = "$" + Math.round(parseFloat(item.system.PRICE));
                    } else {
                        item.system.PRICEtext = "";
                    }
                }

                item.updateRoll();

                // Charges
                if (parseInt(item.system.charges?.max || 0) > 0) {
                    const costsEnd = item.findModsByXmlid("COSTSEND");
                    if (item.system.endEstimate === 0 || !costsEnd) item.system.endEstimate = "";
                    item.system.endEstimate += ` [${parseInt(item.system.charges?.value || 0)}${
                        item.system.charges?.recoverable ? "rc" : ""
                    }]`;
                    item.system.endEstimate = item.system.endEstimate.trim();
                }

                // 0 END
                if (!item.system.endEstimate) {
                    item.system.endEstimate = "";
                }

                // Mental
                if (item?.flags?.tags?.omcv) {
                    item.flags.tags.ocv ??= item.flags.tags.omcv;
                    item.flags.tags.dcv ??= item.flags.tags.dmcv;
                }

                items.push(foundry.utils.deepClone(item));
            }

            // Sort attacks
            // Sorting is tricky and not done at the moment.
            // Sorting just the attacks may sort powers as well, which can mess up frameworks.
            //data.items = items.filter(o=> o.system.subType === 'attack' || o.attack === 'attack');
            //data.items.sort((a, b) => a.name.localeCompare(b.name) );
            //data.items = [...data.items, ...items.filter(o=> !(o.system.subType === 'attack' || o.attack === 'attack') )]
            //data.items = items.sort((a, b) => ((a.system.subType === 'attack' || a.attack === 'attack') && (b.system.subType === 'attack' || b.attack === 'attack')) ? a.name.localeCompare(b.name) : 0);
            data.items = items;

            if (data.hasEquipment) {
                if (parseFloat(weightTotal).toFixed(1) > 0 || parseFloat(priceTotal).toFixed(2) > 0) {
                    data.weightTotal = parseFloat(weightTotal).toFixed(1) + "kg";
                    data.priceTotal = "$" + parseFloat(priceTotal).toFixed(2);
                }
            }

            // Characteristics
            const characteristicSet = [];

            const powers = getCharacteristicInfoArrayForActor(this.actor);

            for (const powerInfo of powers) {
                this.actor.updateRollable(powerInfo.key.toLowerCase());

                let characteristic = {
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

                // Notes
                if (powerInfo.key === "STR") {
                    const strDetails = this.actor.strDetails();
                    characteristic.notes = `lift ${strDetails.strLiftText}, running throw ${
                        strDetails.strThrow
                    }${getSystemDisplayUnits(data.actor.is5e)}`;
                }

                if (powerInfo.key === "LEAPING")
                    characteristic.notes = `${Math.max(0, characteristic.value)}${getSystemDisplayUnits(
                        data.actor.system.is5e,
                    )} forward, ${Math.max(0, Math.round(characteristic.value / 2))}${getSystemDisplayUnits(
                        data.actor.system.is5e,
                    )} upward`;

                characteristic.delta = 0;
                if (data.actor.system.is5e) {
                    if (powerInfo.key.toLowerCase() === "pd") {
                        characteristic.notes = "5e figured STR/5";
                    }

                    if (powerInfo.key.toLowerCase() === "ed") {
                        characteristic.notes = "5e figured CON/5";
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
                        characteristic.notes = "5e figured DEX/3";
                        characteristic.delta = characteristic.max - characteristic.base;
                    }

                    if (["omcv", "dmcv"].includes(powerInfo.key.toLowerCase())) {
                        characteristic.notes = "5e figured EGO/3";
                        characteristic.delta = characteristic.max - characteristic.base;
                    }
                }

                // Active Effects may be blocking updates
                let ary = [];
                let activeEffects = Array.from(this.actor.allApplicableEffects()).filter((ae) =>
                    ae.changes.find((p) => p.key === `system.characteristics.${powerInfo.key.toLowerCase()}.value`),
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
                    (o) =>
                        o.changes.find((p) => p.key === `system.characteristics.${powerInfo.key.toLowerCase()}.max`) &&
                        !o.disabled,
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
            const defenseCalculationActor = new HeroSystem6eActor(
                {
                    name: "Defense Calculation Actor",
                    type: "pc",
                },
                { temporary: true },
            );
            defenseCalculationActor.system.is5e = this.actor.system.is5e;

            // Defense PD
            const pdContentsAttack = `
            <POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            </POWER>
        `;
            const pdAttack = await new HeroSystem6eItem(
                HeroSystem6eItem.itemDataFromXml(pdContentsAttack, defenseCalculationActor),
                { temporary: true, parent: defenseCalculationActor },
            );
            await pdAttack._postUpload();

            let [
                defenseValue,
                resistantValue /*impenetrableValue*/,
                ,
                damageReductionValue,
                damageNegationValue /*knockbackResistance*/,
                ,
                defenseTagsP,
            ] = determineDefense(this.actor, pdAttack);
            defense.PD = defenseValue;
            defense.rPD = resistantValue;
            defense.PDtags = "PHYSICAL DEFENSE\n";
            defense.rPDtags = "PHYSICAL DEFENSE (RESISTANT)\n";
            for (let tag of defenseTagsP.filter((o) => o.name.match(/pd$/i))) {
                if (tag.resistant) {
                    defense.rPDtags += `${tag.value} ${tag.title}\n`;
                } else if (tag.resistant != undefined) {
                    defense.PDtags += `${tag.value} ${tag.title}\n`;
                }
            }
            defense.drp = damageReductionValue;
            defense.drptags = "DAMAGE REDUCTION PHYSICAL\n";
            for (let tag of defenseTagsP.filter((o) => o.name.match(/drp$/i))) {
                if (tag.resistant) {
                    defense.drptags += `${tag.value} ${tag.title}\n`;
                } else if (tag.resistant != undefined) {
                    defense.drptags += `${tag.value} ${tag.title}\n`;
                }
            }
            defense.dnp = damageNegationValue;
            defense.dnptags = "DAMAGE NEGATION PHYSICAL\n";
            for (let tag of defenseTagsP.filter((o) => o.name.match(/dnp$/i))) {
                defense.dnptags += `${tag.value} ${tag.title}\n`;
            }

            // Defense ED
            const edContentsAttack = `
            <POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            </POWER>
        `;
            const edAttack = await new HeroSystem6eItem(
                HeroSystem6eItem.itemDataFromXml(edContentsAttack, defenseCalculationActor),
                { temporary: true, parent: defenseCalculationActor },
            );
            await edAttack._postUpload();

            let [
                defenseValueE,
                resistantValueE /* impenetrableValueE */,
                ,
                damageReductionValueE,
                damageNegationValueE /* knockbackResistanceE */,
                ,
                defenseTagsE,
            ] = determineDefense(this.actor, edAttack);
            defense.ED = defenseValueE;
            defense.rED = resistantValueE;
            defense.EDtags = "ENERGY DEFENSE\n";
            defense.rEDtags = "ENERGY DEFENSE (RESISTANT)\n";
            for (let tag of defenseTagsE.filter((o) => o.name.match(/ed$/i))) {
                if (tag.resistant) {
                    defense.rEDtags += `${tag.value} ${tag.title}\n`;
                } else if (tag.resistant != undefined) {
                    defense.EDtags += `${tag.value} ${tag.title}\n`;
                }
            }
            defense.dre = damageReductionValueE;
            defense.dretags = "DAMAGE REDUCTION ENERGY\n";
            for (let tag of defenseTagsE.filter((o) => o.name.match(/dre$/i))) {
                if (tag.resistant) {
                    defense.dretags += `${tag.value} ${tag.title}\n`;
                } else if (tag.resistant != undefined) {
                    defense.dretags += `${tag.value} ${tag.title}\n`;
                }
            }
            defense.dne = damageNegationValueE;
            defense.dnetags = "DAMAGE NEGATION ENERGY\n";
            for (let tag of defenseTagsE.filter((o) => o.name.match(/dne$/i))) {
                defense.dnetags += `${tag.value} ${tag.title}\n`;
            }

            // Defense MD
            const mdContentsAttack = `
            <POWER XMLID="EGOATTACK" ID="1695575160315" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            <NOTES />
            </POWER>
        `;
            const mdAttack = await new HeroSystem6eItem(
                HeroSystem6eItem.itemDataFromXml(mdContentsAttack, defenseCalculationActor),
                { temporary: true, parent: defenseCalculationActor },
            );
            await mdAttack._postUpload();

            let [
                defenseValueM,
                resistantValueM /*impenetrableValueM*/,
                ,
                damageReductionValueM,
                damageNegationValueM /*knockbackResistanceM*/,
                ,
                defenseTagsM,
            ] = determineDefense(this.actor, mdAttack);
            defense.MD = defenseValueM;
            defense.rMD = resistantValueM;
            defense.MDtags = "MENTAL DEFENSE\n";
            defense.rMDtags = "MENTAL DEFENSE (RESISTANT)\n";
            for (let tag of defenseTagsM.filter((o) => o.name.match(/md$/i))) {
                if (tag.resistant) {
                    defense.rMDtags += `${tag.value} ${tag.title}\n`;
                } else if (tag.resistant != undefined) {
                    defense.MDtags += `${tag.value} ${tag.title}\n`;
                }
            }
            defense.drm = damageReductionValueM;
            defense.drmtags = "DAMAGE REDUCTION MENTAL\n";
            for (let tag of defenseTagsM.filter((o) => o.name.match(/drm$/i))) {
                if (tag.resistant) {
                    defense.drmtags += `${tag.value} ${tag.title}\n`;
                } else if (tag.resistant != undefined) {
                    defense.drmtags += `${tag.value} ${tag.title}\n`;
                }
            }
            defense.dnm = damageNegationValueM;
            defense.dnmtags = "DAMAGE NEGATION MENTAL\n";
            for (let tag of defenseTagsM.filter((o) => o.name.match(/dnm$/i))) {
                defense.dnmtags += `${tag.value} ${tag.title}\n`;
            }

            // Defense POWD
            const drainContentsAttack = `
            <POWER XMLID="DRAIN" ID="1703727634494" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                <NOTES />
            </POWER>
        `;
            const drainAttack = await new HeroSystem6eItem(
                HeroSystem6eItem.itemDataFromXml(drainContentsAttack, defenseCalculationActor),
                { temporary: true, parent: defenseCalculationActor },
            );
            await drainAttack._postUpload();

            let [
                defenseValuePOWD,
                resistantValuePOWD /*impenetrableValuePOWD*/ /*damageReductionValuePOWD*/ /*damageNegationValuePOWD*/ /*knockbackResistancePOWD*/,
                ,
                ,
                ,
                ,
                defenseTagsPOWD,
            ] = determineDefense(this.actor, drainAttack);
            defense.POWD = defenseValuePOWD;
            defense.rPOWD = resistantValuePOWD;
            defense.POWDtags = "POWER DEFENSE\n";
            defense.rPOWDtags = "POWER DEFENSE (RESISTANT)\n";
            for (let tag of defenseTagsPOWD.filter((o) => o.name.match(/powd$/i))) {
                if (tag.resistant) {
                    defense.rPOWDtags += `${tag.value} ${tag.title}\n`;
                } else if (tag.resistant != undefined) {
                    defense.POWDtags += `${tag.value} ${tag.title}\n`;
                }
            }

            data.defense = defense;

            // Get all applicable effects (from actor and all items)
            data.allTemporaryEffects = Array.from(this.actor.allApplicableEffects())
                .filter((o) => o.duration.duration > 0 || o.statuses.size)
                .sort((a, b) => a.name.localeCompare(b.name));
            data.allConstantEffects = this.actor.getConstantEffects();
            data.allPersistentEffects = this.actor.getPersistentEffects();

            // Add defenses (without active effects) to actorEffects.
            // This provides a nice way to see ALL powers that are effecting
            // the actor regardless of how they are implemented.
            const defensePowers = data.actor.items.filter(
                (o) => (o.system.subType || o.type) === "defense" && !o.effects.size,
            );
            for (let d of defensePowers) {
                d.disabled = !d.system.active;
                switch (getPowerInfo({ xmlid: d.system.XMLID, actor: this.actor })?.duration) {
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
                    default:
                        data.allConstantEffects.push(d);

                        if (game.settings.get(game.system.id, "alphaTesting")) {
                            const powerInfo = getPowerInfo({
                                xmlid: d.system.XMLID,
                                actor: this.actor,
                            });
                            if (!powerInfo) {
                                ui.notifications.warn(`${d.system.XMLID} has no powerInfo/config.`);
                            } else {
                                ui.notifications.warn(`${d.system.XMLID} has no duration specified.`);
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
                    console.warn(`${item?.system?.XMLID} (${item?.name}) has no powerInfo`);
                    continue;
                }

                let activePoints = item.system.activePoints;

                if (item.type == "attack" || item.system.subType === "attack" || item.system.XMLID === "martialart") {
                    const csl = CombatSkillLevelsForAttack(item);
                    let { dc } = convertToDcFromItem(item);

                    if (dc > 0) {
                        let costPerDice =
                            Math.max(Math.floor((item.system.activePoints || 0) / dc) || item.baseInfo.costPerLevel) ||
                            (item.system.targets === "dcv" ? 5 : 10);
                        dc += csl.dc + Math.floor((csl.ocv + csl.dcv) / 2); // Assume CSL are converted to DCs
                        let ap = dc * costPerDice;

                        const charges = item.findModsByXmlid("CHARGES");
                        if (charges) {
                            ap += (parseInt(charges.OPTION_ALIAS) - 1) * 5;
                        }

                        activePoints = Math.max(activePoints, ap);
                    }
                }

                if (activePoints > 0) {
                    let name = item.name;
                    if (item.name.toUpperCase().indexOf(item.system.XMLID) == -1) {
                        name += ` (${item.system.XMLID})`;
                    }

                    data.activePointSummary.push({
                        name: name,
                        activePoints: activePoints,
                    });
                }
            }
            powers;
            data.activePointSummary.sort((a, b) => b.activePoints - a.activePoints);
            let topActivePoints = data.activePointSummary?.[0]?.activePoints;
            data.activePointSummary = data.activePointSummary.filter((o) => o.activePoints >= topActivePoints * 0.5);

            // Display Heroic Action Points
            data.useHAP = game.settings.get(game.system.id, "HAP");

            // Not all actor types have END & STUN
            data.hasEND = powers.find((o) => o.key === "END");
            data.hasSTUN = powers.find((o) => o.key === "STUN");
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
        delete itemData.system.childIdx;

        // Handle item sorting within the same Actor
        // TODO: Allow drag/drop to change order
        if (this.actor.uuid === item.parent?.uuid) return this._onSortItem(event, itemData);

        if (itemData.system.is5e !== this.actor.system.is5e) {
            ui.notifications.warn(
                `${itemData.name} is a ${itemData.system.is5e ? "5e" : "6e"} item.  ${this.actor.name} is a ${
                    this.actor.system.is5e ? "5e" : "6e"
                } actor.  Mixing 5e/6e may have unpredictable results.`,
            );
        }

        // Create the owned item
        await this._onDropItemCreate(itemData, itemData.system.PARENTID);

        // Is this a parent item with children?
        for (const child of item.childItems || []) {
            await this.DropItemFramework(child, itemData.system.ID);
            // const childItemData = childItem.toObject();
            // childItemData.system.ID = new Date().getTime().toString();
            // childItemData.system.PARENTID = itemData.system.ID;
            // await this._onDropItemCreate(childItemData);
        }
    }

    /** @override */
    // eslint-disable-next-line no-unused-vars
    async _onDropItemCreate(itemData, event) {
        itemData = itemData instanceof Array ? itemData : [itemData];
        for (const i of itemData) {
            // Make sure newly dropped items are not active
            if (i.system.active) {
                i.system.active = false;
            }
            // Remove all active effects, _postUpload will recreate them if necessary
            i.effects = [];
        }
        const newItems = await this.actor.createEmbeddedDocuments("Item", itemData);
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
        html.find(".characteristic-roll").click(this._onCharacteristicRoll.bind(this));

        // Toggle items
        html.find(".item-toggle").click(this._onItemToggle.bind(this));

        // Edit Items
        html.find(".item-edit").click(this._onItemEdit.bind(this));

        // Delete Items
        html.find(".item-delete").click(this._onItemDelete.bind(this));

        // Create Items
        html.find(".item-create").click(this._onItemCreate.bind(this));

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

        html.find("td.characteristic-locked").click(this._onUnlockCharacteristic.bind(this));

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
    async _updateObject(_event, formData) {
        let expandedData = foundry.utils.expandObject(formData);

        const characteristics = getCharacteristicInfoArrayForActor(this.actor).filter((o) =>
            ["BODY", "STUN", "END"].includes(o.key),
        );
        for (const _char of characteristics) {
            const characteristic = _char.key.toLowerCase();
            if (
                this.actor.system.characteristics[characteristic] &&
                expandedData.Xsystem.characteristics[characteristic].value !==
                    this.actor.system.characteristics[characteristic].value
            ) {
                expandedData.system.characteristics[characteristic].value =
                    expandedData.Xsystem.characteristics[characteristic].value;
            }
        }

        this.options.itemFilters.power = expandedData.itemFilters.power;
        this.options.itemFilters.skill = expandedData.itemFilters.skill;
        this.options.itemFilters.equipment = expandedData.itemFilters.equipment;

        await this.actor.update(expandedData);

        if (expandedData.system.characteristics) {
            await this.actor.calcCharacteristicsCost();
            await this.actor.CalcActorRealAndActivePoints();
        }

        this.render();
    }

    async _onItemRoll(event) {
        event.preventDefault();
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        item.roll(event);
    }

    async _onItemChat(event) {
        event.preventDefault();
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        item.chat();
    }

    async _onCharacteristicRoll(event) {
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

        const flavor = `${dataset.label.toUpperCase()} (${charRoll}-) roll ${success ? "succeeded" : "failed"} ${
            useAutoSuccess ? `due to automatic ${autoSuccess ? "success" : "failure"}` : `by ${Math.abs(margin)}`
        }`;

        const cardHtml = await heroRoller.render(flavor);

        const actor = this.actor;
        const token = actor.token;
        const speaker = ChatMessage.getSpeaker({ actor: actor, token });
        speaker.alias = actor.name;

        const chatData = {
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            rolls: heroRoller.rawRolls(),
            user: game.user._id,
            content: cardHtml,
            speaker: speaker,
        };

        return ChatMessage.create(chatData);
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
        const itemId = $(event.currentTarget).closest("[data-item-id]").data().itemId;
        const item = this.actor.items.get(itemId);
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title"),
            content: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Content"),
        });

        if (confirmed) {
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
        let content = `${this.actor.system.APPEARANCE || ""}`;
        const perceivable = [];
        for (let item of this.actor.items) {
            if (item.isPerceivable(true)) {
                perceivable.push(`<b>${item.name}</b> ${item.system.description}`);
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
            user: game.user._id,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
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
            await this.actor.uploadFromXml(xmlDoc);
        }.bind(this);
        reader.readAsText(file);
    }

    async _onUnlockCharacteristic(event) {
        event.preventDefault();

        // The event will not be generated from the disabled input (since disabled elements
        // don't generally allow mouse events) but rather from the enclosing td element.
        // Find its child input element
        const input = event.target.querySelector("input");

        // Find all associated Active Effects
        const activeEffects = Array.from(this.actor.allApplicableEffects()).filter((o) =>
            o.changes.find((p) => p.key === input.name),
        );
        for (const ae of activeEffects) {
            // Delete status
            if (ae.statuses) {
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("HERO6EFOUNDRYVTTV2.confirms.deleteConfirm.Title"),
                    content: `Remove ${ae.name}?`,
                });

                if (confirmed) {
                    const actionsToAwait = [];

                    if (ae.flags?.type === "adjustment" && ae.flags.version >= 3) {
                        const parent = ae.parent;
                        for (const target of ae.flags.target) {
                            if (parent.system.characteristics[target]) {
                                // Target is a characteristic or movement
                                const actor = parent;
                                const newMax = actor.system.characteristics[target].max + ae.flags.affectedPoints;
                                const presentValue = actor.system.characteristics[target].value;

                                let newValue = 0;
                                if (ae.flags.affectedPoints < 0) {
                                    // This is a positive adjustment. When it goes away
                                    // the points are lost but anything already lost doesn't go away.
                                    newValue = Math.min(presentValue, newMax);
                                } else {
                                    // This is a negative adjustment. When it goes away
                                    // the points come back.
                                    newValue = presentValue + ae.flags.affectedPoints;
                                }

                                if (newValue !== presentValue) {
                                    const change = {};
                                    change[`system.characteristics.${target}.value`] = newValue;
                                    actionsToAwait.push(actor.update(change));
                                }
                            }
                        }
                    }

                    actionsToAwait.push(ae.delete());

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
                    await ae.parent.toggle();
                }
                continue;
            }
        }

        await this.actor.applyEncumbrancePenalty();
    }
}
