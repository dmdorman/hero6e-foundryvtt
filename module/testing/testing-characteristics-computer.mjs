/**
 * The computer characteristic suite.
 *
 * Every test reads an uploaded Hero Designer export. `before` uploads one export per describe, and
 * `after` deletes that actor, so no test reads an actor another test changed. No test reads a bare
 * actor: the export is the subject.
 *
 * A computer has mental characteristics and nothing else: no BODY, no END, no movement. OCV and DCV read
 * 3, and that claim carries a bug. `characteristics_bugs.md` bug 7: a computer read DCV 3 when created
 * and DCV 2 when uploaded, because encumbrance ran on one path only. The upload path is the one users
 * take, so these tests state 3 and state that no encumbrance effect appears.
 *
 * The `FIXTURES` table holds every expectation. Read a row to know what the suite checks. To cover a
 * new export, add a row.
 */

import { freezeDeep } from "../utility/freeze-helpers.mjs";
import { createCharacteristicAssertions } from "./characteristic-assertions.mjs";
import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

const COMPUTER_5E_ZERO_POINT_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Computer.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST 5e Computer 0 Points" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <DEX XMLID="DEX" ID="1794010461304" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DEX>
                            <INT XMLID="INT" ID="1794010461065" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </INT>
                            <SPD XMLID="SPD" ID="1794010461428" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </SPD>
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

const COMPUTER_6E_ZERO_POINT_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Computer6E.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST 6e Computer 0 Points" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <DEX XMLID="DEX" ID="1794010730300" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DEX>
                            <INT XMLID="INT" ID="1794010730186" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </INT>
                            <OCV XMLID="OCV" ID="1794010729596" BASECOST="0.0" LEVELS="0" ALIAS="OCV" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </OCV>
                            <DCV XMLID="DCV" ID="1794010729984" BASECOST="0.0" LEVELS="0" ALIAS="DCV" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DCV>
                            <OMCV XMLID="OMCV" ID="1794010729434" BASECOST="0.0" LEVELS="0" ALIAS="OMCV" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </OMCV>
                            <DMCV XMLID="DMCV" ID="1794010729976" BASECOST="0.0" LEVELS="0" ALIAS="DMCV" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DMCV>
                            <SPD XMLID="SPD" ID="1794010729753" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </SPD>
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

/**
 * Every computer export under test, and what each one must answer.
 *
 * - `hasCharacteristics`, `doesNotHaveCharacteristics`: characteristics. `hasCharacteristic` answers both.
 * - `hasMovementModes`, `doesNotHaveMovementModes`: movement modes. `hasMovementCharacteristic` answers both.
 * - `values`: the numbers the export must read, one test per name and property.
 * - `totals`: the actor level sums of `realCost` and `activePoints`.
 * - No row claims an exact usable set. Gap 4 of `characteristics_coverage_gaps.md` explains why.
 *
 * CUSTOM1 to CUSTOM10 are reserved, and nothing builds them, so no export can hold one. A row
 * states that in `doesNotHaveCharacteristics`, beside every other name the export lacks. Give one
 * of them a builder, and each row that lists it fails until a real export holds it.
 */
const FIXTURES = freezeDeep([
    {
        title: "5e zero point computer",
        is5e: true,
        contents: COMPUTER_5E_ZERO_POINT_XML,
        hasCharacteristics: ["DEX", "INT", "SPD", "OCV", "DCV"],
        doesNotHaveCharacteristics: [
            "BODY",
            "STUN",
            "STR",
            "END",
            "CUSTOM1",
            "CUSTOM2",
            "CUSTOM3",
            "CUSTOM4",
            "CUSTOM5",
            "CUSTOM6",
            "CUSTOM7",
            "CUSTOM8",
            "CUSTOM9",
            "CUSTOM10",
        ],
        hasMovementModes: [],
        doesNotHaveMovementModes: ["RUNNING", "SWIMMING", "LEAPING"],
        values: {
            OCV: { value: 3 },
            DCV: { value: 3 },
        },
        totals: { realCost: 0, activePoints: 0 },
    },
    {
        title: "6e zero point computer",
        is5e: false,
        contents: COMPUTER_6E_ZERO_POINT_XML,
        hasCharacteristics: ["DEX", "INT", "SPD", "OCV", "DCV"],
        doesNotHaveCharacteristics: [
            "BODY",
            "STUN",
            "STR",
            "END",
            "CUSTOM1",
            "CUSTOM2",
            "CUSTOM3",
            "CUSTOM4",
            "CUSTOM5",
            "CUSTOM6",
            "CUSTOM7",
            "CUSTOM8",
            "CUSTOM9",
            "CUSTOM10",
        ],
        hasMovementModes: [],
        doesNotHaveMovementModes: ["RUNNING", "SWIMMING", "LEAPING"],
        values: {
            OCV: { value: 3 },
            DCV: { value: 3 },
        },
        totals: { realCost: 0, activePoints: 0 },
    },
]);

/**
 * Register the computer characteristic suite.
 *
 * One table row becomes one describe, and one claim becomes one test, so a report names the export, the
 * name, and the property that answered wrong. No test holds an assertion inside a loop.
 *
 * @param {object} quench The Quench instance.
 */
export function registerCharacteristicsComputerTests(quench) {
    quench.registerBatch(
        `${game.system.id}.actor.characteristics.computer`,
        (context) => {
            const { after, assert, before, describe, it } = context;
            const characteristicAssertions = createCharacteristicAssertions(assert);

            describe("Computer characteristics", function () {
                setQuenchTimeout(this, 20000);

                for (const fixture of FIXTURES) {
                    describe(fixture.title, function () {
                        let actor;

                        before(async function () {
                            actor = await createQuenchActor({
                                quench: this,
                                contents: fixture.contents,
                                is5e: fixture.is5e,
                                actorType: "computer",
                            });
                        });

                        after(async function () {
                            await deleteQuenchActor({ quench: this, actor });
                        });

                        for (const characteristic of fixture.hasCharacteristics) {
                            it(`has ${characteristic}`, async function () {
                                characteristicAssertions.assertHasCharacteristic(actor, characteristic);
                            });
                        }

                        for (const characteristic of fixture.doesNotHaveCharacteristics) {
                            it(`does not have ${characteristic}`, async function () {
                                characteristicAssertions.assertDoesNotHaveCharacteristic(actor, characteristic);
                            });
                        }

                        for (const mode of fixture.hasMovementModes) {
                            it(`moves by ${mode}`, async function () {
                                characteristicAssertions.assertHasMovementMode(actor, mode);
                            });
                        }

                        for (const mode of fixture.doesNotHaveMovementModes) {
                            it(`does not move by ${mode}`, async function () {
                                characteristicAssertions.assertDoesNotHaveMovementMode(actor, mode);
                            });
                        }

                        for (const [name, properties] of Object.entries(fixture.values)) {
                            for (const [property, expected] of Object.entries(properties)) {
                                it(`${name} ${property} equals ${expected}`, async function () {
                                    characteristicAssertions.assertCharacteristicProperty(
                                        actor,
                                        name,
                                        property,
                                        expected,
                                    );
                                });
                            }
                        }

                        for (const [property, expected] of Object.entries(fixture.totals)) {
                            it(`${property} total equals ${expected}`, async function () {
                                characteristicAssertions.assertActorTotal(actor, property, expected);
                            });
                        }
                    });
                }
            });
        },
        { displayName: "HERO: Characteristics (Computer)" },
    );
}
