import { getPowerInfo } from "../utility/util.js";

export async function makeAttack(item) {
    ui.notifications.warn(`Old makeAttack(${item.name}) called.`);

    const xmlid = item.system.XMLID || item.system.xmlid || item.system.rules;

    // Confirm this is an attack
    const configPowerInfo = getPowerInfo({ xmlid: xmlid, actor: item.actor });

    let changes = {};

    // Name
    let description = item.system.ALIAS;
    let name =
        item.system.NAME ||
        description ||
        configPowerInfo?.xmlid ||
        item.system.name ||
        item.name;
    changes[`name`] = name;

    let levels =
        parseInt(item.system.LEVELS?.value) || parseInt(item.system.DC) || 0;
    const input = item.system.INPUT;

    const ocv =
        parseInt(item.system.ocv) ||
        parseInt(item.system.OCV) ||
        item.system.OCV ||
        0;
    const dcv =
        parseInt(item.system.dcv) ||
        parseInt(item.system.DCV) ||
        item.system.DCV ||
        0;

    // Check if this is a MARTIAL attack.  If so then EXTRA DC's may be present
    if (item.system.XMLID == "MANEUVER") {
        let EXTRADC = null;

        // HTH
        if (item.system.CATEGORY == "Hand To Hand") {
            EXTRADC = item.actor.items.find(
                (o) =>
                    o.system.XMLID == "EXTRADC" &&
                    o.system.ALIAS.indexOf("HTH") > -1,
            );
        }
        // Ranged is not implemented yet

        // Extract +2 HTH Damage Class(es)
        if (EXTRADC) {
            let match = EXTRADC.system.ALIAS.match(/\+\d+/);
            if (match) {
                levels += parseInt(match[0]);
            }
        }
    }

    // Check if TELEKINESIS + WeaponElement (BAREHAND) + EXTRADC  (WillForce)
    if (item.system.XMLID == "TELEKINESIS") {
        if (
            item.actor.items.find(
                (o) =>
                    o.system.XMLID == "WEAPON_ELEMENT" &&
                    o.system.adders.find((o) => o.XMLID == "BAREHAND"),
            )
        ) {
            let EXTRADC = item.actor.items.find(
                (o) =>
                    o.system.XMLID == "EXTRADC" &&
                    o.system.ALIAS.indexOf("HTH") > -1,
            );
            // Extract +2 HTH Damage Class(es)
            if (EXTRADC) {
                let match = EXTRADC.system.ALIAS.match(/\+\d+/);
                if (match) {
                    levels += parseInt(match[0]) * 5; // Below we take these levels (as STR) and determine dice
                }
            }
        }
    }

    // Active cost is required for endurance calculation.
    // It should include all advantages (which we don't handle very well at the moment)
    // However this should be calculated during power upload (not here)
    // let activeCost = (levels * 5)
    // let end = Math.round(activeCost / 10 - 0.01);
    //changes[`system.activeCost`] = activeCost

    changes[`system.subType`] = "attack";
    changes[`system.class`] = input === "ED" ? "energy" : "physical";
    changes[`system.dice`] = levels;
    changes[`system.extraDice`] = "zero";
    changes[`system.killing`] = false;
    changes[`system.knockbackMultiplier`] = 1;
    changes[`system.targets`] = "dcv";
    changes[`system.uses`] = "ocv";
    changes[`system.usesStrength`] = true;
    changes[`system.areaOfEffect`] = { type: "none", value: 0 };
    changes[`system.piercing`] = 0;
    changes[`system.penetrating`] = 0;
    changes[`system.ocv`] = ocv;
    changes[`system.dcv`] = dcv;
    changes["system.stunBodyDamage"] = "stunbody";

    // BLOCK and DODGE typically do not use STR
    if (["maneuver", "martialart"].includes(item.type)) {
        if (
            item.system.EFFECT?.toLowerCase().indexOf("block") > -1 ||
            item.system.EFFECT?.toLowerCase().indexOf("dodge") > -1
        ) {
            changes[`system.usesStrength`] = false;
        }
    }

    // ENTANGLE (not implemented)
    if (xmlid == "ENTANGLE") {
        changes[`system.class`] = "entangle";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
        changes[`system.knockbackMultiplier`] = 0;
    }

    // DARKNESS (not implemented)
    if (xmlid == "DARKNESS") {
        changes[`system.class`] = "darkness";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // IMAGES (not implemented)
    if (xmlid == "IMAGES") {
        changes[`system.class`] = "images";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // DRAIN (not implemented)
    if (xmlid == "DRAIN") {
        changes[`system.class`] = "drain";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // AID (not implemented)
    if (xmlid == "AID") {
        changes[`system.class`] = "aid";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // TRANSFER
    if (xmlid == "TRANSFER") {
        changes[`system.class`] = "transfer";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // MINDSCAN
    if (xmlid == "MINDSCAN") {
        changes[`system.class`] = "mindscan";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // DISPEL
    if (xmlid == "DISPEL") {
        changes[`system.class`] = "dispel";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // MENTALBLAST
    if (xmlid == "EGOATTACK") {
        changes[`system.class`] = "mental";
        changes[`system.targets`] = "dmcv";
        changes[`system.uses`] = "omcv";
        changes[`system.knockbackMultiplier`] = 0;
        changes[`system.usesStrength`] = false;
        changes["system.stunBodyDamage"] = "stunonly";
        changes["system.noHitLocations"] = true;
    }

    // MINDCONTROL
    if (xmlid == "MINDCONTROL") {
        changes[`system.class`] = "mindcontrol";
        changes[`system.targets`] = "dmcv";
        changes[`system.uses`] = "omcv";
        changes[`system.knockbackMultiplier`] = 0;
        changes[`system.usesStrength`] = false;
        changes["system.stunBodyDamage"] = "stunonly";
        changes["system.noHitLocations"] = true;
    }

    // CHANGEENVIRONMENT
    if (xmlid == "CHANGEENVIRONMENT") {
        changes[`system.class`] = "change enviro";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // FLASH
    if (xmlid == "FLASH") {
        changes[`system.class`] = "flash";
        changes[`system.usesStrength`] = false;
        changes[`system.noHitLocations`] = true;
    }

    // AVAD
    const avad = item.system?.modifiers
        ? item.system.modifiers.find((o) => o.XMLID === "AVAD")
        : null;
    if (avad) {
        changes[`system.class`] = "avad";
    }

    // Armor Piercing
    let ARMORPIERCING = item.system.modifiers.find(
        (o) => o.XMLID == "ARMORPIERCING",
    );
    if (ARMORPIERCING) {
        changes[`system.piercing`] = parseInt(ARMORPIERCING.LEVELS);
    }

    // Penetrating
    let PENETRATING = item.system.modifiers.find(
        (o) => o.XMLID == "PENETRATING",
    );
    if (PENETRATING) {
        changes[`system.penetrating`] = parseInt(PENETRATING.LEVELS);
    }

    // No Knockback
    let NOKB = item.system.modifiers.find((o) => o.XMLID == "NOKB");
    if (NOKB) {
        changes[`system.knockbackMultiplier`] = 0;
    }

    // Double Knockback
    let DOUBLEKB = item.system.modifiers.find((o) => o.XMLID == "DOUBLEKB");
    if (DOUBLEKB) {
        changes[`system.knockbackMultiplier`] = 2;
    }

    // Explosion
    if (item.hasExplosionAdvantage()) {
        if (game.settings.get(game.system.id, "alphaTesting")) {
            ui.notifications.warn(
                `EXPLOSION not implemented during HDC upload of ${item.actor.name}`,
            );
        }
    }

    // Alternate Combat Value (uses OMCV against DCV)
    let ACV = item.system.modifiers.find((o) => o.XMLID == "ACV");
    if (ACV) {
        if (ACV.OPTION_ALIAS === "uses OMCV against DCV") {
            changes[`system.uses`] = "omcv";
            changes[`system.targets`] = "dcv";
        }
        if (ACV.OPTION_ALIAS === "uses OCV against DMCV") {
            changes[`system.uses`] = "ocv";
            changes[`system.targets`] = "dmcv";
        }
        if (ACV.OPTION_ALIAS === "uses OMCV against DCV") {
            changes[`system.uses`] = "omcv";
            changes[`system.targets`] = "dcv";
        }
    }

    if (
        item.system.adders &&
        item.system.adders.find((o) => o.XMLID == "PLUSONEPIP")
    ) {
        changes[`system.extraDice`] = "pip";
    }

    if (
        item.system.adders &&
        item.system.adders.find((o) => o.XMLID == "PLUSONEHALFDIE")
    ) {
        changes[`system.extraDice`] = "half";
    }

    if (
        item.system.adders &&
        item.system.adders.find((o) => o.XMLID == "MINUSONEPIP")
    ) {
        // Typically only allowed for killing attacks.
        //  Appears that +1d6-1 is roughly equal to +1/2 d6
        changes[`system.extraDice`] = "half";
    }

    const aoe = item.system.modifiers.find((o) => o.XMLID == "AOE");
    if (aoe) {
        changes[`system.areaOfEffect`] = {
            type: aoe.OPTION_ALIAS.toLowerCase(),
            value: parseInt(aoe.LEVELS),
        };
    }

    if (xmlid === "HKA" || item.system.EFFECT?.indexOf("KILLING") > -1) {
        changes[`system.killing`] = true;

        // Killing Strike uses DC=2 which is +1/2d6.
        // For now just recalculate that, but ideally rework this function to use DC instead of dice.
        let pips = parseInt(item.system.DC || item.system.LEVELS.value * 3);
        changes["system.dice"] = Math.floor(pips / 3);
        if (pips % 3 == 1) {
            changes["system.extraDice"] = "pip";
        }
        if (pips % 3 == 2) {
            changes["system.extraDice"] = "half";
        }
    }

    if (xmlid === "TELEKINESIS") {
        // levels is the equivalent strength
        changes[`system.extraDice`] = "zero";
        changes[`system.dice`] = 0;
        changes[`system.extraDice`] = "zero";
        changes[`name`] = name + " (TK strike)";
        changes[`system.usesStrength`] = false;
        changes[`system.usesTk`] = true;
    }

    if (xmlid === "ENERGYBLAST") {
        changes[`system.usesStrength`] = false;
    }

    if (xmlid === "RKA") {
        changes[`system.killing`] = true;
        changes[`system.usesStrength`] = false;
    }

    const noStrBonus = item.system.modifiers.find(
        (o) => o.XMLID == "NOSTRBONUS",
    );
    if (noStrBonus) {
        changes[`system.usesStrength`] = false;
    }

    const stunOnly = item.system.modifiers.find((o) => o.XMLID == "STUNONLY");
    if (stunOnly) {
        changes["system.stunBodyDamage"] = "stunonly";
    }

    if (item._id) {
        await item.update(changes, { hideChatMessage: true });
    }

    // Possibly a QUENCH test
    for (let change of Object.keys(changes).filter((o) => o != "_id")) {
        let target = item;
        for (let key of change.split(".")) {
            if (typeof target[key] == "object") {
                target = target[key];
            } else {
                target[key] = changes[change];
            }
        }
    }
}

export async function createEffects(itemData, actor) {
    const configPowerInfo = getPowerInfo({
        xmlid: itemData.system.XMLID || itemData.system.rules,
        actor: actor || this?.actor,
    });

    // Not every powers will have effects
    if (!configPowerInfo) return;
    if (!configPowerInfo?.powerType) return;

    const xmlid = configPowerInfo.xmlid;
    const key = xmlid.toLowerCase();

    // Characteristics (via ActiveEffects)
    if (configPowerInfo?.powerType?.includes("characteristic")) {
        let levels = itemData.system.LEVELS?.value;
        // Add LEVELS to MAX
        let activeEffect = {
            name: `${key.toUpperCase()}+${levels}`,
            origin: itemData.uuid,
            //id: newPower.system.rules,
            icon: "icons/svg/upgrade.svg",
            changes: [
                {
                    key: "system.characteristics." + key + ".max",
                    value: parseInt(levels),
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ],
            flags: {
                XMLID: xmlid.toUpperCase() || itemData.system.XMLID,
            },
            disabled: !itemData.system.AFFECTS_TOTAL,
            transfer: true,
        };
        if (
            activeEffect.name
                .toLowerCase()
                .indexOf(itemData.name.toLowerCase()) == -1
        ) {
            activeEffect.name = itemData.name + " " + activeEffect.name;
        }

        itemData.effects = [activeEffect];
        return;
    }

    // Movement Powers
    if (configPowerInfo?.powerType?.includes("movement")) {
        const key = itemData.system.XMLID.toLowerCase();
        let levels = itemData.system.LEVELS?.value;

        let activeEffect = {
            name: `${key.toUpperCase()}+${levels}`,
            icon: "icons/svg/upgrade.svg",
            changes: [
                {
                    key: `system.characteristics.${key}.max`,
                    value: parseInt(itemData.system.LEVELS?.value),
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ],
            transfer: true,
        };
        if (
            activeEffect.name
                .toLowerCase()
                .indexOf(itemData.name.toLowerCase()) == -1
        ) {
            activeEffect.name = itemData.name + " " + activeEffect.name;
        }

        itemData.effects = [activeEffect];
        return;
    }

    if (xmlid === "DENSITYINCREASE") {
        const levels = parseInt(parseInt(itemData.system.LEVELS?.value));

        const strAdd = Math.floor(levels) * 5;
        const pdAdd = Math.floor(levels);
        const edAdd = Math.floor(levels);

        let activeEffect = {
            name: itemData.name,
            icon: "icons/svg/upgrade.svg",
            changes: [
                {
                    key: "system.characteristics.str.max",
                    value: strAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    key: "system.characteristics.pd.max",
                    value: pdAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
                {
                    key: "system.characteristics.ed.max",
                    value: edAdd,
                    mode: CONST.ACTIVE_EFFECT_MODES.ADD,
                },
            ],
            transfer: true,
        };

        itemData.effects = [activeEffect];
        return;
    }
}

export async function updateItemSubTypes(actor, removeDups) {
    // Update Item SubType
    for (const item of actor.items) {
        const configPowerInfo = getPowerInfo({ item: item });

        // Defenses
        if (configPowerInfo && configPowerInfo.powerType?.includes("defense")) {
            await item.update(
                { "system.subType": "defense", "system.showToggle": true },
                { hideChatMessage: true },
            );
        }

        // Is this a movement power?
        if (
            configPowerInfo &&
            configPowerInfo.powerType?.includes("movement")
        ) {
            await item.update(
                { "system.subType": "movement", "system.showToggle": true },
                { hideChatMessage: true },
            );
        }

        // Is this an attack power?
        if (configPowerInfo && configPowerInfo.powerType?.includes("attack")) {
            if (item.system.subType != "attack" || !item.system.dice) {
                await makeAttack(item);
                await item.update(
                    { "system.subType": "attack", "system.showToggle": true },
                    { hideChatMessage: true },
                );
            }
        }

        // Remove duplicate attacks
        if (removeDups && item.type == "attack") {
            const power = actor.items.find(
                (o) => o.name == item.name && o.system.subType == "attack",
            );
            if (power) {
                await item.delete();
            }
        }

        // Skills
        if (configPowerInfo && configPowerInfo.powerType?.includes("skill")) {
            await item.update(
                { "system.subType": "skill" },
                { hideChatMessage: true },
            );
        }
    }
}
