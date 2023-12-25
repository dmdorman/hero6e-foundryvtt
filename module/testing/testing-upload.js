import { HeroSystem6eActor } from "../actor/actor.js";
import { HeroSystem6eItem } from "../item/item.js";

export function registerUploadTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.utils.upload",
        (context) => {
            const { assert, before, describe, expect, it } = context;

            describe("NAKEDMODIFIER Kaden", function () {
                const contents = `
                    <POWER XMLID="NAKEDMODIFIER" ID="1630831670004" BASECOST="0.0" LEVELS="70" ALIAS="Naked Advantage" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                    <NOTES />
                    <MODIFIER XMLID="GESTURES" ID="1690416300795" BASECOST="-0.25" LEVELS="0" ALIAS="Gestures" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No">
                        <NOTES />
                        <ADDER XMLID="BOTHHAND" ID="1690416300791" BASECOST="-0.25" LEVELS="0" ALIAS="Requires both hands" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                        <NOTES />
                        </ADDER>
                    </MODIFIER>
                    <MODIFIER XMLID="VISIBLE" ID="1690416300801" BASECOST="-0.25" LEVELS="0" ALIAS="Visible" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INVISIBLEINOBVIOUS" OPTIONID="INVISIBLEINOBVIOUS" OPTION_ALIAS="Invisible Power becomes Inobvious" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Tattoos of flames encompass the biceps and shoulders.  When this power is active, these flames appear to burn, emitting firelight.  " PRIVATE="Yes" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    <MODIFIER XMLID="REDUCEDEND" ID="1690416300807" BASECOST="0.5" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ZERO" OPTIONID="ZERO" OPTION_ALIAS="0 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Naked Advantage for up to 70 Active points, Reduced Endurance (0 END; +1/2) (35 Active Points); Gestures (Requires both hands, -1/2), Visible (Tattoos of flames encompass the biceps and shoulders.  When this power is active, these flames appear to burn, emitting firelight.; -1/4)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, "20");
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, "35");
                });
            });

            // https://discord.com/channels/609528652878839828/770825017729482772/1122607244035493888
            describe("MENTAL_COMBAT_LEVELS", function () {
                const contents = `
                    <SKILL XMLID="MENTAL_COMBAT_LEVELS" ID="1687721775906" BASECOST="0.0" LEVELS="2" ALIAS="Mental Combat Skill Levels" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TIGHT" OPTIONID="TIGHT" OPTION_ALIAS="with a group of Mental Powers" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Mind Empowered" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
                    <NOTES />
                    </SKILL>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Mind Empowered: +2 with a group of Mental Powers",
                    ); //"+2 with a group of Mental Powers");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 6);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 6);
                });

                it("levels", function () {
                    assert.equal(item.system.max, 2);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });
            });

            describe("CLIMBING", function () {
                const contents = `
                    <SKILL XMLID="CLIMBING" ID="1687723638849" BASECOST="3.0" LEVELS="0" ALIAS="Climbing" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="DEX" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                        <NOTES />
                    </SKILL>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.dex.value = 15;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(item.system.description, "Climbing");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 3);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 3);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });

                it("roll", function () {
                    assert.equal(item.system.roll, "12-");
                });
            });

            describe("ENERGYBLAST", function () {
                const contents = `
                    <POWER XMLID="ENERGYBLAST" ID="1686774389914" BASECOST="0.0" LEVELS="1" ALIAS="Fire Blast" POSITION="5" MULTIPLIER="1.0" GRAPHIC="zap" COLOR="255 0 0 " SFX="Fire/Heat" USE_END_RESERVE="Yes" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.dex.value = 15;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(item.system.description, "Fire Blast 1d6");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 5);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 5);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 1);
                });

                it("end", function () {
                    assert.equal(item.system.end, 1);
                });
            });

            describe("Characteristics INT", function () {
                const contents = `
                    <INT XMLID="INT" ID="1688339311497" BASECOST="0.0" LEVELS="3" ALIAS="INT" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes" ADD_MODIFIERS_TO_BASE="No">
                    <NOTES />
                    </INT>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.dex.value = 15;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(item.system.description, "+3 INT");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 3);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 3);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 3);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });
            });

            describe("Offensive Strike", async function () {
                const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1688340787607" BASECOST="5.0" LEVELS="0" ALIAS="Offensive Strike" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Offensive Strike" OCV="-2" DCV="+1" DC="4" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
                    <NOTES />
                    </MANEUVER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.dex.value = 15;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "1/2 Phase, -2 OCV, +1 DCV, 6d6 Strike",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 5);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 5);
                });

                it("dice", function () {
                    assert.equal(item.system.dice, 4); // There are 4 raw dice, STR is added later
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });
            });

            // WillForce362.hdc
            describe("TELEKINESIS", async function () {
                const contents = `
                    <POWER XMLID="TELEKINESIS" ID="1589145928828" BASECOST="0.0" LEVELS="62" ALIAS="Telekinesis" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Psychokinesis" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                    <NOTES />
                    <MODIFIER XMLID="LIMITEDRANGE" ID="1596334078773" BASECOST="-0.25" LEVELS="0" ALIAS="Limited Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    <MODIFIER XMLID="OIHID" ID="1596334078774" BASECOST="-0.25" LEVELS="0" ALIAS="Only In Alternate Identity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    <MODIFIER XMLID="EXTRATIME" ID="1596334078813" BASECOST="-0.25" LEVELS="0" ALIAS="Extra Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PHASE" OPTIONID="PHASE" OPTION_ALIAS="Delayed Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1596334078849" BASECOST="0.25" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14- roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    <MODIFIER XMLID="ACV" ID="1596334078859" BASECOST="0.0" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NONMENTALOMCV" OPTIONID="NONMENTALOMCV" OPTION_ALIAS="uses OMCV against DCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.ego.value = 38;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Telekinesis (62 STR), Alternate Combat Value (uses OMCV against DCV; +0) (93 Active Points); Limited Range (-1/4), Only In Alternate Identity (-1/4), Extra Time (Delayed Phase, -1/4), Requires A Roll (14- roll; -1/4)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 46);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 93);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 62);
                });

                it("end", function () {
                    assert.equal(item.system.end, 9);
                });
            });

            describe("Sniper Rifle", async function () {
                const contents = `
                    <POWER XMLID="RKA" ID="1688357238677" BASECOST="0.0" LEVELS="2" ALIAS="Killing Attack - Ranged" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Sniper Rifle" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                    <NOTES />
                    <ADDER XMLID="PLUSONEHALFDIE" ID="1688357355014" BASECOST="10.0" LEVELS="0" ALIAS="+1/2 d6" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                    <NOTES />
                    </ADDER>
                    <MODIFIER XMLID="FOCUS" ID="1688357355044" BASECOST="-1.0" LEVELS="0" ALIAS="Focus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OAF" OPTIONID="OAF" OPTION_ALIAS="OAF" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                    <NOTES />
                    </MODIFIER>
                    <MODIFIER XMLID="CHARGES" ID="1688357368689" BASECOST="-0.5" LEVELS="0" ALIAS="Charges" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EIGHT" OPTIONID="EIGHT" OPTION_ALIAS="8" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                    <NOTES />
                    </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Killing Attack - Ranged 2 1/2d6 (ED) (40 Active Points); OAF (-1), 8 Charges (-1/2)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 16);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 40);
                });

                it("dice", function () {
                    assert.equal(item.system.dice, 2);
                });

                it("extraDice", function () {
                    assert.equal(item.system.extraDice, "half");
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });

                it("charges", function () {
                    assert.equal(item.system.charges.max, 8);
                });

                it("chargesRecoverable", function () {
                    assert.equal(item.system.charges.recoverable, false);
                });
            });

            describe("MINDCONTROL", async function () {
                const contents = `
                    <POWER XMLID="MINDCONTROL" ID="1688874983494" BASECOST="0.0" LEVELS="15" ALIAS="Mind Control" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.ego.value = 38;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(item.system.description, "Mind Control 15d6");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 75);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 75);
                });

                it("dice", function () {
                    assert.equal(item.system.dice, 15);
                });

                it("extraDice", function () {
                    assert.equal(item.system.extraDice, "zero");
                });

                it("end", function () {
                    assert.equal(item.system.end, "7");
                });
            });

            // MalnacharOrc_Lars_Servant.hdc
            describe("MINDCONTROL advanced", async function () {
                const contents = `
                    <POWER XMLID="MINDCONTROL" ID="1693772868443" BASECOST="0.0" LEVELS="15" ALIAS="Mind Control" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <MODIFIER XMLID="ARMORPIERCING" ID="1693773081504" BASECOST="0.0" LEVELS="1" ALIAS="Armor Piercing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="REDUCEDEND" ID="1693773081509" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="TELEPATHIC" ID="1693773081511" BASECOST="0.25" LEVELS="0" ALIAS="Telepathic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="INVISIBLE" ID="1693773081515" BASECOST="0.25" LEVELS="0" ALIAS="Invisible Power Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INOBVIOUSINVISIBLEONE" OPTIONID="INOBVIOUSINVISIBLEONE" OPTION_ALIAS="Inobvious Power, Invisible to Mental Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="CUMULATIVE" ID="1693773081517" BASECOST="0.5" LEVELS="1" ALIAS="Cumulative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="EXTRATIME" ID="1693773081558" BASECOST="-0.5" LEVELS="0" ALIAS="Extra Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="FULL" OPTIONID="FULL" OPTION_ALIAS="Full Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.ego.value = 38;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Mind Control 15d6, Armor Piercing (+1/4), Reduced Endurance (1/2 END; +1/4), Telepathic (+1/4), Invisible Power Effects (Invisible to Mental Group; +1/4), Cumulative (180 points; +3/4) (206 Active Points); Extra Time (Full Phase, -1/2)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 137);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 206);
                });

                it("dice", function () {
                    assert.equal(item.system.dice, 15);
                });

                it("extraDice", function () {
                    assert.equal(item.system.extraDice, "zero");
                });

                it("end", function () {
                    assert.equal(item.system.end, "9");
                });
            });

            describe("COMBAT_LEVELS", async function () {
                const contents = `
                    <SKILL XMLID="COMBAT_LEVELS" ID="1688944834273" BASECOST="0.0" LEVELS="1" ALIAS="Combat Skill Levels" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="with any single attack" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
                    <NOTES />
                    </SKILL>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "+1 with any single attack",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 2);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 2);
                });

                it("end", function () {
                    assert.equal(item.system.end, "0");
                });
            });

            describe("INVISIBILITY", async function () {
                const contents = `
                    <POWER XMLID="INVISIBILITY" ID="1689283663052" BASECOST="20.0" LEVELS="0" ALIAS="Invisibility" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Blind Minds" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <ADDER XMLID="TOUCHGROUP" ID="1689356871509" BASECOST="5.0" LEVELS="0" ALIAS="Touch Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="NORMALSMELL" ID="1689356871510" BASECOST="3.0" LEVELS="0" ALIAS="Normal Smell" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="COMBAT_SENSE" ID="1689356871511" BASECOST="5.0" LEVELS="0" ALIAS="Combat Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="HEARINGGROUP" ID="1689356871512" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <MODIFIER XMLID="CONDITIONALPOWER" ID="1689356871533" BASECOST="-0.5" LEVELS="0" ALIAS="Conditional Power" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMMON" OPTIONID="COMMON" OPTION_ALIAS="Only vs organic perception" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Invisibility to Sight, Touch and Hearing Groups, Normal Smell and Combat Sense (38 Active Points); Conditional Power Only vs organic perception (-1/2)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 25);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 38);
                });

                it("end", function () {
                    assert.equal(item.system.end, "4");
                });
            });

            describe("Killing Strike", async function () {
                const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1689357675658" BASECOST="4.0" LEVELS="0" ALIAS="Killing Strike" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Killing Strike" OCV="-2" DCV="+0" DC="2" PHASE="1/2" EFFECT="[KILLINGDC]" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="10" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[WEAPONKILLINGDC]">
                    <NOTES />
                    </MANEUVER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.str.value = 10;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "1/2 Phase, -2 OCV, +0 DCV, HKA 1d6 +1",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 4);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 4);
                });

                it("end", function () {
                    assert.equal(item.system.end, "0");
                });
            });

            // Cobalt
            describe("Laser Cutter", function () {
                const contents = `
                    <POWER XMLID="HKA" ID="1612300630772" BASECOST="0.0" LEVELS="2" ALIAS="Killing Attack - Hand-To-Hand" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1612300169863" NAME="Laser Cutter" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                    <NOTES />
                    <MODIFIER XMLID="NOSTRBONUS" ID="1612300735512" BASECOST="-0.5" LEVELS="0" ALIAS="No STR Bonus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    <MODIFIER XMLID="PENETRATING" ID="1612300743528" BASECOST="0.0" LEVELS="1" ALIAS="Penetrating" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    <MODIFIER XMLID="FOCUS" ID="1612300783360" BASECOST="-1.0" LEVELS="0" ALIAS="Focus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OAF" OPTIONID="OAF" OPTION_ALIAS="OAF" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Pen-sized Device in pocket" PRIVATE="No" FORCEALLOW="No">
                        <NOTES />
                    </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.str.value = 15;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Killing Attack - Hand-To-Hand 2d6, Penetrating (+1/2) (45 Active Points); OAF (Pen-sized Device in pocket; -1), No STR Bonus (-1/2)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 18);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 45);
                });

                it("end", function () {
                    assert.equal(item.system.end, "4");
                });

                it("killing", function () {
                    assert.equal(item.system.killing, true);
                });
            });

            // Crusher
            describe("Crush", function () {
                const contents = `
                    <POWER XMLID="RKA" ID="1624916890101" BASECOST="0.0" LEVELS="3" ALIAS="Killing Attack - Ranged" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Crush" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <MODIFIER XMLID="AOE" ID="1624916927944" BASECOST="0.0" LEVELS="6" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="PERSONALIMMUNITY" ID="1624916935311" BASECOST="0.25" LEVELS="0" ALIAS="Personal Immunity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="NORANGE" ID="1624916938937" BASECOST="-0.5" LEVELS="0" ALIAS="No Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="REDUCEDEND" ID="1624916950033" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="MODIFIER" ID="1624916962588" BASECOST="-0.5" LEVELS="0" ALIAS="Must Follow Grab" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.characteristics.str.value = 15;
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Killing Attack - Ranged 3d6, Personal Immunity (+1/4), Reduced Endurance (1/2 END; +1/4), Area Of Effect (6m Radius; +1/2) (90 Active Points); No Range (-1/2), Must Follow Grab (-1/2)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 45);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 90);
                });

                it("end", function () {
                    assert.equal(item.system.end, "4");
                });

                it("killing", function () {
                    assert.equal(item.system.killing, true);
                });
            });

            describe("ENDURANCERESERVE", async function () {
                const contents = `
                    <POWER XMLID="ENDURANCERESERVE" ID="1690410553721" BASECOST="0.0" LEVELS="20" ALIAS="Endurance Reserve" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                    <NOTES />
                    <POWER XMLID="ENDURANCERESERVEREC" ID="1690410749576" BASECOST="0.0" LEVELS="5" ALIAS="Recovery" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                    </POWER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(item.system.description, "(20 END, 5 REC)");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 9);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 9);
                });

                it("end", function () {
                    assert.equal(item.system.end, "0");
                });
            });

            describe("Martial Dodge", function () {
                const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1691013321509" BASECOST="4.0" LEVELS="0" ALIAS="Martial Dodge" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Dodge" OCV="--" DCV="+5" DC="0" PHASE="1/2" EFFECT="Dodge, Affects All Attacks, Abort" ADDSTR="No" ACTIVECOST="35" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No">
                    <NOTES />
                    </MANEUVER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "1/2 Phase, -- OCV, +5 DCV, Dodge, Affects All Attacks, Abort",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 4);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 4);
                });

                it("end", function () {
                    assert.equal(item.system.end, "0");
                });
            });

            describe("Skill Levels", function () {
                const contents = `
                    <SKILL XMLID="SKILL_LEVELS" ID="1605812225611" BASECOST="0.0" LEVELS="10" ALIAS="Skill Levels" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CHARACTERISTIC" OPTIONID="CHARACTERISTIC" OPTION_ALIAS="with single Skill or Characteristic Roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1604669259284" NAME="Martial Practice" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
                    <NOTES />
                    </SKILL>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "+10 with single Skill or Characteristic Roll",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 20);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 20);
                });

                it("end", function () {
                    assert.equal(item.system.end, "0");
                });

                it("LEVELS", function () {
                    assert.equal(item.system.value, 10);
                });
            });

            describe("Flash", async function () {
                const contents = `
                    <POWER XMLID="FLASH" ID="1692225594431" BASECOST="0.0" LEVELS="5" ALIAS="Flash" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                    <NOTES />
                    <ADDER XMLID="HEARINGGROUP" ID="1692227848754" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                        <NOTES />
                    </ADDER>
                    <ADDER XMLID="PLUSONEHALFDIE" ID="1692227848755" BASECOST="3.0" LEVELS="0" ALIAS="+1/2 d6" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="No" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                        <NOTES />
                    </ADDER>
                    <ADDER XMLID="MENTALGROUP" ID="1692227851548" BASECOST="5.0" LEVELS="0" ALIAS="Mental Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                        <NOTES />
                    </ADDER>
                    <ADDER XMLID="NORMALSMELL" ID="1692227860234" BASECOST="3.0" LEVELS="0" ALIAS="Normal Smell" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                        <NOTES />
                    </ADDER>
                    <ADDER XMLID="DANGER_SENSE" ID="1692227865084" BASECOST="3.0" LEVELS="0" ALIAS="Danger Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                        <NOTES />
                    </ADDER>
                    <ADDER XMLID="COMBAT_SENSE" ID="1692227866025" BASECOST="5.0" LEVELS="0" ALIAS="Combat Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                        <NOTES />
                    </ADDER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Sight, Hearing and Mental Groups, Normal Smell, Danger Sense and Combat Sense Flash 5 1/2d6",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 49);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 49);
                });

                it("end", function () {
                    assert.equal(item.system.end, "5");
                });

                it("dice", function () {
                    assert.equal(item.system.dice, "5");
                });

                it("extraDice", function () {
                    assert.equal(item.system.extraDice, "half");
                });

                it("killing", function () {
                    assert.equal(item.system.killing, false);
                });
            });

            describe("FLASHDEFENSE", async function () {
                describe("11 levels", async function () {
                    const contents = `
                        <POWER XMLID="FLASHDEFENSE" ID="1700628009410" BASECOST="0.0" LEVELS="11" ALIAS="Flash Defense" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES/>
                            <MODIFIER XMLID="HARDENED" ID="1700628130373" BASECOST="0.0" LEVELS="1" ALIAS="Hardened" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES/>
                            </MODIFIER>
                        </POWER>
                    `;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Hearing Group Flash Defense (11 points), Hardened (+1/4)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 14);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 14);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 11);
                    });
                }),
                    describe("1 level", async function () {
                        const contents = `
                    <POWER XMLID="FLASHDEFENSE" ID="1700628009410" BASECOST="0.0" LEVELS="1" ALIAS="Flash Defense" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES/>
                        <MODIFIER XMLID="HARDENED" ID="1700628130373" BASECOST="0.0" LEVELS="1" ALIAS="Hardened" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                    </POWER>
                    `;
                        let item;

                        before(async () => {
                            const actor = new HeroSystem6eActor(
                                {
                                    name: "Quench Actor",
                                    type: "pc",
                                },
                                { temporary: true },
                            );
                            item = await new HeroSystem6eItem(
                                HeroSystem6eItem.itemDataFromXml(contents),
                                { temporary: true, parent: actor },
                            );
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                            item.skillRollUpdateValue();
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Hearing Group Flash Defense (1 point), Hardened (+1/4)",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 1);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 0);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });
                    });
            }),
                describe("MENTALDEFENSE", async function () {
                    const contents = `
                    <POWER XMLID="MENTALDEFENSE" ID="1576395326670" BASECOST="0.0" LEVELS="39" ALIAS="Mental Defense" POSITION="30" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES>Telepathy must overcome.</NOTES>
                        <MODIFIER XMLID="ABLATIVE" ID="1578308761240" BASECOST="-1.0" LEVELS="0" ALIAS="Ablative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BODYORSTUN" OPTIONID="BODYORSTUN" OPTION_ALIAS="BODY or STUN" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="ALWAYSON" ID="1578308761242" BASECOST="-0.5" LEVELS="0" ALIAS="Always On" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="REQUIRESASKILLROLL" ID="1578308761277" BASECOST="-0.5" LEVELS="0" ALIAS="Requires A Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SKILL" OPTIONID="SKILL" OPTION_ALIAS="Skill roll" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="CON" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="EXTRATIME" ID="1578308761317" BASECOST="-2.5" LEVELS="0" ALIAS="Extra Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="20MINUTES" OPTIONID="20MINUTES" OPTION_ALIAS="20 Minutes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                        <MODIFIER XMLID="INHERENT" ID="1578308761319" BASECOST="0.25" LEVELS="0" ALIAS="Inherent" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES />
                        </MODIFIER>
                    </POWER>
                `;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Mental Defense 39 points, Inherent (+1/4) (49 Active Points); Extra Time (20 Minutes, -2 1/2), Ablative BODY or STUN (-1), Always On (-1/2), Requires A Roll (Skill roll; CON; -1/2)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 9);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 49);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 39);
                    });
                }),
                describe("MINDSCAN", async function () {
                    const contents = `
                    <POWER XMLID="MINDSCAN" ID="1700619562891" BASECOST="0.0" LEVELS="1" ALIAS="Mind Scan" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="MIND SCAN" INPUT="Animal" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES/>
                        <ADDER XMLID="PLUSONEPIP" ID="1700708893537" BASECOST="2.0" LEVELS="0" ALIAS="+1 pip" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <ADDER XMLID="ECVBONUS" ID="1700708893538" BASECOST="0.0" LEVELS="9" ALIAS="+9 OMCV" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="2.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <ADDER XMLID="MULTIPLECLASSES" ID="1700708893539" BASECOST="5.0" LEVELS="0" ALIAS="Additional Class Of Minds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <ADDER XMLID="MULTIPLECLASSES" ID="1700708893540" BASECOST="5.0" LEVELS="0" ALIAS="Additional Class Of Minds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <ADDER XMLID="MULTIPLECLASSES" ID="1700708893541" BASECOST="5.0" LEVELS="0" ALIAS="Additional Class Of Minds" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <MODIFIER XMLID="CUMULATIVE" ID="1700708899538" BASECOST="0.5" LEVELS="0" ALIAS="Cumulative" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                        <MODIFIER XMLID="CANNOTATTACK" ID="1700709064472" BASECOST="-0.5" LEVELS="0" ALIAS="Cannot Attack Through Link" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COMMUNICATE" OPTIONID="COMMUNICATE" OPTION_ALIAS="neither the character nor his target can use the link to attack each other mentally, but they can communicate" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                    </POWER>
                `;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "1d6 + 1 Mind Scan (Animal; +1 pip; +9 OMCV; Additional Class Of Minds; Additional Class Of Minds; Additional Class Of Minds), Cumulative (+1/2) (60 Active Points); Cannot Attack Through Link (neither the character nor his target can use the link to attack each other mentally, but they can communicate; -1/2)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 40);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 60);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 6);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });
                });

            describe("General Skills", () => {
                describe("No Levels", () => {
                    const contents = `
                        <SKILL XMLID="KNOWLEDGE_SKILL" ID="1701473559272" BASECOST="2.0" LEVELS="0" ALIAS="KS" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Broken General? Should show 11- on the dice" INPUT="How to Code General Skills" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General">
                            <NOTES/>
                        </SKILL>
                    `;

                    it("roll", async function () {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        actor.system.characteristics.dex.value = 15;
                        const item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                        assert.equal(item.system.roll, "11-");
                    });
                });

                describe("Some Levels", () => {
                    const contents = `
                        <SKILL XMLID="KNOWLEDGE_SKILL" ID="1701473559272" BASECOST="2.0" LEVELS="2" ALIAS="KS" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Broken General? Should show 13- on the dice" INPUT="How to Code General Skills" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General">
                            <NOTES/>
                        </SKILL>
                    `;

                    it("roll", async function () {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        actor.system.characteristics.dex.value = 15;
                        const item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                        assert.equal(item.system.roll, "13-");
                    });
                });
            });

            describe("ABSORPTION", () => {
                describe("5e", () => {
                    const contents = `
                        <POWER XMLID="ABSORPTION" ID="1701632911260" BASECOST="0.0" LEVELS="2" ALIAS="Absorption" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ENERGY" OPTIONID="ENERGY" OPTION_ALIAS="energy" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Absorption missing INPUT" INPUT="STUN" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES/>
                            <ADDER XMLID="PLUSONEHALFDIE" ID="1701643045288" BASECOST="3.0" LEVELS="0" ALIAS="+1/2 d6" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES/>
                            </ADDER>
                        </POWER>
                    `;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        actor.system.is5e = true;
                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        assert.equal(
                            item.system.description,
                            "Absorption 2 1/2d6 (energy) to STUN",
                        );
                    });

                    it("realCost", async function () {
                        assert.equal(item.system.realCost, 13);
                    });

                    it("activePoints", async function () {
                        assert.equal(item.system.activePoints, 13);
                    });

                    it("end", async function () {
                        assert.equal(item.system.end, 0);
                    });

                    it("levels", async function () {
                        assert.equal(item.system.value, 2);
                    });
                });

                describe("6e", () => {
                    const contents = `
                        <POWER XMLID="ABSORPTION" ID="1701641804953" BASECOST="0.0" LEVELS="9" ALIAS="Absorption" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="PHYSICAL" OPTIONID="PHYSICAL" OPTION_ALIAS="physical" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="DEX" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES/>
                        </POWER>
                    `;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        actor.system.is5e = false;
                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        assert.equal(
                            item.system.description,
                            "Absorption 9 BODY (physical) to DEX",
                        );
                    });

                    it("realCost", async function () {
                        assert.equal(item.system.realCost, 9);
                    });

                    it("activePoints", async function () {
                        assert.equal(item.system.activePoints, 9);
                    });

                    it("end", async function () {
                        assert.equal(item.system.end, 0);
                    });

                    it("levels", async function () {
                        assert.equal(item.system.value, 9);
                    });
                });
            });

            describe("STRETCHING", async function () {
                const contents = `
                    <POWER XMLID="STRETCHING" ID="1698601089811" BASECOST="0.0" LEVELS="9" ALIAS="Stretching" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1698601156260" NAME="Creeping Darkness" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES>Remember up to 3d6 (1d6 for 3") for Velocity - 5" for 1" available</NOTES>
                        <MODIFIER XMLID="REDUCEDEND" ID="1699217125608" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES/>
                        </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Stretching 9m, Reduced Endurance (1/2 END; +1/4)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 56);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 56);
                });

                it("end", function () {
                    assert.equal(item.system.end, 2);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 9);
                });
            });

            describe("TELEPORTATION", async function () {
                const contents = `
                    <POWER XMLID="TELEPORTATION" ID="1698601428642" BASECOST="0.0" LEVELS="15" ALIAS="Teleportation" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1698601156260" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                        <NOTES/>
                        <ADDER XMLID="NORELATIVEVELOCITY" ID="1699217139176" BASECOST="10.0" LEVELS="0" ALIAS="No Relative Velocity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                        <NOTES/>
                        </ADDER>
                        <ADDER XMLID="POSITIONSHIFT" ID="1699217139177" BASECOST="5.0" LEVELS="0" ALIAS="Position Shift" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                        <NOTES/>
                        </ADDER>
                        <MODIFIER XMLID="REDUCEDEND" ID="1699217139182" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                        <NOTES/>
                        </MODIFIER>
                    </POWER>
                `;

                describe("5e", () => {
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        actor.system.is5e = true;

                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            'Teleportation +15" (No Relative Velocity; Position Shift), Reduced Endurance (1/2 END; +1/4)',
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 56);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 56);
                    });

                    it("end", function () {
                        assert.equal(
                            item.system.end,
                            0 /* FIXME: in the system it shows as 0 but it's up to 2 and would typically be displayed based on the max cost */,
                        );
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 15);
                    });
                });

                describe("6e", () => {
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Teleportation +15m (No Relative Velocity; Position Shift), Reduced Endurance (1/2 END; +1/4)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 37);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 37);
                    });

                    it("end", function () {
                        assert.equal(
                            item.system.end,
                            0 /* FIXME: in the system it shows as 0 but it's up to 1 and would typically be displayed based on the max cost */,
                        );
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 15);
                    });
                });
            });

            describe("FORCEFIELD", async function () {
                describe("5e", () => {
                    const contents = `
                        <POWER XMLID="FORCEFIELD" ID="1702155860391" BASECOST="0.0" LEVELS="21" ALIAS="Force Field" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="10" EDLEVELS="11" MDLEVELS="0" POWDLEVELS="0">
                            <NOTES/>
                        </POWER>
                    `;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        actor.system.is5e = true;

                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Force Field (10 PD/11 ED)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 21);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 21);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 2);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 21);
                    });
                });

                describe("6e", () => {
                    const contents = `
                        <POWER XMLID="FORCEFIELD" ID="1702155895918" BASECOST="0.0" LEVELS="21" ALIAS="Resistant Protection" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="11" EDLEVELS="10" MDLEVELS="0" POWDLEVELS="0">
                            <NOTES/>
                            <MODIFIER XMLID="COSTSEND" ID="1702156689001" BASECOST="-0.5" LEVELS="0" ALIAS="Costs Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="EVERYPHASE" OPTIONID="EVERYPHASE" OPTION_ALIAS="Costs END Every Phase" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES/>
                            </MODIFIER>
                        </POWER>
                    `;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                        item.skillRollUpdateValue();
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Resistant Protection (11 PD/10 ED) (33 Active Points); Costs Endurance (Costs END Every Phase; -1/2)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 22);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 33);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 3);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 21);
                    });
                });
            });

            describe("MULTIFORM", async function () {
                const contents = `
                    <POWER XMLID="MULTIFORM" ID="1698462538543" BASECOST="0.0" LEVELS="475" ALIAS="Multiform" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Shadow Gateway" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES>Builds are default 150 base + 75 disadvantage. Custom adder is paying off 250 extra points of disadvantages = 50 extra cost at 1 CP per 5 CP pay off in multiform.</NOTES>
                        <ADDER XMLID="INCREASENUMBER" ID="1700505945937" BASECOST="0.0" LEVELS="4" ALIAS="x16 Number Of Forms" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <ADDER XMLID="GENERIC_OBJECT" ID="1700505945938" BASECOST="50.0" LEVELS="0" ALIAS="Custom Adder" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <MODIFIER XMLID="ACTIVATIONROLL" ID="1700505945951" BASECOST="-0.5" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="14" OPTIONID="14" OPTION_ALIAS="14-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Hates Lack of Control and Different Moral Compass" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Multiform (x16 Number Of Forms; Custom Adder) (165 Active Points); Activation Roll (14-; Hates Lack of Control and Different Moral Compass; -1/2)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 110);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 165);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 475);
                });
            });

            describe("Power Frameworks", async function () {
                describe("MULTIPOWER 5e", () => {
                    const mpContents = `
                        <MULTIPOWER XMLID="GENERIC_OBJECT" ID="1702694147866" BASECOST="10.0" LEVELS="0" ALIAS="Multipower" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="MP Ego Powers" QUANTITY="1">
                            <NOTES/>
                            <MODIFIER XMLID="PERSONALIMMUNITY" ID="1702700928195" BASECOST="0.25" LEVELS="0" ALIAS="Personal Immunity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No">
                                <NOTES/>
                            </MODIFIER>
                        </MULTIPOWER>
                    `;
                    const contents = `
                        <POWER XMLID="EGOATTACK" ID="1702694021823" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1702694147866" ULTRA_SLOT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES/>
                        </POWER>
                    `;
                    let mpItem;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        actor.system.is5e = true;

                        mpItem = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(mpContents),
                            { temporary: true, parent: actor },
                        );
                        await mpItem._postUpload();
                        actor.items.set(mpItem.system.XMLID, mpItem);

                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("power description", function () {
                        assert.equal(
                            item.system.description,
                            "Ego Attack 1d6 (10 Active Points);",
                        );
                    });

                    it("power realCost", function () {
                        assert.equal(item.system.realCost, "1u");
                    });

                    it("power activePoints", function () {
                        assert.equal(item.system.activePoints, 10);
                    });

                    it("power end", function () {
                        assert.equal(item.system.end, 1);
                    });

                    it("power levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("multipower description", function () {
                        assert.equal(
                            mpItem.system.description,
                            "MP Ego Powers, 10-point reserve, all slots Personal Immunity (+1/4)",
                        );
                    });

                    it("multipower realCost", function () {
                        assert.equal(mpItem.system.realCost, 12);
                    });

                    it("multipower activePoints", function () {
                        assert.equal(mpItem.system.activePoints, 12);
                    });
                });

                describe("MULTIPOWER 6e", () => {
                    const mpContents = `
                        <MULTIPOWER XMLID="GENERIC_OBJECT" ID="1702775579792" BASECOST="20.0" LEVELS="0" ALIAS="Multipower" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1">
                            <NOTES/>
                        </MULTIPOWER>
                    `;
                    const contents = `
                        <POWER XMLID="EGOATTACK" ID="1702775416203" BASECOST="0.0" LEVELS="2" ALIAS="Mental Blast" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1702775579792" ULTRA_SLOT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES/>
                            <MODIFIER XMLID="EXTRATIME" ID="1702775689887" BASECOST="-0.5" LEVELS="0" ALIAS="Extra Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SEGMENT" OPTIONID="SEGMENT" OPTION_ALIAS="Extra Segment" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES/>
                            </MODIFIER>
                        </POWER>
                    `;
                    let mpItem;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );

                        mpItem = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(mpContents),
                            { temporary: true, parent: actor },
                        );
                        await mpItem._postUpload();
                        actor.items.set(mpItem.system.XMLID, mpItem);

                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("power description", function () {
                        assert.equal(
                            item.system.description,
                            "Mental Blast 2d6 (20 Active Points); Extra Time (Extra Segment, -1/2)",
                        );
                    });

                    it("power realCost", function () {
                        assert.equal(item.system.realCost, "1f");
                    });

                    it("power activePoints", function () {
                        assert.equal(item.system.activePoints, 20);
                    });

                    it("power end", function () {
                        assert.equal(item.system.end, 2);
                    });

                    it("power levels", function () {
                        assert.equal(item.system.value, 2);
                    });

                    it("multipower description", function () {
                        assert.equal(
                            mpItem.system.description,
                            "Multipower, 20-point reserve",
                        );
                    });

                    it("multipower realCost", function () {
                        assert.equal(mpItem.system.realCost, 20);
                    });

                    it("multipower activePoints", function () {
                        assert.equal(mpItem.system.activePoints, 20);
                    });
                });

                describe("ELEMENTAL_CONTROL 5e", () => {
                    const ecContents = `
                        <ELEMENTAL_CONTROL XMLID="GENERIC_OBJECT" ID="1702694260215" BASECOST="10.0" LEVELS="0" ALIAS="Elemental Control" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="EC Ego Powers" QUANTITY="1">
                            <NOTES/>
                            <MODIFIER XMLID="FOCUS" ID="1702700936173" BASECOST="-1.0" LEVELS="0" ALIAS="Focus" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OAF" OPTIONID="OAF" OPTION_ALIAS="OAF" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES/>
                            </MODIFIER>
                        </ELEMENTAL_CONTROL>
                    `;
                    const contents = `
                        <POWER XMLID="EGOATTACK" ID="1702694109590" BASECOST="0.0" LEVELS="2" ALIAS="Ego Attack" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1702694260215" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES/>
                            <MODIFIER XMLID="CONTINUOUS" ID="1702710186447" BASECOST="1.0" LEVELS="0" ALIAS="Continuous" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES/>
                            </MODIFIER>
                        </POWER>
                    `;
                    let ecItem;
                    let item;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            { temporary: true },
                        );
                        actor.system.is5e = true;

                        // Elemental Control
                        ecItem = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(ecContents),
                            { temporary: true, parent: actor },
                        );
                        await ecItem._postUpload();
                        actor.items.set(ecItem.system.XMLID, ecItem);

                        // Power in Elemental Control
                        item = await new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contents),
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("power description", function () {
                        assert.equal(
                            item.system.description,
                            "Ego Attack 2d6, Continuous (+1) (40 Active Points); OAF (-1)",
                        );
                    });

                    it("power realCost", function () {
                        assert.equal(item.system.realCost, 15);
                    });

                    it("power activePoints", function () {
                        assert.equal(item.system.activePoints, 40);
                    });

                    it("power end", function () {
                        assert.equal(item.system.end, 4);
                    });

                    it("power levels", function () {
                        assert.equal(item.system.value, 2);
                    });

                    it("elemental control description", function () {
                        assert.equal(
                            ecItem.system.description,
                            "EC Ego Powers, 20-point powers (10 Active Points); all slots OAF (-1)",
                        );
                    });

                    it("elemental control realCost", function () {
                        assert.equal(ecItem.system.realCost, 5);
                    });

                    it("elemental control activePoints", function () {
                        assert.equal(ecItem.system.activePoints, 10);
                    });

                    it("elemental control baseCost", function () {
                        assert.equal(ecItem.system.baseCost, 10);
                    });
                });
            });

            describe("SUPPRESS (5e only)", async function () {
                const contents = `
                    <POWER XMLID="SUPPRESS" ID="1703216193551" BASECOST="0.0" LEVELS="5" ALIAS="Suppress" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="SUPP" INPUT="Flight" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES/>
                        <ADDER XMLID="PLUSONEHALFDIE" ID="1703219636357" BASECOST="3.0" LEVELS="0" ALIAS="+1/2 d6" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <MODIFIER XMLID="RANGEBASEDONSTR" ID="1703219636358" BASECOST="-0.25" LEVELS="0" ALIAS="Range Based On Strength" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                        <MODIFIER XMLID="ARMORPIERCING" ID="1703219636359" BASECOST="0.0" LEVELS="1" ALIAS="Armor Piercing" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.is5e = true;

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Suppress Flight 7 1/2d6, Armor Piercing (+1/2) (42 Active Points); Range Based On Strength (-1/4)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 34);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 42);
                });

                it("end", function () {
                    assert.equal(item.system.end, 4);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 5);
                });
            });

            describe("AID", async function () {
                const contents = `
                    <POWER XMLID="AID" ID="1703216088164" BASECOST="0.0" LEVELS="3" ALIAS="Aid" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="AID" INPUT="CON" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES/>
                        <ADDER XMLID="PLUSONEPIP" ID="1703219832654" BASECOST="3.0" LEVELS="0" ALIAS="+1 pip" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <ADDER XMLID="INCREASEDMAX" ID="1703219832655" BASECOST="0.0" LEVELS="8" ALIAS="Increased Maximum (+8 points)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="2.0" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <MODIFIER XMLID="CONTINUOUS" ID="1703219832656" BASECOST="1.0" LEVELS="0" ALIAS="Continuous" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                        <MODIFIER XMLID="CREWSERVED" ID="1703219832667" BASECOST="-0.25" LEVELS="0" ALIAS="Crew-Served" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="2" OPTIONID="2" OPTION_ALIAS="2 people" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.is5e = true;

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Aid CON 3d6 + 1 (+1 pip; Increased Maximum (+8 points)), Continuous (+1) (74 Active Points); Crew-Served (2 people; -1/4)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 59);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 74);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 3);
                });
            });

            describe("EXTRADIMENSIONALMOVEMENT 5e", async function () {
                const contents = `
                    <POWER XMLID="EXTRADIMENSIONALMOVEMENT" ID="1703224290923" BASECOST="20.0" LEVELS="0" ALIAS="Extra-Dimensional Movement" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" OPTION="SINGLE" OPTIONID="SINGLE" OPTION_ALIAS="To Asgard" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Bifrost" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES/>
                        <ADDER XMLID="INCREASEDWEIGHT" ID="1703224290845" BASECOST="0.0" LEVELS="4" ALIAS="x16 Increased Weight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                        <MODIFIER XMLID="EXTRATIME" ID="1703224290886" BASECOST="-1.25" LEVELS="0" ALIAS="Extra Time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" OPTION="TURN" OPTIONID="TURN" OPTION_ALIAS="1 Turn (Post-Segment 12)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                        <MODIFIER XMLID="INCANTATIONS" ID="1703224290891" BASECOST="-0.25" LEVELS="0" ALIAS="Incantations" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Call Heimdall" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                        <MODIFIER XMLID="MODIFIER" ID="1703224290892" BASECOST="-0.25" LEVELS="0" ALIAS="Leaves a Mark" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                        <MODIFIER XMLID="MODIFIER" ID="1703224290893" BASECOST="-1.0" LEVELS="0" ALIAS="Heimdall Must Respond" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                        <MODIFIER XMLID="VISIBLE" ID="1703224290894" BASECOST="-0.5" LEVELS="0" ALIAS="Perceivable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="Storm clouds and rainbow column" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                        <MODIFIER XMLID="MODIFIER" ID="1703224290895" BASECOST="-1.0" LEVELS="0" ALIAS="Only at specific locations" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                            <NOTES/>
                        </MODIFIER>
                    </POWER>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    actor.system.is5e = true;

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Extra-Dimensional Movement To Asgard (x16 Increased Weight) (40 Active Points); Extra Time (1 Turn (Post-Segment 12), -1 1/4), Heimdall Must Respond (-1), Only at specific locations (-1), Perceivable (Storm clouds and rainbow column; -1/2), Incantations (Call Heimdall; -1/4), Leaves a Mark (-1/4)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 8);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 40);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0); // TODO: movement powers use 0 end but shouldn't
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });
            });

            describe("Professional Skill", async function () {
                const contents = `
                    <SKILL XMLID="PROFESSIONAL_SKILL" ID="1702245797229" BASECOST="2.0" LEVELS="0" ALIAS="PS" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Appraiser" INPUT="Appraise" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No">
                        <NOTES/>
                    </SKILL>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(item.system.description, "PS: Appraise");
                });

                it("roll", function () {
                    assert.equal(item.system.roll, "11-");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 2);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 2);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });
            });

            describe("Knowledge Skill", async function () {
                const contents = `
                        <SKILL XMLID="KNOWLEDGE_SKILL" ID="1703368216761" BASECOST="3.0" LEVELS="10" ALIAS="KS" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="SUPA brain" INPUT="types of brain matter" CHARACTERISTIC="INT" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General">
                            <NOTES/>
                        </SKILL>
                    `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "KS: types of brain matter",
                    );
                });

                it("roll", function () {
                    assert.equal(item.system.roll, "21-");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 13);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 13);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 10);
                });
            });

            describe("Transport Familiarity w/ partial subadder not exceeding group cost", async function () {
                const contents = `
                    <SKILL XMLID="TRANSPORT_FAMILIARITY" ID="1703369639524" BASECOST="0.0" LEVELS="0" ALIAS="TF" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
                        <NOTES/>
                        <ADDER XMLID="COMMONMOTORIZED" ID="1703371010094" BASECOST="2.0" LEVELS="0" ALIAS="Common Motorized Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                            <NOTES/>
                            <ADDER XMLID="SMALLMOTORIZED" ID="1703371010093" BASECOST="1.0" LEVELS="0" ALIAS="Small Motorized Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES/>
                            </ADDER>
                        </ADDER>
                    </SKILL>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "TF: Small Motorized Ground Vehicles",
                    );
                });

                it("roll", function () {
                    expect(item.system.roll).to.not.be.true;
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 1);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 1);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });
            });

            describe("Transport Familiarity w/ partial subadder exceeding group cost", async function () {
                const contents = `
                    <SKILL XMLID="TRANSPORT_FAMILIARITY" ID="1703370592843" BASECOST="0.0" LEVELS="0" ALIAS="TF" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Animals - cost equals category" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
                        <NOTES/>
                        <ADDER XMLID="RIDINGANIMALS" ID="1703370951788" BASECOST="2.0" LEVELS="0" ALIAS="Riding Animals" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="NO">
                            <NOTES/>
                            <ADDER XMLID="SWIMMINGBEASTS" ID="1703370946761" BASECOST="1.0" LEVELS="0" ALIAS="Swimming Beasts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES/>
                            </ADDER>
                            <ADDER XMLID="FLYINGBEASTS" ID="1703370948454" BASECOST="1.0" LEVELS="0" ALIAS="Flying Beasts" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES/>
                            </ADDER>
                            <ADDER XMLID="EQUINES" ID="1703370949828" BASECOST="1.0" LEVELS="0" ALIAS="Equines" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES/>
                            </ADDER>
                            <ADDER XMLID="DOGS" ID="1703370951787" BASECOST="1.0" LEVELS="0" ALIAS="Dogs" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES/>
                            </ADDER>
                        </ADDER>
                    </SKILL>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "TF: Dogs, Equines, Flying Beasts, Swimming Beasts",
                    );
                });

                it("roll", function () {
                    expect(item.system.roll).to.not.be.true;
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 2);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 2);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });
            });

            describe("Transport Familiarity w/ full subadder", async function () {
                const contents = `
                    <SKILL XMLID="TRANSPORT_FAMILIARITY" ID="1703370640285" BASECOST="0.0" LEVELS="0" ALIAS="TF" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
                        <NOTES/>
                        <ADDER XMLID="COMMONMOTORIZED" ID="1703370996086" BASECOST="2.0" LEVELS="0" ALIAS="Common Motorized Ground Vehicles" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES/>
                        </ADDER>
                    </SKILL>
                `;
                let item;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );

                    item = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents),
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                    item.skillRollUpdateValue();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "TF: Common Motorized Ground Vehicles",
                    );
                });

                it("roll", function () {
                    expect(item.system.roll).to.not.be.true;
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 2);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 2);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });
            });
        },
        { displayName: "HERO: Upload" },
    );
}
