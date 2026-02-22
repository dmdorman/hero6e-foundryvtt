import { createDefenseProfile } from "./utility/defense.mjs";
import * as heroDice from "./utility/dice.mjs";
import { roundFavorPlayerTowardsZero, roundFavorPlayerAwayFromZero } from "./utility/round.mjs";
import {
    convertHexesToSystemUnits,
    getRoundedUpDistanceInSystemUnits,
    getSystemDisplayUnits,
    hexDistanceToSystemDisplayString,
} from "./utility/units.mjs";
import { HeroSystem6eActor } from "./actor/actor.mjs";
import { getOffHandDefenseDcv } from "./actor/actor-utils.mjs";
import {
    characteristicValueToDiceParts,
    dicePartsToFullyQualifiedEffectFormula,
    isRangedMartialManeuver,
    maneuverBaseEffectDicePartsBundle,
    maneuverDoesKillingDamage,
} from "./utility/damage.mjs";
import { HeroSystem6eItem } from "./item/item.mjs";
import {
    maneuverHasBindTrait,
    maneuverHasBlockTrait,
    maneuverHasCrushTrait,
    maneuverHasDisarmTrait,
    maneuverHasDodgeTrait,
    maneuverHasFlashEffectTrait,
    maneuverHasGrabTrait,
    maneuverHasKillingDamageTrait,
    maneuverHasNormalDamageTrait,
    maneuverHasNoNormalDefenseDamageTrait,
    maneuverHasShoveTrait,
    maneuverHasStrikeTrait,
    maneuverHasTargetFallsTrait,
    maneuverHasVelocityTrait,
} from "./item/maneuver.mjs";
import { squelch, hdcTextNumberToNumeric } from "./utility/util.mjs";
import { HeroActorCharacteristic } from "./item/HeroSystem6eTypeDataModels.mjs";
import * as heroEncounter from "./utility/encounter/encounter.mjs";

/**
 * Function to use with the filter function. Will exclude compound powers and framework powers.
 *
 * @param {HeroSystem6eItem} item
 *
 * @returns boolean
 */
export function filterIgnoreCompoundAndFrameworkItems(item) {
    return !(item.baseInfo.type.includes("compound") || item.baseInfo.type.includes("framework"));
}

export const HERO = { heroDice, heroEncounter };

// v14 has changed this from CONST.ACTIVE_EFFECT_MODES to CONST.ACTIVE_EFFECT_CHANGE_TYPES along with values.
HERO.ACTIVE_EFFECT_MODES = Object.freeze({
    CUSTOM: 0,
    MULTIPLY: 1,
    ADD: 2,
    DOWNGRADE: 3,
    UPGRADE: 4,
    OVERRIDE: 5,
});

HERO.folderColors = Object.freeze({
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
});

HERO.attacksWith = Object.freeze({
    ocv: "OCV",
    omcv: "OMCV",
});

HERO.defendsWith = Object.freeze({
    dcv: "DCV",
    dmcv: "DMCV",
});

HERO.defenseTypes = Object.freeze({
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
});

HERO.defenseTypes5e = Object.freeze({
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
});

HERO.attackClasses = Object.freeze({
    physical: "Physical",
    energy: "Energy",
    mental: "Mental",
});

HERO.skillCharacteristics = Object.freeze({
    GENERAL: "GENERAL",
    STR: "STR",
    DEX: "DEX",
    CON: "CON",
    INT: "INT",
    EGO: "EGO",
    PRE: "PRE",
});

HERO.skillCharacteristics5e = Object.freeze({
    GENERAL: "GENERAL",
    STR: "STR",
    DEX: "DEX",
    CON: "CON",
    INT: "INT",
    EGO: "EGO",
    PRE: "PRE",
    COM: "COM",
});

HERO.skillTraining = Object.freeze({
    untrained: "Untrained",
    familiar: "Familiar",
    everyman: "Everyman",
    proficient: "Proficient",
    trained: "Trained",
});

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

HERO.VALIDATION_SEVERITY = {
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
};

HERO.isSpecialHitLocation = function (location) {
    return HERO.hitLocations[location]?.isSpecialHl ?? false;
};

HERO.sidedLocations = new Set(["Hand", "Shoulder", "Arm", "Thigh", "Leg", "Foot"]);

HERO.hitLocationSide = Object.freeze({
    Left: "Left",
    Right: "Right",
});

HERO.ACTIVE_EFFECT_PRIORITY = Object.freeze({
    // FoundryVTT defaults to MODE * 10
    // Lower priorities are performed first
    ADD: 20,
    CUSTOM: 0,
    DOWNGRADE: 30,
    MULTIPLY: 45, // In HERO this goes mostly last so change value from 10 to 45
    OVERRIDE: 50,
    UPGRADE: 40,
});

HERO.RANGE_TYPES = Object.freeze({
    LIMITED_RANGE: "Limited Range",
    LINE_OF_SIGHT: "Line of Sight",
    NO_RANGE: "No Range",
    RANGE_BASED_ON_STR: "Range Based on STR",
    SELF: "Self",
    SPECIAL: "Special",
    STANDARD: "Standard",
});

HERO.DURATION_TYPES = Object.freeze({
    INSTANT: "instant",
    CONSTANT: "constant",
    PERSISTENT: "persistent",
    INHERENT: "inherent",
});

HERO.martialArtsDamageTypeChoices = [
    {
        label: "None/Non-Damaging",
        key: 0,
    },
    {
        label: "STR/Exert",
        key: 1,
    },
    {
        label: "Normal Damage",
        key: 2,
    },
    {
        label: "Killing Damage",
        key: 3,
    },
    {
        label: "NND",
        key: 4,
    },
    {
        label: "Flash",
        key: 5,
    },
];

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

// NOTE: Expecting strings to be lower case
// NOTE: This is not exhaustive, just what is mentioned in the book as examples
HERO.PENALTY_SKILL_LEVELS_TYPES = Object.freeze({
    // armor penalties to DCV
    armor: "armor",

    // Encumbrance penalties to DCV
    encumbrance: "encumbrance",

    // Counteract the DCV penalty for being prone
    groundfighting: "groundFighting",

    // Targeting Skill Levels, which offset only the OCV penalty
    // for targeting any and all Hit Locations
    location: "hitLocation",

    // Range Skill Levels, which offset only the Range Modifier
    range: "range",

    // Targeting Skill Levels, which offset the penalty
    // for targeting any and all Hit Locations
    throwing: "throwing",

    // fighting underwater FIXME: This should probably be" environment X" where X is the environment
    underwater: "underwater",
});

// NOTE: Expecting strings to be lower case
HERO.CSL_5E_CV_LEVELS_TYPES = Object.freeze({
    // Non mental hand-to-hand attacks
    hth: "hth",

    // Non mental ranged attacks
    ranged: "ranged",

    // Any "mental" (omcv) attack
    mental: "mental",
});

// NOTE: Expecting strings to be lower case
HERO.CSL_WEAPON_MASTER_WEAPON_TYPES = Object.freeze({
    // Killing attacks
    killing: "killing",

    // Normal attacks
    normal: "normal",

    // Must list all attacks
    explicit: "explicit",
});

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
        console.warn(`Powers without behaviors property: `, powersWithoutBehaviorsProperty);
    }
    numViolations += powersWithoutBehaviorsProperty.length;

    // Has key property
    const powersWithoutKeyProperty = this.filter((power) => !power.key);
    if (powersWithoutKeyProperty.length > 0) {
        console.warn(`Powers without key property: `, powersWithoutKeyProperty);
    }
    numViolations += powersWithoutKeyProperty.length;

    // Has type property
    const powersWithoutTypeProperty = this.filter((power) => !power.type);
    if (powersWithoutKeyProperty.length > 0) {
        console.warn(`Powers without type property: `, powersWithoutTypeProperty);
    }
    numViolations += powersWithoutTypeProperty.length;

    // All characteristics have a base function
    const characteristicsWithoutBaseFunction = this.filter(
        (power) =>
            (power.type.includes("characteristic") || power.type.includes("movement")) &&
            typeof power.base !== "function",
    );
    if (characteristicsWithoutBaseFunction.length > 0) {
        console.warn(`Characteristics without base function: `, characteristicsWithoutBaseFunction);
    }
    numViolations += characteristicsWithoutBaseFunction.length;

    // Has XML property, other than things which don't exist in HDCs and a few characteristics (but we catch all charaacteristics due to simple check)
    const powersWithoutXmlProperty = this.filter((power) => !power.xml)
        .filter((power) => !power.type.includes("characteristic"))
        .filter((power) => !power.behaviors.includes("non-hd"));
    if (powersWithoutXmlProperty.length > 0) {
        console.warn(`Powers without xml property: `, powersWithoutXmlProperty);
    }
    numViolations += powersWithoutXmlProperty.length;

    // All powers with XML need to have matching key and XMLID
    const powersWithoutMatchingKeyAndXmlid = this.filter((power) => !!power.xml).filter((power) => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(power.xml.trim(), "text/xml");

        const xmlid = xml.children[0].getAttribute("XMLID");

        // For GENERIC_OBJECT make sure the tag matches the key
        if (xmlid === "GENERIC_OBJECT") {
            return xml.children[0].tagName !== power.key;
        }

        // Make sure XMLID matches key
        return power.key !== xmlid;
    });
    if (powersWithoutMatchingKeyAndXmlid.length > 0) {
        console.warn(`Powers without matching key and XMLID: `, powersWithoutMatchingKeyAndXmlid);
    }
    numViolations += powersWithoutMatchingKeyAndXmlid.length;

    // All powers that have a duration are lowercase
    const powersWithDurationThatIsUppercase = this.filter((power) => power.duration?.toLowerCase() !== power.duration);
    if (powersWithDurationThatIsUppercase.length > 0) {
        console.warn(`Powers without a lowercase duration: `, powersWithDurationThatIsUppercase);
    }
    numViolations += powersWithDurationThatIsUppercase.length;

    // Has range property and is not framework/compound/adder/modifier
    const powersWithoutRangeForItemFunction = this.filter(
        (power) =>
            !(
                power.behaviors.includes("adder") ||
                power.behaviors.includes("modifier") ||
                power.type.includes("framework") ||
                power.type.includes("compound")
            ) && !(power.rangeForItem && typeof power.rangeForItem === "function"),
    );
    if (powersWithoutRangeForItemFunction.length > 0) {
        console.warn(`Powers without range property: `, powersWithoutRangeForItemFunction);
    }
    numViolations += powersWithoutRangeForItemFunction.length;

    // A power (not modifier or adder) without duration property?
    const powersWithoutDurationProperty = this.filter(
        (power) =>
            !(
                power.behaviors.includes("adder") ||
                power.behaviors.includes("modifier") ||
                power.type.includes("compound") ||
                power.type.includes("framework") ||
                power.type.includes("disadvantage")
            ) && !power.duration,
    );
    if (powersWithoutDurationProperty.length > 0) {
        console.warn(`Powers without duration property: `, powersWithoutDurationProperty);
    }
    numViolations += powersWithoutDurationProperty.length;

    // Any to-hit or dice powers that are not martial arts or maneuvers without usesStrength property?
    const attackPowersWithoutUsesStrengthProperty = this.filter(
        (power) =>
            (power.behaviors.includes("dice") || power.behaviors.includes("to-hit")) &&
            !power.type.includes("maneuver") &&
            power.usesStrength == null,
    );
    if (attackPowersWithoutUsesStrengthProperty.length > 0) {
        console.warn(`Powers without usesStrength property: `, attackPowersWithoutUsesStrengthProperty);
    }
    numViolations += attackPowersWithoutUsesStrengthProperty.length;

    // All powers have a costPerLevel function
    const powersWithoutCostPerLevelFunction = this.filter(
        (power) => !(power.costPerLevel && typeof power.costPerLevel === "function"),
    );
    if (powersWithoutCostPerLevelFunction.length > 0) {
        console.warn(`Powers without costPerLevel function: `, powersWithoutCostPerLevelFunction);
    }
    numViolations += powersWithoutCostPerLevelFunction.length;

    // All modifiers have a dcAffecting function
    const modifiersWithoutDcAffectingFunction = this.filter(
        (power) => power.behaviors.includes("modifier") && typeof power.dcAffecting !== "function",
    );
    if (modifiersWithoutDcAffectingFunction.length > 0) {
        console.warn(`Modifiers without dcAffecting function: `, modifiersWithoutDcAffectingFunction);
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
        console.warn(`Powers without effects dice parts function: `, powersOrManeuversWithoutEffectsDicePartsFunction);
    }
    numViolations += powersOrManeuversWithoutEffectsDicePartsFunction.length;

    // All powers that roll damage/effect dice should have a doesKillingDamage boolean field
    const damageEffectPowersWithoutDoesKillingDamageFunction = this.filter(
        (power) => power.behaviors.includes("dice") && typeof power.doesKillingDamage !== "function",
    );
    if (damageEffectPowersWithoutDoesKillingDamageFunction.length > 0) {
        console.warn(
            `Damage/Effect powers missing doesKillingDamage field: `,
            damageEffectPowersWithoutDoesKillingDamageFunction,
        );
    }
    numViolations += damageEffectPowersWithoutDoesKillingDamageFunction.length;

    // All characteristics, maneuvers, and movement powers should have ignoreForActor function
    const charAndManeuverWithoutIgnoreForActorFunction = this.filter((power) => {
        return (
            (power.type.includes("characteristic") ||
                power.type.includes("maneuver") ||
                power.type.includes("movement")) &&
            typeof power.ignoreForActor !== "function"
        );
    });
    if (charAndManeuverWithoutIgnoreForActorFunction.length > 0) {
        console.warn(
            `Characteristics or Maneuvers without ignoreForActor: `,
            charAndManeuverWithoutIgnoreForActorFunction,
        );
    }
    numViolations += charAndManeuverWithoutIgnoreForActorFunction.length;

    if (numViolations === 0) {
        console.log(`Powers look valid`);
    }

    return numViolations;
}

HERO.powers6e = [];
HERO.powers6e.validate = validatePowers;
HERO.powers5e = [];
HERO.powers5e.validate = validatePowers;

// Dictionaries XMLID -> array of power descriptions/baseInfo
HERO.powers6eDict = new Map();
HERO.powers5eDict = new Map();

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

/**
 * Luck and Unluck can't have partial dice
 *
 * @param {HeroSystem6eItem} item
 * @returns
 */
function luckAndUnluckBaseEffectDiceParts(item /* , options */) {
    const diceParts = {
        dc: item.dcRaw,
        d6Count: parseInt(item.system?.LEVELS || 0),
        d6Less1DieCount: 0,
        halfDieCount: 0,
        constant: 0,
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
    if (!squelch(item.id)) {
        console.warn(
            `${item.actor.name}:${item.detailedName()} is defined as having no effect but effect is called`,
            item,
        );
    }

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

function staticIgnoreForActorFunction(alwaysIgnore) {
    return function (actor) {
        return alwaysIgnore.includes(actor.type);
    };
}

function pdEdCostPerLevel(itemOrActor) {
    const actor = itemOrActor instanceof HeroSystem6eActor ? itemOrActor : itemOrActor.actor;
    const hasAutomatonPowerWithNoStun = !!actor?.items.find(
        (power) =>
            power.system.XMLID === "AUTOMATON" &&
            (power.system.OPTIONID === "NOSTUN1" || power.system.OPTIONID === "NOSTUN2"),
    );
    if (hasAutomatonPowerWithNoStun) {
        return 3;
    }

    // Vehicles in 6e have PD and ED that is resistant. Consequently the cost is different.
    if (actor.type === "vehicle") {
        return 3 / 2;
    }

    return 1;
}

/**
 * @typedef {Object} PowerDescription
 * @type Object
 * @property {string} key - Hero Designer XMLID of the power
 * @property {string} name - Human readable name of the power
 * @property {string} base - Base number of levels that are given automatically
 * @property {string} cost - Cost in character points per additional level
 * @property {Array<string>} type - A list of types associated with this power
 * @property {Array<"non-hd" | "optional-maneuver" | "success"| "dice" | "to-hit" | "activatable" | "adder" | "modifier" | "240DegreeArcBuiltIn" | "360DegreeArcBuiltIn" | "microscopicBuiltIn" | "senseBuiltIn" | "rangeBuiltIn" | "rapidBuiltIn" | "targetingBuiltIn" | telescopicBuiltIn | "penetrativeBuiltIn">} behaviors - A list of the behavior types this power exhibits in the code
 *        "non-hd" - this is not an XMLID that comes from Hero Designer
 *        "optional-maneuver" - this is an optional combat maneuver
 *        "success" - can roll some kind of success roll for this power
 *        "dice" - a damage/effect dice roll is associated with this power
 *        "to-hit" - a to-hit dice roll is associated with this power
 *        "activatable" - this power can be turned on/off/activated/deactivated
 *        "adder" - this power is actually a power adder
 *        "modifier" - this power is actually a power modifier (aka advantage)
 *        "240DegreeArcBuiltIn" - this sense power has a 240 degree arc
 *        "360DegreeArcBuiltIn" - this sense power has a 360 degree arc
 *        "microscopicBuiltIn" - this sense is microscopic
 *        "penetrativeBuiltIn" - this sense power is pentrative
 *        "rangeBuiltIn" - this sense power has range
 *        "rapidBuiltIn" - this sense is rapid
 *        "senseBuiltIn" - this sense power is passive
 *        "targetingBuiltIn" - this sense power can be used for targeting
 *        "telescopicBuiltIn" - this sense is telescopic
 *
 * @property {"constant"|"instant"|"persistent"} duration - The lower case duration of the power
 * @property {Function(HeroSystem6eItem) => HERO.RANGE_TYPES} rangeForItem - The range of the power base on the item as many martial arts share the same XMLID
 * @property {boolean} [costEnd] - If the power costs endurance to use. true if it does, false or undefined if it doesn't
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
            const xml = parser.parseFromString(powerDescription6e.xml.trim(), "text/xml");

            // Add power properties based on valid XML.
            // NOTE: Chrome will parse partially valid XML, Firefox will not
            // which is why we are checking for parsererror.
            if (xml.getElementsByTagName("parsererror").length === 0) {
                // PH: FIXME: Remove these... everything should have it.
                powerDescription6e.key ??= xml.children[0].getAttribute("XMLID");
                powerDescription6e.name ??= xml.children[0].getAttribute("ALIAS");
                powerDescription6e.xmlTag ??= xml.children[0].tagName.toUpperCase();
            } else {
                throw new Error(`Invalid XML provided for 6e power description with key ${powerDescription6e.key}`);
            }
        }
        if (!powerDescription6e.key) {
            return;
        }

        const powerDescriptionClone = Object.freeze(foundry.utils.deepClone(powerDescription6e));
        HERO.powers6e.push(powerDescriptionClone);

        const existing = HERO.powers6eDict.get(powerDescription6e.key);
        if (existing) {
            existing.push(powerDescriptionClone);
            HERO.powers6eDict.set(powerDescription6e.key, existing);
        } else {
            HERO.powers6eDict.set(powerDescription6e.key, [powerDescriptionClone]);
        }

        // Talents can be purchased as powers (duplicate them)
        if (powerDescription6e.xmlTag === "TALENT") {
            const talentPower = foundry.utils.deepClone(powerDescription6e);
            talentPower.xmlTag = "POWER";
            talentPower.xml.replace("<TALENT", "<POWER");
            HERO.powers6e.push(talentPower);

            const existing = HERO.powers6eDict.get(powerDescription6e.key);
            if (existing) {
                existing.push(talentPower);
                HERO.powers6eDict.set(powerDescription6e.key, existing);
            } else {
                HERO.powers6eDict.set(powerDescription6e.key, [talentPower]);
            }
        }
    }

    if (powerOverrideFor5e) {
        const powerDescription5e = Object.assign(powerDescription6e ? powerDescription6e : {}, powerOverrideFor5e);

        if (powerDescription5e.xml) {
            powerDescription5e.xml = powerDescription5e.xml.replace(/\n/g, "").trim();
            const parser = new DOMParser();
            const xml = parser.parseFromString(powerDescription5e.xml.trim(), "text/xml");

            if (xml.getElementsByTagName("parsererror").length === 0) {
                // PH: FIXME: Remove these... everything should have it.
                powerDescription5e.key ??= xml.children[0].getAttribute("XMLID");
                powerDescription5e.name ??= xml.children[0].getAttribute("ALIAS");
                powerDescription5e.xmlTag ??= xml.children[0].tagName.toUpperCase();
            } else {
                throw new Error(`Invalid XML provided for 5e power description with key ${powerDescription5e.key}`);
            }
        }
        if (!powerDescription5e.key) {
            return;
        }

        const powerDescriptionClone = Object.freeze(foundry.utils.deepClone(powerDescription5e));
        HERO.powers5e.push(powerDescription5e);

        const existing = HERO.powers5eDict.get(powerDescription5e.key);
        if (existing) {
            existing.push(powerDescriptionClone);
            HERO.powers5eDict.set(powerDescription5e.key, existing);
        } else {
            HERO.powers5eDict.set(powerDescription5e.key, [powerDescriptionClone]);
        }
    }
}

(function addCharacteristicsToPowerList() {
    addPower(
        {
            key: "STR",
            name: "Strength",
            base: fixedValueFunction(10),
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            notes: function (char) {
                const strDetails = char.actor.strDetails();
                return `lift ${strDetails.strLiftText}, running throw ${
                    strDetails.strThrow
                }${getSystemDisplayUnits(char.actor.is5e)}`;
            },
            xml: `<STR XMLID="STR" ID="1712377060992" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></STR>`,
        },
        {},
    );
    addPower(
        {
            key: "DEX",
            name: "Dexterity",
            base: fixedValueFunction(10),
            costPerLevel: fixedValueFunction(2),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["base2"]),
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<DEX XMLID="DEX" ID="1712447975671" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></DEX>`,
        },
        {
            costPerLevel: fixedValueFunction(3),
        },
    );
    addPower(
        {
            key: "CON",
            name: "Constitution",
            base: fixedValueFunction(10),
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success", "defense"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["vehicle", "base2", "computer", "ai"]),
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<CON XMLID="CON" ID="1712377266422" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></CON>`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "INT",
            name: "Intelligence",
            base: fixedValueFunction(10),
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["vehicle", "base2"]),
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<INT XMLID="INT" ID="1712377270415" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></INT>`,
        },
        {},
    );
    addPower(
        {
            key: "EGO",
            name: "Ego",
            base: fixedValueFunction(10),
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["automaton", "vehicle", "base2", "computer"]),
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<EGO XMLID="EGO" ID="1712377272129" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></EGO>`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "PRE",
            name: "Presence",
            base: fixedValueFunction(10),
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["vehicle", "base2", "computer", "ai"]),
            baseEffectDicePartsBundle: characteristicBaseEffectDiceParts,
            xml: `<PRE XMLID="PRE" ID="1712377273912" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></PRE>`,
        },
        {},
    );
    addPower(undefined, {
        key: "COM",
        name: "Comeliness",
        base: fixedValueFunction(10),
        type: ["characteristic"],
        behaviors: ["success"],
        duration: HERO.DURATION_TYPES.PERSISTENT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        ignoreForActor: staticIgnoreForActorFunction(["vehicle", "base2", "computer", "ai"]),
        cost: function (characteristicOrPower) {
            // This could be a natural characteristic or a power
            const levels = characteristicOrPower.levels ?? characteristicOrPower.system.LEVELS;

            // COM only exists in 5e and it has some weird rules:
            // 1. It can have starting values of less than 0
            // 2. You can buyback to 0 COM (-5 points) and after that you pay again. So -10 COM is 0 points, -30 COM is 10 points, etc.
            if (levels >= -10) {
                return Math.round(levels * this.costPerLevel());
            }

            // Pay only for the levels that are less than 0
            return Math.round(Math.abs(levels + 10) * this.costPerLevel()) - 5;
        },
        costPerLevel: fixedValueFunction(1 / 2),
        baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        xml: `<COM XMLID="COM" ID="1712377275507" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></COM>`,
    });
    addPower(
        {
            key: "OCV",
            name: "Offensive Combat Value",
            base: fixedValueFunction(3),
            costPerLevel: fixedValueFunction(5),
            type: ["characteristic"],
            behaviors: ["calculated", "calculatedDEX"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["base2"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                if (char.actor.is5e) {
                    return "5e calculated DEX/3";
                }
                return null;
            },
            calculated5eCharacteristic: function (actor) {
                return Math.max(0, roundFavorPlayerAwayFromZero(actor.system.characteristics.dex.value / 3));
            },
            xml: `<OCV XMLID="OCV" ID="1712377400048" BASECOST="0.0" LEVELS="0" ALIAS="OCV" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></OCV>`,
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
            base: fixedValueFunction(3),
            costPerLevel: fixedValueFunction(5),
            type: ["characteristic"],
            behaviors: ["defense", "calculated", "calculatedDEX"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["base2"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                const actor = char.actor;
                let notes = [];

                if (actor.is5e) {
                    notes.push("5e calculated DEX/3");
                }

                let dcvHthLevels = 0;
                let dcvRangedLevels = 0;
                let dcvLevels = 0;
                for (const csl of actor.activeCslSkills) {
                    for (const levelUse of csl.system.csl) {
                        if (csl.system.OPTIONID === "DCV") {
                            dcvLevels += 1;
                        } else if (levelUse === "dcvHth") {
                            dcvHthLevels += 1;
                        } else if (levelUse === "dcvRanged") {
                            dcvRangedLevels += 1;
                        }
                    }
                }

                if (dcvHthLevels || dcvRangedLevels || dcvLevels) {
                    notes.push(
                        `Extra CSL defenses: HTH DCV ${dcvHthLevels.signedStringHero()}, Ranged DCV ${dcvRangedLevels.signedStringHero()}, DCV ${dcvLevels.signedStringHero()}`,
                    );
                }

                // Any off hand defenses against HTH attacks?
                const offHandDefense = getOffHandDefenseDcv(actor);
                if (offHandDefense > 0) {
                    notes.push(
                        `${actor.is5e ? "WF: Off Hand" : "Off Hand Defense"} vs HTH DCV ${offHandDefense.signedStringHero()}`,
                    );
                }

                return notes.join(", ");
            },
            calculated5eCharacteristic: function (actor) {
                return Math.max(0, roundFavorPlayerAwayFromZero(actor.system.characteristics.dex.value / 3));
            },
            xml: `<DCV XMLID="DCV" ID="1712377402602" BASECOST="0.0" LEVELS="0" ALIAS="DCV" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></DCV>`,
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
            base: fixedValueFunction(3),
            costPerLevel: fixedValueFunction(3),
            type: ["characteristic"],
            behaviors: ["calculated", "calculatedEGO"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["automaton", "vehicle", "base2"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                if (char.actor.is5e) {
                    return "5e calculated EGO/3";
                }
                return null;
            },
            calculated5eCharacteristic: function (actor) {
                return Math.max(0, roundFavorPlayerAwayFromZero(actor.system.characteristics.ego.value / 3));
            },
            xml: `<OMCV XMLID="OMCV" ID="1712377404591" BASECOST="0.0" LEVELS="0" ALIAS="OMCV" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></OMCV>`,
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
            base: fixedValueFunction(3),
            costPerLevel: fixedValueFunction(3),
            type: ["characteristic"],
            behaviors: ["defense", "calculated", "calculatedEGO"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["automaton", "vehicle", "base2"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                const actor = char.actor;
                let notes = [];

                if (actor.is5e) {
                    notes.push("5e calculated EGO/3");
                }

                let dmcvLevels = 0;
                for (const csl of actor.activeCslSkills) {
                    for (const levelUse of csl.system.csl) {
                        if (levelUse === "dmcv") {
                            dmcvLevels += 1;
                        }
                    }
                }

                if (dmcvLevels) {
                    notes.push(`Extra CSL defenses: DMCV ${dmcvLevels.signedStringHero()}`);
                }

                return notes.join(", ");
            },
            calculated5eCharacteristic: function (actor) {
                return Math.max(0, roundFavorPlayerAwayFromZero(actor.system.characteristics.ego.value / 3));
            },

            xml: `<DMCV XMLID="DMCV" ID="1712377406823" BASECOST="0.0" LEVELS="0" ALIAS="DMCV" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></DMCV>`,
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
            base: fixedValueFunction(2),
            costPerLevel: fixedValueFunction(10),
            cost: function (spdCharacteristicOrItem) {
                if (
                    !(spdCharacteristicOrItem instanceof HeroActorCharacteristic) &&
                    !(spdCharacteristicOrItem instanceof HeroSystem6eItem)
                ) {
                    console.error(`unexpected datatype`, spdCharacteristicOrItem);
                    return 0;
                }

                const levels = spdCharacteristicOrItem.levels ?? spdCharacteristicOrItem.system.LEVELS;
                const base =
                    spdCharacteristicOrItem.base ?? spdCharacteristicOrItem.actor.system.characteristics.spd.base;

                // 5e gets partial refund
                const refund = levels > 0 ? +(base % 1).toFixed(1) * 10 : 0;

                return levels * this.costPerLevel() - refund;
            },
            type: ["characteristic"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["base2"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                if (char.actor.is5e) {
                    return "5e figured 1 + DEX/10";
                }
                return null;
            },
            xml: `<SPD XMLID="SPD" ID="1712377280539" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></SPD>`,
        },
        {
            base: fixedValueFunction(0),
            behaviors: ["figured", "figuredDEX"],
            figured5eCharacteristic: function (actor) {
                return (
                    1 +
                    Number((actor.system.characteristics.dex.basePlusLevels / 10).toFixed(1)) +
                    Number(
                        actor.system.characteristics.dex
                            .baseSumFiguredCharacteristicsNoRoundingFromItems(10)
                            .toFixed(1),
                    )
                );
            },
        },
    );
    addPower(
        {
            key: "PD",
            name: "Physical Defense",
            base: fixedValueFunction(2),
            costPerLevel: pdEdCostPerLevel,
            type: ["characteristic"],
            behaviors: ["defense"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["ai", "computer"]),
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
            notes: function (char) {
                if (char.actor.is5e) {
                    // Automatons and things that have bought no STUN have a different figured formula
                    return `5e figured STR/5${!char.actor.hasCharacteristic("STUN") ? " and /3 again" : ""}`;
                }
                return null;
            },
            xml: `<PD XMLID="PD" ID="1712377277205" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></PD>`,
        },
        {
            base: fixedValueFunction(0),
            behaviors: ["defense", "figured", "figuredSTR"],
            ignoreForActor: staticIgnoreForActorFunction(["ai", "base2", "computer"]),
            figured5eCharacteristic: function (actor) {
                return (
                    roundFavorPlayerAwayFromZero(actor.system.characteristics.str.basePlusLevels / 5) +
                    actor.system.characteristics.str.baseSumFiguredCharacteristicsFromItems(5)
                );
            },
        },
    );
    addPower(
        {
            key: "ED",
            name: "Energy Defense",
            base: fixedValueFunction(2),
            costPerLevel: pdEdCostPerLevel,
            type: ["characteristic"],
            behaviors: ["defense"],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["ai", "computer"]),
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
            notes: function (char) {
                if (char.actor.is5e) {
                    // Automatons and things that have bought no STUN have a different figured formula
                    return `5e figured CON/5${!char.actor.hasCharacteristic("STUN") ? " and /3 again" : ""}`;
                }
                return null;
            },
            xml: `<ED XMLID="ED" ID="1712377278856" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></ED>`,
        },
        {
            base: fixedValueFunction(0),
            behaviors: ["defense", "figured", "figuredCON"],
            ignoreForActor: staticIgnoreForActorFunction(["ai", "base2", "computer"]),
            figured5eCharacteristic: function (actor) {
                return (
                    roundFavorPlayerAwayFromZero(actor.system.characteristics.con.basePlusLevels / 5) +
                    actor.system.characteristics.con.baseSumFiguredCharacteristicsFromItems(5)
                );
            },
        },
    );
    addPower(
        {
            key: "REC",
            name: "Recovery",
            base: fixedValueFunction(4),
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["vehicle", "base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                if (char.actor.is5e) {
                    return "5e figured STR/5 + CON/5";
                }
                return null;
            },
            xml: `<REC XMLID="REC" ID="1712377282168" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></REC>`,
        },
        {
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(2),
            behaviors: ["figured", "figuredSTR", "figuredCON"],
            figured5eCharacteristic: function (actor) {
                return (
                    roundFavorPlayerAwayFromZero(actor.system.characteristics.str.basePlusLevels / 5) +
                    actor.system.characteristics.str.baseSumFiguredCharacteristicsFromItems(5) +
                    roundFavorPlayerAwayFromZero(actor.system.characteristics.con.basePlusLevels / 5) +
                    actor.system.characteristics.con.baseSumFiguredCharacteristicsFromItems(5)
                );
            },
        },
    );
    addPower(
        {
            key: "END",
            name: "Endurance",
            base: fixedValueFunction(20),
            costPerLevel: fixedValueFunction(1 / 5),
            type: ["characteristic"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["vehicle", "base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                if (char.actor.is5e) {
                    return "5e figured 2 x CON";
                }
                return null;
            },
            xml: `<END XMLID="END" ID="1712377283848" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></END>`,
        },
        {
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(1 / 2),
            behaviors: ["figured", "figuredCON"],
            figured5eCharacteristic: function (actor) {
                // 5e figured 2 x CON
                return (
                    roundFavorPlayerAwayFromZero(actor.system.characteristics.con.basePlusLevels * 2) +
                    actor.system.characteristics.con.baseSumFiguredCharacteristicsFromItems(0.5)
                );
            },
        },
    );
    addPower(
        {
            key: "BODY",
            name: "Body",
            base: function (actor) {
                if (actor.type === "base2") {
                    return 2;
                }

                return 10;
            },
            costPerLevel: fixedValueFunction(1),
            type: ["characteristic"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<BODY XMLID="BODY" ID="1712377268646" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></BODY>`,
        },
        {
            costPerLevel: fixedValueFunction(2), // TODO: Bases only have to pay 1 for each +1
        },
    );
    addPower(
        {
            key: "STUN",
            name: "Stun",
            base: fixedValueFunction(20),
            costPerLevel: fixedValueFunction(1 / 2),
            type: ["characteristic"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: function (actor) {
                const alwaysIgnore = ["vehicle", "base2", "computer", "ai"].includes(actor.type);
                if (alwaysIgnore) {
                    return true;
                }

                // The Automaton power presents awkwardly in HDC. A character has STUN unless they have certain levels
                // of the AUTOMATON powers.
                if (["automaton", "pc", "npc"].includes(actor.type)) {
                    const isAutomatonPowerWithNoStun = !!actor.items.find(
                        (item) =>
                            item.system.XMLID === "AUTOMATON" &&
                            (item.system.OPTIONID === "NOSTUN1" || item.system.OPTIONID === "NOSTUN2"),
                    );

                    return isAutomatonPowerWithNoStun;
                }

                return false;
            },
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                if (char.actor.is5e) {
                    return "5e figured BODY+(STR/2)+(CON/2)";
                }
                return null;
            },
            xml: `<STUN XMLID="STUN" ID="1712377285547" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></STUN>`,
        },
        {
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(1),
            behaviors: ["figured", "figuredSTR", "figuredCON"],
            figured5eCharacteristic: function (actor) {
                return (
                    actor.system.characteristics.body.basePlusLevels +
                    roundFavorPlayerAwayFromZero(actor.system.characteristics.str.basePlusLevels / 2) +
                    actor.system.characteristics.str.baseSumFiguredCharacteristicsFromItems(2) +
                    roundFavorPlayerAwayFromZero(actor.system.characteristics.con.basePlusLevels / 2) +
                    actor.system.characteristics.con.baseSumFiguredCharacteristicsFromItems(2)
                );
            },
        },
    );

    addPower(
        {
            key: "BASESIZE",
            name: "Base Size",
            type: ["characteristic"],
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(2),
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["ai", "automaton", "computer", "npc", "pc", "vehicle"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                const sizeDetails = char.actor.sizeDetails();
                return sizeDetails.description;
            },
            xml: `<BASESIZE XMLID="BASESIZE" ID="1744343837662" BASECOST="0.0" LEVELS="0" ALIAS="Size" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></BASESIZE>`,
        },
        {},
    );

    addPower(undefined, {
        key: "DEF",
        name: "Defense",
        type: ["characteristic"],
        base: fixedValueFunction(2),
        costPerLevel: fixedValueFunction(3),
        behaviors: [],
        duration: HERO.DURATION_TYPES.PERSISTENT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        ignoreForActor: staticIgnoreForActorFunction(["ai", "automaton", "computer", "npc", "pc"]),
        baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        xml: `<DEF XMLID="DEF" ID="1744343837380" BASECOST="0.0" LEVELS="0" ALIAS="DEF" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></DEF>`,
    });

    addPower(
        {
            key: "SIZE",
            name: "Vehicle Size",
            type: ["characteristic"],
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5),
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction(["ai", "automaton", "base2", "computer", "npc", "pc"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                const sizeDetails = char.actor.sizeDetails();
                return sizeDetails.description;
            },
            xml: `<SIZE XMLID="SIZE" ID="1744343742720" BASECOST="0.0" LEVELS="0" ALIAS="Size" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></SIZE>`,
        },
        {},
    );

    // HD extendable characteristics
    addPower(
        {
            key: "CUSTOM1",
            name: "Custom Characteristic 1",
            type: ["characteristic"],
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM2",
            name: "Custom Characteristic 2",
            type: ["characteristic"],
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(5), // TODO: Not actually correct ... depends on the setup
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]), // Everything, until supported
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
        duration: HERO.DURATION_TYPES.INSTANT,
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
        costEnd: true, // Maneuvers that don't use strength cost 1 END
        target: "target's dcv",
        ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            behaviors: ["non-hd", "optional-maneuver", "activatable"],
            name: "Club Weapon",
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
        duration: HERO.DURATION_TYPES.INSTANT,
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: true, // Maneuvers that don't use strength cost 1 END
        target: "target's dcv",
        ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE), // TODO: Not correct for all possible
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE), // TODO: Not correct for all possible.
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
        duration: HERO.DURATION_TYPES.INSTANT,
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE), // TODO: Not correct for all
        costEnd: true, // Maneuvers that don't use strength cost 1 END
        target: "target's dcv",
        ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true, // Maneuvers that don't use strength cost 1 END
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
        duration: HERO.DURATION_TYPES.INSTANT,
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
        costEnd: false,
        target: "target's dcv",
        ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: false,
            target: "target's dcv",
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
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
            base: fixedValueFunction(0),
            perceivability: "inobvious",
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            costPerLevel: fixedValueFunction(20),
            // There aren't really any LEVELS or a .value for this power, no need to show on CHARACTERISTICS tab
            ignoreForActor: staticIgnoreForActorFunction([
                "pc",
                "npc",
                "automaton",
                "vehicle",
                "base2",
                "computer",
                "ai",
            ]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            img: `systems/hero6efoundryvttv2/icons/movement/star-gate.svg`,
            xml: `<POWER XMLID="EXTRADIMENSIONALMOVEMENT" ID="1709333909749" BASECOST="20.0" LEVELS="0" ALIAS="Extra-Dimensional Movement" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Dimension" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "FLIGHT",
            type: ["movement"],
            behaviors: ["activatable"],
            base: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            img: "icons/svg/wing.svg",
            xml: `<POWER XMLID="FLIGHT" ID="1709333921734" BASECOST="0.0" LEVELS="1" ALIAS="Flight" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "FIXEDLOCATION",
            type: ["movement"],
            behaviors: ["activatable"],
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "Target’s DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="FIXEDLOCATION" ID="1709334034085" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation: Fixed Location" POSITION="82" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FLOATINGLOCATION",
            type: ["movement"],
            behaviors: ["activatable"],
            base: fixedValueFunction(0),
            costPerLevel: fixedValueFunction(0),
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "Target’s DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            ignoreForActor: staticIgnoreForActorFunction([
                "ai",
                "automaton",
                "base2",
                "computer",
                "npc",
                "pc",
                "vehicle",
            ]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="FLOATINGLOCATION" ID="1709334037026" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation: Floating Fixed Location" POSITION="83" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FTL",
            type: ["movement"],
            behaviors: ["activatable"],
            base: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(2),
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            img: `systems/hero6efoundryvttv2/icons/movement/rocket.svg`,
            xml: `<POWER XMLID="FTL" ID="1712026014674" BASECOST="10.0" LEVELS="0" ALIAS="Faster-Than-Light Travel" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(undefined, {
        key: "GLIDING",
        type: ["movement"],
        behaviors: ["activatable"],
        base: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        costPerLevel: fixedValueFunction(1),
        ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
        baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
        img: `systems/hero6efoundryvttv2/icons/movement/hang-glider.svg`,
        xml: `<POWER XMLID="GLIDING" ID="1709342639684" BASECOST="0.0" LEVELS="1" ALIAS="Gliding" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></POWER>`,
    });

    addPower(
        {
            key: "LEAPING",
            name: "Leaping",
            base: function (actor) {
                if (actor.type === "vehicle") {
                    return 0;
                }

                return 4;
            },
            costPerLevel: fixedValueFunction(1 / 2),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            notes: function (char) {
                return `${Math.max(0, char.value)}${getSystemDisplayUnits(
                    char.actor.is5e,
                )} forward, ${Math.max(0, Math.round(char.value / 2))}${getSystemDisplayUnits(char.actor.is5e)} upward`;
            },
            img: "icons/svg/jump.svg",
            xml: `<LEAPING XMLID="LEAPING" ID="1709333946167" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="55" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></LEAPING>`,
        },
        {
            behaviors: ["activatable", "figured", "figuredSTR"],
            base: function (actor) {
                if (actor.type === "vehicle") {
                    return 0;
                }

                return 2;
            },
            costPerLevel: fixedValueFunction(1),
            figured5eCharacteristic: function (actor) {
                // STR/2.5 = free meters of leaping
                // Div by 2 again to get inches to match HD
                // LEAPING is technically not a figured characteristic, behaves a bit more like a calculated but with LEVELS
                // You can end up with .5 remainders for a half inch

                //  Vehicles all start with Leaping 0"; they do not get any
                // "free" inches of Leaping from their STR.
                if (actor.type === "vehicle") {
                    return 0;
                }
                return Math.floor(actor.system.characteristics.str.value / 2.5) / 2;
            },
        },
    );

    addPower(
        {
            key: "RUNNING",
            base: fixedValueFunction(12),
            costPerLevel: fixedValueFunction(1),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            img: "icons/svg/walk.svg",
            xml: `<RUNNING XMLID="RUNNING" ID="1709334005554" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="72" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></RUNNING>`,
        },
        {
            base: fixedValueFunction(6),
            costPerLevel: fixedValueFunction(2),
        },
    );

    addPower(
        {
            key: "SWIMMING",
            base: fixedValueFunction(4),
            costPerLevel: fixedValueFunction(1 / 2),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            img: "icons/svg/whale.svg",
            xml: `<SWIMMING XMLID="SWIMMING" ID="1709334019357" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="77" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"></SWIMMING>`,
        },
        {
            base: fixedValueFunction(2),
            costPerLevel: fixedValueFunction(1),
        },
    );
    addPower(
        {
            key: "SWINGING",
            base: fixedValueFunction(0),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            rangeText: function (item) {
                // The maximum length of the swingline
                let distanceInMetres = item.basePointsPlusAdders * 10;
                return `Max swingline length ${getRoundedUpDistanceInSystemUnits(distanceInMetres, item.actor.is5e)}`;
            },
            costEnd: true,
            costPerLevel: fixedValueFunction(1 / 2),
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            img: `systems/hero6efoundryvttv2/icons/movement/grapple-hook.svg`,
            xml: `<POWER XMLID="SWINGING" ID="1709334021575" BASECOST="0.0" LEVELS="1" ALIAS="Swinging" POSITION="78" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            costPerLevel: fixedValueFunction(1),
        },
    );

    addPower(
        {
            key: "TELEPORTATION",
            base: fixedValueFunction(0),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            img: "icons/svg/teleport.svg",
            xml: `<POWER XMLID="TELEPORTATION" ID="1709334031905" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation" POSITION="81" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            costPerLevel: fixedValueFunction(2),
        },
    );
    addPower(
        {
            key: "TUNNELING",
            base: fixedValueFunction(0),
            type: ["movement"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            ignoreForActor: staticIgnoreForActorFunction(["base2", "computer", "ai"]),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            img: "icons/svg/burrow.svg",
            xml: `<POWER XMLID="TUNNELING" ID="1709334041436" BASECOST="2.0" LEVELS="1" ALIAS="Tunneling" POSITION="85" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"></POWER>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="ACROBATICS" BASECOST="3.0" LEVELS="0" ALIAS="Acrobatics" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "ACTING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="ACTING" ID="1709161468976" BASECOST="3.0" LEVELS="0" ALIAS="Acting" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "ANALYZE",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="ANALYZE" ID="1709161469684" BASECOST="3.0" LEVELS="0" ALIAS="Analyze" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Agility Skills" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            cost: function (skill) {
                // 6e Cost: 2 Character Points for a category,
                // +1 point for each additional category;
                // +1 to roll with all categories per +2 points
                const categories = skill.adders.filter((a) => a.XMLID !== "ADDER");
                const levels = parseInt(skill.system.LEVELS);
                if (categories.length === 0) {
                    return 3 + this.costPerLevel() * levels;
                }
                return this.costPerLevel() * levels;
            },
            addersCost: function (skill) {
                const categories = skill.adders.filter((a) => a.XMLID !== "ADDER");
                const customAdders = skill.adders.filter((a) => a.XMLID === "ADDER");
                if (categories.length === 0) {
                    return 0;
                }
                let _cost = categories.length + 1;
                for (const adder of customAdders) {
                    _cost += adder.cost;
                }
                return _cost;
            },
            xml: `<SKILL XMLID="ANIMAL_HANDLER" ID="1709161473096" BASECOST="0.0" LEVELS="0" ALIAS="Animal Handler" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "ARMORSMITH",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        categorized: true,
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="ARMORSMITH" ID="1763826715627" BASECOST="3.0" LEVELS="0" ALIAS="Armorsmith" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
    });
    addPower(
        {
            key: "AUTOFIRE_SKILLS",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="AUTOFIRE_SKILLS" ID="1709161475889" BASECOST="5.0" LEVELS="0" ALIAS="Autofire Skills" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ACCURATE" OPTIONID="ACCURATE" OPTION_ALIAS="Accurate Sprayfire" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "BREAKFALL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="BREAKFALL" ID="1709161478362" BASECOST="3.0" LEVELS="0" ALIAS="Breakfall" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "BRIBERY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="BRIBERY" ID="1709161479206" BASECOST="3.0" LEVELS="0" ALIAS="Bribery" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "BUGGING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="BUGGING" ID="1709161479965" BASECOST="3.0" LEVELS="0" ALIAS="Bugging" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "BUREAUCRATICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="BUREAUCRATICS" ID="1709161480723" BASECOST="3.0" LEVELS="0" ALIAS="Bureaucratics" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "CHARM",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CHARM" ID="1709161481624" BASECOST="3.0" LEVELS="0" ALIAS="Charm" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        undefined,
    );
    addPower(
        {
            key: "CLIMBING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CLIMBING" ID="1709161482605" BASECOST="3.0" LEVELS="0" ALIAS="Climbing" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "COMBAT_DRIVING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="COMBAT_DRIVING" ID="1709161483399" BASECOST="3.0" LEVELS="0" ALIAS="Combat Driving" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "COMBAT_LEVELS",
            type: ["skill"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            costEnd: false,
            refreshAttackDialogWhenChanged: true,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            editOptions: {
                showAttacks: fixedValueFunction(true),
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
            heroValidation: function (item) {
                const validations = [];

                // If there are no mapped attacks then the CSL won't work
                if (!item.isCslValidHeroValidation) {
                    validations.push({
                        property: "ALIAS",
                        message: `There are no attacks associated with this CSL.`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.ERROR,
                    });
                }

                // Ensure that all custom adders are mapped to objects
                const customLinkAddersWithoutItems = item.customLinkAddersWithoutItems;
                if (customLinkAddersWithoutItems.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `Some custom adders do not match any attack item NAME, ALIAS, or XMLID. Check ${customLinkAddersWithoutItems.map((adder) => `"${adder.ALIAS}"`).join(", ")} for correct spelling`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Some CSLs have limits on the number of supported attacks
                // Custom adders are how we track how many attacks that this CSL applies to.
                const customAdders = item.customLinkAdders;
                const maxCustomAdders = item.maxCustomCslAdders;
                if (customAdders.length > maxCustomAdders) {
                    validations.push({
                        property: "ALIAS",
                        message: `Expecting CSL to have ${maxCustomAdders} or fewer attacks. Consider consolidating related attacks into a list or multipower`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Ensure that all of the defined custom adders are supported
                const notAllowedItemsInCslCustomAdders = item.notAllowedItemsInCslCustomAdders;
                if (notAllowedItemsInCslCustomAdders.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `${notAllowedItemsInCslCustomAdders.length} linked attacks are not valid for this type of CSL. Remove the link to ${notAllowedItemsInCslCustomAdders.map((item) => item.name).join(", ")}`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                return validations;
            },
            xml: `<SKILL XMLID="COMBAT_LEVELS" ID="1709161485197" BASECOST="0.0" LEVELS="1" ALIAS="Combat Skill Levels" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="with any single attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        {
            heroValidation: function (item) {
                const validations = [];

                // If there are no mapped attacks then the CSL won't work
                if (!item.isCslValidHeroValidation) {
                    validations.push({
                        property: "ALIAS",
                        message: `There are no attacks associated with this CSL.`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.ERROR,
                    });
                }

                // Ensure that all custom adders are mapped to objects
                const customLinkAddersWithoutItems = item.customLinkAddersWithoutItems;
                if (customLinkAddersWithoutItems.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `Some custom adders do not match any attack item NAME, ALIAS, or XMLID. Check ${customLinkAddersWithoutItems.map((adder) => `"${adder.ALIAS}"`).join(", ")} for correct spelling`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Some CSLs have limits on the number of supported attacks
                // Custom adders are how we track how many attacks that this CSL applies to.
                const customAdders = item.customLinkAdders;
                const maxCustomAdders = item.maxCustomCslAdders;
                if (customAdders.length > maxCustomAdders) {
                    validations.push({
                        property: "ALIAS",
                        message: `Expecting CSL to have ${maxCustomAdders} or fewer attacks. Consider consolidating related attacks into a list or multipower`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Ensure that all of the defined custom adders are supported
                const notAllowedItemsInCslCustomAdders = item.notAllowedItemsInCslCustomAdders;
                if (notAllowedItemsInCslCustomAdders.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `${notAllowedItemsInCslCustomAdders.length} linked attacks are not valid for this type of CSL. Remove the link to ${notAllowedItemsInCslCustomAdders.map((item) => item.name).join(", ")}`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // TWODCV/TWOOCV type specified correctly?
                if (
                    (item.system.OPTIONID === "TWODCV" || item.system.OPTIONID === "TWOOCV") &&
                    item.csl5eCslDcvOcvTypes.length !== 2
                ) {
                    validations.push({
                        property: "OPTION_ALIAS",
                        message: `Expecting two of these words [${Object.keys(HERO.CSL_5E_CV_LEVELS_TYPES).join(", ")}]`,
                        example: `DCV with HTH and Ranged combat`,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                } else if (item.system.OPTIONID === "HTHDCV" && item.csl5eCslDcvOcvTypes.length !== 1) {
                    validations.push({
                        property: "OPTION_ALIAS",
                        message: `Expecting one of these words [${[HERO.CSL_5E_CV_LEVELS_TYPES.hth, HERO.CSL_5E_CV_LEVELS_TYPES.ranged].join(", ")}]`,
                        example: `DCV with HTH and Ranged combat`,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                return validations;
            },
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="COMBAT_PILOTING" ID="1709161484209" BASECOST="3.0" LEVELS="0" ALIAS="Combat Piloting" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "COMPUTER_PROGRAMMING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="COMPUTER_PROGRAMMING" ID="1709161488163" BASECOST="3.0" LEVELS="0" ALIAS="Computer Programming" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CONCEALMENT",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CONCEALMENT" ID="1709161490757" BASECOST="3.0" LEVELS="0" ALIAS="Concealment" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CONTORTIONIST",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CONTORTIONIST" ID="1709161491534" BASECOST="3.0" LEVELS="0" ALIAS="Contortionist" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CONVERSATION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CONVERSATION" ID="1709161492343" BASECOST="3.0" LEVELS="0" ALIAS="Conversation" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CRAMMING",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CRAMMING" ID="1709161493162" BASECOST="5.0" LEVELS="0" ALIAS="Cramming" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CRIMINOLOGY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CRIMINOLOGY" ID="1709161494054" BASECOST="3.0" LEVELS="0" ALIAS="Criminology" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CRYPTOGRAPHY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CRYPTOGRAPHY" ID="1709161496416" BASECOST="3.0" LEVELS="0" ALIAS="Cryptography" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOMSKILL",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="CUSTOMSKILL" ID="1709161497972" BASECOST="0.0" LEVELS="1" ALIAS="Custom Skill" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" ROLL="0"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "DEDUCTION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="DEDUCTION" ID="1709161500786" BASECOST="3.0" LEVELS="0" ALIAS="Deduction" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "DEFENSE_MANEUVER",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="DEFENSE_MANEUVER" ID="1709161501659" BASECOST="3.0" LEVELS="0" ALIAS="Defense Maneuver" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="I" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "DEMOLITIONS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="DEMOLITIONS" ID="1709161503996" BASECOST="3.0" LEVELS="0" ALIAS="Demolitions" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "DISGUISE",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="DISGUISE" ID="1709161504988" BASECOST="3.0" LEVELS="0" ALIAS="Disguise" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "ELECTRONICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="ELECTRONICS" ID="1709161505775" BASECOST="3.0" LEVELS="0" ALIAS="Electronics" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "FAST_DRAW",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="FAST_DRAW" ID="1709161506592" BASECOST="3.0" LEVELS="0" ALIAS="Fast Draw" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "FEINT",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="FEINT" ID="1763826725179" BASECOST="3.0" LEVELS="0" ALIAS="Feint" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
    });
    addPower(
        {
            key: "FORENSIC_MEDICINE",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="FORENSIC_MEDICINE" ID="1709161509009" BASECOST="3.0" LEVELS="0" ALIAS="Forensic Medicine" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="FORGERY" ID="1709161509923" BASECOST="0.0" LEVELS="0" ALIAS="Forgery" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="GAMBLING" ID="1709161511974" BASECOST="0.0" LEVELS="0" ALIAS="Gambling" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "HIGH_SOCIETY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="HIGH_SOCIETY" ID="1709161513798" BASECOST="3.0" LEVELS="0" ALIAS="High Society" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "HOIST",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="HOIST" ID="1763826732484" BASECOST="3.0" LEVELS="0" ALIAS="Hoist" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
    });

    addPower(undefined, {
        key: "INSTRUCTOR",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="INSTRUCTOR" ID="1763826734980" BASECOST="3.0" LEVELS="0" ALIAS="Instructor" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
    });
    addPower(
        {
            key: "INTERROGATION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="INTERROGATION" ID="1709161516272" BASECOST="3.0" LEVELS="0" ALIAS="Interrogation" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "INVENTOR",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="INVENTOR" ID="1709161517097" BASECOST="3.0" LEVELS="0" ALIAS="Inventor" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "KNOWLEDGE_SKILL",
            type: ["skill"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<SKILL XMLID="KNOWLEDGE_SKILL" ID="1709161518105" BASECOST="2.0" LEVELS="0" ALIAS="KS" POSITION="34" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "LANGUAGES",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="LANGUAGES" ID="1709161520791" BASECOST="1.0" LEVELS="0" ALIAS="Language" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASIC" OPTIONID="BASIC" OPTION_ALIAS="basic conversation" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FAMILIARITY="No" PROFICIENCY="No" NATIVE_TONGUE="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "LIPREADING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="LIPREADING" ID="1709161523279" BASECOST="3.0" LEVELS="0" ALIAS="Lipreading" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "LOCKPICKING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="LOCKPICKING" ID="1709161524481" BASECOST="3.0" LEVELS="0" ALIAS="Lockpicking" POSITION="37" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "MECHANICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="MECHANICS" ID="1709161525362" BASECOST="3.0" LEVELS="0" ALIAS="Mechanics" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "MENTAL_COMBAT_LEVELS",
            type: ["skill"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            refreshAttackDialogWhenChanged: true,
            editOptions: {
                showAttacks: fixedValueFunction(true),
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
            heroValidation: function (item) {
                const validations = [];

                // Ensure that all custom adders are mapped to objects
                const customLinkAddersWithoutItems = item.customLinkAddersWithoutItems;
                if (customLinkAddersWithoutItems.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `Some custom adders do not match any attack item NAME, ALIAS, or XMLID. Check ${customLinkAddersWithoutItems.map((adder) => `"${adder.ALIAS}"`).join(", ")} for correct spelling`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Some CSLs have limits on the number of supported attacks
                // Custom adders are how we track how many attacks that this CSL applies to.
                const customAdders = item.customLinkAdders;
                const maxCustomAdders = item.maxCustomCslAdders;
                if (customAdders.length > maxCustomAdders) {
                    validations.push({
                        property: "ALIAS",
                        message: `Expecting CSL to have ${maxCustomAdders} or fewer attacks. Consider consolidating related attacks into a list or multipower`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Ensure that all of the defined custom adders are supported
                const notAllowedItemsInCslCustomAdders = item.notAllowedItemsInCslCustomAdders;
                if (notAllowedItemsInCslCustomAdders.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `${notAllowedItemsInCslCustomAdders.length} linked attacks are not valid for this type of CSL. Remove the link to ${notAllowedItemsInCslCustomAdders.map((item) => item.name).join(", ")}`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                return validations;
            },
            xml: `<SKILL XMLID="MENTAL_COMBAT_LEVELS" ID="1709161526214" BASECOST="0.0" LEVELS="1" ALIAS="Mental Combat Skill Levels" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="with a single Mental Power" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        undefined,
    );
    addPower(
        {
            key: "MIMICRY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="MIMICRY" ID="1709161528926" BASECOST="3.0" LEVELS="0" ALIAS="Mimicry" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "MIF",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            name: "Musical Instrument Familiarity",
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="MIF" ID="1762890667798" BASECOST="0.0" LEVELS="0" ALIAS="Musical Instrument Familiarity" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1732469522885" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="NAVIGATION" ID="1709161529843" BASECOST="0.0" LEVELS="0" ALIAS="Navigation" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "NEGATIVECOMBATSKILLLEVELS",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<POWER XMLID="NEGATIVECOMBATSKILLLEVELS" ID="1763830401211" BASECOST="0.0" LEVELS="1" ALIAS="Negative Combat Skill Levels" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="DCV" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
    });
    addPower(undefined, {
        key: "NEGATIVEPENALTYSKILLLEVELS",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<POWER XMLID="NEGATIVEPENALTYSKILLLEVELS" ID="1763830404491" BASECOST="0.0" LEVELS="1" ALIAS="Negative Penalty Skill Levels" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="[a single attack]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Hit Location modifiers" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
    });
    addPower(undefined, {
        key: "NEGATIVESKILLLEVELS",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<POWER XMLID="NEGATIVESKILLLEVELS" ID="1763830407179" BASECOST="0.0" LEVELS="1" ALIAS="Negative Skill Levels" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="[any one Skill]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
    });

    addPower(
        {
            key: "ORATORY",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="ORATORY" ID="1709161532182" BASECOST="3.0" LEVELS="0" ALIAS="Oratory" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(undefined, {
        key: "PARACHUTING",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="PARACHUTING" ID="1763827772291" BASECOST="3.0" LEVELS="0" ALIAS="Parachuting" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
    });
    addPower(
        {
            key: "PARAMEDICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="PARAMEDICS" ID="1709161533283" BASECOST="3.0" LEVELS="0" ALIAS="Paramedics" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "PENALTY_SKILL_LEVELS",
            type: ["skill"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            editOptions: {
                showAttacks: function (item) {
                    // DPSLs do not have attacks/linked custom adders
                    if (item.system.OPTIONID === "SINGLEDCV" || item.system.OPTIONID === "GROUPDCV") {
                        return false;
                    }

                    return true;
                },
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
                        message: `Expecting one of these words [${Object.keys(HERO.PENALTY_SKILL_LEVELS_TYPES).join(", ")}].`,
                        example: `to offset negative Range OCV modifiers with all attacks`,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // If there are no mapped attacks then the PSL won't work
                if (!item.isPslValidHeroValidation) {
                    validations.push({
                        property: "ALIAS",
                        message: `There are no attacks associated with this PSL.`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.ERROR,
                    });
                }

                // Ensure that all custom adders are mapped to objects
                const customLinkAddersWithoutItems = item.customLinkAddersWithoutItems;
                if (customLinkAddersWithoutItems.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `Some custom adders do not match any attack item NAME, ALIAS, or XMLID. Check ${customLinkAddersWithoutItems.map((adder) => `"${adder.ALIAS}"`).join(", ")} for correct spelling`,
                        example: `Strike`,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Some PSLs have limits on the number of supported attacks
                // Custom adders are how we track how many attacks that this PSL applies to.
                const customAdders = item.customLinkAdders;
                const maxCustomAdders = item.maxCustomPslAdders;
                if (customAdders.length > maxCustomAdders) {
                    validations.push({
                        property: "ALIAS",
                        message: `Expecting PSL to have ${maxCustomAdders} or fewer attacks. Consider consolidating related attacks into a list or multipower`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Ensure that all of the defined custom adders are supported
                const notAllowedItemsInPslCustomAdders = item.notAllowedItemsInPslCustomAdders;
                if (notAllowedItemsInPslCustomAdders.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `${notAllowedItemsInPslCustomAdders.length} linked attacks are not valid for this type of PSL. Remove the link to ${notAllowedItemsInPslCustomAdders.map((item) => item.name).join(", ")}`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
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
            xml: `<SKILL XMLID="PENALTY_SKILL_LEVELS" ID="1709161534055" BASECOST="0.0" LEVELS="1" ALIAS="Penalty Skill Levels" POSITION="44" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="to offset a specific negative OCV modifier with any single attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        {
            editOptions: {
                showAttacks: fixedValueFunction(true),
                editableOption_ALIAS: false,
                choices: [
                    {
                        OPTIONID: "SINGLE",
                        OPTION: "SINGLE",
                        OPTION_ALIAS: "a single attack",
                    },
                    {
                        OPTIONID: "TIGHT",
                        OPTION: "TIGHT",
                        OPTION_ALIAS: "a tight group of attacks",
                    },
                    {
                        OPTIONID: "ALL",
                        OPTION: "ALL",
                        OPTION_ALIAS: "all attacks",
                    },
                ],
                choicesInput: [
                    { INPUT: "Hit Location modifiers" },
                    { INPUT: "Range Modifier" },
                    { INPUT: "Throwing modifiers" },
                    { INPUT: "Armor penalties to DCV" },
                ],
                penaltyChoices: {
                    hitLocation: "Hit Location modifiers",
                    range: "Range Modifier",
                    throwing: "Throwing modifiers",
                    armor: "Armor penalties to DCV",
                },
            },
            heroValidation: function (item) {
                const validations = [];

                // Penalty Type
                if (!item.pslPenaltyType) {
                    validations.push({
                        property: "INPUT",
                        message: `Expecting one of these words [${Object.keys(HERO.PENALTY_SKILL_LEVELS_TYPES).join(", ")}].`,
                        example: `to offset range penalty OCV modifier with any single attack`,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // If there are no mapped attacks then the PSL won't work
                if (!item.isPslValidHeroValidation) {
                    validations.push({
                        property: "ALIAS",
                        message: `There are no attacks associated with this PSL.`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.ERROR,
                    });
                }

                // Ensure that all custom adders are mapped to objects
                const customLinkAddersWithoutItems = item.customLinkAddersWithoutItems;
                if (customLinkAddersWithoutItems.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `Some custom adders do not match any attack item NAME, ALIAS, or XMLID. Check ${customLinkAddersWithoutItems.map((adder) => `"${adder.ALIAS}"`).join(", ")} for correct spelling`,
                        example: `Strike`,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Some PSLs have limits on the number of supported attacks
                // Custom adders are how we track how many attacks that this PSL applies to.
                const customAdders = item.customLinkAdders;
                const maxCustomAdders = item.maxCustomPslAdders;
                if (customAdders.length > maxCustomAdders) {
                    validations.push({
                        property: "ALIAS",
                        message: `Expecting PSL to have ${maxCustomAdders} or fewer attacks. Consider consolidating related attacks into a list or multipower`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Ensure that all of the defined custom adders are supported
                const notAllowedItemsInPslCustomAdders = item.notAllowedItemsInPslCustomAdders;
                if (notAllowedItemsInPslCustomAdders.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `${notAllowedItemsInPslCustomAdders.length} linked attacks are not valid for this type of PSL. Remove the link to ${notAllowedItemsInPslCustomAdders.map((item) => item.name).join(", ")}`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                return validations;
            },
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "SINGLE":
                        return 1.5;
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="PERSUASION" ID="1763827781395" BASECOST="3.0" LEVELS="0" ALIAS="Persuasion" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "POISONING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="POISONING" ID="1763827783123" BASECOST="3.0" LEVELS="0" ALIAS="Poisoning" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "POWERSKILL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="POWERSKILL" ID="1709161537007" BASECOST="3.0" LEVELS="0" ALIAS="Power" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "PROFESSIONAL_SKILL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(1),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="PROFESSIONAL_SKILL" ID="1709161539381" BASECOST="2.0" LEVELS="0" ALIAS="PS" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "RAPID_ATTACK_HTH",
            type: ["skill"],
            behaviors: [],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="RAPID_ATTACK_HTH" ID="1709161541446" BASECOST="10.0" LEVELS="0" ALIAS="Rapid Attack" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "RAPID_ATTACK_RANGED",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="RAPID_ATTACK_RANGED" ID="1763827789995" BASECOST="5.0" LEVELS="0" ALIAS="Rapid Attack (Ranged)" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
    });
    addPower(undefined, {
        key: "RESEARCH",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="RESEARCH" ID="1763827791931" BASECOST="3.0" LEVELS="0" ALIAS="Research" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
    });
    addPower(
        {
            key: "RIDING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="RIDING" ID="1709161542264" BASECOST="3.0" LEVELS="0" ALIAS="Riding" POSITION="48" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "SCIENCE_SKILL",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(1),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="SCIENCE_SKILL" ID="1709161543124" BASECOST="2.0" LEVELS="0" ALIAS="Science Skill" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "SECURITY_SYSTEMS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="SECURITY_SYSTEMS" ID="1709161545330" BASECOST="3.0" LEVELS="0" ALIAS="Security Systems" POSITION="50" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SEDUCTION",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="SEDUCTION" ID="1763827795667" BASECOST="3.0" LEVELS="0" ALIAS="Seduction" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
    });
    addPower(
        {
            key: "SHADOWING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="SHADOWING" ID="1709161547363" BASECOST="3.0" LEVELS="0" ALIAS="Shadowing" POSITION="51" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "SKILL_LEVELS",
            type: ["skill"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            xml: `<SKILL XMLID="SKILL_LEVELS" ID="1709161548219" BASECOST="0.0" LEVELS="1" ALIAS="Skill Levels" POSITION="52" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CHARACTERISTIC" OPTIONID="CHARACTERISTIC" OPTION_ALIAS="with single Skill or Characteristic Roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="SLEIGHT_OF_HAND" ID="1709161550467" BASECOST="3.0" LEVELS="0" ALIAS="Sleight Of Hand" POSITION="53" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SPELL",
        type: ["skill"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="SPELL" ID="1763827799555" BASECOST="3.0" LEVELS="0" ALIAS="Spell" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
    });
    addPower(
        {
            key: "STEALTH",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="STEALTH" ID="1709161551292" BASECOST="3.0" LEVELS="0" ALIAS="Stealth" POSITION="54" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "STREETWISE",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="STREETWISE" ID="1709161552070" BASECOST="3.0" LEVELS="0" ALIAS="Streetwise" POSITION="55" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="SURVIVAL" ID="1709161552845" BASECOST="0.0" LEVELS="0" ALIAS="Survival" POSITION="56" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "SYSTEMS_OPERATION",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="SYSTEMS_OPERATION" ID="1709161555044" BASECOST="3.0" LEVELS="0" ALIAS="Systems Operation" POSITION="57" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {
            /*5e is a SYSTEM category */
        },
    );

    addPower(
        {
            key: "TACTICS",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="TACTICS" ID="1709161557125" BASECOST="3.0" LEVELS="0" ALIAS="Tactics" POSITION="58" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "TEAMWORK",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="TEAMWORK" ID="1709161558462" BASECOST="3.0" LEVELS="0" ALIAS="Teamwork" POSITION="59" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "TRACKING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="TRACKING" ID="1709161559355" BASECOST="3.0" LEVELS="0" ALIAS="Tracking" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "TRADING",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="TRADING" ID="1709161560240" BASECOST="3.0" LEVELS="0" ALIAS="Trading" POSITION="61" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="TWO_WEAPON_FIGHTING_HTH" ID="1709161562189" BASECOST="10.0" LEVELS="0" ALIAS="Two-Weapon Fighting" POSITION="62" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "TWO_WEAPON_FIGHTING_RANGED",
        type: ["skill"],
        behaviors: [],
        costPerLevel: fixedValueFunction(2),
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<SKILL XMLID="TWO_WEAPON_FIGHTING_RANGED" ID="1763827806075" BASECOST="10.0" LEVELS="0" ALIAS="Two-Weapon Fighting (Ranged)" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
    });

    addPower(
        {
            key: "VENTRILOQUISM",
            type: ["skill"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<SKILL XMLID="VENTRILOQUISM" ID="1709161563244" BASECOST="3.0" LEVELS="0" ALIAS="Ventriloquism" POSITION="63" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "WEAPON_FAMILIARITY",
            type: ["skill"],
            behaviors: ["activatable"], // FIXME: activatable for WF: Off Hand until we have a way to show we have off hand weapon equipped.
            costPerLevel: fixedValueFunction(2),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            editOptions: {
                hideLEVELS: true,
            },
            xml: `<SKILL XMLID="WEAPON_FAMILIARITY" ID="1709161564246" BASECOST="0.0" LEVELS="0" ALIAS="WF" POSITION="64" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"></SKILL>`,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            categorized: true,
            xml: `<SKILL XMLID="WEAPONSMITH" ID="1709161565889" BASECOST="0.0" LEVELS="0" ALIAS="Weaponsmith" POSITION="65" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "JACK_OF_ALL_TRADES",
            type: ["skill", "enhancer"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            activePoints: function (item) {
                return item.childItems.reduce(
                    (accumulator, currentValue) => accumulator + currentValue.activePoints,
                    0,
                );
            },
            characterPointCostForElementalControl: function (item) {
                const activePointsForEntireCompoundPower = item.activePoints;

                // need ratio of Active Points
                let cpEc = 0;
                for (const child of item.childItems) {
                    const childRatioAp = child.activePoints / activePointsForEntireCompoundPower;
                    const childRatioEcBaseCost = item.elementalControl.system.BASECOST * childRatioAp;
                    cpEc += roundFavorPlayerTowardsZero(
                        (Math.max(childRatioEcBaseCost * 2, child.activePoints) - childRatioEcBaseCost) /
                            (1 + child._limitationCost),
                    );
                }
                return cpEc;
            },
            realCost: function (item) {
                return item.childItems.reduce((accumulator, currentValue) => accumulator + currentValue.realCost, 0);
            },
            rangeForItem: function () {
                console.error(`rangeForItem invoked for a COMPOUNDPOWER.`);
                return HERO.RANGE_TYPES.SELF;
            },
            xml: `<POWER XMLID="COMPOUNDPOWER" ID="1763927770583" BASECOST="0.0" LEVELS="0" ALIAS="Compound Power" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
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
            rangeForItem: function () {
                console.error(`rangeForItem invoked for a DIFFERINGMODIFIER.`);
                return HERO.RANGE_TYPES.SELF;
            },
            xml: `<POWER XMLID="DIFFERINGMODIFIER" ID="1763927833232" BASECOST="0.0" LEVELS="1" ALIAS="Differing Modifiers" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
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
        rangeForItem: function () {
            console.error(`rangeForItem invoked for a ELEMENTAL_CONTROL.`);
            return HERO.RANGE_TYPES.SELF;
        },
        xml: `<ELEMENTAL_CONTROL XMLID="GENERIC_OBJECT" ID="1763928737811" BASECOST="5.0" LEVELS="0" ALIAS="Elemental Control" POSITION="109" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1"></ELEMENTAL_CONTROL>`,
    });

    addPower(
        {
            key: "LIST",
            type: ["framework"],
            behaviors: [],
            costPerLevel: fixedValueFunction(0),
            costEnd: false,
            isContainer: true,
            rangeForItem: function () {
                console.error(`rangeForItem invoked for a LIST.`);
                return HERO.RANGE_TYPES.SELF;
            },
            xml: `<LIST XMLID="GENERIC_OBJECT" ID="1760312857170" BASECOST="0.0" LEVELS="0" ALIAS="Disad List" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></LIST>`,
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
            heroValidation: function (item) {
                const validations = [];

                // Advantages for Multipower Reserves
                const advantages = item.system.MODIFIER.filter((adder) => !adder.PRIVATE && adder.cost > 0);
                if (advantages.length > 0) {
                    validations.push({
                        property: advantages.map((m) => m.XMLID),
                        message: `Gamemasters should be wary of advantages [${advantages.map((m) => m.XMLID).join(",")}] applied to all slots as it could unbalance the game.`,
                        severity: HERO.VALIDATION_SEVERITY.INFO,
                    });
                }

                return validations;
            },
            rangeForItem: function () {
                console.error(`rangeForItem invoked for a MULTIPOWER.`);
                return HERO.RANGE_TYPES.SELF;
            },
            xml: `<MULTIPOWER XMLID="GENERIC_OBJECT" ID="1763928841940" BASECOST="5.0" LEVELS="0" ALIAS="Multipower" POSITION="109" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1"></MULTIPOWER>`,
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
                    roundFavorPlayerTowardsZero(poolCost / 2);
                const _limitationCost = item._limitationCost;

                if (_limitationCost !== 0) {
                    controlCost = roundFavorPlayerTowardsZero(controlCost / (1 + _limitationCost));
                }

                return poolCost + controlCost;
            },
            costEnd: false,
            isContainer: true,
            rangeForItem: function () {
                console.error(`rangeForItem invoked for a VPP.`);
                return HERO.RANGE_TYPES.SELF;
            },
            xml: `<VPP XMLID="GENERIC_OBJECT" ID="1753583376594" BASECOST="0.0" LEVELS="20" ALIAS="Variable Power Pool" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1"></VPP>`,
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
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<PERK XMLID="ACCESS" ID="1709161411911" BASECOST="0.0" LEVELS="3" ALIAS="Access" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );
    addPower(undefined, {
        key: "Advanced Tech",
        type: ["perk"],
        behaviors: [],
        duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        costPerLevel: function (item) {
            if (item.system.OPTIONID === "NORMAL") {
                return 15;
            } else {
                return 10;
            }
        },
        xml: `<PERK XMLID="Advanced Tech" ID="1709164896663" BASECOST="0.0" LEVELS="1" ALIAS="Advanced Tech" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NORMAL" OPTIONID="NORMAL" OPTION_ALIAS="15 pts / Level" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
    });
    addPower(
        {
            key: "ANONYMITY",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<PERK XMLID="ANONYMITY" ID="1709161415388" BASECOST="3.0" LEVELS="0" ALIAS="Anonymity" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "COMPUTER_LINK",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<PERK XMLID="COMPUTER_LINK" ID="1709161418315" BASECOST="3.0" LEVELS="0" ALIAS="Computer Link" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "CONTACT",
            type: ["perk"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1), // TODO: Not correct .. needs function
            xml: `<PERK XMLID="CONTACT" ID="1709161420959" BASECOST="0.0" LEVELS="1" ALIAS="Contact" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1710994081842" NAME=""></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOMPERK",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            xml: `<PERK XMLID="CUSTOMPERK" ID="1709161423608" BASECOST="0.0" LEVELS="1" ALIAS="Custom Perk" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" ROLL="0"></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "DEEP_COVER",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            xml: `<PERK XMLID="DEEP_COVER" ID="1709161426121" BASECOST="2.0" LEVELS="0" ALIAS="Deep Cover" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );

    addPower(undefined, {
        key: "FALSEIDENTITY",
        type: ["perk"],
        behaviors: [],
        duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
        name: "False Identity",
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
        xml: `<PERK XMLID="FALSEIDENTITY" ID="1709164911446" BASECOST="1.0" LEVELS="0" ALIAS="False Identity" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
    });
    addPower(
        {
            key: "FAVOR",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            xml: `<PERK XMLID="FAVOR" ID="1709161428760" BASECOST="1.0" LEVELS="0" ALIAS="Favor" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1710994081842" NAME=""></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "FOLLOWER",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            costPerLevel: fixedValueFunction(1 / 5),
            cost: function (item) {
                const basePoints = parseInt(item.system.BASEPOINTS) || 0;
                const number = item.system.NUMBER || 1;

                // A character can have double the number of
                // Followers for +5 CP (twice as many for +5 CP, four times as
                // many for +10 CP, and so on)
                const doublingCost = 5 * Math.ceil(Math.log2(number));
                return roundFavorPlayerTowardsZero(basePoints / 5 + doublingCost);
            },
            name: "Follower",
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<PERK XMLID="FOLLOWER" ID="1709161431234" BASECOST="0.0" LEVELS="0" ALIAS="Follower" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" NUMBER="1" BASEPOINTS="0" DISADPOINTS="0"></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "FRINGE_BENEFIT",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<PERK XMLID="FRINGE_BENEFIT" ID="1712005548112" BASECOST="0.0" LEVELS="0" ALIAS="Fringe Benefit" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "GROUNDS",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            costPerLevel: fixedValueFunction(0), // TODO: Not correct ... needs function
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<PERK XMLID="GROUNDS" ID="1759002590086" BASECOST="0.0" LEVELS="0" ALIAS="Grounds (x1 Base Size)" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "LOCATION",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            costPerLevel: fixedValueFunction(0), // TODO: Not correct ... needs function
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<PERK XMLID="LOCATION" ID="1759002587083" BASECOST="0.0" LEVELS="0" ALIAS="Location" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CITY" OPTIONID="CITY" OPTION_ALIAS="City" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "MONEY",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            costPerLevel: fixedValueFunction(1), // TODO: Not correct ... needs function
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<PERK XMLID="MONEY" ID="1709161436493" BASECOST="5.0" LEVELS="0" ALIAS="Money" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="WELL_OFF" OPTIONID="WELL_OFF" OPTION_ALIAS="Well Off" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "REPUTATION",
            type: ["perk", "disadvantage"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            name: "Positive Reputation",
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(0), // TODO: Not correct ... needs function
            // The minimum cost for the Positive Reputation Perk is 1 Character Point per
            // level, regardless of modifiers.
            minimumCost: 1,
            xml: `<PERK XMLID="REPUTATION" ID="1709161449527" BASECOST="0.0" LEVELS="1" ALIAS="Positive Reputation" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "RESOURCE_POOL",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            costPerLevel: fixedValueFunction(1),
            name: "Resource Points",
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<PERK XMLID="RESOURCE_POOL" ID="1709161452229" BASECOST="0.0" LEVELS="0" ALIAS="Resource Points" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EQUIPMENT" OPTIONID="EQUIPMENT" OPTION_ALIAS="Equipment Points" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FREE_POINTS="0"></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "VEHICLE_BASE",
            type: ["perk"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            costPerLevel: fixedValueFunction(1 / 5),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<PERK XMLID="VEHICLE_BASE" ID="1709161454715" BASECOST="0.0" LEVELS="0" ALIAS="Vehicles &amp; Bases" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" NUMBER="2" BASEPOINTS="4" DISADPOINTS="0"></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "WELL_CONNECTED",
            type: ["perk", "enhancer"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INHERENT, // There isn't strictly a duration but this can't be adjusted
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<WELL_CONNECTED XMLID="WELL_CONNECTED" ID="1710994081842" BASECOST="3.0" LEVELS="0" ALIAS="Well-Connected" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO"></WELL_CONNECTED>`,
        },
        {},
    );
})();

(function addTalentsToPowerList() {
    addPower(
        {
            key: "ABSOLUTE_RANGE_SENSE",
            type: ["talent", "sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from DETECT (sense) power
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="ABSOLUTE_RANGE_SENSE" ID="1709159935812" BASECOST="3.0" LEVELS="0" ALIAS="Absolute Range Sense" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "ABSOLUTE_TIME_SENSE",
            type: ["talent", "sense", "passive"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from DETECT (sense) power
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="ABSOLUTE_TIME_SENSE" ID="1709159936859" BASECOST="3.0" LEVELS="0" ALIAS="Absolute Time Sense" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "AMBIDEXTERITY",
            type: ["talent"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from PENALTY_SKILL_LEVELS
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="AMBIDEXTERITY" ID="1709159937654" BASECOST="1.0" LEVELS="0" ALIAS="Ambidexterity" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LEVEL1" OPTIONID="LEVEL1" OPTION_ALIAS="-2 Off Hand penalty" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "ANIMALFRIENDSHIP",
            type: ["talent"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.CONSTANT, // This is built from ANIMAL_HANDLER skill and PRE
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="ANIMALFRIENDSHIP" ID="1709159938402" BASECOST="20.0" LEVELS="0" ALIAS="Animal Friendship" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "BEASTSPEECH",
        type: ["talent"],
        behaviors: ["dice", "to-hit"],
        name: "Beast Speech",
        duration: HERO.DURATION_TYPES.INSTANT, // This is built from the TELEPATHY power
        target: "dmcv",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
        costEnd: false,
        usesStrength: false,
        costPerLevel: fixedValueFunction(0),
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<TALENT XMLID="BEASTSPEECH" ID="1709164944911" BASECOST="15.0" LEVELS="0" ALIAS="Beast Speech" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(undefined, {
        key: "BERSERKFURY",
        type: ["talent", "adjustment"],
        behaviors: ["dice", "to-hit"],
        name: "Berserk Fury",
        duration: HERO.DURATION_TYPES.INSTANT, // This is built from the AID power
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: true,
        usesStrength: false,
        costPerLevel: fixedValueFunction(0),
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<TALENT XMLID="BERSERKFURY" ID="1709164947152" BASECOST="16.0" LEVELS="0" ALIAS="Berserk Fury" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "BUMP_OF_DIRECTION",
            type: ["talent", "sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from DETECT (sense) power
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="BUMP_OF_DIRECTION" ID="1709159939134" BASECOST="3.0" LEVELS="0" ALIAS="Bump Of Direction" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "COMBATARCHERY",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from COMBAT_LEVELS
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        name: "Combat Archery",
        xml: `<TALENT XMLID="COMBATARCHERY" ID="1709164949036" BASECOST="8.0" LEVELS="0" ALIAS="Combat Archery" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "COMBAT_LUCK",
            type: ["talent"],
            behaviors: ["activatable", "defense"],
            perceivability: "inobvious", // See HS6E volume 1 pg 477.  Based on Resistant Protection which is inobivous
            name: "Combat Luck",
            duration: HERO.DURATION_TYPES.CONSTANT, // This is built from detect (sense) power but has activation roll
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            xml: `<TALENT XMLID="COMBAT_LUCK" ID="1709159939839" BASECOST="0.0" LEVELS="1" ALIAS="Combat Luck (3 PD/3 ED)" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "COMBATREADY",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from SKILL_LEVELS
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="COMBATREADY" ID="1709164954018" BASECOST="3.0" LEVELS="0" ALIAS="Combat Ready" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "COMBAT_SENSE",
            type: ["talent", "sense", "passive"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from detect (sense) power
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<TALENT XMLID="COMBAT_SENSE" ID="1712005986871" BASECOST="15.0" LEVELS="0" ALIAS="Combat Sense" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT"></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "COMBATSHOOTING",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from COMBAT_LEVELS
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="COMBATSHOOTING" ID="1709164957755" BASECOST="8.0" LEVELS="0" ALIAS="Combat Shooting" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(undefined, {
        key: "COMBATSPELLCASTING",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from COMBAT_LEVELS
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="COMBATSPELLCASTING" ID="1709164958686" BASECOST="6.0" LEVELS="0" ALIAS="Combat Spellcasting" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="[single spell]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(undefined, {
        key: "CRIPPLINGBLOW",
        type: ["talent", "adjustment"],
        behaviors: ["dice", "to-hit"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.INSTANT, // This is built from DRAIN
        target: "target's dcv",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
        costEnd: false,
        usesStrength: false,
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<TALENT XMLID="CRIPPLINGBLOW" ID="1709164962720" BASECOST="16.0" LEVELS="0" ALIAS="Crippling Blow" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "CUSTOMTALENT",
            type: ["talent"],
            behaviors: [],
            costPerLevel: fixedValueFunction(1),
            duration: HERO.DURATION_TYPES.CONSTANT, // This is built from who knows what
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="CUSTOMTALENT" ID="1709159957885" BASECOST="0.0" LEVELS="5" ALIAS="Custom Talent" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" ROLL="11"></TALENT>`,
        },
        {},
    );

    addPower(
        {
            key: "DANGER_SENSE",
            type: ["talent", "sense", "passive"],
            behaviors: ["success"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from detect (sense) power
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<TALENT XMLID="DANGER_SENSE" ID="1712006288952" BASECOST="15.0" LEVELS="0" ALIAS="Danger Sense" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "DEADLYBLOW",
            type: ["talent"],
            behaviors: ["activatable"],
            name: "Deadly Blow",
            duration: HERO.DURATION_TYPES.INSTANT, // This is built from Killing Attack
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            xml: `<TALENT XMLID="DEADLYBLOW" ID="1709159979031" BASECOST="0.0" LEVELS="2" ALIAS="Deadly Blow:  +2d6" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYLIMITED" OPTIONID="VERYLIMITED" OPTION_ALIAS="[very limited circumstances]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
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
        type: ["talent", "special"],
        behaviors: ["dice"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from LUCK
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        usesStrength: false,
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<TALENT XMLID="DIVINEFAVOR" ID="1709164973071" BASECOST="10.0" LEVELS="0" ALIAS="Divine Favor" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "DOUBLE_JOINTED",
            type: ["talent"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.CONSTANT, // This is built from CONTORTIONIST and BREAKFALL skills
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="DOUBLE_JOINTED" ID="1709159984537" BASECOST="4.0" LEVELS="0" ALIAS="Double Jointed" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );

    addPower(
        {
            key: "EIDETIC_MEMORY",
            type: ["talent"],
            behaviors: ["success"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from INT
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="EIDETIC_MEMORY" ID="1709159985473" BASECOST="5.0" LEVELS="0" ALIAS="Eidetic Memory" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "ENVIRONMENTAL_MOVEMENT",
            type: ["talent"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.CONSTANT, // This is built from PENALTY_SKILL_LEVELS
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="ENVIRONMENTAL_MOVEMENT" ID="1709159986372" BASECOST="3.0" LEVELS="0" ALIAS="Environmental Movement" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="no penalties on"></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "EVASIVE",
        type: ["talent", "body-affecting", "standard"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from DESOLIDIFICATION with an activation roll
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="EVASIVE" ID="1709164979197" BASECOST="18.0" LEVELS="0" ALIAS="Evasive" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });

    addPower(undefined, {
        key: "FTLPILOT",
        type: ["talent"],
        behaviors: ["success"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from NAVIGATION and TRANSPORT_FAMILIARITY
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="FTLPILOT" ID="1709164980297" BASECOST="4.0" LEVELS="0" ALIAS="FTL Pilot" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(undefined, {
        key: "FASCINATION",
        type: ["talent"],
        behaviors: ["dice"], // FIXME: This is a presence attack ... should that be a behaviour of its own?
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from PRE
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        usesStrength: false,
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<TALENT XMLID="FASCINATION" ID="1709164981287" BASECOST="10.0" LEVELS="0" ALIAS="Fascination" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(undefined, {
        key: "FEARLESS",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is build from POWERDEFENSE and MENTALDEFENSE
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="FEARLESS" ID="1709164983473" BASECOST="14.0" LEVELS="0" ALIAS="Fearless" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(undefined, {
        key: "FOLLOWTHROUGHATTACK",
        type: ["talent", "attack"],
        behaviors: ["activatable", "dice"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.INSTANT, // This is built from HKA with a trigger
        target: "target's dcv",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
        costEnd: false,
        usesStrength: false,
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(true),
        xml: `<TALENT XMLID="FOLLOWTHROUGHATTACK" ID="1709164984595" BASECOST="10.0" LEVELS="0" ALIAS="Follow-Through Attack" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });

    addPower(undefined, {
        key: "HOTSHOTPILOT",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from COMBAT_PILOTING and COMBAT_LEVELS
        name: "Hotshot Pilot", // FIXME: Can this be removed now that we have xml?
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="HOTSHOTPILOT" ID="1709164985624" BASECOST="24.0" LEVELS="0" ALIAS="Hotshot Pilot" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STARHERO" OPTIONID="STARHERO" OPTION_ALIAS="Star Hero" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });

    addPower(undefined, {
        key: "INSPIRE",
        type: ["talent", "adjustment"],
        behaviors: ["dice", "to-hit"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.INSTANT, // This is built AID
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        usesStrength: false,
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<TALENT XMLID="INSPIRE" ID="1709164986910" BASECOST="11.0" LEVELS="0" ALIAS="Inspire" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });

    addPower(undefined, {
        key: "LATENTPSIONIC",
        type: ["talent"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is 5 points reserved for later mental powers
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="LATENTPSIONIC" ID="1709164987906" BASECOST="5.0" LEVELS="0" ALIAS="Latent Psionic" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "LIGHTNING_CALCULATOR",
            type: ["talent", "sense", "passive"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from detect (sense) power
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="LIGHTNING_CALCULATOR" ID="1709159991424" BASECOST="3.0" LEVELS="0" ALIAS="Lightning Calculator" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "LIGHTNING_REFLEXES_ALL",
            type: ["talent"],
            behaviors: ["activatable"],
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
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from DEX
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1709159992355" BASECOST="0.0" LEVELS="1" ALIAS="Lightning Reflexes" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="All Actions" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {
            xml: `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1709164993726" BASECOST="0.0" LEVELS="2" ALIAS="Lightning Reflexes: +2 DEX to act first with All Actions" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
    );
    addPower(undefined, {
        key: "LIGHTNING_REFLEXES_SINGLE",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(1),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from DEX
        name: "Lightning Reflexes", // FIXME: Remove as we have xml?
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="LIGHTNING_REFLEXES_SINGLE" ID="1709164999711" BASECOST="0.0" LEVELS="1" ALIAS="Lightning Reflexes: +1 DEX to act first with Single Action" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Single Action"></TALENT>`,
    });
    addPower(
        {
            key: "LIGHTSLEEP",
            type: ["talent", "sense", "passive"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from enhanced senses
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="LIGHTSLEEP" ID="1709160000741" BASECOST="3.0" LEVELS="0" ALIAS="Lightsleep" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "MAGESIGHT",
        type: ["talent", "sense", "passive"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from detect
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="MAGESIGHT" ID="1709165001978" BASECOST="5.0" LEVELS="0" ALIAS="Magesight" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="NOGROUP"></TALENT>`,
    });
    addPower(undefined, {
        key: "MOUNTEDWARRIOR",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from COMBAT_LEVELS
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="MOUNTEDWARRIOR" ID="1709165004554" BASECOST="4.0" LEVELS="0" ALIAS="Mounted Warrior" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HTH" OPTIONID="HTH" OPTION_ALIAS="HTH Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });

    addPower(
        {
            key: "OFFHANDDEFENSE",
            type: ["talent"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from DCV
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="OFFHANDDEFENSE" ID="1709160002394" BASECOST="2.0" LEVELS="0" ALIAS="Off-Hand Defense" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        undefined, // 5e uses WEAPON_FAMILIARITY: OFF HAND
    );

    addPower(
        {
            key: "PERFECT_PITCH",
            type: ["talent", "sense", "passive"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(0),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from detect (sense) power
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="PERFECT_PITCH" ID="1709160003293" BASECOST="3.0" LEVELS="0" ALIAS="Perfect Pitch" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "RAPIDARCHERY",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(1),
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from COMBAT_LEVELS
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
        costEnd: false,
        xml: `<TALENT XMLID="RAPIDARCHERY" ID="1709165008178" BASECOST="4.0" LEVELS="0" ALIAS="Rapid Archery" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(undefined, {
        key: "RAPIDHEALING",
        type: ["talent", "adjustment"],
        behaviors: ["dice", "to-hit"],
        costPerLevel: fixedValueFunction(1),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from HEALING
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        usesStrength: false,
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<TALENT XMLID="RAPIDHEALING" ID="1709165009140" BASECOST="5.0" LEVELS="0" ALIAS="Rapid Healing" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "RESISTANCE",
            type: ["talent"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(1),
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from SKILL_LEVELS
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            xml: `<TALENT XMLID="RESISTANCE" ID="1709160004117" BASECOST="0.0" LEVELS="1" ALIAS="Resistance (+1 to roll)" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "SHAPECHANGING",
        type: ["talent"],
        behaviors: ["activatable"],
        costPerLevel: fixedValueFunction(0),
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from MULTIFORM
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        xml: `<TALENT XMLID="SHAPECHANGING" ID="1709165011068" BASECOST="18.0" LEVELS="0" ALIAS="Shapechanging" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="[one pre-defined 300-point form]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "SIMULATE_DEATH",
            type: ["talent"],
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(1),
            duration: HERO.DURATION_TYPES.CONSTANT, // This is built from INVISIBILITY
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            defenseTagVsAttack: function () {
                // Not really sure when this would be part of a defense
                return null;
            },
            xml: `<TALENT XMLID="SIMULATE_DEATH" ID="1709160004972" BASECOST="3.0" LEVELS="0" ALIAS="Simulate Death" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL"></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SKILLMASTER",
        type: ["talent"],
        behaviors: ["activatable"],
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built from SKILL_LEVELS
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        costPerLevel: fixedValueFunction(1),
        xml: `<TALENT XMLID="SKILLMASTER" ID="1709165014218" BASECOST="6.0" LEVELS="0" ALIAS="Skill Master" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="+3 with [single skill]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "SPEED_READING",
            type: ["talent", "sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from ANALYZE sense
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(2),
            xml: `<TALENT XMLID="SPEED_READING" ID="1709160005725" BASECOST="2.0" LEVELS="1" ALIAS="Speed Reading (x10)" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SPELLAUGMENTATION",
        type: ["talent", "adjustment"],
        behaviors: ["dice", "to-hit"],
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from AID with charge
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        usesStrength: false,
        costPerLevel: fixedValueFunction(2),
        baseEffectDicePartsBundle: defaultPowerDicePartsBundle,
        doesKillingDamage: fixedValueFunction(false),
        xml: `<TALENT XMLID="SPELLAUGMENTATION" ID="1709165017535" BASECOST="12.0" LEVELS="0" ALIAS="Spell Augmentation" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(
        {
            key: "STRIKING_APPEARANCE",
            type: ["talent"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built from PRE
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            xml: `<TALENT XMLID="STRIKING_APPEARANCE" ID="1709160006516" BASECOST="0.0" LEVELS="1" ALIAS="Striking Appearance" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="vs. all characters" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        undefined,
    );

    addPower(undefined, {
        key: "TRACKLESSSTRIDE",
        type: ["talent"],
        behaviors: ["activatable"],
        duration: HERO.DURATION_TYPES.CONSTANT, // This is built with GLIDING
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: true,
        costPerLevel: fixedValueFunction(0),
        xml: `<TALENT XMLID="TRACKLESSSTRIDE" ID="1709165018596" BASECOST="2.0" LEVELS="0" ALIAS="Trackless Stride" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });
    addPower(undefined, {
        key: "TURNUNDEAD",
        type: ["talent"],
        behaviors: ["activatable"],
        duration: HERO.DURATION_TYPES.PERSISTENT, // This is built with PRE
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costEnd: false,
        costPerLevel: fixedValueFunction(0),
        xml: `<TALENT XMLID="TURNUNDEAD" ID="1709165019594" BASECOST="12.0" LEVELS="0" ALIAS="Turn Undead (+0 PRE)" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
    });

    addPower(
        {
            key: "UNIVERSAL_TRANSLATOR",
            type: ["talent", "sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built with DETECT
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1),
            xml: `<TALENT XMLID="UNIVERSAL_TRANSLATOR" ID="1709160010042" BASECOST="20.0" LEVELS="0" ALIAS="Universal Translator" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT"></TALENT>`,
        },
        {},
    );

    addPower(
        {
            key: "WEAPON_MASTER",
            type: ["talent"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // This is built with COMBAT_LEVELS
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            editOptions: {
                showAttacks: fixedValueFunction(true),
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
                        OPTION_ALIAS: "all HTH Killing Damage weapons",
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
            heroValidation: function (item) {
                const validations = [];

                // If there are no mapped attacks then the CSL won't work
                if (!item.isCslValidHeroValidation) {
                    validations.push({
                        property: "ALIAS",
                        message: `There are no attacks associated with this CSL.`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.ERROR,
                    });
                }

                // Ensure that all custom adders are mapped to objects
                const customLinkAddersWithoutItems = item.customLinkAddersWithoutItems;
                if (customLinkAddersWithoutItems.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `Some custom adders do not match any attack item NAME, ALIAS, or XMLID. Check ${customLinkAddersWithoutItems.map((adder) => `"${adder.ALIAS}"`).join(", ")} for correct spelling`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Some CSLs have limits on the number of supported attacks
                // Custom adders are how we track how many attacks that this CSL applies to.
                const customAdders = item.customLinkAdders;
                const maxCustomAdders = item.maxCustomCslAdders;
                if (customAdders.length > maxCustomAdders) {
                    validations.push({
                        property: "ALIAS",
                        message: `Expecting CSL to have ${maxCustomAdders} or fewer attacks. Consider consolidating related attacks into a list or multipower`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // Ensure that all of the defined custom adders are supported
                const notAllowedItemsInCslCustomAdders = item.notAllowedItemsInCslCustomAdders;
                if (notAllowedItemsInCslCustomAdders.length > 0) {
                    validations.push({
                        property: "ALIAS",
                        message: `${notAllowedItemsInCslCustomAdders.length} linked attacks are not valid for this type of CSL. Remove the link to ${notAllowedItemsInCslCustomAdders.map((item) => item.name).join(", ")}`,
                        example: ``,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                // ANYHTH/ANYRANGED options specified correctly?
                if (
                    (item.system.OPTIONID === "ANYHTH" || item.system.OPTIONID === "ANYRANGED") &&
                    item.cslWeaponMasterWeaponTypes.length !== 1
                ) {
                    validations.push({
                        property: "OPTION_ALIAS",
                        message: `Expecting one of these words [${Object.keys(HERO.CSL_WEAPON_MASTER_WEAPON_TYPES).join(", ")}]`,
                        example: `all Ranged Normal Damage weapons`,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                    });
                }

                return validations;
            },
            xml: `<TALENT XMLID="WEAPON_MASTER" ID="1709160011422" BASECOST="0.0" LEVELS="1" ALIAS="Weapon Master:  +1d6" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYLIMITED" OPTIONID="VERYLIMITED" OPTION_ALIAS="[very limited group]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></TALENT>`,
        },
        undefined,
    );
})();

(function addPowersToPowerList() {
    addPower(
        {
            key: "ABSORPTION",
            type: ["adjustment", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "target’s DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: true,
            usesStrength: false,
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
        duration: HERO.DURATION_TYPES.PERSISTENT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.INHERENT, // All automaton powers are inherent
            costPerLevel: fixedValueFunction(0),
            perceivability: "inobvious",
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            behaviors: ["to-hit", "dice", "activatable"],
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "Target’s DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
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
        {
            addersCost: (item) => {
                // 5e Change Environment gives 1 level of an adder for free but it must be the least expensive adder.
                const sortedAdderValuation = item.adders.sort((a, b) => {
                    const aCost = a.BASECOST || a.LVLCOST;
                    const bCost = b.BASECOST || b.LVLCOST;
                    return aCost - bCost;
                });

                // Remove cost of 1 LEVEL of the least expensive adder
                if (sortedAdderValuation.length === 0) {
                    console.warn(`CHANGEENVIRONMENT ${item.detailedName()} couldn't find any combat effects.`);
                    return 0;
                }

                // Remove the lowest level cost
                const freeLevelCostToRemove = sortedAdderValuation[0].BASECOST || sortedAdderValuation[0].LVLCOST;

                let costOfAdders = -freeLevelCostToRemove;
                for (const adder of item.adders) {
                    costOfAdders += adder.cost;
                }

                return costOfAdders;
            },
            costPerLevel: fixedValueFunction(5),
        },
    );
    addPower(
        {
            key: "CLAIRSENTIENCE",
            type: ["sense"],
            behaviors: ["activatable"],
            perceivability: "imperceptible",
            costPerLevel: fixedValueFunction(1),
            duration: HERO.DURATION_TYPES.CONSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT, // FIXME: This is probably not a default duration
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            xml: `<POWER XMLID="DAMAGENEGATION" ID="1711933005926" BASECOST="0.0" LEVELS="0" ALIAS="Damage Negation" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            costPerLevel: fixedValueFunction(1 / 2),
            defenseTagVsAttack: function (actorItemDefense, attackItem, options) {
                let value = 0;
                let maxValue = 0;
                switch (options.attackDefenseVs) {
                    case "PD":
                        value = parseInt(actorItemDefense.system.PDLEVELS) || 0;
                        maxValue = parseInt(actorItemDefense.actor?.system.characteristics.pd.base) || 0;
                        break;

                    case "ED":
                        value = parseInt(actorItemDefense.system.EDLEVELS) || 0;
                        maxValue = parseInt(actorItemDefense.actor?.system.characteristics.ed.base) || 0;
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
                    const msg = `${actorItemDefense.detailedName()} has more ${options.attackDefenseVs} LEVELS (${value}) than natural LEVELS (${maxValue}). Defenses may not properly represent this defense. Consider ARMOR if you want resistant defenses.`;
                    if (!squelch(actorItemDefense.id)) {
                        ui.notifications.warn(msg, actorItemDefense);
                    }
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
            behaviors: ["to-hit", "activatable"],
            perceivability: "obvious",
            costPerLevel: function (item) {
                if (!(item instanceof HeroSystem6eItem)) {
                    console.error(`${item.name} is not a HeroSystem6eItem`, item);
                }
                const is5e = item.is5e;
                switch (item.system?.OPTIONID) {
                    case "SIGHTGROUP":
                        return is5e ? 10 : 5; // Targeting sense gruop
                    case "HEARINGGROUP":
                    case "MENTALGROUP":
                    case "RADIOGROUP":
                    case "SMELLGROUP":
                    case "TOUCHGROUP":
                        return is5e ? 5 : 3; // Non-targeting sense group
                    default:
                        console.error(`DARKNESS OPTIONID ${item.system?.OPTIONID} is not handled`);
                }
                return is5e ? 10 : 5;
            },
            duration: HERO.DURATION_TYPES.CONSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            usesStrength: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            unusualDicePerDc: true,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
                        value =
                            (parseInt(actorItemDefense.adjustedLevels) || 0) *
                            convertHexesToSystemUnits(1, actorItemDefense.actor.is5e);
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

                const strDisplay = `+${noStrIncrease ? 0 : item.system.LEVELS * 5} STR`;
                const massDisplay = `${Math.pow(2, item.system.LEVELS) * 100} kg mass`;
                const kbDisplay = `-${hexDistanceToSystemDisplayString(item.system.LEVELS, item.actor.is5e)} KB`;
                const defenseDisplay = (() => {
                    const noDefIncrease = item.modifiers.find((mod) => mod.XMLID === "NODEFINCREASE");
                    // NODEFINCREASE allows for ED, PD, or EDPD as option.
                    const noPdIncrease = noDefIncrease?.OPTIONID.includes("PD");
                    const noEdIncrease = noDefIncrease?.OPTIONID.includes("ED");

                    if (noPdIncrease && noEdIncrease) return "";

                    const displayTypes = [noPdIncrease ? "" : "PD", noEdIncrease ? "" : "ED"].filter(Boolean).join("/");
                    return `+${item.system.LEVELS} ${displayTypes}`;
                })();

                const details = [massDisplay, strDisplay, defenseDisplay, kbDisplay].filter(Boolean).join(", ");

                return `${item.system.ALIAS} (${details})`;
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "target’s DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.INHERENT, // All automaton powers are inherent
            costPerLevel: fixedValueFunction(3),
            perceivability: "obvious",
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "target’s DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            usesStrength: false,
            costPerLevel: fixedValueFunction(10),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="DRAIN" ID="1711933555522" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        { rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE) },
    );
    addPower(
        {
            key: "DUPLICATION",
            type: ["body-affecting", "special"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "dmcv",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.LINE_OF_SIGHT),
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            usesStrength: false,
            nonDmgEffect: true,
            defense: function (item) {
                const baseDef = parseInt(item.adjustedLevels || 0);

                const additionalDef = parseInt(item.findModsByXmlid("ADDITIONALDEF")?.LEVELS || 0);
                const additionalPD = parseInt(item.findModsByXmlid("ADDITIONALPD")?.LEVELS || 0);
                const additionalED = parseInt(item.findModsByXmlid("ADDITIONALED")?.LEVELS || 0);

                const rPD = baseDef + additionalDef + additionalPD;
                const rED = baseDef + additionalDef + additionalED;
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
        duration: HERO.DURATION_TYPES.PERSISTENT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        costPerLevel: fixedValueFunction(5),
        baseEffectDicePartsBundle: standardBaseEffectDiceParts,
        xml: `<POWER XMLID="FINDWEAKNESS" ID="1709342622694" BASECOST="10.0" LEVELS="0" ALIAS="Find Weakness" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
    });
    addPower(
        {
            key: "FLASH",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "Target’s DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            perceivability: "inobvious",
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            cost: undefined,
            xml: `<POWER XMLID="FORCEFIELD" ID="1709342634480" BASECOST="0.0" LEVELS="0" ALIAS="Force Field" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0"></POWER>`,
        },
    );
    addPower(
        {
            key: "FORCEWALL", // BARRIER
            type: ["defense", "standard"],
            behaviors: ["to-hit", "defense", "activatable"],
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            activeEffect: function (item) {
                const ae = {
                    transfer: true,
                };
                ae.name = `${item.system.ALIAS || item.system.XMLID || item.name}: ${item.system.XMLID} ${item.is5e ? item.system.LEVELS : item.system.OPTIONID}`;
                ae.img = "icons/svg/upgrade.svg";
                const details = this.details(item);
                ae.changes = [
                    {
                        key: "system.characteristics.str.max",
                        value: details.str,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.body.max",
                        value: details.body,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.stun.max",
                        value: details.stun,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        // Growth6e + OCV is sorta like -DCV, but not quite as 1/2 DCV penalties are an issue, also min 0 DCV rules,
                        // should technicaly add to OCV of attacker.
                        // However 5e use the -DCV concept and we will implement 6e in kind for now.
                        key: "system.characteristics.dcv.max",
                        value: -details.dcv,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.OVERRIDE, // Intentionally not being halved
                    },
                    {
                        key: "system.characteristics.con.max",
                        value: details.con,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.pre.max",
                        value: details.pre,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.pd.max",
                        value: details.pd,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.ed.max",
                        value: details.ed,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.running.max",
                        value: details.running,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ];
                ae.system = {
                    XMLID: "GROWTH",
                };
                return ae;
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
                    str: parseInt(item.system.LEVELS) * 5,
                    body: parseInt(item.system.LEVELS),
                    stun: parseInt(item.system.LEVELS),
                    reach: Math.pow(2, Math.floor(item.system.LEVELS / 3)),
                    kb: parseInt(item.system.LEVELS),
                    mass: (Math.pow(2, item.system.LEVELS) * 100).toLocaleString() + " kg",
                    dcv: 2 * Math.floor(item.system.LEVELS / 3),
                    perception: 2 * Math.floor(item.system.LEVELS / 3),
                    tall: Math.pow(2, Math.floor(item.system.LEVELS / 3)) * 2,
                    wide: Math.pow(2, Math.floor(item.system.LEVELS / 3)),
                };
                return result;
            },
            activeEffect: function (item) {
                const ae = {
                    transfer: true,
                };
                ae.name = `${item.system.ALIAS || item.system.XMLID || item.name}: ${item.system.XMLID} ${item.is5e ? item.system.LEVELS : item.system.OPTIONID}`;
                ae.img = "icons/svg/upgrade.svg";
                const details = this.details(item);
                ae.changes = [
                    {
                        key: "system.characteristics.str.max",
                        value: details.str,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.body.max",
                        value: details.body,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        key: "system.characteristics.stun.max",
                        value: details.stun,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                    {
                        // Growth6e + OCV is sorta like -DCV, but not quite as 1/2 DCV penalties are an issue, also min 0 DCV rules,
                        // should technicaly add to OCV of attacker.
                        // However 5e use the -DCV concept and we will implement 6e in kind for now.
                        key: "system.characteristics.dcv.max",
                        value: -details.dcv,
                        mode: HERO.ACTIVE_EFFECT_MODES.ADD,
                        priority: HERO.ACTIVE_EFFECT_PRIORITY.ADD,
                    },
                ];
                ae.system = {
                    XMLID: "GROWTH",
                };
                return ae;
            },
        },
    );

    addPower(
        {
            key: "HANDTOHANDATTACK", // NOTE: Not an attack of its own.
            type: ["attack"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: true,
            usesStrength: false,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: standardBaseEffectDiceParts,
            doesKillingDamage: fixedValueFunction(false),
            xml: `<POWER XMLID="HANDTOHANDATTACK" ID="1711934318209" BASECOST="0.0" LEVELS="1" ALIAS="Hand-To-Hand Attack" POSITION="48" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "HEALING",
            type: ["adjustment"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "target's dcv",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "area (see text)",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
        duration: HERO.DURATION_TYPES.PERSISTENT,
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            usesStrength: false,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: luckAndUnluckBaseEffectDiceParts,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            duration: HERO.DURATION_TYPES.PERSISTENT,
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
                        const bonus = roundFavorPlayerAwayFromZero(
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "dmcv",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.LINE_OF_SIGHT),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "dmcv",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.LINE_OF_SIGHT),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "dmcv",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.LINE_OF_SIGHT),
            costEnd: false,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "dmcv",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SPECIAL),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "target’s OCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costEnd: true,
            usesStrength: false,
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="MISSILEDEFLECTION" ID="1709333871556" BASECOST="20.0" LEVELS="0" ALIAS="Deflection" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {
            duration: HERO.DURATION_TYPES.CONSTANT,
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.INSTANT, // Naked advantages make something instant
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            costPerLevel: fixedValueFunction(1),
            cost: function (/* item */) {
                return 0;
            },
            activePoints: function (item) {
                const _levels = parseInt(item.system?.LEVELS || 0);
                return roundFavorPlayerTowardsZero(_levels * (1 + item._advantageCost) - _levels);
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
            duration: HERO.DURATION_TYPES.INHERENT, // All automaton powers are inherent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            costPerLevel: fixedValueFunction(0),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="NOHITLOCATIONS" ID="1709333986337" BASECOST="10.0" LEVELS="0" ALIAS="No Hit Locations" POSITION="66" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "POSSESSION",
            type: ["attack", "mental"],
            behaviors: ["to-hit", "dice"],
            perceivability: "obvious",
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "DMCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.LINE_OF_SIGHT),
            costEnd: true,
            usesStrength: false,
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
            xml: `<POWER XMLID="POSSESSION" ID="1711934925655" BASECOST="60.0" LEVELS="0" ALIAS="Possession" POSITION="67" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Human" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "POWERDEFENSE",
            type: ["defense", "special"],
            behaviors: ["activatable", "defense"],
            perceivability: "imperceptible",
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costPerLevel: fixedValueFunction(15),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
        undefined, // SUCCOR is BOOST in 6e. BOOST is a variant of AID.
        {
            key: "SUCCOR",
            type: ["adjustment", "attack"],
            behaviors: ["to-hit", "dice"],
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "target's DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costEnd: true,
            usesStrength: false,
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "n/a",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
        duration: HERO.DURATION_TYPES.CONSTANT,
        target: "target’s DCV",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
        costEnd: true,
        usesStrength: false,
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
            duration: HERO.DURATION_TYPES.CONSTANT,
            target: "target’s DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "dmcv",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.LINE_OF_SIGHT),
            costEnd: true,
            usesStrength: false,
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
        duration: HERO.DURATION_TYPES.INSTANT,
        target: "target's DCV",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
        costEnd: true,
        usesStrength: false,
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
            duration: HERO.DURATION_TYPES.INSTANT,
            target: "target's DCV",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
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
            duration: HERO.DURATION_TYPES.INSTANT,
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            costPerLevel: fixedValueFunction(5),
            costEnd: true,
            usesStrength: false, // Doesn't stack with itself.
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
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(4),
            xml: `<EXTRADC XMLID="EXTRADC" ID="1753421156333" BASECOST="0.0" LEVELS="4" ALIAS="+4 HTH Damage Class(es)" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1754267038115" NAME=""></EXTRADC>`,
        },
        {},
    );

    addPower(
        {
            key: "MANEUVER",
            type: ["martial", "attack"], // TODO: Not all of these are attacks
            behaviors: ["to-hit", "dice"], // TODO: Not all of these are attacks or do damage
            behaviorsByItem: function (item) {
                // Unfortunately there are lots of behaviors that are possible from a MANEUVER. Build them dynamically.
                const behaviors = [];

                // Do you dodge with this maneuver?
                if (maneuverHasDodgeTrait(item)) {
                    behaviors.push("activable");
                }

                // Do you roll to hit with this maneuver?
                if (
                    maneuverHasBindTrait(item) ||
                    maneuverHasBlockTrait(item) ||
                    maneuverHasCrushTrait(item) ||
                    maneuverHasDisarmTrait(item) ||
                    maneuverHasFlashEffectTrait(item) ||
                    maneuverHasGrabTrait(item) ||
                    maneuverHasKillingDamageTrait(item) ||
                    maneuverHasNormalDamageTrait(item) ||
                    maneuverHasNoNormalDefenseDamageTrait(item) ||
                    maneuverHasShoveTrait(item) ||
                    maneuverHasStrikeTrait(item) ||
                    maneuverHasTargetFallsTrait(item)
                ) {
                    behaviors.push("to-hit");
                }

                // Is there some kind of damage/effect roll with this manuever?
                if (
                    maneuverHasCrushTrait(item) ||
                    maneuverHasDisarmTrait(item) ||
                    maneuverHasFlashEffectTrait(item) ||
                    maneuverHasGrabTrait(item) ||
                    maneuverHasKillingDamageTrait(item) ||
                    maneuverHasNormalDamageTrait(item) ||
                    maneuverHasNoNormalDefenseDamageTrait(item) ||
                    maneuverHasStrikeTrait(item) ||
                    maneuverHasVelocityTrait(item)
                ) {
                    behaviors.push("dice");
                }

                return behaviors;
            },
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: function (item) {
                // Attacks have a range other than self
                if (
                    maneuverHasBindTrait(item) ||
                    maneuverHasBlockTrait(item) ||
                    maneuverHasCrushTrait(item) ||
                    maneuverHasDisarmTrait(item) ||
                    maneuverHasFlashEffectTrait(item) ||
                    maneuverHasGrabTrait(item) ||
                    maneuverHasKillingDamageTrait(item) ||
                    maneuverHasNormalDamageTrait(item) ||
                    maneuverHasNoNormalDefenseDamageTrait(item) ||
                    maneuverHasShoveTrait(item) ||
                    maneuverHasStrikeTrait(item) ||
                    maneuverHasTargetFallsTrait(item)
                ) {
                    // Is this a HTH or a Ranged martial maneuver?
                    return isRangedMartialManeuver(item) ? HERO.RANGE_TYPES.STANDARD : HERO.RANGE_TYPES.NO_RANGE;
                }

                return HERO.RANGE_TYPES.SELF;
            },
            duration: HERO.DURATION_TYPES.INSTANT,
            costEnd: true,
            usesStrength: false, // TODO: Not all of these are attacks
            baseEffectDicePartsBundle: maneuverBaseEffectDicePartsBundle,
            doesKillingDamage: maneuverDoesKillingDamage,
            xml: `<MANEUVER XMLID="MANEUVER" ID="1754249922302" BASECOST="5.0" LEVELS="0" ALIAS="Custom - Flying Knee" POSITION="8" MULTIPLIER="1.0" GRAPHIC="hole" COLOR="50 100 200" SFX="Gravity" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CUSTOM="Yes" CATEGORY="Hand to Hand" DISPLAY="Custom Maneuver" OCV="+1" DCV="+1" DC="2" PHASE="1/2" EFFECT="+v/5 Strike" ADDSTR="Yes" ACTIVECOST="0" DAMAGETYPE="2" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="+v/5 Strike"></MANEUVER>`,
        },
        {},
    );

    addPower(
        {
            key: "RANGEDDC",
            type: ["martial"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(4),
            xml: `<RANGEDDC XMLID="RANGEDDC" ID="1753421165484" BASECOST="0.0" LEVELS="4" ALIAS="+4 Ranged Damage Class(es)" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1754267038115" NAME=""></RANGEDDC>`,
        },
        {},
    );

    addPower(
        {
            key: "WEAPON_ELEMENT",
            type: ["martial"],
            behaviors: [],
            duration: HERO.DURATION_TYPES.PERSISTENT,
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            categorized: true,
            xml: `<WEAPON_ELEMENT XMLID="WEAPON_ELEMENT" ID="1752445619294" BASECOST="0.0" LEVELS="0" ALIAS="Weapon Element" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></WEAPON_ELEMENT>`,
        },
        {},
    );
})();

(function addSensesToPowerList() {
    addPower(
        {
            key: "ACTIVESONAR",
            type: ["sense", "active"],
            behaviors: [
                "activatable",
                "240DegreeArcBuiltIn",
                "microscopicBuiltIn",
                "senseBuiltIn",
                "rangeBuiltIn",
                "targetingBuiltIn",
                "telescopicBuiltIn",
            ],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<POWER XMLID="ACTIVESONAR" ID="1763830302787" BASECOST="15.0" LEVELS="0" ALIAS="Active Sonar" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="HEARINGGROUP"></POWER>`,
        },
        {
            behaviors: [
                "activatable",
                "360DegreeArcBuiltIn",
                "senseBuiltIn",
                "rangeBuiltIn",
                "rapidBuiltIn",
                "targetingBuiltIn",
            ],
        },
    );
    addPower(
        {
            key: "ADJACENT",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="ADJACENT" ID="1763928030882" BASECOST="3.0" LEVELS="0" ALIAS="Adjacent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "ADJACENTFIXED",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="ADJACENTFIXED" ID="1763928033816" BASECOST="2.0" LEVELS="0" ALIAS="Adjacent (Fixed Perception Point)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "ANALYZESENSE",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="ANALYZESENSE" ID="1763830729736" BASECOST="5.0" LEVELS="0" ALIAS="Analyze" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "ANALYZESENSE",
            type: ["sense"],
            behaviors: ["sense"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<POWER XMLID="ANALYZESENSE" ID="1763945053136" BASECOST="10.0" LEVELS="0" ALIAS="Analyze" POSITION="114" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "CONCEALED",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="CONCEALED" ID="1763830728871" BASECOST="0.0" LEVELS="1" ALIAS="Concealed (-1 with Detect PER Rolls)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "CONCEALED",
            type: ["sense"],
            behaviors: ["sense"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<POWER XMLID="CONCEALED" ID="1763945879583" BASECOST="0.0" LEVELS="1" ALIAS="Concealed" POSITION="117" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="fasdfasdf" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "DETECT",
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="DETECT" ID="1763830937329" BASECOST="3.0" LEVELS="0" ALIAS="Detect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "DETECT",
            type: ["sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.NO_RANGE),
            costPerLevel: fixedValueFunction(1),
            xml: `<POWER XMLID="DETECT" ID="1763940907865" BASECOST="3.0" LEVELS="0" ALIAS="Detect" POSITION="67" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="A Single Thing" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="UNUSUALGROUP" ACTIVE="Yes"></POWER>`,
        },
        {
            behaviors: ["activatable", "360DegreeArcBuiltIn"],
        },
    );
    addPower(
        {
            key: "DIMENSIONALSINGLE",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="DIMENSIONALSINGLE" ID="1764444031070" BASECOST="5.0" LEVELS="0" ALIAS="Perceive into a single other dimension" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALSINGLE",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<POWER XMLID="DIMENSIONALSINGLE" ID="1763927019696" BASECOST="10.0" LEVELS="0" ALIAS="Perceive into a single other dimension" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALGROUP",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="DIMENSIONALGROUP" ID="1712025456851" BASECOST="10.0" LEVELS="0" ALIAS="Perceive into a related group of dimensions" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALGROUP",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<POWER XMLID="DIMENSIONALGROUP" ID="1763927025440" BASECOST="20.0" LEVELS="0" ALIAS="Perceive into a related group of dimensions" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTALGROUP" OPTIONID="MENTALGROUP" OPTION_ALIAS="Mental Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALALL",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="DIMENSIONALALL" ID="1764444047959" BASECOST="15.0" LEVELS="0" ALIAS="Perceive into any dimension" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALALL",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<POWER XMLID="DIMENSIONALALL" ID="1763927030679" BASECOST="25.0" LEVELS="0" ALIAS="Perceive into any dimension" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DISCRIMINATORY",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="DISCRIMINATORY" ID="1763830727860" BASECOST="5.0" LEVELS="0" ALIAS="Discriminatory" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "DISCRIMINATORY",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(1),
            xml: `<POWER XMLID="DISCRIMINATORY" ID="1763945795072" BASECOST="10.0" LEVELS="0" ALIAS="Discriminatory" POSITION="85" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "ENHANCEDPERCEPTION",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: function (item) {
                if (item.system.OPTIONID === "ALL") {
                    return 3;
                }
                if (item.system.OPTIONID.includes("GROUP")) {
                    return 2;
                }
                return 1;
            },
            xml: `<POWER XMLID="ENHANCEDPERCEPTION" ID="1738452641594" BASECOST="0.0" LEVELS="1" ALIAS="Enhanced Perception" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="all Sense Groups" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "EXTRA",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costPerLevel: fixedValueFunction(3),
            xml: `<ADDER XMLID="EXTRA" ID="1764044787192" BASECOST="5.0" LEVELS="0" ALIAS="Each Extra Thing or Class of Things" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            key: "HRRP", // High Range Radio Perception
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="HRRP" ID="1763830936069" BASECOST="3.0" LEVELS="0" ALIAS="High Range Radio Perception" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "HRRP", // High Range Radio Perception
            type: ["sense", "passive"],
            behaviors: [
                "activatable",
                "240DegreeArcBuiltIn",
                "360DegreeArcBuiltIn",
                "senseBuiltIn",
                "rangeBuiltIn",
                "transmitBuiltIn",
            ],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="HRRP" ID="1764443819286" BASECOST="12.0" LEVELS="0" ALIAS="High Range Radio Perception" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="RADIOGROUP"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "INCREASEDARC240",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="INCREASEDARC240" ID="1763928452159" BASECOST="2.0" LEVELS="0" ALIAS="Increased Arc Of Perception (240 Degrees)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "INCREASEDARC240",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="INCREASEDARC240" ID="1763927380183" BASECOST="10.0" LEVELS="0" ALIAS="Increased Arc Of Perception (240 Degrees)" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="all Sense Groups" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "INCREASEDARC360",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="INCREASEDARC360" ID="1763830726980" BASECOST="5.0" LEVELS="0" ALIAS="Increased Arc Of Perception (360 Degrees)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "INCREASEDARC360",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="INCREASEDARC360" ID="1763943009288" BASECOST="25.0" LEVELS="0" ALIAS="Increased Arc Of Perception (360 Degrees)" POSITION="79" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="all Sense Groups" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "INFRAREDPERCEPTION",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "#ff9999",  // washes out sewer tiles.  May need to create a custom visionMode.
            },
            xml: `<ADDER XMLID="INFRAREDPERCEPTION" ID="1763830934861" BASECOST="5.0" LEVELS="0" ALIAS="Infrared Perception" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "INFRAREDPERCEPTION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "#ff9999",  // washes out sewer tiles.  May need to create a custom visionMode.
            },
            xml: `<POWER XMLID="INFRAREDPERCEPTION" ID="1762719249446" BASECOST="5.0" LEVELS="0" ALIAS="Infrared Perception" POSITION="63" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="SIGHTGROUP"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "MAKEASENSE",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="MAKEASENSE" ID="1763830722531" BASECOST="2.0" LEVELS="0" ALIAS="Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "MAKEASENSE",
            type: ["sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="MAKEASENSE" ID="1770520746455" BASECOST="2.0" LEVELS="0" ALIAS="Sense" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DANGER_SENSE" OPTIONID="DANGER_SENSE" OPTION_ALIAS="Danger Sense" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MENTALAWARENESS",
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            senseGroup: "mental",
            senseType: "passive",
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="MENTALAWARENESS" ID="1763830933329" BASECOST="3.0" LEVELS="0" ALIAS="Mental Awareness" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "MENTALAWARENESS",
            type: ["sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn", "senseBuiltIn", "rangeBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            senseGroup: "mental",
            senseType: "passive",
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="MENTALAWARENESS" ID="1763940919976" BASECOST="5.0" LEVELS="0" ALIAS="Mental Awareness" POSITION="71" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="MENTALGROUP"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MICROSCOPIC",
            type: ["adder", "sense"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(3),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="MICROSCOPIC" ID="1763830725963" BASECOST="0.0" LEVELS="1" ALIAS="Microscopic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "MICROSCOPIC",
            type: ["sense"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            behaviors: ["activatable"],
            costPerLevel: fixedValueFunction(5),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="MICROSCOPIC" ID="1763943150208" BASECOST="0.0" LEVELS="1" ALIAS="Microscopic" POSITION="79" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "NIGHTVISION",
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: null,
                //color: "aaaaff",
            },
            xml: `<ADDER XMLID="NIGHTVISION" ID="1763830932609" BASECOST="5.0" LEVELS="0" ALIAS="Nightvision" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "NIGHTVISION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: null,
                //color: "aaaaff",
            },
            xml: `<POWER XMLID="NIGHTVISION" ID="1763940758264" BASECOST="5.0" LEVELS="0" ALIAS="Nightvision" POSITION="65" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="SIGHTGROUP"></POWER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "NRAYPERCEPTION",
        type: ["adder", "sense"],
        behaviors: ["adder"],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        xml: `<ADDER XMLID="NRAYPERCEPTION" ID="1763830931005" BASECOST="5.0" LEVELS="0" ALIAS="N-Ray Perception" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
    });
    addPower(undefined, {
        key: "NRAYPERCEPTION",
        type: ["sense", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
        behaviors: ["activatable"],
        duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        xml: `<POWER XMLID="NRAYPERCEPTION" ID="1763941699736" BASECOST="10.0" LEVELS="0" ALIAS="N-Ray Perception" POSITION="72" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="SIGHTGROUP"></POWER>`,
    });

    addPower(
        {
            key: "PARTIALLYPENETRATIVE",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="PARTIALLYPENETRATIVE" ID="1737917249842" BASECOST="5.0" LEVELS="0" ALIAS="Partially Penetrative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "PARTIALLYPENETRATIVE",
            type: ["sense"],
            behaviors: ["activatable", "sense"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            type: ["adder", "sense"],
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="PENETRATIVE" ID="1737574847298" BASECOST="10.0" LEVELS="0" ALIAS="Penetrative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "PENETRATIVE",
            type: ["sense"],
            behaviors: ["activatable", "sense"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: true,
            costPerLevel: fixedValueFunction(0),
            baseEffectDicePartsBundle: noDamageBaseEffectDicePartsBundle,
            xml: `<POWER XMLID="PENETRATIVE" ID="1738469314018" BASECOST="15.0" LEVELS="0" ALIAS="Penetrative" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            // DAMAGENEGATION related
            key: "PHYSICAL",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            costPerLevel: fixedValueFunction(5),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="PHYSICAL" ID="1738019507454" BASECOST="0.0" LEVELS="1" ALIAS="Physical DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "RADAR",
            type: ["active", "adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="RADAR" ID="1762134830241" BASECOST="5.0" LEVELS="0" ALIAS="Radar" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "RADAR",
            type: ["sense", "active"],
            behaviors: ["activatable", "240DegreeArcBuiltIn", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="RADAR" ID="1763940928672" BASECOST="15.0" LEVELS="0" ALIAS="Radar" POSITION="72" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="RADIOGROUP"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "RADIOPERCEIVETRANSMIT",
            type: ["active", "adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="RADIOPERCEIVETRANSMIT" ID="1762134831344" BASECOST="3.0" LEVELS="0" ALIAS="Radio Perception/Transmission" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "RADIOPERCEIVETRANSMIT",
            type: ["sense", "active"],
            behaviors: [
                "activatable",
                "240DegreeArcBuiltIn",
                "360DegreeArcBuiltIn",
                "senseBuiltIn",
                "rangeBuiltIn",
                "transmitBuiltIn",
            ],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="RADIOPERCEIVETRANSMIT" ID="1763940931864" BASECOST="10.0" LEVELS="0" ALIAS="Radio Perception/Transmission" POSITION="73" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="RADIOGROUP"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "RADIOPERCEPTION",
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="RADIOPERCEPTION" ID="1762134832412" BASECOST="3.0" LEVELS="0" ALIAS="Radio Perception" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "RADIOPERCEPTION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn", "360DegreeArcBuiltIn", "senseBuiltIn", "rangeBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="RADIOPERCEPTION" ID="1763940935057" BASECOST="8.0" LEVELS="0" ALIAS="Radio Perception" POSITION="74" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="RADIOGROUP"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "RANGE",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            xml: `<ADDER XMLID="RANGE" ID="1763944625584" BASECOST="5.0" LEVELS="0" ALIAS="Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "RANGE",
            type: ["sense"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.STANDARD),
            xml: `<POWER XMLID="RANGE" ID="1746309807411" BASECOST="10.0" LEVELS="0" ALIAS="Range" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SMELLGROUP" OPTIONID="SMELLGROUP" OPTION_ALIAS="Smell/Taste Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "RAPID",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(3),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="RAPID" ID="1763830631952" BASECOST="0.0" LEVELS="1" ALIAS="Rapid" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "RAPID",
            type: ["sense"],
            behaviors: ["sense"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(3),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="RAPID" ID="1763829793931" BASECOST="0.0" LEVELS="1" ALIAS="Rapid" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "SPATIALAWARENESS",
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="SPATIALAWARENESS" ID="1762134801878" BASECOST="5.0" LEVELS="0" ALIAS="Spatial Awareness" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "SPATIALAWARENESS",
            type: ["sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn", "senseBuiltIn", "penetrativeBuiltIn", "targetingBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="SPATIALAWARENESS" ID="1763940939009" BASECOST="32.0" LEVELS="0" ALIAS="Spatial Awareness" POSITION="75" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="UNUSUALGROUP"></POWER>`,
        },
        {
            behaviors: ["activatable", "senseBuiltIn", "targetingBuiltIn"],
        },
    );

    addPower(
        {
            key: "TARGETINGSENSE",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="TARGETINGSENSE" ID="1763830715168" BASECOST="10.0" LEVELS="0" ALIAS="Targeting" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "TARGETINGSENSE",
            type: ["sense"],
            behaviors: ["activatable", "targetingBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="TARGETINGSENSE" ID="1765683750863" BASECOST="10.0" LEVELS="0" ALIAS="Targeting" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NORMALHEARING" OPTIONID="NORMALHEARING" OPTION_ALIAS="Normal Hearing" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1765665248447" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "TELESCOPIC",
            type: ["adder", "sense"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(1 / 2),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="TELESCOPIC" ID="1763830718230" BASECOST="0.0" LEVELS="1" ALIAS="Telescopic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "TELESCOPIC",
            type: ["sense"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: function (item) {
                // Cost depends on the sense. If it's a sense group then it's 3 cp per 2 levels. For a single sense it's 1 cp per 2 levels.
                if (item.system.OPTIONID.includes("GROUP")) {
                    return 3 / 2;
                }

                return 1 / 2;
            },
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="TELESCOPIC" ID="1763943753376" BASECOST="0.0" LEVELS="1" ALIAS="Telescopic" POSITION="83" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "TRACKINGSENSE",
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="TRACKINGSENSE" ID="1763830720386" BASECOST="5.0" LEVELS="0" ALIAS="Tracking" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "TRACKINGSENSE",
            type: ["sense", "passive"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="TRACKINGSENSE" ID="1586662531588" BASECOST="10.0" LEVELS="0" ALIAS="Tracking" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SMELLGROUP" OPTIONID="SMELLGROUP" OPTION_ALIAS="Smell/Taste Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Scent" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "TRANSMIT",
            type: ["adder", "sense", "active"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<ADDER XMLID="TRANSMIT" ID="1763830721657" BASECOST="2.0" LEVELS="0" ALIAS="Transmit" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "TRANSMIT",
            type: ["sense", "active"],
            behaviors: ["activatable"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<POWER XMLID="TRANSMIT" ID="1763943946200" BASECOST="5.0" LEVELS="0" ALIAS="Transmit" POSITION="84" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "ULTRASONICPERCEPTION",
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "ffaaff",
            },
            xml: `<ADDER XMLID="ULTRASONICPERCEPTION" ID="1763943707845" BASECOST="10.0" LEVELS="0" ALIAS="Ultrasonic Perception" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "ULTRASONICPERCEPTION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "senseBuiltIn", "rangeBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "ffaaff",
            },
            xml: `<POWER XMLID="ULTRASONICPERCEPTION" ID="1763927364247" BASECOST="3.0" LEVELS="0" ALIAS="Ultrasonic Perception" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="HEARINGGROUP"></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "ULTRAVIOLETPERCEPTION",
            type: ["adder", "sense", "passive"],
            behaviors: ["adder"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "7F00FF",
            },
            xml: `<ADDER XMLID="ULTRAVIOLETPERCEPTION" ID="1762134835235" BASECOST="5.0" LEVELS="0" ALIAS="Ultraviolet Perception" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "ULTRAVIOLETPERCEPTION",
            type: ["sense", "passive"],
            behaviors: ["activatable", "240DegreeArcBuiltIn", "senseBuiltIn", "rangeBuiltIn", "targetingBuiltIn"],
            duration: HERO.DURATION_TYPES.PERSISTENT, // Enhanced Senses are typically persistent
            costPerLevel: fixedValueFunction(0),
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            sight: {
                visionMode: "basic",
                range: null, // infinite
                //color: "7F00FF",
            },
            xml: `<POWER XMLID="ULTRAVIOLETPERCEPTION" ID="1763940945104" BASECOST="5.0" LEVELS="0" ALIAS="Ultraviolet Perception" POSITION="77" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="SIGHTGROUP"></POWER>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="ACCIDENTALCHANGE" ID="1709445721979" BASECOST="0.0" LEVELS="0" ALIAS="Accidental Change" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="GENERICDISADVANTAGE" ID="1709445725246" BASECOST="0.0" LEVELS="0" ALIAS="Custom Complication" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "DEPENDENCE",
            type: ["disadvantage"],
            behaviors: ["activatable", "dice"],
            costEnd: false,
            usesStrength: false,
            costPerLevel: fixedValueFunction(5), // NOTE: Doesn't use LEVELS but this helps our DC calculations
            unusualDicePerDc: true,
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            xml: `<DISAD XMLID="DEPENDENCE" ID="1709445727918" BASECOST="0.0" LEVELS="0" ALIAS="Dependence" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="DEPENDENTNPC" ID="1709445730914" BASECOST="0.0" LEVELS="0" ALIAS="Dependent NPC" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="DISTINCTIVEFEATURES" ID="1709445733944" BASECOST="0.0" LEVELS="0" ALIAS="Distinctive Features" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="ENRAGED" ID="1709445736756" BASECOST="0.0" LEVELS="0" ALIAS="Enraged" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="HUNTED" ID="1709445739393" BASECOST="0.0" LEVELS="0" ALIAS="Hunted" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
        },
        {},
    );

    addPower(undefined, {
        key: "MONEYDISAD",
        type: ["disadvantage"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0), // TODO: needs function
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        xml: `<DISAD XMLID="MONEYDISAD" ID="1709445487703" BASECOST="0.0" LEVELS="0" ALIAS="Money" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
    });

    // CAUTION: 5e Normal Characteristic Maxima is a disadvantage, but Hero Designer defines it as an ADDER
    // NOTE: AGE doesn't exist as a normal disadvantage in HD - you find it on the characteristics tab behind a checkbox
    addPower(undefined, {
        // AGE related
        key: "NCM",
        type: ["disadvantage"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        xml: `<ADDER XMLID="NCM" ID="1763056887996" BASECOST="20.0" LEVELS="0" ALIAS="Normal Characteristic Maxima" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(undefined, {
        key: "NCM10",
        type: ["disadvantage"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        xml: `<ADDER XMLID="NCM10" ID="1762923975066" BASECOST="15.0" LEVELS="0" ALIAS="Age:  10-" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(undefined, {
        key: "NCM10NICE",
        type: ["disadvantage"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        xml: `<ADDER XMLID="NCM10NICE" ID="1762923975067" BASECOST="15.0" LEVELS="0" ALIAS="Age:  10-" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(undefined, {
        key: "NCM40",
        type: ["disadvantage"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        xml: `<ADDER XMLID="NCM40" ID="1762923975064" BASECOST="5.0" LEVELS="0" ALIAS="Age:  40+" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(undefined, {
        key: "NCM60",
        type: ["disadvantage"],
        behaviors: [],
        costPerLevel: fixedValueFunction(0),
        target: "self only",
        rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
        xml: `<ADDER XMLID="NCM60" ID="1762923975065" BASECOST="10.0" LEVELS="0" ALIAS="Age:  60+" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });

    addPower(
        {
            key: "PHYSICALLIMITATION",
            type: ["disadvantage"],
            behaviors: [],
            name: "Physical Limitation",
            costPerLevel: fixedValueFunction(0), // TODO: needs function
            target: "self only",
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="PHYSICALLIMITATION" ID="1709445747301" BASECOST="0.0" LEVELS="0" ALIAS="Physical Complication" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="PSYCHOLOGICALLIMITATION" ID="1709445750394" BASECOST="0.0" LEVELS="0" ALIAS="Psychological Complication" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="RIVALRY" ID="1709445753501" BASECOST="0.0" LEVELS="0" ALIAS="Rivalry" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="SOCIALLIMITATION" ID="1709445756212" BASECOST="0.0" LEVELS="0" ALIAS="Social Complication" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            usesStrength: false,
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
            xml: `<DISAD XMLID="SUSCEPTIBILITY" ID="1709445759247" BASECOST="0.0" LEVELS="0" ALIAS="Susceptibility" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            costEnd: false,
            usesStrength: false,
            costPerLevel: fixedValueFunction(5),
            baseEffectDicePartsBundle: luckAndUnluckBaseEffectDiceParts,
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
            rangeForItem: fixedValueFunction(HERO.RANGE_TYPES.SELF),
            xml: `<DISAD XMLID="VULNERABILITY" ID="1709445765160" BASECOST="0.0" LEVELS="0" ALIAS="Vulnerability" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""></DISAD>`,
        },
        {},
    );
})();

(function addAddersToPowerList() {
    addPower(
        {
            // CONTACT related
            key: "ACCESSTOINSTITUTIONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ACCESSTOINSTITUTIONS" ID="1762056036014" BASECOST="1.0" LEVELS="0" ALIAS="Contact has access to major institutions" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "ACCREDITEDINSTRUCTOR",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ACCREDITEDINSTRUCTOR" ID="1762105869400" BASECOST="1.0" LEVELS="0" ALIAS="Accredited Instructor" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
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
            // GENERIC_OBJECT related
            key: "ADDER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GENERIC_OBJECT" ID="1763502186249" BASECOST="0.0" LEVELS="0" ALIAS="Custom Adder" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENTANGLE related
            key: "ADDITIONALBODY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="ADDITIONALBODY" ID="1759025236331" BASECOST="0.0" LEVELS="4" ALIAS="+4d6 Additional BODY" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // ENTANGLE related
        key: "ADDITIONALDEF",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(5),
        xml: `<ADDER XMLID="ADDITIONALDEF" ID="1762666240636" BASECOST="0.0" LEVELS="1" ALIAS="+1 Additional DEF" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
    });
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
            // ENTANGLE related
            key: "ADDITIONALPD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5 / 2),
            // PH: FIXME: Why is there not a cost function for ADDITIONALPD? Should be same as ADDITIONALED.
            xml: `<ADDER XMLID="ADDITIONALPD" ID="1738019116299" BASECOST="0.0" LEVELS="1" ALIAS="+1 Additional PD" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CUSTOMPOWER related
            key: "ADJUSTMENT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ADJUSTMENT" ID="1762720037829" BASECOST="0.0" LEVELS="0" ALIAS="Adjustment Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "ADVANCEDPARA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ADVANCEDPARA" ID="1770523623637" BASECOST="1.0" LEVELS="0" ALIAS="Parachuting, Advanced" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MIF related
            key: "AEROPHONES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AEROPHONES" ID="1762892718194" BASECOST="2.0" LEVELS="0" ALIAS="Aerophones" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "AFFECTSBOTH",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AFFECTSBOTH" ID="1735589942309" BASECOST="0.5" LEVELS="0" ALIAS="Affects Mental And Physical Attackers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "AFTERUSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AFTERUSE" ID="1725669588058" BASECOST="0.25" LEVELS="0" ALIAS="Side Effect occurs when character stops using power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "AGRICULTURAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AGRICULTURAL" ID="1756738532048" BASECOST="1.0" LEVELS="0" ALIAS="Agricultural &amp; Construction Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // COMPUTER_PROGRAMMING related
        key: "AI",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="AI" ID="1770498736875" BASECOST="2.0" LEVELS="0" ALIAS="Artificial Intelligence" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // TRANSPORT_FAMILIARITY, NAVIGATION related
            key: "AIR",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AIR" ID="1756738537033" BASECOST="0.0" LEVELS="0" ALIAS="Air Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "ALTERABLESIZE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ALTERABLESIZE" ID="1762136815081" BASECOST="12.0" LEVELS="0" ALIAS="Alterable Size" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="No" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // Related to attack powers
            key: "ALTERABLEORIGIN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ALTERABLEORIGIN" ID="1711727699280" BASECOST="5.0" LEVELS="0" ALIAS="Alterable Origin Point" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // MANDATORYEFFECT related
            key: "ALWAYS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ALWAYS" ID="1762138779539" BASECOST="-0.25" LEVELS="0" ALIAS="Must Always Achieve [Particular Effect]" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "ANTHROPOMORPHIC",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ANTHROPOMORPHIC" ID="1767399180096" BASECOST="1.0" LEVELS="0" ALIAS="Anthropomorphic Mecha" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ANTIAIRCRAFT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ANTIAIRCRAFT" ID="1759094995666" BASECOST="1.0" LEVELS="0" ALIAS="Anti-Aircraft Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ANTITANK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ANTITANK" ID="1759094996237" BASECOST="1.0" LEVELS="0" ALIAS="Anti-Tank Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LINKED related
            key: "ANYPHASE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ANYPHASE" ID="1762136508028" BASECOST="0.25" LEVELS="0" ALIAS="Lesser Instant Power can be used in any Phase in which greater Constant Power is in use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // HUNTED related
            key: "APPEARANCE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="APPEARANCE" ID="1759026014391" BASECOST="0.0" LEVELS="0" ALIAS="Appearance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EIGHT" OPTIONID="EIGHT" OPTION_ALIAS="Infrequently" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "AQUATIC",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AQUATIC" ID="1762052682734" BASECOST="2.0" LEVELS="0" ALIAS="Aquatic Animals" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ARARE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARARE" ID="1759094965964" BASECOST="1.0" LEVELS="0" ALIAS="Arare" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "ARCTIC",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARCTIC" ID="1762133049628" BASECOST="2.0" LEVELS="0" ALIAS="Arctic/Subarctic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "ARCTICCOAST",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARCTICCOAST" ID="1762133077948" BASECOST="1.0" LEVELS="0" ALIAS="Arctic/Subarctic Coasts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "ARCTICFOREST",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARCTICFOREST" ID="1762133077950" BASECOST="1.0" LEVELS="0" ALIAS="Arctic/Subarctic Forests" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "ARCTICPLAINS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARCTICPLAINS" ID="1762133077949" BASECOST="1.0" LEVELS="0" ALIAS="Arctic/Subarctic Plains" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DANGER_SENSE related
            key: "AREA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AREA" ID="1732478113505" BASECOST="5.0" LEVELS="0" ALIAS="Area" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="IMMEDIATE_VICINITY" OPTIONID="IMMEDIATE_VICINITY" OPTION_ALIAS="immediate vicinity" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "ARISTOCRACY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARISTOCRACY" ID="1762105857632" BASECOST="5.0" LEVELS="0" ALIAS="Member of the Aristocracy/Higher Nobility" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FOCUS related
            key: "ARRANGEMENT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARRANGEMENT" ID="1762133128167" BASECOST="-0.25" LEVELS="0" ALIAS="Arrangement" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "ARROWSBOLTSDARTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARROWSBOLTSDARTS" ID="1762657678170" BASECOST="2.0" LEVELS="0" ALIAS="Arrows, Bolts, And Darts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "ART",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ART" ID="1740275769352" BASECOST="2.0" LEVELS="0" ALIAS="Art Objects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ARTILLERY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ARTILLERY" ID="1759094996678" BASECOST="1.0" LEVELS="0" ALIAS="Artillery" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // NAVIGATION related
            key: "ASTRAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ASTRAL" ID="1762719437298" BASECOST="2.0" LEVELS="0" ALIAS="Astral" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ATATL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ATATL" ID="1759094966470" BASECOST="1.0" LEVELS="0" ALIAS="Atatl" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // VULNERABILITY, CUSTOMPOWER related
            key: "ATTACK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ATTACK" ID="1762048198268" BASECOST="5.0" LEVELS="0" ALIAS="The Attack Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // BOECV related
        key: "ATTACKERCHOOSESDEFENSE",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="ATTACKERCHOOSESDEFENSE" ID="1735602821852" BASECOST="0.5" LEVELS="0" ALIAS="Attacker Chooses Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // WEAPONSMITH related
            key: "AXESANDPICKS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AXESANDPICKS" ID="1762657678747" BASECOST="2.0" LEVELS="0" ALIAS="Axes And Picks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "AXESMACES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="AXESMACES" ID="1759094952909" BASECOST="1.0" LEVELS="0" ALIAS="Axes, Maces, Hammers, and Picks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // GAMBLING related
            key: "BACCARAT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BACCARAT" ID="1762058956927" BASECOST="1.0" LEVELS="0" ALIAS="Baccarat" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "BACKGAMMON",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BACKGAMMON" ID="1762058960054" BASECOST="1.0" LEVELS="0" ALIAS="Backgammon" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "BALLISTA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BALLISTA" ID="1759094976132" BASECOST="1.0" LEVELS="0" ALIAS="Ballista" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "BALLOONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BALLOONS" ID="1756738534200" BASECOST="1.0" LEVELS="0" ALIAS="Balloons &amp; Zeppelins" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_ELEMENT related
            key: "BAREHAND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BAREHAND" ID="1762057132263" BASECOST="1.0" LEVELS="0" ALIAS="Empty Hand" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "BASEBALL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BASEBALL" ID="1762058964213" BASECOST="1.0" LEVELS="0" ALIAS="Baseball" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "BASIC",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BASIC" ID="1762105843480" BASECOST="1.0" LEVELS="0" ALIAS="Basic 8- Contact" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "BASICPARA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BASICPARA" ID="1770523623163" BASECOST="1.0" LEVELS="0" ALIAS="Parachuting, Basic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "BASKETBALL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BASKETBALL" ID="1762058964715" BASECOST="1.0" LEVELS="0" ALIAS="Basketball" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "BEAMWEAPONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BEAMWEAPONS" ID="1759095032335" BASECOST="2.0" LEVELS="0" ALIAS="Beam Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "BEASTSHAPEDMECHA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BEASTSHAPEDMECHA" ID="1767399180626" BASECOST="1.0" LEVELS="0" ALIAS="Beast-Shaped Mecha" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENRAGED related
            key: "BERSERK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BERSERK" ID="1762137650110" BASECOST="10.0" LEVELS="0" ALIAS="Berserk" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "BIOLOGICAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BIOLOGICAL" ID="1762657676391" BASECOST="2.0" LEVELS="0" ALIAS="Biological Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "BIRDS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BIRDS" ID="1762052683320" BASECOST="2.0" LEVELS="0" ALIAS="Birds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "BLACKBELT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BLACKBELT" ID="1762105872441" BASECOST="1.0" LEVELS="0" ALIAS="Black Belt" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "BLACKJACK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BLACKJACK" ID="1762058957417" BASECOST="1.0" LEVELS="0" ALIAS="Blackjack" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "BLADES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BLADES" ID="1759094953287" BASECOST="1.0" LEVELS="0" ALIAS="Blades" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "BLOWGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BLOWGUNS" ID="1759094966912" BASECOST="1.0" LEVELS="0" ALIAS="Blowguns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "BOARDGAMES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BOARDGAMES" ID="1762058978398" BASECOST="2.0" LEVELS="0" ALIAS="Board Games" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "BOBSLEDS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BOBSLEDS" ID="1756738537762" BASECOST="1.0" LEVELS="0" ALIAS="Bobsleds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CUSTOMPOWER related
            key: "BODYAFFECTING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BODYAFFECTING" ID="1762720038983" BASECOST="0.0" LEVELS="0" ALIAS="Body-Affecting Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "BOOMERANGS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BOOMERANGS" ID="1759094967338" BASECOST="1.0" LEVELS="0" ALIAS="Boomerangs and Throwing Clubs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // Charges related
            // TODO: We don't presently have the ability for modifier adders to change the advantage DC of the attack and I'm not sure how that would happen but
            //       the 6e book does call this out as a possibility.
            key: "BOOSTABLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BOOSTABLE" ID="1736721766918" BASECOST="0.25" LEVELS="0" ALIAS="Boostable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // Gestures related
            key: "BOTHHAND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BOTHHAND" ID="1734110256180" BASECOST="-0.25" LEVELS="0" ALIAS="Requires both hands" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "BOVINES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BOVINES" ID="1757193893838" BASECOST="2.0" LEVELS="0" ALIAS="Bovines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY and WEAPONSMITH related
            key: "BOWS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BOWS" ID="1759094961509" BASECOST="1.0" LEVELS="0" ALIAS="Bows" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FOCUS related
            key: "BREAKABILITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BREAKABILITY" ID="1762133129109" BASECOST="-0.25" LEVELS="0" ALIAS="Breakability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FRAGILE" OPTIONID="FRAGILE" OPTION_ALIAS="Fragile" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "BREAKOUT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(3),
            xml: `<ADDER XMLID="BREAKOUT" ID="1711727603898" BASECOST="0.0" LEVELS="1" ALIAS="-1 to Breakout Rolls" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // GAMBLING related
            key: "BRIDGE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BRIDGE" ID="1762058957856" BASECOST="1.0" LEVELS="0" ALIAS="Bridge" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "BROADCAST",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="BROADCAST" ID="1770523557418" BASECOST="1.0" LEVELS="0" ALIAS="Broadcast Communications" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "BUDDHISTMONK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BUDDHISTMONK" ID="1762105854619" BASECOST="1.0" LEVELS="0" ALIAS="Buddhist Monk" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ACTIVATIONROLL (5e) & REQUIRESASKILLROLL/RAR (6e) related
            key: "BURNOUT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BURNOUT" ID="1707272379163" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "BUSINESSRANK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="BUSINESSRANK" ID="1762105874534" BASECOST="0.0" LEVELS="0" ALIAS="Business Rank" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CORPORATEEMPLOYEE" OPTIONID="CORPORATEEMPLOYEE" OPTION_ALIAS="Corporate Employee" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // ANIMAL_HANDLER related
            key: "CAMELS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CAMELS" ID="1762052684160" BASECOST="2.0" LEVELS="0" ALIAS="Camels" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // HEALING related
            key: "CANHEALLIMBS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CANHEALLIMBS" ID="1646155974582" BASECOST="5.0" LEVELS="0" ALIAS="Can Heal Limbs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "CANINES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CANINES" ID="1757193903382" BASECOST="2.0" LEVELS="0" ALIAS="Canines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // STRMINIMUM related
            key: "CANNOTADD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CANNOTADD" ID="1753576657548" BASECOST="-0.5" LEVELS="0" ALIAS="STR Min. Cannot Add/Subtract Damage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // HUNTED related
            key: "CAPABILITIES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CAPABILITIES" ID="1704506828254" BASECOST="5.0" LEVELS="0" ALIAS="Capabilities" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LESS" OPTIONID="LESS" OPTION_ALIAS="(Less Pow" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "CARDGAMES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CARDGAMES" ID="1762058976357" BASECOST="2.0" LEVELS="0" ALIAS="Card Games" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "CARTSANDCARRIAGES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CARTSANDCARRIAGES" ID="1756738528825" BASECOST="1.0" LEVELS="0" ALIAS="Carts &amp; Carriages" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "CATAPULT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CATAPULT" ID="1759094976734" BASECOST="1.0" LEVELS="0" ALIAS="Catapult" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "CELLULAR",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="CELLULAR" ID="1770523556453" BASECOST="1.0" LEVELS="0" ALIAS="Cellular and Digital" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "CHAIN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHAIN" ID="1759094946877" BASECOST="1.0" LEVELS="0" ALIAS="Chain &amp; Rope Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ACCIDENTALCHANGE related
            key: "CHANCETOCHANGE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHANCETOCHANGE" ID="1732470502005" BASECOST="0.0" LEVELS="0" ALIAS="Chance To Change" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INFREQUENT" OPTIONID="INFREQUENT" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENRAGED related
            key: "CHANCETOGO",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            optionIDFix: function (json) {
                return json.OPTION.match(/\d+-/)?.[0] || json.OPTION;
            },
            xml: `<ADDER XMLID="CHANCETOGO" ID="1709447150499" BASECOST="0.0" LEVELS="0" ALIAS="Chance To Become Enraged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8-" OPTIONID="8-" OPTION_ALIAS="go 8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENRAGED related
            key: "CHANCETORECOVER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            optionIDFix: function (json) {
                return json.OPTION.match(/\d+-/)?.[0] || json.OPTION;
            },
            xml: `<ADDER XMLID="CHANCETORECOVER" ID="1704506825140" BASECOST="0.0" LEVELS="0" ALIAS="Chance To Recover" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14-" OPTIONID="14-" OPTION_ALIAS="recover 14-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "CHARANDSKILLROLL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHARANDSKILLROLL" ID="1762136793334" BASECOST="0.0" LEVELS="1" ALIAS="-1 Characteristic Roll and all Skill Rolls based on Characteristic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="4.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "CHARIOTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHARIOTS" ID="1756738529554" BASECOST="1.0" LEVELS="0" ALIAS="Chariots" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "CHARORSKILLROLL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHARORSKILLROLL" ID="1762136786760" BASECOST="0.0" LEVELS="1" ALIAS="-1 to Characteristic Roll or Skill Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "CHEMICAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHEMICAL" ID="1762657675942" BASECOST="2.0" LEVELS="0" ALIAS="Chemical Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "CHESS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHESS" ID="1762058960548" BASECOST="1.0" LEVELS="0" ALIAS="Chess" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // REQUIRESASKILLROLL related
            key: "CHOOSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHOOSE" ID="1759594985413" BASECOST="0.25" LEVELS="0" ALIAS="Can choose which of two rolls to make from use to use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MIF related
            key: "CHORDOPHONES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CHORDOPHONES" ID="1762892718683" BASECOST="2.0" LEVELS="0" ALIAS="Chordophones" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENRAGED related
            key: "CIRCUMSTANCES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CIRCUMSTANCES" ID="1704506825128" BASECOST="5.0" LEVELS="0" ALIAS="Circumstance is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "CLIPS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CLIPS" ID="1737920256938" BASECOST="0.5" LEVELS="1" ALIAS="2 clips" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "CLUBS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CLUBS" ID="1759094953737" BASECOST="0.0" LEVELS="0" ALIAS="Clubs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "COLDWEATHERVEHICLES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COLDWEATHERVEHICLES" ID="1756738539303" BASECOST="0.0" LEVELS="0" ALIAS="Cold-Weather Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH related
            key: "COMBAT_SENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMBAT_SENSE" ID="1738457943820" BASECOST="5.0" LEVELS="0" ALIAS="Combat Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "COMBATAIRCRAFT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMBATAIRCRAFT" ID="1756738536478" BASECOST="1.0" LEVELS="0" ALIAS="Combat Aircraft" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "COMMERCIALGOODS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMMERCIALGOODS" ID="1740275770321" BASECOST="2.0" LEVELS="0" ALIAS="Commercial Goods" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "COMMERCIALSPACE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMMERCIALSPACE" ID="1770523632159" BASECOST="1.0" LEVELS="0" ALIAS="Commercial Spacecraft &amp; Space Yachts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FUELDEPENDENT related
            key: "COMMONALITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMMONALITY" ID="1766366090254" BASECOST="-0.25" LEVELS="0" ALIAS="Commonality" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYCOMMON" OPTIONID="VERYCOMMON" OPTION_ALIAS="fuel is Very Common" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "COMMONMARTIAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMMONMARTIAL" ID="1759095014720" BASECOST="2.0" LEVELS="0" ALIAS="Common Martial Arts Melee Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "COMMONMELEE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMMONMELEE" ID="1759095012783" BASECOST="2.0" LEVELS="0" ALIAS="Common Melee Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "COMMONMISSILE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMMONMISSILE" ID="1759095017178" BASECOST="2.0" LEVELS="0" ALIAS="Common Missile Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "COMMONMOTORIZED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMMONMOTORIZED" ID="1756738530309" BASECOST="2.0" LEVELS="0" ALIAS="Common Motorized Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "COMMUNICATIONS",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="COMMUNICATIONS" ID="1770523559346" BASECOST="2.0" LEVELS="0" ALIAS="Communications Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
    });
    addPower(
        {
            // GESTURES related
            key: "COMPLEX",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="COMPLEX" ID="1762104994741" BASECOST="-0.25" LEVELS="0" ALIAS="Complex" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // COMPUTER_PROGRAMMING related
        key: "COMPUTERNETWORKS",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="COMPUTERNETWORKS" ID="1770498733949" BASECOST="2.0" LEVELS="0" ALIAS="Computer Networks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // DISTINCTIVEFEATURES related
            key: "CONCEALABILITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CONCEALABILITY" ID="1759025865716" BASECOST="5.0" LEVELS="0" ALIAS="Concealability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EASILY" OPTIONID="EASILY" OPTION_ALIAS="(Easily Concealed" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "CONCEALEDWEAPONPERMIT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CONCEALEDWEAPONPERMIT" ID="1762105850002" BASECOST="2.0" LEVELS="0" ALIAS="Concealed Weapon Permit (where appropriate)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SUSCEPTIBILITY related
            key: "CONDITION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CONDITION" ID="1704506851684" BASECOST="5.0" LEVELS="0" ALIAS="Condition Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CONTACT related
            key: "CONTACTHASCONTACTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CONTACTHASCONTACTS" ID="1762056036489" BASECOST="1.0" LEVELS="0" ALIAS="Contact has significant Contacts of his own" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "CONTINUING",
            behaviors: ["adder"],
            type: ["adder"],
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
            type: ["adder"],
            costPerLevel: fixedValueFunction(1 / 2),
            xml: `<ADDER XMLID="CONTROLCOST" ID="1752275757727" BASECOST="0.0" LEVELS="6" ALIAS="Control Cost" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="No" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // GAMBLING related
            key: "CRAPS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CRAPS" ID="1762058959479" BASECOST="1.0" LEVELS="0" ALIAS="Craps" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "CRIMINALRANK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CRIMINALRANK" ID="1762105875115" BASECOST="1.0" LEVELS="0" ALIAS="Criminal Rank" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="GANGMEMBER" OPTIONID="GANGMEMBER" OPTION_ALIAS="Gang/organized crime group member" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY and WEAPONSMITH related
            key: "CROSSBOWS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CROSSBOWS" ID="1759094962133" BASECOST="1.0" LEVELS="0" ALIAS="Crossbows" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // COMPUTER_PROGRAMMING related
            key: "CYBER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="CYBER" ID="1770521483298" BASECOST="1.0" LEVELS="0" ALIAS="Cyberspace" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // SUSCEPTIBILITY and CHANGEENVIRONMENT related
            key: "DAMAGE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0), // PH: FIXME: Need a proper function for this as they are different.
            xml: `<ADDER XMLID="DAMAGE" ID="1704506851678" BASECOST="0.0" LEVELS="0" ALIAS="Take Damage Every" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INSTANT" OPTIONID="INSTANT" OPTION_ALIAS="Instant" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // INVISIBILITY related
            key: "DANGER_SENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DANGER_SENSE" ID="1738457617013" BASECOST="3.0" LEVELS="0" ALIAS="Danger Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // IMAGES related
            key: "DECREASEDPERROLL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DECREASEDPERROLL" ID="1767000406168" BASECOST="0.0" LEVELS="1" ALIAS="+/-1 to PER Rolls" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_ELEMENT related
            key: "DEFAULTELEMENT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DEFAULTELEMENT" ID="1762057131681" BASECOST="0.0" LEVELS="0" ALIAS="Default Element" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TUNNELING related
            key: "DEFBONUS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DEFBONUS" ID="1712964171511" BASECOST="0.0" LEVELS="8" ALIAS="+8 DEF" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // COMPUTER_PROGRAMMING and CUSTOMPOWER related
            key: "DEFENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DEFENSE" ID="1762720039464" BASECOST="0.0" LEVELS="0" ALIAS="Defense Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // RIVALRY related
            key: "DESCRIPTION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DESCRIPTION" ID="1704506845127" BASECOST="0.0" LEVELS="0" ALIAS="Rivalry Desc." POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DEFAULT" OPTIONID="DEFAULT" OPTION_ALIAS="(" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "DESERT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DESERT" ID="1762133049629" BASECOST="2.0" LEVELS="0" ALIAS="Desert" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // COMPUTER_PROGRAMMING related
            key: "DESKTOP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DESKTOP" ID="1770521481911" BASECOST="1.0" LEVELS="0" ALIAS="Desktop Computers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SUSCEPTIBILITY related
            key: "DICE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DICE" ID="1704506851665" BASECOST="0.0" LEVELS="0" ALIAS="Number of Dice" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1D6" OPTIONID="1D6" OPTION_ALIAS="1d6 damage" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "DICEGAMES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DICEGAMES" ID="1762058977460" BASECOST="2.0" LEVELS="0" ALIAS="Dice Games" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "DIFFICULTFUEL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DIFFICULTFUEL" ID="1762721003577" BASECOST="-0.25" LEVELS="0" ALIAS="Fuel is Difficult to obtain" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // NAVIGATION and SYSTEMS_OPERATION related
            key: "DIMENSIONAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DIMENSIONAL" ID="1762719436833" BASECOST="2.0" LEVELS="0" ALIAS="Dimensional" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "DIMENSIONALSENSORS",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="DIMENSIONALSENSORS" ID="1770523569724" BASECOST="1.0" LEVELS="0" ALIAS="Dimensional Sensors" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // STRETCHING related
            key: "DIMENSIONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DIMENSIONS" ID="1733644749271" BASECOST="0.0" LEVELS="4" ALIAS="x16 body dimension" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "DIPLOMATICIMMUNITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DIPLOMATICIMMUNITY" ID="1762105859047" BASECOST="5.0" LEVELS="0" ALIAS="Diplomatic Immunity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "DISINTEGRATORS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DISINTEGRATORS" ID="1759095003570" BASECOST="1.0" LEVELS="0" ALIAS="Disintegrators" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENTANGLE related
            key: "DISMISSABLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DISMISSABLE" ID="1711727991571" BASECOST="5.0" LEVELS="0" ALIAS="Dismissable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // FORGERY related
            key: "DOCUMENTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DOCUMENTS" ID="1740275768279" BASECOST="2.0" LEVELS="0" ALIAS="Documents" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "DOGRACING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DOGRACING" ID="1762058965189" BASECOST="1.0" LEVELS="0" ALIAS="Dog Racing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "DOGS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DOGS" ID="1703372527416" BASECOST="1.0" LEVELS="0" ALIAS="Dogs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "DOGSLEDS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DOGSLEDS" ID="1770523612615" BASECOST="1.0" LEVELS="0" ALIAS="Dog Sleds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "DOMINOES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DOMINOES" ID="1762058960998" BASECOST="1.0" LEVELS="0" ALIAS="Dominoes" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // AUTOFIRE related
            key: "DOUBLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DOUBLE" ID="1760909069341" BASECOST="0.0" LEVELS="1" ALIAS="x2 Shots" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="0.5" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "DOUBLEAREA",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(1 / 4),
        xml: `<ADDER XMLID="DOUBLEAREA" ID="1707272359920" BASECOST="0.0" LEVELS="1" ALIAS="x2 Radius" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            key: "DOUBLEHEIGHT",
            behaviors: ["adder"],
            type: ["adder"],
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
        type: ["adder"],
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
            type: ["adder"],
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
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "DRAGONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="DRAGONS" ID="1757193905408" BASECOST="2.0" LEVELS="0" ALIAS="Dragons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "EARLYEMPLACEDWEAPONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EARLYEMPLACEDWEAPONS" ID="1759094995247" BASECOST="1.0" LEVELS="0" ALIAS="Early Emplaced Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "EARLYFIREARMS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EARLYFIREARMS" ID="1759095021996" BASECOST="2.0" LEVELS="0" ALIAS="Early Firearms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "EARLYGRENADES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EARLYGRENADES" ID="1759094967797" BASECOST="1.0" LEVELS="0" ALIAS="Early Thrown Grenades" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "EARLYMUZZLELOADERS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EARLYMUZZLELOADERS" ID="1759094980114" BASECOST="1.0" LEVELS="0" ALIAS="Early Muzzleloaders" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "EARLYPERCUSSIONFIREARMS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EARLYPERCUSSIONFIREARMS" ID="1759094982049" BASECOST="1.0" LEVELS="0" ALIAS="Early Percussion Firearms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TREANSPORT_FAMILIARITY related
            key: "EARLYSPACE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EARLYSPACE" ID="1770523630495" BASECOST="1.0" LEVELS="0" ALIAS="Early Spacecraft" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "EATING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EATING" ID="1762058849322" BASECOST="1.0" LEVELS="0" ALIAS="Eating:" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="WEEK" OPTIONID="WEEK" OPTION_ALIAS="Character only has to eat once per week" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MINDSCAN efffects related
            key: "ECVBONUS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(2),
            xml: `<ADDER XMLID="ECVBONUS" ID="1738448289783" BASECOST="0.0" LEVELS="1" ALIAS="+1 OMCV" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="2.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSPARENT related
        key: "ED",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="ED" ID="1752359726494" BASECOST="0.5" LEVELS="0" ALIAS="ED" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // DEPENDENCE related
            key: "EFFECT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EFFECT" ID="1704506813677" BASECOST="5.0" LEVELS="0" ALIAS="Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DAMAGE1D6" OPTIONID="DAMAGE1D6" OPTION_ALIAS="Takes 1d6 Damage" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SOCIALLIMITATION related
            key: "EFFECTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EFFECTS" ID="1704506848428" BASECOST="0.0" LEVELS="0" ALIAS="Effects of Restrictions" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINOR" OPTIONID="MINOR" OPTION_ALIAS="Minor" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // NOCONSCIOUSCONTROL related
            key: "EFFECTSONLY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EFFECTSONLY" ID="1646155910708" BASECOST="1.0" LEVELS="0" ALIAS="Only Effects cannot be controlled" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // INVISIBLE power efffects related
            key: "EFFECTSOTHER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EFFECTSOTHER" ID="1737919631444" BASECOST="0.0" LEVELS="0" ALIAS="Effects of Power on other characters" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DEFAULT" OPTIONID="DEFAULT" OPTION_ALIAS="[default/no change]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // INVISIBLE power efffects related
            key: "EFFECTSTARGET",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EFFECTSTARGET" ID="1737919631438" BASECOST="0.0" LEVELS="0" ALIAS="Effects of Power on target" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DEFAULT" OPTIONID="DEFAULT" OPTION_ALIAS="[default/no change]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGE ENVIRONMENT related
            key: "EGO",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="EGO" ID="1738458050930" BASECOST="0.0" LEVELS="1" ALIAS="-1 point of EGO" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ELECTRICWHIP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ELECTRICWHIP" ID="1759094936730" BASECOST="1.0" LEVELS="0" ALIAS="Electric Whip" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ELECTRONBEAM",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ELECTRONBEAM" ID="1759095001322" BASECOST="1.0" LEVELS="0" ALIAS="Electron Beam Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "ELEPHANTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ELEPHANTS" ID="1757193906512" BASECOST="2.0" LEVELS="0" ALIAS="Elephants" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "EMPLACEDWEAPONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EMPLACEDWEAPONS" ID="1759095025918" BASECOST="2.0" LEVELS="0" ALIAS="Emplaced Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DAMAGENEGATION and WEAPONSMITH related
            key: "ENERGY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="ENERGY" ID="1738019507455" BASECOST="0.0" LEVELS="2" ALIAS="Energy DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ENERGYBLADES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ENERGYBLADES" ID="1759094937220" BASECOST="1.0" LEVELS="0" ALIAS="Energy Blades" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ENERGYWEAPONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ENERGYWEAPONS" ID="1759095034623" BASECOST="2.0" LEVELS="0" ALIAS="Energy Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "ENHANCEDPERCEPTION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="ENHANCEDPERCEPTION" ID="1738452075059" BASECOST="0.0" LEVELS="1" ALIAS="+1 to PER Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "ENVIRONMENTAL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="ENVIRONMENTAL" ID="1770523560953" BASECOST="2.0" LEVELS="0" ALIAS="Environmental Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
    });
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "EQUINES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EQUINES" ID="1757193907144" BASECOST="2.0" LEVELS="0" ALIAS="Equines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "ESPIONAGERANK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ESPIONAGERANK" ID="1762105876446" BASECOST="1.0" LEVELS="0" ALIAS="Espionage Rank" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EMPLOYEE1" OPTIONID="EMPLOYEE1" OPTION_ALIAS="CIA employee" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // REQUIRESASKILLROLL related
            key: "EVERYPHASE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EVERYPHASE" ID="1752344979758" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "EXPANDEDBREATHING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EXPANDEDBREATHING" ID="1762058847140" BASECOST="5.0" LEVELS="0" ALIAS="Expanded Breathing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FOCUS related
            key: "EXPENDABILITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EXPENDABILITY" ID="1762133129912" BASECOST="0.0" LEVELS="0" ALIAS="Expendability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EASY" OPTIONID="EASY" OPTION_ALIAS="Easy to obtain new Focus" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "EXTENDEDBREATHING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EXTENDEDBREATHING" ID="1762058847739" BASECOST="1.0" LEVELS="0" ALIAS="Extended Breathing:" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1" OPTIONID="1" OPTION_ALIAS="1 END per Turn" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // REPUTATION related
            key: "EXTREME",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EXTREME" ID="1762136058767" BASECOST="5.0" LEVELS="0" ALIAS="(Extreme" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRIGGER related
            key: "EXPIRE",
            behaviors: ["adder"],
            type: ["adder"],
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
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EXPLOSION" ID="1738457272027" BASECOST="-0.5" LEVELS="0" ALIAS="Explosion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "EXTREMELYDIFFICULTFUEL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="EXTREMELYDIFFICULTFUEL" ID="1762720874755" BASECOST="-1.0" LEVELS="0" ALIAS="Fuel is Extremely Difficult to obtain" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // GAMBLING related
            key: "FARO",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FARO" ID="1762058958332" BASECOST="1.0" LEVELS="0" ALIAS="Faro" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "FEDERALPOLICE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FEDERALPOLICE" ID="1762105855714" BASECOST="3.0" LEVELS="0" ALIAS="Federal/National Police Powers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "FELINES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FELINES" ID="1757193665259" BASECOST="2.0" LEVELS="0" ALIAS="Felines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // RIVALRY related
            key: "FIERCENESS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FIERCENESS" ID="1704506845139" BASECOST="0.0" LEVELS="0" ALIAS="Fierceness of Rivalry" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OUTDO" OPTIONID="OUTDO" OPTION_ALIAS="Seek to Outdo, Embarrass, or Humiliate Rival" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TUNNELING related
            key: "FILLIN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FILLIN" ID="1712964171509" BASECOST="10.0" LEVELS="0" ALIAS="Fill In" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TELEKINESIS related
            key: "FINEMANIPULATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FINEMANIPULATION" ID="1712366585251" BASECOST="10.0" LEVELS="0" ALIAS="Fine Manipulation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "FIREARMS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FIREARMS" ID="1762657674988" BASECOST="2.0" LEVELS="0" ALIAS="Firearms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "FISTLOADS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FISTLOADS" ID="1759094954187" BASECOST="0.0" LEVELS="0" ALIAS="Fist-Loads" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "FIXEDSHAPE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(1 / 4),
            xml: `<ADDER XMLID="FIXEDSHAPE" ID="1707357527471" BASECOST="-0.25" LEVELS="0" ALIAS="Fixed Shape" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY and WEAPONSMITH related
            key: "FLAILS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FLAILS" ID="1759094931202" BASECOST="1.0" LEVELS="0" ALIAS="Flails" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "FLAMETHROWERS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FLAMETHROWERS" ID="1759094993320" BASECOST="1.0" LEVELS="0" ALIAS="Flamethrowers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSPARENT related
        key: "FLASHD",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="FLASHD" ID="1752364671800" BASECOST="0.25" LEVELS="0" ALIAS="Flash" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FORCEFIELD related
            key: "FLASHDEFENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(3 / 2),
            xml: `<ADDER XMLID="FLASHDEFENSE" ID="1736295402655" BASECOST="0.0" LEVELS="1" ALIAS="Flash Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "FLINTLOCKS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FLINTLOCKS" ID="1759094981592" BASECOST="1.0" LEVELS="0" ALIAS="Flintlocks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "FLYINGCLAW",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FLYINGCLAW" ID="1759094941587" BASECOST="1.0" LEVELS="0" ALIAS="Flying Claw/Guillotine" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "FLYINGBEASTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FLYINGBEASTS" ID="1703372526687" BASECOST="1.0" LEVELS="0" ALIAS="Flying Beasts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "FOOTBALL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FOOTBALL" ID="1762058965646" BASECOST="1.0" LEVELS="0" ALIAS="Football" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "FREEROBOT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FREEROBOT" ID="1762105863471" BASECOST="1.0" LEVELS="0" ALIAS="Free Robot" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "FTL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="FTL" ID="1770523558831" BASECOST="1.0" LEVELS="0" ALIAS="FTL Communications" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "FTLSENSORS",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="FTLSENSORS" ID="1770523568945" BASECOST="1.0" LEVELS="0" ALIAS="FTL Sensors" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // CHARGES related
            key: "FUEL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FUEL" ID="1762720872336" BASECOST="0.25" LEVELS="0" ALIAS="Fuel" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "FUKIMIBARI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="FUKIMIBARI" ID="1759094968262" BASECOST="1.0" LEVELS="0" ALIAS="Fukimi-Bari" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // FRINGE_BENEFIT related
            key: "GALACTICCOMPUTERNET",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GALACTICCOMPUTERNET" ID="1762105856322" BASECOST="3.0" LEVELS="0" ALIAS="Galactic Computernet Access Card" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "GARROTE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GARROTE" ID="1759094931724" BASECOST="1.0" LEVELS="0" ALIAS="Garrote" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "GAUSSGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GAUSSGUNS" ID="1759094987322" BASECOST="1.0" LEVELS="0" ALIAS="Gauss Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "GOMOKU",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GOMOKU" ID="1762058961426" BASECOST="1.0" LEVELS="0" ALIAS="Go-Moku" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CONTACT related
            key: "GOODRELATIONSHIP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GOODRELATIONSHIP" ID="1762056040379" BASECOST="1.0" LEVELS="0" ALIAS="Good relationship with Contact" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "GOVERNMENTRANK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GOVERNMENTRANK" ID="1762105877334" BASECOST="1.0" LEVELS="0" ALIAS="Government Rank" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="IMPORTANTLOCAL" OPTIONID="IMPORTANTLOCAL" OPTION_ALIAS="Important local government official" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // UOO related
            key: "GRANTORPAYSEND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GRANTORPAYSEND" ID="1764073515707" BASECOST="-0.25" LEVELS="0" ALIAS="Grantor pays the END whenever the power is used" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "GRAVVEHICLES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GRAVVEHICLES" ID="1770523631291" BASECOST="1.0" LEVELS="0" ALIAS="Grav Vehicles/Hovercraft" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "GRENADELAUNCHERS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GRENADELAUNCHERS" ID="1759094993738" BASECOST="1.0" LEVELS="0" ALIAS="Grenade Launchers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DEPENDENTNPC related
            key: "GROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="GROUP" ID="1762057565025" BASECOST="0.0" LEVELS="1" ALIAS="Group DNPC: x2 DNPCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(undefined, {
        // COMPUTER_PROGRAMMING related
        key: "HACKING",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="HACKING" ID="1770498735182" BASECOST="2.0" LEVELS="0" ALIAS="Hacking and Computer Security" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "HANDGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HANDGUNS" ID="1759094984582" BASECOST="1.0" LEVELS="0" ALIAS="Handguns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // COMPUTER_PROGRAMMING related
            key: "HANDHELD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HANDHELD" ID="1770521480727" BASECOST="1.0" LEVELS="0" ALIAS="Handheld Computers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "HANGGLIDING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HANGGLIDING" ID="1770523622215" BASECOST="1.0" LEVELS="0" ALIAS="Hanggliding" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "HEADOFSTATE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HEADOFSTATE" ID="1762105862309" BASECOST="10.0" LEVELS="0" ALIAS="Head of State" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HOS" OPTIONID="HOS" OPTION_ALIAS="Head of State" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSFORM related
            key: "HEALEDBY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HEALEDBY" ID="1760247859028" BASECOST="0.0" LEVELS="0" ALIAS="Healed back by" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="METHOD" OPTIONID="METHOD" OPTION_ALIAS="" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "HEARINGGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HEARINGGROUP" ID="1762134795044" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "HEAVYMACHINEGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HEAVYMACHINEGUNS" ID="1759094994155" BASECOST="1.0" LEVELS="0" ALIAS="General Purpose/Heavy Machine Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "HEAVYWEAPONPERMIT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HEAVYWEAPONPERMIT" ID="1762105878929" BASECOST="2.0" LEVELS="0" ALIAS="Heavy Weapon Permit" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "HELICOPTERS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HELICOPTERS" ID="1756738537032" BASECOST="1.0" LEVELS="0" ALIAS="Helicopters" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "HIGHPRESSURE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HIGHPRESSURE" ID="1762058851295" BASECOST="1.0" LEVELS="0" ALIAS="Safe in High Pressure" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "HIGHRADIATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HIGHRADIATION" ID="1762058851726" BASECOST="2.0" LEVELS="0" ALIAS="Safe in High Radiation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "HOMEMADEWEAPONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HOMEMADEWEAPONS" ID="1759094932206" BASECOST="1.0" LEVELS="0" ALIAS="Homemade Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "HOOKSWORD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HOOKSWORD" ID="1759094942254" BASECOST="1.0" LEVELS="0" ALIAS="Hook Sword" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "HORSERACING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HORSERACING" ID="1762058966178" BASECOST="1.0" LEVELS="0" ALIAS="Horse Racing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "HOWITZERS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HOWITZERS" ID="1759094997080" BASECOST="1.0" LEVELS="0" ALIAS="Howitzers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WINDOWOFOPPORTUNITY related
            key: "HOWLONG",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HOWLONG" ID="1767000501402" BASECOST="-2.0" LEVELS="0" ALIAS="How Long" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SEGMENT" OPTIONID="SEGMENT" OPTION_ALIAS="window remains open for 1 Segment" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WINDOWOFOPPORTUNITY related
            key: "HOWOFTEN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HOWOFTEN" ID="1767000501383" BASECOST="-2.0" LEVELS="0" ALIAS="How Often" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MONTH" OPTIONID="MONTH" OPTION_ALIAS="once per Month" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // REPUTATION related
            key: "HOWWELL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HOWWELL" ID="1755459521093" BASECOST="0.0" LEVELS="0" ALIAS="How Well Known" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // REPUTATION related
            key: "HOWWIDE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HOWWIDE" ID="1755459521087" BASECOST="1.0" LEVELS="0" ALIAS="How Widely Known" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MEDIUMGROUP" OPTIONID="MEDIUMGROUP" OPTION_ALIAS="A medium-sized group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "HUGEBEASTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HUGEBEASTS" ID="1703372526306" BASECOST="1.0" LEVELS="0" ALIAS="Huge Beasts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MIF related
            key: "HURDY_GURDY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HURDY_GURDY" ID="1762892720133" BASECOST="2.0" LEVELS="0" ALIAS="Hurdy-Gurdy" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "HYBRIDMECHA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HYBRIDMECHA" ID="1767399181260" BASECOST="1.0" LEVELS="0" ALIAS="Hybrid/Shapeshifting Mecha" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // NAVIGATION related
            key: "HYPERSPACE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="HYPERSPACE" ID="1762719436416" BASECOST="2.0" LEVELS="0" ALIAS="Hyperspace" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // MIF related
            key: "IDIOPHONES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="IDIOPHONES" ID="1762892719131" BASECOST="2.0" LEVELS="0" ALIAS="Idiophones" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SHAPESHIFT related
            key: "IMITATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="IMITATION" ID="1731986047971" BASECOST="10.0" LEVELS="0" ALIAS="Imitation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "IMMUNITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="IMMUNITY" ID="1705805808207" BASECOST="3.0" LEVELS="0" ALIAS="Immunity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NEURO" OPTIONID="NEURO" OPTION_ALIAS="Neuro Toxins" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // PHYSICALLIMITATION related
            key: "IMPAIRS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="IMPAIRS" ID="1756698597850" BASECOST="5.0" LEVELS="0" ALIAS="Limitation Impairs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="GREATLY" OPTIONID="GREATLY" OPTION_ALIAS="Greatly Impairing" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // 6e FORCEFIELD related
            key: "IMPERMEABLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="IMPERMEABLE" ID="1767853022608" BASECOST="0.0" LEVELS="0" ALIAS="Impermeable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "IMPROVEDEQUIPMENTAVAILABILITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="IMPROVEDEQUIPMENTAVAILABILITY" ID="1762105880024" BASECOST="3.0" LEVELS="0" ALIAS="Improved Equipment Availability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STREET" OPTIONID="STREET" OPTION_ALIAS="Street-Level equipment" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MOVEMENT related
            key: "IMPROVEDNONCOMBAT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="IMPROVEDNONCOMBAT" ID="1738018484005" BASECOST="0.0" LEVELS="1" ALIAS="x4 Noncombat" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "INCENDIARY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCENDIARY" ID="1762657676928" BASECOST="2.0" LEVELS="0" ALIAS="Incendiary Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TELEPORTATION related
            key: "INCREASEDMASS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCREASEDMASS" ID="1762656916177" BASECOST="0.0" LEVELS="1" ALIAS="x2 Increased Mass" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // 5e adjustment related
        key: "INCREASEDMAX",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(1 / 2),
        cost: function (item) {
            const levels = parseInt(item.LEVELS || 0);
            return levels > 0 ? Math.ceil(levels / 2) : 0;
        },
        xml: `<ADDER XMLID="INCREASEDMAX" ID="1734826313991" BASECOST="0.0" LEVELS="3" ALIAS="Increased Maximum (+3 points)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // MULTIFORM related
            key: "INCREASENUMBER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCREASENUMBER" ID="1762663925143" BASECOST="0.0" LEVELS="1" ALIAS="x2 Number Of Forms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CLIPS related
            key: "INCREASEDRELOAD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCREASEDRELOAD" ID="1737923202328" BASECOST="-0.25" LEVELS="0" ALIAS="Increased Reloading Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EXTRAPHASE" OPTIONID="EXTRAPHASE" OPTION_ALIAS="2 Full Phases" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // EXTRADIMENSIONALMOVEMENT related
            key: "INCREASEDWEIGHT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCREASEDWEIGHT" ID="1711728009754" BASECOST="0.0" LEVELS="1" ALIAS="x2 Increased Weight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SUMMON related
            key: "INCREASETOTAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCREASETOTAL" ID="1688216155887" BASECOST="0.0" LEVELS="1" ALIAS="x2 Number Of Beings" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DAMAGEOVERTIME related
            key: "INCREMENTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INCREMENTS" ID="1738534117222" BASECOST="0.25" LEVELS="0" ALIAS="Number of Damage Increments" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2" OPTIONID="2" OPTION_ALIAS="2" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "INDUSTRIALSPACE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INDUSTRIALSPACE" ID="1770523632585" BASECOST="1.0" LEVELS="0" ALIAS="Industrial &amp; Exploratory Spacecraft" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "INERTIALGLOVES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INERTIALGLOVES" ID="1759094937998" BASECOST="1.0" LEVELS="0" ALIAS="Inertial Gloves" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // COMPUTER_PROGRAMMING related
            key: "INFILTRATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INFILTRATION" ID="1770521484348" BASECOST="1.0" LEVELS="0" ALIAS="Infiltration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "INSECTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INSECTS" ID="1762052685705" BASECOST="2.0" LEVELS="0" ALIAS="Insects &amp; Anthropods" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "INTENSECOLD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INTENSECOLD" ID="1762058852157" BASECOST="2.0" LEVELS="0" ALIAS="Safe in Intense Cold" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "INTERNATIONALDL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INTERNATIONALDL" ID="1762105844847" BASECOST="1.0" LEVELS="0" ALIAS="International Driver's License" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "INTERNATIONALPOLICE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INTERNATIONALPOLICE" ID="1762105859606" BASECOST="5.0" LEVELS="0" ALIAS="Police Powers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INTERNATIONAL" OPTIONID="INTERNATIONAL" OPTION_ALIAS="International Police Powers" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "INTENSEHEAT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INTENSEHEAT" ID="1762058852755" BASECOST="2.0" LEVELS="0" ALIAS="Safe in Intense Heat" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // PSYCHOLOGICALLIMITATION related
            key: "INTENSITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="INTENSITY" ID="1709447166359" BASECOST="0.0" LEVELS="0" ALIAS="Intensity Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MODERATE" OPTIONID="MODERATE" OPTION_ALIAS="Moderate" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "IONBLASTER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="IONBLASTER" ID="1759095002574" BASECOST="1.0" LEVELS="0" ALIAS="Ion Blasters" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "IRONDUCK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="IRONDUCK" ID="1759094968705" BASECOST="1.0" LEVELS="0" ALIAS="Iron Mandarin Duck" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // ACTIVATIONROLL related
            key: "JAMMED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="JAMMED" ID="1707272381673" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "JAMMING",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="JAMMING" ID="1770523558333" BASECOST="1.0" LEVELS="0" ALIAS="Communications Jamming Equipment" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "JAVELINS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="JAVELINS" ID="1759094962584" BASECOST="1.0" LEVELS="0" ALIAS="Javelins and Thrown Spears" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "JETSKIS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="JETSKIS" ID="1770523622721" BASECOST="1.0" LEVELS="0" ALIAS="Jetskis" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "KARATE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="KARATE" ID="1759094947319" BASECOST="1.0" LEVELS="0" ALIAS="Karate Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "KISERU",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="KISERU" ID="1759094942719" BASECOST="1.0" LEVELS="0" ALIAS="Kiseru" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "KIRISUTOGOMEN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="KIRISUTOGOMEN" ID="1762105873022" BASECOST="10.0" LEVELS="0" ALIAS="Kirisutogomen" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "KNIGHT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="KNIGHT" ID="1762105850565" BASECOST="2.0" LEVELS="0" ALIAS="Knight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // RIVALRY related
            key: "KNOWLEDGE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="KNOWLEDGE" ID="1704506845144" BASECOST="0.0" LEVELS="0" ALIAS="Knowledge of Rivalry" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="AWARE" OPTIONID="AWARE" OPTION_ALIAS="Rival Aware of Rivalry" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "LAJATANG",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LAJATANG" ID="1759094944217" BASECOST="1.0" LEVELS="0" ALIAS="Lajatang" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "LANCES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LANCES" ID="1759094933778" BASECOST="1.0" LEVELS="0" ALIAS="Lances" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // NAVIGATION related
            key: "LAND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LAND" ID="1762719434292" BASECOST="2.0" LEVELS="0" ALIAS="Land" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "LARGEMILITARYSHIPS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LARGEMILITARYSHIPS" ID="1756738546240" BASECOST="1.0" LEVELS="0" ALIAS="Large Military Ships" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "LARGEMOTORIZED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LARGEMOTORIZED" ID="1761442823816" BASECOST="1.0" LEVELS="0" ALIAS="Large Motorized Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "LARGEMOTORIZEDBOATS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LARGEMOTORIZEDBOATS" ID="1756738545220" BASECOST="1.0" LEVELS="0" ALIAS="Large Motorized Boats" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "LARGEPLANES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LARGEPLANES" ID="1756738535596" BASECOST="1.0" LEVELS="0" ALIAS="Large Planes" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "LARGEROWED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LARGEROWED" ID="1756738543300" BASECOST="1.0" LEVELS="0" ALIAS="Large Rowed Boats" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "LARGEWIND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LARGEWIND" ID="1756738544208" BASECOST="1.0" LEVELS="0" ALIAS="Large Wind-Powered Boats" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "LASERPISTOL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LASERPISTOL" ID="1759095000406" BASECOST="1.0" LEVELS="0" ALIAS="Laser Pistols" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "LASERRIFLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LASERRIFLE" ID="1759095000913" BASECOST="1.0" LEVELS="0" ALIAS="Laser Rifles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "LAWENFORCEMENTRANK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LAWENFORCEMENTRANK" ID="1762105878248" BASECOST="1.0" LEVELS="0" ALIAS="Law Enforcement Rank" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="POLICEOFFICER" OPTIONID="POLICEOFFICER" OPTION_ALIAS="Police officer" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // MONEYDISAD related
        key: "LEVEL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="LEVEL" ID="1756698580846" BASECOST="10.0" LEVELS="0" ALIAS="Income Level" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DESTITUTE" OPTIONID="DESTITUTE" OPTION_ALIAS="Destitute" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "LICENSEDPSIONIC",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LICENSEDPSIONIC" ID="1762105864036" BASECOST="1.0" LEVELS="0" ALIAS="Licensed Psionic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "LICENSETOKILL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LICENSETOKILL" ID="1762105862830" BASECOST="10.0" LEVELS="0" ALIAS="License to Kill" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "LIFESUPPORT",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="LIFESUPPORT" ID="1770523559947" BASECOST="1.0" LEVELS="0" ALIAS="Life Support Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // HUNTED related
            key: "LIMITED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LIMITED" ID="1762104709674" BASECOST="-5.0" LEVELS="0" ALIAS="Limited Geographical Area" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CONTACT related
            key: "LIMITEDBYID",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LIMITEDBYID" ID="1762056034790" BASECOST="-1.0" LEVELS="0" ALIAS="Contact limited by identity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // VARIABLEADVANTAGE related
            key: "LIMITEDGROUP",
            behaviors: ["adder"],
            type: ["adder"],
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
            type: ["adder"],
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
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LIMITEDRECOVER" ID="1729971742993" BASECOST="-0.5" LEVELS="0" ALIAS="Recovers after 2 Hours of Study" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "LIQUIDRIFLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LIQUIDRIFLE" ID="1759094986848" BASECOST="1.0" LEVELS="0" ALIAS="Liquid-Propellant Rifles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LANGUAGES related
            key: "LITERACY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LITERACY" ID="1762888786379" BASECOST="1.0" LEVELS="0" ALIAS="literate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "LMGS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LMGS" ID="1759094984132" BASECOST="1.0" LEVELS="0" ALIAS="Assault Rifles/LMGs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // COMPUTER_PROGRAMMING related
            key: "LOCAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LOCAL" ID="1770521482733" BASECOST="1.0" LEVELS="0" ALIAS="Local Networks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "LOCALPOLICE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LOCALPOLICE" ID="1762105851141" BASECOST="2.0" LEVELS="0" ALIAS="Local Police Powers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "LONG",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LONG" ID="1762136814145" BASECOST="5.0" LEVELS="0" ALIAS="Long-Lasting" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="20MINUTES" OPTIONID="20MINUTES" OPTION_ALIAS="20 Minutes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "LONGEVITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LONGEVITY" ID="1705805816259" BASECOST="1.0" LEVELS="0" ALIAS="Longevity:" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOHUNDRED" OPTIONID="TWOHUNDRED" OPTION_ALIAS="200 Years" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "LORDSHIP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LORDSHIP" ID="1762105852386" BASECOST="1.0" LEVELS="0" ALIAS="Lordship" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SQUIRE" OPTIONID="SQUIRE" OPTION_ALIAS="Squire" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "LOWERNOBILITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LOWERNOBILITY" ID="1762105851725" BASECOST="2.0" LEVELS="0" ALIAS="Member of the Lower Nobility" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "LOWJUSTICE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LOWJUSTICE" ID="1762105856903" BASECOST="3.0" LEVELS="0" ALIAS="Low Justice:  Character has the right to mete out justice." POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "LOWPRESSUREVACUUM",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="LOWPRESSUREVACUUM" ID="1762058850828" BASECOST="2.0" LEVELS="0" ALIAS="Safe in Low Pressure/Vacuum" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // WEAPONSMITH related
            key: "MACESANDHAMMERS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MACESANDHAMMERS" ID="1762657680767" BASECOST="2.0" LEVELS="0" ALIAS="Maces And Hammers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "MAHJONGG",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MAHJONGG" ID="1762058962325" BASECOST="1.0" LEVELS="0" ALIAS="Mahjongg" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // COMPUTER_PROGRAMMING related
        key: "MAINFRAME",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="MAINFRAME" ID="1770498734652" BASECOST="2.0" LEVELS="0" ALIAS="Mainframes and Supercomputers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // SHAPESHIFT related
            key: "MAKEOVER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MAKEOVER" ID="1744510859785" BASECOST="5.0" LEVELS="0" ALIAS="Makeover" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL, NAVIGATION related
            key: "MARINE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MARINE" ID="1762133077959" BASECOST="2.0" LEVELS="0" ALIAS="Marine" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "MARINESURFACE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MARINESURFACE" ID="1762133077955" BASECOST="1.0" LEVELS="0" ALIAS="Marine Surface" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "MARINEUNDERWATER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MARINEUNDERWATER" ID="1762133077956" BASECOST="1.0" LEVELS="0" ALIAS="Marine Underwater" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "MATCHLOCKS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MATCHLOCKS" ID="1759094980708" BASECOST="1.0" LEVELS="0" ALIAS="Matchlocks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSPARENT related
        key: "MD",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="MD" ID="1752364670270" BASECOST="0.25" LEVELS="0" ALIAS="Mental" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "MECHA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MECHA" ID="1767399182191" BASECOST="2.0" LEVELS="0" ALIAS="Mecha" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION (5e only) related
        key: "MEDICAL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="MEDICAL" ID="1770523563997" BASECOST="2.0" LEVELS="0" ALIAS="Medical Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
    });
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "MEDICALSENSORS",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="MEDICALSENSORS" ID="1770523565353" BASECOST="1.0" LEVELS="0" ALIAS="Medical Sensors" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "MEMBERSHIP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MEMBERSHIP" ID="1762105865484" BASECOST="3.0" LEVELS="0" ALIAS="Membership" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MIF related
            key: "MEMBRANOPHONES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MEMBRANOPHONES" ID="1762892719668" BASECOST="2.0" LEVELS="0" ALIAS="Membranophones" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DAMAGENEGATION, CUSTOMPOWER related
            key: "MENTAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="MENTAL" ID="1738019507456" BASECOST="0.0" LEVELS="3" ALIAS="Mental DCs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "METAL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="METAL" ID="1770523565978" BASECOST="1.0" LEVELS="0" ALIAS="Metal Detectors" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "MENTALGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MENTALGROUP" ID="1762134792514" BASECOST="5.0" LEVELS="0" ALIAS="Mental Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "METSUBISHI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="METSUBISHI" ID="1759094969146" BASECOST="1.0" LEVELS="0" ALIAS="Metsubishi" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // COMPUTER_PROGRAMMING related
        key: "MILITARY",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="MILITARY" ID="1770498735919" BASECOST="2.0" LEVELS="0" ALIAS="Military Computers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "MILTARYRANK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MILTARYRANK" ID="1762105852997" BASECOST="1.0" LEVELS="0" ALIAS="Military Rank" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CORPORAL" OPTIONID="CORPORAL" OPTION_ALIAS="Corporal" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "MILITARYSPACE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MILITARYSPACE" ID="1770523633003" BASECOST="1.0" LEVELS="0" ALIAS="Military Spacecraft" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // POSSESSION related
            key: "MINDCONTROLEFFECT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(1 / 2),
            xml: `<ADDER XMLID="MINDCONTROLEFFECT" ID="1737915448080" BASECOST="0.0" LEVELS="20" ALIAS="+20 Points of Mind Control effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "MINDSCAN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MINDSCAN" ID="1762134819852" BASECOST="5.0" LEVELS="0" ALIAS="Mind Scan" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "MINUSONEPIP",
            behaviors: ["adder"],
            type: ["adder"],
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
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MISFIRE" ID="1735590175126" BASECOST="-0.25" LEVELS="0" ALIAS="Misfire" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "MISSILES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MISSILES" ID="1762657675485" BASECOST="2.0" LEVELS="0" ALIAS="Missiles &amp; Rockets" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "MISSILEGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MISSILEGUNS" ID="1759094990076" BASECOST="1.0" LEVELS="0" ALIAS="Missile Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "MOBILE",
            behaviors: ["adder"],
            type: ["adder"],
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
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MOBILITY" ID="1737920494694" BASECOST="-0.25" LEVELS="0" ALIAS="Mobility" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ARRANGEMENT" OPTIONID="ARRANGEMENT" OPTION_ALIAS="Arrangement" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORGERY related
            key: "MONEY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MONEY" ID="1740275766578" BASECOST="2.0" LEVELS="0" ALIAS="Money (Counterfeiting)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "MORTARS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MORTARS" ID="1759094997467" BASECOST="1.0" LEVELS="0" ALIAS="Mortars" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // HUNTED related
            key: "MOTIVATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MOTIVATION" ID="1704506828261" BASECOST="0.0" LEVELS="0" ALIAS="Motivation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HARSH" OPTIONID="HARSH" OPTION_ALIAS="Harshly Punish" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // RESTRAINABLE related
            key: "NOTVSGRABORENTANGLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOTVSGRABORENTANGLE" ID="1771297964617" BASECOST="0.25" LEVELS="0" ALIAS="Only by means other than Grabs and Entangles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "MOUNTAIN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MOUNTAIN" ID="1762133049633" BASECOST="2.0" LEVELS="0" ALIAS="Mountain" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "MOURN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MOURN" ID="1759094947737" BASECOST="1.0" LEVELS="0" ALIAS="Mourn Staff" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT, CUSTOMPOWER related
            key: "MOVEMENT", // In 6e this is negative wind levels
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="MOVEMENT" ID="1762136788974" BASECOST="0.0" LEVELS="1" ALIAS="-1&quot; of any one mode of Movement" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {
            // In 5e this is negative to any movement type
            costPerLevel: fixedValueFunction(3),
        },
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "MOVEMENT6E",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(1),
            xml: `<ADDER XMLID="MOVEMENT6E" ID="1762664140420" BASECOST="0.0" LEVELS="8" ALIAS="-8m of any mode of Movement" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "MOVEMENTINCREASE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MOVEMENTINCREASE" ID="1711727592167" BASECOST="0.0" LEVELS="1" ALIAS="+1 Wind Levels" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // Mental power related
            key: "MULTIPLECLASSES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MULTIPLECLASSES" ID="1762663582274" BASECOST="10.0" LEVELS="0" ALIAS="Additional Class of Minds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "MULTIPLECOMBATEFFECTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MULTIPLECOMBATEFFECTS" ID="1762136779097" BASECOST="5.0" LEVELS="0" ALIAS="Multiple Combat Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FOCUS related
            key: "MULTIPLEFOCI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MULTIPLEFOCI" ID="1762133131033" BASECOST="0.25" LEVELS="0" ALIAS="Requires Multiple Foci or functions at reduced effectiveness" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CLAIRSENTIENCE related
            key: "MULTIPLEPERCEPTION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MULTIPLEPERCEPTION" ID="1768113074917" BASECOST="0.0" LEVELS="1" ALIAS="2 Perception Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "MUSCLEPOWEREDGROUNDVEHICLES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MUSCLEPOWEREDGROUNDVEHICLES" ID="1756738529555" BASECOST="0.0" LEVELS="0" ALIAS="Muscle-Powered Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "MUSCLEPOWEREDHTH",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MUSCLEPOWEREDHTH" ID="1762657673507" BASECOST="2.0" LEVELS="0" ALIAS="Muscle-Powered HTH" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "MUSCLEPOWEREDRANGED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MUSCLEPOWEREDRANGED" ID="1762657674002" BASECOST="2.0" LEVELS="0" ALIAS="Muscle-Powered Ranged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "MYSTICGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="MYSTICGROUP" ID="1762134797879" BASECOST="5.0" LEVELS="0" ALIAS="Mystic Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // HUNTED related
            key: "NCI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NCI" ID="1762104708460" BASECOST="5.0" LEVELS="0" ALIAS="NCI" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "NETS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NETS" ID="1759094932672" BASECOST="1.0" LEVELS="0" ALIAS="Nets" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "NEVERRECOVER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NEVERRECOVER" ID="1757641366550" BASECOST="-2.0" LEVELS="0" ALIAS="Charges Never Recover" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "NINJA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NINJA" ID="1759094948171" BASECOST="1.0" LEVELS="0" ALIAS="Ninja Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // AVAD related
            key: "NND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NND" ID="1696022407526" BASECOST="-0.5" LEVELS="0" ALIAS="All Or Nothing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRIGGER related
            key: "NOCONTROL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOCONTROL" ID="1735590173007" BASECOST="-0.25" LEVELS="0" ALIAS="Character does not control activation of personal Trigger" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // INVISIBILITY related
            key: "NOFRINGE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOFRINGE" ID="1762134791402" BASECOST="10.0" LEVELS="0" ALIAS="No Fringe" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // BARRIER related
            key: "NONANCHORED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NONANCHORED" ID="1762720598876" BASECOST="10.0" LEVELS="0" ALIAS="Non-Anchored" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // AOE related
            key: "NONSELECTIVETARGET",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NONSELECTIVETARGET" ID="1737906231692" BASECOST="-0.25" LEVELS="0" ALIAS="Nonselective" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LINKED related
            key: "NONPROPORTIONAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NONPROPORTIONAL" ID="1762136506574" BASECOST="0.25" LEVELS="0" ALIAS="Lesser Power need not be used proportionally to Power with which it is Linked" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // EXTRATIME related
            key: "NOOTHERACTIONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOOTHERACTIONS" ID="1737922655047" BASECOST="-0.25" LEVELS="0" ALIAS="Character May Take No Other Actions" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TELEPORTATION related
            key: "NORELATIVEVELOCITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NORELATIVEVELOCITY" ID="1762663752216" BASECOST="10.0" LEVELS="0" ALIAS="No Relative Velocity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "NORMALHEARING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NORMALHEARING" ID="1754778618210" BASECOST="3.0" LEVELS="0" ALIAS="Normal Hearing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "NORMALSIGHT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NORMALSIGHT" ID="1755459402833" BASECOST="5.0" LEVELS="0" ALIAS="Normal Sight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "NORMALSMELL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NORMALSMELL" ID="1745117154932" BASECOST="3.0" LEVELS="0" ALIAS="Normal Smell" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "NORMALTASTE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NORMALTASTE" ID="1745117155189" BASECOST="3.0" LEVELS="0" ALIAS="Normal Taste" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "NORMALTOUCH",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NORMALTOUCH" ID="1762134817344" BASECOST="3.0" LEVELS="0" ALIAS="Normal Touch" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MEGASCALE related
            key: "NOSCALE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOSCALE" ID="1760248248530" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot alter scale" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // REPUTATION related
            key: "NOTALL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOTALL" ID="1762136059318" BASECOST="-5.0" LEVELS="0" ALIAS="(Known Only To A Small Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SOCIALLIMITATION related
            key: "NOTINSOME",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NOTINSOME" ID="1767400331512" BASECOST="-5.0" LEVELS="0" ALIAS="Not Limiting In Some Cultures" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // mental related
            key: "NUMBERMINDS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="NUMBERMINDS" ID="1762712202602" BASECOST="0.0" LEVELS="2" ALIAS="Number of Minds (x4)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            key: "OBLIVIOUS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OBLIVIOUS" ID="1736008610985" BASECOST="-0.25" LEVELS="0" ALIAS="Character is totally unaware of nearby events" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SOCIALLIMITATION related
            key: "OCCUR",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OCCUR" ID="1704506848422" BASECOST="5.0" LEVELS="0" ALIAS="Circumstances Occur" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OCCASIONALLY" OPTIONID="OCCASIONALLY" OPTION_ALIAS="(Occasionally" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // PHYSICALLIMITATION related
            key: "OCCURS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OCCURS" ID="1704506834686" BASECOST="5.0" LEVELS="0" ALIAS="Limitation Occurs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INFREQUENTLY" OPTIONID="INFREQUENTLY" OPTION_ALIAS="(Infrequently" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "OCVDCV",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="OCVDCV" ID="1762136806117" BASECOST="0.0" LEVELS="0" ALIAS="-0" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OCV" OPTIONID="OCV" OPTION_ALIAS="OCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // AUTOFIRE related
            key: "ODDPOWER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ODDPOWER" ID="1735602855475" BASECOST="1.0" LEVELS="0" ALIAS="Non-Standard Attack Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // DAMAGESHIELD related
        key: "OFFENSIVE",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="OFFENSIVE" ID="1759024542182" BASECOST="0.25" LEVELS="0" ALIAS="Offensive" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        undefined, // In 6e OFFHANDDEFENSE talent
        {
            // WEAPON_FAMILIARITY related
            key: "OFFHAND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OFFHAND" ID="1759094959897" BASECOST="1.0" LEVELS="0" ALIAS="Off Hand" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ONAGER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ONAGER" ID="1759094977168" BASECOST="1.0" LEVELS="0" ALIAS="Onager" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "ONEWHEELEDMUSCLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ONEWHEELEDMUSCLE" ID="1756738527437" BASECOST="1.0" LEVELS="0" ALIAS="One-Wheeled Muscle-Powered Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LINKED related
            key: "ONLYWHENGREATERATFULL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ONLYWHENGREATERATFULL" ID="1762136506014" BASECOST="-0.25" LEVELS="0" ALIAS="Lesser Power can only be used when character uses greater Power at full value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // BARRIER related
            key: "OPAQUESENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OPAQUESENSE" ID="1762720599981" BASECOST="10.0" LEVELS="0" ALIAS="Opaque" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER, COMPUTER_PROGRAMMING (5e only), FORGERY, WEAPONSMITH, etc related
            key: "OTHER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OTHER" ID="1740275781408" BASECOST="1.0" LEVELS="0" ALIAS="Other" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="extra specific" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // COMPUTER_PROGRAMMING (5e only), FORGERY, and GAMBLING related
            key: "OTHERGENERAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OTHERGENERAL" ID="1740275771202" BASECOST="2.0" LEVELS="0" ALIAS="Other (General)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="extra general" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "OTHERRIDING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="OTHERRIDING" ID="1770523600295" BASECOST="1.0" LEVELS="0" ALIAS="Other" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "PARTICLEGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PARTICLEGUNS" ID="1759095001740" BASECOST="1.0" LEVELS="0" ALIAS="Particle Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "PASSPORT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PASSPORT" ID="1762105846719" BASECOST="1.0" LEVELS="0" ALIAS="Passport" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSPARENT related
        key: "PD",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="PD" ID="1752038825401" BASECOST="0.5" LEVELS="0" ALIAS="PD" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "PENDJEPIT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PENDJEPIT" ID="1759094944643" BASECOST="1.0" LEVELS="0" ALIAS="Pendjepit" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CLAIRSENTIENCE related
            key: "PERCEIVEFUTURE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PERCEIVEFUTURE" ID="1755060911091" BASECOST="20.0" LEVELS="0" ALIAS="Precognition" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CLAIRSENTIENCE related
            key: "PERCEIVEPAST",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PERCEIVEPAST" ID="1696022407695" BASECOST="20.0" LEVELS="0" ALIAS="Retrocognition" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "PERROLL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(2),
            xml: `<ADDER XMLID="PERROLL" ID="1762136780999" BASECOST="0.0" LEVELS="1" ALIAS="-1 PER Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Normal Hearing" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="2.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "PERROLLGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(3),
            xml: `<ADDER XMLID="PERROLLGROUP" ID="1762136785194" BASECOST="0.0" LEVELS="1" ALIAS="-1 PER Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // COMPUTER_PROGRAMMING related (as in personal computers)
        key: "PERSONAL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(3),
        xml: `<ADDER XMLID="PERSONAL" ID="1770498733030" BASECOST="2.0" LEVELS="0" ALIAS="Personal Computers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // TRANSPORT_FAMILIARITY related (as in personal computers)
            key: "PERSONALSPACE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(3),
            xml: `<ADDER XMLID="PERSONALSPACE" ID="1770523631693" BASECOST="1.0" LEVELS="0" ALIAS="Personal Use Spacecraft" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "PERSONNEL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="PERSONNEL" ID="1770523560422" BASECOST="1.0" LEVELS="0" ALIAS="Personnel Support Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "PI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PI" ID="1762105855100" BASECOST="2.0" LEVELS="0" ALIAS="Private Investigator License" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "PLASMAGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PLASMAGUNS" ID="1759095003048" BASECOST="1.0" LEVELS="0" ALIAS="Plasma Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "PLUSONEHALFDIE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PLUSONEHALFDIE" ID="1712342067007" BASECOST="3.0" LEVELS="0" ALIAS="+1/2 d6" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            key: "PLUSONEPIP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PLUSONEPIP" ID="1712342367072" BASECOST="2.0" LEVELS="0" ALIAS="+1 pip" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "POKER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="POKER" ID="1762058958844" BASECOST="1.0" LEVELS="0" ALIAS="Poker" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "POLEARMS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="POLEARMS" ID="1759094954869" BASECOST="1.0" LEVELS="0" ALIAS="Polearms and Spears" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "POLYMERGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="POLYMERGUNS" ID="1759094987796" BASECOST="1.0" LEVELS="0" ALIAS="Polymer Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // COMPUTER_PROGRAMMING related
            key: "PORTABLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PORTABLE" ID="1770521481275" BASECOST="1.0" LEVELS="0" ALIAS="Portable Computers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // Movement (FLIGHT, TELEPORT) related
            key: "POSITIONSHIFT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="POSITIONSHIFT" ID="1762138556815" BASECOST="5.0" LEVELS="0" ALIAS="Position Shift" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSPARENT related
        key: "POWD",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="POWD" ID="1752364713968" BASECOST="0.25" LEVELS="0" ALIAS="Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // RIVALRY related
            key: "POWER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="POWER" ID="1704506845134" BASECOST="-5.0" LEVELS="0" ALIAS="Rival's Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LESS" OPTIONID="LESS" OPTION_ALIAS="Rival is Less Powerful" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LINKED related
            key: "POWERRARELYOFF",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="POWERRARELYOFF" ID="1762136507187" BASECOST="0.25" LEVELS="0" ALIAS="Greater Power is Constant or in use most or all of the time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SIDEEFFECTS related
            // Side Effect does a predefined amount of damage
            key: "PREDEFINEDDAMAGE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PREDEFINEDDAMAGE" ID="1688216154910" BASECOST="0.25" LEVELS="0" ALIAS="Side Effect does a predefined amount of damage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "PRESSPASS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PRESSPASS" ID="1762105847618" BASECOST="1.0" LEVELS="0" ALIAS="Press Pass" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "PROFESSIONALLICENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PROFESSIONALLICENSE" ID="1762105845434" BASECOST="1.0" LEVELS="0" ALIAS="License to practice a profession" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FORCEFIELD related
            key: "PROTECTITEMS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PROTECTITEMS" ID="1696022492272" BASECOST="10.0" LEVELS="0" ALIAS="Protect Carried Items" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "PSIONIC",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PSIONIC" ID="1762105861508" BASECOST="3.0" LEVELS="0" ALIAS="Psionic Police Powers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MINDLINK related
            key: "PSYCHICBOND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PSYCHICBOND" ID="1762712202601" BASECOST="5.0" LEVELS="0" ALIAS="Psychic Bond" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // HUNTED related
            key: "PUBLIC",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="PUBLIC" ID="1762104710736" BASECOST="5.0" LEVELS="0" ALIAS="PC has a Public ID or is otherwise very easy to find" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "RADAR",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="RADAR" ID="1770523566467" BASECOST="1.0" LEVELS="0" ALIAS="Radar" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // FLASH and presumably other sense related powers and SYSTEMS_OPERATION (5e only)
            key: "RADIOGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RADIOGROUP" ID="1745117153961" BASECOST="5.0" LEVELS="0" ALIAS="Radio Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "RAFTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RAFTS" ID="1756738542367" BASECOST="1.0" LEVELS="0" ALIAS="Rafts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "RAILED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RAILED" ID="1756738533694" BASECOST="1.0" LEVELS="0" ALIAS="Railed Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // BOECV related
            key: "RANGEMODSAPPLY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RANGEMODSAPPLY" ID="1735602821851" BASECOST="-0.25" LEVELS="0" ALIAS="Range Modifiers Apply" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "RAPTORS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RAPTORS" ID="1762052686224" BASECOST="2.0" LEVELS="0" ALIAS="Raptors" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DISTINCTIVEFEATURES related
            key: "REACTION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="REACTION" ID="1759025865722" BASECOST="0.0" LEVELS="0" ALIAS="Reaction" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NOTICED" OPTIONID="NOTICED" OPTION_ALIAS="Noticed and Recognizable" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // REPUTATION related
            key: "RECOGNIZED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RECOGNIZED" ID="1709447158401" BASECOST="5.0" LEVELS="0" ALIAS="Recognized" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SOMETIMES" OPTIONID="SOMETIMES" OPTION_ALIAS="Infrequently" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "RECOILLESSGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RECOILLESSGUNS" ID="1759094997884" BASECOST="1.0" LEVELS="0" ALIAS="Recoilless Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "RECOVERABLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RECOVERABLE" ID="1737924558549" BASECOST="0.5" LEVELS="0" ALIAS="Recoverable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "RECREATION",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="RECREATION" ID="1770523560952" BASECOST="1.0" LEVELS="0" ALIAS="Recreation Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "RECREATIONALVEHICLES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RECREATIONALVEHICLES" ID="1770523627349" BASECOST="0.0" LEVELS="0" ALIAS="Recreational Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // Related to attack powers
            key: "REDUCEDNEGATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(2),
            xml: `<ADDER XMLID="REDUCEDNEGATION" ID="1711727700855" BASECOST="0.0" LEVELS="1" ALIAS="Reduced Negation (1)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="2.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FUELDEPENDENT related
            key: "REFUELINGTIME",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="REFUELINGTIME" ID="1766366090263" BASECOST="-1.5" LEVELS="0" ALIAS="Refueling Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINUTE" OPTIONID="MINUTE" OPTION_ALIAS="must refuel Once per Minute" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "RELIGIOUSRANK",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RELIGIOUSRANK" ID="1762105853678" BASECOST="1.0" LEVELS="0" ALIAS="Religious Rank" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MONK" OPTIONID="MONK" OPTION_ALIAS="Monk" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ANIMAL_HANDLER related
            key: "REPTILES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="REPTILES" ID="1762052686794" BASECOST="2.0" LEVELS="0" ALIAS="Reptiles &amp; Amphibians" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRIGGER related
            key: "RESET",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RESET" ID="1735590169893" BASECOST="-0.5" LEVELS="0" ALIAS="Reset Parameters" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TURN" OPTIONID="TURN" OPTION_ALIAS="Trigger requires a Turn or more to reset" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // HEALING related
            key: "RESURRECTION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RESURRECTION" ID="1762718583541" BASECOST="20.0" LEVELS="0" ALIAS="Resurrection" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "RIDINGANIMALS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RIDINGANIMALS" ID="1756738525068" BASECOST="2.0" LEVELS="0" ALIAS="Riding Animals" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "RIFLES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RIFLES" ID="1759094984992" BASECOST="1.0" LEVELS="0" ALIAS="Rifles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "RIGHTOFSHELTER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RIGHTOFSHELTER" ID="1762105873923" BASECOST="1.0" LEVELS="0" ALIAS="Right Of Shelter" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "RIGHTTOMARRY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RIGHTTOMARRY" ID="1762105848213" BASECOST="1.0" LEVELS="0" ALIAS="Right to Marry:  Can perform the marriage ceremony" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "RINGS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="RINGS" ID="1759094948597" BASECOST="1.0" LEVELS="0" ALIAS="Rings" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ROCKETPISTOLS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ROCKETPISTOLS" ID="1759094988246" BASECOST="1.0" LEVELS="0" ALIAS="Rocket Pistols" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ROCKETRIFLES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ROCKETRIFLES" ID="1759094988752" BASECOST="1.0" LEVELS="0" ALIAS="Rocket Rifles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ROCKS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ROCKS" ID="1759094960979" BASECOST="0.0" LEVELS="0" ALIAS="Thrown Rocks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "ROPEDART",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ROPEDART" ID="1759094957841" BASECOST="1.0" LEVELS="0" ALIAS="Rope Dart" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "ROULETTE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ROULETTE" ID="1762058979300" BASECOST="2.0" LEVELS="0" ALIAS="Roulette" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "SATELLITE",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="SATELLITE" ID="1770523557884" BASECOST="1.0" LEVELS="0" ALIAS="Satellite Communications" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(undefined, {
        // MEGASCALE related
        key: "SCALEDOWN",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="SCALEDOWN" ID="1760373299835" BASECOST="0.25" LEVELS="0" ALIAS="Can Be Scaled Down" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="1&quot; = 1km" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SCUBA",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SCUBA" ID="1770523624383" BASECOST="1.0" LEVELS="0" ALIAS="SCUBA" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SCIFI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SCIFI" ID="1770498892462" BASECOST="2.0" LEVELS="0" ALIAS="Science Fiction &amp; Space Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "SECURITYCLEARANCE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SECURITYCLEARANCE" ID="1762105868127" BASECOST="3.0" LEVELS="0" ALIAS="Security Clearance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // AOE/EXPLOSION related
            key: "SELECTIVETARGET",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SELECTIVETARGET" ID="1735841902155" BASECOST="0.25" LEVELS="0" ALIAS="Selective" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "SELFCONTAINEDBREATHING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SELFCONTAINEDBREATHING" ID="1762105296913" BASECOST="10.0" LEVELS="0" ALIAS="Self-Contained Breathing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DANGER_SENSE and presumably other senses related
            key: "SENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SENSE" ID="1732478113494" BASECOST="2.0" LEVELS="0" ALIAS="Function as a Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CUSTOMPOWER related
            key: "SENSEAFFECTING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SENSEAFFECTING" ID="1762720041051" BASECOST="0.0" LEVELS="0" ALIAS="Sense-Affecting Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DISTINCTIVEFEATURES related
            key: "SENSING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SENSING" ID="1754364265112" BASECOST="0.0" LEVELS="0" ALIAS="Sensing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMMON" OPTIONID="COMMON" OPTION_ALIAS="Detectable By Commonly-Used Senses" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DANGER_SENSE related
            key: "SENSITIVITY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SENSITIVITY" ID="1732478113499" BASECOST="5.0" LEVELS="0" ALIAS="Sensitivity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OUT_OF_COMBAT" OPTIONID="OUT_OF_COMBAT" OPTION_ALIAS="out of combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "SENSOR",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="SENSOR" ID="1770523569725" BASECOST="0.0" LEVELS="0" ALIAS="Sensor Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
    });
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "SENSORS",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="SENSORS" ID="1770523563514" BASECOST="1.0" LEVELS="0" ALIAS="Medical Sensors" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "SENSORJAMMING",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="SENSORJAMMING" ID="1770523567415" BASECOST="1.0" LEVELS="0" ALIAS="Sensor Jamming Equipment" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // CUSTOMPOWER related
            key: "SENSORY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SENSORY" ID="1762720041548" BASECOST="0.0" LEVELS="0" ALIAS="Sensory Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SHAPESHIFT related
            key: "SHAPES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SHAPES" ID="1744510859779" BASECOST="20.0" LEVELS="0" ALIAS="Variety of Shapes" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ANY" OPTIONID="ANY" OPTION_ALIAS="any shape" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "SHOGI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SHOGI" ID="1762058961889" BASECOST="1.0" LEVELS="0" ALIAS="Hasami Shogi" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SHOTGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SHOTGUNS" ID="1759094985410" BASECOST="1.0" LEVELS="0" ALIAS="Shotguns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SHOULDERFIRED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SHOULDERFIRED" ID="1759094994606" BASECOST="1.0" LEVELS="0" ALIAS="Shoulder-Fired Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "SIANG",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SIANG" ID="1762058962766" BASECOST="1.0" LEVELS="0" ALIAS="Siang K'i" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SIEGEENGINES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SIEGEENGINES" ID="1759095020003" BASECOST="2.0" LEVELS="0" ALIAS="Siege Engines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SIEGETOWER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SIEGETOWER" ID="1759094977633" BASECOST="1.0" LEVELS="0" ALIAS="Siege Tower" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // Senses related
            key: "SIGHTGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SIGHTGROUP" ID="1770523341156" BASECOST="5.0" LEVELS="0" ALIAS="Sight Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // PSYCHOLOGICALLIMITATION and RIVALRY related
            key: "SITUATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SITUATION" ID="1756698626370" BASECOST="5.0" LEVELS="0" ALIAS="Rivalry Situation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PROFESSIONAL" OPTIONID="PROFESSIONAL" OPTION_ALIAS="Professional" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CUSTOMPOWER related
            key: "SIZE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SIZE" ID="1762720042221" BASECOST="0.0" LEVELS="0" ALIAS="Size Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SKATEBOARDING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SKATEBOARDING" ID="1770523624872" BASECOST="1.0" LEVELS="0" ALIAS="Skateboarding" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SKATING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SKATING" ID="1770523625307" BASECOST="1.0" LEVELS="0" ALIAS="Skating (iceskating or rollerskating)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SKIING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SKIING" ID="1770523625701" BASECOST="1.0" LEVELS="0" ALIAS="Skiing (snow)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CONTACT related
            key: "SLAVISHLYLOYAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SLAVISHLYLOYAL" ID="1762056986810" BASECOST="3.0" LEVELS="0" ALIAS="Contact is slavishly loyal to character" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SLEDS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SLEDS" ID="1756738538492" BASECOST="1.0" LEVELS="0" ALIAS="Sleds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // LIFESUPPORT related
            key: "SLEEPING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SLEEPING" ID="1762058850253" BASECOST="1.0" LEVELS="0" ALIAS="Sleeping:" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="WEEK" OPTIONID="WEEK" OPTION_ALIAS="Character only has to sleep 8 hours per week" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SLING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SLING" ID="1759094969676" BASECOST="1.0" LEVELS="0" ALIAS="Sling" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SLINGBOW",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SLINGBOW" ID="1759094970158" BASECOST="1.0" LEVELS="0" ALIAS="Sling Bow" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SMALLARMS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SMALLARMS" ID="1759095022876" BASECOST="2.0" LEVELS="0" ALIAS="Small Arms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SMALLMILITARYSHIPS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SMALLMILITARYSHIPS" ID="1756738545718" BASECOST="1.0" LEVELS="0" ALIAS="Small Military Ships" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SMALLMOTORIZED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SMALLMOTORIZED" ID="1703371010093" BASECOST="1.0" LEVELS="0" ALIAS="Small Motorized Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SMALLMOTORIZEDBOATS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SMALLMOTORIZEDBOATS" ID="1756738544714" BASECOST="1.0" LEVELS="0" ALIAS="Small Motorized Boats" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SMALLPLANES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SMALLPLANES" ID="1756738535098" BASECOST="1.0" LEVELS="0" ALIAS="Small Planes" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SMALLROWED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SMALLROWED" ID="1756738542842" BASECOST="1.0" LEVELS="0" ALIAS="Small Rowed Boats" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SMALLWIND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SMALLWIND" ID="1756738543749" BASECOST="1.0" LEVELS="0" ALIAS="Small Wind-Powered Boats" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "SMELLGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SMELLGROUP" ID="1762134795930" BASECOST="5.0" LEVELS="0" ALIAS="Smell/Taste Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SNOWBOARDING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SNOWBOARDING" ID="1770523626529" BASECOST="1.0" LEVELS="0" ALIAS="Snowboarding" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SNOWMOBILES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SNOWMOBILES" ID="1756738539302" BASECOST="1.0" LEVELS="0" ALIAS="Snowmobiles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "SONAR",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="SONAR" ID="1770523566942" BASECOST="1.0" LEVELS="0" ALIAS="Sonar" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SONICSTUNNER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SONICSTUNNER" ID="1759094989186" BASECOST="1.0" LEVELS="0" ALIAS="Sonic Stunners" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // NAVIGATION related
            key: "SPACE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SPACE" ID="1762719435975" BASECOST="2.0" LEVELS="0" ALIAS="Space" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SPACEPLANES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SPACEPLANES" ID="1770523630897" BASECOST="1.0" LEVELS="0" ALIAS="Spaceplanes" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SPACESTATIONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SPACESTATIONS" ID="1770523633404" BASECOST="1.0" LEVELS="0" ALIAS="Mobile Space Stations" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "SPEARSANDPOLEARMS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SPEARSANDPOLEARMS" ID="1762657681232" BASECOST="2.0" LEVELS="0" ALIAS="Spears And Polearms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CUSTOMPOWER related
            key: "SPECIAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SPECIAL" ID="1762720043206" BASECOST="0.0" LEVELS="0" ALIAS="Special Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "SPORTSBETTING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SPORTSBETTING" ID="1762058966179" BASECOST="2.0" LEVELS="0" ALIAS="Sports Betting" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SPREADTHEWATER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SPREADTHEWATER" ID="1759094934548" BASECOST="1.0" LEVELS="0" ALIAS="Spread-The-Water Knife" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SPRINGENGINE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SPRINGENGINE" ID="1759094978124" BASECOST="1.0" LEVELS="0" ALIAS="Spring Engine" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "STAFFS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STAFFS" ID="1759094935222" BASECOST="1.0" LEVELS="0" ALIAS="Staffs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "STAFFSLING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STAFFSLING" ID="1759094970648" BASECOST="1.0" LEVELS="0" ALIAS="Staff Sling" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "STARSHIPLICENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STARSHIPLICENSE" ID="1762105848812" BASECOST="1.0" LEVELS="0" ALIAS="Starship License" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MIF related
            key: "STEEL_GUITAR",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STEEL_GUITAR" ID="1762892720614" BASECOST="2.0" LEVELS="0" ALIAS="Steel Guitar" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "STEELOLIVE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STEELOLIVE" ID="1759094971138" BASECOST="1.0" LEVELS="0" ALIAS="Steel Olive" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "STEELTOAD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STEELTOAD" ID="1759094971652" BASECOST="1.0" LEVELS="0" ALIAS="Steel Toad" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENTANGLE related
            key: "STOPSENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STOPSENSE" ID="1762666247198" BASECOST="5.0" LEVELS="0" ALIAS="Stops A Given Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NORMALHEARING" OPTIONID="NORMALHEARING" OPTION_ALIAS="Normal Hearing" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // ENTANGLE related
            key: "STOPSENSEGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STOPSENSEGROUP" ID="1762666248940" BASECOST="10.0" LEVELS="0" ALIAS="Stops A Given Sense Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "STUNNING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STUNNING" ID="1711727608484" BASECOST="30.0" LEVELS="0" ALIAS="Stunning" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "STUNRODS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="STUNRODS" ID="1759094938544" BASECOST="1.0" LEVELS="0" ALIAS="Stun Rods" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "SUBMACHINEGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SUBMACHINEGUNS" ID="1759094985893" BASECOST="1.0" LEVELS="0" ALIAS="Submachine Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SUBMARINES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SUBMARINES" ID="1756738546770" BASECOST="1.0" LEVELS="0" ALIAS="Submarines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DEPENDENCE related
            key: "SUBSTANCE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SUBSTANCE" ID="1704506813686" BASECOST="5.0" LEVELS="0" ALIAS="Dependent Substance Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYCOMMON" OPTIONID="VERYCOMMON" OPTION_ALIAS="(Very Common" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "SUFFOCATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SUFFOCATION" ID="1711727607626" BASECOST="20.0" LEVELS="0" ALIAS="Suffocation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SURFING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SURFING" ID="1770523626907" BASECOST="1.0" LEVELS="0" ALIAS="Surfing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "SURGICAL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="SURGICAL" ID="1770523563996" BASECOST="1.0" LEVELS="0" ALIAS="Surgical Equipment" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "SWIMMINGBEASTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SWIMMINGBEASTS" ID="1703370946761" BASECOST="1.0" LEVELS="0" ALIAS="Swimming Beasts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPONSMITH related
            key: "SWORDSANDDAGGERS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SWORDSANDDAGGERS" ID="1762657681865" BASECOST="2.0" LEVELS="0" ALIAS="Swords And Daggers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MIF related
            key: "SYNTHESIZER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="SYNTHESIZER" ID="1762892721216" BASECOST="2.0" LEVELS="0" ALIAS="Synthesizer" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // Sense related
            key: "TARGETING_SENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TARGETING_SENSE" ID="1713838702865" BASECOST="10.0" LEVELS="0" ALIAS="Targeting Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // UOO related
            key: "TARGETS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TARGETS" ID="1767067099950" BASECOST="0.0" LEVELS="1" ALIAS="x2 Number of Targets" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // POSSESSION related
            key: "TELEPATHYEFFECT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(1 / 2),
            xml: `<ADDER XMLID="TELEPATHYEFFECT" ID="1737915448081" BASECOST="0.0" LEVELS="10" ALIAS="+10 Points of Telepathy effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "TELEPHONE",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="TELEPHONE" ID="1770523555779" BASECOST="1.0" LEVELS="0" ALIAS="Telephone Communications" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // SURVIVAL related
            key: "TEMPERATE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TEMPERATE" ID="1762133077966" BASECOST="2.0" LEVELS="0" ALIAS="Temperate/Subtropical" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "TEMPERATECOASTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TEMPERATECOASTS" ID="1762133077960" BASECOST="1.0" LEVELS="0" ALIAS="Temperate/Subtropical Coasts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "TEMPERATEFORESTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TEMPERATEFORESTS" ID="1762133077962" BASECOST="1.0" LEVELS="0" ALIAS="Temperate/Subtropical Forests" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "TEMPERATEPLAINS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TEMPERATEPLAINS" ID="1762133077961" BASECOST="1.0" LEVELS="0" ALIAS="Temperate/Subtropical Plains" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "TEMPERATURE", // TEMPERATUREDECREASE would have been a better name.
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(3),
            xml: `<ADDER XMLID="TEMPERATURE" ID="1762137385530" BASECOST="0.0" LEVELS="1" ALIAS="-1 Temperature Level Adjustment" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "TEMPERATUREINCREASE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(3),
            xml: `<ADDER XMLID="TEMPERATUREINCREASE" ID="1762137385531" BASECOST="0.0" LEVELS="1" ALIAS="+1 Temperature Level Adjustment" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT, NAVIGATION related
            key: "TEMPORAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TEMPORAL" ID="1762105861029" BASECOST="3.0" LEVELS="0" ALIAS="Temporal Police Powers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // MIF related
            key: "THEREMIN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THEREMIN" ID="1762892721913" BASECOST="2.0" LEVELS="0" ALIAS="Theremin" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // AOE related
            key: "THINCONE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THINCONE" ID="1770410204720" BASECOST="-0.25" LEVELS="0" ALIAS="Thin Cone" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        undefined,
    );
    addPower(
        {
            // TRIGGER related
            key: "THREECONDITIONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THREECONDITIONS" ID="1735590174075" BASECOST="0.5" LEVELS="0" ALIAS="Three or more activation conditions apply simultaneously" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "THREESECTIONSTAFF",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THREESECTIONSTAFF" ID="1759094958283" BASECOST="1.0" LEVELS="0" ALIAS="Three-Section Staff" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "THROWNCHAIN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THROWNCHAIN" ID="1759094972334" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Chain &amp; Rope Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "THROWNGRENADES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THROWNGRENADES" ID="1759094986350" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Grenades" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "THROWNKNIVES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THROWNKNIVES" ID="1759094963066" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Knives, Axes, and Darts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "THROWNSWORD",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="THROWNSWORD" ID="1759094972904" BASECOST="1.0" LEVELS="0" ALIAS="Thrown Sword" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DEPENDENCE related
            key: "TIME",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TIME" ID="1704506813702" BASECOST="25.0" LEVELS="0" ALIAS="Time Before Suffering Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SEGMENT" OPTIONID="SEGMENT" OPTION_ALIAS="1 Segment" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DAMAGEOVERTIME related
            key: "TIMEBETWEEN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TIMEBETWEEN" ID="1738534117245" BASECOST="2.0" LEVELS="0" ALIAS="damage occurs every" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SEGMENT" OPTIONID="SEGMENT" OPTION_ALIAS="Segment" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "TIMEMACHINELICENSE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TIMEMACHINELICENSE" ID="1762105864776" BASECOST="2.0" LEVELS="0" ALIAS="Time Machine License" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "TKSTR",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(5),
            xml: `<ADDER XMLID="TKSTR" ID="1735678513721" BASECOST="0.0" LEVELS="16" ALIAS="+16 Points of Telekinetic STR" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FLASH and presumably other sense related powers
            key: "TOUCHGROUP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TOUCHGROUP" ID="1745117154479" BASECOST="5.0" LEVELS="0" ALIAS="Touch Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "TRACKEDMILITARY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TRACKEDMILITARY" ID="1756738532569" BASECOST="1.0" LEVELS="0" ALIAS="Tracked Military Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "TRAFFICCONTROL",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="TRAFFICCONTROL" ID="1770523564909" BASECOST="1.0" LEVELS="0" ALIAS="Air/Space Traffic Control Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "TRANQGUNS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TRANQGUNS" ID="1759094991102" BASECOST="1.0" LEVELS="0" ALIAS="Tranquilizer Dart Guns" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "TREBUCHET",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TREBUCHET" ID="1759094978597" BASECOST="1.0" LEVELS="0" ALIAS="Trebuchet" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "TROPICAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TROPICAL" ID="1762133077973" BASECOST="2.0" LEVELS="0" ALIAS="Tropical" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "TROPICALCOASTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TROPICALCOASTS" ID="1762133077967" BASECOST="1.0" LEVELS="0" ALIAS="Tropical Coasts/Pelagic Environments" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "TROPICALFORESTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TROPICALFORESTS" ID="1762133077969" BASECOST="1.0" LEVELS="0" ALIAS="Tropical Forests" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "TROPICALPLAINS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TROPICALPLAINS" ID="1762133077968" BASECOST="1.0" LEVELS="0" ALIAS="Tropical Plains" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "TURTLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TURTLE" ID="1759094979128" BASECOST="1.0" LEVELS="0" ALIAS="Turtle" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRIGGER related
            key: "TWOCONDITIONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TWOCONDITIONS" ID="1735590466223" BASECOST="0.25" LEVELS="0" ALIAS="Two activation conditions apply simultaneously" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // AOE related
            key: "TWODIMENSIONAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TWODIMENSIONAL" ID="1765690578792" BASECOST="-0.25" LEVELS="0" ALIAS="Two-Dimensional" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "TWOHANDED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TWOHANDED" ID="1759094955327" BASECOST="1.0" LEVELS="0" ALIAS="Two-Handed Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "TWOWHEELEDMOTORIZED",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TWOWHEELEDMOTORIZED" ID="1756738531310" BASECOST="1.0" LEVELS="0" ALIAS="Two-Wheeled Motorized Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "TWOWHEELEDMUSCLE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="TWOWHEELEDMUSCLE" ID="1756738528239" BASECOST="1.0" LEVELS="0" ALIAS="Two-Wheeled Muscle-Powered Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "UNARMEDCOMBAT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="UNARMEDCOMBAT" ID="1759094952507" BASECOST="0.0" LEVELS="0" ALIAS="Unarmed Combat" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DEPENDENTNPC related
            key: "UNAWARE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="UNAWARE" ID="1762057564470" BASECOST="5.0" LEVELS="0" ALIAS="Unaware of character's adventuring career/Secret ID" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "UNCOMMONMARTIAL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="UNCOMMONMARTIAL" ID="1759094959312" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Martial Arts Melee Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "UNCOMMONMELEE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="UNCOMMONMELEE" ID="1759094938545" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Melee Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "UNCOMMONMISSILEWEAPONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="UNCOMMONMISSILEWEAPONS" ID="1759094973491" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Missile Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "UNCOMMONMODERNWEAPONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="UNCOMMONMODERNWEAPONS" ID="1759094994607" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Modern Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "UNCOMMONMOTORIZEDGROUNDVEHICLES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="UNCOMMONMOTORIZEDGROUNDVEHICLES" ID="1756738533695" BASECOST="0.0" LEVELS="0" ALIAS="Uncommon Motorized Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "UNDERGROUND",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="UNDERGROUND" ID="1762133049643" BASECOST="2.0" LEVELS="0" ALIAS="Underground" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // SURVIVAL related
            key: "URBAN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="URBAN" ID="1762133049642" BASECOST="2.0" LEVELS="0" ALIAS="Urban" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // ANIMAL_HANDLER related
            key: "URSINES",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="URSINES" ID="1762052688375" BASECOST="2.0" LEVELS="0" ALIAS="Ursines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "URUMI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="URUMI" ID="1759094958725" BASECOST="1.0" LEVELS="0" ALIAS="Urumi" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CONTACT related
            key: "USEFUL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="USEFUL" ID="1762056035443" BASECOST="1.0" LEVELS="0" ALIAS="Contact has" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="USEFUL" OPTIONID="USEFUL" OPTION_ALIAS="useful Skills or resources" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DEPENDENTNPC related
            key: "USEFULNESS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="USEFULNESS" ID="1704506818256" BASECOST="10.0" LEVELS="0" ALIAS="Usefulness" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INCOMPENTENT" OPTIONID="INCOMPENTENT" OPTION_ALIAS="(Incompetent" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "VARYINGCOMBATEFFECTS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="VARYINGCOMBATEFFECTS" ID="1762137385492" BASECOST="10.0" LEVELS="0" ALIAS="Varying Combat Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // FORCEWALL related
        key: "VARYINGDIMENSIONS",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="VARYINGDIMENSIONS" ID="1762720568388" BASECOST="10.0" LEVELS="0" ALIAS="Varying Dimensions" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "VEHICLEWEAPONS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="VEHICLEWEAPONS" ID="1759095030605" BASECOST="1.0" LEVELS="0" ALIAS="Vehicle Weapons" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "VEHICLEWEAPONSALL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="VEHICLEWEAPONSALL" ID="1759095031614" BASECOST="2.0" LEVELS="0" ALIAS="Vehicle Weapons (group)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CHARGES related
            key: "VERYDIFFICULTFUEL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="VERYDIFFICULTFUEL" ID="1762721053278" BASECOST="-0.5" LEVELS="0" ALIAS="Fuel is Very Difficult to obtain" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // CONTACT related
            key: "VERYGOODRELATIONSHIP",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="VERYGOODRELATIONSHIP" ID="1762056988557" BASECOST="2.0" LEVELS="0" ALIAS="Very Good relationship with Contact" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "WARFAN",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WARFAN" ID="1759094949481" BASECOST="1.0" LEVELS="0" ALIAS="War Fan" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "WATER",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WATER" ID="1756738546771" BASECOST="0.0" LEVELS="0" ALIAS="Water Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "WATERSKIING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WATERSKIING" ID="1770523626095" BASECOST="1.0" LEVELS="0" ALIAS="Skiing (water)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // FRINGE_BENEFIT related
            key: "WEAPONPERMIT",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WEAPONPERMIT" ID="1762105849401" BASECOST="1.0" LEVELS="0" ALIAS="Weapon Permit (where appropriate)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "WEAPONS",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="WEAPONS" ID="1770523570855" BASECOST="0.0" LEVELS="0" ALIAS="Weapons Systems" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO"></ADDER>`,
    });
    addPower(undefined, {
        // SYSTEMS_OPERATION related
        key: "WEAPONSYSTEM",
        behaviors: ["adder"],
        type: ["adder"],
        costPerLevel: fixedValueFunction(0),
        xml: `<ADDER XMLID="WEAPONSYSTEM" ID="1770523570854" BASECOST="1.0" LEVELS="0" ALIAS="Single Weapon System" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="tunafish sandwidches" SHOWALIAS="No" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
    });
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "WHEELEDMILITARY",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WHEELEDMILITARY" ID="1756738533148" BASECOST="1.0" LEVELS="0" ALIAS="Wheeled Military Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "WHEELLOCKS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WHEELLOCKS" ID="1759094981142" BASECOST="1.0" LEVELS="0" ALIAS="Wheellocks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // GAMBLING related
            key: "WEICHI",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WEICHI" ID="1762058963265" BASECOST="1.0" LEVELS="0" ALIAS="Wei-Ch'i" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "WHIPS",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WHIPS" ID="1759094936280" BASECOST="1.0" LEVELS="0" ALIAS="Whips" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "WINDANDFIRE",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WINDANDFIRE" ID="1759094959311" BASECOST="1.0" LEVELS="0" ALIAS="Wind and Fire Wheels" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSPORT_FAMILIARITY related
            key: "WINDSURFING",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WINDSURFING" ID="1770523627348" BASECOST="1.0" LEVELS="0" ALIAS="Windsurfing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // WEAPON_FAMILIARITY related
            key: "WISHFULBALL",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="WISHFULBALL" ID="1759094973490" BASECOST="1.0" LEVELS="0" ALIAS="Wishful Steel Ball" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // LIFESUPPORT related
            key: "ZEROG",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ZEROG" ID="1738527995863" BASECOST="1.0" LEVELS="0" ALIAS="Safe Environment: Zero Gravity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
    addPower(
        {
            // DUPLICATION related
            key: "ZEROPHASERECOMBINATION",
            behaviors: ["adder"],
            type: ["adder"],
            costPerLevel: fixedValueFunction(0),
            xml: `<ADDER XMLID="ZEROPHASERECOMBINATION" ID="1688216130499" BASECOST="10.0" LEVELS="0" ALIAS="Easy Recombination (Zero-Phase Action at Full DCV)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES"></ADDER>`,
        },
        {},
    );
})();

(function addModifiersToPowerList() {
    addPower(
        {
            key: "ABLATIVE",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ACV" ID="1596334078859" BASECOST="0.0" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NONMENTALOMCV" OPTIONID="NONMENTALOMCV" OPTION_ALIAS="uses OMCV against DCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "AFFECTSDESOLID",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="AFFECTSDESOLID" ID="1759024085234" BASECOST="0.5" LEVELS="0" ALIAS="Affects Desolidified" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ANY" OPTIONID="ANY" OPTION_ALIAS="Any form of Desolidification" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "AFFECTSPHYSICALWORLD",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="AFFECTSPHYSICALWORLD" ID="1759029285770" BASECOST="2.0" LEVELS="0" ALIAS="Affects Physical World" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSFORM related
            key: "ALLORNOTHING",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ALLORNOTHING" ID="1764594003100" BASECOST="-0.5" LEVELS="0" ALIAS="All Or Nothing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ALTEREDDUPLICATES",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ALTEREDDUPLICATES" ID="1688216130571" BASECOST="0.25" LEVELS="0" ALIAS="Altered Duplicates" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="QUARTER" OPTIONID="QUARTER" OPTION_ALIAS="25%" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ALTEREDSHAPE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ALTEREDSHAPE" ID="1767000514617" BASECOST="0.0" LEVELS="0" ALIAS="Altered Shape" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CONE" OPTIONID="CONE" OPTION_ALIAS="Cone" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Typically part of SIDEEFFECTS
            key: "ALWAYSOCCURS",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            // SUMMON related
            key: "ARRIVESONOWN",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ARRIVESONOWN" ID="1767550887837" BASECOST="-0.5" LEVELS="0" ALIAS="Arrives Under Own Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "AUTOFIRE",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="AVAD" ID="1737923097808" BASECOST="0.0" LEVELS="0" ALIAS="Attack Versus Alternate Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYVERY" OPTIONID="VERYVERY" OPTION_ALIAS="Very Common -&gt; Very Common" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "AVLD",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(true),
        xml: `<MODIFIER XMLID="AVLD" ID="1735536296325" BASECOST="0.75" LEVELS="0" ALIAS="Attack Versus Limited Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });

    addPower(
        {
            key: "BACKLASH",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="BACKLASH" ID="1759025241244" BASECOST="0.5" LEVELS="0" ALIAS="Backlash" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "BASEDONCON",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="BASEDONCON" ID="1762138803705" BASECOST="-1.0" LEVELS="0" ALIAS="Based on CON" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PD" OPTIONID="PD" OPTION_ALIAS="Defense: PD" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "BEAM",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="BEAM" ID="1642201338928" BASECOST="-0.25" LEVELS="0" ALIAS="Beam" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // CLARISENTIENCE related
            key: "BLACKOUT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="BLACKOUT" ID="1755906498927" BASECOST="-0.5" LEVELS="0" ALIAS="Blackout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        // SHAPESHIFT related
        key: "BODYONLY",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(true),
        xml: `<MODIFIER XMLID="BODYONLY" ID="1663423869228" BASECOST="-0.5" LEVELS="0" ALIAS="Affects Body Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(undefined, {
        key: "BOECV",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(true),
        xml: `<MODIFIER XMLID="BOECV" ID="1735536316398" BASECOST="1.0" LEVELS="0" ALIAS="Based On EGO Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTAL" OPTIONID="MENTAL" OPTION_ALIAS="Mental Defense applies" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            // ENTANGLE related
            key: "BOTHDAMAGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="BOTHDAMAGE" ID="1760248050455" BASECOST="0.25" LEVELS="0" ALIAS="Entangle And Character Both Take Damage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "CANBEMISSILEDEFLECTED",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANBEMISSILEDEFLECTED" ID="1767000509402" BASECOST="-0.25" LEVELS="0" ALIAS="Can Be Missile Deflected" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CANNOTATTACK",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTATTACK" ID="1700709064472" BASECOST="-0.5" LEVELS="0" ALIAS="Cannot Attack Through Link" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMMUNICATE" OPTIONID="COMMUNICATE" OPTION_ALIAS="neither the character nor his target can use the link to attack each other mentally, but they can communicate" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CANNOTBEUSEDWITHMPA",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTBEUSEDWITHMPA" ID="1767000521234" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Be Used With Multiple-Power Attacks" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CANNOTDODAMAGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTDODAMAGE" ID="1730530836004" BASECOST="-0.5" LEVELS="0" ALIAS="Cannot Do Damage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // BARRIER related
            key: "CANNOTENGLOBE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTENGLOBE" ID="1762720614620" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Englobe" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            // Movement related
            key: "CANNOTHOVER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTHOVER" ID="1766366300234" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Hover" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2M" OPTIONID="2M" OPTION_ALIAS="must move at least 2m per Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            // DESOLIDIFICATION related
            key: "CANNOTPASSTHROUGHSOLID",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTPASSTHROUGHSOLID" ID="1708756543951" BASECOST="-0.5" LEVELS="0" ALIAS="Cannot Pass Through Solid Objects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Attack power related
            key: "CANNOTUSETARGETING",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CANNOTUSETARGETING" ID="1739696908630" BASECOST="-0.5" LEVELS="0" ALIAS="Cannot Use Targeting" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CHARGES",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            cost: function (modifierModel /* , item */) {
                // Charges has some unusual cost capping. If they are not recoverable, continuous, or boostable charges then
                // there is a limit on the charge cost. To implement the cap, charge adders have special cost
                // functions to put their cost at 0.
                const chargesBaseCost = modifierModel.BASECOST;
                const continuing = modifierModel.CONTINUING;
                const fuel = modifierModel.FUEL;
                const boostable = modifierModel.BOOSTABLE;
                const recoverable = modifierModel.RECOVERABLE;

                // Don't cap if these are continuing, fuel, boostable, or recoverable charges.
                if (!!continuing || !!fuel || !!boostable || !!recoverable) {
                    return chargesBaseCost;
                }

                // The only charges that remain are clip based (of course there could be no clip based)
                const chargeAdders = modifierModel.adders;
                const adderCost = chargeAdders.reduce((accum, adder) => accum + adder.cost, 0);
                const totalCost = chargesBaseCost + adderCost;

                // Cap out at +1 by faking the base cost of the CHARGES modifier BASECOST
                return chargesBaseCost - (totalCost - Math.min(1, totalCost));
            },
            heroValidation: function (modifier) {
                const validations = [];

                // OPTION_ALIAS > OPTIONID
                const OPTIONID = hdcTextNumberToNumeric(modifier.OPTIONID);
                const OPTION_ALIAS = parseInt(modifier.OPTION_ALIAS) || 0;
                if (OPTION_ALIAS > OPTIONID) {
                    validations.push({
                        property: "OPTION_ALIAS",
                        message: `CHARGES OPTION_ALIAS should be equal to or less than ${OPTIONID}`,
                        //example: `OPTION_ALIAS should be equal to or less than ${OPTIONID}`,
                        severity: HERO.VALIDATION_SEVERITY.WARNING,
                        modifierID: modifier.ID,
                    });
                }
                return validations;
            },
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CHARGES" ID="1712257766011" BASECOST="-2.0" LEVELS="0" ALIAS="Charges" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="1" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // FLIGHT related
            key: "COMBATACCELERATION",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="COMBATACCELERATION" ID="1762138576490" BASECOST="0.25" LEVELS="0" ALIAS="combat acceleration/deceleration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CONCENTRATION",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CONCENTRATION" ID="1727749190399" BASECOST="-0.5" LEVELS="0" ALIAS="Concentration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ZERO" OPTIONID="ZERO" OPTION_ALIAS="0 DCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CONDITIONALPOWER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CONDITIONALPOWER" ID="1732312708337" BASECOST="-0.25" LEVELS="0" ALIAS="Conditional Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="Power does not work in Uncommon Circumstances" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // INCANTATIONS related
            key: "CONSTANT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="CONSTANT" ID="1762135620312" BASECOST="1.0" LEVELS="0" ALIAS="Requires Incantations throughout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CONTINUOUS",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            // VPP framework related
            key: "COSMIC",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="COSMIC" ID="1663758701677" BASECOST="2.0" LEVELS="0" ALIAS="Cosmic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "COSTSEND",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="COSTSEND" ID="1728919937538" BASECOST="-0.25" LEVELS="0" ALIAS="Costs Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ACTIVATE" OPTIONID="ACTIVATE" OPTION_ALIAS="Only Costs END to Activate" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "COSTSENDONLYTOACTIVATE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="COSTSENDONLYTOACTIVATE" ID="1759025402295" BASECOST="0.25" LEVELS="0" ALIAS="Costs Endurance Only To Activate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "COSTSENDTOMAINTAIN",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="COSTSENDTOMAINTAIN" ID="1726627718650" BASECOST="-0.5" LEVELS="0" ALIAS="Costs END To Maintain" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FULL" OPTIONID="FULL" OPTION_ALIAS="Full END Cost" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "CREWSERVED",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DAMAGESHIELD" ID="1735588757286" BASECOST="0.5" LEVELS="0" ALIAS="Damage Shield" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DECREASEDACCELERATION",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DECREASEDACCELERATION" ID="1766366300240" BASECOST="-0.25" LEVELS="0" ALIAS="Decreased Acceleration/Deceleration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="4M" OPTIONID="4M" OPTION_ALIAS="3-4m" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "DECREASEDREUSE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DECREASEDREUSE" ID="1730531391045" BASECOST="1.5" LEVELS="0" ALIAS="Decreased Re-use Duration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1TURN" OPTIONID="1TURN" OPTION_ALIAS="1 Turn" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DELAYEDEFFECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DELAYEDEFFECT" ID="1764073515655" BASECOST="0.25" LEVELS="0" ALIAS="Delayed Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        // Applies to constant powers
        key: "DELAYEDEND",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="DELAYEDEND" ID="1771297018223" BASECOST="0.25" LEVELS="0" ALIAS="Delayed Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TURN" OPTIONID="TURN" OPTION_ALIAS="once per Turn" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "DELAYEDRETURNRATE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DELAYEDRETURNRATE" ID="1737065759130" BASECOST="1.0" LEVELS="0" ALIAS="Delayed Return Rate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINUTE" OPTIONID="MINUTE" OPTION_ALIAS="points return at the rate of 5 per Minute" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "DELAYEDRETURNRATE2",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="DELAYEDRETURNRATE2" ID="1758854747958" BASECOST="0.5" LEVELS="0" ALIAS="Delayed Return Rate (Points Gained)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FIVEMINUTES" OPTIONID="FIVEMINUTES" OPTION_ALIAS="points return at the rate of 5 per 5 Minutes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "DECREASEDSTUNMULTIPLIER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(-1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DECREASEDSTUNMULTIPLIER" ID="1735749243169" BASECOST="0.0" LEVELS="1" ALIAS="-1 Decreased STUN Multiplier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DIFFICULTTOALTER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DIFFICULTTOALTER" ID="1767000435166" BASECOST="-0.25" LEVELS="0" ALIAS="Difficult to Alter" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALF" OPTIONID="HALF" OPTION_ALIAS="simple changes take a Half Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DIFFICULTTODISPEL",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            key: "DIFFICULTTOOPERATE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="DIFFICULTTOOPERATE" ID="1766366192217" BASECOST="-0.25" LEVELS="0" ALIAS="Difficult to Operate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DOESBODY",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DOESKB" ID="1735588757282" BASECOST="0.25" LEVELS="0" ALIAS="Does Knockback" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // ENTANGLE related
            key: "DOESNOTPREVENTOAF",
            behaviors: ["modifier"],
            type: ["modifier"],
            dcAffecting: fixedValueFunction(false),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DOESNOTPREVENTOAF" ID="1742698456282" BASECOST="-1.0" LEVELS="0" ALIAS="Does Not Prevent The Use Of Accessible Foci" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "DOESNOTPROVIDEMENTALAWARENESS",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="DOESNOTPROVIDEMENTALAWARENESS" ID="1762135601080" BASECOST="-0.25" LEVELS="0" ALIAS="Does Not Provide Mental Awareness" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            // HEALING related
            key: "DOESNOTWORKONSOMEDAMAGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DOESNOTWORKONSOMEDAMAGE" ID="1737210056942" BASECOST="-0.75" LEVELS="0" ALIAS="Does Not Work On Some Damage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMMON" OPTIONID="COMMON" OPTION_ALIAS="[Common attack]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DOUBLEENDCOST",
            behaviors: ["modifier"],
            type: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DOUBLEENDCOST" ID="1764547146527" BASECOST="-0.5" LEVELS="0" ALIAS="Double Endurance Cost" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DOUBLEKB",
            behaviors: ["modifier"],
            type: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DOUBLEKB" ID="1735589197028" BASECOST="0.75" LEVELS="0" ALIAS="Double Knockback" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOTIMES" OPTIONID="TWOTIMES" OPTION_ALIAS="2x KB" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "DROPPED",
            behaviors: ["modifier"],
            type: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="DROPPED" ID="1767000444603" BASECOST="-0.5" LEVELS="0" ALIAS="Dropped" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "EFFECTS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="EFFECTS" ID="1762138619922" BASECOST="1.0" LEVELS="0" ALIAS="Hide effects of Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "ENDRESERVEOREND",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="ENDRESERVEOREND" ID="1760248770731" BASECOST="0.25" LEVELS="0" ALIAS="Power Can Draw END from Character or END Reserve" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "EXTRATIME",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 2), // HD shows BASECOST -0.5 (limitation), but this is really an advantage +1/2
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="EXPANDEDEFFECT" ID="1732212865433" BASECOST="-0.5" LEVELS="2" ALIAS="Expanded Effect (x2 Characteristics or Powers simultaneously)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "EXPLOSION",
        behaviors: ["modifier"],
        type: ["modifier"],
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
            key: "EYECONTACTREQUIRED",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="EYECONTACTREQUIRED" ID="1762138788577" BASECOST="-0.5" LEVELS="0" ALIAS="Eye Contact Required" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "FOCUS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="FOCUS" ID="1442342142790" BASECOST="-0.5" LEVELS="0" ALIAS="Focus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OIF" OPTIONID="OIF" OPTION_ALIAS="OIF" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "FUELDEPENDENT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="FUELDEPENDENT" ID="1766366139886" BASECOST="0.0" LEVELS="0" ALIAS="Fuel Dependent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "FULLPOWER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="FULLPOWER" ID="1767550494693" BASECOST="0.0" LEVELS="0" ALIAS="Must Be Used At Full Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "FULLREVERSE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="FULLREVERSE" ID="1766366148488" BASECOST="0.25" LEVELS="0" ALIAS="Full Reverse" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "GESTURES",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="GESTURES" ID="1727749190389" BASECOST="-0.25" LEVELS="0" ALIAS="Gestures" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "GLIDING",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="GLIDING" ID="1770257261114" BASECOST="-1.0" LEVELS="0" ALIAS="Gliding" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined, // In 5e it's a movement type separate from flight. In 6e it's a modifier to flight.
    );
    addPower(
        {
            key: "GRADUALEFFECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="GRADUALEFFECT" ID="1762135460636" BASECOST="-1.25" LEVELS="0" ALIAS="Gradual Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1HOUR" OPTIONID="1HOUR" OPTION_ALIAS="1 Hour" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "HALFRANGEMODIFIER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="HALFRANGEMODIFIER" ID="1766317008792" BASECOST="0.25" LEVELS="0" ALIAS="Half Range Modifier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "HANDTOHANDATTACK",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="IMPENETRABLE" ID="1712345241001" BASECOST="0.0" LEVELS="1" ALIAS="Impenetrable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            // TRANSFORM related
            key: "IMPROVEDTARGETGROUP",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="IMPROVEDTARGETGROUP" ID="1764594003040" BASECOST="0.25" LEVELS="0" ALIAS="Improved Results Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "INACCURATE",
            behaviors: ["modifier"],
            type: ["modifier"],
            dcAffecting: fixedValueFunction(true),
            costPerLevel: fixedValueFunction(0),
            xml: `<MODIFIER XMLID="INACCURATE" ID="1762135625354" BASECOST="-0.25" LEVELS="0" ALIAS="Inaccurate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALF" OPTIONID="HALF" OPTION_ALIAS="1/2 OCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "INCANTATIONS",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            key: "INCREASEDMAXRANGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INCREASEDMAXRANGE" ID="1766317008855" BASECOST="0.0" LEVELS="2" ALIAS="Increased Maximum Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "INCREASEDSTUNMULTIPLIER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INCREASEDSTUNMULTIPLIER" ID="1642201338997" BASECOST="0.0" LEVELS="1" ALIAS="+1 Increased STUN Multiplier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        // Independent limitation was removed in 6e
        undefined,
        {
            key: "INDEPENDENT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INDEPENDENT" ID="1737919880443" BASECOST="-2.0" LEVELS="0" ALIAS="Independent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
    );
    addPower(
        {
            key: "INDIRECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INDIRECT" ID="1760248513216" BASECOST="0.25" LEVELS="0" ALIAS="Indirect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CHARACTERINDIRECT" OPTIONID="CHARACTERINDIRECT" OPTION_ALIAS="Source Point is the Character, path is indirect, but the same with every use" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "INHERENT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INHERENT" ID="1730531186124" BASECOST="0.25" LEVELS="0" ALIAS="Inherent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "INSTANT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INSTANT" ID="1767000542433" BASECOST="-0.5" LEVELS="0" ALIAS="Instant" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "INVISIBLE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="INVISIBLE" ID="1693773081515" BASECOST="0.25" LEVELS="0" ALIAS="Invisible Power Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INOBVIOUSINVISIBLEONE" OPTIONID="INOBVIOUSINVISIBLEONE" OPTION_ALIAS="Inobvious Power, Invisible to Mental Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            // Movement related
            key: "LEAVESATRAIL",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LEAVESATRAIL" ID="1766316538588" BASECOST="-0.25" LEVELS="0" ALIAS="Leaves A Trail" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            // Movement related
            key: "LEVITATION",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LEVITATION" ID="1766366118689" BASECOST="-0.5" LEVELS="0" ALIAS="Levitation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITED",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITED" ID="1770498982804" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Class Of Powers Available" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SLIGHTLY" OPTIONID="SLIGHTLY" OPTION_ALIAS="Slightly Limited" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDBODYPARTS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDBODYPARTS" ID="1730530831066" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Body Parts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Hands/arms" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDCLASSOFMINDS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDCLASSOFMINDS" ID="1770498987360" BASECOST="-0.5" LEVELS="0" ALIAS="Limited Class Of Minds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SUBSET" OPTIONID="SUBSET" OPTION_ALIAS="[Subset of a class]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDCOVERAGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDCOVERAGE" ID="1770498977978" BASECOST="0.0" LEVELS="0" ALIAS="Limited Coverage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NEARLY360" OPTIONID="NEARLY360" OPTION_ALIAS="Nearly 360 Degrees" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDEFFECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDEFFECT" ID="1770498973692" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Vehicle movement related
            key: "LIMITEDMANEUVERABILITY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDMANEUVERABILITY" ID="1766316538585" BASECOST="-0.5" LEVELS="0" ALIAS="Limited Maneuverability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TURN" OPTIONID="TURN" OPTION_ALIAS="Only 1 turn per Phase at Combat speed; only 1 turn per Turn at Noncombat speed" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDPOWER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDPOWER" ID="1770498969063" BASECOST="0.0" LEVELS="0" ALIAS="Limited Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1" OPTIONID="1" OPTION_ALIAS="Power loses less than a fourth of its effectiveness" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDRANGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDRANGE" ID="1746303340671" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LIMITEDSPECIALEFFECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDSPECIALEFFECT" ID="1770498963742" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Special Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYCOMMON" OPTIONID="VERYCOMMON" OPTION_ALIAS="Very Common SFX" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // TRANSFORM related
            key: "LIMITEDTARGET",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDTARGET" ID="1764594003046" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Target" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SLIGHTLY" OPTIONID="SLIGHTLY" OPTION_ALIAS="([Slightly Limited]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LINGERING",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LINGERING" ID="1767550887835" BASECOST="0.25" LEVELS="0" ALIAS="Lingering" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PHASE" OPTIONID="PHASE" OPTION_ALIAS="+1 Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LINKED",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LINKED" ID="1737924019237" BASECOST="-0.5" LEVELS="0" ALIAS="Linked" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMPOUNDPOWER" OPTIONID="COMPOUNDPOWER" OPTION_ALIAS="" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" LINKED_ID="1737241269418"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // MINDCONTROL related
            key: "LITERAL",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LITERAL" ID="1767417218968" BASECOST="-0.25" LEVELS="0" ALIAS="Literal Interpretation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );

    addPower(
        {
            key: "LIMITEDTYPES",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LIMITEDTYPES" ID="1702648349818" BASECOST="-0.5" LEVELS="0" ALIAS="Only Works On Limited Types Of Objects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LIMITED" OPTIONID="LIMITED" OPTION_ALIAS="Limited Group of Objects" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="metallic objects" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LOCKOUT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LOCKOUT" ID="1762721165810" BASECOST="-0.5" LEVELS="0" ALIAS="Lockout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "LOS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="LOS" ID="1710708665903" BASECOST="0.5" LEVELS="0" ALIAS="Line Of Sight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            // Mental powers related
            key: "MANDATORYEFFECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="MANDATORYEFFECT" ID="1762138776945" BASECOST="-0.25" LEVELS="0" ALIAS="Mandatory Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TEN" OPTIONID="TEN" OPTION_ALIAS="EGO +10" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "MASS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="MASS" ID="1737920596086" BASECOST="0.0" LEVELS="0" ALIAS="Mass" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NONE" OPTIONID="NONE" OPTION_ALIAS="No Mass" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // "Mental" power related
            key: "MDADDSTOEGO",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="MDADDSTOEGO" ID="1767546334674" BASECOST="-0.5" LEVELS="0" ALIAS="Mental Defense Adds To EGO" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "MEGASCALE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="MEGASCALE" ID="1759093947856" BASECOST="0.0" LEVELS="5" ALIAS="MegaScale" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" SCALE="1&quot; = 10,000 km"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "MOBILE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="MOBILE" ID="1737907241760" BASECOST="0.25" LEVELS="0" ALIAS="Mobile" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "MODIFIER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="MODIFIER" ID="1736876900984" BASECOST="0.0" LEVELS="0" ALIAS="Custom Modifier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // VULNERABILITY related
            key: "MULTIPLIER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="MULTIPLIER" ID="1707069728157" BASECOST="0.0" LEVELS="0" ALIAS="Vulnerability Multiplier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFSTUN" OPTIONID="HALFSTUN" OPTION_ALIAS="1 1/2 x STUN" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // SUMMON related
            key: "MUSTINHABITLOCALEs",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="MUSTINHABITLOCALEs" ID="1767550887838" BASECOST="-0.5" LEVELS="0" ALIAS="Summoned Being Must Inhabit Locale" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // movement related
            key: "MUSTLAND",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="MUSTLAND" ID="1766365309625" BASECOST="-0.5" LEVELS="0" ALIAS="Must Land At The End Of Each Phase" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // TELEPORTATION related
            key: "MUSTPASSTHROUGHSPACE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="MUSTPASSTHROUGHSPACE" ID="1758288716031" BASECOST="-0.25" LEVELS="0" ALIAS="Must Pass Through Intervening Space" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(undefined, {
        key: "NND",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(true),
        xml: `<MODIFIER XMLID="NND" ID="1735536656343" BASECOST="1.0" LEVELS="0" ALIAS="No Normal Defense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STANDARD" OPTIONID="STANDARD" OPTION_ALIAS="[Standard]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "NOBACKWARDS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOBACKWARDS" ID="1766316538587" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Move Backwards" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOBARRIERS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOBARRIERS" ID="1726539977732" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Form Barriers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOCONSCIOUSCONTROL",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOCONSCIOUSCONTROL" ID="1737065783478" BASECOST="-2.0" LEVELS="0" ALIAS="No Conscious Control" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NODEFINCREASE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            editOptions: {
                choices: [
                    {
                        OPTIONID: "PD",
                        OPTION: "PD",
                        OPTION_ALIAS: "does not provide PD",
                        BASECOST: "0",
                    },
                    {
                        OPTIONID: "ED",
                        OPTION: "ED",
                        OPTION_ALIAS: "does not provide ED",
                        BASECOST: "0",
                    },
                    {
                        OPTIONID: "PDED",
                        OPTION: "PDED",
                        OPTION_ALIAS: "does not provide PD or ED",
                        BASECOST: "-0.25",
                    },
                ],
            },
            xml: `<MODIFIER XMLID="NODEFINCREASE" ID="1762009637585" BASECOST="-0.5" LEVELS="0" ALIAS="No Defense Increase" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PDED" OPTIONID="PDED" OPTION_ALIAS="does not provide PD or ED" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {
            editOptions: {
                choices: [
                    {
                        OPTIONID: "PD",
                        OPTION: "PD",
                        OPTION_ALIAS: "does not provide PD",
                        BASECOST: "-0.25",
                    },
                    {
                        OPTIONID: "ED",
                        OPTION: "ED",
                        OPTION_ALIAS: "does not provide ED",
                        BASECOST: "-0.25",
                    },
                    {
                        OPTIONID: "PDED",
                        OPTION: "PDED",
                        OPTION_ALIAS: "does not provide PD or ED",
                        BASECOST: "-0.5",
                    },
                ],
            },
        },
    );
    addPower(undefined, {
        key: "NOFIGURED",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="NOFIGURED" ID="1737921312173" BASECOST="-0.5" LEVELS="0" ALIAS="No Figured Characteristics" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            // MOVEMENT related
            key: "NOGRAVITYPENALTY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOGRAVITYPENALTY" ID="1737921008650" BASECOST="0.5" LEVELS="0" ALIAS="No Gravity Penalty" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOGROWTHMOMENTUM",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOGROWTHMOMENTUM" ID="1771268457993" BASECOST="-0.25" LEVELS="0" ALIAS="No Growth Momentum" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOKB",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOKB" ID="1736707259863" BASECOST="-0.25" LEVELS="0" ALIAS="No Knockback" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NONCOMBATACCELERATION",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NONCOMBATACCELERATION" ID="1762138607072" BASECOST="1.0" LEVELS="0" ALIAS="Noncombat acceleration/deceleration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NONONCOMBAT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NONONCOMBAT" ID="1732310748386" BASECOST="-0.25" LEVELS="0" ALIAS="no Noncombat movement" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Defense related
            key: "NONRESISTANT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NONRESISTANT" ID="1767546443542" BASECOST="-0.25" LEVELS="0" ALIAS="Nonresistant DEF" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NONSELECTIVETARGET",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NONSELECTIVETARGET" ID="1767000562554" BASECOST="-0.25" LEVELS="0" ALIAS="Nonselective Target" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NONPERSISTENT",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NORANGE" ID="1727749190370" BASECOST="-0.5" LEVELS="0" ALIAS="No Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NORANGEMODIFIER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NORANGEMODIFIER" ID="1759025100942" BASECOST="0.5" LEVELS="0" ALIAS="No Range Modifier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NORMALRANGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NORMALRANGE" ID="1710649513411" BASECOST="-0.25" LEVELS="0" ALIAS="Normal Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // VPP related
            key: "NOSKILLROLL",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOSKILLROLL" ID="1646155910707" BASECOST="1.0" LEVELS="0" ALIAS="No Skill Roll Required" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOSTRBONUS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOSTRBONUS" ID="1612300735512" BASECOST="-0.5" LEVELS="0" ALIAS="No STR Bonus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOSTRINCREASE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOSTRINCREASE" ID="1762009637587" BASECOST="-1" LEVELS="0" ALIAS="No STR Increase" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {
            xml: `<MODIFIER XMLID="NOSTRINCREASE" ID="1762009637587" BASECOST="-0.5" LEVELS="0" ALIAS="No STR Increase" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
    );
    addPower(
        {
            key: "NOTELEPORT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(1 / 4),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOTELEPORT" ID="1733613873292" BASECOST="0.0" LEVELS="1" ALIAS="Cannot Be Escaped With Teleportation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOTTHROUGHMINDLINK",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOTTHROUGHMINDLINK" ID="1770526728849" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Be Used Through Mind Link" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOTURNMODE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOTURNMODE" ID="1762138614150" BASECOST="0.25" LEVELS="0" ALIAS="No Turn Mode" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Stretching related
            key: "NOVELOCITYDAMAGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="NOVELOCITYDAMAGE" ID="1767550437808" BASECOST="-0.25" LEVELS="0" ALIAS="No Velocity Damage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "OIHID",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="OIHID" ID="1712092697365" BASECOST="-0.25" LEVELS="0" ALIAS="Only In Heroic Identity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Adjustment related
            key: "ONEUSEATATIME",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONEUSEATATIME" ID="1747979505796" BASECOST="-1.0" LEVELS="0" ALIAS="One Use At A Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONEWAYTRANSPARENT",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYAGAINSTLIMITEDTYPE" ID="1737921699851" BASECOST="-1.0" LEVELS="0" ALIAS="Only Works Against" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RARE" OPTIONID="RARE" OPTION_ALIAS="Rare attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONLYBETWEENADVENTURES",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYBETWEENADVENTURES" ID="1762138695886" BASECOST="-0.5" LEVELS="0" ALIAS="VPP Can Only Be Changed Between Adventures" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // TELEPORTATION related
            key: "ONLYFIXED",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYFIXED" ID="1752800595483" BASECOST="-1.0" LEVELS="0" ALIAS="Can Only Teleport To " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FIXED" OPTIONID="FIXED" OPTION_ALIAS="Fixed Locations" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="User's Unequipped Hand " PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONLYINGIVENCIRCUMSTANCE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYINGIVENCIRCUMSTANCE" ID="1762138692049" BASECOST="-0.5" LEVELS="0" ALIAS="VPP Powers Can Be Changed Only In Given Circumstance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONLYONAPPROPRIATETERRAIN",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYONAPPROPRIATETERRAIN" ID="1762138763375" BASECOST="-1.0" LEVELS="0" ALIAS="Only On Appropriate Terrain" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SNOWANDICE" OPTIONID="SNOWANDICE" OPTION_ALIAS="Only on snow and ice" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONLYONSURFACE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYONSURFACE" ID="1762134206075" BASECOST="-0.25" LEVELS="0" ALIAS="Only When In Contact With The Ground" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONLYOTHERS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYOTHERS" ID="1762720154745" BASECOST="-0.5" LEVELS="0" ALIAS="Only to Aid Others" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "ONLYSELF",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYSELF" ID="1762720132110" BASECOST="-1.0" LEVELS="0" ALIAS="Only to Aid Self" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "ONLYTHROUGHOTHERS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYTHROUGHOTHERS" ID="1755906478205" BASECOST="-0.5" LEVELS="0" ALIAS="Only Through The Senses Of Others" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONLYTOCREATELIGHT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYTOCREATELIGHT" ID="1767000555587" BASECOST="-1.0" LEVELS="0" ALIAS="Only To Create Light" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "ONLYTOSTARTING",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYTOSTARTING" ID="1762134212498" BASECOST="-0.5" LEVELS="0" ALIAS="Only Restores To Starting Values" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "ONLYWITHGOD",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="ONLYWITHGOD" ID="1762134202676" BASECOST="-0.5" LEVELS="0" ALIAS="Only When Serving The God's Purposes" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "ONLYWITHMINDLINK",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ONLYWITHMINDLINK" ID="1762712202603" BASECOST="-1.0" LEVELS="0" ALIAS="Only With Others Who Have Mind Link" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // CONTACT related
            key: "ORGANIZATION",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ORGANIZATION" ID="1709496795426" BASECOST="2.0" LEVELS="0" ALIAS="Organization Contact" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "OTHERSONLY",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="OTHERSONLY" ID="1762138755473" BASECOST="-0.5" LEVELS="0" ALIAS="Others Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
    });

    addPower(
        {
            // TRANSFORM related
            key: "PARTIALTRANSFORM",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="PARTIALTRANSFORM" ID="1760247883417" BASECOST="0.5" LEVELS="0" ALIAS="Partial Transform" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "PDAPPLIES",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="PDAPPLIES" ID="1762134218816" BASECOST="-1.0" LEVELS="0" ALIAS="PD Applies" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "PENETRATING",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="PHYSICALMANIFESTATION" ID="1737922207843" BASECOST="-0.25" LEVELS="0" ALIAS="Physical Manifestation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "PRECOGNITIONONLY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="PRECOGNITIONONLY" ID="1696022407697" BASECOST="-1.0" LEVELS="0" ALIAS="Precognition/Retrocognition Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "RANGEBASEDONSTR",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RANGED" ID="1710708659774" BASECOST="0.5" LEVELS="0" ALIAS="Ranged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RANGED" OPTIONID="RANGED" OPTION_ALIAS="Ranged" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Ranged Recombination
            key: "RANGEDRECOMBINATION",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RANGEDRECOMBINATION" ID="1688216130560" BASECOST="0.5" LEVELS="0" ALIAS="Ranged Recombination" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // DUPLICATION related
            key: "RAPIDDUPLICATION",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RAPIDDUPLICATION" ID="1688216130501" BASECOST="0.0" LEVELS="6" ALIAS="Rapid Duplication (can create 64 Duplicates per Half Phase)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "RAPIDNONCOMBATMOVEMENT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RAPIDNONCOMBATMOVEMENT" ID="1762663728109" BASECOST="0.25" LEVELS="0" ALIAS="rapid Noncombat movement" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        // Movement related
        key: "RESTRICTEDPATH",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="RESTRICTEDPATH" ID="1762138740833" BASECOST="-1.0" LEVELS="0" ALIAS="Restricted Path" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
    });
    addPower(
        {
            key: "REALARMOR",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REALWEAPON" ID="1736116897598" BASECOST="-0.25" LEVELS="0" ALIAS="Real Weapon" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REDUCEDBYRANGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REDUCEDBYRANGE" ID="1762105547940" BASECOST="-0.25" LEVELS="0" ALIAS="Reduced By Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REDUCEDEND",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            minimumLimitation: -0.25,
            xml: `<MODIFIER XMLID="REQUIRESASKILLROLL" ID="1596334078849" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "REQUIRESLIGHT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="REQUIRESLIGHT" ID="1766365315705" BASECOST="-0.25" LEVELS="0" ALIAS="Requires Light To Use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // ENDURANCERESERVE related
            key: "RESTRICTEDUSE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RESTRICTEDUSE" ID="1768007214710" BASECOST="-0.25" LEVELS="0" ALIAS="Restricted Use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        undefined,
    );
    addPower(
        {
            // HEALING related
            key: "RESURRECTIONONLY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RESURRECTIONONLY" ID="1747979425717" BASECOST="-0.5" LEVELS="0" ALIAS="Resurrection Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "RITUAL",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="RITUAL" ID="1766365346109" BASECOST="-0.25" LEVELS="0" ALIAS="Ritual" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2" OPTIONID="2" OPTION_ALIAS="2 casters" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            // Teleport related
            key: "SAFEBLINDTELEPORT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SAFEBLINDTELEPORT" ID="1734150398776" BASECOST="0.25" LEVELS="0" ALIAS="Safe Blind Teleport" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Movement related
            key: "SAFEBLINDTRAVEL",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SAFEBLINDTRAVEL" ID="1767841144908" BASECOST="0.25" LEVELS="0" ALIAS="Safe Blind Travel" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SECTIONAL_DEFENSES",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SECTIONAL_DEFENSES" ID="1762138737417" BASECOST="-2.0" LEVELS="0" ALIAS="Sectional Defenses" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SHORTVEST" OPTIONID="SHORTVEST" OPTION_ALIAS="Short Vest (Protects Locations 12-13" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT/DARKNESS (anything AOE by default) related
            key: "SELECTIVETARGET",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SELECTIVETARGET" ID="1757220854359" BASECOST="0.5" LEVELS="0" ALIAS="Selective Target" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SELFONLY",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SENSEAFFECTEDASMORETHANONESENSE" ID="1738018247799" BASECOST="-0.5" LEVELS="0" ALIAS="Sense Affected As More Than One Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYCOMMON" OPTIONID="VERYCOMMON" OPTION_ALIAS="[very common Sense]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SETEFFECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SETEFFECT" ID="1767000456766" BASECOST="-1.0" LEVELS="0" ALIAS="Set Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SFXONLY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SFXONLY" ID="1762138619920" BASECOST="-1.0" LEVELS="0" ALIAS="SFX Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SIDEEFFECTS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SIDEEFFECTS" ID="1737923914185" BASECOST="-0.25" LEVELS="0" ALIAS="Side Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINOR" OPTIONID="MINOR" OPTION_ALIAS="Minor Side Effect" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SIDEWAYSMANEUVERABILITY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SIDEWAYSMANEUVERABILITY" ID="1766366155500" BASECOST="0.5" LEVELS="0" ALIAS="Sideways Maneuverability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FULL" OPTIONID="FULL" OPTION_ALIAS="full velocity" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SOURCEONLY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SOURCEONLY" ID="1763266213674" BASECOST="-1.0" LEVELS="0" ALIAS="Source Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // SUMMON related
            key: "SPECIFICBEING",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SPECIFICBEING" ID="1767550694169" BASECOST="1.0" LEVELS="0" ALIAS="Specific Being" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // CUSTOMPOWER related
            key: "SPELL",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SPELL" ID="1688217018497" BASECOST="-0.5" LEVELS="0" ALIAS="Spell" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SPIRIT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SPIRIT" ID="1709496795428" BASECOST="1.0" LEVELS="0" ALIAS="Spirit Contact" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Vehicle Movement related
            key: "STALLVELOCITY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="STALLVELOCITY" ID="1766366139840" BASECOST="-0.25" LEVELS="0" ALIAS="Stall Velocity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALF" OPTIONID="HALF" OPTION_ALIAS="1/2 Vehicle's Maximum Combat Velocity" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "STICKY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="STICKY" ID="1735536581282" BASECOST="0.5" LEVELS="0" ALIAS="Sticky" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STANDARD" OPTIONID="STANDARD" OPTION_ALIAS="Standard" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "STOPSWHENKOD",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="STOPSWHENKOD" ID="1762138720872" BASECOST="-0.25" LEVELS="0" ALIAS="Stops Working If Mentalist Is Knocked Out" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "STRMINIMUM",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="STRMINIMUM" ID="1736116903579" BASECOST="-0.25" LEVELS="0" ALIAS="STR Minimum" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1-5" OPTIONID="1-5" OPTION_ALIAS="1-5" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "STUNONLY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="STUNONLY" ID="1732058577233" BASECOST="0.0" LEVELS="0" ALIAS="STUN Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "SUBJECTTORANGEMODIFIER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="SUBJECTTORANGEMODIFIER" ID="1762138702806" BASECOST="-0.25" LEVELS="0" ALIAS="Subject To Range Modifier" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "TAKEOFFLANDING",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="TAKEOFFLANDING" ID="1766366102958" BASECOST="-1.0" LEVELS="0" ALIAS="Takeoff/Landing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TAKESNODAMAGE",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="TELEPATHIC" ID="1735977286708" BASECOST="0.25" LEVELS="0" ALIAS="Telepathic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // GESTURES related
            key: "THROUGHOUT",
            behaviors: ["modifier"],
            type: ["modifier"],
            cost: function (modifierModel /*, item */) {
                // This has no cost itself; it's a 2x cost multiplier. Just pretend the cost of this modifier is
                // the cost of its parent with any additional adders that it may have.
                const parentsAdders = modifierModel.parent.adders;
                let parentsAddersCosts = 0;
                for (const adder of parentsAdders) {
                    parentsAddersCosts += adder.cost;
                }

                return modifierModel.parent.BASECOST + parentsAddersCosts;
            },
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="THROUGHOUT" ID="1762104990480" BASECOST="1.0" LEVELS="0" ALIAS="Requires Gestures throughout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TIMEDELAY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="TIMEDELAY" ID="1762138585408" BASECOST="0.25" LEVELS="0" ALIAS="Time Delay" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TIMELIMIT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="TIMELIMIT" ID="1738525037034" BASECOST="0.25" LEVELS="0" ALIAS="Time Limit" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EXTRAPHASE" OPTIONID="EXTRAPHASE" OPTION_ALIAS="Extra Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TIMEMODIFIERS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="TIMEMODIFIERS" ID="1771297470511" BASECOST="-0.5" LEVELS="0" ALIAS="Time Modifiers" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TRANSDIMENSIONAL",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="TRANSDIMENSIONAL" ID="1738534122034" BASECOST="0.5" LEVELS="0" ALIAS="Transdimensional" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Dimension" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "TRANSPARENT",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="TRANSPARENT" ID="1752359726500" BASECOST="0.0" LEVELS="0" ALIAS="Transparent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            key: "TRIGGER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            minimumLimitation: 0.25,
            xml: `<MODIFIER XMLID="TRIGGER" ID="1735590829092" BASECOST="0.25" LEVELS="0" ALIAS="Trigger" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SET" OPTIONID="SET" OPTION_ALIAS="Set Trigger" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "TURNMODE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="TURNMODE" ID="1762138699386" BASECOST="-0.25" LEVELS="0" ALIAS="Turn Mode" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="Yes"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "UNCONTROLLED",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="USABLEAS" ID="1737922876396" BASECOST="0.25" LEVELS="0" ALIAS="Usable [As Second Mode Of Movement]" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // MOVEMENT related
            key: "USABLEUNDERWATER",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="USABLEUNDERWATER" ID="1762138567288" BASECOST="0.25" LEVELS="0" ALIAS="Usable Underwater" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            key: "VARIABLEADVANTAGE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="VARIABLEADVANTAGE" ID="1735590455736" BASECOST="0.5" LEVELS="0" ALIAS="Variable Advantage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // Adjustment related
            key: "VARIABLEEFFECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="VARIABLEEFFECT" ID="1759024606902" BASECOST="0.5" LEVELS="0" ALIAS="Variable Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Characteristics" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(undefined, {
        // TRANSFER related
        key: "VARIABLEEFFECT2",
        behaviors: ["modifier"],
        type: ["modifier"],
        costPerLevel: fixedValueFunction(0),
        dcAffecting: fixedValueFunction(false),
        xml: `<MODIFIER XMLID="VARIABLEEFFECT2" ID="1766281443255" BASECOST="0.5" LEVELS="0" ALIAS="Variable Effect (To)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWO" OPTIONID="TWO" OPTION_ALIAS="to [two powers] simultaneously" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
    });
    addPower(
        {
            // TRANSFORM related
            key: "VARIABLEHEALINGMETHOD",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="VARIABLEHEALINGMETHOD" ID="1764594003039" BASECOST="0.25" LEVELS="0" ALIAS="Variable Healing Method" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "VARIABLELIMITATIONS",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="VARIABLELIMITATIONS" ID="1736654196172" BASECOST="0.0" LEVELS="8" ALIAS="Variable Limitations" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "VARIABLESFX",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(true),
            xml: `<MODIFIER XMLID="VARIABLESFX" ID="1735590455741" BASECOST="0.25" LEVELS="0" ALIAS="Variable Special Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LIMITED" OPTIONID="LIMITED" OPTION_ALIAS="Limited Group of SFX" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            // CHANGEENVIRONMENT related
            key: "VARYINGEFFECT",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="VARYINGEFFECT" ID="1696022407789" BASECOST="0.25" LEVELS="0" ALIAS="Varying Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERY" OPTIONID="VERY" OPTION_ALIAS="Very Limited Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "VERSUSEGO",
            behaviors: ["modifier"],
            type: ["modifier"],
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
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="VISIBLE" ID="1731124293164" BASECOST="-0.25" LEVELS="0" ALIAS="Visible" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "VULNERABLE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="VULNERABLE" ID="1737906231719" BASECOST="-0.5" LEVELS="0" ALIAS="Vulnerable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMMON" OPTIONID="COMMON" OPTION_ALIAS="Common" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Gravity" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            // SUMMON related
            key: "WEAKWILLED",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="WEAKWILLED" ID="1767550887809" BASECOST="0.25" LEVELS="0" ALIAS="Weak-Willed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINUS2" OPTIONID="MINUS2" OPTION_ALIAS="-2 on EGO Rolls" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );
    addPower(
        {
            key: "WINDOWOFOPPORTUNITY",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="WINDOWOFOPPORTUNITY" ID="1767000501368" BASECOST="0.0" LEVELS="0" ALIAS="Window Of Opportunity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            // VPP related
            key: "ZEROPHASE",
            behaviors: ["modifier"],
            type: ["modifier"],
            costPerLevel: fixedValueFunction(0),
            dcAffecting: fixedValueFunction(false),
            xml: `<MODIFIER XMLID="ZEROPHASE" ID="1646155910706" BASECOST="1.0" LEVELS="0" ALIAS="Powers Can Be Changed As A Zero-Phase Action" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No"></MODIFIER>`,
        },
        {},
    );
})();

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
