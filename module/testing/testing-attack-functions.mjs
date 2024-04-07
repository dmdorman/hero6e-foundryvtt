import { HeroSystem6eActor } from "../actor/actor.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { convertToDcFromItem } from "../utility/damage.mjs";
import { determineDefense } from "../utility/defense.mjs";
import { HeroSystem6eActorActiveEffects } from "../actor/actor-active-effects.mjs";

export function registerAttackFunctionTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.attackFunctions",
        (context) => {
            const { assert, describe, it } = context;

            const actor = new HeroSystem6eActor({
                name: "Test Actor",
                type: "pc",
            });
            describe("AttackOptions", function () {
                it("Attacker Can Act", async function () {
                    assert.equal(actor.canAct(false), true);
                    actor.statuses.add(
                        HeroSystem6eActorActiveEffects.stunEffect.id,
                    );
                    assert.equal(actor.canAct(false), false);

                    actor.statuses.clear();
                    assert.equal(actor.canAct(false), true);
                    actor.statuses.add(
                        HeroSystem6eActorActiveEffects.knockedOutEffect.id,
                    );
                    assert.equal(actor.canAct(false), false);

                    actor.statuses.clear();
                    assert.equal(actor.canAct(false), true);
                    actor.statuses.add(
                        HeroSystem6eActorActiveEffects.deadEffect.id,
                    );
                    assert.equal(actor.canAct(false), false);

                    actor.statuses.clear();
                    assert.equal(actor.canAct(false), true);
                    actor.statuses.add(
                        HeroSystem6eActorActiveEffects.abortEffect.id,
                    );
                    assert.equal(actor.canAct(false), false);
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
                    const itemDefense = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents, actor),
                        { temporary: true, parent: actor },
                    );
                    await itemDefense._postUpload();
                    actor.items.set(itemDefense.system.XMLID, itemDefense);

                    const itemAttack = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contentsAttack, actor),
                        { temporary: true, parent: actor },
                    );
                    await itemAttack._postUpload();

                    const defense = determineDefense(actor, itemAttack);
                    assert.equal(defense[1], 2);
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
                    const itemDefense = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents, actor),
                        { temporary: true, parent: actor },
                    );
                    await itemDefense._postUpload();
                    actor.items.set(itemDefense.system.XMLID, itemDefense);

                    const itemAttack = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contentsAttack, actor),
                        { temporary: true, parent: actor },
                    );
                    await itemAttack._postUpload();

                    const defense = determineDefense(actor, itemAttack);
                    assert.equal(defense[1], 3);
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
                    const itemDefense = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contents, actor),
                        { temporary: true, parent: actor },
                    );
                    await itemDefense._postUpload();
                    actor.items.set(itemDefense.system.XMLID, itemDefense);

                    const itemAttack = await new HeroSystem6eItem(
                        HeroSystem6eItem.itemDataFromXml(contentsAttack, actor),
                        { temporary: true, parent: actor },
                    );

                    await itemAttack._postUpload();

                    const defense = determineDefense(actor, itemAttack);
                    assert.equal(defense[1], 4);
                });
            });

            describe("performAction", function () {
                const item = new HeroSystem6eItem({
                    name: "Test",
                    type: "attack",
                    system: {
                        dice: 1,
                        extraDice: "pip",
                        killing: true,
                    },
                    parent: actor,
                });

                const item_nk = new HeroSystem6eItem({
                    name: "Test",
                    type: "attack",
                    system: {
                        dice: 1,
                        extraDice: "pip",
                        killing: false,
                    },
                    parent: actor,
                });

                //return { dc: dc, tags: tags, end: end };

                it("Killing dc", function () {
                    assert.equal(convertToDcFromItem(item).dc, 4);
                });

                it("normal", function () {
                    assert.equal(convertToDcFromItem(item_nk).dc, 1.2);
                });
            });
        },
        { displayName: "HERO: Attack Functions" },
    );
}
