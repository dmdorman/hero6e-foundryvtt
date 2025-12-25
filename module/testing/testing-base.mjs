import { createQuenchActor, deleteQuenchActor } from "./quench-helper.mjs";

import { getCharacteristicInfoArrayForActor } from "../utility/util.mjs";

export function registerBaseTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.actor.base",
        (context) => {
            const { after, before, describe, expect, it } = context;

            describe("Base Tests", function () {
                describe("5e Characteristics", async function () {
                    const contents = `
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

                    let actor;
                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: true, actorType: "base2" });
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should have the BASESIZE characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "BASESIZE")).to.be
                            .true;
                    });

                    it("should have the BODY characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "BODY")).to.be.true;
                    });

                    it("should have the DEF characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "DEF")).to.be.true;
                    });

                    it("should NOT have the PD characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "PD")).to.be.false;
                    });

                    it("should NOT have the ED characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "ED")).to.be.false;
                    });

                    it("should NOT have the STUN characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "STUN")).to.be.false;
                    });

                    it("should NOT have the SIZE characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "SIZE")).to.be.false;
                    });

                    it("should have correct characteristic values", function () {
                        expect(actor.system.characteristics.body.value).to.equal(4); // Base 2 + 2 levels
                        expect(actor.system.characteristics.def.value).to.equal(15); // 2 base + 13 levels
                        expect(actor.system.characteristics.basesize.value).to.equal(20); // 0 base + 20 levels
                    });

                    it("should only have the expected 5e base characteristics", function () {
                        const characteristics = getCharacteristicInfoArrayForActor(actor);
                        const characteristicKeys = characteristics.map((c) => c.key);

                        // Should have exactly these three characteristics
                        expect(characteristics.length).to.equal(3);
                        expect(characteristicKeys).to.include.members(["BASESIZE", "BODY", "DEF"]);
                    });
                });

                describe("6e Characteristics", async function () {
                    const contents = `
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

                    let actor;
                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: false, actorType: "base2" });
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should have the BASESIZE characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "BASESIZE")).to.be
                            .true;
                    });

                    it("should have the BODY characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "BODY")).to.be.true;
                    });

                    it("should have the PD characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "PD")).to.be.true;
                    });

                    it("should have the ED characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "ED")).to.be.true;
                    });

                    it("should NOT have the DEF characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "DEF")).to.be.false;
                    });

                    it("should NOT have the STUN characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "STUN")).to.be.false;
                    });

                    it("should NOT have the SIZE characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "SIZE")).to.be.false;
                    });

                    it("should NOT have the OCV characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "OCV")).to.be.false;
                    });

                    it("should NOT have the DCV characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "DCV")).to.be.false;
                    });

                    it("should have correct characteristic values", function () {
                        expect(actor.system.characteristics.body.value).to.equal(10); // Base 2 + 8 levels
                        expect(actor.system.characteristics.pd.value).to.equal(7); // 2 base + 5 levels
                        expect(actor.system.characteristics.ed.value).to.equal(6); // 2 base + 4 levels
                        expect(actor.system.characteristics.basesize.value).to.equal(14); // 0 base + 14 levels
                    });

                    it("should only have the expected 6e base characteristics", function () {
                        const characteristics = getCharacteristicInfoArrayForActor(actor);
                        const characteristicKeys = characteristics.map((c) => c.key);

                        // Should have exactly these four characteristics
                        expect(characteristics.length).to.equal(4);
                        expect(characteristicKeys).to.include.members(["BASESIZE", "BODY", "PD", "ED"]);
                    });
                });
            });
        },
        { displayName: "HERO: Base" },
    );
}
