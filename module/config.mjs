export const HERO = {};

HERO.bool = {
    true: "True",
    false: "False",
};

HERO.extraDice = {
    zero: "+0",
    pip: "+1",
    half: "+½D6",
    "one-pip": "+1D6-1",
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

HERO.hitLocationsToHit = {
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
};

HERO.sidedLocations = new Set([
    "Hand",
    "Shoulder",
    "Arm",
    "Thigh",
    "Leg",
    "Foot",
]);

HERO.hitLocations = {
    // Location : [x Stun, x N Stun, x Body, OCV modifier]
    Head: [5, 2, 2, -8],
    Hand: [1, 0.5, 0.5, -6],
    Arm: [2, 0.5, 0.5, -5],
    Shoulder: [3, 1, 1, -5],
    Chest: [3, 1, 1, -5],
    Stomach: [4, 1.5, 1, -7],
    Vitals: [4, 1.5, 2, -8],
    Thigh: [2, 1, 1, -4],
    Leg: [2, 0.5, 0.5, -6],
    Foot: [1, 0.5, 0.5, -8],
};

HERO.hitLocationSide = {
    Left: "Left",
    Right: "Right",
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

// TODO: This could be created from powers.
HERO.movementPowers = {
    extradimensionalmovement: "Extra Dimensional Movement",
    flight: "Flight",
    ftl: "Faster Than Light",
    leaping: "Leaping",
    running: "Running",
    swimming: "Swimming",
    swinging: "Swinging",
    teleportation: "Teleportation",
    tunneling: "Tunneling",
};

HERO.movementPowers5e = {
    ...HERO.movementPowers,
    gliding: "Gliding",
};

function validatePowers() {
    let numViolations = 0;

    // Has behaviors field
    const powersWithoutBehaviors = this.filter((power) => !power.behaviors);
    if (powersWithoutBehaviors.length > 0) {
        console.log(`Powers without behaviors field: `, powersWithoutBehaviors);
    }
    numViolations += powersWithoutBehaviors.length;

    // Has range field and is not framework/compound
    const powersWithoutRange = this.filter(
        (power) =>
            !(
                power.type.includes("framework") ||
                power.type.includes("compound") ||
                power.behaviors.includes("adder") ||
                power.behaviors.includes("modifier")
            ) && !power.range,
    );
    if (powersWithoutRange.length > 0) {
        console.log(`Powers without range field: `, powersWithoutRange);
    }
    numViolations += powersWithoutRange.length;

    // A power without duration field?
    const powersWithoutDuration = this.filter(
        (power) =>
            !power.duration &&
            (power.type.includes("adjustment ") ||
                (power.type.includes("attack") &&
                    !power.type.includes("martial")) ||
                power.type.includes("defense") ||
                power.type.includes("movement") ||
                power.type.includes("body-affecting") ||
                power.type.includes("standard") ||
                power.type.includes("skills")),
    );
    if (powersWithoutDuration.length > 0) {
        console.log(`Powers without duration field: `, powersWithoutDuration);
    }
    numViolations += powersWithoutDuration.length;

    if (numViolations === 0) {
        console.log(`Powers look valid`);
    }

    return numViolations;
}

HERO.powers6e = [];
HERO.powers6e.validate = validatePowers;
HERO.powers5e = [];
HERO.powers5e.validate = validatePowers;

/**
 * @typedef {Object} PowerDescription
 * @param {string} key - Hero Designer XMLID of the power
 * @param {string} name - Human readable name of the power
 * @param {string} base - Base cost in character points
 * @param {string} cost - Cost in character points per additional level
 * @param {Array<string>} type - A list of types associated with this power
 * @param {Array<"non-hd" | "optional-maneuver" | "success"| "dice" | "attack" | "activatable" | "adder" | "modifier">} behaviors - A list of the behavior types this power exhibits in the code
 *                                       "non-hd" - this is not an XMLID that comes from Hero Designer
 *                                       "optional-maneuver" - this is an optional combat maneuver
 *                                       "success" - can roll some kind of success roll for this power
 *                                       "dice" - a damage/effect dice roll is associated with this power
 *                                       "attack" - a to-hit dice roll is associated with this power
 *                                       "activatable" - this power can be turned on/off/activated/deactivated
 *                                       "adder" - this power is actually a power adder
 *                                       "modifier" - this power is actually a power modifier (aka advantage)
 *
 * @param {"constant"|"instant"|"persistent"} duration - The lower case duration of the power
 * @param {"standard"|"self"|"no range"|"los"|"special"|"limited range"|"range based on str"} range - The range of the power
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
            powerDescription6e.xml = powerDescription6e.xml
                .replace(/\n/g, "")
                .trim();
            const parser = new DOMParser();
            let xml = parser.parseFromString(
                powerDescription6e.xml.trim(),
                "text/xml",
            );

            // Add power properties based on valid XML.
            // NOTE: Chrome will parse partially valid XML, FireFox will not
            // which is why we are checkig for parsererror.
            if (xml.getElementsByTagName("parsererror").length === 0) {
                powerDescription6e.key ??=
                    xml.children[0].getAttribute("XMLID");
                powerDescription6e.name ??=
                    xml.children[0].getAttribute("ALIAS");
                powerDescription6e.type ??= [];
                powerDescription6e.behaviors ??= [
                    xml.children[0].tagName.toLowerCase(),
                ];
            } else {
                //debugger;
            }
        }
        if (!powerDescription6e.key) {
            //debugger;
            return;
        }
        HERO.powers6e.push(foundry.utils.deepClone(powerDescription6e));
    }

    if (powerOverrideFor5e) {
        const powerDescription5e = Object.assign(
            powerDescription6e ? powerDescription6e : {},
            powerOverrideFor5e,
        );

        if (powerDescription5e.xml) {
            powerDescription5e.xml = powerDescription5e.xml
                .replace(/\n/g, "")
                .trim();
            const parser = new DOMParser();
            let xml = parser.parseFromString(
                powerDescription5e.xml.trim(),
                "text/xml",
            );

            if (xml.getElementsByTagName("parsererror").length === 0) {
                powerDescription5e.key ??=
                    xml.children[0].getAttribute("XMLID");
                powerDescription5e.name ??=
                    xml.children[0].getAttribute("ALIAS");
                powerDescription5e.type ??= [];
                powerDescription5e.behaviors ??= [
                    xml.children[0].tagName.toLowerCase(),
                ];
            } else {
                //debugger;
            }
        }
        if (!powerDescription5e.key) {
            //debugger;
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
            costPerLevel: 1,
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: true,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<STR XMLID="STR" ID="1712377060992" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </STR>`,
        },
        {},
    );
    addPower(
        {
            key: "DEX",
            name: "Dexterity",
            base: 10,
            costPerLevel: 2,
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["base2"],
            xml: `<DEX XMLID="DEX" ID="1712447975671" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </DEX>`,
        },
        {
            costPerLevel: 3,
        },
    );
    addPower(
        {
            key: "CON",
            name: "Constitution",
            base: 10,
            costPerLevel: 1,
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            xml: `<CON XMLID="CON" ID="1712377266422" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </CON>`,
        },
        {
            costPerLevel: 2,
        },
    );
    addPower(
        {
            key: "INT",
            name: "Intelligence",
            base: 10,
            costPerLevel: 1,
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["vehicle", "base2"],
            xml: `<INT XMLID="INT" ID="1712377270415" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </INT>`,
        },
        {},
    );
    addPower(
        {
            key: "EGO",
            name: "Ego",
            base: 10,
            costPerLevel: 1,
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["automaton", "vehicle", "base2", "computer"],
            xml: `<EGO XMLID="EGO" ID="1712377272129" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </EGO>`,
        },
        {
            costPerLevel: 2,
        },
    );
    addPower(
        {
            key: "PRE",
            name: "Presence",
            base: 10,
            costPerLevel: 1,
            type: ["characteristic"],
            behaviors: ["success"],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            xml: `<PRE XMLID="PRE" ID="1712377273912" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </PRE>`,
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
        range: "self",
        costEnd: false,
        ignoreFor: ["vehicle", "base2", "computer", "ai", "6e"], // TODO: Remove the 6e here.
        base: 10,
        costPerLevel: 1 / 2,
        xml: `<COM XMLID="COM" ID="1712377275507" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
        <NOTES />
        </COM>`,
    });
    addPower(
        {
            key: "OCV",
            name: "Offensive Combat Value",
            base: 3,
            costPerLevel: 5,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["base2"],
            xml: `<OCV XMLID="OCV" ID="1712377400048" BASECOST="0.0" LEVELS="0" ALIAS="OCV" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </OCV>`,
        },
        {
            costPerLevel: 0,
            xml: undefined,
        },
    );
    addPower(
        {
            key: "DCV",
            name: "Defensive Combat Value",
            base: 3,
            costPerLevel: 5,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["base2"],
            xml: `<DCV XMLID="DCV" ID="1712377402602" BASECOST="0.0" LEVELS="0" ALIAS="DCV" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </DCV>`,
        },
        {
            costPerLevel: 0,
            xml: undefined,
        },
    );
    addPower(
        {
            key: "OMCV",
            name: "Offensive Mental Combat Value",
            base: 3,
            costPerLevel: 3,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["automaton", "vehicle", "base2"],
            xml: `<OMCV XMLID="OMCV" ID="1712377404591" BASECOST="0.0" LEVELS="0" ALIAS="OMCV" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </OMCV>`,
        },
        {
            costPerLevel: 0,
            xml: undefined,
        },
    );
    addPower(
        {
            key: "DMCV",
            name: "Defensive Mental Combat Value",
            base: 3,
            costPerLevel: 3,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["automaton", "vehicle", "base2"],
            xml: `<DMCV XMLID="DMCV" ID="1712377406823" BASECOST="0.0" LEVELS="0" ALIAS="DMCV" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </DMCV>`,
        },
        {
            costPerLevel: 0,
            xml: undefined,
        },
    );
    addPower(
        {
            key: "SPD",
            name: "Speed",
            base: 2,
            costPerLevel: 10,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["base2"],
            xml: `<SPD XMLID="SPD" ID="1712377280539" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </SPD>`,
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
            costPerLevel: 1,
            type: ["characteristic", "defense"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["computer", "ai"],
            xml: `<PD XMLID="PD" ID="1712377277205" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </PD>`,
        },
        {
            base: 0,
            costPerLevel: 1,
        },
    );
    addPower(
        {
            key: "ED",
            name: "Energy Defense",
            base: 2,
            costPerLevel: 1,
            type: ["characteristic", "defense"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["computer", "ai"],
            xml: `<ED XMLID="ED" ID="1712377278856" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </ED>`,
        },
        {
            base: 0,
            costPerLevel: 1,
        },
    );
    addPower(
        {
            key: "REC",
            name: "Recovery",
            base: 4,
            costPerLevel: 1,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            xml: `<REC XMLID="REC" ID="1712377282168" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </REC>`,
        },
        {
            base: 0,
            costPerLevel: 2,
        },
    );
    addPower(
        {
            key: "END",
            name: "Endurance",
            base: 20,
            costPerLevel: 1 / 5,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            xml: `<END XMLID="END" ID="1712377283848" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </END>`,
        },
        {
            base: 0,
            costPerLevel: 1 / 2,
        },
    );
    addPower(
        {
            key: "BODY",
            name: "Body",
            base: 10,
            costPerLevel: 1,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["computer", "ai"],
            xml: `<BODY XMLID="BODY" ID="1712377268646" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </BODY>`,
        },
        {
            costPerLevel: 2,
        },
    );
    addPower(
        {
            key: "STUN",
            name: "Stun",
            base: 20,
            costPerLevel: 1 / 2,
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            ignoreFor: ["vehicle", "base2", "computer", "ai"],
            xml: `<STUN XMLID="STUN" ID="1712377285547" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
            <NOTES />
            </STUN>`,
        },
        {
            base: 0,
            costPerLevel: 1,
        },
    );

    addPower(
        {
            key: "BASESIZE",
            name: "Base Size",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            onlyFor: ["base2"],
        },
        {},
    );

    addPower(undefined, {
        key: "DEF",
        name: "Defense",
        type: ["characteristic"],
        behaviors: [],
        duration: "persistent",
        target: "self only",
        range: "self",
        costEnd: false,
        onlyFor: ["base2", "vehicle"],
    });

    addPower(
        {
            key: "SIZE",
            name: "Vehicle Size",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            onlyFor: ["vehicle"],
        },
        {},
    );

    // HD extendable characteristics
    addPower(
        {
            key: "CUSTOM1",
            name: "Custom Characteristic 1",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM2",
            name: "Custom Characteristic 2",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM3",
            name: "Custom Characteristic 3",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM4",
            name: "Custom Characteristic 4",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM5",
            name: "Custom Characteristic 5",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM6",
            name: "Custom Characteristic 6",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM7",
            name: "Custom Characteristic 7",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM8",
            name: "Custom Characteristic 8",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM9",
            name: "Custom Characteristic 9",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOM10",
            name: "Custom Characteristic 10",
            type: ["characteristic"],
            behaviors: [],
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
})();

(function addManeuversToPowerList() {
    addPower(undefined, {
        key: "BLAZINGAWAY",
        type: ["maneuver"],
        behaviors: ["non-hd", "optional-maneuver"],
        name: "Blazing Away",
        perceivability: "obvious",
        duration: "instant",
        range: "standard",
        costEnd: false,
        target: "target's dcv",
        ignoreFor: ["base2", "computer", "ai"],
        maneuverDesc: {
            phase: "1/2",
            ocv: "+0",
            dcv: "+0",
            effects: "Make as many attacks as desired, only hit on a 3",
            attack: true, // TODO: Do we want this property? Should likely be part of the behaviors. Same comment for all maneuvers.
        },
    });
    addPower(
        {
            key: "BLOCK",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Block",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "Blocks HTH attacks, Abort",
                attack: true, // TODO: Should be false as it's not an attack. It does, however, require dice.
            },
        },
        {},
    );
    addPower(
        {
            key: "BRACE",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Brace",
            perceivability: "obvious",
            duration: "instant",
            range: "self",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "0",
                ocv: "+2",
                dcv: "1/2",
                effects: "+2 OCV only to offset the Range Modifier",
                attack: false,
            },
        },
        {},
    );

    addPower(
        {
            key: "CHOKE",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Choke",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "-2",
                effects: "NND 1d6, Grab One Limb",
                attack: true,
            },
        },
        undefined,
    );
    addPower(
        {
            key: "CLUBWEAPON",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Club Weapon",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "Killing weapon does equivalent Normal Damage",
                attack: true,
            },
        },
        {},
    );
    addPower(
        {
            key: "COVER",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Cover",
            perceivability: "obvious",
            duration: "instant",
            range: "self",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "+0",
                effects: "Target held at gunpoint",
                attack: true,
            },
        },
        {},
    );

    addPower(
        {
            key: "DISARM",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Disarm",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "+0",
                effects: "Disarm target, requires STR vs. STR Roll",
                attack: true,
            },
        },
        {},
    );
    addPower(
        {
            key: "DIVEFORCOVER",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Dive For Cover",
            perceivability: "obvious",
            duration: "instant",
            range: "self",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "Character avoids attack; Abort",
                attack: true,
            },
        },
        {},
    );
    addPower(
        {
            key: "DODGE",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Dodge",
            perceivability: "obvious",
            duration: "instant",
            range: "self",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "--",
                dcv: "+3",
                effects: "Dodge all attacks, Abort",
                attack: true,
            },
        },
        {},
    );

    addPower(
        {
            key: "GRAB",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Grab",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "-2",
                effects: "Grab Two Limbs; can Squeeze, Slam, or Throw",
                attack: true,
            },
        },
        {
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "-2",
                effects: "Grab Two Limbs; can Squeeze or Throw",
                attack: true,
            },
        },
    );
    addPower(
        {
            key: "GRABBY",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Grab By",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-3",
                dcv: "-4",
                effects: "Move and Grab object, +(v/10) to STR",
                attack: true,
            },
        },
        {
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-3",
                dcv: "-4",
                effects: "Move and Grab object, +(v/5) to STR",
                attack: true,
            },
        },
    );

    addPower(
        {
            key: "HAYMAKER",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Haymaker",
            duration: "instant",
            range: "no range",
            costEnd: false,
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 *",
                ocv: "+0",
                dcv: "-5",
                effects: "+4 Damage Classes to any attack",
                attack: false,
            },
        },
        {},
    );
    addPower(
        {
            key: "HIPSHOT",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Hipshot",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "+0",
                effects: "+1 DEX only for purposes of initiative",
                attack: true,
            },
        },
        {},
    );
    addPower(undefined, {
        key: "HURRY",
        type: ["maneuver"],
        behaviors: ["non-hd", "optional-maneuver"],
        name: "Hurry",
        perceivability: "obvious",
        duration: "instant",
        range: "self",
        costEnd: false,
        target: "target's dcv",
        ignoreFor: ["base2", "computer", "ai"],
        maneuverDesc: {
            phase: "1/2",
            ocv: "-2",
            dcv: "-2",
            effects: "+1d6 DEX only for purposes of initiative",
            attack: false,
        },
    });

    addPower(
        {
            key: "MOVEBY",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Move By",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-2",
                dcv: "-2",
                effects: "((STR/2) + (v/10))d6; attacker takes ⅓ damage",
                attack: true,
            },
        },
        {
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-2",
                dcv: "-2",
                effects: "((STR/2) + (v/5))d6; attacker takes ⅓ damage",
                attack: true,
            },
        },
    );
    addPower(
        {
            key: "MOVETHROUGH",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Move Through",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-v/10",
                dcv: "-3",
                effects: "(STR + (v/6))d6; attacker takes ½ or full damage",
                attack: true,
            },
        },
        {
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-v/5",
                dcv: "-3",
                effects: "(STR + (v/3))d6; attacker takes ½ or full damage",
                attack: true,
            },
        },
    );
    addPower(
        {
            key: "MULTIPLEATTACK",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Multiple Attack",
            perceivability: "obvious",
            duration: "instant",
            range: "no range", // TODO: Not correct for all possible
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1",
                ocv: "var",
                dcv: "1/2",
                effects: "Attack one or more targets multiple times",
                attack: true,
            },
        },
        undefined,
    );

    addPower(
        {
            key: "OTHERATTACKS",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Other Attacks",
            perceivability: "obvious",
            duration: "instant",
            range: "no range", // TODO: Not correct for all possible.
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "For unlisted attacks",
                attack: true,
            },
        },
        undefined,
    );

    addPower(
        {
            key: "PULLINGAPUNCH",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Pulling A Punch",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1/5d6",
                dcv: "+0",
                effects: "Strike, normal STUN damage, ½ BODY damage",
                attack: true,
            },
        },
        {},
    );

    addPower(undefined, {
        key: "RAPIDFIRE",
        type: ["maneuver"],
        behaviors: ["non-hd", "optional-maneuver"],
        name: "Rapid Fire",
        perceivability: "obvious",
        duration: "instant",
        range: "no range", // TODO: Not correct for all
        costEnd: false,
        target: "target's dcv",
        ignoreFor: ["base2", "computer", "ai"],
        maneuverDesc: {
            phase: "1",
            ocv: "-1/x",
            dcv: "+x1/2",
            effects: "Strike, normal STUN damage, ½ BODY damage",
            attack: true,
        },
    });
    addPower(
        {
            key: "ROLLWITHAPUNCH",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Roll With A Punch",
            perceivability: "obvious",
            duration: "instant",
            range: "self",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "-2",
                effects: "Block after being hit, take ½ damage; Abort",
                attack: true,
            },
        },
        {},
    );

    addPower(
        {
            key: "SET",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Set",
            perceivability: "obvious",
            duration: "instant",
            range: "self",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1",
                ocv: "+1",
                dcv: "+0",
                effects: "Take extra time to aim a Ranged attack at a target",
                attack: false,
            },
        },
        {},
    );
    addPower(
        {
            key: "SETANDBRACE",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Set And Brace",
            perceivability: "obvious",
            duration: "instant",
            range: "self",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1",
                ocv: "+3",
                dcv: "1/2",
                effects:
                    "Take extra time to aim a Ranged attack at a target, +2 OCV only to offset the Range Modifier",
                attack: false,
            },
        },
        {},
    );
    addPower(
        {
            key: "SHOVE",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Shove",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "-1",
                effects: "Push target back 1m per 5 STR used",
                attack: true,
            },
        },
        undefined,
    );
    addPower(
        {
            key: "SNAPSHOT",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Snap Shot",
            perceivability: "obvious",
            duration: "instant",
            range: "standard",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1",
                ocv: "-1",
                dcv: "+0",
                effects: "Lets character duck back behind cover",
                attack: true,
            },
        },
        {},
    );
    addPower(
        {
            key: "STRAFE",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Strafe",
            perceivability: "obvious",
            duration: "instant",
            range: "standard",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2 †",
                ocv: "-v/6",
                dcv: "-2",
                effects: "Make Ranged attack while moving",
                attack: true,
            },
        },
        undefined,
    );
    addPower(
        {
            key: "STRIKE",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Strike",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "STR damage or by weapon type",
                attack: true,
            },
        },
        {},
    );
    addPower(
        {
            key: "SUPPRESSIONFIRE",
            type: ["maneuver"],
            behaviors: ["non-hd", "optional-maneuver"],
            name: "Suppression Fire",
            perceivability: "obvious",
            duration: "instant",
            range: "standard",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "+0",
                effects: "Continuous fire through an area, must be Autofire",
                attack: true,
            },
        },
        {
            maneuverDesc: {
                phase: "1/2",
                ocv: "-2",
                dcv: "+0",
                effects: "Continuous fire on hex(es), must be Autofire",
                attack: true,
            },
        },
    );
    addPower(undefined, {
        key: "SWEEP",
        type: ["maneuver"],
        behaviors: ["non-hd", "optional-maneuver"],
        name: "Sweep",
        perceivability: "obvious",
        duration: "instant",
        range: "no range",
        costEnd: false,
        target: "target's dcv",
        ignoreFor: ["base2", "computer", "ai"],
        maneuverDesc: {
            phase: "1",
            ocv: "-2/x",
            dcv: "x1/2",
            effects: "Make multiple HTH attacks",
            attack: true,
        },
    });

    addPower(
        {
            key: "THROW",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Throw",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "+0",
                dcv: "+0",
                effects: "Throw object or character, does STR damage",
                attack: true,
            },
        },
        undefined,
    );
    addPower(
        {
            key: "TRIP",
            type: ["maneuver"],
            behaviors: ["non-hd"],
            name: "Trip",
            perceivability: "obvious",
            duration: "instant",
            range: "no range",
            costEnd: false,
            target: "target's dcv",
            ignoreFor: ["base2", "computer", "ai"],
            maneuverDesc: {
                phase: "1/2",
                ocv: "-1",
                dcv: "-2",
                effects: "Knock a target to the ground, making him Prone",
                attack: true,
            },
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
            range: "self",
            costEnd: true,
            costPerLevel: 20,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="EXTRADIMENSIONALMOVEMENT" ID="1709333909749" BASECOST="20.0" LEVELS="0" ALIAS="Extra-Dimensional Movement" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Dimension" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
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
            range: "self",
            costEnd: true,
            costPerLevel: 1,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="FLIGHT" ID="1709333921734" BASECOST="0.0" LEVELS="1" ALIAS="Flight" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            costPerLevel: 2,
        },
    );
    addPower(
        {
            key: "FTL",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 2,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="FTL" ID="1712026014674" BASECOST="10.0" LEVELS="0" ALIAS="Faster-Than-Light Travel" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(undefined, {
        key: "GLIDING",
        type: ["movement"],
        behaviors: ["activatable"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 1,
        ignoreFor: ["base2", "computer", "ai"],
        xml: `<POWER XMLID="GLIDING" ID="1709342639684" BASECOST="0.0" LEVELS="1" ALIAS="Gliding" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
    });

    addPower(
        {
            key: "LEAPING",
            name: "Leaping",
            base: 4,
            costPerLevel: 1 / 2,
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<LEAPING XMLID="LEAPING" ID="1709333946167" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="55" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"><NOTES/></LEAPING>`,
        },
        {
            base: 2,
            costPerLevel: 1,
        },
    );

    addPower(
        {
            key: "RUNNING",
            base: 12,
            costPerLevel: 1,
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<RUNNING XMLID="RUNNING" ID="1709334005554" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="72" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"><NOTES/></RUNNING>`,
        },
        {
            base: 6,
            costPerLevel: 2,
        },
    );

    addPower(
        {
            key: "SWIMMING",
            base: 4,
            costPerLevel: 1 / 2,
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<SWIMMING XMLID="SWIMMING" ID="1709334019357" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="77" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No"><NOTES/></SWIMMING>`,
        },
        {
            base: 2,
            costPerLevel: 1,
        },
    );
    addPower(
        {
            key: "SWINGING",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 0.5,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="SWINGING" ID="1709334021575" BASECOST="0.0" LEVELS="1" ALIAS="Swinging" POSITION="78" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            costPerLevel: 1,
        },
    );

    addPower(
        {
            key: "TELEPORTATION",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "instant",
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 1,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="TELEPORTATION" ID="1709334031905" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation" POSITION="81" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            costPerLevel: 2,
        },
    );
    addPower(
        {
            key: "TUNNELING",
            type: ["movement"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 1,
            ignoreFor: ["base2", "computer", "ai"],
            xml: `<POWER XMLID="TUNNELING" ID="1709334041436" BASECOST="2.0" LEVELS="1" ALIAS="Tunneling" POSITION="85" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            costPerLevel: 5,
        },
    );
})();

(function addSkillsToPowerList() {
    addPower(
        {
            key: "ACROBATICS",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="ACROBATICS" BASECOST="3.0" LEVELS="0" ALIAS="Acrobatics" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "ACTING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="ACTING" ID="1709161468976" BASECOST="3.0" LEVELS="0" ALIAS="Acting" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "ANALYZE",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="ANALYZE" ID="1709161469684" BASECOST="3.0" LEVELS="0" ALIAS="Analyze" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Agility Skills" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "ANIMAL_HANDLER",
            type: ["skill"],
            behaviors: ["success"],
            categorized: true,
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="ANIMAL_HANDLER" ID="1709161473096" BASECOST="0.0" LEVELS="0" ALIAS="Animal Handler" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "ARMORSMITH",
        type: ["skill"],
        behaviors: ["success"],
        categorized: true,
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(
        {
            key: "AUTOFIRE_SKILLS",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="AUTOFIRE_SKILLS" ID="1709161475889" BASECOST="5.0" LEVELS="0" ALIAS="Autofire Skills" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ACCURATE" OPTIONID="ACCURATE" OPTION_ALIAS="Accurate Sprayfire" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "BREAKFALL",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            //costPerLevel: 1,
            costEnd: false,
            xml: `<SKILL XMLID="BREAKFALL" ID="1709161478362" BASECOST="3.0" LEVELS="0" ALIAS="Breakfall" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "BRIBERY",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="BRIBERY" ID="1709161479206" BASECOST="3.0" LEVELS="0" ALIAS="Bribery" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "BUGGING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="BUGGING" ID="1709161479965" BASECOST="3.0" LEVELS="0" ALIAS="Bugging" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "BUREAUCRATICS",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="BUREAUCRATICS" ID="1709161480723" BASECOST="3.0" LEVELS="0" ALIAS="Bureaucratics" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "CHARM",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CHARM" ID="1709161481624" BASECOST="3.0" LEVELS="0" ALIAS="Charm" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        undefined,
    );
    addPower(
        {
            key: "CLIMBING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CLIMBING" ID="1709161482605" BASECOST="3.0" LEVELS="0" ALIAS="Climbing" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "COMBAT_DRIVING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="COMBAT_DRIVING" ID="1709161483399" BASECOST="3.0" LEVELS="0" ALIAS="Combat Driving" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
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
            range: "self",
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
                            `Unknown 6e combat levels ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
                        );
                        return 0;
                }
            },
            xml: `<SKILL XMLID="COMBAT_LEVELS" ID="1709161485197" BASECOST="0.0" LEVELS="1" ALIAS="Combat Skill Levels" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="with any single attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
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
                            `Unknown 5e combat level type ${item.system.OPTIONID} for ${item.actor.name}/${item.name}`,
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
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="COMBAT_PILOTING" ID="1709161484209" BASECOST="3.0" LEVELS="0" ALIAS="Combat Piloting" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "COMPUTER_PROGRAMMING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="COMPUTER_PROGRAMMING" ID="1709161488163" BASECOST="3.0" LEVELS="0" ALIAS="Computer Programming" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CONCEALMENT",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CONCEALMENT" ID="1709161490757" BASECOST="3.0" LEVELS="0" ALIAS="Concealment" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CONTORTIONIST",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CONTORTIONIST" ID="1709161491534" BASECOST="3.0" LEVELS="0" ALIAS="Contortionist" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CONVERSATION",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CONVERSATION" ID="1709161492343" BASECOST="3.0" LEVELS="0" ALIAS="Conversation" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CRAMMING",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CRAMMING" ID="1709161493162" BASECOST="5.0" LEVELS="0" ALIAS="Cramming" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CRIMINOLOGY",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CRIMINOLOGY" ID="1709161494054" BASECOST="3.0" LEVELS="0" ALIAS="Criminology" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CRYPTOGRAPHY",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CRYPTOGRAPHY" ID="1709161496416" BASECOST="3.0" LEVELS="0" ALIAS="Cryptography" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOMSKILL",
            type: ["skill"],
            behaviors: [],
            costPerLevel: 1,
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="CUSTOMSKILL" ID="1709161497972" BASECOST="0.0" LEVELS="1" ALIAS="Custom Skill" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" ROLL="0"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "DEDUCTION",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="DEDUCTION" ID="1709161500786" BASECOST="3.0" LEVELS="0" ALIAS="Deduction" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "DEFENSE_MANEUVER",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="DEFENSE_MANEUVER" ID="1709161501659" BASECOST="3.0" LEVELS="0" ALIAS="Defense Maneuver" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="I" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "DEMOLITIONS",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="DEMOLITIONS" ID="1709161503996" BASECOST="3.0" LEVELS="0" ALIAS="Demolitions" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "DISGUISE",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="DISGUISE" ID="1709161504988" BASECOST="3.0" LEVELS="0" ALIAS="Disguise" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "ELECTRONICS",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="ELECTRONICS" ID="1709161505775" BASECOST="3.0" LEVELS="0" ALIAS="Electronics" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "FAST_DRAW",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="FAST_DRAW" ID="1709161506592" BASECOST="3.0" LEVELS="0" ALIAS="Fast Draw" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "FEINT",
        type: ["skill"],
        behaviors: ["success"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(
        {
            key: "FORENSIC_MEDICINE",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="FORENSIC_MEDICINE" ID="1709161509009" BASECOST="3.0" LEVELS="0" ALIAS="Forensic Medicine" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "FORGERY",
            type: ["skill"],
            behaviors: ["success"],
            categorized: true,
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="FORGERY" ID="1709161509923" BASECOST="0.0" LEVELS="0" ALIAS="Forgery" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "GAMBLING",
            type: ["skill"],
            behaviors: ["success"],
            categorized: true,
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="GAMBLING" ID="1709161511974" BASECOST="0.0" LEVELS="0" ALIAS="Gambling" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "HIGH_SOCIETY",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="HIGH_SOCIETY" ID="1709161513798" BASECOST="3.0" LEVELS="0" ALIAS="High Society" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "HOIST",
        type: ["skill"],
        behaviors: ["success"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });

    addPower(undefined, {
        key: "INSTRUCTOR",
        type: ["skill"],
        behaviors: ["success"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(
        {
            key: "INTERROGATION",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="INTERROGATION" ID="1709161516272" BASECOST="3.0" LEVELS="0" ALIAS="Interrogation" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "INVENTOR",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="INVENTOR" ID="1709161517097" BASECOST="3.0" LEVELS="0" ALIAS="Inventor" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
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
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<SKILL XMLID="KNOWLEDGE_SKILL" ID="1709161518105" BASECOST="2.0" LEVELS="0" ALIAS="KS" POSITION="34" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "LANGUAGES",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="LANGUAGES" ID="1709161520791" BASECOST="1.0" LEVELS="0" ALIAS="Language" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASIC" OPTIONID="BASIC" OPTION_ALIAS="basic conversation" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FAMILIARITY="No" PROFICIENCY="No" NATIVE_TONGUE="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "LIPREADING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="LIPREADING" ID="1709161523279" BASECOST="3.0" LEVELS="0" ALIAS="Lipreading" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "LOCKPICKING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="LOCKPICKING" ID="1709161524481" BASECOST="3.0" LEVELS="0" ALIAS="Lockpicking" POSITION="37" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "MECHANICS",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="MECHANICS" ID="1709161525362" BASECOST="3.0" LEVELS="0" ALIAS="Mechanics" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
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
            range: "self",
            costEnd: false,
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
                        OPTIONID: "ALL",
                        OPTION: "ALL",
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
            xml: `<SKILL XMLID="MENTAL_COMBAT_LEVELS" ID="1709161526214" BASECOST="0.0" LEVELS="1" ALIAS="Mental Combat Skill Levels" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="with a single Mental Power" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
        },
        undefined,
    );
    addPower(
        {
            key: "MIMICRY",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="MIMICRY" ID="1709161528926" BASECOST="3.0" LEVELS="0" ALIAS="Mimicry" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "MIF",
            type: ["skill"],
            behaviors: [],
            name: "Musical Instrument Familiarity",
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );

    addPower(
        {
            key: "NAVIGATION",
            type: ["skill"],
            behaviors: ["success"],
            categorized: true,
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="NAVIGATION" ID="1709161529843" BASECOST="0.0" LEVELS="0" ALIAS="Navigation" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "NEGATIVECOMBATSKILLLEVELS",
        type: ["skill"],
        behaviors: [],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(undefined, {
        key: "NEGATIVEPENALTYSKILLLEVELS",
        type: ["skill"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
        behaviors: [],
    });
    addPower(undefined, {
        key: "NEGATIVESKILLLEVELS",
        type: ["skill"],
        behaviors: [],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });

    addPower(
        {
            key: "ORATORY",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="ORATORY" ID="1709161532182" BASECOST="3.0" LEVELS="0" ALIAS="Oratory" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(undefined, {
        key: "PARACHUTING",
        type: ["skill"],
        behaviors: ["success"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(
        {
            key: "PARAMEDICS",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="PARAMEDICS" ID="1709161533283" BASECOST="3.0" LEVELS="0" ALIAS="Paramedics" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
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
            range: "self",
            costEnd: false,
            editOptions: {
                showAttacks: true,
                editableOption_ALIAS: true,
                choices: [
                    {
                        OPTIONID: "SINGLE",
                        OPTION: "SINGLE",
                        OPTION_ALIAS:
                            "to offset a specific negative OCV modifier with any single attack",
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
                        OPTION_ALIAS:
                            "to offset a specific negative OCV modifier with all attacks",
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
                        OPTION_ALIAS:
                            "to offset a specific negative DCV modifier imposed by a group of conditions",
                    },
                ],
                penaltyChoices: {
                    hitLocation: "Hit Location",
                    other: "Other",
                    range: "Range",
                },
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
            xml: `<SKILL XMLID="PENALTY_SKILL_LEVELS" ID="1709161534055" BASECOST="0.0" LEVELS="1" ALIAS="Penalty Skill Levels" POSITION="44" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="to offset a specific negative OCV modifier with any single attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
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
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "PERSUASION",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "POISONING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "POWERSKILL",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="POWERSKILL" ID="1709161537007" BASECOST="3.0" LEVELS="0" ALIAS="Power" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "PROFESSIONAL_SKILL",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<SKILL XMLID="PROFESSIONAL_SKILL" ID="1709161539381" BASECOST="2.0" LEVELS="0" ALIAS="PS" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "RAPID_ATTACK_HTH",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="RAPID_ATTACK_HTH" ID="1709161541446" BASECOST="10.0" LEVELS="0" ALIAS="Rapid Attack" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "RAPID_ATTACK_RANGED",
        type: ["skill"],
        behaviors: [],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(undefined, {
        key: "RESEARCH",
        type: ["skill"],
        behaviors: ["success"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(
        {
            key: "RIDING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="RIDING" ID="1709161542264" BASECOST="3.0" LEVELS="0" ALIAS="Riding" POSITION="48" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "SCIENCE_SKILL",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<SKILL XMLID="SCIENCE_SKILL" ID="1709161543124" BASECOST="2.0" LEVELS="0" ALIAS="Science Skill" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "SECURITY_SYSTEMS",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="SECURITY_SYSTEMS" ID="1709161545330" BASECOST="3.0" LEVELS="0" ALIAS="Security Systems" POSITION="50" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SEDUCTION",
        type: ["skill"],
        behaviors: ["success"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(
        {
            key: "SHADOWING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="SHADOWING" ID="1709161547363" BASECOST="3.0" LEVELS="0" ALIAS="Shadowing" POSITION="51" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
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
            range: "self",
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
            xml: `<SKILL XMLID="SKILL_LEVELS" ID="1709161548219" BASECOST="0.0" LEVELS="1" ALIAS="Skill Levels" POSITION="52" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CHARACTERISTIC" OPTIONID="CHARACTERISTIC" OPTION_ALIAS="with single Skill or Characteristic Roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
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
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="SLEIGHT_OF_HAND" ID="1709161550467" BASECOST="3.0" LEVELS="0" ALIAS="Sleight Of Hand" POSITION="53" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SPELL",
        type: ["skill"],
        behaviors: ["success"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });
    addPower(
        {
            key: "STEALTH",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="STEALTH" ID="1709161551292" BASECOST="3.0" LEVELS="0" ALIAS="Stealth" POSITION="54" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "STREETWISE",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="STREETWISE" ID="1709161552070" BASECOST="3.0" LEVELS="0" ALIAS="Streetwise" POSITION="55" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "SURVIVAL",
            type: ["skill"],
            behaviors: ["success"],
            categorized: true,
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="SURVIVAL" ID="1709161552845" BASECOST="0.0" LEVELS="0" ALIAS="Survival" POSITION="56" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "SYSTEMS_OPERATION",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="SYSTEMS_OPERATION" ID="1709161555044" BASECOST="3.0" LEVELS="0" ALIAS="Systems Operation" POSITION="57" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "TACTICS",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="TACTICS" ID="1709161557125" BASECOST="3.0" LEVELS="0" ALIAS="Tactics" POSITION="58" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "TEAMWORK",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="TEAMWORK" ID="1709161558462" BASECOST="3.0" LEVELS="0" ALIAS="Teamwork" POSITION="59" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "TRACKING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="TRACKING" ID="1709161559355" BASECOST="3.0" LEVELS="0" ALIAS="Tracking" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "TRADING",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="TRADING" ID="1709161560240" BASECOST="3.0" LEVELS="0" ALIAS="Trading" POSITION="61" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="PRE" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "TRANSPORT_FAMILIARITY",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            editOptions: {
                hideLEVELS: true,
            },
        },
        {},
    );
    addPower(
        {
            key: "TWO_WEAPON_FIGHTING_HTH",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
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
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
    });

    addPower(
        {
            key: "VENTRILOQUISM",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="VENTRILOQUISM" ID="1709161563244" BASECOST="3.0" LEVELS="0" ALIAS="Ventriloquism" POSITION="63" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "WEAPON_FAMILIARITY",
            type: ["skill"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<SKILL XMLID="WEAPON_FAMILIARITY" ID="1709161564246" BASECOST="0.0" LEVELS="0" ALIAS="WF" POSITION="64" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No"><NOTES/></SKILL>`,
        },
        {},
    );
    addPower(
        {
            key: "WEAPONSMITH",
            type: ["skill"],
            behaviors: ["success"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            categorized: true,
            xml: `<SKILL XMLID="WEAPONSMITH" ID="1709161565889" BASECOST="0.0" LEVELS="0" ALIAS="Weaponsmith" POSITION="65" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No"><NOTES/></SKILL>`,
        },
        {},
    );

    addPower(
        {
            key: "JACK_OF_ALL_TRADES",
            type: ["skill", "enhancer"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "LINGUIST",
            type: ["skill", "enhancer"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "SCHOLAR",
            type: ["skill", "enhancer"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "SCIENTIST",
            type: ["skill", "enhancer"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
        },
        {},
    );
    addPower(
        {
            key: "TRAVELER",
            type: ["skill", "enhancer"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
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
            costEnd: false,
        },
        {},
    );

    addPower(
        {
            key: "DIFFERINGMODIFIER",
            name: "Differing Modifier",
            type: ["framework"],
            behaviors: [],
            costEnd: false,
        },
        {},
    );

    addPower(undefined, {
        key: "ELEMENTAL_CONTROL",
        type: ["framework"],
        behaviors: [],
        costEnd: false,
    });

    addPower(
        {
            key: "LIST",
            type: ["framework"],
            behaviors: [],
            costEnd: false,
        },
        {},
    );

    addPower(
        {
            key: "MULTIPOWER",
            type: ["framework"],
            behaviors: [],
            costEnd: false,
        },
        {},
    );

    addPower(
        {
            key: "VPP",
            type: ["framework"],
            behaviors: [],
            costEnd: false,
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
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<PERK XMLID="ACCESS" ID="1709161411911" BASECOST="0.0" LEVELS="3" ALIAS="Access" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></PERK>`,
        },
        {},
    );
    addPower(undefined, {
        key: "Advanced Tech",
        type: ["perk"],
        behaviors: [],
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: function (item) {
            if (item.system.OPTIONID === "NORMAL") {
                return 15;
            } else {
                return 10;
            }
        },
        xml: `<PERK XMLID="Advanced Tech" ID="1709164896663" BASECOST="0.0" LEVELS="1" ALIAS="Advanced Tech" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NORMAL" OPTIONID="NORMAL" OPTION_ALIAS="15 pts / Level" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></PERK>`,
    });
    addPower(
        {
            key: "ANONYMITY",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<PERK XMLID="ANONYMITY" ID="1709161415388" BASECOST="3.0" LEVELS="0" ALIAS="Anonymity" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "COMPUTER_LINK",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<PERK XMLID="COMPUTER_LINK" ID="1709161418315" BASECOST="3.0" LEVELS="0" ALIAS="Computer Link" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "CONTACT",
            type: ["perk"],
            behaviors: ["success"],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
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
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<PERK XMLID="CUSTOMPERK" ID="1709161423608" BASECOST="0.0" LEVELS="1" ALIAS="Custom Perk" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" ROLL="0"><NOTES/></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "DEEP_COVER",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<PERK XMLID="DEEP_COVER" ID="1709161426121" BASECOST="2.0" LEVELS="0" ALIAS="Deep Cover" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></PERK>`,
        },
        {},
    );

    addPower(undefined, {
        key: "FALSEIDENTITY",
        type: ["perk"],
        behaviors: [],
        name: "False Identity",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 1,
        xml: `<PERK XMLID="FALSEIDENTITY" ID="1709164911446" BASECOST="1.0" LEVELS="0" ALIAS="False Identity" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></PERK>`,
    });
    addPower(
        {
            key: "FAVOR",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<PERK XMLID="FAVOR" ID="1709161428760" BASECOST="1.0" LEVELS="0" ALIAS="Favor" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1710994081842" NAME=""><NOTES/></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "FOLLOWER",
            type: ["perk"],
            behaviors: [],
            name: "Follower",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<PERK XMLID="FOLLOWER" ID="1709161431234" BASECOST="0.0" LEVELS="0" ALIAS="Follower" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" NUMBER="1" BASEPOINTS="0" DISADPOINTS="0"><NOTES/></PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "FRINGE_BENEFIT",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<PERK XMLID="FRINGE_BENEFIT" ID="1712005548112" BASECOST="0.0" LEVELS="0" ALIAS="Fringe Benefit" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "MONEY",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<PERK XMLID="MONEY" ID="1709161436493" BASECOST="5.0" LEVELS="0" ALIAS="Money" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="WELL_OFF" OPTIONID="WELL_OFF" OPTION_ALIAS="Well Off" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></PERK>`,
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
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<PERK XMLID="REPUTATION" ID="1709161449527" BASECOST="0.0" LEVELS="1" ALIAS="Positive Reputation" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
            <NOTES />
            <ADDER XMLID="HOWWIDE" ID="1709161582270" BASECOST="0.0" LEVELS="0" ALIAS="How Widely Known" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SMALLGROUP" OPTIONID="SMALLGROUP" OPTION_ALIAS="A small to medium sized group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
            <ADDER XMLID="HOWWELL" ID="1709161582276" BASECOST="-1.0" LEVELS="0" ALIAS="How Well Known" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
              <NOTES />
            </ADDER>
          </PERK>`,
        },
        {},
    );
    addPower(
        {
            key: "RESOURCE_POOL",
            type: ["perk"],
            behaviors: [],
            name: "Resource Points",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<PERK XMLID="RESOURCE_POOL" ID="1709161452229" BASECOST="0.0" LEVELS="0" ALIAS="Resource Points" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EQUIPMENT" OPTIONID="EQUIPMENT" OPTION_ALIAS="Equipment Points" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" FREE_POINTS="0"><NOTES/></PERK>`,
        },
        {},
    );

    addPower(
        {
            key: "VEHICLE_BASE",
            type: ["perk"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<PERK XMLID="VEHICLE_BASE" ID="1709161454715" BASECOST="0.0" LEVELS="0" ALIAS="Vehicles &amp; Bases" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" NUMBER="2" BASEPOINTS="4" DISADPOINTS="0"><NOTES/></PERK>`,
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
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<TALENT XMLID="ABSOLUTE_RANGE_SENSE" ID="1709159935812" BASECOST="3.0" LEVELS="0" ALIAS="Absolute Range Sense" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "ABSOLUTE_TIME_SENSE",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<TALENT XMLID="ABSOLUTE_TIME_SENSE" ID="1709159936859" BASECOST="3.0" LEVELS="0" ALIAS="Absolute Time Sense" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "AMBIDEXTERITY",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<TALENT XMLID="AMBIDEXTERITY" ID="1709159937654" BASECOST="1.0" LEVELS="0" ALIAS="Ambidexterity" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LEVEL1" OPTIONID="LEVEL1" OPTION_ALIAS="-2 Off Hand penalty" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "ANIMALFRIENDSHIP",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<TALENT XMLID="ANIMALFRIENDSHIP" ID="1709159938402" BASECOST="20.0" LEVELS="0" ALIAS="Animal Friendship" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
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
        range: "no range",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="BEASTSPEECH" ID="1709164944911" BASECOST="15.0" LEVELS="0" ALIAS="Beast Speech" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "BERSERKFURY",
        type: ["talent"],
        behaviors: [],
        name: "Berserk Fury",
        duration: "instant",
        target: "self only",
        range: "self",
        costEnd: true,
        costPerLevel: 0,
        xml: `<TALENT XMLID="BERSERKFURY" ID="1709164947152" BASECOST="16.0" LEVELS="0" ALIAS="Berserk Fury" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "BUMP_OF_DIRECTION",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<TALENT XMLID="BUMP_OF_DIRECTION" ID="1709159939134" BASECOST="3.0" LEVELS="0" ALIAS="Bump Of Direction" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "COMBATARCHERY",
        type: ["talent"],
        behaviors: [],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
        name: "Combat Archery",
        xml: `<TALENT XMLID="COMBATARCHERY" ID="1709164949036" BASECOST="8.0" LEVELS="0" ALIAS="Combat Archery" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "COMBAT_LUCK",
            type: ["talent"],
            behaviors: ["activatable"],
            name: "Combat Luck",
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 6,
            xml: `<TALENT XMLID="COMBAT_LUCK" ID="1709159939839" BASECOST="0.0" LEVELS="1" ALIAS="Combat Luck (3 PD/3 ED)" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "COMBATREADY",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: "self",
        costEnd: false,
        xml: `<TALENT XMLID="COMBATREADY" ID="1709164954018" BASECOST="3.0" LEVELS="0" ALIAS="Combat Ready" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "COMBAT_SENSE",
            type: ["talent"],
            behaviors: ["success"],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<TALENT XMLID="COMBAT_SENSE" ID="1712005986871" BASECOST="15.0" LEVELS="0" ALIAS="Combat Sense" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="INT"><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "COMBATSHOOTING",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: "self",
        costEnd: false,
        xml: `<TALENT XMLID="COMBATSHOOTING" ID="1709164957755" BASECOST="8.0" LEVELS="0" ALIAS="Combat Shooting" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "COMBATSPELLCASTING",
        type: ["talent"],
        behaviors: [],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
        xml: `<TALENT XMLID="COMBATSPELLCASTING" ID="1709164958686" BASECOST="6.0" LEVELS="0" ALIAS="Combat Spellcasting" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="[single spell]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "CRIPPLINGBLOW",
        type: ["talent"],
        behaviors: [],
        duration: "instant",
        target: "target's dcv",
        range: "no range",
        costEnd: false,
        xml: `<TALENT XMLID="CRIPPLINGBLOW" ID="1709164962720" BASECOST="16.0" LEVELS="0" ALIAS="Crippling Blow" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "CUSTOMTALENT",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<TALENT XMLID="CUSTOMTALENT" ID="1709159957885" BASECOST="0.0" LEVELS="5" ALIAS="Custom Talent" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" ROLL="11"><NOTES/></TALENT>`,
        },
        {},
    );

    addPower(
        {
            key: "DANGER_SENSE",
            type: ["talent"],
            behaviors: ["success"],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<TALENT XMLID="DANGER_SENSE" ID="1712006288952" BASECOST="15.0" LEVELS="0" ALIAS="Danger Sense" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
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
            range: "self",
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
            xml: `<TALENT XMLID="DEADLYBLOW" ID="1709159979031" BASECOST="0.0" LEVELS="2" ALIAS="Deadly Blow:  +2d6" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYLIMITED" OPTIONID="VERYLIMITED" OPTION_ALIAS="[very limited circumstances]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "DIVINEFAVOR",
        type: ["talent"],
        behaviors: [],
        duration: "persistent",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="DIVINEFAVOR" ID="1709164973071" BASECOST="10.0" LEVELS="0" ALIAS="Divine Favor" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "DOUBLE_JOINTED",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<TALENT XMLID="DOUBLE_JOINTED" ID="1709159984537" BASECOST="4.0" LEVELS="0" ALIAS="Double Jointed" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );

    addPower(
        {
            key: "EIDETIC_MEMORY",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<TALENT XMLID="EIDETIC_MEMORY" ID="1709159985473" BASECOST="5.0" LEVELS="0" ALIAS="Eidetic Memory" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "ENVIRONMENTAL_MOVEMENT",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<TALENT XMLID="ENVIRONMENTAL_MOVEMENT" ID="1709159986372" BASECOST="3.0" LEVELS="0" ALIAS="Environmental Movement" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="no penalties on"><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "EVASIVE",
        type: ["talent"],
        behaviors: [],
        duration: "instant",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="EVASIVE" ID="1709164979197" BASECOST="18.0" LEVELS="0" ALIAS="Evasive" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });

    addPower(undefined, {
        key: "FTLPILOT",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="FTLPILOT" ID="1709164980297" BASECOST="4.0" LEVELS="0" ALIAS="FTL Pilot" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "FASCINATION",
        type: ["talent"],
        behaviors: [],
        duration: "persistent",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="FASCINATION" ID="1709164981287" BASECOST="10.0" LEVELS="0" ALIAS="Fascination" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "FEARLESS",
        type: ["talent"],
        behaviors: [],
        duration: "persistent",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="FEARLESS" ID="1709164983473" BASECOST="14.0" LEVELS="0" ALIAS="Fearless" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "FOLLOWTHROUGHATTACK",
        type: ["talent"],
        behaviors: [],
        duration: "instant",
        target: "target's dcv",
        range: "no range",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="FOLLOWTHROUGHATTACK" ID="1709164984595" BASECOST="10.0" LEVELS="0" ALIAS="Follow-Through Attack" POSITION="27" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });

    addPower(undefined, {
        key: "HOTSHOTPILOT",
        type: ["talent"],
        behaviors: [],
        name: "Hotshot Pilot",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="HOTSHOTPILOT" ID="1709164985624" BASECOST="24.0" LEVELS="0" ALIAS="Hotshot Pilot" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STARHERO" OPTIONID="STARHERO" OPTION_ALIAS="Star Hero" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });

    addPower(undefined, {
        key: "INSPIRE",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="INSPIRE" ID="1709164986910" BASECOST="11.0" LEVELS="0" ALIAS="Inspire" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });

    addPower(undefined, {
        key: "LATENTPSIONIC",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="LATENTPSIONIC" ID="1709164987906" BASECOST="5.0" LEVELS="0" ALIAS="Latent Psionic" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "LIGHTNING_CALCULATOR",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<TALENT XMLID="LIGHTNING_CALCULATOR" ID="1709159991424" BASECOST="3.0" LEVELS="0" ALIAS="Lightning Calculator" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(
        {
            key: "LIGHTNING_REFLEXES_ALL",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1709159992355" BASECOST="0.0" LEVELS="1" ALIAS="Lightning Reflexes" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="All Actions" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {
            xml: `<TALENT XMLID="LIGHTNING_REFLEXES_ALL" ID="1709164993726" BASECOST="0.0" LEVELS="2" ALIAS="Lightning Reflexes: +2 DEX to act first with All Actions" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
    );
    addPower(undefined, {
        key: "LIGHTNING_REFLEXES_SINGLE",
        type: ["talent"],
        behaviors: [],
        name: "Lightning Reflexes",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 1,
        xml: `<TALENT XMLID="LIGHTNING_REFLEXES_SINGLE" ID="1709164999711" BASECOST="0.0" LEVELS="1" ALIAS="Lightning Reflexes: +1 DEX to act first with Single Action" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Single Action"><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "LIGHTSLEEP",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<TALENT XMLID="LIGHTSLEEP" ID="1709160000741" BASECOST="3.0" LEVELS="0" ALIAS="Lightsleep" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "MAGESIGHT",
        type: ["talent"],
        behaviors: [],
        duration: "persistent",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="MAGESIGHT" ID="1709165001978" BASECOST="5.0" LEVELS="0" ALIAS="Magesight" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" GROUP="NOGROUP"><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "MOUNTEDWARRIOR",
        type: ["talent"],
        behaviors: [],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="MOUNTEDWARRIOR" ID="1709165004554" BASECOST="4.0" LEVELS="0" ALIAS="Mounted Warrior" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HTH" OPTIONID="HTH" OPTION_ALIAS="HTH Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });

    addPower(
        {
            key: "OFFHANDDEFENSE",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<TALENT XMLID="OFFHANDDEFENSE" ID="1709160002394" BASECOST="2.0" LEVELS="0" ALIAS="Off-Hand Defense" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );

    addPower(
        {
            key: "PERFECT_PITCH",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<TALENT XMLID="PERFECT_PITCH" ID="1709160003293" BASECOST="3.0" LEVELS="0" ALIAS="Perfect Pitch" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "RAPIDARCHERY",
        type: ["talent"],
        behaviors: [],
        duration: "instant",
        target: "self only",
        range: "standard",
        costEnd: false,
        costPerLevel: 1,
        xml: `<TALENT XMLID="RAPIDARCHERY" ID="1709165008178" BASECOST="4.0" LEVELS="0" ALIAS="Rapid Archery" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "RAPIDHEALING",
        type: ["talent"],
        behaviors: [],
        duration: "persistent",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 1,
        xml: `<TALENT XMLID="RAPIDHEALING" ID="1709165009140" BASECOST="5.0" LEVELS="0" ALIAS="Rapid Healing" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "RESISTANCE",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<TALENT XMLID="RESISTANCE" ID="1709160004117" BASECOST="0.0" LEVELS="1" ALIAS="Resistance (+1 to roll)" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );

    addPower(undefined, {
        key: "SHAPECHANGING",
        type: ["talent"],
        behaviors: [],
        duration: "instant",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="SHAPECHANGING" ID="1709165011068" BASECOST="18.0" LEVELS="0" ALIAS="Shapechanging" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="[one pre-defined 300-point form]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "SIMULATE_DEATH",
            type: ["talent"],
            behaviors: ["activatable"],
            duration: "instant",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<TALENT XMLID="SIMULATE_DEATH" ID="1709160004972" BASECOST="3.0" LEVELS="0" ALIAS="Simulate Death" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL"><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SKILLMASTER",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 1,
        xml: `<TALENT XMLID="SKILLMASTER" ID="1709165014218" BASECOST="6.0" LEVELS="0" ALIAS="Skill Master" POSITION="43" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="+3 with [single skill]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "SPEED_READING",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 2,
            xml: `<TALENT XMLID="SPEED_READING" ID="1709160005725" BASECOST="2.0" LEVELS="1" ALIAS="Speed Reading (x10)" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SPELLAUGMENTATION",
        type: ["talent"],
        behaviors: [],
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 2,
        xml: `<TALENT XMLID="SPELLAUGMENTATION" ID="1709165017535" BASECOST="12.0" LEVELS="0" ALIAS="Spell Augmentation" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(
        {
            key: "STRIKING_APPEARANCE",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: function (item) {
                switch (item.system.OPTIONID) {
                    case "ALL":
                        return 3;
                    default:
                        return 2;
                }
            },
            xml: `<TALENT XMLID="STRIKING_APPEARANCE" ID="1709160006516" BASECOST="0.0" LEVELS="1" ALIAS="Striking Appearance" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ALL" OPTIONID="ALL" OPTION_ALIAS="vs. all characters" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        undefined,
    );

    addPower(undefined, {
        key: "TRACKLESSSTRIDE",
        type: ["talent"],
        behaviors: ["activatable"],
        duration: "constant",
        target: "self only",
        range: "self",
        costEnd: true,
        costPerLevel: 0,
        xml: `<TALENT XMLID="TRACKLESSSTRIDE" ID="1709165018596" BASECOST="2.0" LEVELS="0" ALIAS="Trackless Stride" POSITION="46" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
    });
    addPower(undefined, {
        key: "TURNUNDEAD",
        type: ["talent"],
        behaviors: ["activatable"],
        duration: "persistent",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 0,
        xml: `<TALENT XMLID="TURNUNDEAD" ID="1709165019594" BASECOST="12.0" LEVELS="0" ALIAS="Turn Undead (+0 PRE)" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
        <NOTES /></TALENT>`,
    });

    addPower(
        {
            key: "UNIVERSAL_TRANSLATOR",
            type: ["talent"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
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
            range: "self",
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
            xml: `<TALENT XMLID="WEAPON_MASTER" ID="1709160011422" BASECOST="0.0" LEVELS="1" ALIAS="Weapon Master:  +1d6" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYLIMITED" OPTIONID="VERYLIMITED" OPTION_ALIAS="[very limited group]" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></TALENT>`,
        },
        {},
    );

    addPower(
        {
            key: "WELL_CONNECTED",
            type: ["perk", "enhancer"],
            behaviors: [],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<WELL_CONNECTED XMLID="WELL_CONNECTED" ID="1710994081842" BASECOST="3.0" LEVELS="0" ALIAS="Well-Connected" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO"><NOTES/></WELL_CONNECTED>`,
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
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: ` <POWER XMLID="ABSORPTION" ID="1709333775419" BASECOST="0.0" LEVELS="1" ALIAS="Absorption" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ENERGY" OPTIONID="ENERGY" OPTION_ALIAS="energy" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="STR" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            type: ["adjustment", "attack"],
            behaviors: ["activatable", "dice"],
            costPerLevel: 5,
        },
    );
    addPower(
        {
            key: "AID",
            type: ["adjustment", "attack"],
            behaviors: ["attack", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target’s DCV",
            range: "no range",
            costEnd: true,
            costPerLevel: 6,
            xml: `<POWER XMLID="AID" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" USE_END_RESERVE="Yes" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="STR" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            costEnd: false,
            costPerLevel: 10,
        },
    );
    addPower(undefined, {
        key: "ARMOR",
        type: ["defense"],
        behaviors: ["activatable"],
        duration: "persistent",
        target: "self only",
        range: "self",
        costPerLevel: 3 / 2,
        xml: `<POWER XMLID="ARMOR" ID="1709342537943" BASECOST="0.0" LEVELS="0" ALIAS="Armor" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0"><NOTES/></POWER>`,
    });
    addPower(
        {
            key: "AUTOMATON",
            type: ["automaton", "special"],
            behaviors: [],
            perceivability: "inobvious",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<POWER XMLID="AUTOMATON" ID="1709333784244" BASECOST="15.0" LEVELS="0" ALIAS="Automaton" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CANNOTBESTUNNED" OPTIONID="CANNOTBESTUNNED" OPTION_ALIAS="Cannot Be Stunned" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "CHANGEENVIRONMENT",
            type: ["attack"],
            behaviors: ["attack", "dice"],
            perceivability: "obvious",
            duration: "constant",
            target: "Target’s DCV",
            range: "standard",
            costEnd: true,
            costPerLevel: 1,
            xml: `<POWER XMLID="CHANGEENVIRONMENT" ID="1711932803443" BASECOST="0.0" LEVELS="0" ALIAS="Change Environment" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "CLAIRSENTIENCE",
            type: ["sense"],
            behaviors: [],
            duration: "constant",
            range: "standard",
            xml: `<POWER XMLID="CLAIRSENTIENCE" ID="1711932894754" BASECOST="20.0" LEVELS="0" ALIAS="Clairsentience" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
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
            range: "self",
            costEnd: false,
            costPerLevel: 1 / 3,
            xml: `<POWER XMLID="CLINGING" ID="1709333852130" BASECOST="10.0" LEVELS="5" ALIAS="Clinging" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "CUSTOMPOWER",
            type: ["custom", "activatable"],
            behaviors: [],
            target: "self only",
            range: "self",
            xml: `<POWER XMLID="CUSTOMPOWER" ID="1711932960992" BASECOST="1.0" LEVELS="1" ALIAS="Custom Power" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" DOESBODY="No" DOESDAMAGE="No" DOESKNOCKBACK="No" KILLING="No" DEFENSE="NONE" END="Yes" VISIBLE="Yes" RANGE="SELF" DURATION="INSTANT" TARGET="SELFONLY" ENDCOLUMNOUTPUT="" USECUSTOMENDCOLUMN="No"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "DAMAGENEGATION",
            type: ["defense", "special"],
            behaviors: ["activatable"],
            perceivability: "inobvious",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
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
            behaviors: ["activatable"],
            perceivability: "inobvious",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<POWER XMLID="DAMAGEREDUCTION" ID="1709333866040" BASECOST="10.0" LEVELS="0" ALIAS="Damage Reduction" POSITION="28" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LVL25NORMAL" OPTIONID="LVL25NORMAL" OPTION_ALIAS="Damage Reduction, 25%" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Energy" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        undefined,
        {
            key: "DAMAGERESISTANCE",
            type: ["defense"],
            behaviors: ["activatable"],
            //perceivability: "obvious",
            duration: "instant",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1 / 2,
            xml: `<POWER XMLID="DAMAGERESISTANCE" ID="1709342567780" BASECOST="0.0" LEVELS="0" ALIAS="Damage Resistance" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" FDLEVELS="0" POWDLEVELS="0"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DARKNESS",
            type: ["sense-affecting", "attack", "standard"],
            behaviors: ["attack"],
            duration: "constant",
            range: "standard",
            costEnd: true,
            xml: `<POWER XMLID="DARKNESS" ID="1709333868971" BASECOST="0.0" LEVELS="1" ALIAS="Darkness" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DENSITYINCREASE",
            type: ["body-affecting", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 4,
            xml: `<POWER XMLID="DENSITYINCREASE" ID="1709333874268" BASECOST="0.0" LEVELS="1" ALIAS="Density Increase" POSITION="31" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            costPerLevel: 5,
        },
    );
    addPower(
        {
            key: "DESOLIDIFICATION",
            type: ["body-affecting", "standard"],
            behaviors: ["activatable"],
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            xml: `<POWER XMLID="DESOLIDIFICATION" ID="1709333876708" BASECOST="40.0" LEVELS="0" ALIAS="Desolidification" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DISPEL",
            type: ["adjustment", "attack"],
            behaviors: ["attack", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target’s DCV",
            range: "standard",
            costEnd: true,
            costPerLevel: 3,
            xml: `<POWER XMLID="DISPEL" ID="1711933464095" BASECOST="0.0" LEVELS="1" ALIAS="Dispel" POSITION="34" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DOESNOTBLEED",
            type: ["automaton", "special"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "persistent",
            target: "self only",
            range: "self",
            xml: `<POWER XMLID="DOESNOTBLEED" ID="1709333885275" BASECOST="15.0" LEVELS="0" ALIAS="Does Not Bleed" POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DRAIN",
            type: ["adjustment", "attack"],
            behaviors: ["attack", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target’s DCV",
            range: "no range",
            costEnd: true,
            costPerLevel: 10,
            xml: `<POWER XMLID="DRAIN" ID="1711933555522" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "DUPLICATION",
            type: ["body-affecting", "special"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 0.2,
            xml: `<POWER XMLID="DUPLICATION" ID="1711933622430" BASECOST="0.0" LEVELS="0" ALIAS="Duplication" POSITION="37" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" NUMBER="1" POINTS="0"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "EGOATTACK",
            type: ["attack", "mental"],
            behaviors: ["attack", "dice"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "dmcv",
            range: "los",
            costEnd: true,
            costPerLevel: 10,
            xml: `<POWER XMLID="EGOATTACK" ID="1709333954550" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="58" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            xml: `<POWER XMLID="EGOATTACK" ID="1709342586861" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
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
            range: "self",
            costEnd: false,
            costPerLevel: 1 / 4,
            xml: `<POWER XMLID="ENDURANCERESERVE" ID="1712448783608" BASECOST="0.0" LEVELS="0" ALIAS="Endurance Reserve" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            <NOTES />
            <POWER XMLID="ENDURANCERESERVEREC" ID="1712448793952" BASECOST="0.0" LEVELS="1" ALIAS="Recovery" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
              <NOTES />
            </POWER>
          </POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "ENDURANCERESERVEREC",
            type: ["special"],
            behaviors: [],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 2 / 3,
            xml: `<POWER XMLID="ENDURANCERESERVEREC" ID="1713377825229" BASECOST="0.0" LEVELS="1" ALIAS="Recovery" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
            <NOTES />
          </POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "ENERGYBLAST",
            type: ["attack"],
            behaviors: ["attack", "dice"],
            duration: "instant",
            range: "standard",
            costPerLevel: 5,
            costEnd: true,
            xml: `<POWER XMLID="ENERGYBLAST" ID="1709333792635" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            xml: `<POWER XMLID="ENERGYBLAST" ID="1709342600684" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
    );
    addPower(
        {
            key: "ENTANGLE",
            type: ["attack", "standard"],
            behaviors: ["attack", "dice"],
            duration: "instant",
            range: "standard",
            costPerLevel: 10,
            costEnd: true,
            xml: `<POWER XMLID="ENTANGLE" ID="1709342612255" BASECOST="0.0" LEVELS="1" ALIAS="Entangle" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
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
            range: "self",
            costEnd: false,
            costPerLevel: 0,
            xml: `<POWER XMLID="EXTRALIMBS" ID="1709342614933" BASECOST="5.0" LEVELS="1" ALIAS="Extra Limbs" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(undefined, {
        key: "FINDWEAKNESS",
        type: ["sense", "special", "skill"],
        behaviors: ["success"],
        target: "self only",
        range: "self",
        costPerLevel: 5,
        xml: `<POWER XMLID="FINDWEAKNESS" ID="1709342622694" BASECOST="10.0" LEVELS="0" ALIAS="Find Weakness" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="Single Attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
    });
    addPower(
        {
            key: "FIXEDLOCATION",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "instant",
            target: "Target’s DCV",
            range: "standard",
            costEnd: true,
            xml: `<POWER XMLID="FIXEDLOCATION" ID="1709334034085" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation: Fixed Location" POSITION="82" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FLOATINGLOCATION",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "instant",
            target: "Target’s DCV",
            range: "standard",
            costEnd: true,
            xml: `<POWER XMLID="FLOATINGLOCATION" ID="1709334037026" BASECOST="0.0" LEVELS="1" ALIAS="Teleportation: Floating Fixed Location" POSITION="83" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FLASH",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["attack", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "Target’s DCV",
            range: "standard",
            costEnd: true,
            costPerLevel: function (item) {
                console.log(this);
                // FLASH (target group cost 5 per level, non-targeting costs 3 per level)
                if (item?.system?.OPTIONID === "SIGHTGROUP") {
                    // The only targeting group
                    return 5;
                } else {
                    return 3;
                }
            },
            xml: `<POWER XMLID="FLASH" ID="1711933970815" BASECOST="0.0" LEVELS="1" ALIAS="Flash" POSITION="44" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FLASHDEFENSE",
            type: ["defense", "special"],
            behaviors: ["activatable"],
            perceivability: "inobvious",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<POWER XMLID="FLASHDEFENSE" ID="1711933981614" BASECOST="0.0" LEVELS="1" ALIAS="Flash Defense" POSITION="45" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "FORCEFIELD",
            type: ["defense", "standard"],
            behaviors: ["activatable"],
            duration: "persistent",
            perceivability: "inobvious",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1.5,
            xml: `<POWER XMLID="FORCEFIELD" ID="1709334003070" BASECOST="0.0" LEVELS="0" ALIAS="Resistant Protection" POSITION="71" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0"><NOTES/></POWER>`,
        },
        {
            duration: "constant",
            costEnd: true,
            costPerLevel: 1,
            xml: `<POWER XMLID="FORCEFIELD" ID="1709342634480" BASECOST="0.0" LEVELS="0" ALIAS="Force Field" POSITION="29" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0"><NOTES/></POWER>`,
        },
    );
    addPower(
        {
            key: "FORCEWALL",
            type: ["defense", "standard"],
            behaviors: ["attack"],
            duration: "instant",
            range: "standard",
            costEnd: true,
            costPerLevel: 3,
            xml: `<POWER XMLID="FORCEWALL" ID="1711932416775" BASECOST="3.0" LEVELS="0" ALIAS="Barrier" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0" LENGTHLEVELS="0" HEIGHTLEVELS="0" BODYLEVELS="0" WIDTHLEVELS="0.0"><NOTES/></POWER>`,
        },
        {
            duration: "constant",
            costPerLevel: 2.5,
            xml: `<POWER XMLID="FORCEWALL" ID="1709342637180" BASECOST="0.0" LEVELS="0" ALIAS="Force Wall" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="0" MDLEVELS="0" POWDLEVELS="0" LENGTHLEVELS="0" HEIGHTLEVELS="0" BODYLEVELS="0" WIDTHLEVELS="0.0"><NOTES/></POWER>`,
        },
    );

    addPower(
        {
            key: "GROWTH",
            type: ["body-affecting", "size"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 5,
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
            xml: `<POWER XMLID="GROWTH" ID="1711934263926" BASECOST="25.0" LEVELS="0" ALIAS="Growth" POSITION="47" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LARGE" OPTIONID="LARGE" OPTION_ALIAS="Large" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            details: function (item) {
                const result = {
                    str: parseInt(item.system.value) * 5,
                    body: parseInt(item.system.value),
                    stun: parseInt(item.system.value),
                    reach: Math.pow(2, Math.floor(item.system.value / 3)),
                    kb: parseInt(item.system.value),
                    mass:
                        (
                            Math.pow(2, item.system.value) * 100
                        ).toLocaleString() + " kg",
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
            behaviors: ["attack", "dice"],
            duration: "instant",
            range: "no range",
            costEnd: true,
            costPerLevel: 5,
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
            behaviors: ["attack", "dice"],
            perceivability: "obvious",
            duration: "instant",
            target: "target's dcv",
            range: "no range",
            costEnd: true,
            costPerLevel: 10,
            xml: `<POWER XMLID="HEALING" ID="1711934391072" BASECOST="0.0" LEVELS="1" ALIAS="Healing" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "HKA",
            type: ["attack"],
            behaviors: ["attack", "dice"],
            duration: "instant",
            range: "no range",
            costPerLevel: 15,
            costEnd: true,
            xml: `<POWER XMLID="HKA" ID="1711934431692" BASECOST="0.0" LEVELS="1" ALIAS="Killing Attack - Hand-To-Hand" POSITION="52" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "IMAGES",
            type: ["attack", "sense-affecting", "standard"],
            behaviors: ["attack", "dice"],
            perceivability: "obvious",
            duration: "constant",
            target: "area (see text)",
            range: "standard",
            costEnd: true,
            xml: `<POWER XMLID="IMAGES" ID="1711934509070" BASECOST="10.0" LEVELS="0" ALIAS="Images" POSITION="50" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "INVISIBILITY",
            type: ["sense-affecting", "standard"],
            behaviors: ["activatable", "defense"],
            perceivability: "Special",
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            xml: `<POWER XMLID="INVISIBILITY" ID="1711934550291" BASECOST="20.0" LEVELS="0" ALIAS="Invisibility" POSITION="51" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "KBRESISTANCE",
            type: ["defense", "standard"],
            behaviors: ["activatable"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<POWER XMLID="KBRESISTANCE" ID="1709333943639" BASECOST="0.0" LEVELS="1" ALIAS="Knockback Resistance" POSITION="54" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            costPerLevel: 2,
        },
    );

    addPower(undefined, {
        key: "LACKOFWEAKNESS",
        type: ["defense", "special"],
        behaviors: ["activatable"],
        perceivability: "imperceptible",
        duration: "persistent",
        target: "self only",
        range: "self",
        costEnd: false,
        costPerLevel: 1,
        xml: `<POWER XMLID="LACKOFWEAKNESS" ID="1709342664430" BASECOST="0.0" LEVELS="1" ALIAS="Lack Of Weakness" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Mental Defense" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
    });
    addPower(
        {
            key: "LIFESUPPORT",
            type: ["standard"],
            behaviors: ["activatable"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            xml: `<POWER XMLID="LIFESUPPORT" ID="1711934628815" BASECOST="0.0" LEVELS="0" ALIAS="Life Support" POSITION="56" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
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
            range: "self",
            costEnd: false,
            costPerLevel: 5,
            xml: `<POWER XMLID="LUCK" ID="1709333951260" BASECOST="0.0" LEVELS="1" ALIAS="Luck" POSITION="57" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "MENTALDEFENSE",
            type: ["defense", "special"],
            behaviors: ["activatable"],
            perceivability: "imperceptible",
            target: "self only",
            range: "self",
            costEnd: false,
            duration: "persistent",
            costPerLevel: 1,
            xml: `<POWER XMLID="MENTALDEFENSE" ID="1709333957464" BASECOST="0.0" LEVELS="1" ALIAS="Mental Defense" POSITION="59" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MENTALILLUSIONS",
            type: ["attack", "mental"],
            behaviors: ["attack", "dice"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "dmcv",
            range: "los",
            costEnd: true,
            costPerLevel: 5,
            xml: `<POWER XMLID="MENTALILLUSIONS" ID="1709333959742" BASECOST="0.0" LEVELS="1" ALIAS="Mental Illusions" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MINDCONTROL",
            type: ["attack", "mental"],
            behaviors: ["attack", "dice"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "dmcv",
            range: "los",
            costEnd: true,
            costPerLevel: 5,
            xml: `<POWER XMLID="MINDCONTROL" ID="1709333962182" BASECOST="0.0" LEVELS="1" ALIAS="Mind Control" POSITION="61" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MINDLINK",

            type: ["mental"],
            behaviors: ["attack", "activatable", "dice"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "dmcv",
            range: "los",
            costEnd: false,
            costPerLevel: 5,
            xml: `<POWER XMLID="MINDLINK" ID="1709333964463" BASECOST="5.0" LEVELS="0" ALIAS="Mind Link" POSITION="62" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="One Specific Mind" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MINDSCAN",
            type: ["mental", "sense"],
            behaviors: ["attack", "dice"],
            perceivability: "imperceptible",
            duration: "constant",
            target: "dmcv",
            range: "special",
            costEnd: true,
            costPerLevel: 5,
            xml: `<POWER XMLID="MINDSCAN" ID="1709333966801" BASECOST="0.0" LEVELS="1" ALIAS="Mind Scan" POSITION="63" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "MISSILEDEFLECTION",
            type: ["defense", "standard"],
            behaviors: ["attack", "activatable"],
            perceivability: "inobvious",
            duration: "instant",
            target: "target’s OCV",
            range: "standard",
            costEnd: true,
            xml: `<POWER XMLID="MISSILEDEFLECTION" ID="1709333871556" BASECOST="20.0" LEVELS="0" ALIAS="Deflection" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {
            duration: "constant",
            costEnd: false,
            xml: `<POWER XMLID="MISSILEDEFLECTION" ID="1709342687977" BASECOST="5.0" LEVELS="0" ALIAS="Missile Deflection" POSITION="49" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="THROWN" OPTIONID="THROWN" OPTION_ALIAS="Thrown Objects" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
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
            range: "self",
            costEnd: false,
            costPerLevel: 0.2,
            xml: `<POWER XMLID="MULTIFORM" ID="1709333969596" BASECOST="0.0" LEVELS="50" ALIAS="Multiform" POSITION="64" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "NAKEDMODIFIER",
            type: ["special"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 1,
            privateAsAdder: true,
            xml: `<POWER XMLID="NAKEDMODIFIER" ID="1709333972540" BASECOST="0.0" LEVELS="1" ALIAS="Naked Advantage" POSITION="65" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "NOHITLOCATIONS",
            type: ["automaton"],
            behaviors: [],
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 0,
            xml: `<POWER XMLID="NOHITLOCATIONS" ID="1709333986337" BASECOST="10.0" LEVELS="0" ALIAS="No Hit Locations" POSITION="66" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        undefined,
    );

    addPower(
        {
            key: "POSSESSION",
            type: ["attack", "mental"],
            behaviors: ["attack", "dice"],
            perceivability: "obvious",
            duration: "constant",
            target: "DMCV",
            range: "los",
            costEnd: true,
            costPerLevel: 0.5,
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
            behaviors: ["activatable"],
            perceivability: "imperceptible",
            duration: "persistent",
            target: "self only",
            range: "self",
            costEnd: false,
            costPerLevel: 1,
            xml: `<POWER XMLID="POWERDEFENSE" ID="1709333995936" BASECOST="0.0" LEVELS="1" ALIAS="Power Defense" POSITION="68" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "REFLECTION",
            type: ["attack", "standard"],
            behaviors: ["attack", "activatable"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 3 / 2,
            xml: `<POWER XMLID="REFLECTION" ID="1709333998486" BASECOST="0.0" LEVELS="1" ALIAS="Reflection" POSITION="69" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
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
            range: "self",
            costEnd: false,
            xml: `<POWER XMLID="REGENERATION" ID="1709334000761" BASECOST="0.0" LEVELS="1" ALIAS="Regeneration" POSITION="70" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="WEEK" OPTIONID="WEEK" OPTION_ALIAS="Week" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        undefined,
    );
    addPower(
        {
            key: "RKA",
            type: ["attack"],
            behaviors: ["attack", "dice"],
            duration: "instant",
            range: "standard",
            costPerLevel: 15,
            costEnd: true,
            sheet: {
                INPUT: {
                    label: "Vs.",
                    selectOptions: {
                        ED: "ED",
                        PD: "PD",
                    },
                },
            },
            xml: `<POWER XMLID="RKA" ID="1711934450257" BASECOST="0.0" LEVELS="1" ALIAS="Killing Attack - Ranged" POSITION="53" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );

    addPower(
        {
            key: "SHAPESHIFT",
            type: ["body-affecting"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            xml: `<POWER XMLID="SHAPESHIFT" ID="1711935061472" BASECOST="8.0" LEVELS="0" ALIAS="Shape Shift" POSITION="73" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "SHRINKING",
            type: ["body-affecting", "size"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 6,
            xml: `<POWER XMLID="SHRINKING" ID="1709334010424" BASECOST="0.0" LEVELS="1" ALIAS="Shrinking" POSITION="74" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        { costPerLevel: 10 },
    );
    addPower(
        {
            key: "STRETCHING",
            type: ["body-affecting", "standard"],
            behaviors: ["activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "self only",
            range: "self",
            costEnd: true,
            costPerLevel: 1,
            xml: `<POWER XMLID="STRETCHING" ID="1709334014434" BASECOST="0.0" LEVELS="1" ALIAS="Stretching" POSITION="75" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        { costPerLevel: 5 },
    );
    addPower(
        undefined, //BOOST is not a valid 6e XMLID (it is now AID)
        {
            key: "SUCCOR",
            type: ["adjustment"],
            behaviors: ["attack", "dice"],
            duration: "constant",
            target: "target's DCV",
            range: "no range",
            costEnd: true,
            costPerLevel: 5,
            xml: `<POWER XMLID="SUCCOR" ID="1709342717305" BASECOST="0.0" LEVELS="5" ALIAS="Succor" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="END" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
    );
    addPower(
        {
            key: "SUMMON",
            type: ["standard"],
            behaviors: ["attack", "dice"],
            duration: "instant",
            target: "n/a",
            range: "self",
            costPerLevel: 1 / 5,
            xml: `<POWER XMLID="SUMMON" ID="1709334017073" BASECOST="0.0" LEVELS="1" ALIAS="Summon" POSITION="76" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "SUPPRESS",
        type: ["adjustment", "attack"],
        behaviors: ["attack", "dice"],
        perceivability: "obvious",
        duration: "constant",
        target: "target’s DCV",
        range: "standard",
        costEnd: true,
        costPerLevel: 5,
        xml: `<POWER XMLID="SUPPRESS" ID="1709342722293" BASECOST="0.0" LEVELS="1" ALIAS="Suppress" POSITION="62" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="SPD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
    });

    addPower(
        {
            key: "TELEKINESIS",
            type: ["attack", "standard"],
            behaviors: ["attack", "dice", "activatable"],
            perceivability: "obvious",
            duration: "constant",
            target: "target’s DCV",
            range: "standard",
            costEnd: true,
            costPerLevel: 1.5,
            xml: `<POWER XMLID="TELEKINESIS" ID="1709334027228" BASECOST="0.0" LEVELS="2" ALIAS="Telekinesis" POSITION="79" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(
        {
            key: "TELEPATHY",
            type: ["mental"],
            behaviors: ["attack", "dice"],
            perceivability: "imperceptible",
            duration: "instant",
            target: "dmcv",
            range: "los",
            costEnd: true,
            costPerLevel: 5,
            xml: `<POWER XMLID="TELEPATHY" ID="1709334029488" BASECOST="0.0" LEVELS="1" ALIAS="Telepathy" POSITION="80" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
        },
        {},
    );
    addPower(undefined, {
        key: "TRANSFER",
        type: ["adjustment", "attack", "dice"],
        behaviors: ["attack"],
        perceivability: "obvious",
        duration: "instant",
        target: "target's DCV",
        range: "no range",
        costEnd: true,
        costPerLevel: 15,
        xml: `<POWER XMLID="TRANSFER" ID="1709342746179" BASECOST="0.0" LEVELS="1" ALIAS="Transfer" POSITION="70" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="STR -&gt; CON" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
    });
    addPower(
        {
            key: "TRANSFORM",
            type: ["attack", "standard"],
            behaviors: ["attack"],
            perceivability: "obvious",
            duration: "instant",
            target: "target's DCV",
            range: "standard",
            costEnd: true,
            xml: `<POWER XMLID="TRANSFORM" ID="1709334039303" BASECOST="0.0" LEVELS="1" ALIAS="Transform" POSITION="84" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COSMETIC" OPTIONID="COSMETIC" OPTION_ALIAS="Cosmetic" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes"><NOTES/></POWER>`,
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
            range: "self",
            costPerLevel: 4,
        },
        {},
    );

    addPower(
        {
            key: "MANEUVER",
            type: ["martial", "attack"], // TODO: Not all of these are attacks
            behaviors: ["dice"],
            target: "self only",
            range: "self",
        },
        {},
    );

    addPower(
        {
            key: "RANGEDDC",
            type: ["martial"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 4,
        },
        {},
    );

    addPower(
        {
            key: "WEAPON_ELEMENT",
            type: ["martial"],
            behaviors: [],
            target: "self only",
            range: "self",
            categorized: true,
        },
        {},
    );
})();

(function addSensesToPowerList() {
    addPower(
        {
            key: "ACTIVESONAR",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        {},
    );
    addPower(
        {
            key: "ADJACENTFIXED",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        undefined,
    );
    addPower(
        {
            key: "ADJACENT",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        undefined,
    );
    addPower(
        {
            key: "ANALYZESENSE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        {},
    );

    addPower(
        {
            key: "CONCEALED",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        {},
    );

    addPower(
        {
            key: "DETECT",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "no range",
            costPerLevel: 1,
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALSINGLE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALGROUP",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        {},
    );
    addPower(
        {
            key: "DIMENSIONALALL",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        {},
    );
    addPower(
        {
            key: "DISCRIMINATORY",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 1,
        },
        {},
    );

    addPower(
        {
            key: "ENHANCEDPERCEPTION",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
            costPerLevel: 3,
        },
        {},
    );

    addPower(
        {
            key: "HRRP",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );

    addPower(
        {
            key: "INCREASEDARC240",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "INCREASEDARC360",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "INFRAREDPERCEPTION",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );

    addPower(
        {
            key: "MAKEASENSE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "MENTALAWARENESS",
            type: ["sense"],
            behaviors: [],
            senseGroup: "mental",
            senseType: "passive",
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "MICROSCOPIC",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );

    addPower(
        {
            key: "NIGHTVISION",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "NRAYPERCEPTION",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );

    addPower(
        {
            key: "PARTIALLYPENETRATIVE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        undefined,
    );
    addPower(
        {
            key: "PENETRATIVE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        undefined,
    );

    addPower(
        {
            key: "RADAR",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "RADIOPERCEIVETRANSMIT",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "RADIOPERCEPTION",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "RANGE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "standard",
        },
        {},
    );
    addPower(
        {
            key: "RAPID",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );

    addPower(
        {
            key: "SPATIALAWARENESS",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );

    addPower(
        {
            key: "TARGETINGSENSE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "TELESCOPIC",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "TRACKINGSENSE",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "TRANSMIT",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );

    addPower(
        {
            key: "ULTRASONICPERCEPTION",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
        },
        {},
    );
    addPower(
        {
            key: "ULTRAVIOLETPERCEPTION",
            type: ["sense"],
            behaviors: [],
            target: "self only",
            range: "self",
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
            target: "self only",
            range: "self",
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
            target: "self only",
            range: "self",
            xml: `<DISAD XMLID="GENERICDISADVANTAGE" ID="1709445725246" BASECOST="0.0" LEVELS="0" ALIAS="Custom Complication" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "DEPENDENCE",
            type: ["disadvantage"],
            behaviors: ["roll"],
            target: "self only",
            range: "self",
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
            target: "self only",
            range: "self",
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
            target: "self only",
            range: "self",
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
            range: "self",
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
            target: "self only",
            range: "self",
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
        target: "self only",
        range: "self",
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
            target: "self only",
            range: "self",
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
            behaviors: [],
            name: "Psychological Limitation",
            target: "self only",
            range: "self",
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
            key: "RIVALRY",
            type: ["disadvantage"],
            behaviors: [],
            name: "Rivalry",
            target: "self only",
            range: "self",
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
            target: "self only",
            range: "self",
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
            range: "self",
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
            range: "self",
            costPerLevel: 5,
            xml: `<DISAD XMLID="UNLUCK" ID="1709445762298" BASECOST="0.0" LEVELS="1" ALIAS="Unluck: 1d6" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME=""><NOTES/></DISAD>`,
        },
        {},
    );

    addPower(
        {
            key: "VULNERABILITY",
            type: ["disadvantage"],
            behaviors: [],
            target: "self only",
            range: "self",
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
    addPower(undefined, {
        xml: `<ADDER XMLID="DOUBLEAREA" ID="1707272359920" BASECOST="0.0" LEVELS="1" ALIAS="x2 Radius" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
            <NOTES />
        </ADDER>`,
    });

    addPower(
        {
            cost: function (adder) {
                const levels = parseInt(adder.LEVELS);
                const baseCost = parseFloat(adder.BASECOST);
                adder.BASECOST_total = baseCost + levels * 0.25;
                return adder.BASECOST_total;
            },
            xml: `<ADDER XMLID="DOUBLEHEIGHT" ID="1707357448496" BASECOST="-0.5" LEVELS="3" ALIAS="Height (m)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
            <NOTES />
        </ADDER>`,
        },
        {},
    );

    addPower(
        {
            cost: function (adder) {
                const levels = parseInt(adder.LEVELS);
                const baseCost = parseFloat(adder.BASECOST);
                adder.BASECOST_total = baseCost + levels * 0.25;
                return adder.BASECOST_total;
            },
            xml: `<ADDER XMLID="DOUBLEWIDTH" ID="1707357449336" BASECOST="-0.5" LEVELS="3" ALIAS="Width (m)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
            <NOTES />
        </ADDER>`,
        },
        {},
    );

    addPower(
        {
            // cost: function (adder) {
            //     const levels = parseInt(adder.LEVELS);
            //     const baseCost = parseFloat(adder.BASECOST);
            //     adder.BASECOST_total = baseCost + levels * 0.25;
            //     return adder.BASECOST_total;
            // },
            xml: `<ADDER XMLID="FIXEDSHAPE" ID="1707357527471" BASECOST="-0.25" LEVELS="0" ALIAS="Fixed Shape" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
            <NOTES />
        </ADDER>`,
        },
        {},
    );

    addPower(
        {
            cost: function (adder) {
                const levels = parseInt(adder.LEVELS);
                const baseCost = parseFloat(adder.BASECOST);
                adder.BASECOST_total = baseCost + Math.ceil(levels / 12) * 0.25;
                return adder.BASECOST_total;
            },
            xml: `<ADDER XMLID="MOBILE" ID="1707357530522" BASECOST="0.25" LEVELS="1" ALIAS="Mobile" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
            <NOTES />
        </ADDER>`,
        },
        {},
    );

    addPower(
        {
            xml: `<ADDER XMLID="PLUSONEHALFDIE" ID="1712342067007" BASECOST="3.0" LEVELS="0" ALIAS="+1/2 d6" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"><NOTES/></ADDER>`,
        },
        {},
    );

    addPower(
        {
            xml: `<ADDER XMLID="PLUSONEPIP" ID="1712342367072" BASECOST="2.0" LEVELS="0" ALIAS="+1 pip" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"><NOTES/></ADDER>`,
        },
        {},
    );

    addPower(
        {
            // key: "MINUSONEPIP",
            // type: [],
            // behaviors: ["adder"],
            // target: "self only",
            // range: "self",

            xml: `<ADDER XMLID="MINUSONEPIP" ID="1712344286624" BASECOST="10.0" LEVELS="0" ALIAS="+1d6 -1" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES"><NOTES/></ADDER>`,
        },
        {},
    );
})();

(function addModifiersToPowerList() {
    addPower(
        {
            // AOE
            cost: function (modifier) {
                const levels = parseInt(modifier.LEVELS) || 0;
                let _cost = 0;
                switch (modifier.OPTIONID) {
                    case "RADIUS":
                        _cost =
                            Math.max(1, Math.ceil(Math.log2(levels / 2))) *
                            0.25;
                        break;
                    case "CONE":
                        _cost =
                            Math.max(1, Math.ceil(Math.log2(levels / 4))) *
                            0.25;
                        break;
                    case "LINE":
                        _cost =
                            Math.max(1, Math.ceil(Math.log2(levels / 8))) *
                            0.25;
                        break;
                    case "SURFACE":
                        _cost =
                            Math.max(1, Math.ceil(Math.log2(levels))) * 0.25;
                        break;
                    case "ANY":
                        _cost =
                            Math.max(1, Math.ceil(Math.log2(levels))) * 0.25;
                        break;
                    default:
                        console.warn("Unknown OPTIONID", modifier);
                        _cost = 0;
                }

                // // AOE ADDERS
                // for (const adder of modifier.ADDER || []) {
                //     const adderPowerInfo = getPowerInfo({
                //         item: adder,
                //         actor: item.actor,
                //     });
                //     if (adderPowerInfo.cost) {
                //         if (typeof adderPowerInfo.cost === "function") {
                //             _cost += adderPowerInfo.cost(adder);
                //         }
                //     }
                // }
                // modifier.BASECOST_total = _cost;
                return _cost;
            },
            dc: true,
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
            xml: `<MODIFIER XMLID="AOE" ID="1712699305027" BASECOST="0.0" LEVELS="1" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
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
            xml: `<MODIFIER XMLID="AOE" ID="1712699238358" BASECOST="1.0" LEVELS="0" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
    );

    addPower(
        {
            costPerLevel: 0.25,
            dc: true,
            xml: `<MODIFIER XMLID="ARMORPIERCING" ID="1712696642037" BASECOST="0.0" LEVELS="1" ALIAS="Armor Piercing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
        {
            costPerLevel: 0.5,
        },
    );

    addPower(
        {
            dc: true,
            xml: `<MODIFIER XMLID="AUTOFIRE" ID="1713378198591" BASECOST="0.25" LEVELS="0" ALIAS="Autofire" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWO" OPTIONID="TWO" OPTION_ALIAS="2 Shots" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            xml: `<MODIFIER XMLID="CHARGES" ID="1712257766011" BASECOST="-2.0" LEVELS="0" ALIAS="Charges" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONE" OPTIONID="ONE" OPTION_ALIAS="1" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"><NOTES/></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            dc: true,
            xml: `<MODIFIER XMLID="CONTINUOUS" ID="1713378099716" BASECOST="1.0" LEVELS="0" ALIAS="Continuous" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            dc: true,
            costPerLevel: 0.25,
            xml: `<MODIFIER XMLID="CUMULATIVE" ID="1714280316745" BASECOST="0.5" LEVELS="0" ALIAS="Cumulative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            cost: function (modifier, item) {
                const baseCost = parseFloat(modifier.BASECOST);
                const levels = parseInt(modifier.LEVELS);
                let baseDCFalloffFromShape = 1;
                // 6e and 5e define AOE & EXPLOSION differently
                const AOE = item.findModsByXmlid("AOE");
                switch ((AOE || modifier).OPTIONID) {
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
                        console.error(
                            `unknown 5e explosion shape ${AOE || modifier}`,
                            item,
                        );
                        break;
                }
                const adjustedLevels = Math.max(
                    0,
                    levels - baseDCFalloffFromShape,
                );
                return baseCost + adjustedLevels * 0.25;
            },
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
            xml: `<MODIFIER XMLID="EXPLOSION" ID="1713379744211" BASECOST="0.5" LEVELS="1" ALIAS="Explosion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NORMAL" OPTIONID="NORMAL" OPTION_ALIAS="Normal (Radius)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            xml: `<MODIFIER XMLID="FOCUS" ID="1442342142790" BASECOST="-0.5" LEVELS="0" ALIAS="Focus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OIF" OPTIONID="OIF" OPTION_ALIAS="OIF" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No">
        <NOTES />
      </MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            costPerLevel: 0.25,
            xml: `<MODIFIER XMLID="HARDENED" ID="1712344562459" BASECOST="0.0" LEVELS="1" ALIAS="Hardened" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"><NOTES/></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            costPerLevel: 0.25,
            xml: `<MODIFIER XMLID="IMPENETRABLE" ID="1712345241001" BASECOST="0.0" LEVELS="1" ALIAS="Impenetrable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"><NOTES/></MODIFIER>`,
        },
        undefined,
    );

    addPower(
        {
            xml: `<MODIFIER XMLID="OIHID" ID="1712092697365" BASECOST="-0.25" LEVELS="0" ALIAS="Only In Heroic Identity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"><NOTES/></MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            costPerLevel: 0.5,
            dc: true,
            // cost: function (modifier) {
            //     return parseInt(modifier.LEVELS) * this.costPerLevel;
            // },
            xml: `<MODIFIER XMLID="PENETRATING" ID="1712697142089" BASECOST="0.0" LEVELS="1" ALIAS="Penetrating" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            // costPerLevel: 0.5,
            // dc: true,
            cost: function (modifier, item) {
                // Reduced endurance is double the cost if it's applying against a power with autofire
                if (item.findModsByXmlid("AUTOFIRE")) {
                    return parseFloat(modifier.BASECOST) * 2;
                }
                return parseFloat(modifier.BASECOST);
            },
            xml: `<MODIFIER XMLID="REDUCEDEND" ID="1710101174711" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            xml: `<MODIFIER XMLID="SELFONLY" ID="1716495880091" BASECOST="-0.5" LEVELS="0" ALIAS="Self Only" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
          </MODIFIER>`,
        },
        {},
    );

    addPower(
        {
            // costPerLevel: 0.5,
            // dc: true,
            minumumLimitation: -0.25,
            xml: `<MODIFIER XMLID="REQUIRESASKILLROLL" ID="1596334078849" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
            <NOTES />
        </MODIFIER>`,
        },
        {},
    );
})();

// For some reason the BASECOST of some modifiers/adder are 0, some are just wrong
// Turns out this is actually correct BASECOST can be 0, and COSTPERLEVEL is calculated.
// Plan it to remove ModifierOverride and add them to the powers list as modifiers.
HERO.ModifierOverride = {
    ADDITIONALED: { BASECOST: 5 / 2 },
    ADDITIONALPD: { BASECOST: 5 / 2 },
    ALWAYSOCCURS: { BASECOST: 0, MULTIPLIER: 2 },
    //AOE: { dc: true },
    //ARMORPIERCING: { BASECOST: 0.25, dc: true },
    //AUTOFIRE: { dc: true },
    AVAD: { dc: true },
    BOOSTABLE: { dc: true },
    //CONTINUOUS: { dc: true },
    CONTINUOUSCONCENTRATION: { BASECOST: -0.25 },
    DAMAGEOVERTIME: { dc: true },
    DEFBONUS: { BASECOST: 2 },
    DIFFICULTTODISPEL: { BASECOST: 0.25 },
    DIMENSIONS: { BASECOST: 5 },
    DOESBODY: { dc: true },
    DOUBLEKB: { dc: true },
    //ENDURANCERESERVEREC: { BASECOST: 2 / 3 },
    ENERGY: { BASECOST: 5 }, // DAMAGENEGATION
    //HARDENED: { BASECOST: 0.25 },
    //IMPENETRABLE: { BASECOST: 0.25 },
    IMPROVEDNONCOMBAT: { BASECOST: 5 },
    MENTAL: { BASECOST: 5 }, // DAMAGENEGATION
    //PENETRATING: { BASECOST: 0.5, dc: true },
    PHYSICAL: { BASECOST: 5 }, // DAMAGENEGATION
    STICKY: { dc: true },
    TIMELIMIT: { dc: true },
    TRANSDIMENSIONAL: { dc: true },
    TRIGGER: { dc: true },
    UNCONTROLLED: { dc: true },
    VARIABLEADVANTAGE: { dc: true },
    VARIABLESFX: { dc: true },
};

HERO.ModifierOverride5e = {
    // ARMORPIERCING: {
    //     BASECOST: 0.5,
    // },
};

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

HERO.stunBodyDamages = {
    stunbody: "Stun and Body",
    stunonly: "Stun only",
    bodyonly: "Body only",
    effectonly: "Effect only",
};

HERO.knockbackMultiplier = {
    0: "No Knockback",
    1: "Knockback",
    2: "Double Knockback",
};

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
