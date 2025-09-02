import { HeroSystemGenericSharedCache } from "./utility/cache.mjs";
import { createDefenseProfile } from "./utility/defense.mjs";
import * as heroDice from "./utility/dice.mjs";
import { RoundFavorPlayerDown, RoundFavorPlayerUp } from "./utility/round.mjs";
import {
    getRoundedUpDistanceInSystemUnits,
    getSystemDisplayUnits,
    hexDistanceToSystemDisplayString,
} from "./utility/units.mjs";
import { HeroSystem6eActor } from "./actor/actor.mjs";
import {
    characteristicValueToDiceParts,
    dicePartsToFullyQualifiedEffectFormula,
    maneuverBaseEffectDicePartsBundle,
    maneuverDoesKillingDamage,
} from "./utility/damage.mjs";

export const HERO = { heroDice, cache: HeroSystemGenericSharedCache };

HERO.folderColors = {
    // Base Category
    Perks: "#0000aa",
    Powers: "#ff0000",
    Skills: "#00aa00",
    Talents: "#00aaaa",

    // Sub Categories of POWER
    "Powers.Characteristics": "#ff6666",
    "Powers.Perks": "#ff6666",
    "Powers.Skill": "#ff6666",
    "Powers.Talents": "#ff6666",
};

HERO.attacksWith = {
    ocv: "OCV",
    omcv: "OMCV",
};

HERO.defendsWith = {
    dcv: "DCV",
    dmcv: "DMCV",
};

HERO.defenseTypes = {
    pd: "Physical Defense",
    ed: "Energy Defense",
    md: "Mental Defense",
    rpd: "Resistant PD",
    red: "Resistant ED",
    rmd: "Resistant MD",
    drp: "Damage Reduction Physical",
    dre: "Damage Reduction Energy",
    drm: "Damage Reduction Mental",
    dnp: "Damage Negation Physical",
    dne: "Damage Negation Energy",
    dnm: "Damage Negation Mental",
    powd: "Power Defense",
    kbr: "Knockback Resistance",
    fd: "Flash Defense",
    br: "Barrier",
    df: "Deflection",
};

HERO.defenseTypes5e = {
    pd: "Physical Defense",
    ed: "Energy Defense",
    md: "Mental Defense",
    rpd: "Resistant PD",
    red: "Resistant ED",
    rmd: "Resistant MD",
    drp: "Damage Reduction Physical",
    dre: "Damage Reduction Energy",
    drm: "Damage Reduction Mental",
    dnp: "Damage Negation Physical",
    dne: "Damage Negation Energy",
    dnm: "Damage Negation Mental",
    powd: "Power Defense",
    kbr: "Knockback Resistance",
    fd: "Flash Defense",
    br: "Barrier",
    df: "Deflection",
    low: "Lack of Weakness",
};

HERO.attackClasses = {
    physical: "Physical",
    energy: "Energy",
    mental: "Mental",
};

HERO.skillCharacteristics = {
    GENERAL: "GENERAL",
    STR: "STR",
    DEX: "DEX",
    CON: "CON",
    INT: "INT",
    EGO: "EGO",
    PRE: "PRE",
};

HERO.skillCharacteristics5e = {
    GENERAL: "GENERAL",
    STR: "STR",
    DEX: "DEX",
    CON: "CON",
    INT: "INT",
    EGO: "EGO",
    PRE: "PRE",
    COM: "COM",
};

HERO.skillTraining = {
    untrained: "Untrained",
    familiar: "Familiar",
    everyman: "Everyman",
    proficient: "Proficient",
    trained: "Trained",
};

HERO.hitLocationsToHit = Object.freeze({
    3: "Head",
    4: "Head",
    5: "Head",
    6: "Hand",
    7: "Arm",
    8: "Arm",
    9: "Shoulder",
    10: "Chest",
    11: "Chest",
    12: "Stomach",
    13: "Vitals",
    14: "Thigh",
    15: "Leg",
    16: "Leg",
    17: "Foot",
    18: "Foot",
    19: "Foot", // 19 is possible only with special hit locations
});

HERO.hitLocations = Object.freeze({
    Head: {
        label: "Head",
        stunX: 5,
        nStunX: 2,
        bodyX: 2,
        ocvMod: -8,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Hand: {
        label: "Hand",
        stunX: 1,
        nStunX: 1 / 2,
        bodyX: 1 / 2,
        ocvMod: -6,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Arm: {
        label: "Arm",
        stunX: 2,
        nStunX: 1 / 2,
        bodyX: 1 / 2,
        ocvMod: -5,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Shoulder: {
        label: "Shoulder",
        stunX: 3,
        nStunX: 1,
        bodyX: 1,
        ocvMod: -5,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Chest: {
        label: "Chest",
        stunX: 3,
        nStunX: 1,
        bodyX: 1,
        ocvMod: -3,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Stomach: {
        label: "Stomach",
        stunX: 4,
        nStunX: 3 / 2,
        bodyX: 1,
        ocvMod: -7,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Vitals: {
        label: "Vitals",
        stunX: 4,
        nStunX: 3 / 2,
        bodyX: 2,
        ocvMod: -8,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Thigh: {
        label: "Thigh",
        stunX: 2,
        nStunX: 1,
        bodyX: 1,
        ocvMod: -4,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Leg: {
        label: "Leg",
        stunX: 2,
        nStunX: 1 / 2,
        bodyX: 1 / 2,
        ocvMod: -6,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },
    Foot: {
        label: "Foot",
        stunX: 1,
        nStunX: 1 / 2,
        bodyX: 1 / 2,
        ocvMod: -8,
        dice: null,
        constant: null,
        isSpecialHl: false,
    },

    HeadShot: {
        label: "Head Shot: Head - Shoulders",
        stunX: null,
        nStunX: null,
        bodyX: null,
        ocvMod: -4,
        dice: 1,
        constant: 3,
        isSpecialHl: true,
    },
    HighShot: {
        label: "High Shot: Head - Vitals",
        stunX: null,
        nStunX: null,
        bodyX: null,
        ocvMod: -2,
        dice: 2,
        constant: 1,
        isSpecialHl: true,
    },
    BodyShot: {
        label: "Body Shot: Hands - Legs",
        stunX: null,
        nStunX: null,
        bodyX: null,
        ocvMod: -1,
        dice: 2,
        constant: 4,
        isSpecialHl: true,
    },
    LowShot: {
        label: "Low Shot: Shoulders - Feet",
        stunX: null,
        nStunX: null,
        bodyX: null,
        ocvMod: -2,
        dice: 2,
        constant: 7,
        isSpecialHl: true,
    },
    LegShot: {
        label: "Leg Shot: Vitals - Feet",
        stunX: null,
        nStunX: null,
        bodyX: null,
        ocvMod: -4,
        dice: 1,
        constant: 12,
        isSpecialHl: true,
    },
});

HERO.isSpecialHitLocation = function (location) {
    return HERO.hitLocations[location]?.isSpecialHl ?? false;
};

HERO.sidedLocations = new Set(["Hand", "Shoulder", "Arm", "Thigh", "Leg", "Foot"]);

HERO.hitLocationSide = Object.freeze({
    Left: "Left",
    Right: "Right",
});

HERO.RANGE_TYPES = {
    LIMITED_RANGE: "Limited Range",
    LINE_OF_SIGHT: "Line of Sight",
    NO_RANGE: "No Range",
    RANGE_BASED_ON_STR: "Range Based on STR",
    SELF: "Self",
    SPECIAL: "Special",
    STANDARD: "Standard",
};

HERO.mindScanChoices = [
    {
        label: `1 mind; -0 OMCV`,
        key: 0,
    },
    {
        label: `10 minds; -2 OMCV`,
        key: -2,
    },
    {
        label: `100 minds (Theater); -4 OMCV`,
        key: -4,
    },
    {
        label: `1,000 minds (Apartment Building); -6 OMCV`,
        key: -6,
    },
    {
        label: `10,000 minds (Small Town); -8 OMCV`,
        key: -8,
    },
    {
        label: `100,000 minds (Large Town); -10 OMCV`,
        key: -10,
    },
    {
        label: `1,000,000 minds (Major City); -12 OMCV`,
        key: -12,
    },
    {
        label: `10,000,000 minds (Small Nation); -14 OMCV`,
        key: -14,
    },
    {
        label: `100,000,000 minds (Large Nation); -16 OMCV`,
        key: -16,
    },
    {
        label: `1,000,000,000 minds (Continent); -18 OMCV`,
        key: -18,
    },
    {
        label: `10,000,000,000 minds (Large Planet); -20 OMCV`,
        key: -20,
    },
];

HERO.PENALTY_SKILL_LEVELS_TYPES = {
    range: "range",
    hitLocation: "hitLocation",
    encumbrance: "encumbrance",
};

// TODO: This could be created from powers.
HERO.movementPowers = Object.freeze({
    extradimensionalmovement: "Extra Dimensional Movement",
    flight: "Flight",
    ftl: "Faster Than Light",
    leaping: "Leaping",
    running: "Running",
    swimming: "Swimming",
    swinging: "Swinging",
    teleportation: "Teleportation",
    tunneling: "Tunneling",
});

HERO.movementPowers5e = Object.freeze({
    ...HERO.movementPowers,
    gliding: "Gliding",
});

function validatePowers() {
    let numViolations = 0;

    // Has behaviors property
    const powersWithoutBehaviorsProperty = this.filter((power) => !power.behaviors);
    if (powersWithoutBehaviorsProperty.length > 0) {
        console.log(`Powers without behaviors property: `, powersWithoutBehaviorsProperty);
    }
    numViolations += powersWithoutBehaviorsProperty.length;

    // Has key property
    const powersWithoutKeyProperty = this.filter((power) => !power.key);
    if (powersWithoutKeyProperty.length > 0) {
        console.log(`Powers without key property: `, powersWithoutKeyProperty);
    }
    numViolations += powersWithoutKeyProperty.length;

    // Has XML property
    const powersWithoutXmlProperty = this.filter((power) => !power.key);
    if (powersWithoutXmlProperty.length > 0) {
        console.log(`Powers without xml property: `, powersWithoutXmlProperty);
    }
    numViolations += powersWithoutXmlProperty.length;

    // All powers with XML need to have matching key and XMLID
    const powersWithoutMatchingKeyAndXmlid = this.filter((power) => {
        if (!power.xml) {
            return false;
        }

        const parser = new DOMParser();
        const xml = parser.parseFromString(power.xml.trim(), "text/xml");

        // Make sure XMLID's match, if not then skip
        return power.key !== xml.children[0].getAttribute("XMLID");
    });
    if (powersWithoutMatchingKeyAndXmlid.length > 0) {
        console.log(`Powers without matching key and XMLID: `, powersWithoutMatchingKeyAndXmlid);
    }
    numViolations += powersWithoutMatchingKeyAndXmlid.length;

    // Has range property and is not framework/compound/adder/modifier
    const powersWithoutRangeProperty = this.filter(
        (power) =>
            !(
                power.behaviors.includes("adder") ||
                power.behaviors.includes("modifier") ||
                power.type.includes("framework") ||
                power.type.includes("compound")
            ) && !power.range,
    );
    if (powersWithoutRangeProperty.length > 0) {
        console.log(`Powers without range property: `, powersWithoutRangeProperty);
    }
    numViolations += powersWithoutRangeProperty.length;

    // A power (not modifier or adder) without duration property?
    const powersWithoutDurationProperty = this.filter(
        (power) =>
            !(power.behaviors.includes("adder") || power.behaviors.includes("modifier")) &&
            !power.duration &&
            (power.type.includes("adjustment ") ||
                (power.type.includes("attack") && !power.type.includes("martial")) ||
                power.type.includes("defense") ||
                power.type.includes("movement") ||
                power.type.includes("body-affecting") ||
                power.type.includes("standard") ||
                power.type.includes("skills")),
    );
    if (powersWithoutDurationProperty.length > 0) {
        console.log(`Powers without duration property: `, powersWithoutDurationProperty);
    }
    numViolations += powersWithoutDurationProperty.length;

    // All powers have a costPerLevel function
    const powersWithoutCostPerLevelFunction = this.filter(
        (power) => !(power.costPerLevel && typeof power.costPerLevel === "function"),
    );
    if (powersWithoutCostPerLevelFunction.length > 0) {
        console.log(`Powers without costPerLevel function: `, powersWithoutCostPerLevelFunction);
    }
    numViolations += powersWithoutCostPerLevelFunction.length;

    // All modifiers have a dcAffecting function
    const modifiersWithoutDcAffectingFunction = this.filter(
        (power) => power.behaviors.includes("modifier") && typeof power.dcAffecting !== "function",
    );
    if (modifiersWithoutDcAffectingFunction.length > 0) {
        console.log(`Modifiers without dcAffecting function: `, modifiersWithoutDcAffectingFunction);
    }
    numViolations += modifiersWithoutDcAffectingFunction.length;

    // All effect causing powers have a effect rolling function
    const powersOrManeuversWithoutEffectsDicePartsFunction = this.filter(
        (power) =>
            !(power.behaviors.includes("modifier") || power.behaviors.includes("adder")) &&
            (power.type.includes("attack") || power.type.includes("maneuver") || power.behaviors.includes("dice")) &&
            typeof power.baseEffectDicePartsBundle !== "function",
    );
    if (powersOrManeuversWithoutEffectsDicePartsFunction.length > 0) {
        console.log(`Powers without effects dice parts function: `, powersOrManeuversWithoutEffectsDicePartsFunction);
    }
    numViolations += powersOrManeuversWithoutEffectsDicePartsFunction.length;

    // All powers that roll damage/effect dice should have a doesKillingDamage boolean field
    const damageEffectPowersWithoutDoesKillingDamageFunction = this.filter(
        (power) => power.behaviors.includes("dice") && typeof power.doesKillingDamage !== "function",
    );
    if (damageEffectPowersWithoutDoesKillingDamageFunction.length > 0) {
        console.log(
            `Damage/Effect powers missing doesKillingDamage field: ${damageEffectPowersWithoutDoesKillingDamageFunction}`,
        );
    }
    numViolations += damageEffectPowersWithoutDoesKillingDamageFunction.length;

    if (numViolations === 0) {
        console.log(`Powers look valid`);
    }

    return numViolations;
}

HERO.powers6e = [];
HERO.powers6e.validate = validatePowers;
HERO.powers5e = [];
HERO.powers5e.validate = validatePowers;

function fixedValueFunction(value) {
    return function () {
        return value;
    };
}

function defaultPowerDicePartsBundle(item, diceParts) {
    const formula = dicePartsToFullyQualifiedEffectFormula(item, diceParts);

    return {
        diceParts: diceParts,
        tags: [
            {
                value: `${formula}`,
                name: `${item.name} (${item.system.ALIAS})`,
                title: `${formula}`,
            },
        ],
        baseAttackItem: item,
    };
}

function standardBaseEffectDiceParts(item /* , options */) {
    const diceParts = {
        dc: item.dcRaw,
        d6Count: parseInt(item.system?.LEVELS || 0),
        d6Less1DieCount: item.findModsByXmlid("MINUSONEPIP") ? 1 : 0,
        halfDieCount: item.findModsByXmlid("PLUSONEHALFDIE") ? 1 : 0,
        constant: item.findModsByXmlid("PLUSONEPIP") ? 1 : 0,
    };

    return defaultPowerDicePartsBundle(item, diceParts);
}

function characteristicBaseEffectDiceParts(item /* , options */) {
    const d6Count = parseInt(item.system?.LEVELS || 0);
    const halfDieCount = item.findModsByXmlid("PLUSONEHALFDIE") ? 1 : 0;
    const value = d6Count * 5 + (halfDieCount ? 3 : 0);

    const diceParts = characteristicValueToDiceParts(value);

    return defaultPowerDicePartsBundle(item, diceParts);
}

/**
 * Shouldn't ever be called. Only here to make sure we don't have to check if baseEffectDicePartsBundle exists
 */
function noDamageBaseEffectDicePartsBundle(item /* , _options */) {
    console.error(`${item.detailedName()} is defined as having no effect but effect is called`);

    return {
        diceParts: {
            dc: 0,
            d6Count: 0,
            d6Less1DieCount: 0,
            halfDieCount: 0,
            constant: 0,
        },
        tags: [{ value: "0", name: `BAD TAG`, title: "Should not have been called. Please report." }],
        baseAttackItem: item,
    };
}

function pdEdCostPerLevel(itemOrActor) {
    const actor = itemOrActor instanceof HeroSystem6eActor ? itemOrActor : itemOrActor.actor;
    const isAutomatonWithNoStun = !!actor?.items.find(
        (power) =>
            power.system.XMLID === "AUTOMATON" &&
            (power.system.OPTION === "NOSTUN1" || power.system.OPTION === "NOSTUN2"),
    );

    return isAutomatonWithNoStun ? 3 : 1;
}

/**
 * @typedef {Object} PowerDescription
 * @param {string} key - Hero Designer XMLID of the power
 * @param {string} name - Human readable name of the power
 * @param {string} base - Base number of levels that are given automatically
 * @param {string} cost - Cost in character points per additional level
 * @param {Array<string>} type - A list of types associated with this power
 * @param {Array<"non-hd" | "optional-maneuver" | "success"| "dice" | "to-hit" | "activatable" | "adder" | "modifier">} behaviors - A list of the behavior types this power exhibits in the code
 *                                       "non-hd" - this is not an XMLID that comes from Hero Designer
 *                                       "optional-maneuver" - this is an optional combat maneuver
 *                                       "success" - can roll some kind of success roll for this power
 *                                       "dice" - a damage/effect dice roll is associated with this power
 *                                       "to-hit" - a to-hit dice roll is associated with this power
 *                                       "activatable" - this power can be turned on/off/activated/deactivated
 *                                       "adder" - this power is actually a power adder
 *                                       "modifier" - this power is actually a power modifier (aka advantage)
 *
 * @param {"constant"|"instant"|"persistent"} duration - The lower case duration of the power
 * @param {HERO.RANGE_TYPES} range - The range of the power
 * @param {boolean} [costEnd] - If the power costs endurance to use. true if it does, false or undefined if it doesn't
 */

/**
 *
 * @param {PowerDescription} powerDescription6e
 * @param {PowerDescription} [powerOverrideFor5e]
 */
function addPower(powerDescription6e, powerOverrideFor5e) {
    if (powerDescription6e) {
        if (powerDescription6e.xml) {
            powerDescription6e.xml = powerDescription6e.xml.replace(/\n/g, "").trim();
            const parser = new DOMParser();
            let xml = parser.parseFromString(powerDescription6e.xml.trim(), "text/xml");

            // Add power properties based on valid XML.
            // NOTE: Chrome will parse partially valid XML, Firefox will not
            // which is why we are checking for parsererror.
            if (xml.getElementsByTagName("parsererror").length === 0) {
                powerDescription6e.key ??= xml.children[0].getAttribute("XMLID");
                powerDescription6e.name ??= xml.children[0].getAttribute("ALIAS");
                powerDescription6e.type ??= [];
                powerDescription6e.xmlTag ??= xml.children[0].tagName.toUpperCase();
            }
        }
        if (!powerDescription6e.key) {
            return;
        }
        HERO.powers6e.push(foundry.utils.deepClone(powerDescription6e));

        // Talents can be purchased as powers (duplicate them)
        if (powerDescription6e.xmlTag === "TALENT") {
            const talentPower = foundry.utils.deepClone(powerDescription6e);
            talentPower.xmlTag = "POWER";
            talentPower.xml.replace("<TALENT", "<POWER");
            HERO.powers6e.push(talentPower);
        }
    }

    if (powerOverrideFor5e) {
        const powerDescription5e = Object.assign(powerDescription6e ? powerDescription6e : {}, powerOverrideFor5e);

        if (powerDescription5e.xml) {
            powerDescription5e.xml = powerDescription5e.xml.replace(/\n/g, "").trim();
            const parser = new DOMParser();
            let xml = parser.parseFromString(powerDescription5e.xml.trim(), "text/xml");

            if (xml.getElementsByTagName("parsererror").length === 0) {
                powerDescription5e.key ??= xml.children[0].getAttribute("XMLID");
                powerDescription5e.name ??= xml.children[0].getAttribute("ALIAS");
                powerDescription5e.type ??= [];
                powerDescription5e.xmlTag ??= xml.children[0].tagName.toUpperCase();
            }
        }
        if (!powerDescription5e.key) {
            return;
        }

        HERO.powers5e.push(powerDescription5e);
    }
}

(function addCharacteristicsToPowerList() {
    addPower(
        {
            key: "STR",
            name: "Strength",
            base: 10,
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            ignoreFor: ["base2", "computer", "ai"],
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<STR XMLID="STR" ID="1712377060992" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "DEX",
            name: "Dexterity",
            base: 10,
            costPerLevel: fixedValueFunction(2),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["base2"],
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<DEX XMLID="DEX" ID="1712447975671" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            costPerLevel: fixedValueFunction(3),
        },
    );
    addPower(
        {
            key: "CON",
            name: "Constitution",
            base: 10,
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success", "defense"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<CON XMLID="CON" ID="1712377266422" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "INT",
            name: "Intelligence",
            base: 10,
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["vehicle", "base2"],
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<INT XMLID="INT" ID="1712377270415" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "EGO",
            name: "Ego",
            base: 10,
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["automaton", "vehicle", "base2", "computer"],
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<EGO XMLID="EGO" ID="1712377272129" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "PRE",
            name: "Presence",
            base: 10,
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<PRE XMLID="PRE" ID="1712377273912" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "COM",
        name: "Comeliness",
        type: ["characteristic"],
        behaviors: ["success"],
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        ignoreFor: ["vehicle", "base2", "computer", "ai", "6e"], // TODO: Remove the 6e here.
        base: 10,
        costPerLevel: fixedValueFunction(1 / 2),
        baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        xml: `<COM XMLID="COM" ID="1712377275507" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
    });
    addPower(
        {
            key: "OCV",
            name: "Offensive Combat Value",
            base: 3,
            costPerLevel: fixedValueFunction(5),
            type: ["characteristic"],
            behaviors: ["calculated"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["base2"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<OCV XMLID="OCV" ID="1712377400048" BASECOST="0.0" LEVELS="0" ALIAS="OCV" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            costPerLevel: fixedValueFunction(0),
            xml: undefined,
        },
    );
    addPower(
        {
            key: "DCV",
            name: "Defensive Combat Value",
            base: 3,
            costPerLevel: fixedValueFunction(5),
            type: ["characteristic"],
            behaviors: ["defense", "calculated"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["base2"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<DCV XMLID="DCV" ID="1712377402602" BASECOST="0.0" LEVELS="0" ALIAS="DCV" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            costPerLevel: fixedValueFunction(0),
            xml: undefined,
        },
    );
    addPower(
        {
            key: "OMCV",
            name: "Offensive Mental Combat Value",
            base: 3,
            costPerLevel: fixedValueFunction(3),
            type: ["characteristic"],
            behaviors: ["calculated"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["automaton", "vehicle", "base2"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<OMCV XMLID="OMCV" ID="1712377404591" BASECOST="0.0" LEVELS="0" ALIAS="OMCV" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            costPerLevel: fixedValueFunction(0),
            xml: undefined,
        },
    );
    addPower(
        {
            key: "DMCV",
            name: "Defensive Mental Combat Value",
            base: 3,
            costPerLevel: fixedValueFunction(3),
            type: ["characteristic"],
            behaviors: ["defense", "calculated"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["automaton", "vehicle", "base2"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<DMCV XMLID="DMCV" ID="1712377406823" BASECOST="0.0" LEVELS="0" ALIAS="DMCV" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            costPerLevel: fixedValueFunction(0),
            xml: undefined,
        },
    );
    addPower(
        {
            key: "SPD",
            name: "Speed",
            base: 2,
            costPerLevel: fixedValueFunction(10),
            type: ["characteristic"],
            behaviors: ["figured"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["base2"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<SPD XMLID="SPD" ID="1712377280539" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 0,
        },
    );
    addPower(
        {
            key: "PD",
            name: "Physical Defense",
            base: 2,
            costPerLevel: pdEdCostPerLevel,
            type: ["characteristic"],
            behaviors: ["defense", "figured"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["computer", "ai"],
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        value = parseInt(actorItemDefense.system?.LEVELS || 0);
                        break;
                }
                if (value > 0) {
                    return createDefenseProfile(actorItemDefense, attackItem, value, options);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<PD XMLID="PD" ID="1712377277205" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 0,
        },
    );
    addPower(
        {
            key: "ED",
            name: "Energy Defense",
            base: 2,
            costPerLevel: pdEdCostPerLevel,
            type: ["characteristic"],
            behaviors: ["defense", "figured"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["computer", "ai"],
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "ED":
                        value = parseInt(actorItemDefense.system?.LEVELS || 0);
                        break;
                }
                if (value > 0) {
                    return createDefenseProfile(actorItemDefense, attackItem, value, options);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<ED XMLID="ED" ID="1712377278856" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 0,
        },
    );
    addPower(
        {
            key: "REC",
            name: "Recovery",
            base: 4,
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["figured"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<REC XMLID="REC" ID="1712377282168" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 0,
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "END",
            name: "Endurance",
            base: 20,
            costPerLevel: fixedValueFunction(1 / 5),
            type: ["characteristic"],
            behaviors: ["figured"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<END XMLID="END" ID="1712377283848" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 0,
            costPerLevel: fixedValueFunction(1 / 2),
        },
    );
    addPower(
        {
            key: "BODY",
            name: "Body",
            base: 10,
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["computer", "ai"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<BODY XMLID="BODY" ID="1712377268646" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </BODY>`,
        },
        {
            costPerLevel: fixedValueFunction(2), // TODO: Bases only have to pay 1 for each +1
        },
    );
    addPower(
        {
            key: "STUN",
            name: "Stun",
            base: 20,
            costPerLevel: fixedValueFunction(1 / 2),
            type: ["characteristic"],
            behaviors: ["figured"],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<STUN XMLID="STUN" ID="1712377285547" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 0,
            costPerLevel: fixedValueFunction(1),
        },
    );

    addPower(
        {
            key: "BASESIZE",
            name: "Base Size",
            type: ["characteristic"],
            base: 0,
            costPerLevel: fixedValueFunction(2),
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            onlyFor: ["base2"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );

    addPower(undefined, {
        key: "DEF",
        name: "Defense",
        type: ["characteristic"],
        base: 2,
        costPerLevel: fixedValueFunction(3),
        behaviors: [],
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        onlyFor: ["base2", "vehicle"],
        baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
    });

    addPower(
        {
            key: "SIZE",
            name: "Vehicle Size",
            type: ["characteristic"],
            base: 0,
            costPerLevel: fixedValueFunction(5),
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            onlyFor: ["vehicle"],
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );

    // HD extendable characteristics
    addPower(
        {
            key: "CUSTOM1",
            name: "Custom Characteristic 1",
            type: ["characteristic"],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM2",
            name: "Custom Characteristic 2",
            type: ["characteristic"],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM3",
            name: "Custom Characteristic 3",
            type: ["characteristic"],
            behaviors: [],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM4",
            name: "Custom Characteristic 4",
            type: ["characteristic"],
            behaviors: [],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM5",
            name: "Custom Characteristic 5",
            type: ["characteristic"],
            behaviors: [],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM6",
            name: "Custom Characteristic 6",
            type: ["characteristic"],
            behaviors: [],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM7",
            name: "Custom Characteristic 7",
            type: ["characteristic"],
            behaviors: [],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM8",
            name: "Custom Characteristic 8",
            type: ["characteristic"],
            behaviors: [],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM9",
            name: "Custom Characteristic 9",
            type: ["characteristic"],
            behaviors: [],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM10",
            name: "Custom Characteristic 10",
            type: ["characteristic"],
            behaviors: [],
            base: 0,
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
})();

(function addManeuversToPowerList() {
    addPower(undefined, {
        key: "BLAZINGAWAY",
        type: ["maneuver"],
        behaviors: ["non-hd", "optional-maneuver", "to-hit", "dice"],
        name: "Blazing Away",
        costPerLevel: fixedValueFunction(0),
        perceivability: "obvious",
        duration: "instant",
        range: HERO.RANGE_TYPES.STANDARD,
        costEnd: true, // Maneuvers that don't use strength cost 1 END
        target: "target's dcv",
        ignoreFor: ["base2", "computer", "ai"],
        maneuverDesc: {
            phase: "1/2",
            ocv: "+0",
            dcv: "+0",
            effects: "Make as many attacks as desired, only hit on a 3",
            dc: "0",
            attack: true, // TODO: Do we want this property? Should likely be part of the behaviors. Same comment for all maneuvers.
            addStr: false,
            useWeapon: false,
        },
        baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        doesKillingDamage: maneuverDoesKillingDamage,
    });
    addPower(
        {
            key: "BLOCK",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit"],
            name: "Block",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "Blocks HTH attacks, Abort",
                dc: "0",
                attack: true, // TODO: Should be false as it's not an attack. It does, however, require dice.
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "BRACE",
            type: ["maneuver"],
            behaviors: ["non-hd", "activatable"],
            name: "Brace",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "0",
                ocv: "+2",
                dcv: "1/2",
                effects: "+2 OCV only to offset the Range Modifier",
                dc: "0",
                attack: false,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );

    addPower(
        {
            key: "CHOKE",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "to-hit", "dice"],
            name: "Choke",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "-2",
                effects: "[NNDDC], Grab One Limb",
                dc: "2",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        undefined,
    );
    addPower(
        {
            key: "CLUBWEAPON",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "activate"],
            name: "Club Weapon",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "Killing weapon does equivalent Normal Damage",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: true,
                weaponEffect: "[NORMALDC]",
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "COVER",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "activatable"],
            name: "Cover",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "+0",
                effects: "Target held at gunpoint",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );

    addPower(
        {
            key: "DISARM",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Disarm",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "+0",
                effects: "Disarm target, requires STR vs. STR Roll",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {},
    );
    addPower(
        {
            key: "DIVEFORCOVER",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "to-hit"],
            name: "Dive For Cover",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "Character avoids attack; Abort",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "DODGE",
            type: ["maneuver"],
            behaviors: ["non-hd", "activatable"],
            name: "Dodge",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "--",
                dcv: "+3",
                effects: "Dodge all attacks, Abort",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );

    addPower(
        {
            key: "GRAB",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Grab",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "-2",
                effects: "Grab Two Limbs; can Squeeze, Slam, or Throw",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "-2",
                effects: "Grab Two Limbs; can Squeeze or Throw",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
        },
    );
    addPower(
        {
            key: "GRABBY",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Grab By",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-3",
                dcv: "-4",
                effects: "Move and Grab object, +(v/10) to STR",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-3",
                dcv: "-4",
                effects: "Move and Grab object, +(v/5) to STR",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
        },
    );

    addPower(
        {
            key: "HAYMAKER",
            type: ["maneuver"],
            behaviors: ["non-hd", "activatable"],
            name: "Haymaker",
            costPerLevel: fixedValueFunction(0),
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 *",
                ocv: "+0",
                dcv: "-5",
                effects: "+4 Damage Classes to any attack",
                dc: "4",
                attack: false,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "HIPSHOT",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "activatable"],
            name: "Hipshot",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "+0",
                effects: "+1 DEX only for purposes of initiative",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(undefined, {
        key: "HURRY",
        type: ["maneuver"],
        behaviors: ["non-hd", "optional-maneuver", "activatable"],
        name: "Hurry",
        costPerLevel: fixedValueFunction(0),
        perceivability: "obvious",
        duration: "instant",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: true, // Maneuvers that don't use strength cost 1 END
        target: "target's dcv",
        ignoreFor: ["base2", "computer", "ai"],
        maneuverDesc: {
            phase: "1/2",
            ocv: "-2",
            dcv: "-2",
            effects: "+1d6 DEX only for purposes of initiative",
            dc: "0",
            attack: false,
            addStr: false,
            useWeapon: false,
        },
        baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
    });

    addPower(
        {
            key: "MOVEBY",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Move By",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-2",
                dcv: "-2",
                effects: "(([STRDC]/2) + (v/10))d6; attacker takes ⅓ damage",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-2",
                dcv: "-2",
                effects: "(([STRDC]/2) + (v/5))d6; attacker takes ⅓ damage",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
        },
    );
    addPower(
        {
            key: "MOVETHROUGH",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Move Through",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-v/10",
                dcv: "-3",
                effects: "([STRDC] + (v/6))d6; attacker takes ½ or full damage",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-v/5",
                dcv: "-3",
                effects: "([STRDC] + (v/3))d6; attacker takes ½ or full damage",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
        },
    );
    addPower(
        {
            key: "MULTIPLEATTACK",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Multiple Attack",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE, // TODO: Not correct for all possible
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1",
                ocv: "var",
                dcv: "1/2",
                effects: "Attack one or more targets multiple times",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        undefined,
    );

    addPower(
        {
            key: "OTHERATTACKS",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Other Attacks",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE, // TODO: Not correct for all possible.
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "For unlisted attacks",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {},
    );

    addPower(
        {
            key: "PULLINGAPUNCH",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "activatable"],
            name: "Pulling A Punch",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1/5d6",
                dcv: "+0",
                effects: "Strike, normal STUN damage, ½ BODY damage",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        },
        {},
    );

    addPower(undefined, {
        key: "RAPIDFIRE",
        type: ["maneuver"],
        behaviors: ["non-hd", "optional-maneuver", "to-hit", "dice"],
        name: "Rapid Fire",
        costPerLevel: fixedValueFunction(0),
        perceivability: "obvious",
        duration: "instant",
        range: HERO.RANGE_TYPES.NO_RANGE, // TODO: Not correct for all
        costEnd: true, // Maneuvers that don't use strength cost 1 END
        target: "target's dcv",
        ignoreFor: ["base2", "computer", "ai"],
        maneuverDesc: {
            phase: "1",
            ocv: "-1/x",
            dcv: "+x1/2",
            effects: "Strike, normal STUN damage, ½ BODY damage",
            dc: "0",
            attack: true,
            addStr: false,
            useWeapon: false,
        },
        baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
        doesKillingDamage: maneuverDoesKillingDamage,
    });
    addPower(
        {
            key: "ROLLWITHAPUNCH",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "activatable"],
            name: "Roll With A Punch",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "-2",
                effects: "Block after being hit, take ½ damage; Abort",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );

    addPower(
        {
            key: "SET",
            type: ["maneuver"],
            behaviors: ["non-hd", "activatable"],
            name: "Set",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1",
                ocv: "+1",
                dcv: "+0",
                effects: "Take extra time to aim a Ranged attack at a target",
                dc: "0",
                attack: false,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    // Do we really need this? Why not just check SET and BRACE?
    // If removed the migrations will generate a warning because SETANDBRACE is no longer defined.
    addPower(
        {
            key: "SETANDBRACE",
            type: ["maneuver"],
            behaviors: ["non-hd", "activatable"],
            name: "Set And Brace",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1",
                ocv: "+3",
                dcv: "1/2",
                effects: "Take extra time to aim a Ranged attack at a target, +2 OCV only to offset the Range Modifier",
                dc: "0",
                attack: false,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "SHOVE",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Shove",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "-1",
                effects: "Push target back 1m per 5 STR used",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        undefined,
    );
    addPower(
        {
            key: "SNAPSHOT",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "to-hit", "dice"],
            name: "Snap Shot",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1",
                ocv: "-1",
                dcv: "+0",
                effects: "Lets character duck back behind cover",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {},
    );
    addPower(
        {
            key: "STRAFE",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "to-hit", "dice"],
            name: "Strafe",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-v/6",
                dcv: "-2",
                effects: "Make Ranged attack while moving",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        undefined,
    );
    addPower(
        {
            key: "STRIKE",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Strike",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "[STRDC] damage or by weapon type",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {},
    );
    addPower(
        {
            key: "SUPPRESSIONFIRE",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver", "to-hit", "dice"],
            name: "Suppression Fire",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "+0",
                effects: "Continuous fire through an area, must be Autofire",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "+0",
                effects: "Continuous fire on hex(es), must be Autofire",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
        },
    );
    addPower(undefined, {
        key: "SWEEP",
        type: ["maneuver"],
        behaviors: ["non-hd", "optional-maneuver", "to-hit"],
        name: "Sweep",
        costPerLevel: fixedValueFunction(0),
        perceivability: "obvious",
        duration: "instant",
        range: HERO.RANGE_TYPES.NO_RANGE,
        costEnd: false,
        target: "target's dcv",
        ignoreFor: ["base2", "computer", "ai"],
        maneuverDesc: {
            phase: "1",
            ocv: "-2/x",
            dcv: "x1/2",
            effects: "Make multiple HTH attacks",
            dc: "0",
            attack: true,
            addStr: false,
            useWeapon: false,
        },
        baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
    });

    addPower(
        {
            key: "THROW",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Throw",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "Throw object or character, does STR damage",
                dc: "0",
                attack: true,
                addStr: true,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        undefined,
    );
    addPower(
        {
            key: "TRIP",
            type: ["maneuver"],
            behaviors: ["non-hd", "to-hit", "dice"],
            name: "Trip",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "-2",
                effects: "Knock a target to the ground, making him Prone",
                dc: "0",
                attack: true,
                addStr: false,
                useWeapon: false,
            },
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        undefined,
    );
})();

(function addMovementToPowerList() {
    addPower(
        {
            key: "EXTRADIMENSIONALMOVEMENT",
            type: ["movement"],
            behaviors: ["activatable"],
            perceivability: "inobvious",
            duration: "instant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(20),
            ignoreFor: ["pc", "npc", "automaton", "vehicle", "base2", "computer", "ai"], // There aren't really any LEVELS or a .value for this power, no need to show on CHARACTERISTICS tab //
            xml: `<POWER XMLID="EXTRADIMENSIONALMOVEMENT" ID="1709333909749" BASECOST="20.0" LEVELS="0" ALIAS="Extra-Dimensional Movement" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Dimension" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" />`,
        },
        {},
    );

    addPower(
        {
            key: "FLIGHT",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="FLIGHT" ID="1709333921734" BASECOST="0.0" LEVELS="1" ALIAS="Flight" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" />`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "FTL",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(2),
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="FTL" ID="1712026014674" BASECOST="10.0" LEVELS="0" ALIAS="Faster-Than-Light Travel" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" />`,
        },
        {},
    );

    addPower(undefined, {
        key: "GLIDING",
        type: ["movement"],
        behaviors: ["activatable"],
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        costPerLevel: fixedValueFunction(1),
        ignoreFor: ["base2", "computer", "ai"],
        xml: `<POWER XMLID="GLIDING" ID="1709342639684" BASECOST="0.0" LEVELS="1" ALIAS="Gliding" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" />`,
    });

    addPower(
        {
            key: "LEAPING",
            name: "Leaping",
            base: 4,
            costPerLevel: fixedValueFunction(1 / 2),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<LEAPING XMLID="LEAPING" ID="1709333946167" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="55" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 2,
            costPerLevel: fixedValueFunction(1),
        },
    );

    addPower(
        {
            key: "RUNNING",
            base: 12,
            costPerLevel: fixedValueFunction(1),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<RUNNING XMLID="RUNNING" ID="1709334005554" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="72" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 6,
            costPerLevel: fixedValueFunction(2),
        },
    );

    addPower(
        {
            key: "SWIMMING",
            base: 4,
            costPerLevel: fixedValueFunction(1 / 2),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<SWIMMING XMLID="SWIMMING" ID="1709334019357" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="77" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No" />`,
        },
        {
            base: 2,
            costPerLevel: fixedValueFunction(1),
        },
    );
    addPower(
        {
            key: "SWINGING",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            rangeText: function (item) {
                // The maximum length of the swingline
                let distanceInMetres = item.system.basePointsPlusAdders * 10;
                return `Max swingline length ${getRoundedUpDistanceInSystemUnits(distanceInMetres, item.actor)}`;
            },
            costEnd: true,
            costPerLevel: fixedValueFunction(1 / 2),
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="SWINGING" ID="1709334021575" BASECOST="0.0" LEVELS="1" ALIAS="Swinging" POSITION="78" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" />`,
        },
        {
            costPerLevel: fixedValueFunction(1),
        },
    );

    addPower(
        {
            key: "TELEPORTATION",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "instant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="TELEPORTATION" ID="1709334031905" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation" POSITION="81" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" />`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "TUNNELING",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="TUNNELING" ID="1709334041436" BASECOST="2.0" LEVELS="1" ALIAS="Tunneling" POSITION="85" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" />`,
        },
        {
            costPerLevel: fixedValueFunction(5),
        },
    );
})();

(function addSkillsToPowerList() {
    addPower(
        {
            key: "ACROBATICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="ACROBATICS" BASECOST="3.0" LEVELS="0" ALIAS="Acrobatics" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "ACTING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="ACTING" ID="1709161468976" BASECOST="3.0" LEVELS="0" ALIAS="Acting" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "ANALYZE",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="ANALYZE" ID="1709161469684" BASECOST="3.0" LEVELS="0" ALIAS="Analyze" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Agility Skills" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "ANIMAL_HANDLER",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            categorized: true,
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            cost: function (skill) {
                if (!skill?.system?.ADDER || skill.system.ADDER.length === 0) {
                    return 3;
                }
                return 2 + skill.system.ADDER.length - 1;
            },
            xml: `<SKILL XMLID="ANIMAL_HANDLER" ID="1709161473096" BASECOST="0.0" LEVELS="0" ALIAS="Animal Handler" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "ARMORSMITH",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        categorized: true,
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(
        {
            key: "AUTOFIRE_SKILLS",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="AUTOFIRE_SKILLS" ID="1709161475889" BASECOST="5.0" LEVELS="0" ALIAS="Autofire Skills" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ACCURATE" OPTIONID="ACCURATE" OPTION_ALIAS="Accurate Sprayfire" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "BREAKFALL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="BREAKFALL" ID="1709161478362" BASECOST="3.0" LEVELS="0" ALIAS="Breakfall" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "BRIBERY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="BRIBERY" ID="1709161479206" BASECOST="3.0" LEVELS="0" ALIAS="Bribery" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "BUGGING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="BUGGING" ID="1709161479965" BASECOST="3.0" LEVELS="0" ALIAS="Bugging" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "BUREAUCRATICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="BUREAUCRATICS" ID="1709161480723" BASECOST="3.0" LEVELS="0" ALIAS="Bureaucratics" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "CHARM",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CHARM" ID="1709161481624" BASECOST="3.0" LEVELS="0" ALIAS="Charm" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        undefined,
    );
    addPower(
        {
            key: "CLIMBING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CLIMBING" ID="1709161482605" BASECOST="3.0" LEVELS="0" ALIAS="Climbing" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "COMBAT_DRIVING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="COMBAT_DRIVING" ID="1709161483399" BASECOST="3.0" LEVELS="0" ALIAS="Combat Driving" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "COMBAT_LEVELS",
            type: ["skill"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            costEnd: false,
            refreshAttackDialogWhenChanged: true,
            range: HERO.RANGE_TYPES.SELF,
            editOptions: {
                showAttacks: true,
                editableOption_ALIAS: true,
                choices: [
                    {
                        OPTIONID: "SINGLE",
                        OPTION: "SINGLE",
                        OPTION_ALIAS: "with any single attack",
                    },
                    {
                        OPTIONID: "TIGHT",
                        OPTION: "TIGHT",
                        OPTION_ALIAS: "with a small group of attacks",
                    },
                    {
                        OPTIONID: "BROAD",
                        OPTION: "BROAD",
                        OPTION_ALIAS: "with a large group of attacks",
                    },
                    {
                        OPTIONID: "HTH",
                        OPTION: "HTH",
                        OPTION_ALIAS: "with HTH Combat",
                    },
                    {
                        OPTIONID: "RANGED",
                        OPTION: "RANGED",
                        OPTION_ALIAS: "with Ranged Combat",
                    },
                    {
                        OPTIONID: "ALL",
                        OPTION: "ALL",
                        OPTION_ALIAS: "with All Attacks",
                    },
                ],
            },
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "SINGLESINGLE":
                        console.debug(
                            `${item.actor?.name}/${item.detailedName()}: SINGLESINGLE doesn't appear to be a currently supported OPTIONID`,
                        );
                        return 1;
                    case "SINGLE":
                        return 2;
                    case "TIGHT":
                        return 3;
                    case "BROAD":
                        return 5;
                    case "HTH":
                        return 8;
                    case "RANGED":
                        return 8;
                    case "ALL":
                        return 10;
                    default:
                        console.error(
                            `Unknown 6e combat levels ${item.system.OPTIONID} for ${item.actor?.name}/${item.name}`,
                        );
                        return 0;
                }
            },
            xml: `<SKILL XMLID="COMBAT_LEVELS" ID="1709161485197" BASECOST="0.0" LEVELS="1" ALIAS="Combat Skill Levels" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="with any single attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        {
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "SINGLESINGLE":
                        return 1;
                    case "SINGLESTRIKE":
                    case "SINGLE":
                        return 2;
                    case "MAGIC":
                    case "MARTIAL":
                    case "STRIKE":
                    case "TIGHT":
                        return 3;
                    case "BROAD":
                    case "DECV":
                    case "HTHDCV":
                    case "TWODCV":
                    case "TWOOCV":
                        return 4;
                    case "DCV":
                    case "HTH":
                    case "MENTAL":
                    case "RANGED":
                        return 5;
                    case "HTHMENTAL":
                    case "HTHRANGED":
                    case "MENTALRANGED":
                        return 6;
                    case "ALL":
                        return 8;
                    default:
                        console.error(
                            `Unknown 5e combat level type ${item.system.OPTIONID} for ${item.actor?.name}/${item.name}`,
                        );
                        return 0;
                }
            },
        },
    );
    addPower(
        {
            key: "COMBAT_PILOTING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="COMBAT_PILOTING" ID="1709161484209" BASECOST="3.0" LEVELS="0" ALIAS="Combat Piloting" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "COMPUTER_PROGRAMMING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="COMPUTER_PROGRAMMING" ID="1709161488163" BASECOST="3.0" LEVELS="0" ALIAS="Computer Programming" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "CONCEALMENT",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CONCEALMENT" ID="1709161490757" BASECOST="3.0" LEVELS="0" ALIAS="Concealment" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "CONTORTIONIST",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CONTORTIONIST" ID="1709161491534" BASECOST="3.0" LEVELS="0" ALIAS="Contortionist" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "CONVERSATION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CONVERSATION" ID="1709161492343" BASECOST="3.0" LEVELS="0" ALIAS="Conversation" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "CRAMMING",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CRAMMING" ID="1709161493162" BASECOST="5.0" LEVELS="0" ALIAS="Cramming" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "CRIMINOLOGY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CRIMINOLOGY" ID="1709161494054" BASECOST="3.0" LEVELS="0" ALIAS="Criminology" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "CRYPTOGRAPHY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CRYPTOGRAPHY" ID="1709161496416" BASECOST="3.0" LEVELS="0" ALIAS="Cryptography" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOMSKILL",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="CUSTOMSKILL" ID="1709161497972" BASECOST="0.0" LEVELS="1" ALIAS="Custom Skill" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" ROLL="0" />`,
        },
        {},
    );

    addPower(
        {
            key: "DEDUCTION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="DEDUCTION" ID="1709161500786" BASECOST="3.0" LEVELS="0" ALIAS="Deduction" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "DEFENSE_MANEUVER",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="DEFENSE_MANEUVER" ID="1709161501659" BASECOST="3.0" LEVELS="0" ALIAS="Defense Maneuver" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="I" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "DEMOLITIONS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="DEMOLITIONS" ID="1709161503996" BASECOST="3.0" LEVELS="0" ALIAS="Demolitions" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "DISGUISE",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="DISGUISE" ID="1709161504988" BASECOST="3.0" LEVELS="0" ALIAS="Disguise" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "ELECTRONICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="ELECTRONICS" ID="1709161505775" BASECOST="3.0" LEVELS="0" ALIAS="Electronics" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "FAST_DRAW",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="FAST_DRAW" ID="1709161506592" BASECOST="3.0" LEVELS="0" ALIAS="Fast Draw" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "FEINT",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(
        {
            key: "FORENSIC_MEDICINE",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="FORENSIC_MEDICINE" ID="1709161509009" BASECOST="3.0" LEVELS="0" ALIAS="Forensic Medicine" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "FORGERY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            cost: function (skill) {
                // BASECOST is 3 but for some reason HDC shows 0
                const baseCost = parseFloat(skill.system.BASECOST) || (skill.adders.length === 0 ? 3 : 0);
                const levels = parseInt(skill.system?.LEVELS || 0);
                return baseCost + levels * this.costPerLevel();
            },
            categorized: true,
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="FORGERY" ID="1709161509923" BASECOST="0.0" LEVELS="0" ALIAS="Forgery" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "GAMBLING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            categorized: true,
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="GAMBLING" ID="1709161511974" BASECOST="0.0" LEVELS="0" ALIAS="Gambling" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "HIGH_SOCIETY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="HIGH_SOCIETY" ID="1709161513798" BASECOST="3.0" LEVELS="0" ALIAS="High Society" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "HOIST",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });

    addPower(undefined, {
        key: "INSTRUCTOR",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(
        {
            key: "INTERROGATION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="INTERROGATION" ID="1709161516272" BASECOST="3.0" LEVELS="0" ALIAS="Interrogation" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "INVENTOR",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="INVENTOR" ID="1709161517097" BASECOST="3.0" LEVELS="0" ALIAS="Inventor" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "KNOWLEDGE_SKILL",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<SKILL XMLID="KNOWLEDGE_SKILL" ID="1709161518105" BASECOST="2.0" LEVELS="0" ALIAS="KS" POSITION="34" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General" />`,
        },
        {},
    );

    addPower(
        {
            key: "LANGUAGES",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="LANGUAGES" ID="1709161520791" BASECOST="1.0" LEVELS="0" ALIAS="Language" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASIC" OPTIONID="BASIC" OPTION_ALIAS="basic conversation" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FAMILIARITY="No" PROFICIENCY="No" NATIVE_TONGUE="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "LIPREADING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="LIPREADING" ID="1709161523279" BASECOST="3.0" LEVELS="0" ALIAS="Lipreading" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "LOCKPICKING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="LOCKPICKING" ID="1709161524481" BASECOST="3.0" LEVELS="0" ALIAS="Lockpicking" POSITION="37" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "MECHANICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="MECHANICS" ID="1709161525362" BASECOST="3.0" LEVELS="0" ALIAS="Mechanics" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "MENTAL_COMBAT_LEVELS",
            type: ["skill"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            refreshAttackDialogWhenChanged: true,
            editOptions: {
                showAttacks: true,
                editableOption_ALIAS: true,
                choices: [
                    {
                        OPTIONID: "SINGLE",
                        OPTION: "SINGLE",
                        OPTION_ALIAS: "with a single Mental Power",
                    },
                    {
                        OPTIONID: "TIGHT",
                        OPTION: "TIGHT",
                        OPTION_ALIAS: "with a group of Mental Powers",
                    },
                    {
                        OPTIONID: "BROAD",
                        OPTION: "BROAD",
                        OPTION_ALIAS: "with all Mental Powers",
                    },
                ],
            },
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "SINGLE":
                        return 1;
                    case "TIGHT":
                        return 3;
                    case "BROAD":
                    case "ALL":
                        return 6;
                    default:
                        console.error(
                            `Unknown costPerLevel ${item.system.XMLID} levels ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
            xml: `<SKILL XMLID="MENTAL_COMBAT_LEVELS" ID="1709161526214" BASECOST="0.0" LEVELS="1" ALIAS="Mental Combat Skill Levels" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="with a single Mental Power" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        undefined,
    );
    addPower(
        {
            key: "MIMICRY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="MIMICRY" ID="1709161528926" BASECOST="3.0" LEVELS="0" ALIAS="Mimicry" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "MIF",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            name: "Musical Instrument Familiarity",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
        },
        {},
    );

    addPower(
        {
            key: "NAVIGATION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            categorized: true,
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="NAVIGATION" ID="1709161529843" BASECOST="0.0" LEVELS="0" ALIAS="Navigation" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "NEGATIVECOMBATSKILLLEVELS",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(undefined, {
        key: "NEGATIVEPENALTYSKILLLEVELS",
        type: ["skill"],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        behaviors: [],
    });
    addPower(undefined, {
        key: "NEGATIVESKILLLEVELS",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });

    addPower(
        {
            key: "ORATORY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="ORATORY" ID="1709161532182" BASECOST="3.0" LEVELS="0" ALIAS="Oratory" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(undefined, {
        key: "PARACHUTING",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(
        {
            key: "PARAMEDICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="PARAMEDICS" ID="1709161533283" BASECOST="3.0" LEVELS="0" ALIAS="Paramedics" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "PENALTY_SKILL_LEVELS",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            editOptions: {
                showAttacks: true,
                editableOption_ALIAS: true,
                choices: [
                    {
                        OPTIONID: "SINGLE",
                        OPTION: "SINGLE",
                        OPTION_ALIAS: "to offset a specific negative OCV modifier with any single attack",
                    },
                    {
                        OPTIONID: "THREE",
                        OPTION: "THREE",
                        OPTION_ALIAS:
                            "to offset a specific negative OCV modifier with any three maneuvers or tight group",
                    },
                    {
                        OPTIONID: "ALL",
                        OPTION: "ALL",
                        OPTION_ALIAS: "to offset a specific negative OCV modifier with all attacks",
                    },
                    {
                        OPTIONID: "SINGLEDCV",
                        OPTION: "SINGLEDCV",
                        OPTION_ALIAS:
                            "to offset a specific negative DCV modifier imposed by any single specific condition",
                    },
                    {
                        OPTIONID: "GROUPDCV",
                        OPTION: "GROUPDCV",
                        OPTION_ALIAS: "to offset a specific negative DCV modifier imposed by a group of conditions",
                    },
                ],
                penaltyChoices: {
                    hitLocation: "Hit Location",
                    other: "Other",
                    range: "Range",
                    encumbrance: "Encumbrance",
                },
            },
            heroValidation: function (item) {
                const validations = [];

                // Penalty Type
                if (!item.pslPenaltyType) {
                    validations.push({
                        property: "OPTION_ALIAS",
                        message: `Expecting one of these values [${Object.keys(HERO.PENALTY_SKILL_LEVELS_TYPES).join(", ")}].`,
                        example: `to offset range penalty OCV modifier with any single attack`,
                    });
                }

                // Attack specified
                if (item.system.OPTIONID !== "ALL") {
                    item.system.ADDER ??= [];
                    const firstValidAttack = item.system.ADDER.find(
                        (adder) =>
                            adder.ALIAS &&
                            item.actor?.items.find(
                                (item) => adder.ALIAS.toLowerCase().trim() === item.name.toLowerCase().trim(),
                            ),
                    );
                    if (!firstValidAttack) {
                        validations.push({
                            message: `Expecting one or more custom adders with names matching specific attacks this PSL works with.`,
                        });
                    }
                }

                return validations;
            },
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "SINGLE":
                        return 1;
                    case "THREE":
                        return 2;
                    case "SINGLEDCV":
                        return 2;
                    case "GROUPDCV":
                        return 3;
                    case "ALL":
                        return 3;
                    default:
                        console.error(
                            `Unknown 6e ${item.system.XMLID} levels ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
            xml: `<SKILL XMLID="PENALTY_SKILL_LEVELS" ID="1709161534055" BASECOST="0.0" LEVELS="1" ALIAS="Penalty Skill Levels" POSITION="44" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="to offset a specific negative OCV modifier with any single attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        {
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "SINGLE":
                        return 2;
                    case "TIGHT":
                        return 2;
                    case "ALL":
                        return 3;
                    default:
                        console.error(
                            `Unknown 5e ${item.system.XMLID} levels ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
        },
    );
    addPower(
        {
            key: "PERCEPTION",
            type: ["skill"],
            behaviors: ["success", "non-hd"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "PERSUASION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "POISONING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "POWERSKILL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="POWERSKILL" ID="1709161537007" BASECOST="3.0" LEVELS="0" ALIAS="Power" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "PROFESSIONAL_SKILL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(1),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="PROFESSIONAL_SKILL" ID="1709161539381" BASECOST="2.0" LEVELS="0" ALIAS="PS" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "RAPID_ATTACK_HTH",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="RAPID_ATTACK_HTH" ID="1709161541446" BASECOST="10.0" LEVELS="0" ALIAS="Rapid Attack" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "RAPID_ATTACK_RANGED",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(undefined, {
        key: "RESEARCH",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(
        {
            key: "RIDING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="RIDING" ID="1709161542264" BASECOST="3.0" LEVELS="0" ALIAS="Riding" POSITION="48" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "SCIENCE_SKILL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(1),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="SCIENCE_SKILL" ID="1709161543124" BASECOST="2.0" LEVELS="0" ALIAS="Science Skill" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "SECURITY_SYSTEMS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="SECURITY_SYSTEMS" ID="1709161545330" BASECOST="3.0" LEVELS="0" ALIAS="Security Systems" POSITION="50" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "SEDUCTION",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(
        {
            key: "SHADOWING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="SHADOWING" ID="1709161547363" BASECOST="3.0" LEVELS="0" ALIAS="Shadowing" POSITION="51" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "SKILL_LEVELS",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "CHARACTERISTIC":
                        return 2;
                    case "RELATED":
                        return 3;
                    case "GROUP":
                        return 4;
                    case "AGILITY":
                        return 6;
                    case "NONCOMBAT":
                        return 10;
                    case "SINGLEMOVEMENT":
                        return 2;
                    case "ALLMOVEMENT":
                        return 3;
                    case "SIMILAR":
                        return 5;
                    case "OVERALL":
                        return 12;
                    default:
                        console.error(
                            `Unknown 6e SKILL_LEVELS ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
            xml: `<SKILL XMLID="SKILL_LEVELS" ID="1709161548219" BASECOST="0.0" LEVELS="1" ALIAS="Skill Levels" POSITION="52" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CHARACTERISTIC" OPTIONID="CHARACTERISTIC" OPTION_ALIAS="with single Skill or Characteristic Roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        {
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "CHARACTERISTIC":
                    case "SINGLEMOVEMENT":
                        return 2;
                    case "ALLMOVEMENT":
                    case "RELATED":
                        return 3;
                    case "SIMILAR":
                        return 5;
                    case "NONCOMBAT":
                        return 8;
                    case "OVERALL":
                        return 10;
                    default:
                        console.error(
                            `Unknown 5e SKILL_LEVELS ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
        },
    );
    addPower(
        {
            key: "SLEIGHT_OF_HAND",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="SLEIGHT_OF_HAND" ID="1709161550467" BASECOST="3.0" LEVELS="0" ALIAS="Sleight Of Hand" POSITION="53" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "SPELL",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });
    addPower(
        {
            key: "STEALTH",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="STEALTH" ID="1709161551292" BASECOST="3.0" LEVELS="0" ALIAS="Stealth" POSITION="54" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "STREETWISE",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="STREETWISE" ID="1709161552070" BASECOST="3.0" LEVELS="0" ALIAS="Streetwise" POSITION="55" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "SURVIVAL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            cost: function (item) {
                // BASECOST is 3 but for some reason HDC shows 0
                const baseCost = parseFloat(item.system.BASECOST) || (item.adders.length === 0 ? 3 : 0);
                const levels = parseInt(item.system?.LEVELS || 0);
                return baseCost + levels * this.costPerLevel();
            },
            categorized: true,
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="SURVIVAL" ID="1709161552845" BASECOST="0.0" LEVELS="0" ALIAS="Survival" POSITION="56" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "SYSTEMS_OPERATION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="SYSTEMS_OPERATION" ID="1709161555044" BASECOST="3.0" LEVELS="0" ALIAS="Systems Operation" POSITION="57" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "TACTICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="TACTICS" ID="1709161557125" BASECOST="3.0" LEVELS="0" ALIAS="Tactics" POSITION="58" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "TEAMWORK",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="TEAMWORK" ID="1709161558462" BASECOST="3.0" LEVELS="0" ALIAS="Teamwork" POSITION="59" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "TRACKING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="TRACKING" ID="1709161559355" BASECOST="3.0" LEVELS="0" ALIAS="Tracking" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "TRADING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="TRADING" ID="1709161560240" BASECOST="3.0" LEVELS="0" ALIAS="Trading" POSITION="61" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "TRANSPORT_FAMILIARITY",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            // adderCostAdjustment: function ({ adder, adderCost }) {
            //     if (adderCost !== 2) {
            //         console.error(`${adder.XMLID} cost was ${adderCost} but expected it to be 2`);
            //     }
            //     // First adder is full cost
            //     if (adder.parent.adders[0].ID === adder.ID) {
            //         return adderCost;
            //     }
            //     // Additional adders cost 1
            //     return 1;
            // },
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            editOptions: {
                hideLEVELS: true,
            },
            xml: `<SKILL XMLID="TRANSPORT_FAMILIARITY" ID="1738541497153" BASECOST="0.0" LEVELS="0" ALIAS="TF" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "TWO_WEAPON_FIGHTING_HTH",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="TWO_WEAPON_FIGHTING_HTH" ID="1709161562189" BASECOST="10.0" LEVELS="0" ALIAS="Two-Weapon Fighting" POSITION="62" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
            <NOTES /></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "TWO_WEAPON_FIGHTING_RANGED",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
    });

    addPower(
        {
            key: "VENTRILOQUISM",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="VENTRILOQUISM" ID="1709161563244" BASECOST="3.0" LEVELS="0" ALIAS="Ventriloquism" POSITION="63" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "WEAPON_FAMILIARITY",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SKILL XMLID="WEAPON_FAMILIARITY" ID="1709161564246" BASECOST="0.0" LEVELS="0" ALIAS="WF" POSITION="64" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" />`,
        },
        {},
    );
    addPower(
        {
            key: "WEAPONSMITH",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            cost: function (item) {
                // BASECOST is 3 when there are no adders or 0 when there are adders.
                // For some reason HDC doens't update BASECOST.
                // TODO: Check FAMALIERITY ONLY possibilities
                const baseCost = parseFloat(item.system.BASECOST) || (item.adders.length === 0 ? 3 : 0);
                const levels = parseInt(item.system?.LEVELS || 0);
                return baseCost + levels * this.costPerLevel();
            },
            adderCostAdjustment: function ({ adder, adderCost }) {
                if (adderCost !== 2) {
                    console.warn(`${adder.XMLID} cost was ${adderCost} but expected it to be 2`);
                }
                // First adder is full cost
                if (adder.item.adders[0].ID === adder.ID) {
                    return adderCost;
                }
                // Additional adders cost 1
                return 1;
            },
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            categorized: true,
            xml: `<SKILL XMLID="WEAPONSMITH" ID="1709161565889" BASECOST="0.0" LEVELS="0" ALIAS="Weaponsmith" POSITION="65" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" />`,
        },
        {},
    );

    addPower(
        {
            key: "JACK_OF_ALL_TRADES",
            type: ["skill", "enhancer"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<JACK_OF_ALL_TRADES XMLID="JACK_OF_ALL_TRADES" ID="1746307778979" BASECOST="3.0" LEVELS="0" ALIAS="Jack of All Trades" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO"></JACK_OF_ALL_TRADES>`,
        },
        {},
    );
    addPower(
        {
            key: "LINGUIST",
            type: ["skill", "enhancer"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<LINGUIST XMLID="LINGUIST" ID="1746307779950" BASECOST="3.0" LEVELS="0" ALIAS="Linguist" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO"></LINGUIST>`,
        },
        {},
    );
    addPower(
        {
            key: "SCHOLAR",
            type: ["skill", "enhancer"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SCHOLAR XMLID="SCHOLAR" ID="1746307781015" BASECOST="3.0" LEVELS="0" ALIAS="Scholar" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO"></SCHOLAR>`,
        },
        {},
    );
    addPower(
        {
            key: "SCIENTIST",
            type: ["skill", "enhancer"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<SCIENTIST XMLID="SCIENTIST" ID="1746305916782" BASECOST="3.0" LEVELS="0" ALIAS="Scientist" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO"></SCIENTIST>`,
        },
        {},
    );
    addPower(
        {
            key: "TRAVELER",
            type: ["skill", "enhancer"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TRAVELER XMLID="TRAVELER" ID="1746307782150" BASECOST="3.0" LEVELS="0" ALIAS="Traveler" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO"></TRAVELER>`,
        },
        {},
    );
})();

(function addFrameworksToPowerList() {
    addPower(
        {
            key: "COMPOUNDPOWER",
            type: ["compound"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            costEnd: false,
            isContainer: true,
        },
        {},
    );

    addPower(
        {
            key: "DIFFERINGMODIFIER",
            name: "Differing Modifier",
            type: ["framework"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            costEnd: false,
        },
        {},
    );

    addPower(undefined, {
        key: "ELEMENTAL_CONTROL",
        type: ["framework"],
        behaviors: [],
        costPerLevel: fixedValueFunction(1),
        costEnd: false,
        isContainer: true,
    });

    addPower(
        {
            key: "LIST",
            type: ["framework"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            costEnd: false,
            isContainer: true,
        },
        {},
    );

    addPower(
        {
            key: "MULTIPOWER",
            type: ["framework"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            costEnd: false,
            isContainer: true,
        },
        {},
    );

    addPower(
        {
            key: "VPP",
            type: ["framework"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            realCost: function (item) {
                // Power Modifiers apply only to the Control Cost.

                const poolCost = parseInt(item.system.LEVELS);
                let controlCost =
                    Math.ceil(parseInt(item.findModsByXmlid("CONTROLCOST")?.LEVELS || 0) / 2) ||
                    RoundFavorPlayerDown(poolCost / 2);
                const _limitationCost = item._limitationCost;

                if (_limitationCost !== 0) {
                    controlCost = RoundFavorPlayerDown(controlCost / (1 + _limitationCost));
                }

                return poolCost + controlCost;
            },
            costEnd: false,
            isContainer: true,
        },
        {},
    );
})();

(function addPerksToPowerList() {
    addPower(
        {
            key: "ACCESS",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<PERK XMLID="ACCESS" ID="1709161411911" BASECOST="0.0" LEVELS="3" ALIAS="Access" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "Advanced Tech",
        type: ["perk"],
        behaviors: [],
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        costPerLevel: function (item) {
            if (item.system.OPTIONID === "NORMAL") {
                return 15;
            } else {
                return 10;
            }
        },
        xml: `<PERK XMLID="Advanced Tech" ID="1709164896663" BASECOST="0.0" LEVELS="1" ALIAS="Advanced Tech" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NORMAL" OPTIONID="NORMAL" OPTION_ALIAS="15 pts / Level" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "ANONYMITY",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<PERK XMLID="ANONYMITY" ID="1709161415388" BASECOST="3.0" LEVELS="0" ALIAS="Anonymity" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(
        {
            key: "COMPUTER_LINK",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<PERK XMLID="COMPUTER_LINK" ID="1709161418315" BASECOST="3.0" LEVELS="0" ALIAS="Computer Link" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(
        {
            key: "CONTACT",
            type: ["perk"],
            behaviors: ["success"],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1), // TODO: Not correct .. needs function
            xml: `<PERK XMLID="CONTACT" ID="1709161420959" BASECOST="0.0" LEVELS="1" ALIAS="Contact" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1710994081842" NAME="">
            <NOTES /></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOMPERK",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            xml: `<PERK XMLID="CUSTOMPERK" ID="1709161423608" BASECOST="0.0" LEVELS="1" ALIAS="Custom Perk" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" ROLL="0" />`,
        },
        {},
    );

    addPower(
        {
            key: "DEEP_COVER",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            xml: `<PERK XMLID="DEEP_COVER" ID="1709161426121" BASECOST="2.0" LEVELS="0" ALIAS="Deep Cover" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(undefined, {
        key: "FALSEIDENTITY",
        type: ["perk"],
        behaviors: [],
        name: "False Identity",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
        xml: `<PERK XMLID="FALSEIDENTITY" ID="1709164911446" BASECOST="1.0" LEVELS="0" ALIAS="False Identity" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "FAVOR",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            xml: `<PERK XMLID="FAVOR" ID="1709161428760" BASECOST="1.0" LEVELS="0" ALIAS="Favor" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1710994081842" NAME="" />`,
        },
        {},
    );
    addPower(
        {
            key: "FOLLOWER",
            type: ["perk"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1 / 5),
            cost: function (item) {
                const basePoints = parseInt(item.system.BASEPOINTS) || 0;
                const number = parseInt(item.system.NUMBER) || 1;
                // A character can have double the number of
                // Followers for +5 CP (twice as many for +5 CP, four times as
                // many for +10 CP, and so on)
                const doublingCost = Math.log2(number, 2) * 5;
                return RoundFavorPlayerDown(basePoints / 5 + doublingCost);
            },
            name: "Follower",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<PERK XMLID="FOLLOWER" ID="1709161431234" BASECOST="0.0" LEVELS="0" ALIAS="Follower" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" NUMBER="1" BASEPOINTS="0" DISADPOINTS="0" />`,
        },
        {},
    );
    addPower(
        {
            key: "FRINGE_BENEFIT",
            type: ["perk"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<PERK XMLID="FRINGE_BENEFIT" ID="1712005548112" BASECOST="0.0" LEVELS="0" ALIAS="Fringe Benefit" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(
        {
            key: "MONEY",
            type: ["perk"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<PERK XMLID="MONEY" ID="1709161436493" BASECOST="5.0" LEVELS="0" ALIAS="Money" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="WELL_OFF" OPTIONID="WELL_OFF" OPTION_ALIAS="Well Off" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(
        {
            key: "REPUTATION",
            type: ["perk", "disadvantage"],
            behaviors: ["success"],
            name: "Positive Reputation",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(0), // TODO: Not correct ... needs function
            // The minimum cost for the Positive Reputation Perk is 1 Character Point per
            // level, regardless of modifiers.
            minimumCost: 1,
            xml: `<PERK XMLID="REPUTATION" ID="1709161449527" BASECOST="0.0" LEVELS="1" ALIAS="Positive Reputation" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                    <ADDER XMLID="HOWWIDE" ID="1709161582270" BASECOST="0.0" LEVELS="0" ALIAS="How Widely Known" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SMALLGROUP" OPTIONID="SMALLGROUP" OPTION_ALIAS="A small to medium sized group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES" />
                    <ADDER XMLID="HOWWELL" ID="1709161582276" BASECOST="-1.0" LEVELS="0" ALIAS="How Well Known" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES" />
                </PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "RESOURCE_POOL",
            type: ["perk"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            name: "Resource Points",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<PERK XMLID="RESOURCE_POOL" ID="1709161452229" BASECOST="0.0" LEVELS="0" ALIAS="Resource Points" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EQUIPMENT" OPTIONID="EQUIPMENT" OPTION_ALIAS="Equipment Points" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FREE_POINTS="0" />`,
        },
        {},
    );

    addPower(
        {
            key: "VEHICLE_BASE",
            type: ["perk"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1 / 5),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<PERK XMLID="VEHICLE_BASE" ID="1709161454715" BASECOST="0.0" LEVELS="0" ALIAS="Vehicles &amp; Bases" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" NUMBER="2" BASEPOINTS="4" DISADPOINTS="0" />`,
        },
        {},
    );
})();

(function addTalentsToPowerList() {
    addPower(
        {
            key: "ABSOLUTE_RANGE_SENSE",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="ABSOLUTE_RANGE_SENSE" ID="1709159935812" BASECOST="3.0" LEVELS="0" ALIAS="Absolute Range Sense" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(
        {
            key: "ABSOLUTE_TIME_SENSE",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="ABSOLUTE_TIME_SENSE" ID="1709159936859" BASECOST="3.0" LEVELS="0" ALIAS="Absolute Time Sense" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(
        {
            key: "AMBIDEXTERITY",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="AMBIDEXTERITY" ID="1709159937654" BASECOST="1.0" LEVELS="0" ALIAS="Ambidexterity" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LEVEL1" OPTIONID="LEVEL1" OPTION_ALIAS="-2 Off Hand penalty" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(
        {
            key: "ANIMALFRIENDSHIP",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="ANIMALFRIENDSHIP" ID="1709159938402" BASECOST="20.0" LEVELS="0" ALIAS="Animal Friendship" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(undefined, {
        key: "BEASTSPEECH",
        type: ["talent"],
        behaviors: [],
        name: "Beast Speech",
        duration: "instant",
        target: "dmcv",
        range: HERO.RANGE_TYPES.NO_RANGE,
        costEnd: false,
        costPerLevel: fixedValueFunction(0),
        xml: `<TALENT XMLID="BEASTSPEECH" ID="1709164944911" BASECOST="15.0" LEVELS="0" ALIAS="Beast Speech" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(undefined, {
        key: "BERSERKFURY",
        type: ["talent"],
        behaviors: [],
        name: "Berserk Fury",
        duration: "instant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: true,
        costPerLevel: fixedValueFunction(0),
        xml: `<TALENT XMLID="BERSERKFURY" ID="1709164947152" BASECOST="16.0" LEVELS="0" ALIAS="Berserk Fury" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "BUMP_OF_DIRECTION",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(0),
            xml: `<TALENT XMLID="BUMP_OF_DIRECTION" ID="1709159939134" BASECOST="3.0" LEVELS="0" ALIAS="Bump Of Direction" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(undefined, {
        key: "COMBATARCHERY",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        name: "Combat Archery",
        xml: `<TALENT XMLID="COMBATARCHERY" ID="1709164949036" BASECOST="8.0" LEVELS="0" ALIAS="Combat Archery" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "COMBAT_LUCK",
            type: ["talent"],
            behaviors: ["activatable", "defense"],
            perceivability: "inobvious", // See HS6E volume 1 pg 477.  Based on Resistant Protection which is inobivous
            name: "Combat Luck",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(6),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        value = (parseInt(actorItemDefense.adjustedLevels) || 0) * 3;
                        break;

                    case "ED":
                        value = (parseInt(actorItemDefense.adjustedLevels) || 0) * 3;
                        break;
                }
                if (value > 0) {
                    const newOptions = foundry.utils.deepClone(options);
                    newOptions.operation = "add";
                    newOptions.resistant = true;
                    newOptions.hardened = (options.hardened || 0) + 1;
                    newOptions.impenetrable = (options.impenetrable || 0) + 1;
                    return createDefenseProfile(actorItemDefense, attackItem, value, newOptions);
                }
                return null;
            },
            xml: `<TALENT XMLID="COMBAT_LUCK" ID="1709159939839" BASECOST="0.0" LEVELS="1" ALIAS="Combat Luck (3 PD/3 ED)" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "COMBATREADY",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="COMBATREADY" ID="1709164954018" BASECOST="3.0" LEVELS="0" ALIAS="Combat Ready" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "COMBAT_SENSE",
            type: ["talent"],
            behaviors: ["success"],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<TALENT XMLID="COMBAT_SENSE" ID="1712005986871" BASECOST="15.0" LEVELS="0" ALIAS="Combat Sense" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "COMBATSHOOTING",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="COMBATSHOOTING" ID="1709164957755" BASECOST="8.0" LEVELS="0" ALIAS="Combat Shooting" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(undefined, {
        key: "COMBATSPELLCASTING",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="COMBATSPELLCASTING" ID="1709164958686" BASECOST="6.0" LEVELS="0" ALIAS="Combat Spellcasting" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="[single spell]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(undefined, {
        key: "CRIPPLINGBLOW",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "instant",
        target: "target's dcv",
        range: HERO.RANGE_TYPES.NO_RANGE,
        costEnd: false,
        xml: `<TALENT XMLID="CRIPPLINGBLOW" ID="1709164962720" BASECOST="16.0" LEVELS="0" ALIAS="Crippling Blow" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "CUSTOMTALENT",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="CUSTOMTALENT" ID="1709159957885" BASECOST="0.0" LEVELS="5" ALIAS="Custom Talent" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" ROLL="11" />`,
        },
        {},
    );

    addPower(
        {
            key: "DANGER_SENSE",
            type: ["talent"],
            behaviors: ["success"],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<TALENT XMLID="DANGER_SENSE" ID="1712006288952" BASECOST="15.0" LEVELS="0" ALIAS="Danger Sense" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(
        {
            key: "DEADLYBLOW",
            type: ["talent"],
            behaviors: [],
            name: "Deadly Blow",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            editOptions: {
                editableOption_ALIAS: true,
                choices: [
                    {
                        OPTIONID: "VERYLIMITED",
                        OPTION: "VERYLIMITED",
                        OPTION_ALIAS: "[very limited circumstances]",
                    },
                    {
                        OPTIONID: "LIMITED",
                        OPTION: "LIMITED",
                        OPTION_ALIAS: "[limited circumstances]",
                    },
                    {
                        OPTIONID: "ANY",
                        OPTION: "ANY",
                        OPTION_ALIAS: "[broad circumstances]",
                    },
                ],
            },
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "VERYLIMITED":
                        return 12;
                    case "LIMITED":
                        return 16;
                    case "ANY":
                        return 19;
                    default:
                        console.error(
                            `Unknown skill levels ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
            appliesTo: function (item) {
                // Poorly defined item, assume it applies
                if (!item || !item.baseInfo) {
                    console.error(`DEADLYBLOW appliesTo invoked with invalid item`, item);
                    return true;
                }

                // Deadly blow only applies either HKA or RKA as defined. Unfortunately HD doesn't
                // specify if it's Hand-to-Hand or Ranged. For the time being we'll just consider it
                // applicable to both and users will have to decide.
                if (item.doesKillingDamage) {
                    return true;
                }

                return false;
            },
            xml: `<TALENT XMLID="DEADLYBLOW" ID="1709159979031" BASECOST="0.0" LEVELS="2" ALIAS="Deadly Blow:  +2d6" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYLIMITED" OPTIONID="VERYLIMITED" OPTION_ALIAS="[very limited circumstances]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "VERYLIMITED":
                        return 4;
                    case "LIMITED":
                        return 7;
                    case "ANY":
                        return 10;
                    default:
                        console.error(
                            `Unknown skill levels ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
        },
    );
    addPower(undefined, {
        key: "DIVINEFAVOR",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="DIVINEFAVOR" ID="1709164973071" BASECOST="10.0" LEVELS="0" ALIAS="Divine Favor" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "DOUBLE_JOINTED",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="DOUBLE_JOINTED" ID="1709159984537" BASECOST="4.0" LEVELS="0" ALIAS="Double Jointed" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(
        {
            key: "EIDETIC_MEMORY",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="EIDETIC_MEMORY" ID="1709159985473" BASECOST="5.0" LEVELS="0" ALIAS="Eidetic Memory" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(
        {
            key: "ENVIRONMENTAL_MOVEMENT",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="ENVIRONMENTAL_MOVEMENT" ID="1709159986372" BASECOST="3.0" LEVELS="0" ALIAS="Environmental Movement" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="no penalties on" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "EVASIVE",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "instant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="EVASIVE" ID="1709164979197" BASECOST="18.0" LEVELS="0" ALIAS="Evasive" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });

    addPower(undefined, {
        key: "FTLPILOT",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="FTLPILOT" ID="1709164980297" BASECOST="4.0" LEVELS="0" ALIAS="FTL Pilot" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(undefined, {
        key: "FASCINATION",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="FASCINATION" ID="1709164981287" BASECOST="10.0" LEVELS="0" ALIAS="Fascination" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(undefined, {
        key: "FEARLESS",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="FEARLESS" ID="1709164983473" BASECOST="14.0" LEVELS="0" ALIAS="Fearless" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(undefined, {
        key: "FOLLOWTHROUGHATTACK",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "instant",
        target: "target's dcv",
        range: HERO.RANGE_TYPES.NO_RANGE,
        costEnd: false,
        xml: `<TALENT XMLID="FOLLOWTHROUGHATTACK" ID="1709164984595" BASECOST="10.0" LEVELS="0" ALIAS="Follow-Through Attack" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });

    addPower(undefined, {
        key: "HOTSHOTPILOT",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        name: "Hotshot Pilot",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="HOTSHOTPILOT" ID="1709164985624" BASECOST="24.0" LEVELS="0" ALIAS="Hotshot Pilot" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STARHERO" OPTIONID="STARHERO" OPTION_ALIAS="Star Hero" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });

    addPower(undefined, {
        key: "INSPIRE",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="INSPIRE" ID="1709164986910" BASECOST="11.0" LEVELS="0" ALIAS="Inspire" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });

    addPower(undefined, {
        key: "LATENTPSIONIC",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="LATENTPSIONIC" ID="1709164987906" BASECOST="5.0" LEVELS="0" ALIAS="Latent Psionic" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "LIGHTNING_CALCULATOR",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="LIGHTNING_CALCULATOR" ID="1709159991424" BASECOST="3.0" LEVELS="0" ALIAS="Lightning Calculator" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(
        {
            key: "LIGHTNING_REFLEXES_ALL",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            cost: function (item) {
                const levels = parseInt(item.system.LEVELS);
                switch (item.system.OPTIONID) {
                    case "ALLHTH":
                        return Math.max(1, Math.min(levels / 2)) * this.costPerLevel();
                    case "LARGEGROUP":
                        return Math.max(Math.min(levels / 3)) * this.costPerLevel();
                    case "SMALLGROUP":
                        return Math.max(Math.min(levels / 4)) * this.costPerLevel();
                    case "SINGLE":
                        return Math.max(Math.min(levels / 5)) * this.costPerLevel();
                }
                return levels * this.costPerLevel(); // ALL ACTIONS
            },
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1709159992355" BASECOST="0.0" LEVELS="1" ALIAS="Lightning Reflexes" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="All Actions" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {
            xml: `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1709164993726" BASECOST="0.0" LEVELS="2" ALIAS="Lightning Reflexes: +2 DEX to act first with All Actions" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
    );
    addPower(undefined, {
        key: "LIGHTNING_REFLEXES_SINGLE",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(1),
        name: "Lightning Reflexes",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="LIGHTNING_REFLEXES_SINGLE" ID="1709164999711" BASECOST="0.0" LEVELS="1" ALIAS="Lightning Reflexes: +1 DEX to act first with Single Action" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Single Action" />`,
    });
    addPower(
        {
            key: "LIGHTSLEEP",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="LIGHTSLEEP" ID="1709160000741" BASECOST="3.0" LEVELS="0" ALIAS="Lightsleep" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(undefined, {
        key: "MAGESIGHT",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="MAGESIGHT" ID="1709165001978" BASECOST="5.0" LEVELS="0" ALIAS="Magesight" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="NOGROUP" />`,
    });
    addPower(undefined, {
        key: "MOUNTEDWARRIOR",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="MOUNTEDWARRIOR" ID="1709165004554" BASECOST="4.0" LEVELS="0" ALIAS="Mounted Warrior" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HTH" OPTIONID="HTH" OPTION_ALIAS="HTH Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });

    addPower(
        {
            key: "OFFHANDDEFENSE",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="OFFHANDDEFENSE" ID="1709160002394" BASECOST="2.0" LEVELS="0" ALIAS="Off-Hand Defense" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(
        {
            key: "PERFECT_PITCH",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="PERFECT_PITCH" ID="1709160003293" BASECOST="3.0" LEVELS="0" ALIAS="Perfect Pitch" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(undefined, {
        key: "RAPIDARCHERY",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(1),
        duration: "instant",
        target: "self only",
        range: HERO.RANGE_TYPES.STANDARD,
        costEnd: false,
        xml: `<TALENT XMLID="RAPIDARCHERY" ID="1709165008178" BASECOST="4.0" LEVELS="0" ALIAS="Rapid Archery" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(undefined, {
        key: "RAPIDHEALING",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(1),
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="RAPIDHEALING" ID="1709165009140" BASECOST="5.0" LEVELS="0" ALIAS="Rapid Healing" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "RESISTANCE",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<TALENT XMLID="RESISTANCE" ID="1709160004117" BASECOST="0.0" LEVELS="1" ALIAS="Resistance (+1 to roll)" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(undefined, {
        key: "SHAPECHANGING",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: "instant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        xml: `<TALENT XMLID="SHAPECHANGING" ID="1709165011068" BASECOST="18.0" LEVELS="0" ALIAS="Shapechanging" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="[one pre-defined 300-point form]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "SIMULATE_DEATH",
            type: ["talent"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(1),
            duration: "instant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            defenseTagVsAttack: function () {
                // Not really sure when this would be part of a defense
                return null;
            },
            xml: `<TALENT XMLID="SIMULATE_DEATH" ID="1709160004972" BASECOST="3.0" LEVELS="0" ALIAS="Simulate Death" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "SKILLMASTER",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        costPerLevel: fixedValueFunction(1),
        xml: `<TALENT XMLID="SKILLMASTER" ID="1709165014218" BASECOST="6.0" LEVELS="0" ALIAS="Skill Master" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="+3 with [single skill]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "SPEED_READING",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(2),
            xml: `<TALENT XMLID="SPEED_READING" ID="1709160005725" BASECOST="2.0" LEVELS="1" ALIAS="Speed Reading (x10)" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );
    addPower(undefined, {
        key: "SPELLAUGMENTATION",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        costPerLevel: fixedValueFunction(2),
        xml: `<TALENT XMLID="SPELLAUGMENTATION" ID="1709165017535" BASECOST="12.0" LEVELS="0" ALIAS="Spell Augmentation" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(
        {
            key: "STRIKING_APPEARANCE",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "ALL":
                        return 3;
                    case "GROUP":
                        return 2;
                    default:
                        console.error(`STRIKING_APPEARANCE unknown OPTIONID ${item.system.OPTIONID}`);
                        return 2;
                }
            },
            xml: `<TALENT XMLID="STRIKING_APPEARANCE" ID="1709160006516" BASECOST="0.0" LEVELS="1" ALIAS="Striking Appearance" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="vs. all characters" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        undefined,
    );

    addPower(undefined, {
        key: "TRACKLESSSTRIDE",
        type: ["talent"],
        behaviors: ["activatable"],
        duration: "constant",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: true,
        costPerLevel: fixedValueFunction(0),
        xml: `<TALENT XMLID="TRACKLESSSTRIDE" ID="1709165018596" BASECOST="2.0" LEVELS="0" ALIAS="Trackless Stride" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
    });
    addPower(undefined, {
        key: "TURNUNDEAD",
        type: ["talent"],
        behaviors: ["activatable"],
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        costPerLevel: fixedValueFunction(0),
        xml: `<TALENT XMLID="TURNUNDEAD" ID="1709165019594" BASECOST="12.0" LEVELS="0" ALIAS="Turn Undead (+0 PRE)" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
        <NOTES /></TALENT>`,
    });

    addPower(
        {
            key: "UNIVERSAL_TRANSLATOR",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<TALENT XMLID="UNIVERSAL_TRANSLATOR" ID="1709160010042" BASECOST="20.0" LEVELS="0" ALIAS="Universal Translator" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT">
            <NOTES /></TALENT>`,
        },
        {},
    );

    addPower(
        {
            key: "WEAPON_MASTER",
            type: ["talent"],
            behaviors: [""],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            editOptions: {
                showAttacks: true,
                editableOption_ALIAS: true,
                choices: [
                    {
                        OPTIONID: "VERYLIMITED",
                        OPTION: "VERYLIMITED",
                        OPTION_ALIAS: "[very limited group]",
                    },
                    {
                        OPTIONID: "LIMITED",
                        OPTION: "LIMITED",
                        OPTION_ALIAS: "[limited group]",
                    },
                    {
                        OPTIONID: "ANYHTH",
                        OPTION: "ANYHTH",
                        OPTION_ALIAS: "[all HTH Killing Damage weapons]",
                    },
                    {
                        OPTIONID: "ANYRANGED",
                        OPTION: "ANYRANGED",
                        OPTION_ALIAS: "all Ranged Killing Damage weapons",
                    },
                ],
            },
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "VERYLIMITED":
                        return 12;
                    case "LIMITED":
                        return 20;
                    case "ANYHTH":
                        return 24;
                    case "ANYRANGED":
                        return 24;
                    default:
                        console.error(
                            `Unknown skill levels ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
            xml: `<TALENT XMLID="WEAPON_MASTER" ID="1709160011422" BASECOST="0.0" LEVELS="1" ALIAS="Weapon Master:  +1d6" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYLIMITED" OPTIONID="VERYLIMITED" OPTION_ALIAS="[very limited group]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" />`,
        },
        {},
    );

    addPower(
        {
            key: "WELL_CONNECTED",
            type: ["perk", "enhancer"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            xml: `<WELL_CONNECTED XMLID="WELL_CONNECTED" ID="1710994081842" BASECOST="3.0" LEVELS="0" ALIAS="Well-Connected" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO"></WELL_CONNECTED>`,
        },
        {},
    );
})();

(function addPowersToPowerList() {
    addPower(
        {
            key: "ABSORPTION",
            type: ["adjustment", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            unusualDicePerDc: true,
            baseEffectDicePartsBundle: (item) => {
                const numPips = parseInt(item.system?.LEVELS || 0);
                const diceParts = {
                    dc: item.dcRaw,
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: numPips,
                };

                return defaultPowerDicePartsBundle(item, diceParts);
            },
            doesKillingDamage: fixedValueFunction(false),
            xml: ` <POWER XMLID="ABSORPTION" ID="1709333775419" BASECOST="0.0" LEVELS="1" ALIAS="Absorption" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ENERGY" OPTIONID="ENERGY" OPTION_ALIAS="energy" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="STR" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            type: ["adjustment", "attack"],
            behaviors: ["activatable", "dice"],
            costPerLevel: fixedValueFunction(5),
            unusualDicePerDc: false,
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
        },
    );
    addPower(
        {
            key: "AID",
            type: ["adjustment", "attack"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target’s DCV",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: true,
            hasNoDefense: true,
            costPerLevel: fixedValueFunction(6),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="AID" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" USE_END_RESERVE="No" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="STR" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            costEnd: false,
            costPerLevel: fixedValueFunction(10),
        },
    );
    addPower(undefined, {
        key: "ARMOR",
        type: ["defense"],
        behaviors: ["activatable", "defense"],
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costPerLevel: fixedValueFunction(3 / 2),
        defenseTagVsAttack: function (...args) {
            return HERO.powers6e.find((o) => o.key === "FORCEFIELD").defenseTagVsAttack(...args);
        },
        baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        xml: `<POWER XMLID="ARMOR" ID="1709342537943" BASECOST="0.0" LEVELS="0" ALIAS="Armor" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0"></POWER>`,
    });
    addPower(
        {
            key: "AUTOMATON",
            type: ["automaton", "special"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            perceivability: "inobvious",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="AUTOMATON" ID="1709333784244" BASECOST="15.0" LEVELS="0" ALIAS="Automaton" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CANNOTBESTUNNED" OPTIONID="CANNOTBESTUNNED" OPTION_ALIAS="Cannot Be Stunned" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "CHANGEENVIRONMENT",
            type: ["attack"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "constant",
            target: "Target’s DCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            usesStrength: false,
            costPerLevel: fixedValueFunction(0),
            unusualDicePerDc: true,
            baseEffectDicePartsBundle: (item) => {
                let numPips = 0;

                const damageAdder = item.system.ADDER?.find((adder) => adder.XMLID === "DAMAGE");
                if (damageAdder) {
                    numPips = parseInt(damageAdder.LEVELS || 0);
                }

                const diceParts = {
                    dc: item.dcRaw,
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: numPips,
                };
                return defaultPowerDicePartsBundle(item, diceParts);
            },
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="CHANGEENVIRONMENT" ID="1711932803443" BASECOST="0.0" LEVELS="0" ALIAS="Change Environment" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        { costPerLevel: fixedValueFunction(5) },
    );
    addPower(
        {
            key: "CLAIRSENTIENCE",
            type: ["sense"],
            behaviors: ["activatable"],
            perceivability: "imperceptible",
            costPerLevel: fixedValueFunction(1),
            duration: "constant",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="CLAIRSENTIENCE" ID="1711932894754" BASECOST="20.0" LEVELS="0" ALIAS="Clairsentience" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "CLINGING",
            type: ["standard"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1 / 3),
            defenseTagVsAttack: function () {
                // Not really sure when this would be part of a defense
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="CLINGING" ID="1709333852130" BASECOST="10.0" LEVELS="5" ALIAS="Clinging" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOMPOWER",
            type: ["custom", "activatable"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="CUSTOMPOWER" ID="1711932960992" BASECOST="1.0" LEVELS="1" ALIAS="Custom Power" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" DOESBODY="No" DOESDAMAGE="No" DOESKNOCKBACK="No" KILLING="No" DEFENSE="NONE" END="Yes" VISIBLE="Yes" RANGE="SELF" DURATION="INSTANT" TARGET="SELFONLY" ENDCOLUMNOUTPUT="" USECUSTOMENDCOLUMN="No"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "DAMAGENEGATION",
            type: ["defense", "special"],
            behaviors: ["activatable", "defense"],
            costPerLevel: fixedValueFunction(0),
            perceivability: "inobvious",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        value = parseInt(actorItemDefense.system.ADDER.find((o) => o.XMLID == "PHYSICAL")?.LEVELS) || 0;
                        break;

                    case "ED":
                        value = parseInt(actorItemDefense.system.ADDER.find((o) => o.XMLID == "ENERGY")?.LEVELS) || 0;
                        break;

                    case "MD":
                        value = parseInt(actorItemDefense.system.ADDER.find((o) => o.XMLID == "MENTAL")?.LEVELS) || 0;
                        break;
                }
                if (value > 0) {
                    const newOptions = foundry.utils.deepClone(options);
                    newOptions.operation = "subtract";
                    return createDefenseProfile(actorItemDefense, attackItem, value, newOptions);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="DAMAGENEGATION" ID="1711933005926" BASECOST="0.0" LEVELS="0" ALIAS="Damage Negation" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            <NOTES />
            <ADDER XMLID="PHYSICAL" ID="1711933106772" BASECOST="0.0" LEVELS="0" ALIAS="Physical DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="ENERGY" ID="1711933106773" BASECOST="0.0" LEVELS="0" ALIAS="Energy DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="MENTAL" ID="1711933106774" BASECOST="0.0" LEVELS="0" ALIAS="Mental DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
              <NOTES />
            </ADDER>
          </POWER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "DAMAGEREDUCTION",
            type: ["defense", "standard"],
            behaviors: ["activatable", "defense"],
            costPerLevel: fixedValueFunction(0),
            perceivability: "inobvious",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            afterDefenses: true,
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        if (actorItemDefense.system.INPUT.match(/Physical/i)) {
                            value = parseInt(actorItemDefense.system.OPTIONID.match(/\d+/)) || 0;
                        }
                        break;

                    case "ED":
                        if (actorItemDefense.system.INPUT.match(/Energy/i)) {
                            value = parseInt(actorItemDefense.system.OPTIONID.match(/\d+/)) || 0;
                        }
                        break;

                    case "MD":
                        if (actorItemDefense.system.INPUT.match(/Mental/i)) {
                            value = parseInt(actorItemDefense.system.OPTIONID.match(/\d+/)) || 0;
                        }
                        break;
                }
                if (value > 0) {
                    const newOptions = foundry.utils.deepClone(options);
                    //const resistant = actorItemDefense.system.OPTIONID.match(/RESISTANT/) ? 1 : 0;
                    newOptions.resistant = true;
                    newOptions.operation = "pct";
                    return createDefenseProfile(actorItemDefense, attackItem, value, newOptions);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="DAMAGEREDUCTION" ID="1709333866040" BASECOST="10.0" LEVELS="0" ALIAS="Damage Reduction" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LVL25NORMAL" OPTIONID="LVL25NORMAL" OPTION_ALIAS="Damage Reduction, 25%" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Energy" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        undefined,
        {
            key: "DAMAGERESISTANCE",
            type: ["defense"],
            behaviors: ["activatable", "defense"],
            //perceivability: "obvious",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1 / 2),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                let maxValue = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        value = parseInt(actorItemDefense.system.PDLEVELS) || 0;
                        maxValue = parseInt(actorItemDefense.actor?.system.characteristics.pd.core) || 0;
                        break;

                    case "ED":
                        value = parseInt(actorItemDefense.system.EDLEVELS) || 0;
                        maxValue = parseInt(actorItemDefense.actor?.system.characteristics.ed.core) || 0;
                        break;

                    case "MD":
                        value = parseInt(actorItemDefense.system.MDLEVELS) || 0;
                        // Icky to calculate maxValue. Deferring for now.
                        maxValue = value;
                        break;

                    case "FLASHDEFENSE":
                        value = parseInt(actorItemDefense.system.FDLEVELS) || 0;
                        // Icky to calculate maxValue. Deferring for now.
                        maxValue = value;
                        break;

                    case "POWERDEFENSE":
                        value = parseInt(actorItemDefense.system.POWDLEVELS) || 0;
                        // Icky to calculate maxValue. Deferring for now.
                        maxValue = value;
                        break;
                }

                if (value > maxValue) {
                    const msg = `${actorItemDefense.name} has more ${options.attackDefenseVs} LEVELS (${value}) than natural LEVELS (${maxValue}). Defenses may not properly represent this defense. Consider ARMOR if you want resistant defenses.`;
                    // Attempt some sort of spam control
                    if ($(ui.notifications.active).first("li:contains('than natural LEVELS')").length === 0) {
                        // if (!ui.notifications.queue.find((n) => n.message === msg)) {
                        ui.notifications.warn(msg, actorItemDefense);
                    }
                    //value = maxValue;
                }
                if (value > 0) {
                    const newOptions = foundry.utils.deepClone(options);
                    newOptions.operation = "add";
                    newOptions.resistant = true;
                    return createDefenseProfile(actorItemDefense, attackItem, value, newOptions);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="DAMAGERESISTANCE" ID="1709342567780" BASECOST="0.0" LEVELS="0" ALIAS="Damage Resistance" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" FDLEVELS="0" POWDLEVELS="0"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DARKNESS",
            type: ["sense-affecting", "attack", "standard"],
            behaviors: ["to-hit"],
            perceivability: "obvious",
            costPerLevel: function (item) {
                const is5e = item.is5e;
                switch (item.system.OPTIONID) {
                    case "SIGHTGROUP":
                        return is5e ? 10 : 5; // Targeting sense gruop
                    case "HEARINGGROUP":
                    case "MENTALGROUP":
                    case "RADIOGROUP":
                    case "SMELLGROUP":
                    case "TOUCHGROUP":
                        return is5e ? 5 : 3; // Non-targeting sense group
                    default:
                        console.error(`DARKNESS OPTIONID ${item.system.OPTIONID} is not handled`);
                }
                return is5e ? 10 : 5;
            },
            duration: "constant",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            optionIDFix: function (json) {
                if (["SIGHT", "HEARING", "MENTAL", "RADIO", "SMELL", "TOUCH"].includes(json.OPTION)) {
                    return json.OPTION + "GROUP";
                }
                return json.OPTION;
            },
            xml: `<POWER XMLID="DARKNESS" ID="1709333868971" BASECOST="0.0" LEVELS="1" ALIAS="Darkness" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DENSITYINCREASE",
            type: ["body-affecting", "standard"],
            behaviors: ["activatable", "defense"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(4),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        value = parseInt(actorItemDefense.adjustedLevels) || 0;
                        break;

                    case "ED":
                        value = parseInt(actorItemDefense.adjustedLevels) || 0;
                        break;

                    case "KB":
                        value = (parseInt(actorItemDefense.adjustedLevels) || 0) * 2;
                        break;
                }
                if (value > 0) {
                    return createDefenseProfile(actorItemDefense, attackItem, value, options);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            descriptionFactory: function (item) {
                const noStrIncrease = item.modifiers.find((mod) => mod.XMLID === "NOSTRINCREASE");
                return `${item.system.ALIAS} (${Math.pow(2, item.system.value) * 100} kg mass, +${
                    noStrIncrease ? 0 : item.system.value * 5
                } STR, +${item.system.value} PD/ED, -${hexDistanceToSystemDisplayString(item.system.value, item.actor)} KB)`;
            },
            xml: `<POWER XMLID="DENSITYINCREASE" ID="1709333874268" BASECOST="0.0" LEVELS="1" ALIAS="Density Increase" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            costPerLevel: fixedValueFunction(5),
        },
    );
    addPower(
        {
            key: "DESOLIDIFICATION",
            type: ["body-affecting", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            costPerLevel: fixedValueFunction(0),
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="DESOLIDIFICATION" ID="1709333876708" BASECOST="40.0" LEVELS="0" ALIAS="Desolidification" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DISPEL",
            type: ["adjustment", "attack"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target’s DCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            costPerLevel: fixedValueFunction(3),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="DISPEL" ID="1711933464095" BASECOST="0.0" LEVELS="1" ALIAS="Dispel" POSITION="34" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DOESNOTBLEED",
            type: ["automaton", "special"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(3),
            perceivability: "obvious",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="DOESNOTBLEED" ID="1709333885275" BASECOST="15.0" LEVELS="0" ALIAS="Does Not Bleed" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DRAIN",
            type: ["adjustment", "attack"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target’s DCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            costPerLevel: fixedValueFunction(10),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="DRAIN" ID="1711933555522" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        { range: HERO.RANGE_TYPES.NO_RANGE },
    );
    addPower(
        {
            key: "DUPLICATION",
            type: ["body-affecting", "special"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1 / 5),
            cost: function (item) {
                const points = parseInt(item.system.POINTS) || 0;
                return Math.ceil(points * this.costPerLevel());
            },
            defenseTagVsAttack: function () {
                // Not really sure when this would be part of a defense
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="DUPLICATION" ID="1711933622430" BASECOST="0.0" LEVELS="0" ALIAS="Duplication" POSITION="37" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" NUMBER="1" POINTS="0"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "EGOATTACK",
            type: ["attack", "mental"],
            behaviors: ["to-hit", "dice"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "dmcv",
            range: HERO.RANGE_TYPES.LINE_OF_SIGHT,
            costEnd: true,
            usesStrength: false,
            costPerLevel: fixedValueFunction(10),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="EGOATTACK" ID="1709333954550" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="58" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            xml: `<POWER XMLID="EGOATTACK" ID="1709342586861" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
    );
    addPower(
        {
            key: "ENDURANCERESERVE",
            type: ["special"],
            behaviors: [],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1 / 4),
            basePoints: function (item) {
                const levels = parseInt(item.system.LEVELS || 0);

                if (!item.is5e) {
                    return levels > 0 ? Math.max(1, Math.ceil(levels / 4)) : 0;
                }

                return levels > 0 ? Math.max(1, Math.ceil(levels / 10)) : 0;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="ENDURANCERESERVE" ID="1712448783608" BASECOST="0.0" LEVELS="0" ALIAS="Endurance Reserve" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><POWER XMLID="ENDURANCERESERVEREC" ID="1712448793952" BASECOST="0.0" LEVELS="1" ALIAS="Recovery" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER></POWER>`,
        },
        {
            costPerLevel: fixedValueFunction(1 / 10),
            basePoints: function (item) {
                const levels = parseInt(item.system.LEVELS || 0);
                return levels > 0 ? Math.max(1, Math.ceil(levels / 10)) : 0;
            },
        },
    );
    addPower(
        {
            key: "ENDURANCERESERVEREC",
            type: ["special"],
            behaviors: [],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(2 / 3),
            cost: function (adderLikeItem) {
                const levels = parseInt(adderLikeItem.LEVELS || 0);

                if (!adderLikeItem.is5e) {
                    return levels > 0 ? Math.max(1, Math.ceil(levels / 3) * 2) : 0;
                }

                return levels;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="ENDURANCERESERVEREC" ID="1713377825229" BASECOST="0.0" LEVELS="1" ALIAS="Recovery" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            costPerLevel: fixedValueFunction(1),
            cost: undefined,
        },
    );
    addPower(
        {
            key: "ENERGYBLAST",
            type: ["attack"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.STANDARD,
            costPerLevel: fixedValueFunction(5),
            costEnd: true,
            usesStrength: false,
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="ENERGYBLAST" ID="1709333792635" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            xml: `<POWER XMLID="ENERGYBLAST" ID="1709342600684" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
    );
    addPower(
        {
            key: "ENTANGLE",
            type: ["attack", "standard"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            nonDmgEffect: true,
            defense: function (item) {
                const baseDef = parseInt(item.adjustedLevels || 0);

                const additionalDef = parseInt(item.findModsByXmlid("ADDITIONALDEF")?.LEVELS || 0);
                const additionalPD = parseInt(item.findModsByXmlid("ADDITIONALPD")?.LEVELS || 0);
                const additionalED = parseInt(item.findModsByXmlid("ADDITIONALED")?.LEVELS || 0);

                const rPD = baseDef + additionalPD;
                const rED = baseDef + additionalED;
                // 6e +1 DEF = +2 rMD. NOTE: HD doesn't have ability to buy MD in 6e.
                const rMD = baseDef + 2 * (additionalDef || additionalPD + additionalED);

                // BOECV for 5e, ACV for 6e
                const mentalEntangle =
                    (item.findModsByXmlid("BOECV") &&
                        item.findModsByXmlid("TAKESNODAMAGE") &&
                        item.findModsByXmlid("VERSUSEGO")) ||
                    (item.findModsByXmlid("ACV") &&
                        item.findModsByXmlid("TAKESNODAMAGE") &&
                        item.findModsByXmlid("VERSUSEGO"));
                return {
                    rPD,
                    rED,
                    rMD: mentalEntangle ? rMD : 0,
                    mentalEntangle,
                    string: `${mentalEntangle ? `${rMD} rMD` : `${rPD} rPD/${rED} rED`}`,
                };
            },
            costPerLevel: fixedValueFunction(10),
            unusualDicePerDc: true,
            baseEffectDicePartsBundle: (item) => {
                const baseBodyDice = parseInt(item.system?.LEVELS || 0);
                let baseHalfDice = 0;
                let additionalBodyDice = 0;

                const plusOneHalfDie = item.system.ADDER?.find((adder) => adder.XMLID === "PLUSONEHALFDIE");
                if (plusOneHalfDie) {
                    baseHalfDice = 1;
                }

                const additionalBody = item.system.ADDER?.find((adder) => adder.XMLID === "ADDITIONALBODY");
                if (additionalBody) {
                    additionalBodyDice = parseInt(additionalBody.LEVELS || 0);
                }

                const diceParts = {
                    dc: item.dcRaw,
                    d6Count: baseBodyDice + additionalBodyDice,
                    d6Less1DieCount: 0,
                    halfDieCount: baseHalfDice,
                    constant: 0,
                };
                return defaultPowerDicePartsBundle(item, diceParts);
            },
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="ENTANGLE" ID="1709342612255" BASECOST="0.0" LEVELS="1" ALIAS="Entangle" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "EXTRALIMBS",
            type: ["standard"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(0),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="EXTRALIMBS" ID="1709342614933" BASECOST="5.0" LEVELS="1" ALIAS="Extra Limbs" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(undefined, {
        key: "FINDWEAKNESS",
        type: ["sense", "special", "skill"],
        behaviors: ["success"],
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costPerLevel: fixedValueFunction(5),
        baseEffectDicePartsBundle: standardBaseEffectDiceParts,
        xml: `<POWER XMLID="FINDWEAKNESS" ID="1709342622694" BASECOST="10.0" LEVELS="0" ALIAS="Find Weakness" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
    });
    addPower(
        {
            key: "FIXEDLOCATION",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            target: "Target’s DCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="FIXEDLOCATION" ID="1709334034085" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation: Fixed Location" POSITION="82" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FLOATINGLOCATION",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "instant",
            target: "Target’s DCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="FLOATINGLOCATION" ID="1709334037026" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation: Floating Fixed Location" POSITION="83" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FLASH",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "Target’s DCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            costPerLevel: function (item) {
                // FLASH (target group cost 5 per level, non-targeting costs 3 per level)
                if (item?.system?.OPTIONID === "SIGHTGROUP") {
                    // The only targeting group
                    return 5;
                } else {
                    return 3;
                }
            },
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="FLASH" ID="1711933970815" BASECOST="0.0" LEVELS="1" ALIAS="Flash" POSITION="44" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FLASHDEFENSE",
            type: ["defense", "special"],
            behaviors: ["activatable", "defense"],
            perceivability: "inobvious",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            editOptions: {
                editableOption_ALIAS: true,
                choices: [
                    {
                        OPTIONID: "HEARINGGROUP",
                        OPTION: "HEARINGGROUP",
                        OPTION_ALIAS: "Hearing Group",
                    },
                    {
                        OPTIONID: "MENTALGROUP",
                        OPTION: "MENTALGROUP",
                        OPTION_ALIAS: "Mental Group",
                    },
                    {
                        OPTIONID: "RADIOGROUP",
                        OPTION: "RADIOGROUP",
                        OPTION_ALIAS: "Radio Group",
                    },
                    {
                        OPTIONID: "SIGHTGROUP",
                        OPTION: "SIGHTGROUP",
                        OPTION_ALIAS: "Sight Group",
                    },
                    {
                        OPTIONID: "SMELLGROUP",
                        OPTION: "SMELLGROUP",
                        OPTION_ALIAS: "Smell/Taste Group",
                    },
                    {
                        OPTIONID: "TOUCHGROUP",
                        OPTION: "TOUCHGROUP",
                        OPTION_ALIAS: "Touch Group",
                    },
                ],
            },
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "FLASHDEFENSE":
                        value = parseInt(actorItemDefense.adjustedLevels) || 0;
                        break;
                }
                if (value > 0) {
                    const newOptions = foundry.utils.deepClone(options);
                    newOptions.operation = "add";
                    return createDefenseProfile(actorItemDefense, attackItem, value, newOptions);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="FLASHDEFENSE" ID="1711933981614" BASECOST="0.0" LEVELS="1" ALIAS="Flash Defense" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FORCEFIELD", // RESISTANT PROTECTION
            type: ["defense", "standard"],
            behaviors: ["activatable", "defense"],
            duration: "persistent",
            perceivability: "inobvious",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(3 / 2),
            cost: function (item) {
                // 3 CP per 2 points of Resistant Defense
                const levels = parseInt(item.system?.LEVELS || 0);
                return Math.ceil(levels / 2) * 3;
            },
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        value = parseInt(actorItemDefense.system.PDLEVELS) || 0;
                        break;

                    case "ED":
                        value = parseInt(actorItemDefense.system.EDLEVELS) || 0;
                        break;

                    case "MD":
                        value = parseInt(actorItemDefense.system.MDLEVELS) || 0;
                        break;

                    case "POWERDEFENSE":
                        value = parseInt(actorItemDefense.system.POWDLEVELS) || 0;
                        break;
                }
                if (value > 0) {
                    const newOptions = foundry.utils.deepClone(options);
                    newOptions.resistant = true;
                    return createDefenseProfile(actorItemDefense, attackItem, value, newOptions);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="FORCEFIELD" ID="1709334003070" BASECOST="0.0" LEVELS="0" ALIAS="Resistant Protection" POSITION="71" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0"></POWER>`,
        },
        {
            duration: "constant",
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            cost: undefined,
            xml: `<POWER XMLID="FORCEFIELD" ID="1709342634480" BASECOST="0.0" LEVELS="0" ALIAS="Force Field" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0"></POWER>`,
        },
    );
    addPower(
        {
            key: "FORCEWALL", //BARRIER
            type: ["defense", "standard"],
            behaviors: ["to-hit", "defense"],
            duration: "instant",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            costPerLevel: fixedValueFunction(3 / 2), // LEVELS are the sum of rPD and rED
            cost: function (item) {
                let _cost = parseFloat(item.system.BASECOST);
                _cost += parseInt(item.system?.LEVELS || 0) * this.costPerLevel();
                _cost += parseInt(item.system.BODYLEVELS) || 0; // 6e only
                _cost += (parseInt(item.system.LENGTHLEVELS) || 0) * (item.system.is5e ? 2 : 1);
                _cost += (parseInt(item.system.HEIGHTLEVELS) || 0) * (item.system.is5e ? 2 : 1);
                _cost += Math.ceil(parseFloat(item.system.WIDTHLEVELS * 2)) || 0; // per +½m of thickness (6e only)
                return _cost;
            },
            defenseTagVsAttack: function () {
                // We really shouldn't include this as a defense.
                // TODO: Implement FORCEWALL englobing like we do with ENTANGLE
                // return HERO.powers6e.find((o) => o.key === "FORCEFIELD").defenseTagVsAttack(...args);
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="FORCEWALL" ID="1711932416775" BASECOST="3.0" LEVELS="0" ALIAS="Barrier" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0" LENGTHLEVELS="0" HEIGHTLEVELS="0" BODYLEVELS="0" WIDTHLEVELS="0.0"></POWER>`,
        },
        {
            duration: "constant",
            costPerLevel: fixedValueFunction(5 / 2), // LEVELS are the sum of rPD and rED
            xml: `<POWER XMLID="FORCEWALL" ID="1709342637180" BASECOST="0.0" LEVELS="0" ALIAS="Force Wall" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0" LENGTHLEVELS="0" HEIGHTLEVELS="0" BODYLEVELS="0" WIDTHLEVELS="0.0"></POWER>`,
        },
    );

    addPower(
        {
            key: "GROWTH",
            type: ["body-affecting", "size"],
            behaviors: ["activatable", "defense"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(5),
            details: function (item) {
                const result = {
                    str: 15,
                    con: 5,
                    pre: 5,
                    pd: 3,
                    ed: 3,
                    body: 3,
                    stun: 6,
                    reach: 1,
                    running: 12,
                    kb: 6,
                    mass: "101-800 kg",
                    dcv: 2,
                    perception: 2,
                    tall: "2-4",
                    wide: "1-2",
                };
                switch (item.system.OPTIONID) {
                    case "LARGE":
                        break;
                    case "ENORMOUS":
                        result.str = 30;
                        result.con = 10;
                        result.pre = 10;
                        result.pd = 6;
                        result.ed = 6;
                        result.body = 6;
                        result.stun = 12;
                        result.reach = 3;
                        result.running = 24;
                        result.kb = 12;
                        result.mass = "801-6,400 kg";
                        result.dcv = 4;
                        result.perception = 4;
                        result.tall = "8";
                        result.wide = "4";
                        break;
                    case "HUGE":
                        result.str = 45;
                        result.con = 15;
                        result.pre = 15;
                        result.pd = 9;
                        result.ed = 9;
                        result.body = 9;
                        result.stun = 18;
                        result.reach = 7;
                        result.running = 36;
                        result.kb = 18;
                        result.mass = "6,401-50,000 kg";
                        result.dcv = 6;
                        result.perception = 6;
                        result.tall = "16";
                        result.wide = "8";
                        break;
                    case "GIGANTIC":
                        result.str = 60;
                        result.con = 20;
                        result.pre = 20;
                        result.pd = 12;
                        result.ed = 12;
                        result.body = 12;
                        result.stun = 24;
                        result.reach = 15;
                        result.running = 48;
                        result.kb = 24;
                        result.mass = "50,001-400,000 kg";
                        result.dcv = 8;
                        result.perception = 8;
                        result.tall = "32";
                        result.wide = "16";
                        break;
                    case "GARGANTUAN":
                        result.str = 75;
                        result.con = 25;
                        result.pre = 25;
                        result.pd = 15;
                        result.ed = 15;
                        result.body = 15;
                        result.stun = 30;
                        result.reach = 31;
                        result.running = 60;
                        result.kb = 30;
                        result.mass = "400,001-3.2 mil kg";
                        result.dcv = 10;
                        result.perception = 10;
                        result.tall = "64";
                        result.wide = "32";
                        break;
                    case "COLOSSAL":
                        result.str = 90;
                        result.con = 30;
                        result.pre = 30;
                        result.pd = 18;
                        result.ed = 18;
                        result.body = 18;
                        result.stun = 36;
                        result.reach = 63;
                        result.running = 72;
                        result.kb = 36;
                        result.mass = "3.3-25.6 mil kg";
                        result.dcv = 12;
                        result.perception = 12;
                        result.tall = "128";
                        result.wide = "64";
                        break;
                    default:
                        console.warn("Unknown GROWTH OPTIONID", item);
                        break;
                }
                return result;
            },
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        value = this.details(actorItemDefense).pd;
                        break;
                    case "ED":
                        value = this.details(actorItemDefense).ed;
                        break;
                    case "KB":
                        value = this.details(actorItemDefense).kb;
                        break;
                }
                if (value > 0) {
                    const newOptions = foundry.utils.deepClone(options);
                    newOptions.operation = "add";
                    newOptions.knockback = value * 2;
                    return createDefenseProfile(actorItemDefense, attackItem, value, newOptions);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="GROWTH" ID="1711934263926" BASECOST="25.0" LEVELS="0" ALIAS="Growth" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LARGE" OPTIONID="LARGE" OPTION_ALIAS="Large" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            details: function (item) {
                const result = {
                    str: parseInt(item.system.value) * 5,
                    body: parseInt(item.system.value),
                    stun: parseInt(item.system.value),
                    reach: Math.pow(2, Math.floor(item.system.value / 3)),
                    kb: parseInt(item.system.value),
                    mass: (Math.pow(2, item.system.value) * 100).toLocaleString() + " kg",
                    dcv: 2 * Math.floor(item.system.value / 3),
                    perception: 2 * Math.floor(item.system.value / 3),
                    tall: Math.pow(2, Math.floor(item.system.value / 3)) * 2,
                    wide: Math.pow(2, Math.floor(item.system.value / 3)),
                };
                return result;
            },
        },
    );

    addPower(
        {
            key: "HANDTOHANDATTACK",
            type: ["attack"],
            behaviors: [], // NOTE: Added to STR and not an attack of its own.
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: true,
            usesStrength: true,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="HANDTOHANDATTACK" ID="1711934318209" BASECOST="0.0" LEVELS="1" ALIAS="Hand-To-Hand Attack" POSITION="48" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            <NOTES />
            <MODIFIER XMLID="HANDTOHANDATTACK" ID="1711934557552" BASECOST="-0.25" LEVELS="0" ALIAS="Hand-To-Hand Attack" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
              <NOTES />
            </MODIFIER>
          </POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "HEALING",
            type: ["adjustment"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target's dcv",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: true,
            hasNoDefense: true,
            costPerLevel: fixedValueFunction(10),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="HEALING" ID="1711934391072" BASECOST="0.0" LEVELS="1" ALIAS="Healing" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "HKA",
            type: ["attack"],
            behaviors: ["to-hit", "dice"],
            duration: "instant",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costPerLevel: fixedValueFunction(15),
            costEnd: true,
            usesStrength: true,
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(true),
            xml: `<POWER XMLID="HKA" ID="1711934431692" BASECOST="0.0" LEVELS="1" ALIAS="Killing Attack - Hand-To-Hand" POSITION="52" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "IMAGES",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["activatable", "to-hit", "dice"],
            costPerLevel: fixedValueFunction(3),
            perceivability: "obvious",
            duration: "constant",
            target: "area (see text)",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="IMAGES" ID="1711934509070" BASECOST="10.0" LEVELS="0" ALIAS="Images" POSITION="50" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "INVISIBILITY",
            type: ["sense-affecting", "standard"],
            behaviors: ["activatable", "defense", "defaultoff"],
            costPerLevel: fixedValueFunction(0),
            perceivability: "Special",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            defenseTagVsAttack: function () {
                // Not really sure when this would be part of a defense
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="INVISIBILITY" ID="1711934550291" BASECOST="20.0" LEVELS="0" ALIAS="Invisibility" POSITION="51" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "KBRESISTANCE",
            type: ["defense", "standard"],
            behaviors: ["activatable", "defense"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "KB":
                        value = (parseInt(actorItemDefense.adjustedLevels) || 0) * (actorItemDefense.is5e ? 2 : 1);
                        break;
                }
                if (value > 0) {
                    return createDefenseProfile(actorItemDefense, attackItem, value, options);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="KBRESISTANCE" ID="1709333943639" BASECOST="0.0" LEVELS="1" ALIAS="Knockback Resistance" POSITION="54" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );

    addPower(undefined, {
        key: "LACKOFWEAKNESS",
        type: ["defense", "special"],
        behaviors: ["activatable", "defense"],
        perceivability: "imperceptible",
        duration: "persistent",
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        costEnd: false,
        costPerLevel: fixedValueFunction(1),
        defenseTagVsAttack: function () {
            // Not really sure when this would be part of a defense
            return null;
        },
        baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        xml: `<POWER XMLID="LACKOFWEAKNESS" ID="1709342664430" BASECOST="0.0" LEVELS="1" ALIAS="Lack Of Weakness" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Mental Defense" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
    });
    addPower(
        {
            key: "LIFESUPPORT",
            type: ["standard"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            defenseTagVsAttack: function () {
                // Only vs AVAD, which is poorly supported
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="LIFESUPPORT" ID="1711934628815" BASECOST="0.0" LEVELS="0" ALIAS="Life Support" POSITION="56" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "LUCK",
            type: ["special"],
            behaviors: ["dice"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            usesStrength: false,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="LUCK" ID="1709333951260" BASECOST="0.0" LEVELS="1" ALIAS="Luck" POSITION="57" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "MENTALDEFENSE",
            type: ["defense", "special"],
            behaviors: ["activatable", "defense"],
            perceivability: "imperceptible",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            duration: "persistent",
            costPerLevel: fixedValueFunction(1),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "MD":
                        value = parseInt(actorItemDefense.adjustedLevels) || 0;
                        break;
                }
                if (value > 0) {
                    // 5e gets a bonus
                    if (actorItemDefense.actor?.is5e) {
                        const bonus = RoundFavorPlayerUp(
                            parseInt(actorItemDefense.actor.system.characteristics.ego.value) / 5 || 0,
                        );
                        value += bonus;
                    }
                    return createDefenseProfile(actorItemDefense, attackItem, value, options);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="MENTALDEFENSE" ID="1709333957464" BASECOST="0.0" LEVELS="1" ALIAS="Mental Defense" POSITION="59" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MENTALILLUSIONS",
            type: ["attack", "mental"],
            behaviors: ["activatable", "to-hit", "dice"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "dmcv",
            range: HERO.RANGE_TYPES.LINE_OF_SIGHT,
            costEnd: true,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="MENTALILLUSIONS" ID="1709333959742" BASECOST="0.0" LEVELS="1" ALIAS="Mental Illusions" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MINDCONTROL",
            type: ["attack", "mental"],
            behaviors: ["activatable", "to-hit", "dice"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "dmcv",
            range: HERO.RANGE_TYPES.LINE_OF_SIGHT,
            costEnd: true,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="MINDCONTROL" ID="1709333962182" BASECOST="0.0" LEVELS="1" ALIAS="Mind Control" POSITION="61" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MINDLINK",
            type: ["mental"],
            behaviors: ["activatable", "to-hit"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "dmcv",
            range: HERO.RANGE_TYPES.LINE_OF_SIGHT,
            costEnd: false,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="MINDLINK" ID="1709333964463" BASECOST="5.0" LEVELS="0" ALIAS="Mind Link" POSITION="62" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="One Specific Mind" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MINDSCAN",
            type: ["mental", "sense"],
            behaviors: ["activatable", "to-hit", "dice"],
            perceivability: "imperceptible",
            duration: "constant",
            target: "dmcv",
            range: HERO.RANGE_TYPES.SPECIAL,
            costEnd: true,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="MINDSCAN" ID="1709333966801" BASECOST="0.0" LEVELS="1" ALIAS="Mind Scan" POSITION="63" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MISSILEDEFLECTION",
            type: ["defense", "standard"],
            behaviors: ["activatable", "defense", "to-hit"],
            costPerLevel: fixedValueFunction(0),
            perceivability: "inobvious",
            duration: "instant",
            target: "target’s OCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="MISSILEDEFLECTION" ID="1709333871556" BASECOST="20.0" LEVELS="0" ALIAS="Deflection" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            duration: "constant",
            costEnd: false,
            xml: `<POWER XMLID="MISSILEDEFLECTION" ID="1709342687977" BASECOST="5.0" LEVELS="0" ALIAS="Missile Deflection" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="THROWN" OPTIONID="THROWN" OPTION_ALIAS="Thrown Objects" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
    );
    addPower(
        {
            key: "MULTIFORM",
            type: ["body-affecting", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1 / 5),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="MULTIFORM" ID="1709333969596" BASECOST="0.0" LEVELS="50" ALIAS="Multiform" POSITION="64" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "NAKEDMODIFIER",
            type: ["special"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            cost: function (/* item */) {
                return 0;
            },
            activePoints: function (item) {
                const _levels = parseInt(item.system?.LEVELS || 0);
                return RoundFavorPlayerDown(_levels * (1 + item._advantageCost) - _levels);
            },
            realCost: function (item) {
                // Real Cost = Active Cost / (1 + total value of all Limitations)
                let _cost = item._activePoints;

                // Need to be careful about NAKEDMODIFIER PRIVATE (part of cost) vs !PRIVATE (part of naked limitation)
                // Considering moving this into CONFIG.MJS, but need to see if this applies anywhere else.
                // Would be nice to have something generic to handle all cases
                let _limitationCost = item._limitationCost;
                if (item.system.XMLID === "NAKEDMODIFIER") {
                    _limitationCost = 0;
                    for (const limitation of item.limitations.filter((o) => o.PRIVATE)) {
                        _limitationCost -= limitation.cost;
                    }
                }

                // Unclear why we use FLOOR here instead of RoundDownPlayerFavor.  But trying to match HD.
                _cost = Math.floor(_cost / (1 + _limitationCost));
                return _cost;
            },
            privateAsAdder: true,
            defenseTagVsAttack: function () {
                // Not really sure when this would be part of a defense
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="NAKEDMODIFIER" ID="1709333972540" BASECOST="0.0" LEVELS="1" ALIAS="Naked Advantage" POSITION="65" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOHITLOCATIONS",
            type: ["automaton"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(0),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="NOHITLOCATIONS" ID="1709333986337" BASECOST="10.0" LEVELS="0" ALIAS="No Hit Locations" POSITION="66" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        undefined,
    );

    addPower(
        {
            key: "PARTIALLYPENETRATIVE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(0),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="PARTIALLYPENETRATIVE" ID="1738470412569" BASECOST="10.0" LEVELS="0" ALIAS="Partially Penetrative" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "PENETRATIVE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(0),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="PENETRATIVE" ID="1738469314018" BASECOST="15.0" LEVELS="0" ALIAS="Penetrative" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "POSSESSION",
            type: ["attack", "mental"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "constant",
            target: "DMCV",
            range: HERO.RANGE_TYPES.LINE_OF_SIGHT,
            costEnd: true,
            costPerLevel: fixedValueFunction(0),
            unusualDicePerDc: true,
            baseEffectDicePartsBundle: (item) => {
                const mindControlEffectAdder = item.system.ADDER.find((adder) => adder.XMLID === "MINDCONTROLEFFECT");
                const extraMindControlEffect = parseInt(mindControlEffectAdder?.LEVELS) || 0;
                const diceParts = {
                    dc: item.dcRaw,
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: 40 + extraMindControlEffect,
                };
                return defaultPowerDicePartsBundle(item, diceParts);
            },
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="POSSESSION" ID="1711934925655" BASECOST="60.0" LEVELS="0" ALIAS="Possession" POSITION="67" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Human" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            <NOTES />
            <ADDER XMLID="MINDCONTROLEFFECT" ID="1711935222251" BASECOST="0.0" LEVELS="0" ALIAS="+0 Points of Mind Control effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="TELEPATHYEFFECT" ID="1711935222252" BASECOST="0.0" LEVELS="0" ALIAS="+0 Points of Telepathy effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES">
              <NOTES />
            </ADDER>
          </POWER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "POWERDEFENSE",
            type: ["defense", "special"],
            behaviors: ["activatable", "defense"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "POWERDEFENSE":
                        value = actorItemDefense.adjustedLevels;
                        break;
                }
                if (value > 0) {
                    return createDefenseProfile(actorItemDefense, attackItem, value, options);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="POWERDEFENSE" ID="1709333995936" BASECOST="0.0" LEVELS="1" ALIAS="Power Defense" POSITION="68" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "REFLECTION",
            type: ["attack", "standard"],
            behaviors: ["to-hit", "activatable"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(2 / 3),
            cost: function (item) {
                // 2 CP per 3 Active Points
                const levels = parseInt(item.system?.LEVELS || 0);
                return Math.ceil((levels * this.costPerLevel()) / 3) * 2;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            descriptionFactory: function (item) {
                return `${item.system.ALIAS} (${parseInt(item.system?.LEVELS || 0)} Active Points' worth)`;
            },
            xml: `<POWER XMLID="REFLECTION" ID="1709333998486" BASECOST="0.0" LEVELS="1" ALIAS="Reflection" POSITION="69" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "REGENERATION",
            type: ["special"],
            behaviors: ["activatable"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: false,
            defenseTagVsAttack: function () {
                // Not really sure when this would be part of a defense
                return null;
            },
            costPerLevel: fixedValueFunction(0),
            unusualDicePerDc: true,
            baseEffectDicePartsBundle: (item) => {
                const diceParts = {
                    dc: item.dcRaw,
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: parseInt(item.adjustedLevels || 0),
                };
                return defaultPowerDicePartsBundle(item, diceParts);
            },
            xml: `<POWER XMLID="REGENERATION" ID="1709334000761" BASECOST="0.0" LEVELS="1" ALIAS="Regeneration" POSITION="70" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="WEEK" OPTIONID="WEEK" OPTION_ALIAS="Week" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "RKA",
            type: ["attack"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.STANDARD,
            costPerLevel: fixedValueFunction(15),
            costEnd: true,
            usesStrength: true,
            sheet: {
                INPUT: {
                    label: "Vs.",
                    selectOptions: {
                        ED: "ED",
                        PD: "PD",
                    },
                },
            },
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(true),
            xml: `<POWER XMLID="RKA" ID="1711934450257" BASECOST="0.0" LEVELS="1" ALIAS="Killing Attack - Ranged" POSITION="53" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "SHAPESHIFT",
            type: ["body-affecting"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="SHAPESHIFT" ID="1711935061472" BASECOST="8.0" LEVELS="0" ALIAS="Shape Shift" POSITION="73" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "SHRINKING",
            type: ["body-affecting", "size"],
            behaviors: ["activatable", "defense"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(6),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                switch (options.attackDefenseVs) {
                    case "KB":
                        value = -(parseInt(actorItemDefense.adjustedLevels) || 0) * (this.is5e ? 3 : 6);
                        break;
                }
                if (value != 0) {
                    return createDefenseProfile(actorItemDefense, attackItem, value, options);
                }
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="SHRINKING" ID="1709334010424" BASECOST="0.0" LEVELS="1" ALIAS="Shrinking" POSITION="74" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        { costPerLevel: fixedValueFunction(10) },
    );
    addPower(
        {
            key: "STRETCHING",
            type: ["body-affecting", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            defenseTagVsAttack: function () {
                // Not really sure when this would be part of a defense
                return null;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="STRETCHING" ID="1709334014434" BASECOST="0.0" LEVELS="1" ALIAS="Stretching" POSITION="75" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        { costPerLevel: fixedValueFunction(5) },
    );
    addPower(
        undefined, //BOOST is not a valid 6e XMLID (it is now AID)
        {
            key: "SUCCOR",
            type: ["adjustment"],
            behaviors: ["to-hit", "dice"],
            duration: "constant",
            target: "target's DCV",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costEnd: true,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="SUCCOR" ID="1709342717305" BASECOST="0.0" LEVELS="5" ALIAS="Succor" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="END" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
    );
    addPower(
        {
            key: "SUMMON",
            type: ["standard"],
            behaviors: ["activatable"],
            duration: "instant",
            target: "n/a",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1 / 5),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="SUMMON" ID="1709334017073" BASECOST="0.0" LEVELS="1" ALIAS="Summon" POSITION="76" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SUPPRESS",
        type: ["adjustment", "attack"],
        behaviors: ["to-hit", "dice"],
        perceivability: "obvious",
        duration: "constant",
        target: "target’s DCV",
        range: HERO.RANGE_TYPES.STANDARD,
        costEnd: true,
        costPerLevel: fixedValueFunction(5),
        baseEffectDicePartsBundle: standardBaseEffectDiceParts,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<POWER XMLID="SUPPRESS" ID="1709342722293" BASECOST="0.0" LEVELS="1" ALIAS="Suppress" POSITION="62" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="SPD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
    });

    addPower(
        {
            key: "TELEKINESIS",
            type: ["attack", "standard"],
            behaviors: ["to-hit", "dice", "activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "target’s DCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costEnd: true,
            usesStrength: false,
            costPerLevel: fixedValueFunction(3 / 2),
            unusualDicePerDc: true,
            baseEffectDicePartsBundle: (item, options) => {
                // The damage for TELEKINESIS is based on STR.
                // Each LEVEL of TELEKINESIS is equal to 1 point of STR.
                const str =
                    options.effectiveStr != undefined
                        ? parseInt(options.effectiveStr)
                        : parseInt(item.adjustedLevels || 0);

                return defaultPowerDicePartsBundle(item, characteristicValueToDiceParts(str));
            },
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="TELEKINESIS" ID="1709334027228" BASECOST="0.0" LEVELS="2" ALIAS="Telekinesis" POSITION="79" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "TELEPATHY",
            type: ["mental"],
            behaviors: ["to-hit", "dice"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "dmcv",
            range: HERO.RANGE_TYPES.LINE_OF_SIGHT,
            costEnd: true,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="TELEPATHY" ID="1709334029488" BASECOST="0.0" LEVELS="1" ALIAS="Telepathy" POSITION="80" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "TRANSFER",
        type: ["adjustment", "attack"],
        behaviors: ["to-hit", "dice"],
        perceivability: "obvious",
        duration: "instant",
        target: "target's DCV",
        range: HERO.RANGE_TYPES.NO_RANGE,
        costEnd: true,
        costPerLevel: fixedValueFunction(15),
        baseEffectDicePartsBundle: standardBaseEffectDiceParts,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<POWER XMLID="TRANSFER" ID="1709342746179" BASECOST="0.0" LEVELS="1" ALIAS="Transfer" POSITION="70" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="STR -&gt; CON" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
    });
    addPower(
        {
            key: "TRANSFORM",
            type: ["attack", "standard"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target's DCV",
            range: HERO.RANGE_TYPES.STANDARD,
            costPerLevel: function (item) {
                // item appears to be an adder in some cases
                switch (item.system?.OPTIONID || item.OPTIONID) {
                    case "COSMETIC":
                        return item.is5e ? 5 : 3;
                    case "MINOR":
                        return item.is5e ? 10 : 5;
                    case "MAJOR":
                        return item.is5e ? 15 : 10;
                    case "SEVERE":
                        return 15;
                }
                // This should never happen
                console.error(`Invalid TRANSFORM option ID: ${item.system.OPTIONID}`);
                return 1;
            },
            costEnd: true,
            usesStrength: false,
            attackDefenseVs: "POWERDEFENSE",
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="TRANSFORM" ID="1709334039303" BASECOST="0.0" LEVELS="1" ALIAS="Transform" POSITION="84" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COSMETIC" OPTIONID="COSMETIC" OPTION_ALIAS="Cosmetic" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
})();

(function addFakePowersToPowerList() {
    // A fake power that can be used for internal placeholders
    addPower(
        {
            key: "__STRENGTHDAMAGE",
            type: ["attack"],
            behaviors: ["non-hd", "to-hit", "dice"],
            perceivability: "obvious",
            duration: "instant",
            range: HERO.RANGE_TYPES.STANDARD,
            costPerLevel: fixedValueFunction(5),
            costEnd: true,
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="__STRENGTHDAMAGE" ID="1709333792635" BASECOST="0.0" LEVELS="1" ALIAS="__InternalStrengthPlaceholder" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
})();

(function addMartialToPowerList() {
    addPower(
        {
            key: "EXTRADC",
            type: ["martial"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(4),
        },
        {},
    );

    addPower(
        {
            key: "MANEUVER",
            type: ["martial", "attack"], // TODO: Not all of these are attacks
            behaviors: ["to-hit", "dice"], // TODO: Not all of these are attacks or do damage
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costEnd: true,
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
        },
        {},
    );

    addPower(
        {
            key: "RANGEDDC",
            type: ["martial"],
            behaviors: [],
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(4),
        },
        {},
    );

    addPower(
        {
            key: "WEAPON_ELEMENT",
            type: ["martial"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            categorized: true,
        },
        {},
    );
})();

(function addSensesToPowerList() {
    addPower(
        {
            key: "ACTIVESONAR",
            type: ["sense", "active"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        {},
    );
    addPower(
        {
            key: "ADJACENTFIXED",
            type: ["sense"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        undefined,
    );
    addPower(
        {
            key: "ADJACENT",
            type: ["sense"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        undefined,
    );
    addPower(
        {
            key: "ANALYZESENSE",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        {},
    );

    addPower(
        {
            key: "CONCEALED",
            type: ["sense"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        {},
    );

    addPower(
        {
            key: "DETECT",
            type: ["sense", "passive"],
            behaviors: ["activatable", "adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.NO_RANGE,
            costPerLevel: fixedValueFunction(1),
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALSINGLE",
            type: ["sense"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALGROUP",
            type: ["sense"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALALL",
            type: ["sense"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        {},
    );
    addPower(
        {
            key: "DISCRIMINATORY",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(1),
        },
        {},
    );

    addPower(
        {
            key: "ENHANCEDPERCEPTION",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: "persistent", // Enhanced Senses are typically persistent
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(3),
            xml: `<POWER XMLID="ENHANCEDPERCEPTION" ID="1738452641594" BASECOST="0.0" LEVELS="1" ALIAS="Enhanced Perception" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="all Sense Groups" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "HRRP", // High Range Radio Perception
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn", "transmitBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );

    addPower(
        {
            key: "INCREASEDARC240",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "INCREASEDARC360",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "INFRAREDPERCEPTION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "#ff9999",  // washes out sewer tiles.  May need to create a custom visionMode.
            },
        },
        {},
    );

    addPower(
        {
            key: "MAKEASENSE",
            type: ["sense"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "MENTALAWARENESS",
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            senseGroup: "mental",
            senseType: "passive",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "MICROSCOPIC",
            type: ["sense"],
            duration: "persistent", // Enhanced Senses are typically persistent
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(3),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );

    addPower(
        {
            key: "NIGHTVISION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: null,
                //color: "aaaaff",
            },
        },
        {},
    );
    addPower(
        {
            key: "NRAYPERCEPTION",
            type: ["senseBuiltIn", "rangeBuiltIn"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );

    addPower(
        {
            key: "PARTIALLYPENETRATIVE",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<ADDER XMLID="PARTIALLYPENETRATIVE" ID="1737917249842" BASECOST="5.0" LEVELS="0" ALIAS="Partially Penetrative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "PENETRATIVE",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<ADDER XMLID="PENETRATIVE" ID="1737574847298" BASECOST="10.0" LEVELS="0" ALIAS="Penetrative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // DAMAGENEGATION related
            key: "PHYSICAL",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(5),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<ADDER XMLID="PHYSICAL" ID="1738019507454" BASECOST="0.0" LEVELS="1" ALIAS="Physical DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
            </ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "RADAR",
            type: ["sense", "active"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "RADIOPERCEIVETRANSMIT",
            type: ["sense", "active"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "RADIOPERCEPTION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "RANGE",
            type: ["sense"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.STANDARD,
            xml: `<POWER XMLID="RANGE" ID="1746309807411" BASECOST="10.0" LEVELS="0" ALIAS="Range" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SMELLGROUP" OPTIONID="SMELLGROUP" OPTION_ALIAS="Smell/Taste Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "RAPID",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(3),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );

    addPower(
        {
            key: "SPATIALAWARENESS",
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "targetingBuiltIn", "penetrativeBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );

    addPower(
        {
            key: "TARGETINGSENSE",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "TELESCOPIC",
            type: ["sense"],
            behaviors: ["adder"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(1 / 2),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "TRACKINGSENSE",
            type: ["sense", "passive"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );
    addPower(
        {
            key: "TRANSMIT",
            type: ["sense", "active"],
            behaviors: [],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
        },
        {},
    );

    addPower(
        {
            key: "ULTRASONICPERCEPTION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "ffaaff",
            },
        },
        {},
    );
    addPower(
        {
            key: "ULTRAVIOLETPERCEPTION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: "persistent", // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "7F00FF",
            },
        },
        {},
    );
})();

(function addComplicationsToPowerList() {
    addPower(
        {
            key: "ACCIDENTALCHANGE",
            type: ["disadvantage"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="ACCIDENTALCHANGE" ID="1709445721979" BASECOST="0.0" LEVELS="0" ALIAS="Accidental Change" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="CHANCETOCHANGE" ID="1709447132729" BASECOST="0.0" LEVELS="0" ALIAS="Chance To Change" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INFREQUENT" OPTIONID="INFREQUENT" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="CIRCUMSTANCES" ID="1709447132735" BASECOST="5.0" LEVELS="0" ALIAS="Circumstances" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "GENERICDISADVANTAGE",
            type: ["disadvantage"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="GENERICDISADVANTAGE" ID="1709445725246" BASECOST="0.0" LEVELS="0" ALIAS="Custom Complication" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "DEPENDENCE",
            type: ["disadvantage"],
            behaviors: ["activatable", "dice"],
            costPerLevel: fixedValueFunction(5), // NOTE: Doesn't use LEVELS but this helps our DC calculations
            unusualDicePerDc: true,
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            baseEffectDicePartsBundle: (item) => {
                let numDice = 0;

                const diceAdder = item.system.ADDER?.find((adder) => adder.XMLID === "EFFECT");
                if (diceAdder) {
                    // OPTIONID is something like "1d6"
                    const matchArray = diceAdder.OPTIONID.match(/([0-9]+)d6/i);
                    if (matchArray?.length === 2) {
                        numDice = parseInt(matchArray[1]);
                    }
                }

                const diceParts = {
                    dc: item.dcRaw,
                    d6Count: numDice,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: 0,
                };
                return defaultPowerDicePartsBundle(item, diceParts);
            },
            doesKillingDamage: fixedValueFunction(false),
            xml: `<DISAD XMLID="DEPENDENCE" ID="1709445727918" BASECOST="0.0" LEVELS="0" ALIAS="Dependence" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="EFFECT" ID="1709447139841" BASECOST="5.0" LEVELS="0" ALIAS="Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DAMAGE1D6" OPTIONID="DAMAGE1D6" OPTION_ALIAS="Takes 1d6 Damage" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="SUBSTANCE" ID="1709447139849" BASECOST="5.0" LEVELS="0" ALIAS="Dependent Substance Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYCOMMON" OPTIONID="VERYCOMMON" OPTION_ALIAS="(Very Common" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="TIME" ID="1709447139865" BASECOST="25.0" LEVELS="0" ALIAS="Time Before Suffering Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SEGMENT" OPTIONID="SEGMENT" OPTION_ALIAS="1 Segment" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );
    addPower(
        {
            key: "DEPENDENTNPC",
            type: ["disadvantage"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="DEPENDENTNPC" ID="1709445730914" BASECOST="0.0" LEVELS="0" ALIAS="Dependent NPC" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="APPEARANCE" ID="1709520563048" BASECOST="10.0" LEVELS="0" ALIAS="Appearance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11ORLESS" OPTIONID="11ORLESS" OPTION_ALIAS="Frequently" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="USEFULNESS" ID="1709520563055" BASECOST="10.0" LEVELS="0" ALIAS="Usefulness" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INCOMPENTENT" OPTIONID="INCOMPENTENT" OPTION_ALIAS="(Incompetent" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );
    addPower(
        {
            key: "DISTINCTIVEFEATURES",
            type: ["disadvantage"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="DISTINCTIVEFEATURES" ID="1709445733944" BASECOST="0.0" LEVELS="0" ALIAS="Distinctive Features" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="CONCEALABILITY" ID="1709447147069" BASECOST="5.0" LEVELS="0" ALIAS="Concealability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EASILY" OPTIONID="EASILY" OPTION_ALIAS="(Easily Concealed" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="REACTION" ID="1709447147075" BASECOST="0.0" LEVELS="0" ALIAS="Reaction" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NOTICED" OPTIONID="NOTICED" OPTION_ALIAS="Noticed and Recognizable" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="SENSING" ID="1709447147081" BASECOST="0.0" LEVELS="0" ALIAS="Sensing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMMON" OPTIONID="COMMON" OPTION_ALIAS="Detectable By Commonly-Used Senses" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "ENRAGED",
            type: ["disadvantage"],
            behaviors: ["success"],
            target: "self only",
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="ENRAGED" ID="1709445736756" BASECOST="0.0" LEVELS="0" ALIAS="Enraged" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="CIRCUMSTANCES" ID="1709447150493" BASECOST="5.0" LEVELS="0" ALIAS="Circumstance is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="CHANCETOGO" ID="1709447150499" BASECOST="0.0" LEVELS="0" ALIAS="Chance To Become Enraged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8-" OPTIONID="8-" OPTION_ALIAS="go 8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="CHANCETORECOVER" ID="1709447150505" BASECOST="0.0" LEVELS="0" ALIAS="Chance To Recover" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14-" OPTIONID="14-" OPTION_ALIAS="recover 14-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "HUNTED",
            type: ["disadvantage"],
            behaviors: ["success"],
            name: "Hunted",
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="HUNTED" ID="1709445739393" BASECOST="0.0" LEVELS="0" ALIAS="Hunted" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="APPEARANCE" ID="1709520541014" BASECOST="10.0" LEVELS="0" ALIAS="Appearance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FOURTEEN" OPTIONID="FOURTEEN" OPTION_ALIAS="Very Frequently" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="CAPABILITIES" ID="1709520541020" BASECOST="5.0" LEVELS="0" ALIAS="Capabilities" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LESS" OPTIONID="LESS" OPTION_ALIAS="(Less Pow" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="MOTIVATION" ID="1709520541026" BASECOST="0.0" LEVELS="0" ALIAS="Motivation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HARSH" OPTIONID="HARSH" OPTION_ALIAS="Harshly Punish" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );

    addPower(undefined, {
        key: "MONEYDISAD",
        type: ["disadvantage"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0), // TODO: needs function
        target: "self only",
        range: HERO.RANGE_TYPES.SELF,
        xml: `<DISAD XMLID="MONEYDISAD" ID="1709445487703" BASECOST="0.0" LEVELS="0" ALIAS="Money" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
        <NOTES />
        <ADDER XMLID="LEVEL" ID="1709446860228" BASECOST="5.0" LEVELS="0" ALIAS="Income Level" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="POOR" OPTIONID="POOR" OPTION_ALIAS="Poor" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
        <NOTES />
        </ADDER>
        </DISAD>`,
    });

    addPower(
        {
            key: "PHYSICALLIMITATION",
            type: ["disadvantage"],
            behaviors: [],
            name: "Physical Limitation",
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="PHYSICALLIMITATION" ID="1709445747301" BASECOST="0.0" LEVELS="0" ALIAS="Physical Complication" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="OCCURS" ID="1709447162723" BASECOST="5.0" LEVELS="0" ALIAS="Limitation Occurs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INFREQUENTLY" OPTIONID="INFREQUENTLY" OPTION_ALIAS="(Infrequently" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="IMPAIRS" ID="1709447162730" BASECOST="0.0" LEVELS="0" ALIAS="Limitation Impairs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BARELY" OPTIONID="BARELY" OPTION_ALIAS="Barely Impairing" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );
    addPower(
        {
            key: "PSYCHOLOGICALLIMITATION",
            type: ["disadvantage"],
            behaviors: ["success"],
            name: "Psychological Limitation",
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="PSYCHOLOGICALLIMITATION" ID="1709445750394" BASECOST="0.0" LEVELS="0" ALIAS="Psychological Complication" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="SITUATION" ID="1709447166353" BASECOST="5.0" LEVELS="0" ALIAS="Situation Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="INTENSITY" ID="1709447166359" BASECOST="0.0" LEVELS="0" ALIAS="Intensity Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MODERATE" OPTIONID="MODERATE" OPTION_ALIAS="Moderate" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "REPUTATION",
            type: ["disadvantage"],
            behaviors: [],
            name: "Negative Reputation",
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="REPUTATION" ID="1738534326877" BASECOST="0.0" LEVELS="0" ALIAS="Negative Reputation" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <ADDER XMLID="RECOGNIZED" ID="1738534824035" BASECOST="5.0" LEVELS="0" ALIAS="Recognized" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SOMETIMES" OPTIONID="SOMETIMES" OPTION_ALIAS="Infrequently" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
            </ADDER>
            </DISAD>`,
        },
        {},
    );
    addPower(
        {
            key: "RIVALRY",
            type: ["disadvantage"],
            behaviors: [],
            name: "Rivalry",
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="RIVALRY" ID="1709445753501" BASECOST="0.0" LEVELS="0" ALIAS="Rivalry" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="SITUATION" ID="1709447170155" BASECOST="5.0" LEVELS="0" ALIAS="Rivalry Situation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PROFESSIONAL" OPTIONID="PROFESSIONAL" OPTION_ALIAS="Professional" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="DESCRIPTION" ID="1709447170159" BASECOST="0.0" LEVELS="0" ALIAS="Rivalry Desc." POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DEFAULT" OPTIONID="DEFAULT" OPTION_ALIAS="(" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="POWER" ID="1709447170166" BASECOST="-5.0" LEVELS="0" ALIAS="Rival's Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LESS" OPTIONID="LESS" OPTION_ALIAS="Rival is Less Powerful" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="FIERCENESS" ID="1709447170171" BASECOST="0.0" LEVELS="0" ALIAS="Fierceness of Rivalry" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OUTDO" OPTIONID="OUTDO" OPTION_ALIAS="Seek to Outdo, Embarrass, or Humiliate Rival" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="KNOWLEDGE" ID="1709447170176" BASECOST="0.0" LEVELS="0" ALIAS="Knowledge of Rivalry" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="AWARE" OPTIONID="AWARE" OPTION_ALIAS="Rival Aware of Rivalry" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "SOCIALLIMITATION",
            type: ["disadvantage"],
            behaviors: ["success"],
            name: "Social Limitation",
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="SOCIALLIMITATION" ID="1709445756212" BASECOST="0.0" LEVELS="0" ALIAS="Social Complication" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="OCCUR" ID="1709447173427" BASECOST="5.0" LEVELS="0" ALIAS="Circumstances Occur" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OCCASIONALLY" OPTIONID="OCCASIONALLY" OPTION_ALIAS="Infrequently" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="EFFECTS" ID="1709447173433" BASECOST="0.0" LEVELS="0" ALIAS="Effects of Restrictions" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINOR" OPTIONID="MINOR" OPTION_ALIAS="Minor" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );
    addPower(
        {
            key: "SUSCEPTIBILITY",
            type: ["disadvantage"],
            behaviors: ["dice"],
            name: "Susceptibility",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(5), // NOTE: Doesn't use LEVELS but this helps our DC calculations
            unusualDicePerDc: true,
            baseEffectDicePartsBundle: (item) => {
                let numDice = 0;

                const diceAdder = item.system.ADDER?.find((adder) => adder.XMLID === "DICE");
                if (diceAdder) {
                    // OPTIONID is something like "1d6"
                    const matchArray = diceAdder.OPTIONID.match(/([0-9]+)d6/i);
                    if (matchArray?.length === 2) {
                        numDice = parseInt(matchArray[1]);
                    }
                }

                const diceParts = {
                    dc: item.dcRaw,
                    d6Count: numDice,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: 0,
                };
                return defaultPowerDicePartsBundle(item, diceParts);
            },
            doesKillingDamage: fixedValueFunction(false),
            xml: `<DISAD XMLID="SUSCEPTIBILITY" ID="1709445759247" BASECOST="0.0" LEVELS="0" ALIAS="Susceptibility" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="DICE" ID="1709447177129" BASECOST="0.0" LEVELS="0" ALIAS="Number of Dice" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1D6" OPTIONID="1D6" OPTION_ALIAS="1d6 damage" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="DAMAGE" ID="1709447177142" BASECOST="0.0" LEVELS="0" ALIAS="Take Damage Every" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INSTANT" OPTIONID="INSTANT" OPTION_ALIAS="Instant" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="CONDITION" ID="1709447177148" BASECOST="5.0" LEVELS="0" ALIAS="Condition Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "UNLUCK",
            type: ["disadvantage"],
            behaviors: ["dice"],
            name: "Unluck",
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<DISAD XMLID="UNLUCK" ID="1709445762298" BASECOST="0.0" LEVELS="1" ALIAS="Unluck: 1d6" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "VULNERABILITY",
            type: ["disadvantage"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            range: HERO.RANGE_TYPES.SELF,
            xml: `<DISAD XMLID="VULNERABILITY" ID="1709445765160" BASECOST="0.0" LEVELS="0" ALIAS="Vulnerability" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="ATTACK" ID="1709447184025" BASECOST="5.0" LEVELS="0" ALIAS="The Attack Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </DISAD>`,
        },
        {},
    );
})();

(function addAddersToPowerList() {
    addPower(
        {
            // AOE related
            key: "ACCURATE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ACCURATE" ID="1737923445289" BASECOST="0.25" LEVELS="0" ALIAS="Accurate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRIGGER related
            key: "ACTIVATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ACTIVATION" ID="1735589362900" BASECOST="0.0" LEVELS="0" ALIAS="Activation Modifiers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ZEROPHASE" OPTIONID="ZEROPHASE" OPTION_ALIAS="Activating the Trigger requires a Zero Phase Action" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENTANGLE related
            key: "ADDITIONALPD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5 / 2),
            xml: `<ADDER XMLID="ADDITIONALPD" ID="1738019116299" BASECOST="0.0" LEVELS="1" ALIAS="+1 Additional PD" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENTANGLE related
            key: "ADDITIONALED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5 / 2),
            cost: function (adder, item) {
                // +5 CP per +2 defense (ADDITIONALPD or ADDITIONALED)
                const ADDITIONALPD = item.findModsByXmlid("ADDITIONALPD");
                const defenseLevels = parseInt(ADDITIONALPD?.LEVELS || 0) + parseInt(adder.LEVELS);
                const _combinedCost = defenseLevels * this.costPerLevel();
                const _cost = _combinedCost - (ADDITIONALPD?.cost || 0);
                return _cost;
            },
            xml: `<ADDER XMLID="ADDITIONALED" ID="1738019117629" BASECOST="0.0" LEVELS="1" ALIAS="+1 Additional ED" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "AFFECTSBOTH",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AFFECTSBOTH" ID="1735589942309" BASECOST="0.5" LEVELS="0" ALIAS="Affects Mental And Physical Attackers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "ART",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ART" ID="1740275769352" BASECOST="2.0" LEVELS="0" ALIAS="Art Objects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // BOECV related
        key: "ATTACKERCHOOSESDEFENSE",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="ATTACKERCHOOSESDEFENSE" ID="1735602821852" BASECOST="0.5" LEVELS="0" ALIAS="Attacker Chooses Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });

    addPower(undefined, {
        // Charges related
        // TODO: We don't presently have the ability for modifier adders to change the advantage DC of the attack and I'm not sure how that would happen but
        //       the 6e book does call this out as a possibility.
        key: "BOOSTABLE",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="BOOSTABLE" ID="1736721766918" BASECOST="0.25" LEVELS="0" ALIAS="Boostable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // Gestures related
            key: "BOTHHAND",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BOTHHAND" ID="1734110256180" BASECOST="-0.25" LEVELS="0" ALIAS="Requires both hands" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // ENRAGED  related
            key: "CHANCETOGO",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            optionIDFix: function (json) {
                return json.OPTION.match(/\d+-/)?.[0] || json.OPTION;
            },
            xml: ` <ADDER XMLID="CHANCETOGO" ID="1709447150499" BASECOST="0.0" LEVELS="0" ALIAS="Chance To Become Enraged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8-" OPTIONID="8-" OPTION_ALIAS="go 8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
        {
            // CHARGES related
            key: "CLIPS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CLIPS" ID="1737920256938" BASECOST="0.5" LEVELS="1" ALIAS="2 clips" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH related
            key: "COMBAT_SENSE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMBAT_SENSE" ID="1738457943820" BASECOST="5.0" LEVELS="0" ALIAS="Combat Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "COMMERCIALGOODS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMMERCIALGOODS" ID="1740275770321" BASECOST="2.0" LEVELS="0" ALIAS="Commercial Goods" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "CONTINUING",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CONTINUING" ID="1737922050463" BASECOST="0.5" LEVELS="0" ALIAS="Continuing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EXTRAPHASE" OPTIONID="EXTRAPHASE" OPTION_ALIAS="1 Extra Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // VPP related
            key: "CONTROLCOST",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0.5),
            xml: `<ADDER XMLID="CONTROLCOST" ID="1752275757727" BASECOST="0.0" LEVELS="6" ALIAS="Control Cost" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="No" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // INVISIBILITY related
            key: "DANGER_SENSE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DANGER_SENSE" ID="1738457617013" BASECOST="3.0" LEVELS="0" ALIAS="Danger Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // STRETCHING related
            key: "DIMENSIONS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<ADDER XMLID="DIMENSIONS" ID="1733644749271" BASECOST="0.0" LEVELS="4" ALIAS="x16 body dimension" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "DOCUMENTS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DOCUMENTS" ID="1740275768279" BASECOST="2.0" LEVELS="0" ALIAS="Documents" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "DOUBLEAREA",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(1 / 4),
        xml: `<ADDER XMLID="DOUBLEAREA" ID="1707272359920" BASECOST="0.0" LEVELS="1" ALIAS="x2 Radius" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            key: "DOUBLEHEIGHT",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1 / 4),
            // cost: function (adder) {
            //     const levels = parseInt(adder.LEVELS);
            //     const baseCost = parseFloat(adder.BASECOST);
            //     adder.BASECOST_total = baseCost + levels * 0.25;
            //     return adder.BASECOST_total;
            // },
            xml: `<ADDER XMLID="DOUBLEHEIGHT" ID="1707357448496" BASECOST="-0.5" LEVELS="3" ALIAS="Height (m)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "DOUBLELENGTH",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(1 / 4),
        // cost: function (adder) {
        //     const levels = parseInt(adder.LEVELS);
        //     const baseCost = parseFloat(adder.BASECOST);
        //     adder.BASECOST_total = baseCost + levels * 0.25;
        //     return adder.BASECOST_total;
        // },
        xml: `<ADDER XMLID="DOUBLELENGTH" ID="1731170688389" BASECOST="0.0" LEVELS="4" ALIAS="x16 Height" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            key: "DOUBLEWIDTH",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1 / 4),
            // cost: function (adder) {
            //     const levels = parseInt(adder.LEVELS);
            //     const baseCost = parseFloat(adder.BASECOST);
            //     adder.BASECOST_total = baseCost + levels * 0.25;
            //     return adder.BASECOST_total;
            // },
            xml: `<ADDER XMLID="DOUBLEWIDTH" ID="1707357449336" BASECOST="-0.5" LEVELS="3" ALIAS="Width (m)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // CHARGES related
        key: "BURNOUT",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="BURNOUT" ID="1707272379163" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });

    addPower(
        {
            // MINDSCAN efffects related
            key: "ECVBONUS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(2),
            xml: `<ADDER XMLID="ECVBONUS" ID="1738448289783" BASECOST="0.0" LEVELS="1" ALIAS="+1 OMCV" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="2.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSPARENT related
        key: "ED",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="ED" ID="1752359726494" BASECOST="0.5" LEVELS="0" ALIAS="ED" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // INVISIBLE power efffects related
            key: "EFFECTSTARGET",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EFFECTSTARGET" ID="1737919631438" BASECOST="0.0" LEVELS="0" ALIAS="Effects of Power on target" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DEFAULT" OPTIONID="DEFAULT" OPTION_ALIAS="[default/no change]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // INVISIBLE power efffects related
            key: "EFFECTSOTHER",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EFFECTSOTHER" ID="1737919631444" BASECOST="0.0" LEVELS="0" ALIAS="Effects of Power on other characters" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DEFAULT" OPTIONID="DEFAULT" OPTION_ALIAS="[default/no change]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGE ENVIRONMENT related
            key: "EGO",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="EGO" ID="1738458050930" BASECOST="0.0" LEVELS="1" ALIAS="-1 point of EGO" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DAMAGENEGATION related
            key: "ENERGY",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="ENERGY" ID="1738019507455" BASECOST="0.0" LEVELS="2" ALIAS="Energy DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "ENHANCEDPERCEPTION",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="ENHANCEDPERCEPTION" ID="1738452075059" BASECOST="0.0" LEVELS="1" ALIAS="+1 to PER Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRIGGER related
            key: "EXPIRE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EXPIRE" ID="1735590172478" BASECOST="-0.25" LEVELS="0" ALIAS="Trigger can expire (it has a time limit)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // AOE related
            key: "EXPLOSION",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<ADDER XMLID="EXPLOSION" ID="1738457272027" BASECOST="-0.5" LEVELS="0" ALIAS="Explosion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            key: "FIXEDSHAPE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1 / 4),
            xml: `<ADDER XMLID="FIXEDSHAPE" ID="1707357527471" BASECOST="-0.25" LEVELS="0" ALIAS="Fixed Shape" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSPARENT related
        key: "FLASHD",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="FLASHD" ID="1752364671800" BASECOST="0.25" LEVELS="0" ALIAS="Flash" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FORCEFIELD related
            key: "FLASHDEFENSE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(3 / 2),
            xml: `<ADDER XMLID="FLASHDEFENSE" ID="1736295402655" BASECOST="0.0" LEVELS="1" ALIAS="Flash Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(undefined, {
        // 5e adjustment related
        key: "INCREASEDMAX",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(1 / 2),
        cost: function (item) {
            const levels = parseInt(item.LEVELS || 0);
            return levels > 0 ? Math.ceil(levels / 2) : 0;
        },
        xml: `<ADDER XMLID="INCREASEDMAX" ID="1734826313991" BASECOST="0.0" LEVELS="3" ALIAS="Increased Maximum (+3 points)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // CLIPS related
            key: "INCREASEDRELOAD",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCREASEDRELOAD" ID="1737923202328" BASECOST="-0.25" LEVELS="0" ALIAS="Increased Reloading Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EXTRAPHASE" OPTIONID="EXTRAPHASE" OPTION_ALIAS="2 Full Phases" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DAMAGEOVERTIME related
            key: "INCREMENTS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCREMENTS" ID="1738534117222" BASECOST="0.25" LEVELS="0" ALIAS="Number of Damage Increments" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2" OPTIONID="2" OPTION_ALIAS="2" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MOVEMENT related
            key: "IMPROVEDNONCOMBAT",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="IMPROVEDNONCOMBAT" ID="1738018484005" BASECOST="0.0" LEVELS="1" ALIAS="x4 Noncombat" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ACTIVATIONROLL related
            key: "JAMMED",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="JAMMED" ID="1707272381673" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // VARIABLEADVANTAGE related
            key: "LIMITEDGROUP",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1 / 4),
            xml: `<ADDER XMLID="LIMITEDGROUP" ID="1735590835179" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Group of Advantages" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SKILL related?  Found on Julia (Red) Agusta.hdc
            key: "LIMITEDRANGE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LIMITEDRANGE" ID="1736301555959" BASECOST="0.25" LEVELS="0" ALIAS="Recipient must be within Limited Range of the Grantor for power to be granted" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "LIMITEDRECOVER",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LIMITEDRECOVER" ID="1729971742993" BASECOST="-0.5" LEVELS="0" ALIAS="Recovers after 2 Hours of Study" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // DAMAGENEGATION related
            key: "MENTAL",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="MENTAL" ID="1738019507456" BASECOST="0.0" LEVELS="3" ALIAS="Mental DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // POSSESSION related
            key: "MINDCONTROLEFFECT",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1 / 2),
            xml: `<ADDER XMLID="MINDCONTROLEFFECT" ID="1737915448080" BASECOST="0.0" LEVELS="20" ALIAS="+20 Points of Mind Control effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "MINUSONEPIP",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MINUSONEPIP" ID="1712344286624" BASECOST="10.0" LEVELS="0" ALIAS="+1d6 -1" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // TRIGGER related
            key: "MISFIRE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MISFIRE" ID="1735590175126" BASECOST="-0.25" LEVELS="0" ALIAS="Misfire" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(undefined, {
        // TRANSPARENT related
        key: "MD",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="MD" ID="1752364670270" BASECOST="0.25" LEVELS="0" ALIAS="Mental" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            key: "MOBILE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1 / 4),
            // cost: function (adder) {
            //     const levels = parseInt(adder.LEVELS);
            //     const baseCost = parseFloat(adder.BASECOST);
            //     adder.BASECOST_total = baseCost + Math.ceil(levels / 12) * 0.25;
            //     return adder.BASECOST_total;
            // },
            xml: `<ADDER XMLID="MOBILE" ID="1707357530522" BASECOST="0.25" LEVELS="1" ALIAS="Mobile" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FOCUS related
            key: "MOBILITY",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1 / 4),
            // cost: function (adder) {
            //     const levels = parseInt(adder.LEVELS);
            //     const baseCost = parseFloat(adder.BASECOST);
            //     adder.BASECOST_total = baseCost + Math.ceil(levels / 12) * 0.25;
            //     return adder.BASECOST_total;
            // },
            xml: `<ADDER XMLID="MOBILITY" ID="1737920494694" BASECOST="-0.25" LEVELS="0" ALIAS="Mobility" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ARRANGEMENT" OPTIONID="ARRANGEMENT" OPTION_ALIAS="Arrangement" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "MONEY",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MONEY" ID="1740275766578" BASECOST="2.0" LEVELS="0" ALIAS="Money (Counterfeiting)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // TRIGGER related
            key: "NOCONTROL",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOCONTROL" ID="1735590173007" BASECOST="-0.25" LEVELS="0" ALIAS="Character does not control activation of personal Trigger" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // EXTRATIME related
            key: "NOOTHERACTIONS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOOTHERACTIONS" ID="1737922655047" BASECOST="-0.25" LEVELS="0" ALIAS="Character May Take No Other Actions" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            key: "OBLIVIOUS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OBLIVIOUS" ID="1736008610985" BASECOST="-0.25" LEVELS="0" ALIAS="Character is totally unaware of nearby events" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // AUTOFIRE related
            key: "ODDPOWER",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ODDPOWER" ID="1735602855475" BASECOST="1.0" LEVELS="0" ALIAS="Non-Standard Attack Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "OTHER",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OTHER" ID="1740275781408" BASECOST="1.0" LEVELS="0" ALIAS="Other" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="extra specific" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "OTHERGENERAL",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OTHERGENERAL" ID="1740275771202" BASECOST="2.0" LEVELS="0" ALIAS="Other (General)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="extra general" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(undefined, {
        // TRANSPARENT related
        key: "PD",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="PD" ID="1752038825401" BASECOST="0.5" LEVELS="0" ALIAS="PD" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            key: "PLUSONEHALFDIE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PLUSONEHALFDIE" ID="1712342067007" BASECOST="3.0" LEVELS="0" ALIAS="+1/2 d6" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            key: "PLUSONEPIP",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PLUSONEPIP" ID="1712342367072" BASECOST="2.0" LEVELS="0" ALIAS="+1 pip" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSPARENT related
        key: "POWD",
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="POWD" ID="1752364713968" BASECOST="0.25" LEVELS="0" ALIAS="Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });

    addPower(
        {
            // DETECT related
            key: "RANGE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RANGE" ID="1746309597386" BASECOST="5.0" LEVELS="0" ALIAS="Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // BOECV related
            key: "RANGEMODSAPPLY",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RANGEMODSAPPLY" ID="1735602821851" BASECOST="-0.25" LEVELS="0" ALIAS="Range Modifiers Apply" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "RECOVERABLE",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RECOVERABLE" ID="1737924558549" BASECOST="0.5" LEVELS="0" ALIAS="Recoverable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRIGGER related
            key: "RESET",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RESET" ID="1735590169893" BASECOST="-0.5" LEVELS="0" ALIAS="Reset Parameters" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TURN" OPTIONID="TURN" OPTION_ALIAS="Trigger requires a Turn or more to reset" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // AOE/EXPLOSION related
            key: "SELECTIVETARGET",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SELECTIVETARGET" ID="1735841902155" BASECOST="0.25" LEVELS="0" ALIAS="Selective" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // POSSESSION related
            key: "TELEPATHYEFFECT",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(1 / 2),
            xml: `<ADDER XMLID="TELEPATHYEFFECT" ID="1737915448081" BASECOST="0.0" LEVELS="10" ALIAS="+10 Points of Telepathy effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DAMAGEOVERTIME related
            key: "TIMEBETWEEN",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TIMEBETWEEN" ID="1738534117245" BASECOST="2.0" LEVELS="0" ALIAS="damage occurs every" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SEGMENT" OPTIONID="SEGMENT" OPTION_ALIAS="Segment" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRIGGER related
            key: "THREECONDITIONS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THREECONDITIONS" ID="1735590174075" BASECOST="0.5" LEVELS="0" ALIAS="Three or more activation conditions apply simultaneously" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // TRIGGER related
            key: "TWOCONDITIONS",
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TWOCONDITIONS" ID="1735590466223" BASECOST="0.25" LEVELS="0" ALIAS="Two activation conditions apply simultaneously" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
})();

(function addModifiersToPowerList() {
    addPower(
        {
            key: "ABLATIVE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ABLATIVE" ID="1730531163233" BASECOST="-1.0" LEVELS="0" ALIAS="Ablative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BODYORSTUN" OPTIONID="BODYORSTUN" OPTION_ALIAS="BODY or STUN" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            // EXTRATIME related
            key: "ACTIVATEONLY",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            cost: function () {
                // TODO: HACK, should properly support this instead of hiding cost calc in EXTRATIME
                return 0;
            },
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ACTIVATEONLY" ID="1737920862488" BASECOST="-1.0" LEVELS="0" ALIAS="Only to Activate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "ACTIVATIONROLL",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ACTIVATIONROLL" ID="1707283846531" BASECOST="-0.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="15" OPTIONID="15" OPTION_ALIAS="15-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "ACV",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ACV" ID="1596334078859" BASECOST="0.0" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NONMENTALOMCV" OPTIONID="NONMENTALOMCV" OPTION_ALIAS="uses OMCV against DCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Typically part of SIDEEFFECTS
            key: "ALWAYSOCCURS",
            behaviors: ["modifier"],
            cost: function (heroModifier /*, item*/) {
                const sideEffectCost = parseFloat(
                    heroModifier.parent.XMLID === "SIDEEFFECTS" ? heroModifier.parent.BASECOST : 0,
                );

                // Always occurs doubles the cost (so this costs the same as the parent).
                return sideEffectCost;
            },
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ALWAYSOCCURS" ID="1743877800818" BASECOST="1.0" LEVELS="0" ALIAS="Side Effect occurs automatically whenever Power is used" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ALWAYSDIRECT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ALWAYSDIRECT" ID="1730530836005" BASECOST="-0.25" LEVELS="0" ALIAS="Always Direct" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ALWAYSON",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ALWAYSON" ID="1730531186125" BASECOST="-0.5" LEVELS="0" ALIAS="Always On" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // SUMMON related
            key: "AMICABLE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="AMICABLE" ID="1737923610788" BASECOST="0.25" LEVELS="0" ALIAS="Amicable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FRIENDLY" OPTIONID="FRIENDLY" OPTION_ALIAS="Friendly" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "AOE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            cost: function (modifier) {
                const levels = parseInt(modifier.LEVELS) || 0;
                let _cost = 0;
                switch (modifier.OPTIONID) {
                    case "RADIUS":
                        _cost = Math.max(1, Math.ceil(Math.log2(levels / 2))) * 0.25;
                        break;
                    case "CONE":
                        _cost = Math.max(1, Math.ceil(Math.log2(levels / 4))) * 0.25;
                        break;
                    case "LINE":
                        _cost = Math.max(1, Math.ceil(Math.log2(levels / 8))) * 0.25;
                        break;
                    case "SURFACE":
                        _cost = Math.max(1, Math.ceil(Math.log2(levels))) * 0.25;
                        break;
                    case "ANY":
                        _cost = Math.max(1, Math.ceil(Math.log2(levels))) * 0.25;
                        break;
                    default:
                        console.warn("Unknown OPTIONID", modifier);
                        _cost = 0;
                }

                return _cost;
            },
            dcAffecting: fixedValueFunction(true),
            editOptions: {
                choices: [
                    {
                        OPTIONID: "RADIUS",
                        OPTION: "RADIUS",
                        OPTION_ALIAS: "Radius",
                    },
                    { OPTIONID: "CONE", OPTION: "CONE", OPTION_ALIAS: "Cone" },
                    { OPTIONID: "LINE", OPTION: "LINE", OPTION_ALIAS: "Line" },
                    {
                        OPTIONID: "SURFACE",
                        OPTION: "SURFACE",
                        OPTION_ALIAS: "Surface",
                    },
                    {
                        OPTIONID: "ANY",
                        OPTION: "ANY",
                        OPTION_ALIAS: "Any Area",
                    },
                ],
            },
            xml: `<MODIFIER XMLID="AOE" ID="1712699305027" BASECOST="0.0" LEVELS="1" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {
            // 5e AOE cost is in BASECOST
            cost: undefined,
            editOptions: {
                hideLEVELS: true,
                choices: [
                    {
                        OPTIONID: "HEX",
                        OPTION: "HEX",
                        OPTION_ALIAS: "One Hex",
                        BASECOST: 0.5,
                    },
                    {
                        OPTIONID: "RADIUS",
                        OPTION: "RADIUS",
                        OPTION_ALIAS: "Radius",
                        BASECOST: 1,
                    },
                    {
                        OPTIONID: "CONE",
                        OPTION: "CONE",
                        OPTION_ALIAS: "Cone",
                        BASECOST: 1,
                    },
                    {
                        OPTIONID: "LINE",
                        OPTION: "LINE",
                        OPTION_ALIAS: "Line",
                        BASECOST: 1,
                    },
                    {
                        OPTIONID: "ANY",
                        OPTION: "ANY",
                        OPTION_ALIAS: "Any Area",
                        BASECOST: 1,
                    },
                ],
            },
            xml: `<MODIFIER XMLID="AOE" ID="1712699238358" BASECOST="1.0" LEVELS="0" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
    );
    addPower(
        {
            key: "ARMORPIERCING",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="ARMORPIERCING" ID="1712696642037" BASECOST="0.0" LEVELS="1" ALIAS="Armor Piercing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {
            costPerLevel: fixedValueFunction(1 / 2),
        },
    );
    addPower(
        {
            key: "AUTOFIRE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0), // FIXME: extra costs for AVLD and REDUCEDEND
            cost: function (modifier, item) {
                let cost = parseFloat(modifier.BASECOST);

                // If there a non standard power used then it costs an extra +1. This can happen from either having the
                // "ODDPOWER" declared or AVLD or NND as additional modifiers for the power.
                const oddPower = modifier.ADDER?.find((adder) => adder.XMLID === "ODDPOWER");
                if (oddPower) {
                    // ODDPOWER adder will capture this cost.
                } else if (item.findModsByXmlid("AVLD") || item.findModsByXmlid("NND")) {
                    cost += 1;
                }

                return cost;
            },
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="AUTOFIRE" ID="1713378198591" BASECOST="0.25" LEVELS="0" ALIAS="Autofire" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWO" OPTIONID="TWO" OPTION_ALIAS="2 Shots" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "AVAD",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="AVAD" ID="1737923097808" BASECOST="0.0" LEVELS="0" ALIAS="Attack Versus Alternate Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYVERY" OPTIONID="VERYVERY" OPTION_ALIAS="Very Common -&gt; Very Common" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "AVLD",
        behaviors: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(true),
        xml: `<MODIFIER XMLID="AVLD" ID="1735536296325" BASECOST="0.75" LEVELS="0" ALIAS="Attack Versus Limited Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "BEAM",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="BEAM" ID="1642201338928" BASECOST="-0.25" LEVELS="0" ALIAS="Beam" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(undefined, {
        key: "BOECV",
        behaviors: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(true),
        xml: `<MODIFIER XMLID="BOECV" ID="1735536316398" BASECOST="1.0" LEVELS="0" ALIAS="Based On EGO Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTAL" OPTIONID="MENTAL" OPTION_ALIAS="Mental Defense applies" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });

    addPower(
        {
            key: "CANNOTDODAMAGE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTDODAMAGE" ID="1730530836004" BASECOST="-0.5" LEVELS="0" ALIAS="Cannot Do Damage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "CANNOTATTACK",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTATTACK" ID="1700709064472" BASECOST="-0.5" LEVELS="0" ALIAS="Cannot Attack Through Link" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMMUNICATE" OPTIONID="COMMUNICATE" OPTION_ALIAS="neither the character nor his target can use the link to attack each other mentally, but they can communicate" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "CHARGES",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0), // TODO: Needs a cost function
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CHARGES" ID="1712257766011" BASECOST="-2.0" LEVELS="0" ALIAS="Charges" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="1" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "CONDITIONALPOWER",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CONDITIONALPOWER" ID="1732312708337" BASECOST="-0.25" LEVELS="0" ALIAS="Conditional Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="Power does not work in Uncommon Circumstances" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "COSTSEND",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="COSTSEND" ID="1728919937538" BASECOST="-0.25" LEVELS="0" ALIAS="Costs Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ACTIVATE" OPTIONID="ACTIVATE" OPTION_ALIAS="Only Costs END to Activate" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "COSTSENDTOMAINTAIN",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="COSTSENDTOMAINTAIN" ID="1726627718650" BASECOST="-0.5" LEVELS="0" ALIAS="Costs END To Maintain" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FULL" OPTIONID="FULL" OPTION_ALIAS="Full END Cost" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CONCENTRATION",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CONCENTRATION" ID="1727749190399" BASECOST="-0.5" LEVELS="0" ALIAS="Concentration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ZERO" OPTIONID="ZERO" OPTION_ALIAS="0 DCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CONTINUOUS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="CONTINUOUS" ID="1713378099716" BASECOST="1.0" LEVELS="0" ALIAS="Continuous" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CONTINUOUSCONCENTRATION",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            cost: function (modifier) {
                // Must Concentrate throughout use of Constant Power x2
                if (modifier.parent?.XMLID !== "CONCENTRATION") {
                    console.warn(`Unexpected: ${modifier.XMLID} parent is ${modifier.parent?.XMLID}`);
                }
                return parseFloat(modifier.parent?.BASECOST || 0);
            },
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="CONTINUOUSCONCENTRATION" ID="1743878031238" BASECOST="1.0" LEVELS="0" ALIAS="Must Concentrate throughout use of Constant Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CREWSERVED",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CREWSERVED" ID="1703219832667" BASECOST="-0.25" LEVELS="0" ALIAS="Crew-Served" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2" OPTIONID="2" OPTION_ALIAS="2 people" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CUMULATIVE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="CUMULATIVE" ID="1714280316745" BASECOST="0.5" LEVELS="0" ALIAS="Cumulative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DAMAGEOVERTIME",
            behaviors: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DAMAGEOVERTIME" ID="1738533900123" BASECOST="1.0" LEVELS="0" ALIAS="Damage Over Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DAMAGESHIELD",
            behaviors: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DAMAGESHIELD" ID="1735588757286" BASECOST="0.5" LEVELS="0" ALIAS="Damage Shield" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DECREASEDREUSE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DECREASEDREUSE" ID="1730531391045" BASECOST="1.5" LEVELS="0" ALIAS="Decreased Re-use Duration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1TURN" OPTIONID="1TURN" OPTION_ALIAS="1 Turn" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DELAYEDRETURNRATE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DELAYEDRETURNRATE" ID="1737065759130" BASECOST="1.0" LEVELS="0" ALIAS="Delayed Return Rate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINUTE" OPTIONID="MINUTE" OPTION_ALIAS="points return at the rate of 5 per Minute" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DECREASEDSTUNMULTIPLIER",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(-1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DECREASEDSTUNMULTIPLIER" ID="1735749243169" BASECOST="0.0" LEVELS="1" ALIAS="-1 Decreased STUN Multiplier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "DIFFICULTTODISPEL",
            behaviors: ["modifier"],
            cost: (modifier /* , item */) => {
                const levels = parseInt(modifier.LEVELS);

                return 0.25 + levels * 0.25;
            },
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DIFFICULTTODISPEL" ID="1664541509485" BASECOST="0.0" LEVELS="1" ALIAS="Difficult To Dispel" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DOESBODY",
            behaviors: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DOESBODY" ID="1735589197022" BASECOST="1.0" LEVELS="0" ALIAS="Does BODY" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DOESKB",
            behaviors: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DOESKB" ID="1735588757282" BASECOST="0.25" LEVELS="0" ALIAS="Does Knockback" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DOUBLEKB",
            behaviors: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DOUBLEKB" ID="1735589197028" BASECOST="0.75" LEVELS="0" ALIAS="Double Knockback" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOTIMES" OPTIONID="TWOTIMES" OPTION_ALIAS="2x KB" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "EXTRATIME",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            cost: function (modifier, item) {
                const baseCost = parseFloat(modifier.BASECOST);
                if (item.findModsByXmlid("ACTIVATEONLY")) {
                    // Extra Time normally applies every time the power is
                    // activated. If the power has a lengthy activation time, but can be
                    // used every Phase thereafter (usually for Constant or Persistent
                    // Powers), halve the Limitation value (to a minimum of -¼).
                    // ALso need to round to nearest quarter
                    return Math.min(-0.25, Math.floor((baseCost / 2) * 4) / 4);
                }
                return baseCost;
            },
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="EXTRATIME" ID="1736103283742" BASECOST="-0.75" LEVELS="0" ALIAS="Extra Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EXTRA" OPTIONID="EXTRA" OPTION_ALIAS="Extra Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // SUMMON related
            key: "EXPANDEDCLASS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="EXPANDEDCLASS" ID="1737924150569" BASECOST="0.25" LEVELS="0" ALIAS="Expanded Class of Beings" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYLIMITED" OPTIONID="VERYLIMITED" OPTION_ALIAS="Very Limited Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "EXPANDEDEFFECT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 2), // HD shows BASECOST -0.5 (limitation), but this is really an advantage +1/2
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="EXPANDEDEFFECT" ID="1732212865433" BASECOST="-0.5" LEVELS="2" ALIAS="Expanded Effect (x2 Characteristics or Powers simultaneously)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "EXPLOSION",
        behaviors: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        cost: function (modifier, item) {
            const baseCost = parseFloat(modifier.BASECOST);
            const levels = parseInt(modifier.LEVELS);
            let baseDCFalloffFromShape = 1;
            // 6e and 5e define AOE & EXPLOSION differently. This is the 5E MODIFIER.
            switch (modifier.OPTIONID) {
                case "CONE":
                    baseDCFalloffFromShape = 2;
                    break;
                case "LINE":
                    baseDCFalloffFromShape = 3;
                    break;
                case "NORMAL":
                case "RADIUS":
                    baseDCFalloffFromShape = 1;
                    break;
                default:
                    console.error(`unknown 5e explosion shape ${modifier.OPTIONID}`, modifier, item);
                    break;
            }
            const adjustedLevels = Math.max(0, levels - baseDCFalloffFromShape);
            return baseCost + adjustedLevels * 0.25;
        },
        dcAffecting: fixedValueFunction(true),
        editOptions: {
            choices: [
                {
                    OPTIONID: "NORMAL",
                    OPTION: "NORMAL",
                    OPTION_ALIAS: "Normal (Radius)",
                },
                {
                    OPTIONID: "CONE",
                    OPTION: "CONE",
                    OPTION_ALIAS: "Cone",
                },
                {
                    OPTIONID: "LINE",
                    OPTION: "LINE",
                    OPTION_ALIAS: "LINE",
                },
            ],
        },
        xml: `<MODIFIER XMLID="EXPLOSION" ID="1713379744211" BASECOST="0.5" LEVELS="1" ALIAS="Explosion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NORMAL" OPTIONID="NORMAL" OPTION_ALIAS="Normal (Radius)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });

    addPower(
        {
            key: "FOCUS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="FOCUS" ID="1442342142790" BASECOST="-0.5" LEVELS="0" ALIAS="Focus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OIF" OPTIONID="OIF" OPTION_ALIAS="OIF" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "GESTURES",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="GESTURES" ID="1727749190389" BASECOST="-0.25" LEVELS="0" ALIAS="Gestures" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "HANDTOHANDATTACK",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="HANDTOHANDATTACK" ID="1711934557552" BASECOST="-0.25" LEVELS="0" ALIAS="Hand-To-Hand Attack" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "HARDENED",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="HARDENED" ID="1712344562459" BASECOST="0.0" LEVELS="1" ALIAS="Hardened" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "IMPENETRABLE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="IMPENETRABLE" ID="1712345241001" BASECOST="0.0" LEVELS="1" ALIAS="Impenetrable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "INCANTATIONS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INCANTATIONS" ID="1727749190392" BASECOST="-0.25" LEVELS="0" ALIAS="Incantations" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "INCREASEDEND",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            cost: function (modifier, item) {
                let _cost = parseFloat(modifier.BASECOST);
                // If cost is only for activation, then increased end is worth 1/2.
                const costsEndOnlyToActivate =
                    item.findModsByXmlid("COSTSENDONLYTOACTIVATE") ||
                    item.findModsByXmlid("COSTSEND")?.OPTIONID === "ACTIVATE";
                if (costsEndOnlyToActivate) {
                    _cost = _cost / 2;
                }
                return _cost;
            },
            xml: `<MODIFIER XMLID="INCREASEDEND" ID="1736572142677" BASECOST="-0.5" LEVELS="0" ALIAS="Increased Endurance Cost" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2X" OPTIONID="2X" OPTION_ALIAS="x2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "INCREASEDSTUNMULTIPLIER",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INCREASEDSTUNMULTIPLIER" ID="1642201338997" BASECOST="0.0" LEVELS="1" ALIAS="+1 Increased STUN Multiplier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "INDEPENDENT",
        behaviors: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="INDEPENDENT" ID="1737919880443" BASECOST="-2.0" LEVELS="0" ALIAS="Independent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "INVISIBLE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INVISIBLE" ID="1693773081515" BASECOST="0.25" LEVELS="0" ALIAS="Invisible Power Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INOBVIOUSINVISIBLEONE" OPTIONID="INOBVIOUSINVISIBLEONE" OPTION_ALIAS="Inobvious Power, Invisible to Mental Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "INHERENT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INHERENT" ID="1730531186124" BASECOST="0.25" LEVELS="0" ALIAS="Inherent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "LIMITEDBODYPARTS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDBODYPARTS" ID="1730530831066" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Body Parts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Hands/arms" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDRANGE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDRANGE" ID="1746303340671" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LINKED",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LINKED" ID="1737924019237" BASECOST="-0.5" LEVELS="0" ALIAS="Linked" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMPOUNDPOWER" OPTIONID="COMPOUNDPOWER" OPTION_ALIAS="" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" LINKED_ID="1737241269418"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDPOWER",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDPOWER" ID="1736707646912" BASECOST="0.0" LEVELS="0" ALIAS="Limited Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1" OPTIONID="1" OPTION_ALIAS="Power loses less than a fourth of its effectiveness" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "LIMITEDTYPES",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDTYPES" ID="1702648349818" BASECOST="-0.5" LEVELS="0" ALIAS="Only Works On Limited Types Of Objects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LIMITED" OPTIONID="LIMITED" OPTION_ALIAS="Limited Group of Objects" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="metallic objects" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "LOS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LOS" ID="1710708665903" BASECOST="0.5" LEVELS="0" ALIAS="Line Of Sight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );

    addPower(
        {
            key: "MASS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="MASS" ID="1737920596086" BASECOST="0.0" LEVELS="0" ALIAS="Mass" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NONE" OPTIONID="NONE" OPTION_ALIAS="No Mass" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "MOBILE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="MOBILE" ID="1737907241760" BASECOST="0.25" LEVELS="0" ALIAS="Mobile" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(undefined, {
        key: "NND",
        behaviors: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(true),
        xml: `<MODIFIER XMLID="NND" ID="1735536656343" BASECOST="1.0" LEVELS="0" ALIAS="No Normal Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STANDARD" OPTIONID="STANDARD" OPTION_ALIAS="[Standard]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });

    addPower(
        {
            key: "NOCONSCIOUSCONTROL",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOCONSCIOUSCONTROL" ID="1737065783478" BASECOST="-2.0" LEVELS="0" ALIAS="No Conscious Control" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(undefined, {
        key: "NOFIGURED",
        behaviors: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="NOFIGURED" ID="1737921312173" BASECOST="-0.5" LEVELS="0" ALIAS="No Figured Characteristics" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            // MOVEMENT related
            key: "NOGRAVITYPENALTY",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOGRAVITYPENALTY" ID="1737921008650" BASECOST="0.5" LEVELS="0" ALIAS="No Gravity Penalty" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "MODIFIER",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="MODIFIER" ID="1736876900984" BASECOST="0.0" LEVELS="0" ALIAS="Custom Modifier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "NOBARRIERS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOBARRIERS" ID="1726539977732" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Form Barriers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOKB",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOKB" ID="1736707259863" BASECOST="-0.25" LEVELS="0" ALIAS="No Knockback" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NONONCOMBAT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NONONCOMBAT" ID="1732310748386" BASECOST="-0.25" LEVELS="0" ALIAS="no Noncombat movement" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NONPERSISTENT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NONPERSISTENT" ID="1737923746352" BASECOST="-0.25" LEVELS="0" ALIAS="Nonpersistent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NORANGE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NORANGE" ID="1727749190370" BASECOST="-0.5" LEVELS="0" ALIAS="No Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NORMALRANGE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NORMALRANGE" ID="1710649513411" BASECOST="-0.25" LEVELS="0" ALIAS="Normal Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOSTRBONUS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOSTRBONUS" ID="1612300735512" BASECOST="-0.5" LEVELS="0" ALIAS="No STR Bonus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOTELEPORT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOTELEPORT" ID="1733613873292" BASECOST="0.0" LEVELS="1" ALIAS="Cannot Be Escaped With Teleportation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "OIHID",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="OIHID" ID="1712092697365" BASECOST="-0.25" LEVELS="0" ALIAS="Only In Heroic Identity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONEWAYTRANSPARENT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONEWAYTRANSPARENT" ID="1752365017933" BASECOST="1.0" LEVELS="0" ALIAS="One-Way Transparent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="all attacks" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONLYAGAINSTLIMITEDTYPE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYAGAINSTLIMITEDTYPE" ID="1737921699851" BASECOST="-1.0" LEVELS="0" ALIAS="Only Works Against" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RARE" OPTIONID="RARE" OPTION_ALIAS="Rare attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ORGANIZATION",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ORGANIZATION" ID="1709496795426" BASECOST="2.0" LEVELS="0" ALIAS="Organization Contact" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "PENETRATING",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 2),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="PENETRATING" ID="1712697142089" BASECOST="0.0" LEVELS="1" ALIAS="Penetrating" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "PERSISTENT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="PERSISTENT" ID="1125625176030" BASECOST="0.5" LEVELS="0" ALIAS="Persistent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "PERSONALIMMUNITY",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="PERSONALIMMUNITY" ID="1624916935311" BASECOST="0.25" LEVELS="0" ALIAS="Personal Immunity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // MULTIFORM related
            key: "PERSONALITYLOSS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="PERSONALITYLOSS" ID="1737922788428" BASECOST="-2.0" LEVELS="0" ALIAS="Personality Loss" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TURN" OPTIONID="TURN" OPTION_ALIAS="First Roll After 1 Turn" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "PHYSICALMANIFESTATION",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="PHYSICALMANIFESTATION" ID="1737922207843" BASECOST="-0.25" LEVELS="0" ALIAS="Physical Manifestation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "RANGEBASEDONSTR",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            descriptionModifier: function (mod, item) {
                const actor = item.actor;

                return actor
                    ? `${item.actor.strDetails().strThrow}${getSystemDisplayUnits(item.actor.is5e)}; `
                    : "[Range based on actor STR]; ";
            },
            xml: `<MODIFIER XMLID="RANGEBASEDONSTR" ID="1703219636358" BASECOST="-0.25" LEVELS="0" ALIAS="Range Based On Strength" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "RANGED",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RANGED" ID="1710708659774" BASECOST="0.5" LEVELS="0" ALIAS="Ranged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RANGED" OPTIONID="RANGED" OPTION_ALIAS="Ranged" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REALARMOR",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REALARMOR" ID="1737919032283" BASECOST="-0.25" LEVELS="0" ALIAS="Real Armor" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // MULTIFORM related
            key: "REVERSION",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REVERSION" ID="1737922434229" BASECOST="0.0" LEVELS="0" ALIAS="Reversion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REALWEAPON",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REALWEAPON" ID="1736116897598" BASECOST="-0.25" LEVELS="0" ALIAS="Real Weapon" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REDUCEDEND",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            cost: function (modifier, item) {
                // Reduced endurance is double the cost if it's applying against a power with autofire
                if (item.findModsByXmlid("AUTOFIRE")) {
                    return parseFloat(modifier.BASECOST) * 2;
                }
                return parseFloat(modifier.BASECOST);
            },
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REDUCEDEND" ID="1710101174711" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REDUCEDPENETRATION",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REDUCEDPENETRATION" ID="1736707573869" BASECOST="-0.25" LEVELS="0" ALIAS="Reduced Penetration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REGENEXTRATIME",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REGENEXTRATIME" ID="1125625181954" BASECOST="-1.25" LEVELS="0" ALIAS="Extra Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" OPTION="TURN" OPTIONID="TURN" OPTION_ALIAS="1 Turn (Post-Segment 12)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "RESISTANT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RESISTANT" ID="1738367323412" BASECOST="0.5" LEVELS="0" ALIAS="Resistant" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "RESTRAINABLE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RESTRAINABLE" ID="1736707497175" BASECOST="-0.5" LEVELS="0" ALIAS="Restrainable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REQUIREDHANDS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            minimumLimitation: -0.25,
            xml: `<MODIFIER XMLID="REQUIREDHANDS" ID="1737919194581" BASECOST="-0.5" LEVELS="0" ALIAS="Required Hands" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWO" OPTIONID="TWO" OPTION_ALIAS="Two-Handed" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REQUIRESASKILLROLL",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            minimumLimitation: -0.25,
            xml: `<MODIFIER XMLID="REQUIRESASKILLROLL" ID="1596334078849" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "SAFEBLINDTELEPORT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SAFEBLINDTELEPORT" ID="1734150398776" BASECOST="0.25" LEVELS="0" ALIAS="Safe Blind Teleport" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SELFONLY",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SELFONLY" ID="1716495880091" BASECOST="-0.5" LEVELS="0" ALIAS="Self Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SENSEAFFECTEDASMORETHANONESENSE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SENSEAFFECTEDASMORETHANONESENSE" ID="1738018247799" BASECOST="-0.5" LEVELS="0" ALIAS="Sense Affected As More Than One Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYCOMMON" OPTIONID="VERYCOMMON" OPTION_ALIAS="[very common Sense]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SIDEEFFECTS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SIDEEFFECTS" ID="1737923914185" BASECOST="-0.25" LEVELS="0" ALIAS="Side Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINOR" OPTIONID="MINOR" OPTION_ALIAS="Minor Side Effect" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SPIRIT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SPIRIT" ID="1709496795428" BASECOST="1.0" LEVELS="0" ALIAS="Spirit Contact" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "STICKY",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="STICKY" ID="1735536581282" BASECOST="0.5" LEVELS="0" ALIAS="Sticky" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STANDARD" OPTIONID="STANDARD" OPTION_ALIAS="Standard" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "STUNONLY",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="STUNONLY" ID="1732058577233" BASECOST="0.0" LEVELS="0" ALIAS="STUN Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "STRMINIMUM",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="STRMINIMUM" ID="1736116903579" BASECOST="-0.25" LEVELS="0" ALIAS="STR Minimum" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1-5" OPTIONID="1-5" OPTION_ALIAS="1-5" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "TAKESNODAMAGE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="TAKESNODAMAGE" ID="1726627613967" BASECOST="1.0" LEVELS="0" ALIAS="Takes No Damage From Attacks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STRONLY" OPTIONID="STRONLY" OPTION_ALIAS="All Attacks, STR only to break out" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TELEPATHIC",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="TELEPATHIC" ID="1735977286708" BASECOST="0.25" LEVELS="0" ALIAS="Telepathic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TIMELIMIT",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="TIMELIMIT" ID="1738525037034" BASECOST="0.25" LEVELS="0" ALIAS="Time Limit" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EXTRAPHASE" OPTIONID="EXTRAPHASE" OPTION_ALIAS="Extra Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TRANSDIMENSIONAL",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="TRANSDIMENSIONAL" ID="1738534122034" BASECOST="0.5" LEVELS="0" ALIAS="Transdimensional" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Dimension" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "TRANSPARENT",
        behaviors: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="TRANSPARENT" ID="1752359726500" BASECOST="0.0" LEVELS="0" ALIAS="Transparent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "TRIGGER",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            minimumLimitation: 0.25,
            xml: `<MODIFIER XMLID="TRIGGER" ID="1735590829092" BASECOST="0.25" LEVELS="0" ALIAS="Trigger" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SET" OPTIONID="SET" OPTION_ALIAS="Set Trigger" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "UNCONTROLLED",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="UNCONTROLLED" ID="1735590455734" BASECOST="0.5" LEVELS="0" ALIAS="Uncontrolled" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "UNIFIEDPOWER",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="UNIFIEDPOWER" ID="1737919110593" BASECOST="-0.25" LEVELS="0" ALIAS="Unified Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "UOO",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: (modifier) => {
                const isUsableAsAttack = modifier.OPTIONID === "UAA";
                return isUsableAsAttack;
            },
            xml: `<MODIFIER XMLID="UOO" ID="1735585778553" BASECOST="1.0" LEVELS="0" ALIAS="Usable As Attack" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UAA" OPTIONID="UAA" OPTION_ALIAS="Usable As Attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // MOVEMENT related
            key: "USABLEAS",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="USABLEAS" ID="1737922876396" BASECOST="0.25" LEVELS="0" ALIAS="Usable [As Second Mode Of Movement]" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "VARIABLEADVANTAGE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="VARIABLEADVANTAGE" ID="1735590455736" BASECOST="0.5" LEVELS="0" ALIAS="Variable Advantage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "VARIABLESFX",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="VARIABLESFX" ID="1735590455741" BASECOST="0.25" LEVELS="0" ALIAS="Variable Special Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LIMITED" OPTIONID="LIMITED" OPTION_ALIAS="Limited Group of SFX" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "VERSUSEGO",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="VERSUSEGO" ID="1726539977733" BASECOST="0.25" LEVELS="0" ALIAS="Works Against EGO, Not STR" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "VISIBLE",
            behaviors: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="VISIBLE" ID="1731124293164" BASECOST="-0.25" LEVELS="0" ALIAS="Visible" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
})();

// For some reason the BASECOST of some modifiers/adder are 0, some are just wrong
// Turns out this is actually correct BASECOST can be 0, and COSTPERLEVEL is calculated.
// Some MODIFIERS (like EXPANDEDEFFECT) base a BASECOST -0.5 with LEVELS=2 and CostPerLevel 0.5, making them appear to be limitations, but actually advantages.
// Plan is to remove ModifierOverride and add them to the powers list as modifiers.
// HERO.ModifierOverride = {
//     //CONTINUOUSCONCENTRATION: { dcAffecting: fixedValueFunction(false), BASECOST: -0.25 },
//     //DEFBONUS: { dcAffecting: fixedValueFunction(false), BASECOST: 2 },
// };

// HERO.ModifierOverride5e = {
//     // ARMORPIERCING: {
//     //     BASECOST: 0.5,
//     // },
// };

// Valid Power Options (found these in Custom Power)
HERO.ValidPowerOptions = {
    Range: {
        SelfOnly: "Self Only",
        None: "None",
        Ranged: "Ranged",
        LineOfSight: "Line of Sight",
    },
    Duration: {
        // TODO: should these be capitalized?
        Instant: "Instant",
        Constant: "Constant",
        Persistent: "Persistent",
        Inherent: "Inherent",
    },
    Target: {
        NA: "N/A",
        SelfOnly: "Self Only",
        DCV: "DCV",
        DMCV: "DMCV",
        HEX: "HEX",
    },
    Defense: {
        None: "None",
        Normal: "Normal",
        Mental: "Mental",
        Power: "Power",
        Flash: "Flash",
    },
    Adders: {
        Adjustment: "Adjustment Power",
        Attack: "Attack Power",
        BodyAffecting: "Body-Affecting Power",
        Defense: "Defense Power",
        Mental: "Mental Power",
        Movement: "Movement Power",
        SenseAffecting: "Sense-Affecting Power",
        Sensory: "Sensory Power",
        Size: "Size Power",
        Special: "Special Power",
    },
};

HERO.areaOfEffect = {
    types: {
        none: "None",
        radius: "Radius",
        cone: "Cone",
        line: "Line",
        surface: "Surface",
        any: "Any Area",
    },
};

HERO.csl = {
    options: {
        SINGLE: "with any single attack",
        TIGHT: "with a small group of attacks",
        BROAD: "with a large group of attacks",
        HTH: "with HTH Combat",
        RANGED: "with Ranged Combat",
        ALL: "with All Attacks",
    },
};

HERO.mcsl = {
    options: {
        SINGLE: "with a single Mental Power",
        TIGHT: "with a group of Mental Powers",
        BROAD: "with all Mental Powers",
    },
};

HERO.stunBodyDamages = Object.freeze({
    stunbody: "Stun and Body",
    stunonly: "Stun only",
    bodyonly: "Body only",
    effectonly: "Effect only",
});

HERO.SFX = [
    "Default",
    "Acid",
    "Alien",
    "Air/Wind",
    "Animal",
    "Body Control",
    "Chi",
    "Cosmic Energy",
    "Cyberkinesis",
    "Darkness",
    "Density Alteration",
    "Dimensional Manipulation",
    "Earth/Stone",
    "Electricity",
    "Emotion Control",
    "Fire/Heat",
    "Force",
    "Gravity",
    "Ice/Cold",
    "Illusion",
    "Kinetic Energy",
    "Light",
    "Luck",
    "Magic/Mystic",
    "Magnetism",
    "Martial Arts",
    "Matter Manipulation",
    "Mental/Psionic",
    "Metamorphic",
    "Precognition",
    "Radiation",
    "Serum Based",
    "Shape Alteration",
    "Size Alteration",
    "Sleep/Dream",
    "Solar/Celestial",
    "Sonic",
    "Speedster",
    "Strength/Toughness",
    "Stretching",
    "Telekinetic",
    "Teleportation",
    "Time",
    "Vibration",
    "Water",
    "Weather",
    "Wood/Plant",
    "Miscellaneous",
];
