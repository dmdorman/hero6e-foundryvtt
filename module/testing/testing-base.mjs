import { createCharacteristicAssertions } from "./characteristic-assertions.mjs";
import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

/**
 * Uploaded base template values.
 *
 * The contract lives elsewhere: `testing-characteristics.mjs` asserts which characteristics a
 * base has, from its `HAS_CHARACTERISTIC` table. This suite answers what an uploaded base
 * costs, per characteristic.
 */
export function registerBaseTests(quench) {
    quench.registerBatch(
        `${game.system.id}.actor.base`,
        (context) => {
            const { after, assert, before, describe, it } = context;
            const chars = createCharacteristicAssertions(assert);

            describe("Base Tests", function () {
                // Mocha's 2000ms default is too short when several actors are created at the same time.
                setQuenchTimeout(this, 20000);

                describe("5e Characteristic Values", async function () {
                    let actor;

                    before(async function () {
                        actor = await createQuenchActor({
                            quench: this,
                            contents: `
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
                    `,
                            is5e: true,
                            actorType: "base2",
                        });
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should have correct characteristic values", function () {
                        chars.assertCharFields(actor, "body", { value: 4 }); // Base 2 + 2 levels
                        chars.assertCharFields(actor, "def", { value: 15 }); // 2 base + 13 levels
                        chars.assertCharFields(actor, "basesize", { value: 20 }); // 0 base + 20 levels
                    });
                });

                describe("6e Characteristic Values", async function () {
                    let actor;

                    before(async function () {
                        actor = await createQuenchActor({
                            quench: this,
                            contents: `
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
                    `,
                            is5e: false,
                            actorType: "base2",
                        });
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should have correct characteristic values", function () {
                        chars.assertCharFields(actor, "body", { value: 10 }); // Base 2 + 8 levels
                        chars.assertCharFields(actor, "pd", { value: 7 }); // 2 base + 5 levels
                        chars.assertCharFields(actor, "ed", { value: 6 }); // 2 base + 4 levels
                        chars.assertCharFields(actor, "basesize", { value: 14 }); // 0 base + 14 levels
                    });
                });
            });
        },
        { displayName: "HERO: Base" },
    );
}
