/**
 * The base characteristic suite. The actor type key is `base2`.
 *
 * Every test reads an uploaded Hero Designer export. `before` uploads one export per describe, and
 * `after` deletes that actor, so no test reads an actor another test changed. No test reads a bare
 * actor: the export is the subject.
 *
 * A base holds BODY, its armour, and BASESIZE, and nothing else. It moves nowhere, so every movement
 * claim is a `doesNotHaveMovementModes` claim. The two template rows also claim the exact usable name set, because
 * "a base has nothing else" is the point of a base export.
 *
 * 5e armour is DEF. 6e armour is PD and ED. A 6e actor has no DEF name at all, so no 6e row claims one:
 * a missing name would pass whatever the code did.
 *
 * The `FIXTURES` table holds every expectation. Read a row to know what the suite checks. To cover a
 * new export, add a row.
 */

import { freezeDeep } from "../utility/freeze-helpers.mjs";
import { createCharacteristicAssertions } from "./characteristic-assertions.mjs";
import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

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

const BASE_5E_ZERO_POINT_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Base.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST 5e Base 0 Points" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <BODY XMLID="BODY" ID="1794010416514" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </BODY>
                            <DEF XMLID="DEF" ID="1794010416043" BASECOST="0.0" LEVELS="0" ALIAS="DEF" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </DEF>
                            <BASESIZE XMLID="BASESIZE" ID="1794010416073" BASECOST="0.0" LEVELS="0" ALIAS="Size" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
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

const BASE_6E_ZERO_POINT_XML = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Base6E.hdt">
                          <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                          <CHARACTER_INFO CHARACTER_NAME="TEST 6e Base 0 Points" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <BASESIZE XMLID="BASESIZE" ID="1794010682269" BASECOST="0.0" LEVELS="0" ALIAS="Size" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </BASESIZE>
                            <PD XMLID="PD" ID="1794010681558" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1794010681692" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                              <NOTES />
                            </ED>
                            <BODY XMLID="BODY" ID="1794010682215" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
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

/**
 * Every base export under test, and what each one must answer.
 *
 * - `hasCharacteristics`, `doesNotHaveCharacteristics`: characteristics. `hasCharacteristic` answers both.
 * - `hasMovementModes`, `doesNotHaveMovementModes`: movement modes. `hasMovementCharacteristic` answers both.
 * - `values`: the numbers the export must read, one test per name and property.
 * - `totals`: the actor level sums of `realCost` and `activePoints`.
 * - `usableSet`: the exact usable name set. Only a row that claims a set carries the key.
 *
 * CUSTOM1 to CUSTOM10 are reserved, and nothing builds them, so no export can hold one. A row
 * states that in `doesNotHaveCharacteristics`, beside every other name the export lacks. Give one
 * of them a builder, and each row that lists it fails until a real export holds it.
 *
 * A 0 point export buys no characteristics, so its `values` state the template default. A base starts
 * with a smaller BODY than a character, and it keeps that value in both editions.
 */
const FIXTURES = freezeDeep([
    {
        title: "5e base template",
        is5e: true,
        contents: BASE_5E_XML,
        hasCharacteristics: ["BODY", "DEF", "BASESIZE"],
        doesNotHaveCharacteristics: [
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
            BODY: { value: 4 },
            DEF: { value: 15 },
            BASESIZE: { value: 20 },
        },
        totals: {},
        usableSet: ["BASESIZE", "BODY", "DEF"],
    },
    {
        title: "6e base template",
        is5e: false,
        contents: BASE_6E_XML,
        hasCharacteristics: ["BODY", "PD", "ED", "BASESIZE"],
        doesNotHaveCharacteristics: [
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
            BODY: { value: 10 },
            PD: { value: 7 },
            ED: { value: 6 },
            BASESIZE: { value: 14 },
        },
        totals: {},
        usableSet: ["BASESIZE", "BODY", "ED", "PD"],
    },
    {
        title: "5e zero point base",
        is5e: true,
        contents: BASE_5E_ZERO_POINT_XML,
        hasCharacteristics: ["BODY"],
        doesNotHaveCharacteristics: ["STUN"],
        hasMovementModes: [],
        doesNotHaveMovementModes: ["RUNNING", "SWIMMING", "LEAPING"],
        values: { BODY: { value: 2 } },
        totals: { realCost: 0, activePoints: 0 },
    },
    {
        title: "6e zero point base",
        is5e: false,
        contents: BASE_6E_ZERO_POINT_XML,
        hasCharacteristics: ["BODY"],
        doesNotHaveCharacteristics: ["STUN"],
        hasMovementModes: [],
        doesNotHaveMovementModes: ["RUNNING", "SWIMMING", "LEAPING"],
        values: { BODY: { value: 2 } },
        totals: { realCost: 0, activePoints: 0 },
    },
]);

/**
 * Register the base characteristic suite.
 *
 * One table row becomes one describe, and one claim becomes one test, so a report names the export, the
 * name, and the property that answered wrong. No test holds an assertion inside a loop.
 *
 * @param {object} quench The Quench instance.
 */
export function registerCharacteristicsBaseTests(quench) {
    quench.registerBatch(
        `${game.system.id}.actor.characteristics.base`,
        (context) => {
            const { after, assert, before, describe, it } = context;
            const characteristicAssertions = createCharacteristicAssertions(assert);

            describe("Base characteristics", function () {
                setQuenchTimeout(this, 20000);

                for (const fixture of FIXTURES) {
                    describe(fixture.title, function () {
                        let actor;

                        before(async function () {
                            actor = await createQuenchActor({
                                quench: this,
                                contents: fixture.contents,
                                is5e: fixture.is5e,
                                actorType: "base2",
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

                        if (fixture.usableSet !== undefined) {
                            it("can use exactly the names its row lists", async function () {
                                characteristicAssertions.assertExactUsableSet(actor, fixture.usableSet);
                            });
                        }
                    });
                }
            });
        },
        { displayName: "HERO: Characteristics (Base)" },
    );
}
