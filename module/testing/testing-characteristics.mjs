/**
 * The static characteristic contract for every actor type.
 *
 * One table states which characteristics an actor type has. The driver below turns each row
 * into both halves of the contract: the labels the row lists, and every label it leaves out.
 * Adding an actor type means adding one row.
 *
 * Read the two caveats before you edit a row. They come from `characteristics_bugs.md`.
 *
 * Bug 4: five movement powers have no uppercase node, so `hasCharacteristic` answers false
 * for them even though the config grants them. They are FLIGHT, FTL, GLIDING, SWINGING,
 * TELEPORTATION, and TUNNELING. They never appear in a `has` list.
 *
 * Bug 3: every actor type stores a lowercase node for all 30 labels. A node therefore says
 * nothing about the actor type, so this file asks one question: `hasCharacteristic`. Read a node
 * only to read a value.
 */

import { freezeDeep } from "../utility/freeze-helpers.mjs";
import { charMax, charValue, createCharacteristicAssertions } from "./characteristic-assertions.mjs";
import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

const { Actor } = foundry.documents;

/**
 * Every label one edition defines, minus the unsupported custom labels.
 *
 * `CONFIG.HERO.characteristicHasTypes6e` and `...5e` hold the universe as keys: the characteristic
 * and movement descriptions of that edition, with the custom labels left out. Each edition gets its
 * own universe, so a 6e actor is never asked about COM, DEF, or GLIDING.
 *
 * Read these at run time, not at module load. `CONFIG.HERO` fills during system init.
 *
 * @param {string} edition Edition label, `5e` or `6e`.
 *
 * @returns {string[]} The labels that edition defines, sorted.
 */
function universeFor(edition) {
    return Object.keys(CONFIG.HERO[`characteristicHasTypes${edition}`]).sort();
}

/**
 * Which actor types have a label whose scope depends on the actor rather than on config.
 *
 * STUN declares no static scope. Its `ignoreForActor` reads the actor powers, so an automaton built
 * with "cannot be stunned" has no STUN. Every other label names the actor types that ignore it in its
 * description, and `CONFIG.HERO.characteristicHasTypes6e` reports the answer. A label the scope table
 * reports as `null` must appear here, which one test guards.
 */
const DYNAMIC_LABEL_OWNERSHIP = freezeDeep({
    STUN: { pc: true, npc: true, automaton: true, vehicle: false, base2: false, computer: false, ai: false },
});

/**
 * Movement labels one edition defines.
 *
 * The movement tables are the source. `movementPowers6e` and `...5e` key each mode by its lowercase
 * characteristic name.
 *
 * @param {string} edition Edition label, `5e` or `6e`.
 *
 * @returns {string[]} Movement labels, sorted.
 */
function movementLabelsFor(edition) {
    const table = edition === "5e" ? CONFIG.HERO.movementPowers5e : CONFIG.HERO.movementPowers6e;

    return Object.keys(table)
        .map((key) => key.toUpperCase())
        .sort();
}

/**
 * Movement modes the actor schema builds no uppercase node for.
 *
 * A bare actor owns no powers, so `hasMovementCharacteristic` can only answer true for a mode with a
 * node. Remove a label from this list when its node lands, and the declared scope decides from then on.
 */
const MOVEMENT_MODES_WITHOUT_NODE = freezeDeep([
    "EXTRADIMENSIONALMOVEMENT",
    "FLIGHT",
    "FTL",
    "GLIDING",
    "SWINGING",
    "TELEPORTATION",
    "TUNNELING",
]);

/**
 * Whether an actor type has a label.
 *
 * The scope table answers for every label with a declared scope. `DYNAMIC_LABEL_OWNERSHIP` answers for
 * the rest.
 *
 * @param {string} actorType Actor type to ask about.
 * @param {object} scopes    Scope table of one edition.
 * @param {string} label     Label to ask about.
 *
 * @returns {boolean} True when the type has the label.
 */
function ownsLabel(actorType, scopes, label) {
    const declared = scopes[label];

    if (declared === null) {
        return DYNAMIC_LABEL_OWNERSHIP[label]?.[actorType] === true;
    }

    return declared.includes(actorType);
}

/**
 * The has and lacks lists one actor type must satisfy, split by accessor.
 *
 * `hasCharacteristic` answers the characteristics half. `hasMovementCharacteristic` answers the
 * movement half. A template row can add labels in `hasBecauseOfPowers` and take labels away in
 * `lacksBecauseOfPowers`, because powers decide both.
 *
 * @param {string} actorType Actor type to ask about.
 * @param {string} edition   Edition label, `5e` or `6e`.
 * @param {object} [options]
 * @param {string[]} [options.granted] Labels the actor's powers add beyond the type row.
 * @param {string[]} [options.dropped] Labels the actor's powers take away.
 *
 * @returns {{ characteristics: {has: string[], lacks: string[]}, movement: {has: string[], lacks: string[]} }}
 */
function listsFor(actorType, edition, { granted = [], dropped = [] } = {}) {
    const scopes = CONFIG.HERO[`characteristicHasTypes${edition}`];
    const movement = movementLabelsFor(edition);
    const characteristics = universeFor(edition).filter((label) => !movement.includes(label));

    const build = (labels, { skipNodeless }) => {
        const has = labels.filter((label) => {
            if (dropped.includes(label)) {
                return false;
            }

            if (granted.includes(label)) {
                return true;
            }

            if (skipNodeless && MOVEMENT_MODES_WITHOUT_NODE.includes(label)) {
                return false;
            }

            return ownsLabel(actorType, scopes, label);
        });

        return { has, lacks: labels.filter((label) => !has.includes(label)) };
    };

    return {
        characteristics: build(characteristics, { skipNodeless: false }),
        movement: build(movement, { skipNodeless: true }),
    };
}

/** Both editions, in the order the suite reports them. */
const EDITIONS = freezeDeep([
    { label: "6e", is5e: false },
    { label: "5e", is5e: true },
]);

const BASE_5E_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Base.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST 5e Base" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                            <BACKGROUND />
                            <PERSONALITY />
                            <QUOTE />
                            <TACTICS />
                            <CAMPAIGN_USE />
                            <APPEARANCE />
                            <NOTES1 />
                            <NOTES2 />
                            <NOTES3 />
                            <NOTES4 />
                            <NOTES5 />
                          </CHARACTER_INFO>
                          <CHARACTERISTICS>
                            <BODY XMLID="BODY" ID="1766634909496" BASECOST="0.0" LEVELS="2" ALIAS="BODY" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </BODY>
                            <DEF XMLID="DEF" ID="1766634909453" BASECOST="0.0" LEVELS="13" ALIAS="DEF" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DEF>
                            <BASESIZE XMLID="BASESIZE" ID="1766634910012" BASECOST="0.0" LEVELS="20" ALIAS="Size" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </BASESIZE>
                          </CHARACTERISTICS>
                          <SKILLS />
                          <PERKS />
                          <TALENTS />
                          <MARTIALARTS />
                          <POWERS />
                          <DISADVANTAGES />
                          <EQUIPMENT />
                        </CHARACTER>
                    `;

const BASE_6E_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Base6E.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST 6e Base" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                            <BACKGROUND />
                            <PERSONALITY />
                            <QUOTE />
                            <TACTICS />
                            <CAMPAIGN_USE />
                            <APPEARANCE />
                            <NOTES1 />
                            <NOTES2 />
                            <NOTES3 />
                            <NOTES4 />
                            <NOTES5 />
                          </CHARACTER_INFO>
                          <CHARACTERISTICS>
                            <BASESIZE XMLID="BASESIZE" ID="1766634981782" BASECOST="0.0" LEVELS="14" ALIAS="Size" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </BASESIZE>
                            <PD XMLID="PD" ID="1766634981882" BASECOST="0.0" LEVELS="5" ALIAS="PD" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1766634981588" BASECOST="0.0" LEVELS="4" ALIAS="ED" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </ED>
                            <BODY XMLID="BODY" ID="1766634981594" BASECOST="0.0" LEVELS="8" ALIAS="BODY" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </BODY>
                          </CHARACTERISTICS>
                          <SKILLS />
                          <PERKS />
                          <TALENTS />
                          <MARTIALARTS />
                          <POWERS />
                          <DISADVANTAGES />
                          <EQUIPMENT />
                        </CHARACTER>
                    `;

const VEHICLE_6E_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Vehicle6E.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="150" DISAD_POINTS="0" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST ARC-170 Starfighter" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                            <BACKGROUND />
                            <PERSONALITY />
                            <QUOTE />
                            <TACTICS />
                            <CAMPAIGN_USE />
                            <APPEARANCE />
                            <NOTES1 />
                            <NOTES2 />
                            <NOTES3 />
                            <NOTES4 />
                            <NOTES5 />
                          </CHARACTER_INFO>
                          <CHARACTERISTICS>
                            <SIZE XMLID="SIZE" ID="1764554705399" BASECOST="0.0" LEVELS="8" ALIAS="Size" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </SIZE>
                            <STR XMLID="STR" ID="1764554705302" BASECOST="0.0" LEVELS="5" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1764554705479" BASECOST="0.0" LEVELS="-10" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DEX>
                            <BODY XMLID="BODY" ID="1764554705292" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </BODY>
                            <SPD XMLID="SPD" ID="1764554705648" BASECOST="0.0" LEVELS="3" ALIAS="SPD" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </SPD>
                            <OCV XMLID="OCV" ID="1764554705538" BASECOST="0.0" LEVELS="2" ALIAS="OCV" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </OCV>
                            <DCV XMLID="DCV" ID="1764554705156" BASECOST="0.0" LEVELS="4" ALIAS="DCV" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DCV>
                            <PD XMLID="PD" ID="1764554705702" BASECOST="0.0" LEVELS="2" ALIAS="PD" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1764554705151" BASECOST="0.0" LEVELS="2" ALIAS="ED" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </ED>
                            <RUNNING XMLID="RUNNING" ID="1764554705215" BASECOST="0.0" LEVELS="-12" ALIAS="Ground Movement" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1764554705069" BASECOST="0.0" LEVELS="-4" ALIAS="Swimming" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1764554705539" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </LEAPING>
                          </CHARACTERISTICS>
                          <SKILLS />
                          <PERKS />
                          <TALENTS />
                          <MARTIALARTS />
                          <POWERS>
                            <POWER XMLID="FLIGHT" ID="1764555963102" BASECOST="0.0" LEVELS="106" ALIAS="Flight" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="IGP-440a Ion Turbine Engines" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </POWER>
                          </POWERS>
                          <DISADVANTAGES />
                          <EQUIPMENT />
                        </CHARACTER>
                    `;

const VEHICLE_5E_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Vehicle.hdt">
                            <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                            <CHARACTER_INFO CHARACTER_NAME="5e TEST Vehicle" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                                <BACKGROUND />
                                <PERSONALITY />
                                <QUOTE />
                                <TACTICS />
                                <CAMPAIGN_USE />
                                <APPEARANCE />
                                <NOTES1 />
                                <NOTES2 />
                                <NOTES3 />
                                <NOTES4 />
                                <NOTES5 />
                            </CHARACTER_INFO>
                            <CHARACTERISTICS>
                                <SIZE XMLID="SIZE" ID="1766364915406" BASECOST="0.0" LEVELS="12" ALIAS="Size" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SIZE>
                                <STR XMLID="STR" ID="1766364915761" BASECOST="0.0" LEVELS="-50" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STR>
                                <DEX XMLID="DEX" ID="1766364915217" BASECOST="0.0" LEVELS="22" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DEX>
                                <BODY XMLID="BODY" ID="1766364915650" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </BODY>
                                <DEF XMLID="DEF" ID="1766364915802" BASECOST="0.0" LEVELS="8" ALIAS="DEF" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DEF>
                                <SPD XMLID="SPD" ID="1766364915514" BASECOST="0.0" LEVELS="1" ALIAS="SPD" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SPD>
                                <RUNNING XMLID="RUNNING" ID="1766364915233" BASECOST="0.0" LEVELS="-6" ALIAS="Ground Movement" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </RUNNING>
                                <SWIMMING XMLID="SWIMMING" ID="1766364915261" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SWIMMING>
                                <LEAPING XMLID="LEAPING" ID="1766364915501" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </LEAPING>
                            </CHARACTERISTICS>
                            <SKILLS />
                            <PERKS />
                            <TALENTS />
                            <MARTIALARTS />
                            <POWERS>
                                <POWER XMLID="FLIGHT" ID="1766364929971" BASECOST="0.0" LEVELS="1" ALIAS="Flight" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <ADDER XMLID="IMPROVEDNONCOMBAT" ID="1766366073065" BASECOST="0.0" LEVELS="1" ALIAS="x4 Noncombat" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <ADDER XMLID="POSITIONSHIFT" ID="1766366073066" BASECOST="5.0" LEVELS="0" ALIAS="Position Shift" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <MODIFIER XMLID="NOGRAVITYPENALTY" ID="1766366073067" BASECOST="0.5" LEVELS="0" ALIAS="No Gravity Penalty" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="LIMITEDMANEUVERABILITY" ID="1766366073085" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Maneuverability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PHASE" OPTIONID="PHASE" OPTION_ALIAS="Only 2 turns per Phase at Combat speed; only 1 turn per Phase at Noncombat speed" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="STALLVELOCITY" ID="1766366073091" BASECOST="-0.25" LEVELS="0" ALIAS="Stall Velocity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALF" OPTIONID="HALF" OPTION_ALIAS="1/2 Vehicle's Maximum Combat Velocity" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="NOBACKWARDS" ID="1766366078183" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Move Backwards" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="CREWSERVED" ID="1766366086852" BASECOST="-0.25" LEVELS="0" ALIAS="Crew-Served" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2" OPTIONID="2" OPTION_ALIAS="2 people" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="FUELDEPENDENT" ID="1766366090248" BASECOST="0.0" LEVELS="0" ALIAS="Fuel Dependent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="COMMONALITY" ID="1766366090254" BASECOST="-0.25" LEVELS="0" ALIAS="Commonality" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYCOMMON" OPTIONID="VERYCOMMON" OPTION_ALIAS="fuel is Very Common" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="REFUELINGTIME" ID="1766366090263" BASECOST="-1.5" LEVELS="0" ALIAS="Refueling Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINUTE" OPTIONID="MINUTE" OPTION_ALIAS="must refuel Once per Minute" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                <MODIFIER XMLID="ONLYONSURFACE" ID="1766366097719" BASECOST="-0.25" LEVELS="0" ALIAS="Only In Contact With A Surface" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="TAKEOFFLANDING" ID="1766366102958" BASECOST="-1.0" LEVELS="0" ALIAS="Takeoff/Landing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="NOCONSCIOUSCONTROL" ID="1766366115229" BASECOST="-2.0" LEVELS="0" ALIAS="No Conscious Control" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="LEVITATION" ID="1766366118689" BASECOST="-0.5" LEVELS="0" ALIAS="Levitation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="GRADUALEFFECT" ID="1766366124277" BASECOST="-0.25" LEVELS="0" ALIAS="Gradual Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1TURN" OPTIONID="1TURN" OPTION_ALIAS="1 Turn (Post-Segment 12)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="FLIGHT" ID="1766366138278" BASECOST="0.0" LEVELS="1" ALIAS="Flight" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <ADDER XMLID="IMPROVEDNONCOMBAT" ID="1766366139814" BASECOST="0.0" LEVELS="1" ALIAS="x4 Noncombat" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <ADDER XMLID="POSITIONSHIFT" ID="1766366139815" BASECOST="5.0" LEVELS="0" ALIAS="Position Shift" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <MODIFIER XMLID="NOGRAVITYPENALTY" ID="1766366139816" BASECOST="0.5" LEVELS="0" ALIAS="No Gravity Penalty" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="LIMITEDMANEUVERABILITY" ID="1766366139834" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Maneuverability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PHASE" OPTIONID="PHASE" OPTION_ALIAS="Only 2 turns per Phase at Combat speed; only 1 turn per Phase at Noncombat speed" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="STALLVELOCITY" ID="1766366139840" BASECOST="-0.25" LEVELS="0" ALIAS="Stall Velocity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALF" OPTIONID="HALF" OPTION_ALIAS="1/2 Vehicle's Maximum Combat Velocity" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="NOBACKWARDS" ID="1766366139842" BASECOST="-0.25" LEVELS="0" ALIAS="Cannot Move Backwards" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="CREWSERVED" ID="1766366139853" BASECOST="-0.25" LEVELS="0" ALIAS="Crew-Served" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2" OPTIONID="2" OPTION_ALIAS="2 people" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="FUELDEPENDENT" ID="1766366139886" BASECOST="0.0" LEVELS="0" ALIAS="Fuel Dependent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="COMMONALITY" ID="1766366139860" BASECOST="-0.25" LEVELS="0" ALIAS="Commonality" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="VERYCOMMON" OPTIONID="VERYCOMMON" OPTION_ALIAS="fuel is Very Common" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="REFUELINGTIME" ID="1766366139869" BASECOST="-1.5" LEVELS="0" ALIAS="Refueling Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINUTE" OPTIONID="MINUTE" OPTION_ALIAS="must refuel Once per Minute" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="No" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                <MODIFIER XMLID="ONLYONSURFACE" ID="1766366139887" BASECOST="-0.25" LEVELS="0" ALIAS="Only In Contact With A Surface" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="TAKEOFFLANDING" ID="1766366139888" BASECOST="-1.0" LEVELS="0" ALIAS="Takeoff/Landing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="NOCONSCIOUSCONTROL" ID="1766366139890" BASECOST="-2.0" LEVELS="0" ALIAS="No Conscious Control" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="LEVITATION" ID="1766366139891" BASECOST="-0.5" LEVELS="0" ALIAS="Levitation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="GRADUALEFFECT" ID="1766366139908" BASECOST="-0.25" LEVELS="0" ALIAS="Gradual Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1TURN" OPTIONID="1TURN" OPTION_ALIAS="1 Turn (Post-Segment 12)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="FULLREVERSE" ID="1766366148488" BASECOST="0.25" LEVELS="0" ALIAS="Full Reverse" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="SIDEWAYSMANEUVERABILITY" ID="1766366155500" BASECOST="0.5" LEVELS="0" ALIAS="Sideways Maneuverability" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FULL" OPTIONID="FULL" OPTION_ALIAS="full velocity" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="USABLEUNDERWATER" ID="1766366162586" BASECOST="0.25" LEVELS="0" ALIAS="Usable Underwater" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="NONCOMBATACCELERATION" ID="1766366166698" BASECOST="1.0" LEVELS="0" ALIAS="Noncombat acceleration/deceleration" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="NOTURNMODE" ID="1766366170132" BASECOST="0.25" LEVELS="0" ALIAS="No Turn Mode" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="DIFFICULTTOOPERATE" ID="1766366192217" BASECOST="-0.25" LEVELS="0" ALIAS="Difficult to Operate" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="FTL" ID="1766443185498" BASECOST="10.0" LEVELS="25" ALIAS="Faster-Than-Light Travel" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </POWER>
                            </POWERS>
                            <DISADVANTAGES />
                            <EQUIPMENT />
                        </CHARACTER>
                    `;

const AUTOMATON_5E_CAN_NOT_BE_STUNNED_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Automaton.hdt">
                            <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                            <CHARACTER_INFO CHARACTER_NAME="TEST 5e Automaton - Cannot Be Stunned" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                                <BACKGROUND />
                                <PERSONALITY />
                                <QUOTE />
                                <TACTICS />
                                <CAMPAIGN_USE />
                                <APPEARANCE />
                                <NOTES1 />
                                <NOTES2 />
                                <NOTES3 />
                                <NOTES4 />
                                <NOTES5 />
                            </CHARACTER_INFO>
                            <CHARACTERISTICS>
                                <STR XMLID="STR" ID="1766373645598" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STR>
                                <DEX XMLID="DEX" ID="1766373646365" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DEX>
                                <CON XMLID="CON" ID="1766373646426" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </CON>
                                <BODY XMLID="BODY" ID="1766373645962" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </BODY>
                                <INT XMLID="INT" ID="1766373646178" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </INT>
                                <EGO XMLID="EGO" ID="1766373646143" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </EGO>
                                <PRE XMLID="PRE" ID="1766373645964" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PRE>
                                <COM XMLID="COM" ID="1766373646317" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </COM>
                                <PD XMLID="PD" ID="1766373645824" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PD>
                                <ED XMLID="ED" ID="1766373645563" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </ED>
                                <SPD XMLID="SPD" ID="1766373646495" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SPD>
                                <REC XMLID="REC" ID="1766373645614" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </REC>
                                <END XMLID="END" ID="1766373646021" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </END>
                                <STUN XMLID="STUN" ID="1766373645863" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STUN>
                                <RUNNING XMLID="RUNNING" ID="1766373645885" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </RUNNING>
                                <SWIMMING XMLID="SWIMMING" ID="1766373645668" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SWIMMING>
                                <LEAPING XMLID="LEAPING" ID="1766373646058" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </LEAPING>
                            </CHARACTERISTICS>
                            <SKILLS />
                            <PERKS />
                            <TALENTS />
                            <MARTIALARTS />
                            <POWERS>
                                <POWER XMLID="AUTOMATON" ID="1766373672141" BASECOST="15.0" LEVELS="0" ALIAS="Automaton" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CANNOTBESTUNNED" OPTIONID="CANNOTBESTUNNED" OPTION_ALIAS="Cannot Be Stunned" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </POWER>
                            </POWERS>
                            <DISADVANTAGES />
                            <EQUIPMENT />
                        </CHARACTER>
                    `;

const AUTOMATON_5E_BODY_DAMAGE_REMOVES_ABILITY_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Automaton.hdt">
                            <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                            <CHARACTER_INFO CHARACTER_NAME="TEST 5e Automaton - No STUN Loses Abilities on BODY Loss" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                                <BACKGROUND />
                                <PERSONALITY />
                                <QUOTE />
                                <TACTICS />
                                <CAMPAIGN_USE />
                                <APPEARANCE />
                                <NOTES1 />
                                <NOTES2 />
                                <NOTES3 />
                                <NOTES4 />
                                <NOTES5 />
                            </CHARACTER_INFO>
                            <CHARACTERISTICS>
                                <STR XMLID="STR" ID="1766373703969" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STR>
                                <DEX XMLID="DEX" ID="1766373704222" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DEX>
                                <CON XMLID="CON" ID="1766373704335" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </CON>
                                <BODY XMLID="BODY" ID="1766373704053" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </BODY>
                                <INT XMLID="INT" ID="1766373704716" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </INT>
                                <EGO XMLID="EGO" ID="1766373704244" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </EGO>
                                <PRE XMLID="PRE" ID="1766373703907" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PRE>
                                <COM XMLID="COM" ID="1766373704550" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </COM>
                                <PD XMLID="PD" ID="1766373703977" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PD>
                                <ED XMLID="ED" ID="1766373704537" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </ED>
                                <SPD XMLID="SPD" ID="1766373704202" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SPD>
                                <REC XMLID="REC" ID="1766373704715" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </REC>
                                <END XMLID="END" ID="1766373704616" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </END>
                                <STUN XMLID="STUN" ID="1766373704216" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STUN>
                                <RUNNING XMLID="RUNNING" ID="1766373704826" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </RUNNING>
                                <SWIMMING XMLID="SWIMMING" ID="1766373704257" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SWIMMING>
                                <LEAPING XMLID="LEAPING" ID="1766373704815" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </LEAPING>
                            </CHARACTERISTICS>
                            <SKILLS />
                            <PERKS />
                            <TALENTS />
                            <MARTIALARTS />
                            <POWERS>
                                <POWER XMLID="AUTOMATON" ID="1766373719617" BASECOST="45.0" LEVELS="0" ALIAS="Automaton" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NOSTUN1" OPTIONID="NOSTUN1" OPTION_ALIAS="Takes No STUN (loses abilities when takes BODY)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </POWER>
                            </POWERS>
                            <DISADVANTAGES />
                            <EQUIPMENT />
                        </CHARACTER>
                    `;

const AUTOMATON_5E_CANNOT_TAKE_STUN_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Automaton.hdt">
                            <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                            <CHARACTER_INFO CHARACTER_NAME="TEST 5e Automaton - Take No STUN - No Ability Loss" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                                <BACKGROUND />
                                <PERSONALITY />
                                <QUOTE />
                                <TACTICS />
                                <CAMPAIGN_USE />
                                <APPEARANCE />
                                <NOTES1 />
                                <NOTES2 />
                                <NOTES3 />
                                <NOTES4 />
                                <NOTES5 />
                            </CHARACTER_INFO>
                            <CHARACTERISTICS>
                                <STR XMLID="STR" ID="1766373784941" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STR>
                                <DEX XMLID="DEX" ID="1766373784770" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DEX>
                                <CON XMLID="CON" ID="1766373784681" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </CON>
                                <BODY XMLID="BODY" ID="1766373784989" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </BODY>
                                <INT XMLID="INT" ID="1766373784947" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </INT>
                                <EGO XMLID="EGO" ID="1766373784818" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </EGO>
                                <PRE XMLID="PRE" ID="1766373784996" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PRE>
                                <COM XMLID="COM" ID="1766373785211" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </COM>
                                <PD XMLID="PD" ID="1766373784657" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PD>
                                <ED XMLID="ED" ID="1766373784399" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </ED>
                                <SPD XMLID="SPD" ID="1766373785189" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SPD>
                                <REC XMLID="REC" ID="1766373784624" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </REC>
                                <END XMLID="END" ID="1766373785103" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </END>
                                <STUN XMLID="STUN" ID="1766373784898" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STUN>
                                <RUNNING XMLID="RUNNING" ID="1766373784396" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </RUNNING>
                                <SWIMMING XMLID="SWIMMING" ID="1766373784578" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SWIMMING>
                                <LEAPING XMLID="LEAPING" ID="1766373785068" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </LEAPING>
                            </CHARACTERISTICS>
                            <SKILLS />
                            <PERKS />
                            <TALENTS />
                            <MARTIALARTS />
                            <POWERS>
                                <POWER XMLID="AUTOMATON" ID="1766373788431" BASECOST="60.0" LEVELS="0" ALIAS="Automaton" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NOSTUN2" OPTIONID="NOSTUN2" OPTION_ALIAS="Takes No STUN" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </POWER>
                            </POWERS>
                            <DISADVANTAGES />
                            <EQUIPMENT />
                        </CHARACTER>
                    `;

const AUTOMATON_5E_TOO_MANY_POWERS_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Automaton.hdt">
                        <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                        <CHARACTER_INFO CHARACTER_NAME="5e All Automaton" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                            <BACKGROUND />
                            <PERSONALITY />
                            <QUOTE />
                            <TACTICS />
                            <CAMPAIGN_USE />
                            <APPEARANCE />
                            <NOTES1 />
                            <NOTES2 />
                            <NOTES3 />
                            <NOTES4 />
                            <NOTES5 />
                        </CHARACTER_INFO>
                        <CHARACTERISTICS>
                            <STR XMLID="STR" ID="1783776574885" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1783776575205" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEX>
                            <CON XMLID="CON" ID="1783776574729" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </CON>
                            <BODY XMLID="BODY" ID="1783776575462" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </BODY>
                            <INT XMLID="INT" ID="1783776575281" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1783776575155" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </EGO>
                            <PRE XMLID="PRE" ID="1783776575588" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PRE>
                            <COM XMLID="COM" ID="1783776575090" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </COM>
                            <PD XMLID="PD" ID="1783776575017" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1783776574808" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </ED>
                            <SPD XMLID="SPD" ID="1783776575179" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SPD>
                            <REC XMLID="REC" ID="1783776575232" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </REC>
                            <END XMLID="END" ID="1783776575330" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </END>
                            <STUN XMLID="STUN" ID="1783776574991" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STUN>
                            <RUNNING XMLID="RUNNING" ID="1783776575127" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1783776575111" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1783776575394" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </LEAPING>
                        </CHARACTERISTICS>
                        <SKILLS />
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS />
                        <POWERS>
                            <POWER XMLID="AUTOMATON" ID="1783776590548" BASECOST="15.0" LEVELS="0" ALIAS="Automaton" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CANNOTBESTUNNED" OPTIONID="CANNOTBESTUNNED" OPTION_ALIAS="Cannot Be Stunned" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </POWER>
                            <POWER XMLID="AUTOMATON" ID="1783776599588" BASECOST="45.0" LEVELS="0" ALIAS="Automaton" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NOSTUN1" OPTIONID="NOSTUN1" OPTION_ALIAS="Takes No STUN (loses abilities when takes BODY)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </POWER>
                            <POWER XMLID="AUTOMATON" ID="1783776606700" BASECOST="60.0" LEVELS="0" ALIAS="Automaton" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NOSTUN2" OPTIONID="NOSTUN2" OPTION_ALIAS="Takes No STUN" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </POWER>
                            <POWER XMLID="NOHITLOCATIONS" ID="1783776648332" BASECOST="10.0" LEVELS="0" ALIAS="No Hit Locations" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </POWER>
                            <POWER XMLID="DOESNOTBLEED" ID="1783776658044" BASECOST="15.0" LEVELS="0" ALIAS="Does Not Bleed" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </POWER>
                        </POWERS>
                        <DISADVANTAGES />
                        <EQUIPMENT />
                        </CHARACTER>
                    `;

const PC_6E_AUTOMATON_BODY_DAMAGE_REMOVES_ABILITY_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Superheroic6E.hdt">
                            <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                            <CHARACTER_INFO CHARACTER_NAME="" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
                                <BACKGROUND />
                                <PERSONALITY />
                                <QUOTE />
                                <TACTICS />
                                <CAMPAIGN_USE />
                                <APPEARANCE />
                                <NOTES1 />
                                <NOTES2 />
                                <NOTES3 />
                                <NOTES4 />
                                <NOTES5 />
                            </CHARACTER_INFO>
                            <CHARACTERISTICS>
                                <STR XMLID="STR" ID="1766428236220" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STR>
                                <DEX XMLID="DEX" ID="1766428236472" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DEX>
                                <CON XMLID="CON" ID="1766428236179" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </CON>
                                <INT XMLID="INT" ID="1766428236607" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </INT>
                                <EGO XMLID="EGO" ID="1766428236609" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </EGO>
                                <PRE XMLID="PRE" ID="1766428236406" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PRE>
                                <OCV XMLID="OCV" ID="1766428236422" BASECOST="0.0" LEVELS="0" ALIAS="OCV" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </OCV>
                                <DCV XMLID="DCV" ID="1766428236218" BASECOST="0.0" LEVELS="0" ALIAS="DCV" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DCV>
                                <OMCV XMLID="OMCV" ID="1766428236421" BASECOST="0.0" LEVELS="0" ALIAS="OMCV" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </OMCV>
                                <DMCV XMLID="DMCV" ID="1766428235875" BASECOST="0.0" LEVELS="0" ALIAS="DMCV" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DMCV>
                                <SPD XMLID="SPD" ID="1766428235936" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SPD>
                                <PD XMLID="PD" ID="1766428236309" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PD>
                                <ED XMLID="ED" ID="1766428236193" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </ED>
                                <REC XMLID="REC" ID="1766428236280" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </REC>
                                <END XMLID="END" ID="1766428236778" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </END>
                                <BODY XMLID="BODY" ID="1766428236144" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </BODY>
                                <STUN XMLID="STUN" ID="1766428236357" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STUN>
                                <RUNNING XMLID="RUNNING" ID="1766428236655" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </RUNNING>
                                <SWIMMING XMLID="SWIMMING" ID="1766428236058" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SWIMMING>
                                <LEAPING XMLID="LEAPING" ID="1766428236774" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </LEAPING>
                            </CHARACTERISTICS>
                            <SKILLS />
                            <PERKS />
                            <TALENTS />
                            <MARTIALARTS />
                            <POWERS>
                                <POWER XMLID="AUTOMATON" ID="1766428244000" BASECOST="45.0" LEVELS="0" ALIAS="Automaton" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NOSTUN1" OPTIONID="NOSTUN1" OPTION_ALIAS="Takes No STUN (loses abilities when takes BODY)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </POWER>
                            </POWERS>
                            <DISADVANTAGES />
                            <EQUIPMENT />
                        </CHARACTER>
                    `;

/**
 * Uploaded templates that must answer exactly like their actor type.
 *
 * An upload must not widen or narrow the contract its actor type already states. Each row
 * reuses its actor type row, so a template cannot drift from its type unnoticed.
 *
 * `usableSet` asks a second question: which labels the config lets that type use. It holds for
 * a base, where the usable set and the has set match. It cannot hold for a pc, because five
 * movement powers are usable but report no characteristic. See bug 4.
 *
 * `lacksBecauseOfPowers` names labels an automation power takes away. STUN is the one that
 * behaves this way: an automaton, or a pc carrying the automaton power, can lose STUN while the
 * actor type stays the same.
 */
const UPLOADED_TEMPLATE_CONTRACTS = freezeDeep([
    {
        title: "5e base template",
        actorType: "base2",
        is5e: true,
        edition: "5e",
        contents: BASE_5E_XML,
        usableSet: true,
    },
    {
        title: "6e base template",
        actorType: "base2",
        is5e: false,
        edition: "6e",
        contents: BASE_6E_XML,
        usableSet: true,
    },
    {
        title: "6e vehicle template",
        actorType: "vehicle",
        is5e: false,
        edition: "6e",
        contents: VEHICLE_6E_XML,
        usableSet: false,
        hasBecauseOfPowers: ["FLIGHT"],
    },
    {
        title: "5e vehicle template",
        actorType: "vehicle",
        is5e: true,
        edition: "5e",
        contents: VEHICLE_5E_XML,
        usableSet: false,
        hasBecauseOfPowers: ["FLIGHT", "FTL"],
    },
    {
        title: "5e automaton that cannot be stunned",
        actorType: "automaton",
        is5e: true,
        edition: "5e",
        contents: AUTOMATON_5E_CAN_NOT_BE_STUNNED_XML,
        usableSet: false,
    },
    {
        title: "5e automaton whose BODY damage removes the ability to act",
        actorType: "automaton",
        is5e: true,
        edition: "5e",
        contents: AUTOMATON_5E_BODY_DAMAGE_REMOVES_ABILITY_XML,
        usableSet: false,
        lacksBecauseOfPowers: ["STUN"],
    },
    {
        title: "5e automaton that cannot take STUN",
        actorType: "automaton",
        is5e: true,
        edition: "5e",
        contents: AUTOMATON_5E_CANNOT_TAKE_STUN_XML,
        usableSet: false,
        lacksBecauseOfPowers: ["STUN"],
    },
    {
        title: "5e automaton with too many automaton powers",
        actorType: "automaton",
        is5e: true,
        edition: "5e",
        contents: AUTOMATON_5E_TOO_MANY_POWERS_XML,
        usableSet: false,
        lacksBecauseOfPowers: ["STUN"],
    },
    {
        title: "6e pc with the automaton power that removes STUN",
        actorType: "pc",
        is5e: false,
        edition: "6e",
        contents: PC_6E_AUTOMATON_BODY_DAMAGE_REMOVES_ABILITY_XML,
        usableSet: false,
        lacksBecauseOfPowers: ["STUN"],
    },
]);

/**
 * Default movement and BODY values a bare actor gets, per edition.
 *
 * Phase 3 of `characteristics_test_consolidation_plan.md` widens this table to the uploaded
 * templates and drops the duplicates that survive in other suites.
 */
const DEFAULT_VALUES = freezeDeep({
    pc: { "6e": { RUNNING: 12, SWIMMING: 4, LEAPING: 4 }, "5e": { RUNNING: 6, SWIMMING: 2, LEAPING: 2 } },
    npc: { "6e": { RUNNING: 12, SWIMMING: 4, LEAPING: 4 }, "5e": { RUNNING: 6, SWIMMING: 2, LEAPING: 2 } },
    automaton: { "6e": { RUNNING: 12 }, "5e": { RUNNING: 6 } },
    base2: { "6e": { BODY: 2 }, "5e": { BODY: 2 } },
});

/**
 * Read a default the way the suite always has: the value, or the max when no value exists.
 *
 * @param {HeroSystem6eActor} actor Actor to read through the funnel.
 * @param {string} label Characteristic label. Any case.
 *
 * @returns {number|undefined} The value, else the max, else undefined.
 */
function defaultValue(actor, label) {
    const value = charValue(actor, label);

    if (value !== undefined) {
        return value;
    }

    return charMax(actor, label);
}

/**
 * The has and lacks lists one uploaded template must satisfy.
 *
 * The actor type states the starting lists. Powers then move labels in each direction, through
 * `hasBecauseOfPowers` and `lacksBecauseOfPowers`.
 *
 * @param {object} template One entry of `UPLOADED_TEMPLATE_CONTRACTS`.
 *
 * @returns {{ characteristics: object, movement: object }} The two accessor halves of the contract.
 */
function contractFor(template) {
    return listsFor(template.actorType, template.edition, {
        granted: template.hasBecauseOfPowers,
        dropped: template.lacksBecauseOfPowers,
    });
}

export function registerDefaultCharacteristicsForEachActorTypeTests(quench) {
    const createdActors = [];

    // A failed test keeps its actor, so the world still holds the evidence. Global teardown
    // sweeps `_Quench` actors, so a leak stays bounded.
    const cleanup = async (suiteContext) => {
        for (const actor of createdActors) {
            await deleteQuenchActor({ quench: suiteContext, actor });
        }

        createdActors.length = 0;
    };

    quench.registerBatch(
        `${game.system.id}.actor.characteristics`,
        (context) => {
            const { after, assert, before, describe, it } = context;
            const chars = createCharacteristicAssertions(assert);

            // A bare actor of one type and edition serves every table below, so create each once.
            const sharedActors = new Map();

            /**
             * The bare actor of one type and edition, created on first use.
             *
             * @param {string} actorType Actor type to create.
             * @param {object} edition     One entry of `EDITIONS`.
             *
             * @returns {Promise<HeroSystem6eActor>} The actor.
             */
            const sharedActor = async (actorType, edition) => {
                const key = `${actorType}|${edition.label}`;

                if (!sharedActors.has(key)) {
                    const actor = await Actor.create({
                        name: `Test-${actorType}-${edition.label}`,
                        type: actorType,
                        system: { is5e: edition.is5e },
                    });
                    createdActors.push(actor);
                    sharedActors.set(key, actor);
                }

                return sharedActors.get(key);
            };

            describe("Characteristics by actor type", function () {
                setQuenchTimeout(this, 20000);

                after(async function () {
                    await cleanup(this);
                });

                describe("Custom characteristics", () => {
                    for (const actorType of CONFIG.HERO.creatableActorTypes) {
                        for (const edition of EDITIONS) {
                            it(`no ${actorType} [${edition.label}] has a custom characteristic`, async function () {
                                // Hero Designer offers CUSTOM1 to CUSTOM10 and nothing builds them, so no
                                // actor can have one. Give a label a builder, drop it from
                                // `CONFIG.HERO.customCharacteristicLabels`, and the scope tables take it in.
                                const actor = await sharedActor(actorType, edition);

                                for (const label of CONFIG.HERO.customCharacteristicLabels) {
                                    chars.assertLacksChar(actor, label);
                                }
                            });
                        }
                    }
                });

                describe("Scope tables", () => {
                    for (const edition of EDITIONS) {
                        it(`every ${edition.label} label without a declared scope has an ownership rule`, function () {
                            const scopes = CONFIG.HERO[`characteristicHasTypes${edition.label}`];

                            for (const [label, declared] of Object.entries(scopes)) {
                                if (declared === null) {
                                    assert.property(
                                        DYNAMIC_LABEL_OWNERSHIP,
                                        label,
                                        `${label} [${edition.label}] needs a rule in DYNAMIC_LABEL_OWNERSHIP`,
                                    );
                                }
                            }
                        });

                        it(`every ${edition.label} declared scope names creatable actor types only`, function () {
                            const scopes = CONFIG.HERO[`characteristicHasTypes${edition.label}`];

                            for (const [label, declared] of Object.entries(scopes)) {
                                for (const actorType of declared ?? []) {
                                    assert.include(
                                        CONFIG.HERO.creatableActorTypes,
                                        actorType,
                                        `${label} [${edition.label}] scope names ${actorType}, which no actor creates`,
                                    );
                                }
                            }
                        });
                    }
                });

                describe("Has characteristic by actor type", () => {
                    for (const actorType of CONFIG.HERO.creatableActorTypes) {
                        for (const edition of EDITIONS) {
                            it(`Validate type ${actorType} [${edition.label}] characteristics precisely`, async function () {
                                const actor = await sharedActor(actorType, edition);
                                const lists = listsFor(actorType, edition.label);

                                chars.assertHasCharacteristicMatrix(actor, lists.characteristics);
                                chars.assertHasMovementMatrix(actor, lists.movement);
                            });
                        }
                    }
                });

                describe("Has characteristic by template", () => {
                    for (const template of UPLOADED_TEMPLATE_CONTRACTS) {
                        describe(template.title, async function () {
                            let actor;

                            before(async function () {
                                actor = await createQuenchActor({
                                    quench: this,
                                    contents: template.contents,
                                    is5e: template.is5e,
                                    actorType: template.actorType,
                                });
                            });

                            after(async function () {
                                await deleteQuenchActor({ quench: this, actor });
                            });

                            it("should have exactly the characteristics its powers allow", function () {
                                const contract = contractFor(template);

                                chars.assertHasCharacteristicMatrix(actor, contract.characteristics);
                                chars.assertHasMovementMatrix(actor, contract.movement);
                            });

                            if (template.usableSet) {
                                it("should be able to use exactly that set", function () {
                                    const contract = contractFor(template);

                                    chars.assertExactCharSet(actor, [
                                        ...contract.characteristics.has,
                                        ...contract.movement.has,
                                    ]);
                                });
                            }
                        });
                    }
                });

                describe("Default values by actor type", () => {
                    after(async function () {
                        await cleanup(this);
                    });

                    for (const actorType of Object.keys(DEFAULT_VALUES)) {
                        for (const edition of EDITIONS) {
                            it(`Validate type ${actorType} [${edition.label}] default values`, async function () {
                                const actor = await Actor.create({
                                    name: `Test-${actorType}-defaults-${edition.label}`,
                                    type: actorType,
                                    system: { is5e: edition.is5e },
                                });
                                createdActors.push(actor);

                                const expectedValues = DEFAULT_VALUES[actorType][edition.label];

                                for (const [label, expected] of Object.entries(expectedValues)) {
                                    assert.equal(
                                        defaultValue(actor, label),
                                        expected,
                                        `${actorType} [${edition.label}] ${label} default`,
                                    );
                                }
                            });
                        }
                    }
                });

                describe("Unknown actor type coverage", () => {
                    after(async function () {
                        await cleanup(this);
                    });

                    it("Catch unexpected variations or undocumented actor types", () => {
                        const documented = [...CONFIG.HERO.creatableActorTypes, "base"];

                        for (const actorType of Actor.TYPES) {
                            assert.include(
                                documented,
                                actorType,
                                `Unrecognized type "${actorType}" detected without validation logic.`,
                            );
                        }
                    });
                });
            });
        },
        { displayName: "HERO: Default characteristics for each actor type" },
    );
}
