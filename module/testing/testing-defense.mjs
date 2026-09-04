import { createQuenchActor, deleteQuenchActor, setQuenchTimeout } from "./quench-helper.mjs";

import { HeroSystem6eActor } from "../actor/actor.mjs";
import { performAdjustment } from "../actor/actor-adjustment.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { getActorDefensesVsAttack } from "../utility/defense.mjs";

export function registerDefenseTests(quench) {
    quench.registerBatch(
        `${game.system.id}.utils.defense`,
        (context) => {
            const { afterEach, assert, before, beforeEach, describe, it } = context;

            describe("Defense Tests", function () {
                // The default timeout tends to be insufficient with multiple actors being created at the same time.
                setQuenchTimeout(this);

                describe("Resistant Protection", function () {
                    let actor;
                    beforeEach(async function () {
                        actor = await createQuenchActor({ quench: this, is5e: true });
                    });

                    afterEach(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    it("rPD 1", async function () {
                        const contents = `
                        <POWER XMLID="FORCEFIELD" ID="1686527339658" BASECOST="0.0" LEVELS="10" ALIAS="Resistant Protection" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="2" MDLEVELS="3" POWDLEVELS="4">
                        <NOTES />
                        </POWER>
                    `;

                        const contentsAttack = `
                        <POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="PD" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        </POWER>
                    `;

                        await HeroSystem6eItem.create(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            parent: actor,
                        });

                        const itemAttack = new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contentsAttack, actor),
                            {
                                parent: actor,
                            },
                        );

                        const defense = getActorDefensesVsAttack(actor, itemAttack);
                        assert.equal(defense.resistantValue, 1);
                    });

                    it("rED 2", async function () {
                        const contents = `
                        <POWER XMLID="FORCEFIELD" ID="1686527339658" BASECOST="0.0" LEVELS="10" ALIAS="Resistant Protection" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="2" MDLEVELS="3" POWDLEVELS="4">
                        <NOTES />
                        </POWER>
                    `;

                        const contentsAttack = `
                        <POWER XMLID="ENERGYBLAST" ID="1695402954902" BASECOST="0.0" LEVELS="1" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        </POWER>
                    `;
                        const itemDefense = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            parent: actor,
                        });
                        actor.items.set(itemDefense.system.XMLID, itemDefense);

                        const itemAttack = new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contentsAttack, actor),
                            {
                                parent: actor,
                            },
                        );

                        const defense = getActorDefensesVsAttack(actor, itemAttack);
                        assert.equal(defense.resistantValue, 2);
                    });

                    it("rMD 3", async function () {
                        const contents = `
                        <POWER XMLID="FORCEFIELD" ID="1686527339658" BASECOST="0.0" LEVELS="10" ALIAS="Resistant Protection" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="2" MDLEVELS="3" POWDLEVELS="4">
                        <NOTES />
                        </POWER>
                    `;

                        const contentsAttack = `
                        <POWER XMLID="EGOATTACK" ID="1695575160315" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                        </POWER>
                    `;

                        const itemDefense = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            parent: actor,
                        });
                        actor.items.set(itemDefense.system.XMLID, itemDefense);

                        const itemAttack = new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contentsAttack, actor),
                            {
                                parent: actor,
                            },
                        );

                        const defense = getActorDefensesVsAttack(actor, itemAttack);
                        assert.equal(defense.resistantValue, 3);
                    });

                    it("Power Defense 4", async function () {
                        const contents = `
                    <POWER XMLID="FORCEFIELD" ID="1686527339658" BASECOST="0.0" LEVELS="10" ALIAS="Resistant Protection" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="1" EDLEVELS="2" MDLEVELS="3" POWDLEVELS="4">
                    <NOTES />
                    </POWER>
                `;

                        const contentsAttack = `
                    <POWER XMLID="DRAIN" ID="1695576093210" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                    <NOTES />
                    </POWER>
                `;

                        const itemDefense = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            parent: actor,
                        });
                        actor.items.set(itemDefense.system.XMLID, itemDefense);

                        const itemAttack = new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(contentsAttack, actor),
                            {
                                parent: actor,
                            },
                        );

                        const defense = getActorDefensesVsAttack(actor, itemAttack);
                        assert.equal(defense.resistantValue, 4);
                    });
                });

                // See bug #4581. Drained ED must never contribute negative "normal" defense
                // (5ER p. 39, 6E1 p. 135: a characteristic in the negatives functions as 0), and
                // DAMAGERESISTANCE only converts defense that currently exists (5ER p. 146), so a
                // drain has to come out of the converted resistant pool rather than surviving as a
                // separate negative tag or vanishing entirely once ED reaches 0.
                describe("Drained ED vs resistant defenses (#4581)", function () {
                    let actor;

                    const damageResistanceXml = `
                        <POWER XMLID="DAMAGERESISTANCE" ID="1753900000001" BASECOST="0.0" LEVELS="0" ALIAS="Damage Resistance" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="30" MDLEVELS="0" FDLEVELS="0" POWDLEVELS="0">
                            <NOTES />
                        </POWER>
                    `;

                    const forceFieldXml = `
                        <POWER XMLID="FORCEFIELD" ID="1753900000002" BASECOST="0.0" LEVELS="30" ALIAS="Force Field" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes" PDLEVELS="0" EDLEVELS="30" MDLEVELS="0" POWDLEVELS="0">
                            <NOTES />
                        </POWER>
                    `;

                    const edAttackXml = `
                        <POWER XMLID="ENERGYBLAST" ID="1753900000003" BASECOST="0.0" LEVELS="10" ALIAS="Blast" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                        </POWER>
                    `;

                    beforeEach(async function () {
                        actor = await createQuenchActor({ quench: this, is5e: true });
                    });

                    afterEach(async function () {
                        await deleteQuenchActor({ quench: this, actor });
                    });

                    async function addItem(xml) {
                        return HeroSystem6eItem.create(HeroSystem6eItem.itemDataFromXml(xml, actor), {
                            parent: actor,
                        });
                    }

                    function edAttackItem() {
                        return new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(edAttackXml, actor), {
                            parent: actor,
                        });
                    }

                    // ED costs 1 CP per point and is a defensive characteristic, so the adjustment
                    // is halved (5ER p. 110): 2 AP of DRAIN removes 1 point of ED.
                    async function drainEd(points) {
                        const drainXml = `
                            <POWER XMLID="DRAIN" ID="1753900000004" BASECOST="0.0" LEVELS="6" ALIAS="Drain" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                            </POWER>
                        `;
                        const drainItem = await addItem(drainXml);
                        await performAdjustment(drainItem, "ED", -points * 2, "", "", false, actor, null);
                    }

                    describe("DAMAGERESISTANCE converts the (drained) ED characteristic", function () {
                        beforeEach(async function () {
                            // Mechanon-style build: ED 30, all of it converted by Damage Resistance.
                            await actor.update({ system: { ED: { LEVELS: 28 } } });
                            await addItem(damageResistanceXml);
                        });

                        it("undrained: all 30 ED is resistant", async function () {
                            assert.equal(actor.system.characteristics.ed.value, 30);

                            const defense = getActorDefensesVsAttack(actor, edAttackItem());
                            assert.equal(defense.resistantValue, 30);
                            assert.equal(defense.defenseValue, 0);
                            assert.equal(defense.defenseTotalValue, 30);
                        });

                        it("drained by 4: 26 resistant, no negative normal defense", async function () {
                            await drainEd(4);
                            assert.equal(actor.system.characteristics.ed.value, 26);

                            const defense = getActorDefensesVsAttack(actor, edAttackItem());
                            assert.equal(
                                defense.defenseValue,
                                0,
                                "Drain must reduce the converted pool, not linger as negative normal defense (5ER p. 39).",
                            );
                            assert.equal(
                                defense.resistantValue,
                                26,
                                "Damage Resistance only converts the ED the character still has (5ER p. 146).",
                            );
                            assert.equal(defense.defenseTotalValue, 26);
                        });

                        it("drained by 29: 1 resistant", async function () {
                            await drainEd(29);
                            assert.equal(actor.system.characteristics.ed.value, 1);

                            const defense = getActorDefensesVsAttack(actor, edAttackItem());
                            assert.equal(defense.defenseValue, 0);
                            assert.equal(defense.resistantValue, 1);
                            assert.equal(defense.defenseTotalValue, 1);
                        });

                        it("drained by 30: no defense remains", async function () {
                            await drainEd(30);
                            assert.isAtMost(actor.system.characteristics.ed.value, 0);

                            const defense = getActorDefensesVsAttack(actor, edAttackItem());
                            assert.equal(
                                defense.defenseTotalValue,
                                0,
                                "A fully drained ED leaves Damage Resistance nothing to convert; defense must not snap back to full.",
                            );
                        });

                        it("drained by 40: overdrain still leaves 0, not full defense", async function () {
                            await drainEd(40);
                            assert.isAtMost(actor.system.characteristics.ed.value, 0);

                            const defense = getActorDefensesVsAttack(actor, edAttackItem());
                            assert.equal(
                                defense.defenseTotalValue,
                                0,
                                "ED drained into the negatives functions as 0 (6E1 p. 135) — never as a damage bonus.",
                            );
                        });
                    });

                    describe("independent resistant power is insulated from Drain ED", function () {
                        beforeEach(async function () {
                            // Natural ED 2 (base) plus a separate 30 rED power. Drain ED touches
                            // only the characteristic (6E1 p. 197), never the power's levels.
                            await addItem(forceFieldXml);
                        });

                        it("drained by 1: remaining natural ED stacks with the power", async function () {
                            await drainEd(1);
                            assert.equal(actor.system.characteristics.ed.value, 1);

                            const defense = getActorDefensesVsAttack(actor, edAttackItem());
                            assert.equal(defense.defenseValue, 1);
                            assert.equal(defense.resistantValue, 30);
                            assert.equal(defense.defenseTotalValue, 31);
                        });

                        it("drained by 4: natural ED clamps at 0, the power is untouched", async function () {
                            await drainEd(4);
                            assert.isAtMost(actor.system.characteristics.ed.value, 0);

                            const defense = getActorDefensesVsAttack(actor, edAttackItem());
                            assert.equal(
                                defense.defenseValue,
                                0,
                                "An overdrained natural ED functions as 0 (5ER p. 39), it must not eat into the resistant power.",
                            );
                            assert.equal(defense.resistantValue, 30);
                            assert.equal(defense.defenseTotalValue, 30);
                        });
                    });
                });

                // See bug #3465
                describe("ACV (Alternative Combat Value)", function () {
                    describe("For Non-Mental Powers", function () {
                        describe("OMCV vs DCV", function () {
                            const contents = `
                            <POWER XMLID="DRAIN" ID="1767547901794" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="99" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Drain - OMCV vs DCV" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="ACV" ID="1767548044029" BASECOST="0.0" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NONMENTALOMCV" OPTIONID="NONMENTALOMCV" OPTION_ALIAS="uses OMCV against DCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                        `;
                            let item;

                            before(async function () {
                                const actor = new HeroSystem6eActor(
                                    {
                                        name: "Quench Actor",
                                        type: "pc",
                                    },
                                    {},
                                );
                                actor.system.is5e = false;

                                item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                    parent: actor,
                                });

                                actor.items.set(item.system.XMLID, item);
                            });

                            it("description", function () {
                                assert.equal(
                                    item.system.description,
                                    "Drain BODY 1d6, Alternate Combat Value (uses OMCV against DCV; +0)",
                                );
                            });

                            it("character point cost", function () {
                                assert.equal(item.characterPointCost, 10);
                            });

                            it("realCost", function () {
                                assert.equal(item.realCost, 10);
                            });

                            it("activePoints", function () {
                                assert.equal(item.activePoints, 10);
                            });

                            it("end", function () {
                                assert.equal(item.end, 1);
                            });

                            it("should attack with", function () {
                                assert.equal(item.system.attacksWith, "omcv");
                            });

                            it("should defend with", function () {
                                assert.equal(item.system.defendsWith, "dcv");
                            });
                        });

                        describe("OCV vs DMCV", function () {
                            const contents = `
                            <POWER XMLID="DRAIN" ID="1767547930340" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="100" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Drain - OCV vs DMCV" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="ACV" ID="1767548176982" BASECOST="0.25" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NONMENTALDMCV" OPTIONID="NONMENTALDMCV" OPTION_ALIAS="uses OCV against DMCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                        `;
                            let item;

                            before(async function () {
                                const actor = new HeroSystem6eActor(
                                    {
                                        name: "Quench Actor",
                                        type: "pc",
                                    },
                                    {},
                                );
                                actor.system.is5e = false;

                                item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                    parent: actor,
                                });

                                actor.items.set(item.system.XMLID, item);
                            });

                            it("description", function () {
                                assert.equal(
                                    item.system.description,
                                    "Drain BODY 1d6, Alternate Combat Value (uses OCV against DMCV; +1/4)",
                                );
                            });

                            it("character point cost", function () {
                                assert.equal(item.characterPointCost, 12);
                            });

                            it("realCost", function () {
                                assert.equal(item.realCost, 12);
                            });

                            it("activePoints", function () {
                                assert.equal(item.activePoints, 12);
                            });

                            it("end", function () {
                                assert.equal(item.end, 1);
                            });

                            it("should attack with", function () {
                                assert.equal(item.system.attacksWith, "ocv");
                            });

                            it("should defend with", function () {
                                assert.equal(item.system.defendsWith, "dmcv");
                            });
                        });

                        describe("OMCV vs DMCV", function () {
                            const contents = `
                            <POWER XMLID="DRAIN" ID="1767547947321" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="101" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Drain - OMCV vs DMCV" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="ACV" ID="1767548157081" BASECOST="0.25" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="NONMENTALOMCVDMCV" OPTIONID="NONMENTALOMCVDMCV" OPTION_ALIAS="uses OMCV against DMCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                        `;
                            let item;

                            before(async function () {
                                const actor = new HeroSystem6eActor(
                                    {
                                        name: "Quench Actor",
                                        type: "pc",
                                    },
                                    {},
                                );
                                actor.system.is5e = false;

                                item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                    parent: actor,
                                });

                                actor.items.set(item.system.XMLID, item);
                            });

                            it("description", function () {
                                assert.equal(
                                    item.system.description,
                                    "Drain BODY 1d6, Alternate Combat Value (uses OMCV against DMCV; +1/4)",
                                );
                            });

                            it("character point cost", function () {
                                assert.equal(item.characterPointCost, 12);
                            });

                            it("realCost", function () {
                                assert.equal(item.realCost, 12);
                            });

                            it("activePoints", function () {
                                assert.equal(item.activePoints, 12);
                            });

                            it("end", function () {
                                assert.equal(item.end, 1);
                            });

                            it("should attack with", function () {
                                assert.equal(item.system.attacksWith, "omcv");
                            });

                            it("should defend with", function () {
                                assert.equal(item.system.defendsWith, "dmcv");
                            });
                        });
                    });

                    describe("For Mental Powers", function () {
                        describe("OCV vs DMCV", function () {
                            const contents = `
                            <POWER XMLID="EGOATTACK" ID="1767548201451" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="102" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="MB - OCV vs DMCV" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="ACV" ID="1767548369883" BASECOST="0.25" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTALOCV" OPTIONID="MENTALOCV" OPTION_ALIAS="uses OCV against DMCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                        `;
                            let item;

                            before(async function () {
                                const actor = new HeroSystem6eActor(
                                    {
                                        name: "Quench Actor",
                                        type: "pc",
                                    },
                                    {},
                                );
                                actor.system.is5e = false;

                                item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                    parent: actor,
                                });

                                actor.items.set(item.system.XMLID, item);
                            });

                            it("description", function () {
                                assert.equal(
                                    item.system.description,
                                    "Mental Blast 1d6, Alternate Combat Value (uses OCV against DMCV; +1/4)",
                                );
                            });

                            it("character point cost", function () {
                                assert.equal(item.characterPointCost, 12);
                            });

                            it("realCost", function () {
                                assert.equal(item.realCost, 12);
                            });

                            it("activePoints", function () {
                                assert.equal(item.activePoints, 12);
                            });

                            it("end", function () {
                                assert.equal(item.end, 1);
                            });

                            it("should attack with", function () {
                                assert.equal(item.system.attacksWith, "ocv");
                            });

                            it("should defend with", function () {
                                assert.equal(item.system.defendsWith, "dmcv");
                            });
                        });

                        describe("OMCV vs DCV", function () {
                            const contents = `
                            <POWER XMLID="EGOATTACK" ID="1767548399500" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="103" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="MB - OMCV vs DCV" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="ACV" ID="1767548410604" BASECOST="-0.25" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTALDCV" OPTIONID="MENTALDCV" OPTION_ALIAS="uses OMCV against DCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                        `;
                            let item;

                            before(async function () {
                                const actor = new HeroSystem6eActor(
                                    {
                                        name: "Quench Actor",
                                        type: "pc",
                                    },
                                    {},
                                );
                                actor.system.is5e = false;

                                item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                    parent: actor,
                                });

                                actor.items.set(item.system.XMLID, item);
                            });

                            it("description", function () {
                                assert.equal(
                                    item.system.description,
                                    "Mental Blast 1d6 (10 Active Points); Alternate Combat Value (uses OMCV against DCV; -1/4)",
                                );
                            });

                            it("character point cost", function () {
                                assert.equal(item.characterPointCost, 8);
                            });

                            it("realCost", function () {
                                assert.equal(item.realCost, 8);
                            });

                            it("activePoints", function () {
                                assert.equal(item.activePoints, 10);
                            });

                            it("end", function () {
                                assert.equal(item.end, 1);
                            });

                            it("should attack with", function () {
                                assert.equal(item.system.attacksWith, "omcv");
                            });

                            it("should defend with", function () {
                                assert.equal(item.system.defendsWith, "dcv");
                            });
                        });

                        describe("OCV vs DCV", function () {
                            const contents = `
                            <POWER XMLID="EGOATTACK" ID="1767548405387" BASECOST="0.0" LEVELS="1" ALIAS="Mental Blast" POSITION="104" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="MB - OCV vs DCV" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                                <NOTES />
                                <MODIFIER XMLID="ACV" ID="1767548427865" BASECOST="0.0" LEVELS="0" ALIAS="Alternate Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTALOCVDCV" OPTIONID="MENTALOCVDCV" OPTION_ALIAS="uses OCV against DCV" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                    <NOTES />
                                </MODIFIER>
                            </POWER>
                        `;
                            let item;

                            before(async function () {
                                const actor = new HeroSystem6eActor(
                                    {
                                        name: "Quench Actor",
                                        type: "pc",
                                    },
                                    {},
                                );
                                actor.system.is5e = false;

                                item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                    parent: actor,
                                });

                                actor.items.set(item.system.XMLID, item);
                            });

                            it("description", function () {
                                assert.equal(
                                    item.system.description,
                                    "Mental Blast 1d6, Alternate Combat Value (uses OCV against DCV; +0)",
                                );
                            });

                            it("character point cost", function () {
                                assert.equal(item.characterPointCost, 10);
                            });

                            it("realCost", function () {
                                assert.equal(item.realCost, 10);
                            });

                            it("activePoints", function () {
                                assert.equal(item.activePoints, 10);
                            });

                            it("end", function () {
                                assert.equal(item.end, 1);
                            });

                            it("should attack with", function () {
                                assert.equal(item.system.attacksWith, "ocv");
                            });

                            it("should defend with", function () {
                                assert.equal(item.system.defendsWith, "dcv");
                            });
                        });
                    });
                });

                describe("BOECV (Based on EGO Combat Value", function () {
                    describe("OMCV vs DMCV", function () {
                        const contents = `
                        <POWER XMLID="DRAIN" ID="1767549550225" BASECOST="0.0" LEVELS="1" ALIAS="Drain" POSITION="163" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Mental Drain - OMCV vs DMCV" INPUT="BODY" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="BOECV" ID="1767549766137" BASECOST="1.0" LEVELS="0" ALIAS="Based On EGO Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTAL" OPTIONID="MENTAL" OPTION_ALIAS="Mental Defense applies" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                        </POWER>
                    `;
                        let item;

                        before(async function () {
                            const actor = new HeroSystem6eActor(
                                {
                                    name: "Quench Actor",
                                    type: "pc",
                                },
                                {},
                            );
                            actor.system.is5e = true;

                            item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                parent: actor,
                            });

                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                "Drain BODY 1d6, Based On EGO Combat Value (Mental Defense applies; +1)",
                            );
                        });

                        it("character point cost", function () {
                            assert.equal(item.characterPointCost, 20);
                        });

                        it("realCost", function () {
                            assert.equal(item.realCost, 20);
                        });

                        it("activePoints", function () {
                            assert.equal(item.activePoints, 20);
                        });

                        it("end", function () {
                            assert.equal(item.end, 2);
                        });

                        it("should attack with", function () {
                            assert.equal(item.system.attacksWith, "omcv");
                        });

                        it("should defend with", function () {
                            assert.equal(item.system.defendsWith, "dmcv");
                        });
                    });

                    describe("OMCV vs DCV (Telekinesis exception)", function () {
                        const contents = `
                        <POWER XMLID="TELEKINESIS" ID="1767554249144" BASECOST="0.0" LEVELS="20" ALIAS="Telekinesis" POSITION="166" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                            <MODIFIER XMLID="BOECV" ID="1767554606427" BASECOST="1.0" LEVELS="0" ALIAS="Based On EGO Combat Value" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MENTAL" OPTIONID="MENTAL" OPTION_ALIAS="Mental Defense applies" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" COMMENTS="" PRIVATE="No" FORCEALLOW="No">
                                <NOTES />
                            </MODIFIER>
                        </POWER>
                    `;
                        let item;

                        before(async function () {
                            const actor = new HeroSystem6eActor(
                                {
                                    name: "Quench Actor",
                                    type: "pc",
                                },
                                {},
                            );
                            actor.system.is5e = true;

                            item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                                parent: actor,
                            });

                            actor.items.set(item.system.XMLID, item);
                        });

                        it("description", function () {
                            assert.equal(
                                item.system.description,
                                'Telekinesis (20 STR) Throw 16", Based On EGO Combat Value (Mental Defense applies; +1)',
                            );
                        });

                        it("character point cost", function () {
                            assert.equal(item.characterPointCost, 60);
                        });

                        it("realCost", function () {
                            assert.equal(item.realCost, 60);
                        });

                        it("activePoints", function () {
                            assert.equal(item.activePoints, 60);
                        });

                        it("end", function () {
                            assert.equal(item.end, 6);
                        });

                        it("should attack with", function () {
                            assert.equal(item.system.attacksWith, "omcv");
                        });

                        it("should defend with", function () {
                            assert.equal(item.system.defendsWith, "dcv");
                        });
                    });
                });
            });
        },
        { displayName: "HERO: Defense" },
    );
}
