import { createQuenchActor, deleteQuenchActor } from "./quench-helper.mjs";

import { getCharacteristicInfoArrayForActor } from "../utility/util.mjs";

export function registerVehicleTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.actor.vehicle",
        (context) => {
            const { after, before, describe, expect, it } = context;

            describe("Vehicle Characteristics", function () {
                // The default timeout tends to be insufficient with multiple actors being created at the same time.
                this.timeout(20000);

                describe("6e ARC-170 Starfighter", async function () {
                    const contents = `
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

                    let actor;
                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: false, actorType: "vehicle" });
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should have the SIZE characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "SIZE")).to.be.true;
                    });

                    it("should have the correct SIZE characteristic value", function () {
                        expect(actor.system.characteristics.size.value).to.equal(8);
                    });

                    it("should have the correct SIZE cost", function () {
                        expect(actor.system.characteristics.size.realCost).to.equal(40);
                    });

                    it("should have the STR characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "STR")).to.be.true;
                    });

                    it("should have the correct STR characteristic value", function () {
                        expect(actor.system.characteristics.str.value).to.equal(55);
                    });

                    it("should have the correct STR cost", function () {
                        expect(actor.system.characteristics.str.realCost).to.equal(5);
                    });

                    it("should have the DEX characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "DEX")).to.be.true;
                    });

                    it("should have the correct DEX characteristic value", function () {
                        expect(actor.system.characteristics.dex.value).to.equal(0);
                    });

                    it("should have the correct DEX cost", function () {
                        expect(actor.system.characteristics.dex.realCost).to.equal(-20);
                    });

                    it("should have the BODY characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "BODY")).to.be.true;
                    });

                    it("should have the correct BODY characteristic value", function () {
                        expect(actor.system.characteristics.body.value).to.equal(18);
                    });

                    it("should have the correct BODY cost", function () {
                        expect(actor.system.characteristics.body.realCost).to.equal(0);
                    });

                    it("should have the SPD characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "SPD")).to.be.true;
                    });

                    it("should have the correct SPD characteristic value", function () {
                        expect(actor.system.characteristics.spd.value).to.equal(5);
                    });

                    it("should have the correct SPD cost", function () {
                        expect(actor.system.characteristics.spd.realCost).to.equal(30);
                    });

                    it("should have the OCV characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "OCV")).to.be.true;
                    });

                    it("should have the correct OCV characteristic value", function () {
                        expect(actor.system.characteristics.ocv.value).to.equal(5);
                    });

                    it("should have the correct OCV cost", function () {
                        expect(actor.system.characteristics.ocv.realCost).to.equal(10);
                    });

                    it("should have the DCV characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "DCV")).to.be.true;
                    });

                    it("should have the correct DCV characteristic value", function () {
                        // NOTE: Different from HD because we make size a DCV penalty to the big vehicle
                        //       rather than an OCV bonus to the attacker.
                        expect(actor.system.characteristics.dcv.value).to.equal(2);
                    });

                    it("should have the correct DCV cost", function () {
                        expect(actor.system.characteristics.dcv.realCost).to.equal(20);
                    });

                    it("should have the PD characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "PD")).to.be.true;
                    });

                    it("should have the correct PD characteristic value", function () {
                        expect(actor.system.characteristics.pd.value).to.equal(4);
                    });

                    it("should have the correct PD cost", function () {
                        expect(actor.system.characteristics.pd.realCost).to.equal(3);
                    });

                    it("should have the ED characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "ED")).to.be.true;
                    });

                    it("should have the correct ED characteristic value", function () {
                        expect(actor.system.characteristics.ed.value).to.equal(4);
                    });

                    it("should have the correct ED cost", function () {
                        expect(actor.system.characteristics.ed.realCost).to.equal(3);
                    });

                    it("should NOT have the STUN characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "STUN")).to.be.false;
                    });

                    it("should have 0m of leaping", function () {
                        expect(actor.system.characteristics.leaping.value).to.equal(0);
                    });

                    it("should have Flight power", function () {
                        const hasFlightPower = !!actor.items.find((item) => item.system.XMLID === "FLIGHT");
                        expect(hasFlightPower).to.be.true;
                    });
                });

                describe("5e Test Vehicle", async function () {
                    const contents = `
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

                    let actor;
                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: true, actorType: "vehicle" });
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("should have the SIZE characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "SIZE")).to.be.true;
                    });

                    it("should have the correct SIZE characteristic value", function () {
                        expect(actor.system.characteristics.size.value).to.equal(12);
                    });

                    it("should have the correct SIZE cost", function () {
                        expect(actor.system.characteristics.size.realCost).to.equal(60);
                    });

                    it("should have the STR characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "STR")).to.be.true;
                    });

                    it("should have the correct STR characteristic value", function () {
                        expect(actor.system.characteristics.str.value).to.equal(20);
                    });

                    it("should have the correct STR cost", function () {
                        expect(actor.system.characteristics.str.realCost).to.equal(-50);
                    });

                    it("should have the DEX characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "DEX")).to.be.true;
                    });

                    it("should have the correct DEX characteristic value", function () {
                        expect(actor.system.characteristics.dex.value).to.equal(32);
                    });

                    it("should have the correct DEX cost", function () {
                        expect(actor.system.characteristics.dex.realCost).to.equal(66);
                    });

                    it("should have the BODY characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "BODY")).to.be.true;
                    });

                    it("should have the correct BODY characteristic value", function () {
                        expect(actor.system.characteristics.body.value).to.equal(22);
                    });

                    it("should have the correct BODY cost", function () {
                        expect(actor.system.characteristics.body.realCost).to.equal(0);
                    });

                    it("should have the SPD characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "SPD")).to.be.true;
                    });

                    it("should have the correct SPD characteristic value", function () {
                        expect(actor.system.characteristics.spd.value).to.equal(5);
                    });

                    it("should have the correct SPD cost", function () {
                        expect(actor.system.characteristics.spd.realCost).to.equal(8);
                    });

                    it("should have the OCV characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "OCV")).to.be.true;
                    });

                    it("should have the correct OCV characteristic value", function () {
                        expect(actor.system.characteristics.ocv.value).to.equal(11);
                    });

                    it("should have the correct OCV cost", function () {
                        expect(actor.system.characteristics.ocv.realCost).to.equal(0);
                    });

                    it("should have the DCV characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "DCV")).to.be.true;
                    });

                    it("should have the correct DCV characteristic value", function () {
                        expect(actor.system.characteristics.dcv.value).to.equal(3);
                    });

                    it("should have the correct DCV cost", function () {
                        expect(actor.system.characteristics.dcv.realCost).to.equal(0);
                    });

                    it("should NOT have the STUN characteristic", function () {
                        expect(!!getCharacteristicInfoArrayForActor(actor).find((o) => o.key === "STUN")).to.be.false;
                    });

                    it('should have 0" of leaping', function () {
                        expect(actor.system.characteristics.leaping.value).to.equal(0);
                    });

                    it("should have Flight power", function () {
                        const flightPower = actor.items.find((item) => item.system.XMLID === "FLIGHT");
                        expect(!!flightPower).to.be.true;
                    });

                    it("should have FTL power", function () {
                        const ftlPower = actor.items.find((item) => item.system.XMLID === "FTL");
                        expect(!!ftlPower).to.be.true;
                    });
                });
            });
        },
        { displayName: "HERO: Vehicle" },
    );
}
