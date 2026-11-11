/**
 * The AI characteristic suite.
 *
 * Every test reads an uploaded Hero Designer export. `before` uploads one export per describe, and
 * `after` deletes that actor, so no test reads an actor another test changed. No test reads a bare
 * actor: the export is the subject.
 *
 * An AI holds what a computer holds, plus EGO. It has no BODY, no END, and no movement. OCV and DCV read
 * 3 for the same reason a computer reads 3, and for the same bug; see the note at the top of
 * `testing-characteristics-computer.mjs`.
 *
 * The `FIXTURES` table holds every expectation. Read a row to know what the suite checks. To cover a
 * new export, add a row.
 */

import { freezeDeep } from "../utility/freeze-helpers.mjs";
import { createCharacteristicAssertions } from "./characteristic-assertions.mjs";
import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

const AI_5E_ZERO_POINT_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.AI.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST 5e AI 0 Points" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <DEX XMLID="DEX" ID="1794010489243" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DEX>
                            <INT XMLID="INT" ID="1794010489137" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1794010489133" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </EGO>
                            <SPD XMLID="SPD" ID="1794010489227" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
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

const AI_6E_ZERO_POINT_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.AI6E.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST 6e AI 0 Points" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <DEX XMLID="DEX" ID="1794010752955" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DEX>
                            <INT XMLID="INT" ID="1794010752132" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1794010752168" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </EGO>
                            <OCV XMLID="OCV" ID="1794010752447" BASECOST="0.0" LEVELS="0" ALIAS="OCV" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </OCV>
                            <DCV XMLID="DCV" ID="1794010752189" BASECOST="0.0" LEVELS="0" ALIAS="DCV" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DCV>
                            <OMCV XMLID="OMCV" ID="1794010752587" BASECOST="0.0" LEVELS="0" ALIAS="OMCV" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </OMCV>
                            <DMCV XMLID="DMCV" ID="1794010752209" BASECOST="0.0" LEVELS="0" ALIAS="DMCV" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DMCV>
                            <SPD XMLID="SPD" ID="1794010752105" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
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

const FIXTURES = freezeDeep([
    {
        title: "5e zero point ai",
        is5e: true,
        contents: AI_5E_ZERO_POINT_XML,
        hasCharacteristics: ["DEX", "INT", "EGO", "SPD", "OCV", "DCV", "OMCV", "DMCV"],
        doesNotHaveCharacteristics: [
            "DEF",
            "BODY",
            "STUN",
            "STR",
            "END",
            "BASESIZE",
            "COM",
            "CON",
            "ED",
            "PD",
            "PRE",
            "REC",
            "SIZE",
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
        title: "6e zero point ai",
        is5e: false,
        contents: AI_6E_ZERO_POINT_XML,
        hasCharacteristics: ["DEX", "INT", "EGO", "SPD", "OCV", "DCV", "OMCV", "DMCV"],
        doesNotHaveCharacteristics: [
            "DEF",
            "BODY",
            "STUN",
            "STR",
            "END",
            "BASESIZE",
            "COM",
            "CON",
            "ED",
            "PD",
            "PRE",
            "REC",
            "SIZE",
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
 * Register the AI characteristic suite.
 *
 * One table row becomes one describe, and one claim becomes one test, so a report names the export, the
 * name, and the property that answered wrong. No test holds an assertion inside a loop.
 *
 * @param {object} quench The Quench instance.
 */
export function registerCharacteristicsAiTests(quench) {
    quench.registerBatch(
        `${game.system.id}.actor.characteristics.ai`,
        (context) => {
            const { after, assert, before, describe, it } = context;
            const characteristicAssertions = createCharacteristicAssertions(assert);

            describe("AI characteristics", function () {
                setQuenchTimeout(this, 20000);

                for (const fixture of FIXTURES) {
                    describe(fixture.title, function () {
                        let actor;

                        before(async function () {
                            actor = await createQuenchActor({
                                quench: this,
                                contents: fixture.contents,
                                is5e: fixture.is5e,
                                actorType: "ai",
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
        { displayName: "HERO: Characteristics (AI)" },
    );
}
