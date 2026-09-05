import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

import {
    resetDiceClass,
    Roll10On3Dice,
    Roll11On3Dice,
    Roll12On3Dice,
    Roll13On3Dice,
    Roll14On3Dice,
    Roll15On3Dice,
    Roll1LuckOn3Dice,
    Roll3LuckOn3Dice,
    Roll3On3Dice,
    Roll4On3Dice,
    Roll5On3Dice,
    Roll6On3Dice,
    Roll7On3Dice,
    Roll8On3Dice,
    Roll9On3Dice,
    RollAlternatingLuckAndUnluck,
} from "../heroRoller/dice-testing-helper.mjs";

import { isActivatedForThisUse_TestingOnly } from "../item/item-requires-roll.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";

import { getAndSetGameSetting } from "../settings/settings-helpers.mjs";

import { HeroRoll } from "../heroRoller/dice.mjs";

export function registerRequiresRollCheckTests(quench) {
    quench.registerBatch(
        `${game.system.id}.item.requiresCheck`,
        (context) => {
            const { after, before, describe, expect, it } = context;

            describe("ACTIVATIONROLL and REQUIRESASKILLROLL", function () {
                // The default timeout tends to be insufficient with multiple actors being created at the same time.
                setQuenchTimeout(this);

                describe("Old HDC 5e character with sectional defenses as activation roll (#3876)", function () {
                    const contents = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Superheroic.hdt">
                        <BASIC_CONFIGURATION BASE_POINTS="0" DISAD_POINTS="0" EXPERIENCE="0" RULES="Default" />
                        <CHARACTER_INFO CHARACTER_NAME="Armor for Kazei 5" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.46224760379584" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <STR XMLID="STR" ID="1236647926251" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1236647925404" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEX>
                            <CON XMLID="CON" ID="1236647925283" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </CON>
                            <BODY XMLID="BODY" ID="1236647925914" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </BODY>
                            <INT XMLID="INT" ID="1236647925505" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1236647925687" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </EGO>
                            <PRE XMLID="PRE" ID="1236647926083" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PRE>
                            <COM XMLID="COM" ID="1236647925348" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </COM>
                            <PD XMLID="PD" ID="1236647925430" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1236647925341" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </ED>
                            <SPD XMLID="SPD" ID="1236647926135" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SPD>
                            <REC XMLID="REC" ID="1236647925598" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </REC>
                            <END XMLID="END" ID="1236647925309" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </END>
                            <STUN XMLID="STUN" ID="1236647925524" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STUN>
                            <RUNNING XMLID="RUNNING" ID="1236647925462" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1236647925294" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1236647925643" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </LEAPING>
                        </CHARACTERISTICS>
                        <SKILLS />
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS />
                        <POWERS />
                        <DISADVANTAGES />
                        <EQUIPMENT>
                            <POWER XMLID="FORCEFIELD" ID="1773253025088" BASECOST="0.0" LEVELS="18" ALIAS="Resistant Protection" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" PRICE="0.0" WEIGHT="0.0" CARRIED="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Level I Security Armor" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="9" EDLEVELS="9" MDLEVELS="0" POWDLEVELS="0">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1773253025046" BASECOST="-0.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 6-18" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="FOCUS" ID="1773253025073" BASECOST="-0.5" LEVELS="0" ALIAS="Focus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" OPTION="OIF" OPTIONID="OIF" OPTION_ALIAS="OIF" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="REALARMOR" ID="1773253025075" BASECOST="-0.25" LEVELS="0" ALIAS="Real Armor" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                        </EQUIPMENT>
                        </CHARACTER>
                    `;

                    let actor;
                    let sectionalSecurityArmor;
                    let sectionalActivationRollModifier;

                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: true });

                        sectionalSecurityArmor = actor.items.find((item) => item.name === "Level I Security Armor");
                        sectionalActivationRollModifier = sectionalSecurityArmor.system.MODIFIER.find(
                            (mod) => mod.XMLID === "ACTIVATIONROLL",
                        );
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    describe("sectional security armor - old item migration", async function () {
                        it("should have a created OPTION property", function () {
                            expect(sectionalActivationRollModifier.OPTION).to.equal("14");
                        });

                        it("should have a created OPTIONID property", function () {
                            expect(sectionalActivationRollModifier.OPTIONID).to.equal("14");
                        });
                    });
                });

                describe("5e - activation roll (including behaving as section defense XMLID)", function () {
                    const contents = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Superheroic.hdt">
                        <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                        <CHARACTER_INFO CHARACTER_NAME="Test 5e Activation Roll" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.46224760379584" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <STR XMLID="STR" ID="1774142627887" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1774142627915" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEX>
                            <CON XMLID="CON" ID="1774142627900" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </CON>
                            <BODY XMLID="BODY" ID="1774142628378" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </BODY>
                            <INT XMLID="INT" ID="1774142628524" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1774142628258" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </EGO>
                            <PRE XMLID="PRE" ID="1774142628046" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PRE>
                            <COM XMLID="COM" ID="1774142628559" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </COM>
                            <PD XMLID="PD" ID="1774142628390" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1774142628238" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </ED>
                            <SPD XMLID="SPD" ID="1774142628459" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SPD>
                            <REC XMLID="REC" ID="1774142627846" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </REC>
                            <END XMLID="END" ID="1774142628189" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </END>
                            <STUN XMLID="STUN" ID="1774142627957" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STUN>
                            <RUNNING XMLID="RUNNING" ID="1774142628084" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1774142627962" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1774142628064" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </LEAPING>
                        </CHARACTERISTICS>
                        <SKILLS>
                            <SKILL XMLID="ACROBATICS" ID="1774142644678" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 8-" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144246591" BASECOST="-2.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774144750794" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 8- Jamming" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144800582" BASECOST="-2.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774144800569" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774146160475" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 8- Jamming Burnout" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774146299672" BASECOST="-2.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774146302202" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BURNOUT" ID="1774146303922" BASECOST="0.5" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774143298339" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 9-" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144255902" BASECOST="-1.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="9" OPTIONID="9" OPTION_ALIAS="9-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774144777528" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 9- Jamming" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144833320" BASECOST="-1.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="9" OPTIONID="9" OPTION_ALIAS="9-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774144833307" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774146165573" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 9- Jamming Burnout" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774146286632" BASECOST="-1.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="9" OPTIONID="9" OPTION_ALIAS="9-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774146291491" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BURNOUT" ID="1774146292690" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774143301295" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 10-" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144260607" BASECOST="-1.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="10" OPTIONID="10" OPTION_ALIAS="10-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774144781077" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 10- Jamming" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144854707" BASECOST="-1.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="10" OPTIONID="10" OPTION_ALIAS="10-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774144863126" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774146171326" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 10- Jamming Burnout" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774146274809" BASECOST="-1.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="10" OPTIONID="10" OPTION_ALIAS="10-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774146277740" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BURNOUT" ID="1774146279691" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774143303272" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 11-" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144268402" BASECOST="-1.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774144783547" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 11- Jamming" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144874298" BASECOST="-1.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774144874285" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774146176105" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 11- Jamming Burnout" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774146263211" BASECOST="-1.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774146266046" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BURNOUT" ID="1774146267964" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774143304943" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 12-" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144274027" BASECOST="-0.75" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="12" OPTIONID="12" OPTION_ALIAS="12-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774144786628" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 12- Jamming" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144890805" BASECOST="-0.75" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="12" OPTIONID="12" OPTION_ALIAS="12-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774144890792" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774146181084" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 12- Jamming Burnout" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774146251051" BASECOST="-0.75" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="12" OPTIONID="12" OPTION_ALIAS="12-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774146255358" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BURNOUT" ID="1774146256989" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774143306539" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 13-" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144280054" BASECOST="-0.75" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="13" OPTIONID="13" OPTION_ALIAS="13-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774144788939" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 13- Jamming" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144908728" BASECOST="-0.75" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="13" OPTIONID="13" OPTION_ALIAS="13-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774144908715" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774146184997" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 13- Jamming Burnout" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774146238059" BASECOST="-0.75" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="13" OPTIONID="13" OPTION_ALIAS="13-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774146241447" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BURNOUT" ID="1774146243214" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774143314132" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 14-" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144285000" BASECOST="-0.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774144791152" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 14- Jamming" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144921017" BASECOST="-0.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774144921004" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774146189432" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 14- Jamming Burnout" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774146222357" BASECOST="-0.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774146225976" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BURNOUT" ID="1774146227583" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774143316149" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 15-" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144290342" BASECOST="-0.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="15" OPTIONID="15" OPTION_ALIAS="15-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774144793614" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 15- Jamming" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774144932019" BASECOST="-0.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="15" OPTIONID="15" OPTION_ALIAS="15-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774144932006" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                            <SKILL XMLID="ACROBATICS" ID="1774146194130" BASECOST="3.0" LEVELS="20" ALIAS="Acrobatics" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Acrobatics Activation 15- Jamming Burnout" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1774146196278" BASECOST="-0.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="15" OPTIONID="15" OPTION_ALIAS="15-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1774146203457" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="BURNOUT" ID="1774146204904" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </SKILL>
                        </SKILLS>
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS />
                        <POWERS>
                            <LIST XMLID="GENERIC_OBJECT" ID="1776049267635" BASECOST="0.0" LEVELS="0" ALIAS="Sectional Defense" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <POWER XMLID="ARMOR" ID="1776048632952" BASECOST="0.0" LEVELS="2" ALIAS="Armor" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776049267635" NAME="Short Vest (location 12-13)" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1">
                            <NOTES />
                            <MODIFIER XMLID="ACTIVATIONROLL" ID="1776049506195" BASECOST="-2.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="location 12-13" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="ARMOR" ID="1776049476589" BASECOST="0.0" LEVELS="2" ALIAS="Armor" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776049267635" NAME="Standard Vest (location 11-13)" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1">
                            <NOTES />
                            <MODIFIER XMLID="ACTIVATIONROLL" ID="1776049529729" BASECOST="-1.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="9" OPTIONID="9" OPTION_ALIAS="9-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="location 11-13" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="ARMOR" ID="1776049526341" BASECOST="0.0" LEVELS="2" ALIAS="Armor" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776049267635" NAME="Cap, Long Vest (location 10-13)" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1">
                            <NOTES />
                            <MODIFIER XMLID="ACTIVATIONROLL" ID="1776049539352" BASECOST="-1.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="10" OPTIONID="10" OPTION_ALIAS="10-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="location 10-13" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="ARMOR" ID="1776049578213" BASECOST="0.0" LEVELS="2" ALIAS="Armor" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776049267635" NAME="Helmet, Jacket (location 4-5,9-13)" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1">
                            <NOTES />
                            <MODIFIER XMLID="ACTIVATIONROLL" ID="1776049684645" BASECOST="-1.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="location 4-5,9-13" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="ARMOR" ID="1776049618870" BASECOST="0.0" LEVELS="2" ALIAS="Armor" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776049267635" NAME="Full Coverage Helmet, Long Jacket, High Boots (location 3-5,9-14, 16-18)" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1">
                            <NOTES />
                            <MODIFIER XMLID="ACTIVATIONROLL" ID="1776049620282" BASECOST="-0.75" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="12" OPTIONID="12" OPTION_ALIAS="12-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="location 3-5,9-14, 16-18" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="ARMOR" ID="1776049702240" BASECOST="0.0" LEVELS="2" ALIAS="Armor" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776049267635" NAME="Full Coverage Helmet, Long Jacket, High Boots (locations 3-5,9-14, and 16-18)" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1">
                            <NOTES />
                            <MODIFIER XMLID="ACTIVATIONROLL" ID="1776054990928" BASECOST="-0.75" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="12" OPTIONID="12" OPTION_ALIAS="12-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="location 3-5,9-14, and 16-18" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="ARMOR" ID="1776050235631" BASECOST="0.0" LEVELS="2" ALIAS="Armor" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776049267635" NAME="Weird Coverage (locations   3,5 ,9- 10,12, 14 -15, and 17 - 18)" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1">
                            <NOTES />
                            <MODIFIER XMLID="ACTIVATIONROLL" ID="1776055483709" BASECOST="-0.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="15" OPTIONID="15" OPTION_ALIAS="15-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations   3,5 ,9- 10,12, 14 -15, and 17 - 18" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <LIST XMLID="GENERIC_OBJECT" ID="1776821785016" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                            </LIST>
                            <LIST XMLID="GENERIC_OBJECT" ID="1776821806893" BASECOST="0.0" LEVELS="0" ALIAS="Invalid Sectional Defense Declarations" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                            </LIST>
                            <POWER XMLID="FORCEFIELD" ID="1776821287228" BASECOST="0.0" LEVELS="4" ALIAS="Force Field" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776821806893" NAME="Sectional Defense with Invalid Declaration Words" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1" MDLEVELS="1" POWDLEVELS="1">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1776821901336" BASECOST="-2.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locationss 8-12, invalid, 18" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="FORCEFIELD" ID="1776822881085" BASECOST="0.0" LEVELS="4" ALIAS="Force Field" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776821806893" NAME="Sectional Defense with Invalid Declaration Words 2" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1" MDLEVELS="1" POWDLEVELS="1">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1776822884488" BASECOST="-2.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 8-12, invalid, 18" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="FORCEFIELD" ID="1776821418500" BASECOST="0.0" LEVELS="4" ALIAS="Force Field" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776821806893" NAME="Sectional Defense with Invalid Declaration Invalid Hit Locations" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1" MDLEVELS="1" POWDLEVELS="1">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1776821972799" BASECOST="-2.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 19-34" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="FLASH" ID="1776821547972" BASECOST="0.0" LEVELS="1" ALIAS="Flash" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776821806893" NAME="Sectional Declaration For Non Defense" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1776907624818" BASECOST="-1.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 8-12" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="FORCEFIELD" ID="1776907290823" BASECOST="0.0" LEVELS="4" ALIAS="Force Field" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776821806893" NAME="Sectional Defense with Incorrect Probability" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1" MDLEVELS="1" POWDLEVELS="1">
                            <NOTES />
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1776907293178" BASECOST="-2.0" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 8-12, 14-16, 18" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                        </POWERS>                        
                        <DISADVANTAGES />
                        <EQUIPMENT />
                        </CHARACTER>
                        `;
                    let actor;

                    let acrobaticsActivation8Less;
                    let acrobaticsActivation9Less;
                    let acrobaticsActivation10Less;
                    let acrobaticsActivation11Less;
                    let acrobaticsActivation12Less;
                    let acrobaticsActivation13Less;
                    let acrobaticsActivation14Less;
                    let acrobaticsActivation15Less;

                    let acrobaticsActivation8LessJamming;
                    let acrobaticsActivation9LessJamming;
                    let acrobaticsActivation10LessJamming;
                    let acrobaticsActivation11LessJamming;
                    let acrobaticsActivation12LessJamming;
                    let acrobaticsActivation13LessJamming;
                    let acrobaticsActivation14LessJamming;
                    let acrobaticsActivation15LessJamming;

                    let acrobaticsActivation8LessJammingBurnout;
                    let acrobaticsActivation9LessJammingBurnout;
                    let acrobaticsActivation10LessJammingBurnout;
                    let acrobaticsActivation11LessJammingBurnout;
                    let acrobaticsActivation12LessJammingBurnout;
                    let acrobaticsActivation13LessJammingBurnout;
                    let acrobaticsActivation14LessJammingBurnout;
                    let acrobaticsActivation15LessJammingBurnout;

                    let sectionalArmorShortVest;
                    let sectionalArmorStandardVest;
                    let sectionalArmorCapLongVest;
                    let sectionalArmorHelmetJacket;
                    let sectionalArmorFullCoverageHelmetVestHighBoots;
                    let sectionalArmorFullCoverageHelmetVestAndHighBoots;
                    let sectionalArmorWeirdCoverage;

                    let sectionalArmorInvalidDeclarationWords;
                    let sectionalArmorInvalidDeclarationWordsTwo;
                    let sectionalArmorInvalidDeclarationInvalidHitLocations;
                    let sectionalDeclarationInFlash;
                    let sectionalArmorInvalidDeclarationInvalidProbability;

                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: true });

                        acrobaticsActivation8Less = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 8-",
                        );
                        acrobaticsActivation9Less = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 9-",
                        );
                        acrobaticsActivation10Less = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 10-",
                        );
                        acrobaticsActivation11Less = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 11-",
                        );
                        acrobaticsActivation12Less = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 12-",
                        );
                        acrobaticsActivation13Less = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 13-",
                        );
                        acrobaticsActivation14Less = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 14-",
                        );
                        acrobaticsActivation15Less = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 15-",
                        );

                        acrobaticsActivation8LessJamming = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 8- Jamming",
                        );
                        acrobaticsActivation9LessJamming = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 9- Jamming",
                        );
                        acrobaticsActivation10LessJamming = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 10- Jamming",
                        );
                        acrobaticsActivation11LessJamming = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 11- Jamming",
                        );
                        acrobaticsActivation12LessJamming = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 12- Jamming",
                        );
                        acrobaticsActivation13LessJamming = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 13- Jamming",
                        );
                        acrobaticsActivation14LessJamming = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 14- Jamming",
                        );
                        acrobaticsActivation15LessJamming = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 15- Jamming",
                        );

                        acrobaticsActivation8LessJammingBurnout = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 8- Jamming Burnout",
                        );
                        acrobaticsActivation9LessJammingBurnout = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 9- Jamming Burnout",
                        );
                        acrobaticsActivation10LessJammingBurnout = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 10- Jamming Burnout",
                        );
                        acrobaticsActivation11LessJammingBurnout = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 11- Jamming Burnout",
                        );
                        acrobaticsActivation12LessJammingBurnout = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 12- Jamming Burnout",
                        );
                        acrobaticsActivation13LessJammingBurnout = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 13- Jamming Burnout",
                        );
                        acrobaticsActivation14LessJammingBurnout = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 14- Jamming Burnout",
                        );
                        acrobaticsActivation15LessJammingBurnout = actor.items.find(
                            (item) => item.name === "Acrobatics Activation 15- Jamming Burnout",
                        );

                        sectionalArmorShortVest = actor.items.find(
                            (item) => item.name === "Short Vest (location 12-13)",
                        );
                        sectionalArmorStandardVest = actor.items.find(
                            (item) => item.name === "Standard Vest (location 11-13)",
                        );
                        sectionalArmorCapLongVest = actor.items.find(
                            (item) => item.name === "Cap, Long Vest (location 10-13)",
                        );
                        sectionalArmorHelmetJacket = actor.items.find(
                            (item) => item.name === "Helmet, Jacket (location 4-5,9-13)",
                        );
                        sectionalArmorFullCoverageHelmetVestHighBoots = actor.items.find(
                            (item) =>
                                item.name ===
                                "Full Coverage Helmet, Long Jacket, High Boots (location 3-5,9-14, 16-18)",
                        );
                        sectionalArmorFullCoverageHelmetVestAndHighBoots = actor.items.find(
                            (item) =>
                                item.name ===
                                "Full Coverage Helmet, Long Jacket, High Boots (locations 3-5,9-14, and 16-18)",
                        );
                        sectionalArmorWeirdCoverage = actor.items.find(
                            (item) => item.name === "Weird Coverage (locations   3,5 ,9- 10,12, 14 -15, and 17 - 18)",
                        );

                        sectionalArmorInvalidDeclarationWords = actor.items.find(
                            (item) => item.name === "Sectional Defense with Invalid Declaration Words",
                        );
                        sectionalArmorInvalidDeclarationWordsTwo = actor.items.find(
                            (item) => item.name === "Sectional Defense with Invalid Declaration Words 2",
                        );
                        sectionalArmorInvalidDeclarationInvalidHitLocations = actor.items.find(
                            (item) => item.name === "Sectional Defense with Invalid Declaration Invalid Hit Locations",
                        );
                        sectionalDeclarationInFlash = actor.items.find(
                            (item) => item.name === "Sectional Declaration For Non Defense",
                        );
                        sectionalArmorInvalidDeclarationInvalidProbability = actor.items.find(
                            (item) => item.name === "Sectional Defense with Incorrect Probability",
                        );
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    describe("cost", function () {
                        describe("acrobatics with activation roll", function () {
                            it("should have correct cost activation 8-", function () {
                                expect(acrobaticsActivation8Less.realCost).to.equal(14);
                            });

                            it("should have correct cost activation 9-", function () {
                                expect(acrobaticsActivation9Less.realCost).to.equal(17);
                            });

                            it("should have correct cost activation 10-", function () {
                                expect(acrobaticsActivation10Less.realCost).to.equal(19);
                            });

                            it("should have correct cost activation 11-", function () {
                                expect(acrobaticsActivation11Less.realCost).to.equal(21);
                            });

                            it("should have correct cost activation 12-", function () {
                                expect(acrobaticsActivation12Less.realCost).to.equal(24);
                            });

                            it("should have correct cost activation 13-", function () {
                                expect(acrobaticsActivation13Less.realCost).to.equal(24);
                            });

                            it("should have correct cost activation 14-", function () {
                                expect(acrobaticsActivation14Less.realCost).to.equal(29);
                            });

                            it("should have correct cost activation 15-", function () {
                                expect(acrobaticsActivation15Less.realCost).to.equal(34);
                            });
                        });

                        describe("acrobatics with activation roll jamming", function () {
                            it("should have correct cost activation 8- Jamming", function () {
                                expect(acrobaticsActivation8LessJamming.realCost).to.equal(12);
                            });

                            it("should have correct cost activation 9- Jamming", function () {
                                expect(acrobaticsActivation9LessJamming.realCost).to.equal(14);
                            });

                            it("should have correct cost activation 10- Jamming", function () {
                                expect(acrobaticsActivation10LessJamming.realCost).to.equal(16);
                            });

                            it("should have correct cost activation 11- Jamming", function () {
                                expect(acrobaticsActivation11LessJamming.realCost).to.equal(17);
                            });

                            it("should have correct cost activation 12- Jamming", function () {
                                expect(acrobaticsActivation12LessJamming.realCost).to.equal(19);
                            });

                            it("should have correct cost activation 13- Jamming", function () {
                                expect(acrobaticsActivation13LessJamming.realCost).to.equal(19);
                            });

                            it("should have correct cost activation 14- Jamming", function () {
                                expect(acrobaticsActivation14LessJamming.realCost).to.equal(21);
                            });

                            it("should have correct cost activation 15- Jamming", function () {
                                expect(acrobaticsActivation15LessJamming.realCost).to.equal(24);
                            });
                        });

                        describe("acrobatics with activation roll jamming burnout", function () {
                            it("should have correct cost activation 8- Jamming Burnout", function () {
                                expect(acrobaticsActivation8LessJammingBurnout.realCost).to.equal(14);
                            });

                            it("should have correct cost activation 9- Jamming Burnout", function () {
                                expect(acrobaticsActivation9LessJammingBurnout.realCost).to.equal(16);
                            });

                            it("should have correct cost activation 10- Jamming Burnout", function () {
                                expect(acrobaticsActivation10LessJammingBurnout.realCost).to.equal(17);
                            });

                            it("should have correct cost activation 11- Jamming Burnout", function () {
                                expect(acrobaticsActivation11LessJammingBurnout.realCost).to.equal(19);
                            });

                            it("should have correct cost activation 12- Jamming Burnout", function () {
                                expect(acrobaticsActivation12LessJammingBurnout.realCost).to.equal(21);
                            });

                            it("should have correct cost activation 13- Jamming Burnout", function () {
                                expect(acrobaticsActivation13LessJammingBurnout.realCost).to.equal(21);
                            });

                            it("should have correct cost activation 14- Jamming Burnout", function () {
                                expect(acrobaticsActivation14LessJammingBurnout.realCost).to.equal(24);
                            });

                            it("should have correct cost activation 15- Jamming Burnout", function () {
                                expect(acrobaticsActivation15LessJammingBurnout.realCost).to.equal(29);
                            });
                        });
                    });

                    describe("basic activation roll", function () {
                        describe("Acrobatics 8- activates correctly", function () {
                            it("should not activate 8- with a roll of a 9", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        acrobaticsActivation8Less,
                                        resetDiceClass(Roll9On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });

                            it("should activate 8- with a roll of a 8", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        acrobaticsActivation8Less,
                                        resetDiceClass(Roll8On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });

                            it("should activate 8- with a roll of a 7", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        acrobaticsActivation8Less,
                                        resetDiceClass(Roll7On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });

                            it("should activate 8- with a roll of a 3", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        acrobaticsActivation8Less,
                                        resetDiceClass(Roll3On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                        });

                        describe("Acrobatics 12- activates correctly", function () {
                            it("should not activate 12- with a roll of a 13", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        acrobaticsActivation12Less,
                                        resetDiceClass(Roll13On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });

                            it("should activate 12- with a roll of a 12", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        acrobaticsActivation12Less,
                                        resetDiceClass(Roll12On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                        });
                    });

                    describe("sectional activation roll with hit locations active", function () {
                        let defaultHitLocationsEnabled;

                        before(async function () {
                            defaultHitLocationsEnabled = await getAndSetGameSetting(
                                "hit locations",
                                "hitLocationsWithSectional",
                            );
                        });

                        after(async function () {
                            await getAndSetGameSetting("hit locations", defaultHitLocationsEnabled);
                        });

                        describe("simple 1 range sectional activation roll (12-13) (equivalent of 8-)", function () {
                            it("should not auto success activate with a hit location 3", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorShortVest, HeroRoll, {
                                        hitLocationNum: 3,
                                    }),
                                ).to.equal(false);
                            });

                            it("should not activate with a hit location of 11", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorShortVest, HeroRoll, {
                                        hitLocationNum: 11,
                                    }),
                                ).to.equal(false);
                            });

                            it("should activate with a hit location of 12", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorShortVest, HeroRoll, {
                                        hitLocationNum: 12,
                                    }),
                                ).to.equal(true);
                            });

                            it("should activate with a hit location of 13", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorShortVest, HeroRoll, {
                                        hitLocationNum: 13,
                                    }),
                                ).to.equal(true);
                            });

                            it("should not activate with a hit location of 14", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorShortVest, HeroRoll, {
                                        hitLocationNum: 14,
                                    }),
                                ).to.equal(false);
                            });
                        });

                        describe("simple 1 range sectional activation roll (11-13) (equivalent of 9-)", function () {
                            it("should not activate with a hit location of 10", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorStandardVest, HeroRoll, {
                                        hitLocationNum: 10,
                                    }),
                                ).to.equal(false);
                            });

                            it("should activate with a hit location of 11", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorStandardVest, HeroRoll, {
                                        hitLocationNum: 11,
                                    }),
                                ).to.equal(true);
                            });

                            it("should activate with a hit location of 13", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorStandardVest, HeroRoll, {
                                        hitLocationNum: 13,
                                    }),
                                ).to.equal(true);
                            });

                            it("should not activate with a hit location of 14", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorStandardVest, HeroRoll, {
                                        hitLocationNum: 14,
                                    }),
                                ).to.equal(false);
                            });
                        });

                        describe("simple 1 range sectional activation roll (10-13) (equivalent of 10-)", function () {
                            it("should not activate with a hit location of 9", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorCapLongVest, HeroRoll, {
                                        hitLocationNum: 9,
                                    }),
                                ).to.equal(false);
                            });

                            it("should activate with a hit location of 10", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorCapLongVest, HeroRoll, {
                                        hitLocationNum: 10,
                                    }),
                                ).to.equal(true);
                            });

                            it("should activate with a hit location of 13", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorCapLongVest, HeroRoll, {
                                        hitLocationNum: 13,
                                    }),
                                ).to.equal(true);
                            });

                            it("should not activate with a hit location of 14", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(sectionalArmorCapLongVest, HeroRoll, {
                                        hitLocationNum: 14,
                                    }),
                                ).to.equal(false);
                            });
                        });

                        describe("2 range sectional activation roll (4-5, 9-13) (equivalent of 12-)", function () {
                            describe("first range 4-5", function () {
                                it("should not activate with a hit location of 3", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorHelmetJacket, HeroRoll, {
                                            hitLocationNum: 3,
                                        }),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 4", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorHelmetJacket, HeroRoll, {
                                            hitLocationNum: 4,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 5", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorHelmetJacket, HeroRoll, {
                                            hitLocationNum: 5,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 6", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorHelmetJacket, HeroRoll, {
                                            hitLocationNum: 6,
                                        }),
                                    ).to.equal(false);
                                });
                            });

                            describe("second range 9-13", function () {
                                it("should not activate with a hit location of 8", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorHelmetJacket, HeroRoll, {
                                            hitLocationNum: 8,
                                        }),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 9", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorHelmetJacket, HeroRoll, {
                                            hitLocationNum: 9,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 13", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorHelmetJacket, HeroRoll, {
                                            hitLocationNum: 13,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 14", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorHelmetJacket, HeroRoll, {
                                            hitLocationNum: 14,
                                        }),
                                    ).to.equal(false);
                                });
                            });
                        });

                        describe("3 range sectional activation roll (3-5,9-14,16-18) (equivalent of 12-)", function () {
                            describe("first range 3-5", function () {
                                it("should not activate with a hit location of 2", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 2 },
                                        ),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 4", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 4 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 5", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 5 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 6", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 6 },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("second range 9-14", function () {
                                it("should not activate with a hit location of 8", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 8 },
                                        ),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 9", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 9 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 14", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 14 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 15", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 15 },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("third range 16-18", function () {
                                it("should activate with a hit location of 16", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 16 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 18", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 18 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 19", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 19 },
                                        ),
                                    ).to.equal(true);
                                });
                            });
                        });

                        describe("3 range sectional activation roll (3-5,9-14, and 16-18) (equivalent of 12-)", function () {
                            describe("first range 3-5", function () {
                                it("should not activate with a hit location of 2", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 2 },
                                        ),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 3", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 3 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 5", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 5 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 6", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 6 },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("second range 9-14", function () {
                                it("should not activate with a hit location of 8", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 8 },
                                        ),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 9", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 9 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 14", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 14 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 15", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 15 },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("third range 16-18", function () {
                                it("should activate with a hit location of 16", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 16 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 18", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 18 },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 19", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            sectionalArmorFullCoverageHelmetVestAndHighBoots,
                                            HeroRoll,
                                            { hitLocationNum: 19 },
                                        ),
                                    ).to.equal(true);
                                });
                            });
                        });

                        describe("multi range sectional activation roll(3,5 ,9- 10,12, 14 -15, and 17 - 18) (equivalent of >= 15-)", function () {
                            describe("first range 3", function () {
                                it("should not activate with a hit location of 2", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 2,
                                        }),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 3", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 3,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 4", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 4,
                                        }),
                                    ).to.equal(false);
                                });
                            });

                            describe("second range 5", function () {
                                it("should activate with a hit location of 5", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 5,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 6", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 6,
                                        }),
                                    ).to.equal(false);
                                });
                            });

                            describe("third range 9-10", function () {
                                it("should not activate with a hit location of 8", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 8,
                                        }),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 9", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 9,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 10", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 10,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 11", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 11,
                                        }),
                                    ).to.equal(false);
                                });
                            });

                            describe("fourth range 12", function () {
                                it("should activate with a hit location of 12", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 12,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 13", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 13,
                                        }),
                                    ).to.equal(false);
                                });
                            });

                            describe("fifth range 14 -15", function () {
                                it("should activate with a hit location of 14", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 14,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 15", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 15,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 16", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 16,
                                        }),
                                    ).to.equal(false);
                                });
                            });

                            describe("sixth range 17 - 18", function () {
                                it("should activate with a hit location of 17", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 17,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 18", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 18,
                                        }),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 19", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(sectionalArmorWeirdCoverage, HeroRoll, {
                                            hitLocationNum: 19,
                                        }),
                                    ).to.equal(true);
                                });
                            });
                        });
                    });

                    describe("sectional activation roll with hit locations not active", function () {
                        let defaultHitLocationsEnabled;

                        before(async function () {
                            defaultHitLocationsEnabled = await getAndSetGameSetting("hit locations", "noHitLocations");
                        });

                        after(async function () {
                            await getAndSetGameSetting("hit locations", defaultHitLocationsEnabled);
                        });

                        describe("simple 1 range sectional activation roll (12-13) (equivalent of 8-)", function () {
                            it("should not activate with a hit location of 12 if rolling an 9 for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        sectionalArmorShortVest,
                                        resetDiceClass(Roll9On3Dice),
                                        {
                                            hitLocationNum: 12,
                                        },
                                    ),
                                ).to.equal(false);
                            });

                            it("should activate with a hit location of 12 if rolling a 6 for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        sectionalArmorShortVest,
                                        resetDiceClass(Roll6On3Dice),
                                        {
                                            hitLocationNum: 12,
                                        },
                                    ),
                                ).to.equal(true);
                            });
                        });

                        describe("simple 1 range sectional activation roll (11-13) (equivalent of 9-)", function () {
                            it("should not activate with a hit location of 11 if rolling an 10 for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        sectionalArmorStandardVest,
                                        resetDiceClass(Roll10On3Dice),
                                        {
                                            hitLocationNum: 11,
                                        },
                                    ),
                                ).to.equal(false);
                            });

                            it("should activate with a hit location of 12 if rolling a 6 for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        sectionalArmorStandardVest,
                                        resetDiceClass(Roll9On3Dice),
                                        {
                                            hitLocationNum: 11,
                                        },
                                    ),
                                ).to.equal(true);
                            });
                        });
                    });

                    describe("Activation rolls with sectional defenses have hero validations", function () {
                        it("should recognize a valid section defense declaration", function () {
                            expect(sectionalArmorShortVest.heroValidation).to.have.deep.members([]);
                        });

                        // We can't distinguish between an invalid sectional defense location and a regular comment
                        it("should recognize an invalid section defense declaration (words - locationss)", function () {
                            expect(sectionalArmorInvalidDeclarationWords.heroValidation).to.have.deep.members([]);
                        });

                        it("should recognize an invalid section defense declaration (words - invalid)", function () {
                            const heroValidation = sectionalArmorInvalidDeclarationWordsTwo.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should recognize an invalid section defense declaration (invalid hit locations)", function () {
                            const heroValidation = sectionalArmorInvalidDeclarationInvalidHitLocations.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should recognize an invalid section defense declaration (for non defense power)", function () {
                            const heroValidation = sectionalDeclarationInFlash.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should recognize an valid section defense declaration with incorrect probability calculation", function () {
                            const heroValidation = sectionalArmorInvalidDeclarationInvalidProbability.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.WARNING);
                        });
                    });

                    describe.skip("Activation Roll - Jammed and Burnout", function () {
                        it("Handles burnout on failed activation roll", function () {
                            // Expected: Power is lost or disabled per Burnout rules
                        });

                        it("Handles jammed on failed activation roll", function () {
                            // Expected: Power is jammed and cannot be used until cleared
                        });

                        it("Succeeds when roll is equal to or less than activation number", function () {
                            // Expected: Standard Success/Failure Scenarios
                        });
                    });
                });

                describe("5e character with sectional defenses", function () {
                    const contents = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Heroic.hdt">
                        <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                        <CHARACTER_INFO CHARACTER_NAME="TEST 5e Sectional Defense Man" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <STR XMLID="STR" ID="1784471604220" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1784471603971" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEX>
                            <CON XMLID="CON" ID="1784471603953" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </CON>
                            <BODY XMLID="BODY" ID="1784471604189" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </BODY>
                            <INT XMLID="INT" ID="1784471604018" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1784471604622" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </EGO>
                            <PRE XMLID="PRE" ID="1784471604098" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PRE>
                            <COM XMLID="COM" ID="1784471604571" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </COM>
                            <PD XMLID="PD" ID="1784471604644" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1784471604870" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </ED>
                            <SPD XMLID="SPD" ID="1784471604262" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SPD>
                            <REC XMLID="REC" ID="1784471604589" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </REC>
                            <END XMLID="END" ID="1784471604140" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </END>
                            <STUN XMLID="STUN" ID="1784471604176" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STUN>
                            <RUNNING XMLID="RUNNING" ID="1784471604340" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1784471603958" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1784471604589" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </LEAPING>
                        </CHARACTERISTICS>
                        <SKILLS />
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS />
                        <POWERS>
                            <LIST XMLID="GENERIC_OBJECT" ID="1784472619462" BASECOST="0.0" LEVELS="0" ALIAS="Valid Sectional Defenses" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <POWER XMLID="ARMOR" ID="1784471619010" BASECOST="0.0" LEVELS="20" ALIAS="Armor" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1784472619462" NAME="Short Vest" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="10" EDLEVELS="10">
                            <NOTES />
                            <MODIFIER XMLID="SECTIONAL_DEFENSES" ID="1784472400240" BASECOST="-2.0" LEVELS="0" ALIAS="Sectional Defenses" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SHORTVEST" OPTIONID="SHORTVEST" OPTION_ALIAS="Short Vest (Protects Locations 12-13" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="ARMOR" ID="1784471687882" BASECOST="0.0" LEVELS="20" ALIAS="Armor" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1784472619462" NAME="Standard Vest" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="10" EDLEVELS="10">
                            <NOTES />
                            <MODIFIER XMLID="SECTIONAL_DEFENSES" ID="1784472410213" BASECOST="-1.5" LEVELS="0" ALIAS="Sectional Defenses" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STANDARDVEST" OPTIONID="STANDARDVEST" OPTION_ALIAS="Standard Vest (Protects Locations 11-13" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="ARMOR" ID="1784471737394" BASECOST="0.0" LEVELS="20" ALIAS="Armor" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1784472619462" NAME="Full Coverage Helmet, Long Jacket with Gauntlets, High Boots" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="10" EDLEVELS="10">
                            <NOTES />
                            <MODIFIER XMLID="SECTIONAL_DEFENSES" ID="1784472420928" BASECOST="-0.25" LEVELS="0" ALIAS="Sectional Defenses" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FULLCOVERAGE" OPTIONID="FULLCOVERAGE" OPTION_ALIAS="Full Coverage Helmet, Long Jacket with Gauntlets, High Boots (Protects Locations 3-5, 7-14, 16-18" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <LIST XMLID="GENERIC_OBJECT" ID="1784472639649" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <LIST XMLID="GENERIC_OBJECT" ID="1784472643444" BASECOST="0.0" LEVELS="0" ALIAS="Invalid Sectional Defenses" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <POWER XMLID="ARMOR" ID="1784472658826" BASECOST="0.0" LEVELS="20" ALIAS="Armor" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1784472643444" NAME="Invalid Short Vest That Specifies More Locations So Incorrect Cost" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="10" EDLEVELS="10">
                            <NOTES />
                            <MODIFIER XMLID="SECTIONAL_DEFENSES" ID="1784472676520" BASECOST="-2.0" LEVELS="0" ALIAS="Sectional Defenses" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SHORTVEST" OPTIONID="SHORTVEST" OPTION_ALIAS="Override that covers stomach to feet" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Protects Locations 12-18" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                        </POWERS>
                        <DISADVANTAGES />
                        <EQUIPMENT />
                        </CHARACTER>
                    `;

                    let actor;
                    let defaultHitLocationsEnabled;

                    let sectionalDefenseShortVestArmor;
                    let sectionalDefenseStandardVestArmor;
                    let sectionalDefenseFullCoverageArmor;

                    let invalidSectionalDefenseStomachToFeetArmor;

                    before(async function () {});

                    after(async function () {});

                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: true });

                        defaultHitLocationsEnabled = await getAndSetGameSetting(
                            "hit locations",
                            "hitLocationsWithSectional",
                        );

                        sectionalDefenseShortVestArmor = actor.items.find((item) => item.name === "Short Vest");
                        sectionalDefenseStandardVestArmor = actor.items.find((item) => item.name === "Standard Vest");
                        sectionalDefenseFullCoverageArmor = actor.items.find(
                            (item) => item.name === "Full Coverage Helmet, Long Jacket with Gauntlets, High Boots",
                        );

                        invalidSectionalDefenseStomachToFeetArmor = actor.items.find(
                            (item) =>
                                item.name === "Invalid Short Vest That Specifies More Locations So Incorrect Cost",
                        );
                    });

                    after(async function () {
                        await getAndSetGameSetting("hit locations", defaultHitLocationsEnabled);

                        await deleteQuenchActor({ quench: this, actor });
                    });

                    describe("sectional security armor cost", function () {
                        it("should have the short vest cost correct", function () {
                            expect(sectionalDefenseShortVestArmor.realCost).to.equal(10);
                        });

                        it("should have the short vest cost correct", function () {
                            expect(sectionalDefenseStandardVestArmor.realCost).to.equal(12);
                        });

                        it("should have the short vest cost correct", function () {
                            expect(sectionalDefenseFullCoverageArmor.realCost).to.equal(24);
                        });
                    });

                    describe("sectional security armor hero validation", function () {
                        it("should have no heroValidation concerns for short vest (success)", function () {
                            const heroValidation = sectionalDefenseShortVestArmor.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have no heroValidation concerns for standard vest (success)", function () {
                            const heroValidation = sectionalDefenseStandardVestArmor.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have no heroValidation concerns for full coverage (success)", function () {
                            const heroValidation = sectionalDefenseFullCoverageArmor.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should recognize an valid section defense declaration with incorrect probability calculation", function () {
                            const heroValidation = invalidSectionalDefenseStomachToFeetArmor.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.WARNING);
                        });
                    });

                    describe("sectional security armor activation with hit locations active", function () {
                        describe("simple 1 range activation roll (12-13) (equivalent of 8-)", function () {
                            it("should not activate with a hit location of 12", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        sectionalDefenseShortVestArmor,
                                        resetDiceClass(Roll9On3Dice),
                                        {
                                            hitLocationNum: 12,
                                        },
                                    ),
                                ).to.equal(true);
                            });

                            it("should activate with a hit location of 13", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        sectionalDefenseShortVestArmor,
                                        resetDiceClass(Roll6On3Dice),
                                        {
                                            hitLocationNum: 13,
                                        },
                                    ),
                                ).to.equal(true);
                            });

                            it("should not activate with a hit location of 14", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        sectionalDefenseShortVestArmor,
                                        resetDiceClass(Roll6On3Dice),
                                        {
                                            hitLocationNum: 14,
                                        },
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("simple invalid 1 range activation roll (12-18) should still work", function () {
                            it("should activate with a hit location of 12", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        invalidSectionalDefenseStomachToFeetArmor,
                                        resetDiceClass(Roll9On3Dice),
                                        {
                                            hitLocationNum: 12,
                                        },
                                    ),
                                ).to.equal(true);
                            });

                            it("should activate with a hit location of 19", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        invalidSectionalDefenseStomachToFeetArmor,
                                        resetDiceClass(Roll6On3Dice),
                                        {
                                            hitLocationNum: 19,
                                        },
                                    ),
                                ).to.equal(true);
                            });

                            it("should not activate with a hit location of 11", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        invalidSectionalDefenseStomachToFeetArmor,
                                        resetDiceClass(Roll6On3Dice),
                                        {
                                            hitLocationNum: 11,
                                        },
                                    ),
                                ).to.equal(false);
                            });
                        });
                    });
                });

                describe("5e - requires a skill roll", function () {
                    const contents = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Superheroic.hdt">
                        <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                        <CHARACTER_INFO CHARACTER_NAME="Test 5e Requires Skill Roll Man" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.46224760379584" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <STR XMLID="STR" ID="1774142627887" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1774142627915" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEX>
                            <CON XMLID="CON" ID="1774142627900" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </CON>
                            <BODY XMLID="BODY" ID="1774142628378" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </BODY>
                            <INT XMLID="INT" ID="1774142628524" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </INT>
                            <EGO XMLID="EGO" ID="1774142628258" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </EGO>
                            <PRE XMLID="PRE" ID="1774142628046" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PRE>
                            <COM XMLID="COM" ID="1774142628559" BASECOST="0.0" LEVELS="0" ALIAS="COM" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </COM>
                            <PD XMLID="PD" ID="1774142628390" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </PD>
                            <ED XMLID="ED" ID="1774142628238" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </ED>
                            <SPD XMLID="SPD" ID="1774142628459" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SPD>
                            <REC XMLID="REC" ID="1774142627846" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </REC>
                            <END XMLID="END" ID="1774142628189" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </END>
                            <STUN XMLID="STUN" ID="1774142627957" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STUN>
                            <RUNNING XMLID="RUNNING" ID="1774142628084" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1774142627962" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1774142628064" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </LEAPING>
                        </CHARACTERISTICS>
                        <SKILLS>
                            <LIST XMLID="GENERIC_OBJECT" ID="1776635236344" BASECOST="0.0" LEVELS="0" ALIAS="Required For Requires A Skill Roll" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <SKILL XMLID="ACROBATICS" ID="1776635035005" BASECOST="3.0" LEVELS="0" ALIAS="Acrobatics" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776635236344" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                            <NOTES />
                            </SKILL>
                            <SKILL XMLID="BREAKFALL" ID="1776635038926" BASECOST="3.0" LEVELS="3" ALIAS="Breakfall" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776635236344" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                            <NOTES />
                            </SKILL>
                            <SKILL XMLID="KNOWLEDGE_SKILL" ID="1776733214260" BASECOST="2.0" LEVELS="0" ALIAS="KS" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776635236344" NAME="" INPUT="sandwiches" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General">
                            <NOTES />
                            </SKILL>
                            <SKILL XMLID="KNOWLEDGE_SKILL" ID="1776733224900" BASECOST="2.0" LEVELS="1" ALIAS="KS" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776635236344" NAME="" INPUT="potato chips" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General">
                            <NOTES />
                            </SKILL>
                        </SKILLS>
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS />
                        <POWERS>
                            <POWER XMLID="LUCK" ID="1778871856563" BASECOST="0.0" LEVELS="5" ALIAS="Luck" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                            </POWER>
                            <LIST XMLID="GENERIC_OBJECT" ID="1776305288516" BASECOST="0.0" LEVELS="0" ALIAS="Requires A Skill Roll" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <POWER XMLID="AID" ID="1776304663512" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires BrEaKfAlL with no penalty based on AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1782940589407" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A BrEaKfAlL Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="0" ROLLALIAS="BrEaKfAlL">
                                <NOTES />
                                <ADDER XMLID="NOAPPENALTY" ID="1782940606972" BASECOST="0.5" LEVELS="0" ALIAS="No Active Point penalty to Skill Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776304663512" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires Breakfall with no penalty based on AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150924747" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Breakfall Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="0" ROLLALIAS="Breakfall">
                                <NOTES />
                                <ADDER XMLID="NOAPPENALTY" ID="1777150924734" BASECOST="0.5" LEVELS="0" ALIAS="No Active Point penalty to Skill Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776305444625" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires Breakfall with -1 per 20 AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150934330" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Breakfall Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="0" ROLLALIAS="Breakfall">
                                <NOTES />
                                <ADDER XMLID="MINUS1PER20" ID="1777150934317" BASECOST="0.25" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 20 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776305448133" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires Breakfall with -1 per 10 AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150940070" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Breakfall Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="0" ROLLALIAS="Breakfall">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776305450850" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires Breakfall with -1 per 5 AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150945927" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Breakfall Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="0" ROLLALIAS="Breakfall">
                                <NOTES />
                                <ADDER XMLID="MINUS1PER5" ID="1777150945914" BASECOST="-0.5" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 5 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776305670855" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires Breakfall with -1 per 5 AP with skill vs skill contest" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150951485" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Breakfall Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="0" ROLLALIAS="Breakfall">
                                <NOTES />
                                <ADDER XMLID="MINUS1PER5" ID="1777150951471" BASECOST="-0.5" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 5 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                                <ADDER XMLID="SKILLVSSKILL" ID="1777150951472" BASECOST="-0.25" LEVELS="0" ALIAS="RSR Skill is subject to Skill vs. Skill contests" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776305556832" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires Breakfall or Acrobatics with -1 per 10 AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150957357" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Breakfall or Acrobatics Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="0" ROLLALIAS="Breakfall or Acrobatics">
                                <NOTES />
                                <ADDER XMLID="VARIABLERSR" ID="1777150957344" BASECOST="0.25" LEVELS="0" ALIAS="Variable RSR" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776633750643" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires Breakfall and Acrobatics with -1 per 20 AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150962863" BASECOST="-0.75" LEVELS="0" ALIAS="Requires A Breakfall Roll And An Acrobatics Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOROLLS" OPTIONID="TWOROLLS" OPTION_ALIAS="Two RSRs on same Power" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="0" TYPE2="0" ROLLALIAS="Breakfall" ROLLALIAS2="Acrobatics">
                                <NOTES />
                                <ADDER XMLID="MINUS1PER20" ID="1777150962850" BASECOST="0.25" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 20 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776305729982" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires 1 Luck" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150969437" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A Luck Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ONELUCK" OPTIONID="ONELUCK" OPTION_ALIAS="One level of Luck required" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                                <ADDER XMLID="NOAPPENALTY" ID="1777150969424" BASECOST="0.5" LEVELS="0" ALIAS="No Active Point penalty to Skill Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776634671679" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires 2 Luck" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150977780" BASECOST="-1.5" LEVELS="0" ALIAS="Requires Two Levels of Luck" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOLUCK" OPTIONID="TWOLUCK" OPTION_ALIAS="Two levels of Luck required" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                                <ADDER XMLID="NOAPPENALTY" ID="1777150977767" BASECOST="0.5" LEVELS="0" ALIAS="No Active Point penalty to Skill Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776634667853" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires 3 Luck" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777150983454" BASECOST="-2.0" LEVELS="0" ALIAS="Requires Three Levels of Luck" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="THREELUCK" OPTIONID="THREELUCK" OPTION_ALIAS="Three levels of Luck required" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                                <ADDER XMLID="NOAPPENALTY" ID="1777150983441" BASECOST="0.5" LEVELS="0" ALIAS="No Active Point penalty to Skill Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776733414418" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires KS: sandwiches and KS: potato chips with no penalty based on AP" INPUT="STR" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1776734381825" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A KS: sandwiches Roll And A KS: potato chips Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOROLLS" OPTIONID="TWOROLLS" OPTION_ALIAS="Two RSRs on same Power" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="1" TYPE2="1" ROLLALIAS="KS: sandwiches" ROLLALIAS2="KS: potato chips">
                                <NOTES />
                                <ADDER XMLID="NOAPPENALTY" ID="1776734383328" BASECOST="0.5" LEVELS="0" ALIAS="No Active Point penalty to Skill Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776734031307" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires KS: sandwiches and KS: potato chips with -1 per 5 AP" INPUT="STR" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1776734034466" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A KS: sandwiches Roll And A KS: potato chips Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOROLLS" OPTIONID="TWOROLLS" OPTION_ALIAS="Two RSRs on same Power" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="1" TYPE2="1" ROLLALIAS="KS: sandwiches" ROLLALIAS2="KS: potato chips">
                                <NOTES />
                                <ADDER XMLID="MINUS1PER5" ID="1776734054481" BASECOST="-0.5" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 5 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1776735639686" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires Perception with -1 per 5 AP" INPUT="STR" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1776735643094" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A PER Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="3" ROLLALIAS="PER">
                                <NOTES />
                                <ADDER XMLID="MINUS1PER5" ID="1776735679382" BASECOST="-0.5" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 5 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="AID" ID="1777426698757" BASECOST="0.0" LEVELS="1" ALIAS="Aid" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1776305288516" NAME="Requires STR with -1 per 20 AP" INPUT="STR" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777426738566" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A STR Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="2" CHARACTERISTIC="1" ROLLALIAS="STR">
                                    <NOTES />
                                    <ADDER XMLID="MINUS1PER20" ID="1777426738553" BASECOST="0.25" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 20 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </POWER>
                            <LIST XMLID="GENERIC_OBJECT" ID="1777150889000" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <LIST XMLID="GENERIC_OBJECT" ID="1777150891823" BASECOST="0.0" LEVELS="0" ALIAS="Invalid Requires A Skill Roll" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <POWER XMLID="DRAIN" ID="1777150364583" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777150891823" NAME="Drain Invalid RSR missing background skill name" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1782939956278" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A KS: Hot Dogs Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="1" ROLLALIAS="KS: Hot Dogs">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="DRAIN" ID="1777150364583" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777150891823" NAME="Drain Invalid RSR missing background skill KS: Hot Dogs" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777151112665" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A KS: Hot Dogs Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="1" ROLLALIAS="KS: Hot Dogs">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="DRAIN" ID="1777151162933" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777150891823" NAME="Drain Invalid RSR missing skill Animal Handler" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777151167447" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A KS: Hot Dogs Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="1" ROLLALIAS="KS: Hot Dogs">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="DRAIN" ID="1777151218537" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777150891823" NAME="Drain Invalid RSR missing Interrogation skill for Acrobatics or Interrogation" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777151423708" BASECOST="-0.25" LEVELS="0" ALIAS="Requires an Acrobatics or Interrogation An Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="1" ROLLALIAS="Acrobatics or Interrogation">
                                    <NOTES />
                                    <ADDER XMLID="VARIABLERSR" ID="1777151423695" BASECOST="0.25" LEVELS="0" ALIAS="Variable RSR" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="DRAIN" ID="1777151332220" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777150891823" NAME="Drain Invalid RSR missing both Interrogation and Stealth skills" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777151337600" BASECOST="-0.5" LEVELS="0" ALIAS="Requires An Interrogation Roll And A Stealth Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOROLLS" OPTIONID="TWOROLLS" OPTION_ALIAS="Two RSRs on same Power" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="1" TYPE2="0" ROLLALIAS="Interrogation" ROLLALIAS2="Stealth">
                                    <NOTES />
                                    <ADDER XMLID="VARIABLERSR" ID="1777151342181" BASECOST="0.25" LEVELS="0" ALIAS="Variable RSR" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="DRAIN" ID="1777151441844" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777150891823" NAME="Drain Invalid RSR missing Stealth for both Acrobatics and Stealth skills" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777151446899" BASECOST="-0.5" LEVELS="0" ALIAS="Requires An Acrobatics Roll And A Stealth Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOROLLS" OPTIONID="TWOROLLS" OPTION_ALIAS="Two RSRs on same Power" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="1" TYPE2="0" ROLLALIAS="Acrobatics" ROLLALIAS2="Stealth">
                                    <NOTES />
                                    <ADDER XMLID="VARIABLERSR" ID="1777151472357" BASECOST="0.25" LEVELS="0" ALIAS="Variable RSR" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </POWER>
                            <POWER XMLID="DRAIN" ID="1778949758069" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777150891823" NAME="Drain Invalid RSR Luck With -1 Per 5 AP Penalty" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1778949762645" BASECOST="-1.5" LEVELS="0" ALIAS="Requires Two Levels of Luck" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOLUCK" OPTIONID="TWOLUCK" OPTION_ALIAS="Two levels of Luck required" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="MINUS1PER5" ID="1778949807888" BASECOST="-0.5" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 5 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                            </POWER>
                        </POWERS>
                        <DISADVANTAGES />
                        <EQUIPMENT />
                        </CHARACTER>
                    `;
                    let actor;

                    let aidRequiresBreakfallStrangeCapitalizationWithNoApPenalty;
                    let aidRequiresBreakfallWithNoApPenalty;
                    let aidRequiresBreakfallWith1Per20ApPenalty;
                    let aidRequiresBreakfallWith1Per10ApPenalty;
                    let aidRequiresBreakfallWith1Per5ApPenalty;
                    let aidRequiresBreakfallWith1Per5ApPenaltySkillVsSkillContest;
                    let aidRequiresBreakfallOrAcrobaticsWith1Per10ApPenalty;
                    let aidRequiresBreakfallAndAcrobaticsWith1Per20ApPenalty;
                    let aidRequires1Luck;
                    let aidRequires2Luck;
                    let aidRequires3Luck;
                    let aidRequiresKsSandwichesAndKsPotatoChipsWithNoApPenalty;
                    let aidRequiresKsSandwichesAndKsPotatoChipsWith1Per5ApPenalty;
                    let aidRequiresPerceptionWith1Per5ApPenalty;
                    let aidRequiresStrWith1Per20ApPenalty;

                    let invalidDrainMissingBackgroundSkillNameToLink;
                    let invalidDrainMissingBackgroundSkill;
                    let invalidDrainMissingSkill;
                    let invalidDrainMissingSkillFromVariableSkillChoice;
                    let invalidDrainMissingOneSkillFromTwoRequiredSkills;
                    let invalidDrainMissingBothSkillsFromTwoRequiredSkills;
                    let invalidDrainHasApPenaltyAgainstLuck;

                    let breakfallSkill;
                    let acrobaticsSkill;
                    let ksSandwichesBackgroundSkill;
                    let ksPotatoChipsBackgroundSkill;
                    let luckPower;

                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: true });

                        aidRequiresBreakfallStrangeCapitalizationWithNoApPenalty = actor.items.find(
                            (item) => item.name === "Requires BrEaKfAlL with no penalty based on AP",
                        );
                        aidRequiresBreakfallWithNoApPenalty = actor.items.find(
                            (item) => item.name === "Requires Breakfall with no penalty based on AP",
                        );
                        aidRequiresBreakfallWith1Per20ApPenalty = actor.items.find(
                            (item) => item.name === "Requires Breakfall with -1 per 20 AP",
                        );
                        aidRequiresBreakfallWith1Per10ApPenalty = actor.items.find(
                            (item) => item.name === "Requires Breakfall with -1 per 10 AP",
                        );
                        aidRequiresBreakfallWith1Per5ApPenalty = actor.items.find(
                            (item) => item.name === "Requires Breakfall with -1 per 5 AP",
                        );
                        aidRequiresBreakfallWith1Per5ApPenaltySkillVsSkillContest = actor.items.find(
                            (item) => item.name === "Requires Breakfall with -1 per 5 AP with skill vs skill contest",
                        );
                        aidRequiresBreakfallOrAcrobaticsWith1Per10ApPenalty = actor.items.find(
                            (item) => item.name === "Requires Breakfall or Acrobatics with -1 per 10 AP",
                        );
                        aidRequiresBreakfallAndAcrobaticsWith1Per20ApPenalty = actor.items.find(
                            (item) => item.name === "Requires Breakfall and Acrobatics with -1 per 20 AP",
                        );
                        aidRequires1Luck = actor.items.find((item) => item.name === "Requires 1 Luck");
                        aidRequires2Luck = actor.items.find((item) => item.name === "Requires 2 Luck");
                        aidRequires3Luck = actor.items.find((item) => item.name === "Requires 3 Luck");
                        aidRequiresKsSandwichesAndKsPotatoChipsWithNoApPenalty = actor.items.find(
                            (item) =>
                                item.name ===
                                "Requires KS: sandwiches and KS: potato chips with no penalty based on AP",
                        );
                        aidRequiresKsSandwichesAndKsPotatoChipsWith1Per5ApPenalty = actor.items.find(
                            (item) => item.name === "Requires KS: sandwiches and KS: potato chips with -1 per 5 AP",
                        );
                        aidRequiresPerceptionWith1Per5ApPenalty = actor.items.find(
                            (item) => item.name === "Requires Perception with -1 per 5 AP",
                        );
                        aidRequiresStrWith1Per20ApPenalty = actor.items.find(
                            (item) => item.name === "Requires STR with -1 per 20 AP",
                        );

                        invalidDrainMissingBackgroundSkillNameToLink = actor.items.find(
                            (item) => item.name === "Drain Invalid RSR missing background skill name",
                        );
                        invalidDrainMissingBackgroundSkill = actor.items.find(
                            (item) => item.name === "Drain Invalid RSR missing background skill KS: Hot Dogs",
                        );
                        invalidDrainMissingSkill = actor.items.find(
                            (item) => item.name === "Drain Invalid RSR missing skill Animal Handler",
                        );
                        invalidDrainMissingSkillFromVariableSkillChoice = actor.items.find(
                            (item) =>
                                item.name ===
                                "Drain Invalid RSR missing Interrogation skill for Acrobatics or Interrogation",
                        );
                        invalidDrainMissingOneSkillFromTwoRequiredSkills = actor.items.find(
                            (item) =>
                                item.name ===
                                "Drain Invalid RSR missing Stealth for both Acrobatics and Stealth skills",
                        );
                        invalidDrainMissingBothSkillsFromTwoRequiredSkills = actor.items.find(
                            (item) => item.name === "Drain Invalid RSR missing both Interrogation and Stealth skills",
                        );
                        invalidDrainHasApPenaltyAgainstLuck = actor.items.find(
                            (item) => item.name === "Drain Invalid RSR Luck With -1 Per 5 AP Penalty",
                        );

                        breakfallSkill = actor.items.find((item) => item.name === "Breakfall");
                        acrobaticsSkill = actor.items.find((item) => item.name === "Acrobatics");
                        ksSandwichesBackgroundSkill = actor.items.find((item) => item.name === "KS: sandwiches");
                        ksPotatoChipsBackgroundSkill = actor.items.find((item) => item.name === "KS: potato chips");
                        luckPower = actor.items.find((item) => item.name === "Luck");
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    describe("RSR costs in all the various flavours", function () {
                        it("should have the correct cost for a 3/2 skill with no penalty based on AP", function () {
                            expect(aidRequiresBreakfallWithNoApPenalty.realCost).to.equal(10);
                        });

                        it("should have the correct cost for a 3/2 skill with -1 per 20 AP", function () {
                            expect(aidRequiresBreakfallWith1Per20ApPenalty.realCost).to.equal(8);
                        });

                        it("should have the correct cost for a 3/2 skill with -1 per 10 AP", function () {
                            expect(aidRequiresBreakfallWith1Per10ApPenalty.realCost).to.equal(7);
                        });

                        it("should have the correct cost for a 3/2 skill with -1 per 5 AP", function () {
                            expect(aidRequiresBreakfallWith1Per5ApPenalty.realCost).to.equal(5);
                        });

                        it("should have the correct cost for a 3/2 skill with -1 per 5 AP used in a skill vs skill context", function () {
                            expect(aidRequiresBreakfallWith1Per5ApPenaltySkillVsSkillContest.realCost).to.equal(4);
                        });

                        it("should have the correct cost for the choice between 2 x 3/2 skill with -1 per 10 AP", function () {
                            expect(aidRequiresBreakfallOrAcrobaticsWith1Per10ApPenalty.realCost).to.equal(8);
                        });

                        it("should have the correct cost for 2 x 3/2 skill with -1 per 20 AP", function () {
                            expect(aidRequiresBreakfallAndAcrobaticsWith1Per20ApPenalty.realCost).to.equal(7);
                        });

                        it("should have the correct cost for a 1 luck roll with no penalty based on AP", function () {
                            expect(aidRequires1Luck.realCost).to.equal(7);
                        });

                        it("should have the correct cost for a 2 luck roll with no penalty based on AP", function () {
                            expect(aidRequires2Luck.realCost).to.equal(5);
                        });

                        it("should have the correct cost for a 3 luck roll with no penalty based on AP", function () {
                            expect(aidRequires3Luck.realCost).to.equal(4);
                        });

                        it("should have the correct cost for 2 x background skills with no penalty based on AP", function () {
                            expect(aidRequiresKsSandwichesAndKsPotatoChipsWithNoApPenalty.realCost).to.equal(10);
                        });

                        it("should have the correct cost for 2 x background skills with -1 per 5 AP", function () {
                            expect(aidRequiresKsSandwichesAndKsPotatoChipsWith1Per5ApPenalty.realCost).to.equal(5);
                        });

                        it("should have the correct cost for perception with -1 per 5 AP", function () {
                            expect(aidRequiresPerceptionWith1Per5ApPenalty.realCost).to.equal(4);
                        });
                    });

                    describe("RSRs have hero validations", function () {
                        it("should have no heroValidation concerns as the character does have listed inante skill despite being different case (success)", function () {
                            const heroValidation =
                                aidRequiresBreakfallStrangeCapitalizationWithNoApPenalty.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have no heroValidation concerns as the character does have listed inante skill (success)", function () {
                            const heroValidation = aidRequiresPerceptionWith1Per5ApPenalty.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have no heroValidation concerns as the character does have both listed variable skill choices (success)", function () {
                            const heroValidation = aidRequiresBreakfallOrAcrobaticsWith1Per10ApPenalty.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have a heroValidation info concerns as the character does have listed background skills but 2 required skill rolls is a GM permission modifier (success)", function () {
                            const heroValidation =
                                aidRequiresKsSandwichesAndKsPotatoChipsWith1Per5ApPenalty.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.INFO);
                        });

                        it("should have a heroValidation error as the character does not have a listed background skill name (error)", function () {
                            const heroValidation = invalidDrainMissingBackgroundSkillNameToLink.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have listed background skill (error)", function () {
                            const heroValidation = invalidDrainMissingBackgroundSkill.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have listed skill (error)", function () {
                            const heroValidation = invalidDrainMissingSkill.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have one of the listed variable skills (error)", function () {
                            const heroValidation = invalidDrainMissingSkillFromVariableSkillChoice.heroValidation;
                            expect(heroValidation.length).to.equal(2);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.WARNING);
                            expect(heroValidation[1]).to.have.property("severity");
                            expect(heroValidation[1].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should not have a heroValidation error as the character does have one of the 2 required listed skills (has breakfall -> success)", function () {
                            const heroValidation = invalidDrainMissingOneSkillFromTwoRequiredSkills.heroValidation;
                            expect(heroValidation.length).to.equal(3);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.INFO);
                            expect(heroValidation[1]).to.have.property("severity");
                            expect(heroValidation[1].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.WARNING);
                            expect(heroValidation[2]).to.have.property("severity");
                            expect(heroValidation[2].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have either of the 2 required listed skills (error)", function () {
                            const heroValidation = invalidDrainMissingBothSkillsFromTwoRequiredSkills.heroValidation;
                            expect(heroValidation.length).to.equal(3);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.INFO);
                            expect(heroValidation[1]).to.have.property("severity");
                            expect(heroValidation[1].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                            expect(heroValidation[2]).to.have.property("severity");
                            expect(heroValidation[2].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character has an AP penalty with their listed luck power (warning)", function () {
                            const heroValidation = invalidDrainHasApPenaltyAgainstLuck.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.WARNING);
                        });

                        it("should have no heroValidation error as the character has STR (success)", function () {
                            const heroValidation = aidRequiresStrWith1Per20ApPenalty.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have no heroValidation error as the character has luck (success)", function () {
                            const heroValidation = aidRequires1Luck.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });
                    });

                    describe("works with skill that actor has", function () {
                        describe("RSR with skill and no penalty based on active points", function () {
                            it("should activate with a roll of 14 (against 14-) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        aidRequiresBreakfallWithNoApPenalty,
                                        resetDiceClass(Roll14On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });

                            it("should fail to activate with a roll of 15 (against 14-) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        aidRequiresBreakfallWithNoApPenalty,
                                        resetDiceClass(Roll15On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("RSR with skill and various penalty levels based on active points", function () {
                            it("should activate with a roll of 12 (against 14- w/ -2 for AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        aidRequiresBreakfallWith1Per5ApPenalty,
                                        resetDiceClass(Roll12On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });

                            it("should fail to activate with a roll of 14 (against 14- w/ -2 for AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        aidRequiresBreakfallWith1Per5ApPenalty,
                                        resetDiceClass(Roll13On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });
                    });

                    describe("RSR with skill that doesn't exist", function () {
                        it("should fail to activate with a missing skill for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    invalidDrainMissingBackgroundSkill,
                                    resetDiceClass(Roll3On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });
                    });

                    describe.skip("RSR with attack (should not use CSL)", function () {});

                    describe.skip("RSR with skill vs skill contest", function () {});

                    describe("RSR with 1 of 2 skill rolls", function () {
                        it("should succeed to activate with the selection of the first skill (breakfall) with a roll of 13 + 1", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresBreakfallOrAcrobaticsWith1Per10ApPenalty,
                                    resetDiceClass(Roll13On3Dice),
                                    { test: { variableSelectIndex: 0 } },
                                ),
                            ).to.equal(true);
                        });

                        it("should fail to activate with the selection of the first skill (breakfall) with a roll of 14 + 1", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresBreakfallOrAcrobaticsWith1Per10ApPenalty,
                                    resetDiceClass(Roll14On3Dice),
                                    { test: { variableSelectIndex: 0 } },
                                ),
                            ).to.equal(false);
                        });

                        it("should succeed to activate with the selection of the second skill (acrobatics) with a roll of 10 + 1", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresBreakfallOrAcrobaticsWith1Per10ApPenalty,
                                    resetDiceClass(Roll10On3Dice),
                                    { test: { variableSelectIndex: 1 } },
                                ),
                            ).to.equal(true);
                        });

                        it("should fail to activate with the selection of the second skill (acrobatics) with a roll of 11 + 1", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresBreakfallOrAcrobaticsWith1Per10ApPenalty,
                                    resetDiceClass(Roll11On3Dice),
                                    { test: { variableSelectIndex: 1 } },
                                ),
                            ).to.equal(false);
                        });
                    });

                    describe("RSR with both of 2 skill rolls", function () {
                        it("should activate with a roll of 11 (against 11- w/ 0 for AP penalty for KS: sandwiches and 12- w/ 0 for AP penalty for KS: potato chips) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresKsSandwichesAndKsPotatoChipsWithNoApPenalty,
                                    resetDiceClass(Roll11On3Dice),
                                    {},
                                ),
                            ).to.equal(true);
                        });

                        it("should fail to activate with a roll of 12 (against 11- w/ 0 for AP penalty for KS: sandwiches and 12- w/ 0 for AP penalty for KS: potato chips) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresKsSandwichesAndKsPotatoChipsWithNoApPenalty,
                                    resetDiceClass(Roll12On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });

                        it("should fail to activate with a roll of 13 (against 11- w/ 0 for AP penalty for KS: sandwiches and 12- w/ 0 for AP penalty for KS: potato chips) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresKsSandwichesAndKsPotatoChipsWithNoApPenalty,
                                    resetDiceClass(Roll13On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });
                    });

                    describe("RSR with luck rolls", function () {
                        it("should activate with a roll of 3 luck (against 3 luck) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequires3Luck,
                                    resetDiceClass(RollAlternatingLuckAndUnluck),
                                    {},
                                ),
                            ).to.equal(true);
                        });

                        it("should fail to activate with a roll of 2 luck (against 3 luck) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequires3Luck,
                                    resetDiceClass(Roll1LuckOn3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });
                    });

                    describe("RSR with characteristics", function () {
                        it("should activate with a roll of 11 (against 12- w/ -1 for AP penalty) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresStrWith1Per20ApPenalty,
                                    resetDiceClass(Roll11On3Dice),
                                    {},
                                ),
                            ).to.equal(true);
                        });

                        it("should not activate with a roll of 12 (against 12- w/ -1 for AP penalty) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresStrWith1Per20ApPenalty,
                                    resetDiceClass(Roll12On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });
                    });

                    describe("should fail when items are not active", async function () {
                        let previousBreakfallSkillState;
                        let previousAcrobaticsSkillState;
                        let previousKsSandwichesBackgroundSkillState;
                        let previousKsPotatoChipsBackgroundSkillState;
                        let luckPowerState;

                        async function turnItemOff(item) {
                            const previousState = item.isActive;
                            await item.turnOff({});
                            return previousState;
                        }

                        async function restoreState(item, previousActiveState) {
                            if (previousActiveState) {
                                await item.turnOn({});
                            } else {
                                await item.turnOff({});
                            }
                        }

                        before(async function () {
                            previousBreakfallSkillState = await turnItemOff(breakfallSkill);
                            previousAcrobaticsSkillState = await turnItemOff(acrobaticsSkill);
                            previousKsSandwichesBackgroundSkillState = await turnItemOff(ksSandwichesBackgroundSkill);
                            previousKsPotatoChipsBackgroundSkillState = await turnItemOff(ksPotatoChipsBackgroundSkill);
                            luckPowerState = await turnItemOff(luckPower);
                        });

                        after(async function () {
                            await restoreState(breakfallSkill, previousBreakfallSkillState);
                            await restoreState(acrobaticsSkill, previousAcrobaticsSkillState);
                            await restoreState(ksSandwichesBackgroundSkill, previousKsSandwichesBackgroundSkillState);
                            await restoreState(ksPotatoChipsBackgroundSkill, previousKsPotatoChipsBackgroundSkillState);
                            await restoreState(luckPower, luckPowerState);
                        });

                        it("should fail to activate with a roll of 3 because the luck power is inactive", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequires1Luck,
                                    resetDiceClass(Roll3LuckOn3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });

                        it("should fail to activate with a roll of 3 because the skill is inactive", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresBreakfallWith1Per5ApPenalty,
                                    resetDiceClass(Roll3On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });

                        it("should fail to activate with a roll of 3 because 1 of the 2 required skills is inactive", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    aidRequiresKsSandwichesAndKsPotatoChipsWithNoApPenalty,
                                    resetDiceClass(Roll3On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });

                        it.skip("should not prompt for the selection of variable skill if one is inactive but at least one is", async function () {});
                    });
                });

                describe("5e - requires a skill roll (expected failures from vehicle)", function () {
                    const contents = `
                        <?xml version="1.0" encoding="UTF-16"?>
                        <CHARACTER version="6.0" TEMPLATE="builtIn.Vehicle.hdt">
                        <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                        <CHARACTER_INFO CHARACTER_NAME="Test 5e Requires Skill Roll Vehicle" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                            <SIZE XMLID="SIZE" ID="1778982880299" BASECOST="0.0" LEVELS="0" ALIAS="Size" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SIZE>
                            <STR XMLID="STR" ID="1778982880273" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </STR>
                            <DEX XMLID="DEX" ID="1778982880406" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEX>
                            <BODY XMLID="BODY" ID="1778982879700" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </BODY>
                            <DEF XMLID="DEF" ID="1778982879697" BASECOST="0.0" LEVELS="0" ALIAS="DEF" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </DEF>
                            <SPD XMLID="SPD" ID="1778982880441" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SPD>
                            <RUNNING XMLID="RUNNING" ID="1778982879794" BASECOST="0.0" LEVELS="0" ALIAS="Ground Movement" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </RUNNING>
                            <SWIMMING XMLID="SWIMMING" ID="1778982880056" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </SWIMMING>
                            <LEAPING XMLID="LEAPING" ID="1778982880519" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            </LEAPING>
                        </CHARACTERISTICS>
                        <SKILLS />
                        <PERKS />
                        <TALENTS />
                        <MARTIALARTS />
                        <POWERS>
                            <LIST XMLID="GENERIC_OBJECT" ID="1778983255815" BASECOST="0.0" LEVELS="0" ALIAS="RSR Rolls" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <LIST XMLID="GENERIC_OBJECT" ID="1778983268663" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <LIST XMLID="GENERIC_OBJECT" ID="1778983186512" BASECOST="0.0" LEVELS="0" ALIAS="Invalid RSR Rolls" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                            </LIST>
                            <POWER XMLID="DRAIN" ID="1778983050625" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1778983186512" NAME="Drain Invalid RSR EGO with -1 per 10 AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1778983353098" BASECOST="-1.0" LEVELS="0" ALIAS="Requires An EGO Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="2" CHARACTERISTIC="1" ROLLALIAS="EGO">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="DRAIN" ID="1778983414424" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1778983186512" NAME="Drain Invalid RSR Perception with -1 per 10 AP" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1778983417732" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A PER Roll " POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BASICRSR" OPTIONID="BASICRSR" OPTION_ALIAS="Basic RSR" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No" TYPE="3" ROLLALIAS="PER">
                                <NOTES />
                            </MODIFIER>
                            </POWER>
                            <POWER XMLID="DRAIN" ID="1778983348301" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1778983186512" NAME="Drain Invalid RSR Luck With -1 Per 5 AP Penalty" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1778983348294" BASECOST="-1.5" LEVELS="0" ALIAS="Requires Two Levels of Luck" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOLUCK" OPTIONID="TWOLUCK" OPTION_ALIAS="Two levels of Luck required" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                                <ADDER XMLID="MINUS1PER5" ID="1778983348281" BASECOST="-0.5" LEVELS="0" ALIAS="Active Point penalty to Skill Roll is -1 per 5 Active Points" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            </POWER>
                        </POWERS>
                        <DISADVANTAGES />
                        <EQUIPMENT />
                        </CHARACTER>
                    `;
                    let actor;

                    let invalidDrainMissingEgoCharacteristic;
                    let invalidDrainMissingPerception;
                    let invalidDrainMissingLuckPower;

                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: true });

                        invalidDrainMissingEgoCharacteristic = actor.items.find(
                            (item) => item.name === "Drain Invalid RSR EGO with -1 per 10 AP",
                        );
                        invalidDrainMissingPerception = actor.items.find(
                            (item) => item.name === "Drain Invalid RSR Perception with -1 per 10 AP",
                        );
                        invalidDrainMissingLuckPower = actor.items.find(
                            (item) => item.name === "Drain Invalid RSR Luck With -1 Per 5 AP Penalty",
                        );
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    describe("RSRs have hero validations", function () {
                        it("should have a heroValidation error as the character does not have EGO (error)", function () {
                            const heroValidation = invalidDrainMissingEgoCharacteristic.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have perception (error)", function () {
                            const heroValidation = invalidDrainMissingPerception.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have listed luck power (error)", function () {
                            const heroValidation = invalidDrainMissingLuckPower.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });
                    });

                    describe("RSR with characteristics", function () {
                        it("should not activate with a roll of 3 (against 11- w/ -1 for AP penalty) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    invalidDrainMissingEgoCharacteristic,
                                    resetDiceClass(Roll3On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });

                        it("should not activate with a roll of 10 (against 11- w/ -1 for AP penalty) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    invalidDrainMissingEgoCharacteristic,
                                    resetDiceClass(Roll10On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });

                        it("should not activate with a roll of 11 (against 11- w/ -1 for AP penalty) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    invalidDrainMissingEgoCharacteristic,
                                    resetDiceClass(Roll11On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });
                    });

                    describe("RSR with perception", function () {
                        it("should not activate with a roll of 3 (against 9- w/ -1 for AP penalty) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    invalidDrainMissingPerception,
                                    resetDiceClass(Roll3On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });

                        it("should not activate with a roll of 8 (against 9- w/ -1 for AP penalty) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    invalidDrainMissingPerception,
                                    resetDiceClass(Roll8On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });

                        it("should not activate with a roll of 9 (against 9- w/ -1 for AP penalty) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    invalidDrainMissingPerception,
                                    resetDiceClass(Roll9On3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });
                    });

                    describe("RSR with luck rolls", function () {
                        it("should activate with a roll of 3 luck (against 3 luck) for activation", async function () {
                            expect(
                                await isActivatedForThisUse_TestingOnly(
                                    invalidDrainMissingLuckPower,
                                    resetDiceClass(Roll3LuckOn3Dice),
                                    {},
                                ),
                            ).to.equal(false);
                        });
                    });
                });

                describe("6e - requires a skills roll", function () {
                    const contents = `
                            <?xml version="1.0" encoding="UTF-16"?>
                            <CHARACTER version="6.0" TEMPLATE="builtIn.Superheroic6E.hdt">
                            <BASIC_CONFIGURATION BASE_POINTS="200" DISAD_POINTS="150" EXPERIENCE="0" RULES="Default" />
                            <CHARACTER_INFO CHARACTER_NAME="6e Requires Activation Roll Man" ALTERNATE_IDENTITIES="" PLAYER_NAME="" HEIGHT="78.74015748031496" WEIGHT="220.4622476037958" HAIR_COLOR="Brown" EYE_COLOR="Brown" CAMPAIGN_NAME="" GENRE="" GM="">
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
                                <STR XMLID="STR" ID="1777340206063" BASECOST="0.0" LEVELS="0" ALIAS="STR" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STR>
                                <DEX XMLID="DEX" ID="1777340205550" BASECOST="0.0" LEVELS="0" ALIAS="DEX" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DEX>
                                <CON XMLID="CON" ID="1777340206001" BASECOST="0.0" LEVELS="0" ALIAS="CON" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </CON>
                                <INT XMLID="INT" ID="1777340205634" BASECOST="0.0" LEVELS="0" ALIAS="INT" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </INT>
                                <EGO XMLID="EGO" ID="1777340205999" BASECOST="0.0" LEVELS="0" ALIAS="EGO" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </EGO>
                                <PRE XMLID="PRE" ID="1777340206092" BASECOST="0.0" LEVELS="0" ALIAS="PRE" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PRE>
                                <OCV XMLID="OCV" ID="1777340205633" BASECOST="0.0" LEVELS="0" ALIAS="OCV" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </OCV>
                                <DCV XMLID="DCV" ID="1777340206065" BASECOST="0.0" LEVELS="0" ALIAS="DCV" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DCV>
                                <OMCV XMLID="OMCV" ID="1777340205887" BASECOST="0.0" LEVELS="0" ALIAS="OMCV" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </OMCV>
                                <DMCV XMLID="DMCV" ID="1777340205627" BASECOST="0.0" LEVELS="0" ALIAS="DMCV" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </DMCV>
                                <SPD XMLID="SPD" ID="1777340206305" BASECOST="0.0" LEVELS="0" ALIAS="SPD" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SPD>
                                <PD XMLID="PD" ID="1777340205581" BASECOST="0.0" LEVELS="0" ALIAS="PD" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </PD>
                                <ED XMLID="ED" ID="1777340205858" BASECOST="0.0" LEVELS="0" ALIAS="ED" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </ED>
                                <REC XMLID="REC" ID="1777340205956" BASECOST="0.0" LEVELS="0" ALIAS="REC" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </REC>
                                <END XMLID="END" ID="1777340206359" BASECOST="0.0" LEVELS="0" ALIAS="END" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </END>
                                <BODY XMLID="BODY" ID="1777340205424" BASECOST="0.0" LEVELS="0" ALIAS="BODY" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </BODY>
                                <STUN XMLID="STUN" ID="1777340206323" BASECOST="0.0" LEVELS="0" ALIAS="STUN" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </STUN>
                                <RUNNING XMLID="RUNNING" ID="1777340206118" BASECOST="0.0" LEVELS="0" ALIAS="Running" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </RUNNING>
                                <SWIMMING XMLID="SWIMMING" ID="1777340205689" BASECOST="0.0" LEVELS="0" ALIAS="Swimming" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </SWIMMING>
                                <LEAPING XMLID="LEAPING" ID="1777340205460" BASECOST="0.0" LEVELS="0" ALIAS="Leaping" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                </LEAPING>
                            </CHARACTERISTICS>
                            <SKILLS>
                                <LIST XMLID="GENERIC_OBJECT" ID="1779049938892" BASECOST="0.0" LEVELS="0" ALIAS="Skills for Requires" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <SKILL XMLID="BREAKFALL" ID="1779049571841" BASECOST="3.0" LEVELS="3" ALIAS="Breakfall" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779049938892" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                </SKILL>
                                <SKILL XMLID="KNOWLEDGE_SKILL" ID="1779049489120" BASECOST="2.0" LEVELS="0" ALIAS="KS" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779049938892" NAME="" INPUT="sardines" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General">
                                <NOTES />
                                </SKILL>
                                <SKILL XMLID="PROFESSIONAL_SKILL" ID="1779049510137" BASECOST="2.0" LEVELS="0" ALIAS="PS" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779049938892" NAME="" INPUT="fisher" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                </SKILL>
                                <SKILL XMLID="SCIENCE_SKILL" ID="1779049551025" BASECOST="2.0" LEVELS="0" ALIAS="Science Skill" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779049938892" NAME="" INPUT="xenobotany" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                </SKILL>
                                <SKILL XMLID="SCIENCE_SKILL" ID="1783012869110" BASECOST="2.0" LEVELS="3" ALIAS="Science Skill" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779049938892" NAME="" INPUT="toothbrush chemistry" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                                <NOTES />
                                </SKILL>
                            </SKILLS>
                            <PERKS />
                            <TALENTS />
                            <MARTIALARTS />
                            <POWERS>
                                <LIST XMLID="GENERIC_OBJECT" ID="1779050236391" BASECOST="0.0" LEVELS="0" ALIAS="Valid Activation Rolls" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <POWER XMLID="ENERGYBLAST" ID="1779050452900" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 14-" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050457410" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050512094" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 14- (Burnout)" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050516264" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="BURNOUT" ID="1779050535751" BASECOST="0.0" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050597128" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 14- (Jammed)" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050601483" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="JAMMED" ID="1779050609021" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1777340234958" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 14- Every Use" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050285832" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779050285797" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050305607" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 13- Every Use" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050332406" BASECOST="0.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="13" OPTIONID="13" OPTION_ALIAS="13- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779050332371" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050676121" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 13-" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050681607" BASECOST="0.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="13" OPTIONID="13" OPTION_ALIAS="13- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050311879" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 12- Every Use" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050345103" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="12" OPTIONID="12" OPTION_ALIAS="12- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779050345068" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050851603" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 12-" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050856501" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="12" OPTIONID="12" OPTION_ALIAS="12- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050315735" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 11- Every Use" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050360170" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779050360135" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050881289" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 11-" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050887183" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050319538" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 10- Every Use" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050373289" BASECOST="-0.75" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="10" OPTIONID="10" OPTION_ALIAS="10- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779050373254" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050906046" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 10-" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050910660" BASECOST="-0.75" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="10" OPTIONID="10" OPTION_ALIAS="10- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050323775" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 9- Every Use" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050385963" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="9" OPTIONID="9" OPTION_ALIAS="9- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779050385928" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050930621" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 9-" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050935124" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="9" OPTIONID="9" OPTION_ALIAS="9- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050328115" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 8- Every Use" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050398251" BASECOST="-1.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779050398215" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050634055" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779050236391" NAME="Requires A Roll 8-" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779050637991" BASECOST="-1.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <LIST XMLID="GENERIC_OBJECT" ID="1779062247542" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <LIST XMLID="GENERIC_OBJECT" ID="1779062251549" BASECOST="0.0" LEVELS="0" ALIAS="Valid Section Defense Activation Rolls" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <POWER XMLID="FORCEFIELD" ID="1779061904778" BASECOST="0.0" LEVELS="14" ALIAS="Resistant Protection" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779062251549" NAME="Weird Coverage (locations   3,5 ,9- 10,12, 14 -15, and 17 - 18)" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="7" EDLEVELS="7" MDLEVELS="0" POWDLEVELS="0">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779062595594" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations   3,5 ,9- 10,12, 14 -15, and 17 - 18" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779062595559" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <LIST XMLID="GENERIC_OBJECT" ID="1779050226817" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <LIST XMLID="GENERIC_OBJECT" ID="1779124636297" BASECOST="0.0" LEVELS="0" ALIAS="Invalid Sectional Defense Declarations" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <POWER XMLID="FORCEFIELD" ID="1779124636323" BASECOST="0.0" LEVELS="4" ALIAS="Force Field" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779124636297" NAME="Sectional Defense with Invalid Declaration Words" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1" MDLEVELS="1" POWDLEVELS="1">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779125322596" BASECOST="-1.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locationss 8-12, invalid, 18" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="FORCEFIELD" ID="1779124636349" BASECOST="0.0" LEVELS="4" ALIAS="Force Field" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779124636297" NAME="Sectional Defense with Invalid Declaration Words 2" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1" MDLEVELS="1" POWDLEVELS="1">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779125296828" BASECOST="-1.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 8-12, invalid, 18" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="FORCEFIELD" ID="1779124636375" BASECOST="0.0" LEVELS="4" ALIAS="Force Field" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779124636297" NAME="Sectional Defense with Invalid Declaration Invalid Hit Locations" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1" MDLEVELS="1" POWDLEVELS="1">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779125344718" BASECOST="-1.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="8" OPTIONID="8" OPTION_ALIAS="8- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 19-34" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="FLASH" ID="1779124636394" BASECOST="0.0" LEVELS="1" ALIAS="Flash" POSITION="25" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779124636297" NAME="Sectional Declaration For Non Defense" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779125380611" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="11" OPTIONID="11" OPTION_ALIAS="11- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 8-12" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="FORCEFIELD" ID="1779124636420" BASECOST="0.0" LEVELS="4" ALIAS="Force Field" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1779124636297" NAME="Sectional Defense with Incorrect Probability" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="1" MDLEVELS="1" POWDLEVELS="1">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779125418323" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="9" OPTIONID="9" OPTION_ALIAS="9- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="locations 8-12, 14-16, 18" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                </POWER>
                                <LIST XMLID="GENERIC_OBJECT" ID="1779050226817" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <LIST XMLID="GENERIC_OBJECT" ID="1777340991275" BASECOST="0.0" LEVELS="0" ALIAS="Valid Requires" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <POWER XMLID="ENERGYBLAST" ID="1777427411636" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A Breakfall Roll Every Use With -1 Per 5 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777427414738" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SKILL1PER5" OPTIONID="SKILL1PER5" OPTION_ALIAS="Skill roll, -1 per 5 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Breakfall" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1777427417335" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779051073733" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A Breakfall Roll Every Use With -1 Per 10 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779051094846" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SKILL" OPTIONID="SKILL" OPTION_ALIAS="Skill roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Breakfall" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779051094811" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779051079357" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="21" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A Breakfall Roll Every Use With -1 Per 20 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779051107787" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SKILL1PER20" OPTIONID="SKILL1PER20" OPTION_ALIAS="Skill roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Breakfall" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779051107752" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1777343717104" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A STR Roll Every Use" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777427046576" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CHAR" OPTIONID="CHAR" OPTION_ALIAS="Characteristic roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="STR" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1777427046541" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1777426866841" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="23" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A Perception Roll Every Use With a -1 per 5 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777427053230" BASECOST="-1.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PER1PER5" OPTIONID="PER1PER5" OPTION_ALIAS="PER roll, -1 per 5 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="STR" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1777427053195" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1777426928230" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires An Attack Roll Every Use With a -1 per 20 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777427059921" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ATTACK1PER20" OPTIONID="ATTACK1PER20" OPTION_ALIAS="Attack roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="STR" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1777427059886" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1777426968437" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A KS: sardines Roll Every Use With -1 per 10 AP Penalty" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779073274659" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="KS" OPTIONID="KS" OPTION_ALIAS="KS roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="KS: sardines" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779073274624" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1777427266844" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="26" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A PS: fisher Roll Every Use With -1 Per 5 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1777427269828" BASECOST="-0.75" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PS1PER5" OPTIONID="PS1PER5" OPTION_ALIAS="PS roll, -1 per 5 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="PS: fisher" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1777427272985" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1777427325848" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A Science Skill: xenobotany Roll Every Use With -1 Per 20 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779074999221" BASECOST="0.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SS1PER20" OPTIONID="SS1PER20" OPTION_ALIAS="SS roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Science Skill: xenobotany" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779075007035" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1777427372891" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="33" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A Science Skill: xenobotany Roll Every Use With -1 Per 10 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779075018680" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SS" OPTIONID="SS" OPTION_ALIAS="SS roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Science Skill: xenobotany" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779075023366" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1779050088900" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="34" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A Science Skill: xenobotany Roll Every Use With -1 Per 5 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779075034701" BASECOST="-0.75" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SS1PER5" OPTIONID="SS1PER5" OPTION_ALIAS="SS roll, -1 per 5 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Science Skill: xenobotany" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779075046706" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="ENERGYBLAST" ID="1783012574357" BASECOST="0.0" LEVELS="6" ALIAS="Blast" POSITION="42" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777340991275" NAME="Requires A Science Skill: xenobotany Roll or Science Skill: Toothbrush chemistry Every Use With -1 Per 5 AP" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1783013638139" BASECOST="-0.75" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SS1PER5" OPTIONID="SS1PER5" OPTION_ALIAS="SS roll, -1 per 5 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Science Skill: xenobotany or Science Skill: Toothbrush Chemistry" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1783013640401" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="CHOOSE" ID="1783013640402" BASECOST="0.25" LEVELS="0" ALIAS="Can choose which of two rolls to make from use to use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <LIST XMLID="GENERIC_OBJECT" ID="1777427222004" BASECOST="0.0" LEVELS="0" ALIAS=" " POSITION="35" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <LIST XMLID="GENERIC_OBJECT" ID="1777427224302" BASECOST="0.0" LEVELS="0" ALIAS="Invalid Requires" POSITION="36" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                                <NOTES />
                                </LIST>
                                <POWER XMLID="DARKNESS" ID="1779115361089" BASECOST="0.0" LEVELS="16" ALIAS="Darkness" POSITION="37" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777427224302" NAME="Requires A KS: sardines With -1 Per 20 AP But Specified As A PS RSR" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <ADDER XMLID="HEARINGGROUP" ID="1779116235805" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779116235841" BASECOST="0.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PS1PER20" OPTIONID="PS1PER20" OPTION_ALIAS="PS roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="KS: sardines" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779116235806" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="DARKNESS" ID="1779116182241" BASECOST="0.0" LEVELS="16" ALIAS="Darkness" POSITION="38" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777427224302" NAME="Requires A KS: froot loops Every Phase With -1 Per 20 AP But Specified Doesn't Have Background Skill" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <ADDER XMLID="HEARINGGROUP" ID="1779116477305" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779116477341" BASECOST="0.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="KS1PER20" OPTIONID="KS1PER20" OPTION_ALIAS="KS roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="KS: froot loops" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779116477306" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="DARKNESS" ID="1779116502368" BASECOST="0.0" LEVELS="16" ALIAS="Darkness" POSITION="39" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777427224302" NAME="Requires A PS: fungus demonstrator Every Phase With -1 Per 20 AP But Specified Doesn't Have Background Skill" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <ADDER XMLID="HEARINGGROUP" ID="1779116512045" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779116512081" BASECOST="0.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PS1PER20" OPTIONID="PS1PER20" OPTION_ALIAS="PS roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="PS: fungus demonstrator" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779116551844" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="DARKNESS" ID="1779116461139" BASECOST="0.0" LEVELS="16" ALIAS="Darkness" POSITION="40" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777427224302" NAME="Requires A Science Skill: batteries Every Phase With -1 Per 20 AP But Specified Doesn't Have Background Skill" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <ADDER XMLID="HEARINGGROUP" ID="1779116592949" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779116592985" BASECOST="0.0" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SS1PER20" OPTIONID="SS1PER20" OPTION_ALIAS="SS roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Science Skill: batteries" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779116620680" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="DARKNESS" ID="1779116712532" BASECOST="0.0" LEVELS="16" ALIAS="Darkness" POSITION="41" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777427224302" NAME="Requires An Interrogation Every Phase With -1 Per 20 AP But Specified Doesn't Have Skill" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <ADDER XMLID="HEARINGGROUP" ID="1779116719400" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                    <NOTES />
                                </ADDER>
                                <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1779116719436" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SKILL1PER20" OPTIONID="SKILL1PER20" OPTION_ALIAS="Skill roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Interrogation" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EVERYPHASE" ID="1779116743463" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                    <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                </POWER>
                                <POWER XMLID="DARKNESS" ID="1782963999807" BASECOST="0.0" LEVELS="16" ALIAS="Darkness" POSITION="50" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777427224302" NAME="Requires An Interrogation or Breakfall Every Phase With -1 Per 20 AP But Specified Doesn't Have Interrogation Skill" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                    <NOTES />
                                    <ADDER XMLID="HEARINGGROUP" ID="1782964153143" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1782964153180" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SKILL1PER20" OPTIONID="SKILL1PER20" OPTION_ALIAS="Skill roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Interrogation or Breakfall" PRIVATE="No" FORCEALLOW="No">
                                        <NOTES />
                                        <ADDER XMLID="EVERYPHASE" ID="1782964177321" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                        </ADDER>
                                        <ADDER XMLID="CHOOSE" ID="1782964177322" BASECOST="0.25" LEVELS="0" ALIAS="Can choose which of two rolls to make from use to use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                        </ADDER>
                                    </MODIFIER>
                                </POWER>
                                <POWER XMLID="DARKNESS" ID="1782964126700" BASECOST="0.0" LEVELS="16" ALIAS="Darkness" POSITION="51" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777427224302" NAME="Requires An Interrogation or Armourer Every Phase With -1 Per 20 AP But Specified Doesn't Have Either Skill" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                    <NOTES />
                                    <ADDER XMLID="HEARINGGROUP" ID="1782964198492" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1782964198529" BASECOST="-0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SKILL1PER20" OPTIONID="SKILL1PER20" OPTION_ALIAS="Skill roll, -1 per 20 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Interrogation or Armourer" PRIVATE="No" FORCEALLOW="No">
                                        <NOTES />
                                        <ADDER XMLID="EVERYPHASE" ID="1782964198493" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                        </ADDER>
                                        <ADDER XMLID="CHOOSE" ID="1782964198494" BASECOST="0.25" LEVELS="0" ALIAS="Can choose which of two rolls to make from use to use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                        </ADDER>
                                    </MODIFIER>
                                </POWER>
                                <POWER XMLID="DARKNESS" ID="1783012369751" BASECOST="0.0" LEVELS="7" ALIAS="Darkness" POSITION="52" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1777427224302" NAME="Requires A Science Skill: xenobotany Roll or Breakfall Every Use With -1 Per 5 AP But Breakfall Is Not A Background Skill" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                    <NOTES />
                                    <ADDER XMLID="SMELLGROUP" ID="1783012703701" BASECOST="5.0" LEVELS="0" ALIAS="Smell/Taste Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="MENTALGROUP" ID="1783012703702" BASECOST="5.0" LEVELS="0" ALIAS="Mental Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="HEARINGGROUP" ID="1783012703703" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="RADIOGROUP" ID="1783012703704" BASECOST="5.0" LEVELS="0" ALIAS="Radio Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="TOUCHGROUP" ID="1783012703705" BASECOST="5.0" LEVELS="0" ALIAS="Touch Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1783012703742" BASECOST="-0.75" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SS1PER5" OPTIONID="SS1PER5" OPTION_ALIAS="SS roll, -1 per 5 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Science Skill: xenobotany or Breakfall" PRIVATE="No" FORCEALLOW="No">
                                        <NOTES />
                                        <ADDER XMLID="EVERYPHASE" ID="1783012703706" BASECOST="-0.5" LEVELS="0" ALIAS="Must be made each Phase/use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                        </ADDER>
                                        <ADDER XMLID="CHOOSE" ID="1783012703707" BASECOST="0.25" LEVELS="0" ALIAS="Can choose which of two rolls to make from use to use" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                        </ADDER>
                                    </MODIFIER>
                                </POWER>
                            </POWERS>
                            <DISADVANTAGES />
                            <EQUIPMENT />
                            </CHARACTER>
                        `;
                    let actor;

                    let ebRequiresActivationRoll14LessEveryPhase;
                    let ebRequiresActivationRoll14Less;
                    let ebRequiresActivationRoll13LessEveryPhase;
                    let ebRequiresActivationRoll13Less;
                    let ebRequiresActivationRoll12LessEveryPhase;
                    let ebRequiresActivationRoll12Less;
                    let ebRequiresActivationRoll11LessEveryPhase;
                    let ebRequiresActivationRoll11Less;
                    let ebRequiresActivationRoll10LessEveryPhase;
                    let ebRequiresActivationRoll10Less;
                    let ebRequiresActivationRoll9LessEveryPhase;
                    let ebRequiresActivationRoll9Less;
                    let ebRequiresActivationRoll8LessEveryPhase;
                    let ebRequiresActivationRoll8Less;

                    let resistantProtectionWeirdSectionalDefense;

                    let sectionalArmorInvalidDeclarationWords;
                    let sectionalArmorInvalidDeclarationWordsTwo;
                    let sectionalArmorInvalidDeclarationInvalidHitLocations;
                    let sectionalDeclarationInFlash;
                    let sectionalArmorInvalidDeclarationInvalidProbability;

                    let ebRequiresBreakfallEachUseWith1Per5ApPenaltly;
                    let ebRequiresBreakfallEachUseWith1Per10ApPenaltly;
                    let ebRequiresBreakfallEachUseWith1Per20ApPenaltly;
                    let ebRequiresStrRollEachUseWith1Per10ApPenalty;
                    let ebRequiresPerceptionRollEachUseWith1Per5ApPenalty;
                    let ebRequiresAttackRollEachUseWith1Per20ApPenalty;
                    let ebRequiresKsSardinesEachUseWith1Per10ApPenalty;
                    let ebRequiresPsFisherEachUseWith1Per5ApPenalty;
                    let ebRequiresSsXenobotanyEachUseWith1Per20ApPenalty;
                    let ebRequiresSsXenobotanyEachUseWith1Per10ApPenalty;
                    let ebRequiresSsXenobotanyEachUseWith1Per5ApPenalty;
                    let ebRequiresSsXenobotanyOrSsToothbrushChemistryEachUseWith1Per5ApPenalty;

                    let darknessRequiresPsEachUseWith1Per20ApPenaltyButGivenKsBackgroundSkill;
                    let darknessRequiresKsFrootLoopsButDoesNotHaveKsBackgroundSkill;
                    let darknessRequiresPsFungusDemonstratorButDoesNotHavePsBackgroundSkill;
                    let darknessRequiresSsBatteriesButDoesNotHaveSsBackgroundSkill;
                    let darknessRequiresInterrogationButDoesNotHaveInterogationSkill;
                    let darknessRequiresInterrogationOrBreakfallButDoesNotHaveInterogationSkill;
                    let darknessRequiresInterrogationOrArmourerButDoesNotHaveInterogationOrAmourerSkill;
                    let darknessRequiresSsXenobotanyOrBreakfallEachUseWith1Per5ApPenaltyButBreakfallIsNotABackgroundSkill;

                    before(async function () {
                        actor = await createQuenchActor({ quench: this, contents, is5e: false });

                        ebRequiresActivationRoll14LessEveryPhase = actor.items.find(
                            (item) => item.name === "Requires A Roll 14- Every Use",
                        );
                        ebRequiresActivationRoll14Less = actor.items.find(
                            (item) => item.name === "Requires A Roll 14-",
                        );
                        ebRequiresActivationRoll13LessEveryPhase = actor.items.find(
                            (item) => item.name === "Requires A Roll 13- Every Use",
                        );
                        ebRequiresActivationRoll13Less = actor.items.find(
                            (item) => item.name === "Requires A Roll 13-",
                        );
                        ebRequiresActivationRoll12LessEveryPhase = actor.items.find(
                            (item) => item.name === "Requires A Roll 12- Every Use",
                        );
                        ebRequiresActivationRoll12Less = actor.items.find(
                            (item) => item.name === "Requires A Roll 12-",
                        );
                        ebRequiresActivationRoll11LessEveryPhase = actor.items.find(
                            (item) => item.name === "Requires A Roll 11- Every Use",
                        );
                        ebRequiresActivationRoll11Less = actor.items.find(
                            (item) => item.name === "Requires A Roll 11-",
                        );
                        ebRequiresActivationRoll10LessEveryPhase = actor.items.find(
                            (item) => item.name === "Requires A Roll 10- Every Use",
                        );
                        ebRequiresActivationRoll10Less = actor.items.find(
                            (item) => item.name === "Requires A Roll 10-",
                        );
                        ebRequiresActivationRoll9LessEveryPhase = actor.items.find(
                            (item) => item.name === "Requires A Roll 9- Every Use",
                        );
                        ebRequiresActivationRoll9Less = actor.items.find((item) => item.name === "Requires A Roll 9-");
                        ebRequiresActivationRoll8LessEveryPhase = actor.items.find(
                            (item) => item.name === "Requires A Roll 8- Every Use",
                        );
                        ebRequiresActivationRoll8Less = actor.items.find((item) => item.name === "Requires A Roll 8-");

                        resistantProtectionWeirdSectionalDefense = actor.items.find(
                            (item) => item.name === "Weird Coverage (locations   3,5 ,9- 10,12, 14 -15, and 17 - 18)",
                        );

                        sectionalArmorInvalidDeclarationWords = actor.items.find(
                            (item) => item.name === "Sectional Defense with Invalid Declaration Words",
                        );
                        sectionalArmorInvalidDeclarationWordsTwo = actor.items.find(
                            (item) => item.name === "Sectional Defense with Invalid Declaration Words 2",
                        );
                        sectionalArmorInvalidDeclarationInvalidHitLocations = actor.items.find(
                            (item) => item.name === "Sectional Defense with Invalid Declaration Invalid Hit Locations",
                        );
                        sectionalDeclarationInFlash = actor.items.find(
                            (item) => item.name === "Sectional Declaration For Non Defense",
                        );
                        sectionalArmorInvalidDeclarationInvalidProbability = actor.items.find(
                            (item) => item.name === "Sectional Defense with Incorrect Probability",
                        );

                        ebRequiresBreakfallEachUseWith1Per5ApPenaltly = actor.items.find(
                            (item) => item.name === "Requires A Breakfall Roll Every Use With -1 Per 5 AP",
                        );
                        ebRequiresBreakfallEachUseWith1Per10ApPenaltly = actor.items.find(
                            (item) => item.name === "Requires A Breakfall Roll Every Use With -1 Per 10 AP",
                        );
                        ebRequiresBreakfallEachUseWith1Per20ApPenaltly = actor.items.find(
                            (item) => item.name === "Requires A Breakfall Roll Every Use With -1 Per 20 AP",
                        );
                        ebRequiresStrRollEachUseWith1Per10ApPenalty = actor.items.find(
                            (item) => item.name === "Requires A STR Roll Every Use",
                        );
                        ebRequiresPerceptionRollEachUseWith1Per5ApPenalty = actor.items.find(
                            (item) => item.name === "Requires A Perception Roll Every Use With a -1 per 5 AP",
                        );
                        ebRequiresAttackRollEachUseWith1Per20ApPenalty = actor.items.find(
                            (item) => item.name === "Requires An Attack Roll Every Use With a -1 per 20 AP",
                        );
                        ebRequiresKsSardinesEachUseWith1Per10ApPenalty = actor.items.find(
                            (item) => item.name === "Requires A KS: sardines Roll Every Use With -1 per 10 AP Penalty",
                        );
                        ebRequiresPsFisherEachUseWith1Per5ApPenalty = actor.items.find(
                            (item) => item.name === "Requires A PS: fisher Roll Every Use With -1 Per 5 AP",
                        );
                        ebRequiresSsXenobotanyEachUseWith1Per20ApPenalty = actor.items.find(
                            (item) =>
                                item.name === "Requires A Science Skill: xenobotany Roll Every Use With -1 Per 20 AP",
                        );
                        ebRequiresSsXenobotanyEachUseWith1Per10ApPenalty = actor.items.find(
                            (item) =>
                                item.name === "Requires A Science Skill: xenobotany Roll Every Use With -1 Per 10 AP",
                        );
                        ebRequiresSsXenobotanyEachUseWith1Per5ApPenalty = actor.items.find(
                            (item) =>
                                item.name === "Requires A Science Skill: xenobotany Roll Every Use With -1 Per 5 AP",
                        );
                        ebRequiresSsXenobotanyOrSsToothbrushChemistryEachUseWith1Per5ApPenalty = actor.items.find(
                            (item) =>
                                item.name ===
                                "Requires A Science Skill: xenobotany Roll or Science Skill: Toothbrush chemistry Every Use With -1 Per 5 AP",
                        );

                        darknessRequiresPsEachUseWith1Per20ApPenaltyButGivenKsBackgroundSkill = actor.items.find(
                            (item) =>
                                item.name === "Requires A KS: sardines With -1 Per 20 AP But Specified As A PS RSR",
                        );
                        darknessRequiresKsFrootLoopsButDoesNotHaveKsBackgroundSkill = actor.items.find(
                            (item) =>
                                item.name ===
                                "Requires A KS: froot loops Every Phase With -1 Per 20 AP But Specified Doesn't Have Background Skill",
                        );
                        darknessRequiresPsFungusDemonstratorButDoesNotHavePsBackgroundSkill = actor.items.find(
                            (item) =>
                                item.name ===
                                "Requires A PS: fungus demonstrator Every Phase With -1 Per 20 AP But Specified Doesn't Have Background Skill",
                        );
                        darknessRequiresSsBatteriesButDoesNotHaveSsBackgroundSkill = actor.items.find(
                            (item) =>
                                item.name ===
                                "Requires A Science Skill: batteries Every Phase With -1 Per 20 AP But Specified Doesn't Have Background Skill",
                        );
                        darknessRequiresInterrogationButDoesNotHaveInterogationSkill = actor.items.find(
                            (item) =>
                                item.name ===
                                "Requires An Interrogation Every Phase With -1 Per 20 AP But Specified Doesn't Have Skill",
                        );
                        darknessRequiresInterrogationOrBreakfallButDoesNotHaveInterogationSkill = actor.items.find(
                            (item) =>
                                item.name ===
                                "Requires An Interrogation or Breakfall Every Phase With -1 Per 20 AP But Specified Doesn't Have Interrogation Skill",
                        );
                        darknessRequiresInterrogationOrArmourerButDoesNotHaveInterogationOrAmourerSkill =
                            actor.items.find(
                                (item) =>
                                    item.name ===
                                    "Requires An Interrogation or Armourer Every Phase With -1 Per 20 AP But Specified Doesn't Have Either Skill",
                            );
                        darknessRequiresSsXenobotanyOrBreakfallEachUseWith1Per5ApPenaltyButBreakfallIsNotABackgroundSkill =
                            actor.items.find(
                                (item) =>
                                    item.name ===
                                    "Requires A Science Skill: xenobotany Roll or Breakfall Every Use With -1 Per 5 AP But Breakfall Is Not A Background Skill",
                            );
                    });

                    after(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    describe("RSR costs in all the various flavours", function () {
                        describe("activation roll flavour", function () {
                            it("should have the correct cost for 14- every phase", async function () {
                                expect(ebRequiresActivationRoll14LessEveryPhase.realCost).to.equal(24);
                            });
                            it("should have the correct cost for 14-", async function () {
                                expect(ebRequiresActivationRoll14Less.realCost).to.equal(24);
                            });

                            it("should have the correct cost for 13- every phase", async function () {
                                expect(ebRequiresActivationRoll13LessEveryPhase.realCost).to.equal(20);
                            });
                            it("should have the correct cost for 13-", async function () {
                                expect(ebRequiresActivationRoll13Less.realCost).to.equal(24);
                            });

                            it("should have the correct cost for 12- every phase", async function () {
                                expect(ebRequiresActivationRoll12LessEveryPhase.realCost).to.equal(17);
                            });
                            it("should have the correct cost for 12-", async function () {
                                expect(ebRequiresActivationRoll12Less.realCost).to.equal(24);
                            });

                            it("should have the correct cost for 11- every phase", async function () {
                                expect(ebRequiresActivationRoll11LessEveryPhase.realCost).to.equal(15);
                            });
                            it("should have the correct cost for 11-", async function () {
                                expect(ebRequiresActivationRoll11Less.realCost).to.equal(20);
                            });

                            it("should have the correct cost for 10- every phase", async function () {
                                expect(ebRequiresActivationRoll10LessEveryPhase.realCost).to.equal(13);
                            });
                            it("should have the correct cost for 10-", async function () {
                                expect(ebRequiresActivationRoll10Less.realCost).to.equal(17);
                            });

                            it("should have the correct cost for 9- every phase", async function () {
                                expect(ebRequiresActivationRoll9LessEveryPhase.realCost).to.equal(12);
                            });
                            it("should have the correct cost for 9-", async function () {
                                expect(ebRequiresActivationRoll9Less.realCost).to.equal(15);
                            });

                            it("should have the correct cost for 8- every phase", async function () {
                                expect(ebRequiresActivationRoll8LessEveryPhase.realCost).to.equal(11);
                            });
                            it("should have the correct cost for 8-", async function () {
                                expect(ebRequiresActivationRoll8Less.realCost).to.equal(13);
                            });

                            // TODO: Add jammed and burnout throughout
                            it.skip("should have the correct cost for activation roll with burnout", function () {});
                            it.skip("should have the correct cost for activation roll with jammed", function () {});
                        });

                        describe("requires skill roll flavour", function () {
                            it("should have the correct cost for breakfall every phase with -1 per 5 AP", async function () {
                                expect(ebRequiresBreakfallEachUseWith1Per5ApPenaltly.realCost).to.equal(12);
                            });
                            it("should have the correct cost for breakfall every phase with -1 per 10 AP", async function () {
                                expect(ebRequiresBreakfallEachUseWith1Per10ApPenaltly.realCost).to.equal(15);
                            });
                            it("should have the correct cost for breakfall every phase with -1 per 20 AP", async function () {
                                expect(ebRequiresBreakfallEachUseWith1Per20ApPenaltly.realCost).to.equal(17);
                            });
                            it("should have the correct cost for STR every phase with -1 per 10 AP", async function () {
                                expect(ebRequiresStrRollEachUseWith1Per10ApPenalty.realCost).to.equal(15);
                            });
                            it("should have the correct cost for perception every phase with -1 per 5 AP", async function () {
                                expect(ebRequiresPerceptionRollEachUseWith1Per5ApPenalty.realCost).to.equal(12);
                            });
                            it("should have the correct cost for attack roll every phase with -1 per 20 AP", async function () {
                                expect(ebRequiresAttackRollEachUseWith1Per20ApPenalty.realCost).to.equal(17);
                            });
                            it("should have the correct cost for KS: sardines roll every phase with no AP penalty", async function () {
                                expect(ebRequiresKsSardinesEachUseWith1Per10ApPenalty.realCost).to.equal(17);
                            });
                            it("should have the correct cost for PS: fisher roll every phase with-1 per 5 AP", async function () {
                                expect(ebRequiresPsFisherEachUseWith1Per5ApPenalty.realCost).to.equal(13);
                            });
                            it("should have the correct cost for SS: xenobotany roll every phase with -1 per 20 AP", async function () {
                                expect(ebRequiresSsXenobotanyEachUseWith1Per20ApPenalty.realCost).to.equal(20);
                            });
                            it("should have the correct cost for SS: xenobotany roll every phase with -1 per 10 AP", async function () {
                                expect(ebRequiresSsXenobotanyEachUseWith1Per10ApPenalty.realCost).to.equal(17);
                            });
                            it("should have the correct cost for SS: xenobotany roll every phase with -1 per 5 AP", async function () {
                                expect(ebRequiresSsXenobotanyEachUseWith1Per5ApPenalty.realCost).to.equal(13);
                            });
                            it("should have the correct cost for SS: xenobotany or Breakfall roll every phase with -1 per 5 AP (variable roll)", async function () {
                                expect(
                                    ebRequiresSsXenobotanyOrSsToothbrushChemistryEachUseWith1Per5ApPenalty.realCost,
                                ).to.equal(15);
                            });
                        });
                    });

                    describe("RSRs have hero validations", function () {
                        describe("Activation rolls with sectional defenses have hero validations", function () {
                            it("should recognize a valid section defense declaration", function () {
                                expect(resistantProtectionWeirdSectionalDefense.heroValidation).to.have.deep.members(
                                    [],
                                );
                            });

                            // We can't distinguish between an invalid sectional defense location and a regular comment
                            it("should recognize an invalid section defense declaration (words - locationss)", function () {
                                expect(sectionalArmorInvalidDeclarationWords.heroValidation).to.have.deep.members([]);
                            });

                            it("should recognize an invalid section defense declaration (words - invalid)", function () {
                                const heroValidation = sectionalArmorInvalidDeclarationWordsTwo.heroValidation;
                                expect(heroValidation.length).to.equal(1);
                                expect(heroValidation[0]).to.have.property("severity");
                                expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                            });

                            it("should recognize an invalid section defense declaration (invalid hit locations)", function () {
                                const heroValidation =
                                    sectionalArmorInvalidDeclarationInvalidHitLocations.heroValidation;
                                expect(heroValidation.length).to.equal(1);
                                expect(heroValidation[0]).to.have.property("severity");
                                expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                            });

                            it("should recognize an invalid section defense declaration (for non defense power)", function () {
                                const heroValidation = sectionalDeclarationInFlash.heroValidation;
                                expect(heroValidation.length).to.equal(1);
                                expect(heroValidation[0]).to.have.property("severity");
                                expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                            });

                            it("should recognize an valid section defense declaration with incorrect probability calculation", function () {
                                const heroValidation =
                                    sectionalArmorInvalidDeclarationInvalidProbability.heroValidation;
                                expect(heroValidation.length).to.equal(1);
                                expect(heroValidation[0]).to.have.property("severity");
                                expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.WARNING);
                            });
                        });

                        it("should have no heroValidation concerns as the character does have listed inante skill (success)", function () {
                            const heroValidation = ebRequiresBreakfallEachUseWith1Per5ApPenaltly.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have no heroValidation concerns as the character does have listed background skills (success)", function () {
                            const heroValidation = ebRequiresKsSardinesEachUseWith1Per10ApPenalty.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have no heroValidation concerns as the character can make attack rolls (success)", function () {
                            const heroValidation = ebRequiresAttackRollEachUseWith1Per20ApPenalty.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have a heroValidation error as the character does have listed KS background skill but user requested a PS (not an error as defined in rules despite HD's implementation)", function () {
                            const heroValidation =
                                darknessRequiresPsEachUseWith1Per20ApPenaltyButGivenKsBackgroundSkill.heroValidation;
                            expect(heroValidation.length).to.equal(0);
                        });

                        it("should have a heroValidation error as the character does not have listed KS background skill (error)", function () {
                            const heroValidation =
                                darknessRequiresKsFrootLoopsButDoesNotHaveKsBackgroundSkill.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have listed PS background skill (error)", function () {
                            const heroValidation =
                                darknessRequiresPsFungusDemonstratorButDoesNotHavePsBackgroundSkill.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have listed SS background skill (error)", function () {
                            const heroValidation =
                                darknessRequiresSsBatteriesButDoesNotHaveSsBackgroundSkill.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have listed Interrogation skill (error)", function () {
                            const heroValidation =
                                darknessRequiresInterrogationButDoesNotHaveInterogationSkill.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have one (Interrogation) skills (error)", function () {
                            const heroValidation =
                                darknessRequiresInterrogationOrBreakfallButDoesNotHaveInterogationSkill.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have a heroValidation error as the character does not have two (Interrogation and Armourer) skills (error)", function () {
                            const heroValidation =
                                darknessRequiresInterrogationOrArmourerButDoesNotHaveInterogationOrAmourerSkill.heroValidation;
                            expect(heroValidation.length).to.equal(2);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                            expect(heroValidation[1]).to.have.property("severity");
                            expect(heroValidation[1].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.ERROR);
                        });

                        it("should have no heroValidation error as the character has STR (success)", function () {
                            const heroValidation = ebRequiresStrRollEachUseWith1Per10ApPenalty.heroValidation;
                            expect(heroValidation).to.have.deep.members([]);
                        });

                        it("should have a heroValidation error as the character does not have two background skills (warning - cost is too low)", function () {
                            const heroValidation =
                                darknessRequiresSsXenobotanyOrBreakfallEachUseWith1Per5ApPenaltyButBreakfallIsNotABackgroundSkill.heroValidation;
                            expect(heroValidation.length).to.equal(1);
                            expect(heroValidation[0]).to.have.property("severity");
                            expect(heroValidation[0].severity).to.equal(CONFIG.HERO.VALIDATION_SEVERITY.WARNING);
                        });

                        // PH: FIXME: Support these through different actor types (see 5e tests)
                        it.skip("should have a heroValidation error as the character does not have the listed characteristic", function () {});
                        it.skip("should have a heroValidation error as the character does not have perception", function () {});
                        it.skip("should have a heroValidation error as the character cannot make attack rolls (error)", function () {});
                    });

                    describe("activation rolls", function () {
                        describe("basic activation roll", function () {
                            describe("8- activates correctly", function () {
                                it("should not activate 8- with a roll of a 9", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            ebRequiresActivationRoll8Less,
                                            resetDiceClass(Roll9On3Dice),
                                            {},
                                        ),
                                    ).to.equal(false);
                                });

                                it("should activate 8- with a roll of a 8", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            ebRequiresActivationRoll8Less,
                                            resetDiceClass(Roll8On3Dice),
                                            {},
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate 8- with a roll of a 7", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            ebRequiresActivationRoll8Less,
                                            resetDiceClass(Roll7On3Dice),
                                            {},
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate 8- with a roll of a 3", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            ebRequiresActivationRoll8Less,
                                            resetDiceClass(Roll3On3Dice),
                                            {},
                                        ),
                                    ).to.equal(true);
                                });
                            });

                            describe("12- activates correctly", function () {
                                it("should not activate 12- with a roll of a 13", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            ebRequiresActivationRoll12Less,
                                            resetDiceClass(Roll13On3Dice),
                                            {},
                                        ),
                                    ).to.equal(false);
                                });

                                it("should activate 12- with a roll of a 12", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            ebRequiresActivationRoll12Less,
                                            resetDiceClass(Roll12On3Dice),
                                            {},
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate 8- with a roll of a 3", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            ebRequiresActivationRoll12Less,
                                            resetDiceClass(Roll3On3Dice),
                                            {},
                                        ),
                                    ).to.equal(true);
                                });
                            });
                        });

                        describe("multi range sectional activation roll(3,5 ,9- 10,12, 14 -15, and 17 - 18) (equivalent of >= 15-)", function () {
                            let defaultHitLocationsEnabled;

                            before(async function () {
                                defaultHitLocationsEnabled = await getAndSetGameSetting(
                                    "hit locations",
                                    "hitLocationsWithSectional",
                                );
                            });

                            after(async function () {
                                await getAndSetGameSetting("hit locations", defaultHitLocationsEnabled);
                            });

                            describe("first range 3", function () {
                                it("should not activate with a hit location of 2", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 2,
                                            },
                                        ),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 3", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 3,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 4", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 4,
                                            },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("second range 5", function () {
                                it("should activate with a hit location of 5", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 5,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 6", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 6,
                                            },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("third range 9-10", function () {
                                it("should not activate with a hit location of 8", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 8,
                                            },
                                        ),
                                    ).to.equal(false);
                                });

                                it("should activate with a hit location of 9", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 9,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 10", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 10,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 11", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 11,
                                            },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("fourth range 12", function () {
                                it("should activate with a hit location of 12", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 12,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 13", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 13,
                                            },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("fifth range 14 -15", function () {
                                it("should activate with a hit location of 14", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 14,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 15", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 15,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should not activate with a hit location of 16", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 16,
                                            },
                                        ),
                                    ).to.equal(false);
                                });
                            });

                            describe("sixth range 17 - 18", function () {
                                it("should activate with a hit location of 17", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 17,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 18", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 18,
                                            },
                                        ),
                                    ).to.equal(true);
                                });

                                it("should activate with a hit location of 19", async function () {
                                    expect(
                                        await isActivatedForThisUse_TestingOnly(
                                            resistantProtectionWeirdSectionalDefense,
                                            HeroRoll,
                                            {
                                                hitLocationNum: 19,
                                            },
                                        ),
                                    ).to.equal(true);
                                });
                            });
                        });
                    });

                    describe("skill rolls", function () {
                        describe("RSR with skill roll and a -1 per 5 AP penalty", function () {
                            it("should activate with a roll of 3 (against 14- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per5ApPenaltly,
                                        resetDiceClass(Roll3On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should activate with a roll of 8 (against 14- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per5ApPenaltly,
                                        resetDiceClass(Roll8On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should fail to activate with a roll of 9 (against 14- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per5ApPenaltly,
                                        resetDiceClass(Roll9On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("RSR with skill roll and a -1 per 10 AP penalty", function () {
                            it("should activate with a roll of 3 (against 14- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per10ApPenaltly,
                                        resetDiceClass(Roll3On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should activate with a roll of 11 (against 14- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per10ApPenaltly,
                                        resetDiceClass(Roll11On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should fail to activate with a roll of 12 (against 14- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per10ApPenaltly,
                                        resetDiceClass(Roll12On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("RSR with skill roll and a -1 per 20 AP penalty", function () {
                            it("should activate with a roll of 12 (against 14- with -1 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per20ApPenaltly,
                                        resetDiceClass(Roll12On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should activate with a roll of 13 (against 14- with -1 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per20ApPenaltly,
                                        resetDiceClass(Roll13On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should fail to activate with a roll of 14 (against 14- with -1 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresBreakfallEachUseWith1Per20ApPenaltly,
                                        resetDiceClass(Roll14On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("RSR with STR roll and a -1 per 20 AP penalty", function () {
                            it("should activate with a roll of 7 (against 11- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresStrRollEachUseWith1Per10ApPenalty,
                                        resetDiceClass(Roll7On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should activate with a roll of 8 (against 11- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresStrRollEachUseWith1Per10ApPenalty,
                                        resetDiceClass(Roll8On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should fail to activate with a roll of 9 (against 11- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresStrRollEachUseWith1Per10ApPenalty,
                                        resetDiceClass(Roll9On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("RSR with perception roll and a -1 per 5 AP penalty", function () {
                            it("should activate with a roll of 4 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresPerceptionRollEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll4On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should activate with a roll of 8 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresPerceptionRollEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll5On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should fail to activate with a roll of 6 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresPerceptionRollEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll6On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe.skip("RSR with attack roll and a -1 per 5 AP penalty", function () {});

                        describe("RSR with KS: sardines roll and a -1 per 10 AP penalty", function () {
                            it("should activate with a roll of 7 (against 11- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresKsSardinesEachUseWith1Per10ApPenalty,
                                        resetDiceClass(Roll7On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should activate with a roll of 8 (against 11- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresKsSardinesEachUseWith1Per10ApPenalty,
                                        resetDiceClass(Roll8On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should fail to activate with a roll of 9 (against 11- with -3 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresKsSardinesEachUseWith1Per10ApPenalty,
                                        resetDiceClass(Roll9On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("RSR with PS: fisher roll and a -1 per 5 AP penalty", function () {
                            it("should activate with a roll of 4 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresPsFisherEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll4On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should activate with a roll of 5 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresPsFisherEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll5On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should fail to activate with a roll of 6 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresPsFisherEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll6On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("RSR with SS: xenobotany roll and a -1 per 5 AP penalty", function () {
                            it("should activate with a roll of 4 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresSsXenobotanyEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll4On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should activate with a roll of 5 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresSsXenobotanyEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll5On3Dice),
                                        {},
                                    ),
                                ).to.equal(true);
                            });
                            it("should fail to activate with a roll of 6 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresSsXenobotanyEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll6On3Dice),
                                        {},
                                    ),
                                ).to.equal(false);
                            });
                        });

                        describe("RSR with Science Skill: xenobotany Roll or Science Skill: Toothbrush Chemistry and a -1 per 5 AP penalty", function () {
                            it("should activate SS: xenobotany with a 5 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresSsXenobotanyOrSsToothbrushChemistryEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll5On3Dice),
                                        { test: { variableSelectIndex: 0 } },
                                    ),
                                ).to.equal(true);
                            });

                            it("should not activate SS: xenobotany with a 6 (against 11- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresSsXenobotanyOrSsToothbrushChemistryEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll6On3Dice),
                                        { test: { variableSelectIndex: 0 } },
                                    ),
                                ).to.equal(false);
                            });

                            it("should activate Science Skill: Toothbrush Chemistry with an 8 (against 14- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresSsXenobotanyOrSsToothbrushChemistryEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll8On3Dice),
                                        { test: { variableSelectIndex: 1 } },
                                    ),
                                ).to.equal(true);
                            });

                            it("should not activate Science Skill: Toothbrush Chemistry with an 9 (against 14- with -6 AP penalty) for activation", async function () {
                                expect(
                                    await isActivatedForThisUse_TestingOnly(
                                        ebRequiresSsXenobotanyOrSsToothbrushChemistryEachUseWith1Per5ApPenalty,
                                        resetDiceClass(Roll9On3Dice),
                                        { test: { variableSelectIndex: 1 } },
                                    ),
                                ).to.equal(false);
                            });
                        });
                    });
                });
            });

            describe("RSR skill roll with an unnamed skill", function () {
                setQuenchTimeout(this);

                const contents = `
                    <POWER XMLID="RUNNING" ID="1757000000011" BASECOST="0.0" LEVELS="6" ALIAS="Running" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Gecko Gloves" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1757000000012" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SKILL1PER5" OPTIONID="SKILL1PER5" OPTION_ALIAS="Skill roll; -1 per 5 Active Points modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No"></MODIFIER>
                    </POWER>
                `;

                let actor;

                before(async function () {
                    actor = await createQuenchActor({ quench: this, contents, is5e: false });
                });

                after(async function () {
                    await deleteQuenchActor({ quench: this, actor });
                });

                it("should warn about the unnamed skill without throwing", function () {
                    const item = actor.items.find((o) => o.name === "Gecko Gloves");
                    const validations = item.heroValidation;
                    expect(validations.some((v) => v.message.match(/does not name a skill/))).to.be.true;
                });
            });

            describe("unowned world item with a characteristic RSR", function () {
                setQuenchTimeout(this);

                const contents = `
                    <POWER XMLID="RUNNING" ID="1757000000001" BASECOST="0.0" LEVELS="6" ALIAS="Running" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Skateboard" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1757000000002" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CHAR" OPTIONID="CHAR" OPTION_ALIAS="DEX roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="DEX" PRIVATE="No" FORCEALLOW="No"></MODIFIER>
                    </POWER>
                `;

                let worldItem;

                before(async function () {
                    worldItem = await HeroSystem6eItem.create(HeroSystem6eItem.itemDataFromXml(contents));
                });

                after(async function () {
                    await worldItem?.delete();
                });

                it("should report a null actor", function () {
                    expect(worldItem.actor).to.equal(null);
                });

                it("should compute heroValidation without throwing", function () {
                    expect(() => worldItem.heroValidation).to.not.throw();
                });
            });
        },
        {
            displayName: "HERO: Requires Roll Check",
        },
    );
}
