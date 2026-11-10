/**
 * The characteristic test cases the suite still needs, written as skipped stubs.
 *
 * Every case here is pending.
 */

import { freezeDeep } from "../utility/freeze-helpers.mjs";

const EDITIONS = freezeDeep([
    {
        label: "6e",
        is5e: false,
        movement: [
            "EXTRADIMENSIONALMOVEMENT",
            "FLIGHT",
            "FTL",
            "LEAPING",
            "RUNNING",
            "SWIMMING",
            "SWINGING",
            "TELEPORTATION",
            "TUNNELING",
        ],
        roll: ["CON", "DEX", "EGO", "INT", "PRE", "STR"],
    },
    {
        label: "5e",
        is5e: true,
        movement: [
            "EXTRADIMENSIONALMOVEMENT",
            "FLIGHT",
            "FTL",
            "GLIDING",
            "LEAPING",
            "RUNNING",
            "SWIMMING",
            "SWINGING",
            "TELEPORTATION",
            "TUNNELING",
        ],
        roll: ["COM", "CON", "DEX", "EGO", "INT", "PRE", "STR"],
    },
]);

/**
 * Report groups, in the order the report shows them.
 *
 * `buildRequiredCases` fills them in the same order, so a reader sees the cheapest work first.
 */
const GROUPS = freezeDeep({
    nodeProperties: "Node properties: base, levels, and basePlusLevels",
    characteristicMax: "Node properties: characteristicMax",
    roll: "Node properties: roll",
    uploaded6e: "6e uploaded values and cost, one claim per name",
    oddPoints: "Odd point counts and item-granted points (5e COM)",
    totals: "Actor cost totals",
    negativeValues: "Negative values and cost floors",
    movement: "Movement modes: possession, value, and cost",
    usableSets: "Exact usable set per actor type",
    activeEffects: "Active effects versus stored values",
    computerAi: "Computer and AI uploads",
    automaton6e: "6e automaton",
    writeFunnel: "Write funnel and derived recompute",
    conversion: "Edition comparison: the same LEVELS numbers in a 5e sheet and a 6e sheet",
    damage: "Damage and recovery boundaries on STUN, END, and BODY",
    labels: "Label case and unknown labels",
    baseVehicle: "Base and vehicle cost details",
});

/**
 * The fixtures these cases wait for, and what makes each one differ from a baseline actor.
 *
 * A fixture earns its place by answering a question no current fixture can. A second plain pc, a
 * second plain vehicle, or an `npc` twin of a `pc` row answers nothing, so it is not here. See
 * "Not gaps" in `characteristics_coverage_gaps.md`.
 *
 * `blocks` names what must settle first. `blocks: null` means the fixture is ready to build.
 */
export const REQUIRED_FIXTURES = freezeDeep({
    bare: {
        title: "a bare actor",
        actorType: "each entry of CONFIG.HERO.creatableActorTypes",
        edition: "both",
        unique:
            "Nothing to supply. No characteristic suite builds a bare actor any more; each of the six " +
            "suites uploads its own exports. The twelve 0 point uploads in those suites are the nearest " +
            "fixture, and they state the same numbers a bare actor holds: BODY 10, RUNNING 12, and the " +
            "figured names computed from them. A bare actor is still cheap: " +
            "`createQuenchActor({ quench, is5e, actorType })` with no `contents`. Nothing is bought, so the " +
            "cost is 0, and no Hero Designer XML is uploaded. The document carries no ActiveEffect flag, yet " +
            "`getActiveEffects()` still returns one entry per movement power. See gap 3 of " +
            "`characteristics_coverage_gaps.md`.",
        blocks: null,
    },
    pcAllChars6e: {
        title: "6e pc with every characteristic bought",
        actorType: "pc",
        edition: "6e",
        unique:
            "Inherent characteristics only, at these LEVELS: STR 15, DEX 10, CON 8, BODY 6, INT 12, EGO 9, " +
            "PRE 14, SPD 6, END 20, STUN 15, PD 5, ED 4, RUNNING 12, SWIMMING 6, LEAPING 3. No COM element, " +
            "no powers, and no items.",
        blocks: null,
    },
    pcAllChars5e: {
        title: "5e pc with the same LEVELS numbers",
        actorType: "pc",
        edition: "5e",
        unique:
            'A 5e sheet that buys the same LEVELS numbers as the row above, plus COM at LEVELS="7". Two ' +
            "separate sheets, one per edition, because a sheet belongs to one edition. A 5e pc holds COM and no " +
            "DEF: measured, only vehicle and base2 answer true for DEF, and only in 5e.",
        blocks: null,
    },
    pcAllMovement6e: {
        title: "6e pc that owns every movement mode",
        actorType: "pc",
        edition: "6e",
        unique:
            "Nine modes. Inherent: RUNNING 12, SWIMMING 6, LEAPING 3. Powers: FLIGHT 10, FTL 8, " +
            "TELEPORTATION 6, SWINGING 9, TUNNELING 5, EXTRADIMENSIONALMOVEMENT 3, each written as " +
            '<POWER XMLID="NAME" LEVELS="n">. FLIGHT carries no GLIDING modifier.',
        blocks: null,
    },
    pcAllMovement5e: {
        title: "5e pc that owns every movement mode",
        actorType: "pc",
        edition: "5e",
        unique:
            "Ten modes: the 6e list above at the same level counts, plus GLIDING as its own power, " +
            "the 6e row cannot ask for GLIDING as a mode.",
        blocks: null,
    },
    pcEffects6e: {
        title: "6e pc loaded with active effects",
        actorType: "pc",
        edition: "6e",
        unique:
            'Inherent STR at LEVELS="15", so the sheet max reads 25. One power: ' +
            '<POWER XMLID="AID" INPUT="STR" LEVELS="3" USESTANDARDEFFECT="No" AFFECTS_PRIMARY="No" ' +
            'AFFECTS_TOTAL="Yes">, which the system turns into one ActiveEffect that adds 3 to `str.max`. The ' +
            "test adds two effects by hand, one `str.max` ADD 5 and one `str.value` ADD 2, then writes the STR " +
            "value down to 20, so a lowered value sits on the actor.",
        blocks: null,
    },
    pcBuyback6e: {
        title: "6e pc with characteristics bought back",
        actorType: "pc",
        edition: "6e",
        unique:
            "Negative LEVELS on inherent characteristics, mirroring PC_5E_SUPERHERO_BUYBACK_XML: STR -5, DEX -5, " +
            "CON -5, BODY -5, INT -5, EGO -5, PRE -5, and 0 levels on SPD, PD, ED, REC, END, STUN, RUNNING, " +
            "SWIMMING, LEAPING. No sheet buys a defence or SPD below 0 levels, so this row keeps them at 0. " +
            'The 5e row it mirrors states ED LEVELS="-1" and PD LEVELS="0", so that row is hand-edited and ' +
            "no Hero Designer export produces it; it stays as engine behaviour only. No disadvantage is " +
            "involved, and no characteristic discount exists in the item model.",
        blocks:
            "Hero Designer may refuse to export negative LEVELS for a 6e sheet. Say so and the suite hand-edits " +
            "the numbers on the 6e twin of that XML, so no sheet gets rebuilt.",
    },
    pcCampaignCap6e: {
        title: "6e pc under a campaign characteristic maximum",
        actorType: "pc",
        edition: "6e",
        unique: "One campaign rule caps STR and leaves DEX alone. The only case where the cap is not null.",
        blocks: "Needs game.settings.set on the campaign rules point-limit tab before the upload.",
    },
    automaton6eUpload: {
        title: "the 6e automaton sheet, uploaded as an automaton",
        actorType: "automaton",
        edition: "6e",
        unique:
            "No new XML. The suite uploads PC_6E_AUTOMATON_BODY_DAMAGE_REMOVES_ABILITY_XML, the row that goes " +
            'in as a pc today, with actorType "automaton" instead. That power set takes STUN away.',
        blocks: null,
    },
    computer6eExport: {
        title: "6e computer sheet",
        actorType: "computer",
        edition: "6e",
        unique:
            'Bought as inherent characteristics: DEX LEVELS="15", INT LEVELS="18", SPD LEVELS="5". Derived, so ' +
            "they carry no element and no cost: OCV, DCV, OMCV, DMCV. Absent: BODY, CON, END, STUN, REC, PD, " +
            "ED, STR, and every movement mode.",
        blocks:
            "Partly cleared. `COMPUTER_6E_ZERO_POINT_XML` in `testing-characteristics-computer.mjs` is a 0 point " +
            "computer export, so the absent-name claims can run on it today. The LEVELS values above still need " +
            "a sheet.",
    },
    ai6eExport: {
        title: "6e AI sheet",
        actorType: "ai",
        edition: "6e",
        unique:
            'The computer list above at the same LEVELS, plus inherent EGO at LEVELS="12". Derived: OCV, DCV, ' +
            "OMCV, DMCV. Absent: BODY, CON, END, STUN, REC, PD, ED, STR, and every movement mode. The AI set " +
            "is the computer set plus EGO, and that is the whole difference.",
        blocks:
            "Partly cleared. `AI_6E_ZERO_POINT_XML` in `testing-characteristics-ai.mjs` is a 0 point AI export, " +
            "so the absent-name claims can run on it today. The LEVELS values above still need a sheet.",
    },
    vehicle6eMover: {
        title: "6e vehicle, existing row extended",
        actorType: "vehicle",
        edition: "6e",
        unique:
            'One attribute change to VEHICLE_6E_XML, not a new sheet: LEAPING LEVELS="0" becomes LEVELS="2". ' +
            "The row already holds the FLIGHT power, SWIMMING, PD 4, and ED 4, so each mode then carries a " +
            "different number.",
        blocks: null,
    },
    vehicle5eDefRow: {
        title: "5e vehicle, existing row read closely",
        actorType: "vehicle",
        edition: "5e",
        unique:
            'No new XML. VEHICLE_5E_XML states DEF LEVELS="8" and holds no PD element and no ED element, the ' +
            "same split a base shows. The row claims no DEF cost today.",
        blocks: null,
    },
    base5eDefCharge: {
        title: "5e base, existing row extended",
        actorType: "base2",
        edition: "5e",
        unique:
            "No new XML. The row already states DEF 15 and BASESIZE 20 values. It states no `realCost` for DEF, " +
            "BODY, or BASESIZE, which is where a base charges 2 a point instead of the character charge.",
        blocks: null,
    },
    base6ePdEdCharge: {
        title: "6e base, existing row extended",
        actorType: "base2",
        edition: "6e",
        unique:
            'No new XML. The row states PD `LEVELS="5"` as 7 and ED `LEVELS="4"` as 6, so both read base plus ' +
            "levels. It states no `realCost`, so the base charge for defence goes unclaimed.",
        blocks: null,
    },
    pcDamaged6e: {
        title: "6e pc driven to its damage and recovery boundaries",
        actorType: "pc",
        edition: "6e",
        unique:
            "No new XML. The suite takes a saved pc, drives STUN to 0, END to 0, and BODY below 0 with updateMultipleCharacteristicsOnActor, " +
            "then runs the recovery the system already codes: REC floors at 0, STUN and END each gain REC, and " +
            "while STUN sits at 0 or below, END may not rise past the STUN it just gained.",
        blocks: null,
    },
});

/**
 * Names whose base is a constant the template states, so one claim cannot stand for another. PD, ED, REC,
 * END, STUN, and LEAPING stay out: their base comes from a figure, not from the sheet.
 */
const LEVEL_CLAIM_NAMES = freezeDeep(["STR", "DEX", "CON", "BODY", "INT", "EGO", "PRE", "SPD", "RUNNING"]);

/** Names the computer and AI sheets buy as inherent characteristics, with the LEVELS the sheet states. */
const COMPUTER_BOUGHT = freezeDeep(["DEX 15", "INT 18", "SPD 5"]);

/**
 * The characteristic names a 6e pc holds.
 *
 * `uploaded6eCases` adds one max claim and one cost claim per name here. State the list by hand.
 * Deriving it from config would compare the report with the table the actor reads. A pc that gains or
 * loses a name must gain or lose the claim here too.
 */
const PC_CHARACTERISTICS_6E = freezeDeep([
    "BODY",
    "CON",
    "DCV",
    "DEX",
    "DMCV",
    "ED",
    "EGO",
    "END",
    "INT",
    "OCV",
    "OMCV",
    "PD",
    "PRE",
    "REC",
    "SPD",
    "STR",
    "STUN",
]);

/** Names the computer and AI sheets never state, because the system derives them. */
const COMPUTER_DERIVED = freezeDeep(["OCV", "DCV", "OMCV", "DMCV"]);

/** Names absent from a computer. An AI adds EGO and nothing else. */
const COMPUTER_ABSENT = freezeDeep(["BODY", "CON", "END", "STUN", "REC", "PD", "ED", "STR"]);

/** Modes whose cost the suite claims in both editions. */
const MOVEMENT_COST_NAMES = freezeDeep(["RUNNING", "SWIMMING", "LEAPING", "FLIGHT"]);

/**
 * The actor types whose usable set needs its own claim.
 *
 * Both base rows already claim the base2 answer. An npc answers the pc answer, so one claim per
 * edition compares the two. Write the names here, so a new actor type joins the report only when
 * someone adds it.
 */
const USABLE_SET_ACTOR_TYPES = freezeDeep(["pc", "vehicle", "computer", "automaton", "ai"]);

/**
 * Build every required case as a title plus its group.
 *
 * @returns {{ group: string, title: string }[]} One row per case, in report order.
 */
export function buildRequiredCases() {
    const cases = [];

    const add = (group, fixtureKey, claim) => {
        const fixture = REQUIRED_FIXTURES[fixtureKey];

        if (fixture === undefined) {
            throw new Error(`Required coverage: unknown fixture "${fixtureKey}" for "${claim}"`);
        }

        cases.push({ group, title: `${fixture.title}: ${claim}` });
    };

    nodePropertyCases(add);
    characteristicMaxCases(add);
    rollCases(add);
    uploaded6eCases(add);
    oddPointCases(add);
    totalCases(add);
    negativeValueCases(add);
    movementCases(add);
    usableSetCases(add);
    activeEffectCases(add);
    computerAiCases(add);
    automaton6eCases(add);
    writeFunnelCases(add);
    conversionCases(add);
    damageCases(add);
    labelCases(add);
    baseVehicleCases(add);

    return cases;
}

/**
 * Add the three level properties for names where base and levels differ. Gap 2.
 *
 * @param {Function} add Case builder.
 */
function nodePropertyCases(add) {
    for (const name of LEVEL_CLAIM_NAMES) {
        add(GROUPS.nodeProperties, "pcAllChars6e", `${name} reports the base the template states`);
        add(GROUPS.nodeProperties, "pcAllChars6e", `${name} reports the levels it buys`);
        add(GROUPS.nodeProperties, "pcAllChars6e", `${name} reports base plus levels`);
    }

    add(GROUPS.nodeProperties, "bare", "a characteristic nobody buys reports base, zero levels, and base plus levels");
}

/**
 * Add the campaign cap cases. The property is null everywhere today.
 *
 * @param {Function} add Case builder.
 */
function characteristicMaxCases(add) {
    add(GROUPS.characteristicMax, "pcCampaignCap6e", "STR carries the campaign maximum");
    add(GROUPS.characteristicMax, "pcCampaignCap6e", "DEX carries no maximum, so the property stays null");
    add(GROUPS.characteristicMax, "pcEffects6e", "an effect on the max adds to the campaign maximum");
    add(GROUPS.characteristicMax, "bare", "a bare actor has a null maximum for every name");
}

/**
 * Add the success-roll cases, one per name an edition states, plus the three special answers.
 *
 * @param {Function} add Case builder.
 */
function rollCases(add) {
    for (const edition of EDITIONS) {
        const fixtureKey = edition.is5e ? "pcAllChars5e" : "pcAllChars6e";

        for (const name of edition.roll) {
            add(GROUPS.roll, fixtureKey, `${name} rolls 9 plus one fifth of its value`);
        }
    }

    add(GROUPS.roll, "pcBuyback6e", "a characteristic bought below zero rolls 9, never less");
    add(GROUPS.roll, "automaton6eUpload", "EGO has no roll");
    add(GROUPS.roll, "bare", "BODY declares no roll, so the property is null");
}

/**
 * Add one max claim and one cost claim per characteristic a 6e pc holds. Gap 1, the top priority here.
 *
 * Bucket G changes the 6e cost curve. Nothing in the suite would notice today. Movement names get
 * their own claims in the movement group, on a fixture that actually buys them.
 *
 * @param {Function} add Case builder.
 */
function uploaded6eCases(add) {
    for (const name of PC_CHARACTERISTICS_6E) {
        add(GROUPS.uploaded6e, "pcAllChars6e", `${name} max equals the Hero Designer figure`);
        add(GROUPS.uploaded6e, "pcAllChars6e", `${name} costs what Hero Designer charges`);
    }
}

/**
 * Add the odd point count cases. Gap 1 covers whole, even purchases only.
 *
 * Measured in the current XML: every 5e COM row uses LEVELS 8, 0, or -5. Nothing states an odd count,
 * and no row states a COM value that an item contributes.
 *
 * @param {Function} add Case builder.
 */
function oddPointCases(add) {
    add(GROUPS.oddPoints, "pcAllChars5e", "COM reports the 7 levels the template buys");
    add(GROUPS.oddPoints, "pcAllChars5e", "COM max equals the base plus the odd levels");
    add(GROUPS.oddPoints, "pcAllChars5e", "COM costs what Hero Designer charges for an odd point count");
    add(GROUPS.oddPoints, "pcAllChars5e", "a COM item of plus 3 adds to the played COM max");
    add(GROUPS.oddPoints, "pcAllChars5e", "the stored COM max excludes the item");
}

/**
 * Add the actor-level cost totals no row states yet. Gap 5.
 *
 * @param {Function} add Case builder.
 */
function totalCases(add) {
    for (const fixtureKey of [
        "pcAllChars6e",
        "pcBuyback6e",
        "vehicle6eMover",
        "vehicle5eDefRow",
        "base6ePdEdCharge",
        "computer6eExport",
    ]) {
        add(GROUPS.totals, fixtureKey, "charges the Hero Designer characteristic total");
        add(GROUPS.totals, fixtureKey, "offers that total as active points");
    }
}

/**
 * Add the 6e negative and floor cases. Gap 6 covers 5e only today.
 *
 * @param {Function} add Case builder.
 */
function negativeValueCases(add) {
    add(GROUPS.negativeValues, "pcBuyback6e", "STR at minus 5 levels costs less than nothing");
    add(GROUPS.negativeValues, "pcBuyback6e", "DEX at minus 5 levels costs less than nothing");
    add(GROUPS.negativeValues, "pcBuyback6e", "PRE at minus 5 levels costs less than nothing");
    add(GROUPS.negativeValues, "pcBuyback6e", "a characteristic at 0 levels costs nothing");
    add(GROUPS.negativeValues, "pcBuyback6e", "PD reads 0 while CON and BODY sit below zero");
    add(GROUPS.negativeValues, "pcBuyback6e", "ED reads 0 while CON and BODY sit below zero");
    add(GROUPS.negativeValues, "pcBuyback6e", "the sheet total stays negative and the actor reports it");
}

/**
 * Add the movement cases: possession per mode per edition, then value and cost. Gap 3.
 *
 * Phase 4 dropped six `flight.max` claims read on actors that own no flight. These rows are their
 * honest replacement.
 *
 * @param {Function} add Case builder.
 */
function movementCases(add) {
    const fixtureFor = (label) => (label === "6e" ? "pcAllMovement6e" : "pcAllMovement5e");

    for (const edition of EDITIONS) {
        const fixtureKey = fixtureFor(edition.label);

        for (const mode of edition.movement) {
            add(GROUPS.movement, fixtureKey, `owns ${mode} through the power it bought`);
            add(GROUPS.movement, fixtureKey, `${mode} max equals the levels the template buys`);
        }

        for (const mode of MOVEMENT_COST_NAMES.filter((one) => edition.movement.includes(one))) {
            add(GROUPS.movement, fixtureKey, `${mode} costs what Hero Designer charges`);
        }
    }

    add(GROUPS.movement, "pcAllMovement6e", "disabling the FLIGHT power removes the mode");
    add(GROUPS.movement, "pcAllMovement6e", "deleting the TELEPORTATION power removes the mode");
    add(GROUPS.movement, "vehicle6eMover", "unbought LEAPING stays 0 rather than taking the character default");
    add(GROUPS.movement, "vehicle6eMover", "a mode the vehicle buys changes no other mode");
}

/**
 * Add one exact usable-set claim per type and edition, except base2, which both base rows claim. Gap 4.
 *
 * Blocked: five movement powers are usable with no uppercase node, so a bare 6e pc shows 20 names that
 * exist against 25 that are usable. Land these as a pin on today's answer, with the bug named in the
 * comment, so bucket H shows up as a failure instead of a silent change.
 *
 * An npc is absent from the loop on purpose. Its answer is the pc answer, so one claim per edition
 * compares the two instead of repeating the whole set.
 *
 * @param {Function} add Case builder.
 */
function usableSetCases(add) {
    // Measured on bare actors, the equality holds for computer and ai in both editions. For pc, vehicle,
    // and automaton it cannot hold until bug 4 of `characteristics_bugs.md` lands, because the usable list
    // carries FLIGHT, FTL, SWINGING, TELEPORTATION, and TUNNELING (plus GLIDING in 5e) while those names have
    // no node to have.
    for (const actorType of USABLE_SET_ACTOR_TYPES) {
        for (const edition of EDITIONS) {
            add(GROUPS.usableSets, "bare", `the ${edition.label} ${actorType} usable set equals the names it has`);
        }
    }

    for (const edition of EDITIONS) {
        add(GROUPS.usableSets, "bare", `the ${edition.label} npc usable set equals the ${edition.label} pc usable set`);
    }
}

/**
 * Add the played-versus-stored cases. `getCharacteristicFromActor` and `getStoredCharacteristicFromActor` must answer different numbers.
 *
 * Measured on a live 6e pc with a saved effect: `str.max` ADD 5 moves max 10 to 15, and a value written
 * below the max stays there. `str.value` ADD 2 moves the value alone. Setting `disabled` on either
 * effect takes its contribution back off, on both doors. The stored node keeps 10 and 5 throughout.
 *
 * @param {Function} add Case builder.
 */
function activeEffectCases(add) {
    add(GROUPS.activeEffects, "pcEffects6e", "the AID on STR adds 3 to the played STR max");
    add(GROUPS.activeEffects, "pcEffects6e", "the stored STR max stays 25 while the AID is held");
    add(GROUPS.activeEffects, "pcEffects6e", "an effect on str.max leaves a value below the max where it is");
    add(GROUPS.activeEffects, "pcEffects6e", "an effect on str.max raises a value that equals the old max");
    add(GROUPS.activeEffects, "pcEffects6e", "an effect on str.value moves the value and not the max");
    add(GROUPS.activeEffects, "pcEffects6e", "setting disabled on the AID effect takes the 3 back off");
    add(GROUPS.activeEffects, "pcEffects6e", "turning the AID item off sets that effect disabled");
    add(GROUPS.activeEffects, "pcEffects6e", "deleting the AID item returns the played max to the stored max");
    add(GROUPS.activeEffects, "pcEffects6e", "an effect on a movement mode raises that mode and no other");
}

/**
 * Add the computer and AI upload cases. Gap 7.
 *
 * @param {Function} add Case builder.
 */
function computerAiCases(add) {
    for (const bought of COMPUTER_BOUGHT) {
        add(GROUPS.computerAi, "computer6eExport", `${bought} levels equals the value the sheet states`);
    }

    for (const name of COMPUTER_DERIVED) {
        add(GROUPS.computerAi, "computer6eExport", `${name} derives from DEX and INT and costs nothing`);
    }

    for (const name of COMPUTER_ABSENT) {
        add(GROUPS.computerAi, "computer6eExport", `${name} is absent, so it reports no value`);
    }

    add(GROUPS.computerAi, "computer6eExport", "no movement mode is present");

    add(GROUPS.computerAi, "ai6eExport", "EGO 12 levels equals the value the sheet states");
    add(GROUPS.computerAi, "ai6eExport", "the AI set equals the computer set plus EGO");
    add(GROUPS.computerAi, "ai6eExport", "STUN stays absent, so an AI is never stunned");
}

/**
 * Add the 6e half of the STUN rule.
 *
 * The actor's powers answer STUN, so no config table states the answer. All four automaton rows are
 * 5e, and the one 6e row covers only the STUN removal. The last claim points at
 * `PC_CHARACTERISTICS_6E`.
 *
 * @param {Function} add Case builder.
 */
function automaton6eCases(add) {
    add(GROUPS.automaton6e, "automaton6eUpload", "does not have STUN");
    add(GROUPS.automaton6e, "automaton6eUpload", "turning the automaton power off brings STUN back");
    add(GROUPS.automaton6e, "automaton6eUpload", "keeps every name other than STUN that a 6e pc has");
}

/**
 * Add the write funnel cases. Every one goes through `updateCharacteristicPropertiesOnActor` or `updateMultipleCharacteristicsOnActor`.
 *
 * @param {Function} add Case builder.
 */
function writeFunnelCases(add) {
    add(GROUPS.writeFunnel, "pcAllChars6e", "a STUN write above max does not persist a value above max");
    add(GROUPS.writeFunnel, "pcAllChars6e", "the stored node matches the played node after a write");
    add(GROUPS.writeFunnel, "pcAllChars6e", "a write the rules forbid keeps the old value");
    add(GROUPS.writeFunnel, "pcAllChars6e", "a levels write moves max");
    add(GROUPS.writeFunnel, "pcAllChars6e", "updateMultipleCharacteristicsOnActor writes two names in one update");
    add(GROUPS.writeFunnel, "pcAllChars6e", "an update keyed with an uppercase label reaches the lowercase node");
    add(GROUPS.writeFunnel, "pcAllChars6e", "a STR write recomputes PD in the same prepare cycle");
    add(GROUPS.writeFunnel, "pcAllMovement6e", "a movement mode write persists and reads back");
}

/**
 * Add the cases that compare a 5e sheet and a 6e sheet of the same character.
 *
 * @param {Function} add Case builder.
 */
function conversionCases(add) {
    // pcAllChars6e and pcAllChars5e buy the same LEVELS numbers in two sheets, one per edition.
    add(GROUPS.conversion, "pcAllChars5e", "COM appears in the 5e answer and not in the 6e answer");
    add(GROUPS.conversion, "pcAllChars5e", "the two sheets differ by COM and by nothing else");
    add(GROUPS.conversion, "pcAllChars5e", "RUNNING 12 levels costs what the 5e curve charges");
    add(GROUPS.conversion, "pcAllChars5e", "the same 12 RUNNING levels cost what the 6e curve charges");
}

/**
 * Add the boundaries that other systems read: knocked out, out of END, and destroyed.
 *
 * @param {Function} add Case builder.
 */
function damageCases(add) {
    add(GROUPS.damage, "pcDamaged6e", "STUN at 0 reads 0 and not the max");
    add(GROUPS.damage, "pcDamaged6e", "END at 0 reads 0");
    add(GROUPS.damage, "pcDamaged6e", "BODY below zero keeps the negative value");
    add(GROUPS.damage, "pcDamaged6e", "recovery raises STUN by REC and never past max");
    add(GROUPS.damage, "pcDamaged6e", "recovery raises END by REC");
    add(GROUPS.damage, "pcDamaged6e", "recovery while knocked out lifts END no higher than the STUN it restores");
    add(GROUPS.damage, "pcDamaged6e", "recovery with negative REC changes nothing");
    add(GROUPS.damage, "pcDamaged6e", "recovery never lowers END");
}

/**
 * Add the label handling cases, including the locale bug the refactor plan records.
 *
 * @param {Function} add Case builder.
 */
function labelCases(add) {
    add(GROUPS.labels, "bare", "hasCharacteristic answers the same for STR and str");
    add(GROUPS.labels, "bare", "getCharacteristic answers the same for STR and str");
    add(GROUPS.labels, "bare", "an unknown label reports a typo and not a lack");
    add(GROUPS.labels, "bare", "a Turkish locale resolves INT to the same node");
}

/**
 * Add the base and vehicle cost details no row states. Gap 9 sits here.
 *
 * @param {Function} add Case builder.
 */
function baseVehicleCases(add) {
    // A 5e base holds BASESIZE, BODY, and DEF. A 6e base holds BASESIZE, BODY, PD, and ED. Neither holds both.
    add(GROUPS.baseVehicle, "base5eDefCharge", "DEF costs the base charge and not the character charge");
    add(GROUPS.baseVehicle, "base5eDefCharge", "BODY costs the base charge");
    add(GROUPS.baseVehicle, "base5eDefCharge", "BASESIZE costs the base charge");
    add(GROUPS.baseVehicle, "base6ePdEdCharge", "PD costs the base charge and not the character charge");
    add(GROUPS.baseVehicle, "base6ePdEdCharge", "ED costs the base charge and not the character charge");
    add(GROUPS.baseVehicle, "base6ePdEdCharge", "BODY costs the base charge");
    add(GROUPS.baseVehicle, "vehicle5eDefRow", "DEF 8 levels equals the value the template states");
    add(GROUPS.baseVehicle, "vehicle5eDefRow", "DEF costs the base charge and not the character charge");
    add(GROUPS.baseVehicle, "vehicle5eDefRow", "PD reports 0, because the actor has only characteristics");
    add(GROUPS.baseVehicle, "vehicle5eDefRow", "ED reports 0, because the actor has only characteristics");
    add(GROUPS.baseVehicle, "vehicle5eDefRow", "DEF answers an attack that names PD");
    add(GROUPS.baseVehicle, "vehicle5eDefRow", "DEF answers an attack that names ED");
}

/**
 * Register the required cases as a pending tree.
 *
 * Quench reports the group and each title, so the work list shows up in the run report. Nothing here
 * creates an actor, so the batch costs no setup time.
 *
 * @param {object} quench The Quench instance.
 */
export function registerCharacteristicsRequiredTests(quench) {
    quench.registerBatch(
        `${game.system.id}.actor.characteristics.required`,
        (context) => {
            const { describe, it } = context;

            const casesByGroup = new Map();

            for (const oneCase of buildRequiredCases()) {
                const bucket = casesByGroup.get(oneCase.group) ?? [];

                bucket.push(oneCase.title);
                casesByGroup.set(oneCase.group, bucket);
            }

            describe.skip("Required characteristic coverage", function () {
                for (const group of Object.values(GROUPS)) {
                    describe.skip(group, function () {
                        for (const title of casesByGroup.get(group) ?? []) {
                            it.skip(title, function () {});
                        }
                    });
                }
            });
        },
        { displayName: "HERO: Characteristics Required (fixture work list)" },
    );
}
