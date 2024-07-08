import { HEROSYS } from "../herosystem6e.mjs";
import { getPowerInfo } from "../utility/util.mjs";
function determineDefense(targetActor, attackItem, options) {
    if (!attackItem.findModsByXmlid) {
        console.error("Invalid attackItem", attackItem);
    }

    //const avad = attackItem.findModsByXmlid("AVAD");
    //const attackType = avad ? "avad" : attackItem.system.class;
    let attackType = attackItem.system.class;
    if (attackType === "avad") {
        switch (attackItem.system.INPUT) {
            case "PD":
                attackType = "physical";
                break;
            case "ED":
                attackType = "energy";
                break;
            case "MD":
                attackType = "mental";
                break;
            default:
                console.error("Unknown attackType");
        }
    }

    if (!["physical", "energy", "mental"].includes(attackType) && attackItem.baseInfo?.type.includes("mental")) {
        attackType = "mental";
    }

    const piercing = parseInt(attackItem.system.piercing) || attackItem.findModsByXmlid("ARMORPIERCING") || 0;
    const penetrating = parseInt(attackItem.system.penetrating) || attackItem.findModsByXmlid("PENETRATING") || 0;

    // The defenses that are active
    const activeDefenses = targetActor.items.filter(
        (o) =>
            (o.system.subType === "defense" || o.type === "defense" || o.baseInfo?.type?.includes("defense")) &&
            (o.system.active || o.effects.find(() => true)?.disabled === false) &&
            !(options?.ignoreDefenseIds || []).includes(o.id),
    );

    let PD = parseInt(targetActor.system.characteristics.pd.value); // physical defense
    let ED = parseInt(targetActor.system.characteristics.ed.value); // energy defense
    let MD = 0; // mental defense
    let POWD = 0; // power defense
    let rPD = 0; // resistant physical defense
    let rED = 0; // resistant energy defense
    let rMD = 0; // resistant mental defense (a silly but possible thing)
    let rPOWD = 0; // resistant power defense (a silly but possible thing)
    let DRP = 0; // damage reduction physical
    let DRE = 0; // damage reduction energy
    let DRM = 0; // damage reduction mental
    let DNP = 0; // damage negation physical
    let DNE = 0; // damage negation energy
    let DNM = 0; // damage negation mental
    let knockbackResistance = 0;

    // Check if we are supposed to ignore PD/ED (eg AVAD)
    if (options?.ignoreDefenseIds.includes("PD")) {
        PD = 0;
    }
    if (options?.ignoreDefenseIds.includes("ED")) {
        ED = 0;
    }

    // DAMAGERESISTANCE (converts PD to rPD)
    for (const item of activeDefenses.filter((o) => o.system.XMLID == "DAMAGERESISTANCE")) {
        const pdLevels = Math.min(PD, parseInt(item.system.PDLEVELS) || 0);
        PD -= pdLevels;
        rPD += pdLevels;
        const edLevels = Math.min(ED, parseInt(item.system.EDLEVELS) || 0);
        ED -= edLevels;
        rED += edLevels;
        const mdLevels = Math.min(MD, parseInt(item.system.MDLEVELS) || 0);
        MD -= mdLevels;
        rMD += mdLevels;

        // TODO:
        // Characters can also purchase Damage Resistance
        // for Mental Defense, Flash Defense, Power
        // Defense, or similar Defense Powers to make them
        // Resistant.:
    }

    // PD bought as resistant
    for (const item of activeDefenses.filter((o) => o.system.XMLID == "PD")) {
        if (item.findModsByXmlid("RESISTANT")) {
            const levels = parseInt(item.system.value) || 0;
            PD -= levels;
            rPD += levels;

            if (item.system.ADD_MODIFIERS_TO_BASE) {
                PD -= targetActor.system.characteristics.pd.core;
                rPD += targetActor.system.characteristics.pd.core;
            }
        }
    }

    // ED bought as resistant
    for (const item of activeDefenses.filter((o) => o.system.XMLID == "ED")) {
        if (item.findModsByXmlid("RESISTANT")) {
            const levels = parseInt(item.system.value) || 0;
            ED -= levels;
            rED += levels;
        }

        if (item.system.ADD_MODIFIERS_TO_BASE === "Yes") {
            ED -= targetActor.system.characteristics.ed.core;
            rED += targetActor.system.characteristics.ed.core;
        }
    }

    // Bases & Vehicles have resistant PD & ED
    if (["base2", "vehicle"].includes(targetActor?.type)) {
        rPD += PD;
        PD = 0;
        rED += ED;
        ED = 0;
    }

    // Impenetrable (defense vs penetrating)
    let impenetrableValue = 0;

    // tags (defenses) will be displayed on apply damage card
    let defenseTags = [];

    switch (attackType) {
        case "physical":
            if (PD > 0)
                defenseTags.push({
                    name: "PD",
                    value: PD,
                    resistant: false,
                    title: "Natural PD",
                });
            if (rPD > 0)
                defenseTags.push({
                    name: "rPD",
                    value: rPD,
                    resistant: true,
                    title: "resistant PD",
                });
            break;
        case "energy":
            if (ED > 0)
                defenseTags.push({
                    name: "ED",
                    value: ED,
                    resistant: false,
                    title: "Natural ED",
                });
            if (rED > 0)
                defenseTags.push({
                    name: "rED",
                    value: rED,
                    resistant: true,
                    title: "resistant ED",
                });
            break;
        case "mental":
        case "adjustment":
            break;
    }

    // Armor Piercing of natural PD and ED
    // Notice the tag (above) shows full defenses, but we half it here
    if (piercing) {
        PD = Math.round(PD / 2);
        ED = Math.round(ED / 2);
        rPD = Math.round(rPD / 2);
        rED = Math.round(rED / 2);
    }

    for (const activeDefense of activeDefenses) {
        let value = parseInt(activeDefense.system.value) || 0;

        const xmlid = activeDefense.system.XMLID;

        // Hardened
        let hardened = parseInt(
            activeDefense.system.hardened || activeDefense.findModsByXmlid("HARDENED")?.LEVELS || 0,
        );
        let tagXmlids = [];
        if (hardened > 0) {
            tagXmlids.push(`h${hardened}`);
        }

        // Impenetrable
        let impenetrable = parseInt(
            activeDefense.system.impenetrable || activeDefense.findModsByXmlid("IMPENETRABLE")?.LEVELS || 0,
        );
        if (impenetrable > 0) {
            tagXmlids.push(`i${impenetrable}`);
        }

        // Resistant Defenses
        if (["FORCEFIELD", "FORCEWALL", "ARMOR"].includes(xmlid)) {
            switch (attackType) {
                case "physical":
                    value = parseInt(activeDefense.system.PDLEVELS) || 0;
                    activeDefense.system.defenseType = "pd";
                    activeDefense.system.resistant = true;
                    break;

                case "energy":
                    value = parseInt(activeDefense.system.EDLEVELS) || 0;
                    activeDefense.system.defenseType = "ed";
                    activeDefense.system.resistant = true;
                    break;

                case "mental":
                    value = parseInt(activeDefense.system.MDLEVELS) || 0;
                    activeDefense.system.defenseType = "md";
                    activeDefense.system.resistant = true;
                    break;

                case "adjustment":
                    value = parseInt(activeDefense.system.POWDLEVELS) || 0;
                    activeDefense.system.defenseType = "powd";
                    activeDefense.system.resistant = true;
                    break;
            }
        }

        if (["POWERDEFENSE"].includes(xmlid)) {
            switch (attackType) {
                case "adjustment":
                    activeDefense.system.defenseType = "powd";
                    break;
            }
        }

        if (["MENTALDEFENSE"].includes(xmlid)) {
            switch (attackType) {
                case "mental":
                    activeDefense.system.defenseType = "md";
                    break;
            }
        }

        if (!value && ["DAMAGEREDUCTION"].includes(xmlid) && activeDefense.system.INPUT.toLowerCase() == attackType) {
            value = parseInt(activeDefense.system.OPTIONID.match(/\d+/)) || 0;
            activeDefense.system.resistant = activeDefense.system.OPTIONID.match(/RESISTANT/) ? true : false;
            switch (attackType) {
                case "physical":
                    activeDefense.system.defenseType = "drp";
                    break;

                case "energy":
                    activeDefense.system.defenseType = "dre";
                    break;

                case "mental":
                    activeDefense.system.defenseType = "drm";
                    break;
            }
        }

        if (!value && ["DAMAGENEGATION"].includes(xmlid)) {
            switch (attackType) {
                case "physical":
                    activeDefense.system.defenseType = "dnp";
                    value = parseInt(activeDefense.system.ADDER.find((o) => o.XMLID == "PHYSICAL")?.LEVELS) || 0;
                    break;

                case "energy":
                    activeDefense.system.defenseType = "dne";
                    value = parseInt(activeDefense.system.ADDER.find((o) => o.XMLID == "ENERGY")?.LEVELS) || 0;
                    break;

                case "mental":
                    activeDefense.system.defenseType = "dnm";
                    value = parseInt(activeDefense.system.ADDER.find((o) => o.XMLID == "MENTAL")?.LEVELS) || 0;
                    break;
            }
        }

        if (["COMBAT_LUCK"].includes(xmlid)) {
            switch (attackType) {
                case "physical":
                    activeDefense.system.defenseType = "pd";
                    value = (parseInt(activeDefense.system.value) || 0) * 3;
                    activeDefense.system.resistant = true;
                    break;

                case "energy":
                    activeDefense.system.defenseType = "ed";
                    value = (parseInt(activeDefense.system.value) || 0) * 3;
                    activeDefense.system.resistant = true;
                    break;
            }
        }

        // Knockback Resistance
        if (game.settings.get(HEROSYS.module, "knockback") && attackItem.system.knockbackMultiplier) {
            if (["KBRESISTANCE", "DENSITYINCREASE"].includes(xmlid)) {
                let _value = value * (targetActor.system.is5e ? 1 : 2);
                knockbackResistance += _value;
                defenseTags.push({
                    value: _value,
                    name: "KB" + tagXmlids,
                    title: activeDefense.name,
                });
            }

            if (["GROWTH"].includes(xmlid)) {
                const configPowerInfo = getPowerInfo({ item: activeDefense });
                const details = configPowerInfo?.details(activeDefense) || {};
                let _value = details.kb;
                knockbackResistance += _value;
                defenseTags.push({
                    value: _value,
                    name: "KB" + tagXmlids,
                    title: activeDefense.name,
                });
            }

            if (["SHRINKING"].includes(xmlid)) {
                let _value = -value * (targetActor.system.is5e ? 3 : 6);
                knockbackResistance += _value;
                defenseTags.push({
                    value: _value,
                    name: "KB" + tagXmlids,
                    title: activeDefense.name,
                });
            }
        }

        let valueAp = value;
        let valueImp = 0;

        // Armor Piercing
        if (piercing > hardened) {
            valueAp = Math.round(valueAp / 2);
        }

        // Penetrating
        if (penetrating <= impenetrable) {
            valueImp = valueAp;
        }

        const protectionType = (activeDefense.system.resistant ? "r" : "") + activeDefense.system.defenseType;
        switch (protectionType) {
            case "pd": // Physical Defense
                PD += valueAp;
                if (attackType === "physical" || attackType === "avad") {
                    if (valueAp > 0)
                        defenseTags.push({
                            name: "PD" + tagXmlids,
                            value: value,
                            resistant: false,
                            title: activeDefense.name,
                        });
                    impenetrableValue += valueImp;
                }
                break;

            case "ed": // Energy Defense
                ED += valueAp;
                if (attackType === "energy" || attackType === "avad") {
                    if (valueAp > 0)
                        defenseTags.push({
                            name: "ED" + tagXmlids,
                            value: value,
                            resistant: false,
                            title: activeDefense.name,
                        });
                    impenetrableValue += valueImp;
                }
                break;

            case "md": // Mental Defense
                MD += valueAp;
                if (attackType === "mental" || attackType === "avad") {
                    if (valueAp > 0)
                        defenseTags.push({
                            name: "MD" + tagXmlids,
                            value: value,
                            resistant: false,
                            title: activeDefense.name,
                        });
                    impenetrableValue += valueImp;
                }
                break;

            case "powd": // Power Defense
                POWD += valueAp;
                if (["adjustment"].includes(attackType) || attackType === "avad") {
                    if (valueAp > 0)
                        defenseTags.push({
                            name: "POWD" + tagXmlids,
                            value: value,
                            resistant: false,
                            title: activeDefense.name,
                        });
                    impenetrableValue += valueImp;
                }
                break;

            case "rpd": // Resistant PD
                rPD += valueAp;
                if (attackType === "physical" || attackType === "avad") {
                    if (valueAp > 0)
                        defenseTags.push({
                            name: "rPD" + tagXmlids,
                            value: value,
                            resistant: true,
                            title: activeDefense.name,
                        });
                    impenetrableValue += valueImp;
                }
                break;

            case "red": // Resistant ED
                rED += valueAp;
                if (attackType === "energy" || attackType === "avad") {
                    if (valueAp > 0)
                        defenseTags.push({
                            name: "rED" + tagXmlids,
                            value: value,
                            resistant: true,
                            title: activeDefense.name,
                        });
                    impenetrableValue += valueImp;
                }
                break;

            case "rmd": // Resistant MD
                rMD += valueAp;
                if (attackType === "mental" || attackType === "avad") {
                    if (valueAp > 0)
                        defenseTags.push({
                            name: "rMD" + tagXmlids,
                            value: value,
                            resistant: true,
                            title: activeDefense.name,
                        });
                    impenetrableValue += valueImp;
                }
                break;

            case "rpowd": // Resistant Power Defense
                rPOWD += valueAp;
                if (["adjustment"].includes(attackType) || attackType === "avad") {
                    if (valueAp > 0)
                        defenseTags.push({
                            name: "rPOWD" + tagXmlids,
                            value: value,
                            resistant: true,
                            title: activeDefense.name,
                        });
                    impenetrableValue += valueImp;
                }
                break;

            case "drp": // Damage Reduction Physical
            case "rdrp":
                if (value > 0)
                    defenseTags.push({
                        name: "drp" + tagXmlids,
                        value: `${activeDefense.system.resistant ? "r" : ""}${value}%`,
                        resistant: activeDefense.system.resistant,
                        title: activeDefense.name,
                    });
                DRP = Math.max(DRP, value);
                break;

            case "dre": // Damage Reduction Energy
            case "rdre":
                if (value > 0)
                    defenseTags.push({
                        name: "dre" + tagXmlids,
                        value: `${activeDefense.system.resistant ? "r" : ""}${value}%`,
                        resistant: activeDefense.system.resistant,
                        title: activeDefense.name,
                    });
                DRE = Math.max(DRE, value);
                break;

            case "drm": // Damage Reduction Mental
            case "rdrm":
                if (value > 0)
                    defenseTags.push({
                        name: "drm" + tagXmlids,
                        value: `${activeDefense.system.resistant ? "r" : ""}${value}%`,
                        resistant: activeDefense.system.resistant,
                        title: activeDefense.name,
                    });
                DRM = Math.max(DRM, value);
                break;

            case "dnp": // Damage Negation Physical
                if (value > 0)
                    defenseTags.push({
                        name: "dnp" + tagXmlids,
                        value: value,
                        resistant: false,
                        title: activeDefense.name,
                    });
                DNP += value;
                break;

            case "dne": // Damage Negation Energy
                if (value > 0)
                    defenseTags.push({
                        name: "dne" + tagXmlids,
                        value: value,
                        resistant: false,
                        title: activeDefense.name,
                    });
                DNE += value;
                break;

            case "dnm": // Damage Negation Mental
                if (value > 0)
                    defenseTags.push({
                        name: "dnm" + tagXmlids,
                        value: value,
                        resistant: false,
                        title: activeDefense.name,
                    });
                DNM += value;
                break;

            case "kbr": // Knockback Resistance
                knockbackResistance += value;
                if (attackType != "mental" && game.settings.get(HEROSYS.module, "knockback")) {
                    defenseTags.push({
                        name: "KB Resistance" + tagXmlids,
                        value: value,
                        title: activeDefense.name,
                    });
                }
                break;

            default:
                // TODO: Mostly likely this is flash defense missing
                // if (game.settings.get(game.system.id, "alphaTesting")) {
                //     const warnMessage = `${activeDefense.name}: ${activeDefense.system.defenseType} not yet supported!`;
                //     ui.notifications.warn(warnMessage);
                //     HEROSYS.log(false, warnMessage);
                // }
                break;
        }
    }

    let defenseValue = 0;
    let resistantValue = 0;
    let damageReductionValue = 0;
    let damageNegationValue = 0;
    switch (attackType) {
        case "physical":
            defenseValue = PD;
            resistantValue = rPD;
            //impenetrableValue = Math.max(PD, rPD);
            damageReductionValue = DRP;
            damageNegationValue = DNP;
            break;

        case "energy":
            defenseValue = ED;
            resistantValue = rED;
            //impenetrableValue = Math.max(ED, rED);
            damageReductionValue = DRE;
            damageNegationValue = DNE;
            break;

        case "mental":
            defenseValue = MD;
            resistantValue = rMD;
            //impenetrableValue = Math.max(MD, rMD);
            damageReductionValue = DRM;
            damageNegationValue = DNM;
            break;

        case "adjustment":
            defenseValue = POWD;
            resistantValue = rPOWD;
            //impenetrableValue = Math.max(POWD, rPOWD);
            damageReductionValue = DRM;
            damageNegationValue = DNM;
            break;

        case "avad":
            defenseValue = PD + ED + MD + POWD;
            resistantValue = rPD + rED + rMD + rPOWD;
            //impenetrableValue = Math.max(PD, rPD) + Math.max(ED, rED) + Math.max(MD, rMD) + Math.max(POWD, rPOWD);
            damageReductionValue = DRM;
            damageNegationValue = DNM;
            defenseTags;
            break;
    }

    return [
        defenseValue,
        resistantValue,
        impenetrableValue,
        damageReductionValue,
        damageNegationValue,
        knockbackResistance,
        defenseTags,
    ];
}

export { determineDefense };
