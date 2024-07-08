import { HeroSystem6eActor } from "../actor/actor.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";

export function registerUploadTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.utils.upload",
        (context) => {
            const { assert, before, describe, expect, it } = context;

            describe("NAKEDMODIFIER", function () {
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
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

                describe("non attack AOE", function () {
                    const contents = `
                        <POWER XMLID="NAKEDMODIFIER" ID="1580691042963" BASECOST="0.0" LEVELS="53" ALIAS="Naked Advantage" POSITION="24" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Oversized Hand Bash 8" INPUT="STR" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="AOE" ID="1580691372328" BASECOST="0.0" LEVELS="8" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="OIHID" ID="1580691372331" BASECOST="-0.25" LEVELS="0" ALIAS="Only In Alternate Identity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="LINKED" ID="1580691372338" BASECOST="-0.5" LEVELS="0" ALIAS="Linked" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No" LINKED_ID="1577313774747">
                                <NOTES />
                                <ADDER XMLID="POWERRARELYOFF" ID="1580691372332" BASECOST="0.25" LEVELS="0" ALIAS="Greater Power is Constant or in use most or all of the time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                                <ADDER XMLID="ONLYWHENGREATERATFULL" ID="1580691372333" BASECOST="-0.25" LEVELS="0" ALIAS="Lesser Power can only be used when character uses greater Power at full value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            <MODIFIER XMLID="LINKED" ID="1580691372345" BASECOST="-0.5" LEVELS="0" ALIAS="Linked" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No" LINKED_ID="1578284615793">
                                <NOTES />
                                <ADDER XMLID="POWERRARELYOFF" ID="1580691372339" BASECOST="0.25" LEVELS="0" ALIAS="Greater Power is Constant or in use most or all of the time" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                                <ADDER XMLID="ONLYWHENGREATERATFULL" ID="1580691372340" BASECOST="-0.25" LEVELS="0" ALIAS="Lesser Power can only be used when character uses greater Power at full value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                                </ADDER>
                            </MODIFIER>
                            <MODIFIER XMLID="VISIBLE" ID="1580691372351" BASECOST="-0.25" LEVELS="0" ALIAS="Perceivable" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INOBVIOUSOBVIOUS" OPTIONID="INOBVIOUSOBVIOUS" OPTION_ALIAS="Inobvious Power becomes Obvious" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="Yes" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Naked Advantage for up to 53 Active points of STR (STR), Area Of Effect (8m Radius; +1/2) (26 Active Points); Linked (Greater Power is Constant or in use most or all of the time, Lesser Power can only be used when character uses greater Power at full value, -1/2), Linked (Greater Power is Constant or in use most or all of the time, Lesser Power can only be used when character uses greater Power at full value, -1/2), Only In Alternate Identity (-1/4), Perceivable (-1/4)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, "10");
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, "26");
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 3);
                    });
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Mental Combat Skill Levels: +2 with a group of Mental Powers",
                    );
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "Climbing 12-");
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
                describe("6e", async function () {
                    describe("fire blast", async function () {
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Fire Blast 1d6 (PD)");
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

                        it("doesn't use strength", function () {
                            assert.equal(item.system.usesStrength, false);
                        });
                    });

                    describe("radius", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707356128409" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707357287327" BASECOST="0.0" LEVELS="9" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Blast 1d6 (ED), Area Of Effect (9m Radius; +3/4)");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 9);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 9);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });

                    describe("explosion", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707356159805" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707356371143" BASECOST="0.0" LEVELS="16" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="EXPLOSION" ID="1707356373704" BASECOST="-0.5" LEVELS="0" ALIAS="Explosion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Blast 1d6 (ED), Area Of Effect (16m Radius; Explosion; +1/4)",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 6);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 6);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });

                    describe("cone", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707357199738" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707357408223" BASECOST="0.0" LEVELS="19" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CONE" OPTIONID="CONE" OPTION_ALIAS="Cone" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Blast 1d6 (ED), Area Of Effect (19m Cone; +3/4)");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 9);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 9);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });

                    describe("line", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707357227575" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707357437029" BASECOST="0.0" LEVELS="13" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="3.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LINE" OPTIONID="LINE" OPTION_ALIAS="Line" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="DOUBLEHEIGHT" ID="1707357448496" BASECOST="-0.5" LEVELS="3" ALIAS="Height (m)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="DOUBLEWIDTH" ID="1707357449336" BASECOST="-0.5" LEVELS="3" ALIAS="Width (m)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Blast 1d6 (ED), Area Of Effect (13m Long, 3m Tall, 3m Wide Line; +3/4)",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 9);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 9);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });

                    describe("line (default width & height)", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707357227575" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707357437029" BASECOST="0.0" LEVELS="13" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="3.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LINE" OPTIONID="LINE" OPTION_ALIAS="Line" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Blast 1d6 (ED), Area Of Effect (13m Long, 2m Tall, 2m Wide Line; +1/4)",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 6);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 6);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });

                    describe("any area", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707357291607" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707357501382" BASECOST="0.0" LEVELS="34" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ANY" OPTIONID="ANY" OPTION_ALIAS="Any Area" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="FIXEDSHAPE" ID="1707357527471" BASECOST="-0.25" LEVELS="0" ALIAS="Fixed Shape" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="MOBILE" ID="1707357530522" BASECOST="0.25" LEVELS="1" ALIAS="Mobile" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Blast 1d6 (ED), Area Of Effect (34 2m Areas; Fixed Shape, Mobile, +1 3/4)",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 14);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 14);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });

                    describe("surface", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707357261742" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707357469978" BASECOST="0.0" LEVELS="17" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SURFACE" OPTIONID="SURFACE" OPTION_ALIAS="Surface" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Blast 1d6 (ED), Area Of Effect (17m Surface; +1 1/4)",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 11);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 11);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });
                });

                describe("5e", async function () {
                    describe("hex with no increased radius", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707283846537" BASECOST="0.0" LEVELS="22" ALIAS="Energy Blast" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="West Side Massiv (W) with 1 Hex &amp; 2x radius" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707283846513" BASECOST="0.5" LEVELS="0" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEX" OPTIONID="HEX" OPTION_ALIAS="One Hex" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1707283846531" BASECOST="-0.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="15" OPTIONID="15" OPTION_ALIAS="15-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="BURNOUT" ID="1707283846517" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="JAMMED" ID="1707283846518" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                'Energy Blast 22d6 (ED), Area Of Effect (1" One Hex; +1/2) (165 Active Points); Activation Roll (15-; Burnout, Jammed, -1/2)',
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 110);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 165);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 22);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 16);
                        });
                    });

                    describe("hex with increased radius", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1705275176659" BASECOST="0.0" LEVELS="22" ALIAS="Energy Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="West Side Massiv (W) with 1 Hex &amp; 2x radius" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707272359946" BASECOST="0.5" LEVELS="0" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEX" OPTIONID="HEX" OPTION_ALIAS="One Hex" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="DOUBLEAREA" ID="1707272359920" BASECOST="0.0" LEVELS="1" ALIAS="x2 Radius" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                </MODIFIER>
                                <MODIFIER XMLID="ACTIVATIONROLL" ID="1707272369786" BASECOST="-0.25" LEVELS="0" ALIAS="Activation Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="15" OPTIONID="15" OPTION_ALIAS="15-" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="BURNOUT" ID="1707272379163" BASECOST="0.25" LEVELS="0" ALIAS="Burnout" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="JAMMED" ID="1707272381673" BASECOST="-0.5" LEVELS="0" ALIAS="Jammed" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                'Energy Blast 22d6 (ED), Area Of Effect (2" Radius; +3/4) (192 Active Points); Activation Roll (15-; Burnout, Jammed, -1/2)',
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 128);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 192);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 22);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 19);
                        });
                    });

                    describe("radius", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707276179129" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707276369861" BASECOST="1.0" LEVELS="0" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RADIUS" OPTIONID="RADIUS" OPTION_ALIAS="Radius" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="DOUBLEAREA" ID="1707276377479" BASECOST="0.0" LEVELS="6" ALIAS="x64 Radius" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                'Energy Blast 1d6 (ED), Area Of Effect (64" Radius; +2 1/2)',
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 17);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 17);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 2);
                        });
                    });

                    describe("cone", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707276203213" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707276397096" BASECOST="1.0" LEVELS="0" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CONE" OPTIONID="CONE" OPTION_ALIAS="Cone" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="DOUBLEAREA" ID="1707276408964" BASECOST="0.0" LEVELS="1" ALIAS="x2 Length Sides" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                'Energy Blast 1d6 (ED), Area Of Effect (4" Cone; +1 1/4)',
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 11);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 11);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });

                    describe("line", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707276230888" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707276426768" BASECOST="1.0" LEVELS="0" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LINE" OPTIONID="LINE" OPTION_ALIAS="Line" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="DOUBLEHEIGHT" ID="1707276452940" BASECOST="0.0" LEVELS="1" ALIAS="x2 Height" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="DOUBLEWIDTH" ID="1707276453391" BASECOST="0.0" LEVELS="1" ALIAS="x2 Width" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
                                    <ADDER XMLID="DOUBLELENGTH" ID="1707276453882" BASECOST="0.0" LEVELS="1" ALIAS="x2 Length" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                'Energy Blast 1d6 (ED), Area Of Effect (4" Long, 2" Tall, 2" Wide Line; +1 3/4)',
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 14);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 14);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 1);
                        });
                    });

                    describe("area", async function () {
                        const contents = `
                            <POWER XMLID="ENERGYBLAST" ID="1707276300061" BASECOST="0.0" LEVELS="3" ALIAS="Energy Blast" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="AOE" ID="1707355669461" BASECOST="1.0" LEVELS="0" ALIAS="Area Of Effect" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ANY" OPTIONID="ANY" OPTION_ALIAS="Any Area" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                    <ADDER XMLID="DOUBLEAREA" ID="1707355669437" BASECOST="0.0" LEVELS="1" ALIAS="x2 Area" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" LVLCOST="0.25" LVLVAL="1.0" SELECTED="YES">
                                        <NOTES />
                                    </ADDER>
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                'Energy Blast 3d6 (PD), Area Of Effect (4" Any Area; +1 1/4)',
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 34);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 34);
                        });

                        it("levels", function () {
                            assert.equal(item.system.value, 3);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, 3);
                        });
                    });
                });

                describe("radial explosion", async function () {
                    const contents = `
                        <POWER XMLID="ENERGYBLAST" ID="1707364588362" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="EXPLOSION" ID="1707608262104" BASECOST="0.5" LEVELS="9" ALIAS="Explosion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NORMAL" OPTIONID="NORMAL" OPTION_ALIAS="Normal (Radius)" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            'Energy Blast 1d6 (ED), Explosion (Radius; -1 DC/9"; +2 1/2)',
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 17);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 17);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 2);
                    });
                });

                describe("conical explosion", async function () {
                    const contents = `
                        <POWER XMLID="ENERGYBLAST" ID="1707608233427" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="EXPLOSION" ID="1707608512604" BASECOST="0.5" LEVELS="4" ALIAS="Explosion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="CONE" OPTIONID="CONE" OPTION_ALIAS="Cone" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, 'Energy Blast 1d6 (ED), Explosion (Cone; -1 DC/4"; +1)');
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 10);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 10);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 1);
                    });
                });

                describe("linear explosion", async function () {
                    const contents = `
                        <POWER XMLID="ENERGYBLAST" ID="1707362956219" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="EXPLOSION" ID="1707609252695" BASECOST="0.5" LEVELS="4" ALIAS="Explosion" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="LINE" OPTIONID="LINE" OPTION_ALIAS="Line" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            'Energy Blast 1d6 (ED), Explosion (Line; -1 DC/4"; +3/4)',
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 9);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 9);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 1);
                    });
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Killing Attack - Ranged 2½d6 (ED) (40 Active Points); OAF (-1), 8 Charges (-1/2)",
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

                it("doesn't use strength", function () {
                    assert.equal(item.system.usesStrength, false);
                });
            });

            describe("2d6-1 RKA", async function () {
                const contents = `
                    <POWER XMLID="RKA" ID="1708730905311" BASECOST="0.0" LEVELS="1" ALIAS="Killing Attack - Ranged" POSITION="22" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <ADDER XMLID="MINUSONEPIP" ID="1708731182810" BASECOST="10.0" LEVELS="0" ALIAS="+1d6 -1" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "Killing Attack - Ranged 2d6-1 (ED)");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 25);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 25);
                });

                it("dice", function () {
                    assert.equal(item.system.dice, 1);
                });

                it("extraDice", function () {
                    assert.equal(item.system.extraDice, "one-pip");
                });

                it("end", function () {
                    assert.equal(item.system.end, 2);
                });

                it("charges", function () {
                    assert.equal(item.system.charges, undefined);
                });

                it("doesn't use strength", function () {
                    assert.equal(item.system.usesStrength, false);
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
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
                describe("5e", async function () {
                    describe("single single", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLESINGLE" OPTIONID="SINGLESINGLE" OPTION_ALIAS="with any single attack with one specific weapon" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Combat Skill Levels: +6 with any single attack with one specific weapon",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 6);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 6);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 1);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("single strike", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SINGLESTRIKE" OPTIONID="SINGLESTRIKE" OPTION_ALIAS="with any single Strike" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Combat Skill Levels: +6 with any single Strike");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 12);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 12);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 2);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("single strike", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="STRIKE" OPTIONID="STRIKE" OPTION_ALIAS="with any Strike" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Combat Skill Levels: +6 with any Strike");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 18);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 18);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 3);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("martial maneuvers", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MARTIAL" OPTIONID="MARTIAL" OPTION_ALIAS="with Martial Maneuvers" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Combat Skill Levels: +6 with Martial Maneuvers");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 18);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 18);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 3);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("magic", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MAGIC" OPTIONID="MAGIC" OPTION_ALIAS="with Magic" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Combat Skill Levels: +6 with Magic");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 18);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 18);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 3);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("broad set", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="BROAD" OPTIONID="BROAD" OPTION_ALIAS="with a broadly-defined category of attacks" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Combat Skill Levels: +6 with a broadly-defined category of attacks",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 24);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 24);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 4);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("DCV with HTH & Ranged", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HTHDCV" OPTIONID="HTHDCV" OPTION_ALIAS="DCV with HTH or Ranged Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Combat Skill Levels: +6 DCV with HTH or Ranged Combat",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 24);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 24);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 4);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("DECV vs Mental & attacks", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="DECV" OPTIONID="DECV" OPTION_ALIAS="DECV versus all Mental Powers and attacks" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            await actor._postUpload();

                            actor.system.is5e = true;
                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Combat Skill Levels: +6 DECV versus all Mental Powers and attacks",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 24);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 24);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 4);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("mental", async function () {
                        const contents = `
                        <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTAL" OPTIONID="MENTAL" OPTION_ALIAS="with Mental Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Combat Skill Levels: +6 with Mental Combat");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 30);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 30);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 5);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("ranged combat", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RANGED" OPTIONID="RANGED" OPTION_ALIAS="with Ranged Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Combat Skill Levels: +6 with Ranged Combat");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 30);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 30);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 5);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("OCV two categories", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWOOCV" OPTIONID="TWOOCV" OPTION_ALIAS="OCV with any two categories of combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Combat Skill Levels: +6 OCV with any two categories of combat",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 24);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 24);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 4);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("DCV two categories", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWODCV" OPTIONID="TWODCV" OPTION_ALIAS="DCV with any two categories of combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Combat Skill Levels: +6 DCV with any two categories of combat",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 24);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 24);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 4);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("HTH and Ranged", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HTHRANGED" OPTIONID="HTHRANGED" OPTION_ALIAS="with HTH and Ranged Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Combat Skill Levels: +6 with HTH and Ranged Combat");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 36);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 36);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 6);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("HTH and Mental", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HTHMENTAL" OPTIONID="HTHMENTAL" OPTION_ALIAS="with HTH and Mental Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(item.system.description, "Combat Skill Levels: +6 with HTH and Mental Combat");
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 36);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 36);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 6);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });

                    describe("Mental and Ranged", async function () {
                        const contents = `
                            <SKILL XMLID="COMBAT_LEVELS" ID="1707675763848" BASECOST="0.0" LEVELS="6" ALIAS="Combat Skill Levels" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTALRANGED" OPTIONID="MENTALRANGED" OPTION_ALIAS="with Mental and Ranged Combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No">
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
                            actor.system.is5e = true;
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Combat Skill Levels: +6 with Mental and Ranged Combat",
                            );
                        });

                        it("realCost", function () {
                            assert.equal(item.system.realCost, 36);
                        });

                        it("activePoints", function () {
                            assert.equal(item.system.activePoints, 36);
                        });

                        it("costPerLevel", function () {
                            assert.equal(item.system.costPerLevel, 6);
                        });

                        it("end", function () {
                            assert.equal(item.system.end, "0");
                        });
                    });
                });

                describe("6e", async function () {
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Combat Skill Levels: +1 with any single attack");
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
            });

            describe("INVISIBILITY", async function () {
                describe("5e single group sense", async function () {
                    const contents = `
                        <POWER XMLID="INVISIBILITY" ID="1704153437975" BASECOST="10.0" LEVELS="0" ALIAS="Invisibility" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Invisibility to Hearing Group");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 10);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 10);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, "1");
                    });
                });

                describe("5e multiple group senses", async function () {
                    const contents = `
                        <POWER XMLID="INVISIBILITY" ID="1704159264800" BASECOST="10.0" LEVELS="0" ALIAS="Invisibility" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MYSTICGROUP" OPTIONID="MYSTICGROUP" OPTION_ALIAS="Mystic Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <ADDER XMLID="MENTALGROUP" ID="1704160042663" BASECOST="5.0" LEVELS="0" ALIAS="Mental Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Invisibility to Mystic and Mental Groups");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 15);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 15);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, "1");
                    });
                });

                describe("5e combination group and single senses", async function () {
                    const contents = `
                        <POWER XMLID="INVISIBILITY" ID="1704159276079" BASECOST="10.0" LEVELS="0" ALIAS="Invisibility" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <ADDER XMLID="TOUCHGROUP" ID="1704163657241" BASECOST="5.0" LEVELS="0" ALIAS="Touch Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                <NOTES />
                            </ADDER>
                            <ADDER XMLID="NORMALTASTE" ID="1704163657242" BASECOST="3.0" LEVELS="0" ALIAS="Normal Taste" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                <NOTES />
                            </ADDER>
                            <ADDER XMLID="DANGER_SENSE" ID="1704163657243" BASECOST="5.0" LEVELS="0" ALIAS="Danger Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                <NOTES />
                            </ADDER>
                            <ADDER XMLID="NOFRINGE" ID="1704163661221" BASECOST="10.0" LEVELS="0" ALIAS="No Fringe" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    // TODO: Not quite right but would require a bunch of work to identify all the sense adders. Good enough for now.
                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Invisibility to Hearing and Touch Groups, Normal Taste, Danger Sense and No Fringe",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 33);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 33);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, "3");
                    });
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "1/2 Phase, -2 OCV, +0 DCV, HKA 1d6+1");
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Killing Attack - Hand-To-Hand 2d6 (ED), Penetrating (+1/2) (45 Active Points); OAF (Pen-sized Device in pocket; -1), No STR Bonus (-1/2)",
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
                    <POWER XMLID="RKA" ID="1624916890101" BASECOST="0.0" LEVELS="3" ALIAS="Killing Attack - Ranged" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Crush" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Killing Attack - Ranged 3d6 (PD), Personal Immunity (+1/4), Reduced Endurance (1/2 END; +1/4), Area Of Effect (6m Radius; +1/2) (90 Active Points); No Range (-1/2), Must Follow Grab (-1/2)",
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "Endurance Reserve (20 END, 5 REC)");
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "+10 with single Skill or Characteristic Roll");
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Sight, Hearing and Mental Groups, Normal Smell, Danger Sense and Combat Sense Flash 5½d6",
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
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
                            await actor._postUpload();

                            item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                temporary: true,
                                parent: actor,
                            });
                            await item._postUpload();
                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Hearing Group Flash Defense (1 points), Hardened (+1/4)", // Intentionally plural for simpler translation
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "1d6+1 Mind Scan (Animal; +9 OMCV; Additional Class Of Minds; Additional Class Of Minds; Additional Class Of Minds), Cumulative (+1/2) (60 Active Points); Cannot Attack Through Link (neither the character nor his target can use the link to attack each other mentally, but they can communicate; -1/2)",
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

            describe("Skill Rolls", () => {
                describe("KS: GENERAL with no Levels", () => {
                    const contents = `
                        <SKILL XMLID="KNOWLEDGE_SKILL" ID="1701473559272" BASECOST="2.0" LEVELS="0" ALIAS="KS" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Broken General? Should show 11- on the dice" INPUT="How to Code General Skills" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        expect(item.system.description).to.be.equal("KS: How to Code General Skills 11-");
                    });

                    it("roll", async function () {
                        expect(item.system.roll).to.be.equal("11-");
                    });

                    it("tags", async function () {
                        expect(item.system.tags).to.be.deep.equal([{ value: 11, name: "Base Skill" }]);
                    });

                    it("levels", async function () {
                        assert.equal(item.system.value, 0);
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 2);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 2);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });
                });

                describe("KS: GENERAL with some Levels", () => {
                    const contents = `
                        <SKILL XMLID="KNOWLEDGE_SKILL" ID="1701473559272" BASECOST="2.0" LEVELS="2" ALIAS="KS" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Broken General? Should show 13- on the dice" INPUT="How to Code General Skills" CHARACTERISTIC="GENERAL" FAMILIARITY="No" PROFICIENCY="No" LEVELSONLY="No" TYPE="General">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        expect(item.system.description).to.be.equal("KS: How to Code General Skills 13-");
                    });

                    it("roll", async function () {
                        expect(item.system.roll).to.be.equal("13-");
                    });

                    it("tags", async function () {
                        expect(item.system.tags).to.be.deep.equal([
                            { value: 11, name: "Base Skill" },
                            {
                                value: 2,
                                name: "Levels",
                            },
                        ]);
                    });

                    it("levels", async function () {
                        assert.equal(item.system.value, 2);
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 4);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 4);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });
                });

                describe("SS: INT with 0 Levels", () => {
                    const contents = `
                        <SKILL XMLID="SCIENCE_SKILL" ID="1042169893315" BASECOST="3.0" LEVELS="0" ALIAS="SS" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1236046710927" NAME="" INPUT="Astronomy" CHARACTERISTIC="INT" FAMILIARITY="No" LEVELSONLY="No">
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
                        actor.system.characteristics.int.value = 25;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        expect(item.system.description).to.be.equal("SS: Astronomy 14-");
                    });

                    it("roll", async function () {
                        expect(item.system.roll).to.be.equal("14-");
                    });

                    it("tags", async function () {
                        expect(item.system.tags).to.be.deep.equal([
                            { value: 9, name: "Base Skill" },
                            { value: 5, name: "int" },
                        ]);
                    });

                    it("levels", async function () {
                        assert.equal(item.system.value, 0);
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 3);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 3);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });
                });

                describe("SS: INT with 3 Levels", () => {
                    const contents = `
                        <SKILL XMLID="SCIENCE_SKILL" ID="1042169958518" BASECOST="3.0" LEVELS="3" ALIAS="SS" POSITION="32" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1236046710927" NAME="" INPUT="Robotics" CHARACTERISTIC="INT" FAMILIARITY="No" LEVELSONLY="No">
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
                        actor.system.characteristics.int.value = 13;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        expect(item.system.description).to.be.equal("SS: Robotics 15-");
                    });

                    it("roll", async function () {
                        expect(item.system.roll).to.be.equal("15-");
                    });

                    it("tags", async function () {
                        expect(item.system.tags).to.be.deep.equal([
                            { value: 9, name: "Base Skill" },
                            { value: 3, name: "int" },
                            { value: 3, name: "Levels" },
                        ]);
                    });

                    it("levels", async function () {
                        assert.equal(item.system.value, 3);
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 6);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 6);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });
                });

                describe("PS: Familiarity", () => {
                    const contents = `
                        <SKILL XMLID="PROFESSIONAL_SKILL" ID="1709961543498" BASECOST="1.0" LEVELS="0" ALIAS="PS" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Appraise" CHARACTERISTIC="GENERAL" FAMILIARITY="Yes" PROFICIENCY="No" LEVELSONLY="No" EVERYMAN="No">
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
                        actor.system.characteristics.int.value = 13;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        expect(item.system.description).to.be.equal("PS: Appraise 8-");
                    });

                    it("roll", async function () {
                        expect(item.system.roll).to.be.equal("8-");
                    });

                    it("tags", async function () {
                        expect(item.system.tags).to.be.deep.equal([{ value: 8, name: "Familiarity" }]);
                    });

                    it("levels", async function () {
                        assert.equal(item.system.value, 0);
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
                });

                describe("PS: Everyman", () => {
                    const contents = `
                        <SKILL XMLID="PROFESSIONAL_SKILL" ID="1709961556501" BASECOST="0.0" LEVELS="0" ALIAS="PS" POSITION="18" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Bailiff" CHARACTERISTIC="GENERAL" FAMILIARITY="Yes" PROFICIENCY="No" LEVELSONLY="No" EVERYMAN="Yes">
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
                        actor.system.characteristics.int.value = 13;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        expect(item.system.description).to.be.equal("PS: Bailiff 11-");
                    });

                    it("roll", async function () {
                        expect(item.system.roll).to.be.equal("11-");
                    });

                    it("tags", async function () {
                        expect(item.system.tags).to.be.deep.equal([{ value: 11, name: "Everyman PS" }]);
                    });

                    it("levels", async function () {
                        assert.equal(item.system.value, 0);
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 0);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 0);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        assert.equal(item.system.description, "Absorption 2½d6 (energy) to STUN");
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", async function () {
                        assert.equal(item.system.description, "Absorption 9 BODY (physical) to DEX");
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
                describe("6e", async function () {
                    const contents = `
                        <POWER XMLID="STRETCHING" ID="1698601089811" BASECOST="0.0" LEVELS="9" ALIAS="Stretching" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1698601156260" NAME="Creeping Darkness" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REDUCEDEND" ID="1699217125608" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Stretching 9m, Reduced Endurance (1/2 END; +1/4)");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 11);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 11);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 1);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 9);
                    });
                });

                describe("5e", async function () {
                    const contents = `
                        <POWER XMLID="STRETCHING" ID="1709512021930" BASECOST="0.0" LEVELS="9" ALIAS="Stretching" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="REDUCEDEND" ID="1709513837111" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, 'Stretching 9", Reduced Endurance (1/2 END; +1/4)');
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            'Teleportation 15" (No Relative Velocity; Position Shift), Reduced Endurance (1/2 END; +1/4)',
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Teleportation 15m (No Relative Velocity; Position Shift), Reduced Endurance (1/2 END; +1/4)",
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Force Field (10 rPD/11 rED)");
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Resistant Protection (11 rPD/10 rED) (33 Active Points); Costs Endurance (Costs END Every Phase; -1/2)",
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
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
                        await actor._postUpload();

                        mpItem = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(mpContents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await mpItem._postUpload();
                        actor.items.set(mpItem.system.XMLID, mpItem);

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("power description", function () {
                        assert.equal(item.system.description, "Ego Attack 1d6 (10 Active Points)");
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
                        await actor._postUpload();

                        mpItem = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(mpContents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await mpItem._postUpload();
                        actor.items.set(mpItem.system.XMLID, mpItem);

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
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
                        assert.equal(mpItem.system.description, "Multipower, 20-point reserve");
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
                        await actor._postUpload();

                        // Elemental Control
                        ecItem = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(ecContents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await ecItem._postUpload();
                        actor.items.set(ecItem.system.XMLID, ecItem);

                        // Power in Elemental Control
                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
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

                    it("elemental control realCost", function () {
                        assert.equal(ecItem.system.realCost, 5);
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Suppress Flight 5½d6, Armor Piercing (+1/2) (42 Active Points); Range Based On Strength (-1/4)",
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

            describe("AID 5e", async function () {
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        //"Aid CON 3d6+1 (Increased Maximum (+8 points) (27 total points)), Continuous (+1) (74 Active Points); Crew-Served (2 people; -1/4)",
                        "Aid CON 3d6+1, Can Add Maximum Of 27 Points, Continuous (+1) (74 Active Points); Crew-Served (2 people; -1/4)",
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

            describe("SUCCOR 5e", async function () {
                const contents = `
                    <POWER XMLID="SUCCOR" ID="1709342717305" BASECOST="0.0" LEVELS="5" ALIAS="Succor" POSITION="60" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="END" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <ADDER XMLID="PLUSONEHALFDIE" ID="1709504811305" BASECOST="3.0" LEVELS="0" ALIAS="+1/2 d6" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
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
                    actor.system.is5e = true;
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "Succor END 5½d6 (END)");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 28);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 28);
                });

                it("end", function () {
                    assert.equal(item.system.end, 3);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 5);
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "TF: Small Motorized Ground Vehicles");
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "TF: Dogs, Equines, Flying Beasts, Swimming Beasts");
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "TF: Common Motorized Ground Vehicles");
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

            describe("CLINGING", async function () {
                const contents = `
                    <POWER XMLID="CLINGING" ID="1704151912429" BASECOST="10.0" LEVELS="18" ALIAS="Clinging" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "Clinging (10 + 18 = 28 STR)");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 16);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 16);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 18);
                });
            });

            describe("DARKNESS", async function () {
                describe("5e single group", async function () {
                    const contents = `
                        <POWER XMLID="DARKNESS" ID="1704151897819" BASECOST="0.0" LEVELS="1" ALIAS="Darkness" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Hearing Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Darkness to Hearing Group");
                    });

                    // TODO: Doesn't work yet.
                    // it("realCost", function () {
                    //     assert.equal(item.system.realCost, 5);
                    // });

                    // it("activePoints", function () {
                    //     assert.equal(item.system.activePoints, 5);
                    // });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });
                });

                describe("5e multiple groups", async function () {
                    const contents = `
                        <POWER XMLID="DARKNESS" ID="1704162258024" BASECOST="0.0" LEVELS="8" ALIAS="Darkness" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <ADDER XMLID="SMELLGROUP" ID="1704163064301" BASECOST="5.0" LEVELS="0" ALIAS="Smell/Taste Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Darkness to Sight and Smell/Taste Groups");
                    });

                    // TODO: Doesn't work yet.
                    // it("realCost", function () {
                    //     assert.equal(item.system.realCost, 85);
                    // });

                    // it("activePoints", function () {
                    //     assert.equal(item.system.activePoints, 85);
                    // });

                    it("levels", function () {
                        assert.equal(item.system.value, 8);
                    });
                });

                describe("5e multiple groups and singles", async function () {
                    const contents = `
                        <POWER XMLID="DARKNESS" ID="1704162272176" BASECOST="0.0" LEVELS="10" ALIAS="Darkness" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="SIGHTGROUP" OPTIONID="SIGHTGROUP" OPTION_ALIAS="Sight Group" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <ADDER XMLID="DANGER_SENSE" ID="1704163501700" BASECOST="5.0" LEVELS="0" ALIAS="Danger Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                <NOTES />
                            </ADDER>
                            <ADDER XMLID="NORMALTASTE" ID="1704163501701" BASECOST="3.0" LEVELS="0" ALIAS="Normal Taste" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
                                <NOTES />
                            </ADDER>
                            <ADDER XMLID="ALTERABLESIZE" ID="1704163501702" BASECOST="5.0" LEVELS="0" ALIAS="Alterable Size" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="No" INCLUDE_NOTES_IN_PRINTOUT="No" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                                <NOTES />
                            </ADDER>
                            <ADDER XMLID="HEARINGGROUP" ID="1704163504753" BASECOST="5.0" LEVELS="0" ALIAS="Hearing Group" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="-1.0" LVLVAL="-1.0" SELECTED="YES">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    // TODO: Not quite right but would require a bunch of work to identify all the sense adders. Good enough for now.
                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Darkness to Sight and Hearing Groups, Danger Sense, Normal Taste and Alterable Size",
                        );
                    });

                    // TODO: Doesn't work yet.
                    // it("realCost", function () {
                    //     assert.equal(item.system.realCost, 118);
                    // });

                    // it("activePoints", function () {
                    //     assert.equal(item.system.activePoints, 118);
                    // });

                    it("levels", function () {
                        assert.equal(item.system.value, 10);
                    });
                });
            });

            describe("CONTACT", async function () {
                describe("CONTACT 8-", async function () {
                    const contents = `
                        <PERK XMLID="CONTACT" ID="1709783993407" BASECOST="0.0" LEVELS="1" ALIAS="Contact" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                        </PERK>
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Contact 8-");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 1);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 1);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });
                });

                describe("CONTACT 11-", async function () {
                    const contents = `
                        <PERK XMLID="CONTACT" ID="1709783993407" BASECOST="0.0" LEVELS="2" ALIAS="Contact" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                            <NOTES />
                        </PERK>
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Contact 11-");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 2);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 2);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 2);
                    });
                });
            });

            describe("Skill enhancers", async function () {
                const skillEnhancerContents = `
                    <SCIENTIST XMLID="SCIENTIST" ID="1236046710927" BASECOST="3.0" LEVELS="0" ALIAS="Scientist" POSITION="19" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INTBASED="NO">
                        <NOTES />
                    </SCIENTIST>
                `;
                const contents = `
                    <SKILL XMLID="SCIENCE_SKILL" ID="1042169893315" BASECOST="3.0" LEVELS="0" ALIAS="SS" POSITION="20" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" PARENTID="1236046710927" NAME="" INPUT="Astronomy" CHARACTERISTIC="INT" FAMILIARITY="No" LEVELSONLY="No">
                        <NOTES />
                    </SKILL>
                `;
                let skillItem;
                let skillEnhancerItem;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        { temporary: true },
                    );
                    await actor._postUpload();

                    skillEnhancerItem = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(skillEnhancerContents, actor),
                        { temporary: true, parent: actor },
                    );
                    await skillEnhancerItem._postUpload();
                    actor.items.set(skillEnhancerItem.system.XMLID, skillEnhancerItem);

                    skillItem = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await skillItem._postUpload();
                    actor.items.set(skillItem.system.XMLID, skillItem);
                });

                it("skill enhancer description", function () {
                    assert.equal(skillEnhancerItem.system.description, "Scientist");
                });

                it("skill enhancer realCost", function () {
                    assert.equal(skillEnhancerItem.system.realCost, 3);
                });

                it("skill enhancer activePoints", function () {
                    assert.equal(skillEnhancerItem.system.activePoints, 3);
                });

                it("skill enhancer levels", function () {
                    assert.equal(skillEnhancerItem.system.value, 0);
                });

                it("skill description", function () {
                    assert.equal(skillItem.system.description, "SS: Astronomy 11- (3 Active Points)");
                });

                it("skill realCost", function () {
                    assert.equal(skillItem.system.realCost, 2);
                });

                it("skill activePoints", function () {
                    assert.equal(skillItem.system.activePoints, 3);
                });

                it("skill levels", function () {
                    assert.equal(skillItem.system.value, 0);
                });
            });

            describe("AUTOFIRE", async function () {
                describe("AUTOFIRE with REDUCEDEND", async function () {
                    const contents = `
                        <POWER XMLID="ENERGYBLAST" ID="1710100005722" BASECOST="0.0" LEVELS="16" ALIAS="Energy Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="AUTOFIRE" ID="1710101174705" BASECOST="0.25" LEVELS="0" ALIAS="Autofire" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWO" OPTIONID="TWO" OPTION_ALIAS="2 Shots" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="REDUCEDEND" ID="1710101174711" BASECOST="0.25" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HALFEND" OPTIONID="HALFEND" OPTION_ALIAS="1/2 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Energy Blast 16d6 (ED), Autofire (2 Shots; +1/4), Reduced Endurance (1/2 END; +1/2)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 140);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 140);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 16);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 5);
                    });
                });

                describe("AUTOFIRE with 0 end", async function () {
                    const contents = `
                        <POWER XMLID="ENERGYBLAST" ID="1710100025417" BASECOST="0.0" LEVELS="16" ALIAS="Energy Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="AUTOFIRE" ID="1710101184770" BASECOST="0.25" LEVELS="0" ALIAS="Autofire" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="TWO" OPTIONID="TWO" OPTION_ALIAS="2 Shots" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="REDUCEDEND" ID="1710101184776" BASECOST="0.5" LEVELS="0" ALIAS="Reduced Endurance" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="ZERO" OPTIONID="ZERO" OPTION_ALIAS="0 END" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Energy Blast 16d6 (ED), Autofire (2 Shots; +1/4), Reduced Endurance (0 END; +1)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 180);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 180);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 16);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });
                });
            });

            describe("DUPLICATION", async function () {
                const contents = `
                    <POWER XMLID="DUPLICATION" ID="1042168627862" BASECOST="0.0" LEVELS="0" ALIAS="Duplication" POSITION="56" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Detachable Head" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" NUMBER="1" POINTS="962">
                        <NOTES />
                        <MODIFIER XMLID="GENERIC_OBJECT" ID="1236097637040" BASECOST="-1.0" LEVELS="0" ALIAS="Original Is Incapacitated And Helpless While Duplicate Exists" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="No" NAME="" COMMENTS="" PRIVATE="No">
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Duplication (creates 962-point form) (192 Active Points); Original Is Incapacitated And Helpless While Duplicate Exists (-1)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 96);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 192);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });
            });

            describe("Range modifiers", async function () {
                describe("self", async function () {
                    const contents = `
                        <POWER XMLID="FLIGHT" ID="1710708328360" BASECOST="0.0" LEVELS="4" ALIAS="Flight" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, 'Flight 4"');
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 8);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 8);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 4);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0); // TODO: endurance is 0 for movement
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "self");
                    });
                });

                describe("self -> no range", async function () {
                    const contents = `
                        <POWER XMLID="FLIGHT" ID="1710708341564" BASECOST="0.0" LEVELS="1" ALIAS="Flight" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="UOO" ID="1710708506783" BASECOST="0.25" LEVELS="0" ALIAS="Usable By Other" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UBO" OPTIONID="UBO" OPTION_ALIAS="Usable By Other" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, 'Flight 1", Usable By Other (Usable By Other; +1/4)');
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 2);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 2);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0); // TODO: endurance is 0 for movement
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "no range");
                    });
                });

                describe("self -> standard", async function () {
                    const contents = `
                        <POWER XMLID="FLIGHT" ID="1710708465351" BASECOST="0.0" LEVELS="1" ALIAS="Flight" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="UOO" ID="1710708631692" BASECOST="0.25" LEVELS="0" ALIAS="Usable By Other" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UBO" OPTIONID="UBO" OPTION_ALIAS="Usable By Other" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="RANGED" ID="1710708641441" BASECOST="0.5" LEVELS="0" ALIAS="Ranged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RANGED" OPTIONID="RANGED" OPTION_ALIAS="Ranged" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            'Flight 1", Usable By Other (Usable By Other; +1/4), Ranged (Ranged; +1/2)',
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 3);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 3);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0); // TODO: endurance is 0 for movement
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "standard");
                    });
                });

                describe("self -> los", async function () {
                    const contents = `
                        <POWER XMLID="FLIGHT" ID="1710708487220" BASECOST="0.0" LEVELS="1" ALIAS="Flight" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="Yes" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="UOO" ID="1710708654233" BASECOST="0.25" LEVELS="0" ALIAS="Usable By Other" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UBO" OPTIONID="UBO" OPTION_ALIAS="Usable By Other" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="RANGED" ID="1710708659774" BASECOST="0.5" LEVELS="0" ALIAS="Ranged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RANGED" OPTIONID="RANGED" OPTION_ALIAS="Ranged" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="LOS" ID="1710708665903" BASECOST="0.5" LEVELS="0" ALIAS="Line Of Sight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            'Flight 1", Usable By Other (Usable By Other; +1/4), Ranged (Ranged; +1/2), Line Of Sight (+1/2)',
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 4);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 4);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0); // TODO: endurance is 0 for movement
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "los");
                    });
                });

                describe("no range", async function () {
                    const contents = `
                        <POWER XMLID="DRAIN" ID="1710634909738" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="6" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="No Range Drain" INPUT="EGO" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Drain EGO 1d6");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 10);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 10);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 1);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "no range");
                    });
                });

                describe("no range -> ranged", async function () {
                    const contents = `
                        <POWER XMLID="DRAIN" ID="1710634870060" BASECOST="0.0" LEVELS="6" ALIAS="Drain" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Ranged Drain" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="RANGED" ID="1710635037467" BASECOST="0.5" LEVELS="0" ALIAS="Ranged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RANGED" OPTIONID="RANGED" OPTION_ALIAS="Ranged" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Drain BODY 6d6, Ranged (Ranged; +1/2)");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 90);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 90);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 6);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 9);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "standard");
                    });
                });

                describe("no range -> los", async function () {
                    const contents = `
                        <POWER XMLID="DRAIN" ID="1710648601998" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="7" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="RANGED" ID="1710648760601" BASECOST="0.5" LEVELS="0" ALIAS="Ranged" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RANGED" OPTIONID="RANGED" OPTION_ALIAS="Ranged" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                            <MODIFIER XMLID="LOS" ID="1710648765392" BASECOST="0.5" LEVELS="0" ALIAS="Line Of Sight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Drain BODY 1d6, Ranged (Ranged; +1/2), Line Of Sight (+1/2)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 20);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 20);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 2);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "los");
                    });
                });

                describe("standard -> los", async function () {
                    const contents = `
                        <POWER XMLID="ENERGYBLAST" ID="1710633541950" BASECOST="0.0" LEVELS="10" ALIAS="Energy Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="LOS Blast" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="LOS" ID="1710635046396" BASECOST="0.5" LEVELS="0" ALIAS="Line Of Sight" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Energy Blast 10d6 (ED), Line Of Sight (+1/2)");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 75);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 75);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 10);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 7);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "los");
                    });
                });

                describe("standard -> no range", async function () {
                    const contents = `
                        <POWER XMLID="ENERGYBLAST" ID="1710634815262" BASECOST="0.0" LEVELS="11" ALIAS="Energy Blast" POSITION="4" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="No Range Blast" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="NORANGE" ID="1710634982311" BASECOST="-0.5" LEVELS="0" ALIAS="No Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Energy Blast 11d6 (ED) (55 Active Points); No Range (-1/2)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 37);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 55);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 11);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 5);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "no range");
                    });
                });

                describe("standard -> range based on str", async function () {
                    const contents = `
                        <POWER XMLID="ENERGYBLAST" ID="1710647280084" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="RANGEBASEDONSTR" ID="1710647456693" BASECOST="-0.25" LEVELS="0" ALIAS="Range Based On Strength" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Energy Blast 1d6 (ED) (5 Active Points); Range Based On Strength (-1/4)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 4);
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

                    it("range", function () {
                        assert.equal(item.system.range, "range based on str");
                    });
                });

                describe("los", async function () {
                    const contents = `
                        <POWER XMLID="EGOATTACK" ID="1710649321261" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="8" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Ego Attack 1d6");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 10);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 10);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 1);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "los");
                    });
                });

                describe("los -> no range", async function () {
                    const contents = `
                        <POWER XMLID="EGOATTACK" ID="1710650241158" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="11" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="NORANGE" ID="1710650404865" BASECOST="-0.5" LEVELS="0" ALIAS="No Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Ego Attack 1d6 (10 Active Points); No Range (-1/2)");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 7);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 10);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 1);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "no range");
                    });
                });

                describe("los -> limited normal range", async function () {
                    const contents = `
                        <POWER XMLID="EGOATTACK" ID="1710649328008" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="NORMALRANGE" ID="1710649513411" BASECOST="-0.25" LEVELS="0" ALIAS="Normal Range" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "Ego Attack 1d6 (10 Active Points); Normal Range (-1/4)");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 8);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 10);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 1);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "standard");
                    });
                });

                describe("los -> range based on str", async function () {
                    const contents = `
                        <POWER XMLID="EGOATTACK" ID="1710649285989" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="RANGEBASEDONSTR" ID="1710649465842" BASECOST="-0.25" LEVELS="0" ALIAS="Range Based On Strength" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Ego Attack 1d6 (10 Active Points); Range Based On Strength (-1/4)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 8);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 10);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 1);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "range based on str");
                    });
                });

                describe("BOECV", async function () {
                    const contents = `
                        <POWER XMLID="DRAIN" ID="1710713242438" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="9" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="BOECV Drain" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="BOECV" ID="1710713433315" BASECOST="1.0" LEVELS="0" ALIAS="Based On EGO Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTAL" OPTIONID="MENTAL" OPTION_ALIAS="Mental Defense applies" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            temporary: true,
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(
                            item.system.description,
                            "Drain BODY 1d6, Based On EGO Combat Value (Mental Defense applies; +1)",
                        );
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 20);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 20);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 1);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 2);
                    });

                    it("range", function () {
                        assert.equal(item.system.range, "los");
                    });
                });
            });

            describe("SUSCEPTIBILITY", async function () {
                const contents = `
                    <DISAD XMLID="SUSCEPTIBILITY" ID="1709445759247" BASECOST="0.0" LEVELS="0" ALIAS="Susceptibility" POSITION="12" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                        <NOTES />
                        <ADDER XMLID="DICE" ID="1709447177129" BASECOST="0.0" LEVELS="0" ALIAS="Number of Dice" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1D6" OPTIONID="1D6" OPTION_ALIAS="1d6 damage" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="DAMAGE" ID="1709447177142" BASECOST="0.0" LEVELS="0" ALIAS="Take Damage Every" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="INSTANT" OPTIONID="INSTANT" OPTION_ALIAS="Instant" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="CONDITION" ID="1709447177148" BASECOST="5.0" LEVELS="0" ALIAS="Condition Is" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="UNCOMMON" OPTIONID="UNCOMMON" OPTION_ALIAS="(Uncommon" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                    </DISAD>
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "Susceptibility:  (1d6 damage; Instant; Uncommon)");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 5);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 5);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });
            });

            describe("CHANGEENVIRONMENT", async function () {
                const contents = `
                    <POWER XMLID="CHANGEENVIRONMENT" ID="1709333795869" BASECOST="0.0" LEVELS="0" ALIAS="Change Environment" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <ADDER XMLID="ALTERABLEORIGIN" ID="1711727581621" BASECOST="5.0" LEVELS="0" ALIAS="Alterable Origin Point" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="REDUCEDNEGATION" ID="1711727582769" BASECOST="0.0" LEVELS="1" ALIAS="Reduced Negation (1)" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="2.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="VARYINGCOMBATEFFECTS" ID="1711727583977" BASECOST="10.0" LEVELS="0" ALIAS="Varying Combat Effects" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="PERROLL" ID="1711727584820" BASECOST="0.0" LEVELS="1" ALIAS="-1 PER Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="HEARINGGROUP" OPTIONID="HEARINGGROUP" OPTION_ALIAS="Normal Hearing" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" LVLCOST="2.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="CHARORSKILLROLL" ID="1711727586863" BASECOST="0.0" LEVELS="1" ALIAS="-1 to Characteristic Roll or Skill Roll" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="MOVEMENT6E" ID="1711727588192" BASECOST="0.0" LEVELS="1" ALIAS="-1m of any mode of Movement" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="1.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="MOVEMENT" ID="1711727589448" BASECOST="0.0" LEVELS="1" ALIAS="-1 Wind Levels" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="MOVEMENTINCREASE" ID="1711727592167" BASECOST="0.0" LEVELS="1" ALIAS="+1 Wind Levels" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="TEMPERATURE" ID="1711727594479" BASECOST="0.0" LEVELS="1" ALIAS="-1 Temperature Level Adjustment" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="TEMPERATUREINCREASE" ID="1711727595589" BASECOST="0.0" LEVELS="1" ALIAS="+1 Temperature Level Adjustment" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="CHARANDSKILLROLL" ID="1711727596677" BASECOST="0.0" LEVELS="1" ALIAS="-1 Characteristic Roll and all Skill Rolls based on Characteristic" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="4.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="OCVDCV" ID="1711727599105" BASECOST="0.0" LEVELS="1" ALIAS="-1" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="RANGEMODIFIER" OPTIONID="RANGEMODIFIER" OPTION_ALIAS="Range Modifier" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="EGO" ID="1711727601026" BASECOST="0.0" LEVELS="1" ALIAS="-1 point of EGO" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="BREAKOUT" ID="1711727603898" BASECOST="0.0" LEVELS="1" ALIAS="-1 to Breakout Rolls" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="3.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="DAMAGE" ID="1711727606218" BASECOST="0.0" LEVELS="1" ALIAS="+1 Points of Damage" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="SUFFOCATION" ID="1711727607626" BASECOST="20.0" LEVELS="0" ALIAS="Suffocation" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="STUNNING" ID="1711727608484" BASECOST="30.0" LEVELS="0" ALIAS="Stunning" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="TKSTR" ID="1711727609552" BASECOST="0.0" LEVELS="1" ALIAS="+1 Points of Telekinetic STR" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" LVLCOST="5.0" LVLVAL="1.0" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="LONG" ID="1711727610739" BASECOST="2.0" LEVELS="0" ALIAS="Long-Lasting" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="1TURN" OPTIONID="1TURN" OPTION_ALIAS="1 Turn" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="Yes" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
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
                    actor.system.is5e = true;
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Change Environment (Alterable Origin Point; Reduced Negation (1); Varying Combat Effects; -1 PER Roll; -1 to Characteristic Roll or Skill Roll; -1m of any mode of Movement; -1 Wind Levels; +1 Wind Levels; -1 Temperature Level Adjustment; +1 Temperature Level Adjustment; -1 Characteristic Roll and all Skill Rolls based on Characteristic; -1; -1 point of EGO; -1 to Breakout Rolls; +1 Points of Damage; Suffocation; Stunning; +1 Points of Telekinetic STR; Long-Lasting)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 116);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 116);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 0);
                });

                it("end", function () {
                    assert.equal(item.system.end, 12);
                });
            });

            describe("MANEUVERs", async function () {
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
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(
                            {
                                ...HeroSystem6eItem.itemDataFromXml(contents, actor),
                                type: "martialart", // TODO: Kludge to make itemDataFromXml match the uploading code.
                            },
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "1/2 Phase, -2 OCV, +1 DCV, 6d6 Strike");
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

                describe("Martial Flash", async function () {
                    const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1706069203108" BASECOST="4.0" LEVELS="0" ALIAS="Martial Flash" POSITION="3" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="Hearing" CATEGORY="Hand To Hand" DISPLAY="Martial Flash" OCV="-1" DCV="-1" DC="4" PHASE="1/2" EFFECT="[FLASHDC]" ADDSTR="No" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[FLASHDC]">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(
                            {
                                ...HeroSystem6eItem.itemDataFromXml(contents, actor),
                                type: "martialart", // TODO: Kludge to make itemDataFromXml match the uploading code.
                            },
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "1/2 Phase, -1 OCV, -1 DCV, 4d6 (Hearing)");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 4);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 4);
                    });

                    it("dice", function () {
                        assert.equal(item.system.dice, 4);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 0);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });
                });

                describe("Martial Disarm", async function () {
                    const contents = `
                        <MANEUVER XMLID="MANEUVER" ID="1711775140729" BASECOST="4.0" LEVELS="0" ALIAS="Martial Disarm" POSITION="5" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Disarm" OCV="-1" DCV="+1" DC="2" PHASE="1/2" EFFECT="Disarm; [STRDC] to Disarm" ADDSTR="Yes" ACTIVECOST="5" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Disarm; [STRDC] to Disarm roll">
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
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = await new HeroSystem6eItem(
                            {
                                ...HeroSystem6eItem.itemDataFromXml(contents, actor),
                                type: "martialart", // TODO: Kludge to make itemDataFromXml match the uploading code.
                            },
                            { temporary: true, parent: actor },
                        );
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("description", function () {
                        assert.equal(item.system.description, "1/2 Phase, -1 OCV, +1 DCV, Disarm; 20 STR to Disarm");
                    });

                    it("realCost", function () {
                        assert.equal(item.system.realCost, 4);
                    });

                    it("activePoints", function () {
                        assert.equal(item.system.activePoints, 4);
                    });

                    it("dice", function () {
                        assert.equal(item.system.dice, 2);
                    });

                    it("levels", function () {
                        assert.equal(item.system.value, 0);
                    });

                    it("end", function () {
                        assert.equal(item.system.end, 0);
                    });
                });
            });

            describe("Nerve Strike", async function () {
                const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1717892734727" BASECOST="4.0" LEVELS="0" ALIAS="Nerve Strike" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Nerve Strike" OCV="-1" DCV="+1" DC="4" PHASE="1/2" EFFECT="[NNDDC]" ADDSTR="No" ACTIVECOST="15" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[NNDDC]">
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
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(
                        {
                            ...HeroSystem6eItem.itemDataFromXml(contents, actor),
                            type: "martialart", // TODO: Kludge to make itemDataFromXml match the uploading code.
                        },
                        { temporary: true, parent: actor },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "1/2 Phase, -1 OCV, +1 DCV, 2d6 NND");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 4);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 4);
                });

                it("dice", function () {
                    assert.equal(item.system.dice, 2); // There are 4 raw dice, STR is added later
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });
            });

            describe("FINDWEAKNESS (5e)", async function () {
                const contents = `
                    <POWER XMLID="FINDWEAKNESS" ID="1698998161256" BASECOST="20.0" LEVELS="1" ALIAS="Find Weakness" POSITION="5" MULTIPLIER="1.0" GRAPHIC="block" COLOR="0 255 0" SFX="Luck" SHOW_ACTIVE_COST="Yes" OPTION="RELATEDGROUP" OPTIONID="RELATEDGROUP" OPTION_ALIAS="Related Group of Attacks" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Weakness Location with Martial Arts" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
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
                    actor.system.is5e = true;
                    await actor._postUpload();

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(item.system.description, "Find Weakness 12- with Related Group of Attacks");
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 25);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 25);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 1);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });

                it("roll", function () {
                    assert.equal(item.system.roll, "12-");
                });
            });

            describe("DANGER_SENSE (5e)", async function () {
                const itemDataPerception = {
                    name: "Perception",
                    type: "skill",
                    system: {
                        XMLID: "PERCEPTION",
                        ALIAS: "Perception",
                        CHARACTERISTIC: "INT",
                        state: "trained",
                        levels: "0",
                    },
                };
                const contents = `
                    <TALENT XMLID="DANGER_SENSE" ID="1698995887314" BASECOST="15.0" LEVELS="8" ALIAS="Danger Sense" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="">
                        <NOTES />
                        <ADDER XMLID="SENSE" ID="1705805754733" BASECOST="2.0" LEVELS="0" ALIAS="Function as a Sense" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="Yes" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="SENSITIVITY" ID="1705805754738" BASECOST="5.0" LEVELS="0" ALIAS="Sensitivity" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="OUT_OF_COMBAT" OPTIONID="OUT_OF_COMBAT" OPTION_ALIAS="out of combat" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                        <ADDER XMLID="AREA" ID="1705805754744" BASECOST="5.0" LEVELS="0" ALIAS="Area" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="IMMEDIATE_VICINITY" OPTIONID="IMMEDIATE_VICINITY" OPTION_ALIAS="immediate vicinity" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="No" INCLUDEINBASE="No" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
                            <NOTES />
                        </ADDER>
                    </TALENT>
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
                    actor.system.characteristics.int.value = 15;
                    await actor._postUpload();

                    const perceptionItem = await new HeroSystem6eItem(itemDataPerception, {
                        temporary: true,
                        parent: actor,
                    });
                    await perceptionItem._postUpload();
                    actor.items.set(perceptionItem.system.XMLID, perceptionItem);

                    item = await new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        temporary: true,
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("description", function () {
                    assert.equal(
                        item.system.description,
                        "Danger Sense 20- (Function as a Sense; out of combat; immediate vicinity)",
                    );
                });

                it("realCost", function () {
                    assert.equal(item.system.realCost, 35);
                });

                it("activePoints", function () {
                    assert.equal(item.system.activePoints, 35);
                });

                it("levels", function () {
                    assert.equal(item.system.value, 8);
                });

                it("end", function () {
                    assert.equal(item.system.end, 0);
                });

                it("roll", function () {
                    assert.equal(item.system.roll, "20-"); // Perception (12-) + 8 levels = 20-
                });
            });
        },
        { displayName: "HERO: Upload" },
    );
}
