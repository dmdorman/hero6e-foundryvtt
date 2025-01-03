import { HEROSYS } from "../herosystem6e.mjs";
import { HeroSystem6eActor } from "../actor/actor.mjs";
import { HeroSystem6eItem } from "../item/item.mjs";
import { calculateDicePartsFromDcForItem, addDiceParts } from "../utility/damage.mjs";

export function registerDamageFunctionTests(quench) {
    quench.registerBatch(
        "hero6efoundryvttv2.damageFunctions",
        (context) => {
            const { after, assert, before, describe, it } = context;

            describe("dice parts", function () {
                const rkaContent = `
                    <POWER XMLID="RKA" ID="1735146922179" BASECOST="0.0" LEVELS="1" ALIAS="Killing Attack - Ranged" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="1d6 15AP/die power" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                    </POWER>
                `;
                let rkaItem;

                before(async () => {
                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        {},
                    );
                    actor.system.is5e = true;
                    await actor._postUpload();

                    rkaItem = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(rkaContent, actor), {
                        parent: actor,
                    });
                    await rkaItem._postUpload();
                    actor.items.set(rkaItem.system.XMLID, rkaItem);
                });

                const emptyFormulaParts = Object.freeze({
                    dc: 0,
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: 0,
                });

                describe("adding empty to others", function () {
                    it("should add empty to empty", function () {
                        const sum = addDiceParts(rkaItem, emptyFormulaParts, emptyFormulaParts, false);
                        assert.deepEqual(sum, emptyFormulaParts);
                    });

                    it("should add empty to constant", function () {
                        const constantOnly = Object.freeze({
                            dc: 1,
                            d6Count: 0,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 1,
                        });
                        const sum = addDiceParts(rkaItem, emptyFormulaParts, constantOnly, false);
                        assert.deepEqual(sum, constantOnly);
                    });

                    it("should add empty to halfDieCount", function () {
                        const halfDieOnly = Object.freeze({
                            dc: 2,
                            d6Count: 0,
                            d6Less1DieCount: 0,
                            halfDieCount: 1,
                            constant: 0,
                        });
                        const sum = addDiceParts(rkaItem, emptyFormulaParts, halfDieOnly, false);
                        assert.deepEqual(sum, halfDieOnly);
                    });

                    it("should not add empty to halfDieCount if using d6-1 mode", function () {
                        const halfDieOnly = Object.freeze({
                            dc: 2,
                            d6Count: 0,
                            d6Less1DieCount: 0,
                            halfDieCount: 1,
                            constant: 0,
                        });
                        const sum = addDiceParts(rkaItem, emptyFormulaParts, halfDieOnly, true);
                        assert.notDeepEqual(sum, halfDieOnly);
                    });

                    it("should add empty to d6Less1DieCount", function () {
                        const dieMinusOneOnly = Object.freeze({
                            dc: 2,
                            d6Count: 0,
                            d6Less1DieCount: 1,
                            halfDieCount: 0,
                            constant: 0,
                        });
                        const sum = addDiceParts(rkaItem, emptyFormulaParts, dieMinusOneOnly, true);
                        assert.deepEqual(sum, dieMinusOneOnly);
                    });

                    it("should add empty to full dice", function () {
                        const fullDiceOnly = Object.freeze({
                            dc: 3,
                            d6Count: 1,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        });
                        const sum = addDiceParts(rkaItem, emptyFormulaParts, fullDiceOnly, false);
                        assert.deepEqual(sum, fullDiceOnly);
                    });
                });

                describe("add two parts", function () {
                    it("should add constants with carry", function () {
                        const first = {
                            dc: 1,
                            d6Count: 0,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 1,
                        };
                        const second = {
                            dc: 1,
                            d6Count: 0,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 1,
                        };
                        const result = {
                            dc: 2,
                            d6Count: 0,
                            d6Less1DieCount: 0,
                            halfDieCount: 1,
                            constant: 0,
                        };
                        const sum = addDiceParts(rkaItem, first, second, false);
                        assert.deepEqual(sum, result);
                    });

                    it("should add halfDieCount with carry", function () {
                        const first = {
                            dc: 2,
                            d6Count: 0,
                            d6Less1DieCount: 0,
                            halfDieCount: 1,
                            constant: 0,
                        };
                        const second = {
                            dc: 2,
                            d6Count: 0,
                            d6Less1DieCount: 0,
                            halfDieCount: 1,
                            constant: 0,
                        };
                        const result = {
                            dc: 4,
                            d6Count: 1,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 1,
                        };
                        const sum = addDiceParts(rkaItem, first, second, false);
                        assert.deepEqual(sum, result);
                    });

                    it("should add d6Less1DieCount with carry", function () {
                        const first = {
                            dc: 2,
                            d6Count: 0,
                            d6Less1DieCount: 1,
                            halfDieCount: 0,
                            constant: 0,
                        };
                        const second = {
                            dc: 2,
                            d6Count: 0,
                            d6Less1DieCount: 1,
                            halfDieCount: 0,
                            constant: 0,
                        };
                        const result = {
                            dc: 4,
                            d6Count: 1,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 1,
                        };
                        const sum = addDiceParts(rkaItem, first, second, true);
                        assert.deepEqual(sum, result);
                    });

                    it("should add d6Count", function () {
                        const first = {
                            dc: 6,
                            d6Count: 2,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        };
                        const second = {
                            dc: 18,
                            d6Count: 6,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        };
                        const result = {
                            dc: 24,
                            d6Count: 8,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        };
                        const sum = addDiceParts(rkaItem, first, second, false);
                        assert.deepEqual(sum, result);
                    });

                    it("should add d6Count with carry", function () {
                        const first = {
                            dc: 13,
                            d6Count: 4,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 1,
                        };
                        const second = {
                            dc: 8,
                            d6Count: 2,
                            d6Less1DieCount: 0,
                            halfDieCount: 1,
                            constant: 0,
                        };
                        const result = {
                            dc: 21,
                            d6Count: 7,
                            d6Less1DieCount: 0,
                            halfDieCount: 0,
                            constant: 0,
                        };
                        const sum = addDiceParts(rkaItem, first, second, false);
                        assert.deepEqual(sum, result);
                    });
                });
            });

            // Reproduce some parts of the table on 6e vol 2 pg. 97 for testing
            describe("calculateDiceFormulaParts", function () {
                function filterDc(diceParts) {
                    return {
                        d6Count: diceParts.d6Count,
                        d6Less1DieCount: diceParts.d6Less1DieCount,
                        halfDieCount: diceParts.halfDieCount,
                        constant: diceParts.constant,
                    };
                }

                const negativeOneInDiceParts = Object.freeze({
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: -1,
                });

                const zeroInDiceParts = Object.freeze({
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: 0,
                });
                const plusOneInDiceParts = Object.freeze({
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: 1,
                });
                const halfDieInDiceParts = Object.freeze({
                    d6Count: 0,
                    d6Less1DieCount: 0,
                    halfDieCount: 1,
                    constant: 0,
                });
                const oneDieInDiceParts = Object.freeze({
                    d6Count: 1,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: 0,
                });
                const oneAndAHalfDiceInDiceParts = Object.freeze({
                    d6Count: 1,
                    d6Less1DieCount: 0,
                    halfDieCount: 1,
                    constant: 0,
                });
                const twoDiceInDiceParts = Object.freeze({
                    d6Count: 2,
                    d6Less1DieCount: 0,
                    halfDieCount: 0,
                    constant: 0,
                });

                describe("DCs for varied attacks", function () {
                    const rkaContent = `
                        <POWER XMLID="RKA" ID="1735146922179" BASECOST="0.0" LEVELS="1" ALIAS="Killing Attack - Ranged" POSITION="17" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="1d6 15AP/die power" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                        </POWER>
                    `;
                    const egoAttackContent = `
                        <POWER XMLID="EGOATTACK" ID="1735146892858" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="1d6 10AP/die power" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                        </POWER>
                    `;
                    const normalContent = `
                        <POWER XMLID="ENERGYBLAST" ID="1735151359642" BASECOST="0.0" LEVELS="1" ALIAS="Energy Blast" POSITION="16" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="ED" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                            <NOTES />
                        </POWER>
                    `;
                    let killingItem;
                    let egoAttackItem;
                    let normalItem;

                    before(async () => {
                        const actor = new HeroSystem6eActor(
                            {
                                name: "Quench Actor",
                                type: "pc",
                            },
                            {},
                        );
                        actor.system.is5e = true;
                        await actor._postUpload();

                        killingItem = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(rkaContent, actor), {
                            parent: actor,
                        });
                        await killingItem._postUpload();
                        actor.items.set(killingItem.system.XMLID, killingItem);

                        egoAttackItem = new HeroSystem6eItem(
                            HeroSystem6eItem.itemDataFromXml(egoAttackContent, actor),
                            {
                                parent: actor,
                            },
                        );
                        await egoAttackItem._postUpload();
                        actor.items.set(egoAttackItem.system.XMLID, egoAttackItem);

                        normalItem = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(normalContent, actor), {
                            parent: actor,
                        });
                        await normalItem._postUpload();
                        actor.items.set(normalItem.system.XMLID, normalItem);
                    });

                    describe("-1 DC", function () {
                        it("-1 DC Killing Attack", function () {
                            killingItem.system._advantagesDc = 0;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, -1)),
                                negativeOneInDiceParts,
                            );
                        });
                    });

                    describe("0 DC", function () {
                        it("0 DC Killing Attack", function () {
                            killingItem.system._advantagesDc = 0;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 0)),
                                zeroInDiceParts,
                            );
                        });
                    });

                    describe("1 DC", function () {
                        it("1 DC Killing Attack", function () {
                            killingItem.system._advantagesDc = 0;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Killing Attack & +1/4 advantage", function () {
                            killingItem.system._advantagesDc = 1 / 4;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 1)),
                                zeroInDiceParts,
                            );
                        });

                        it("1 DC Killing Attack & +1/2 advantage", function () {
                            killingItem.system._advantagesDc = 1 / 2;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 1)),
                                zeroInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack", function () {
                            egoAttackItem.system._advantagesDc = 0;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack & +1/4 advantage", function () {
                            egoAttackItem.system._advantagesDc = 1 / 4;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 10AP/die and a 1/4 advantage is 12.5 AP per die or 1.25 DC per die
                            // 5 AP with 12.5 AP per die = 0.4 which is more than 0.3 (the cost of a pip)
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack & +1/2 advantage", function () {
                            egoAttackItem.system._advantagesDc = 2 / 4;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 10AP/die and a 2/4 advantage is 15 AP per die or 1.5 DC per die
                            // 5 AP with 15 AP per die = 0.3333 which is more than 0.3 (the cost of a pip)
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack & +3/4 advantage", function () {
                            egoAttackItem.system._advantagesDc = 3 / 4;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Ego Attack & +1 advantage", function () {
                            egoAttackItem.system._advantagesDc = 1;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 1)),
                                zeroInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack", function () {
                            normalItem.system._advantagesDc = 0;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                oneDieInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +1/4 advantage", function () {
                            normalItem.system._advantagesDc = 1 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +1/2 advantage", function () {
                            normalItem.system._advantagesDc = 2 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +3/4 advantage", function () {
                            normalItem.system._advantagesDc = 3 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                halfDieInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +1 advantage", function () {
                            normalItem.system._advantagesDc = 1;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            // PH: 6e vol. 2 pg. 97 says "1/2d6" but calculations say otherwise:
                            // 5 AP with 5 AP/die and a 1 advantage is 10 AP per die or 2 DC per die
                            // 5 AP with 10 AP per die = 0.5 which is more than 0.4 (the cost of a pip) but
                            // less than 0.6 which is the cost of a 1/2 die.
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +1 1/4 advantage", function () {
                            normalItem.system._advantagesDc = 5 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 5 AP/die and a 1 advantage is 10 AP per die or 2 DC per die
                            // 5 AP with 10 AP per die = 0.5 which is more than 0.4 (the cost of a pip) but
                            // less than 0.6 which is the cost of a 1/2 die.
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +1 1/2 advantage", function () {
                            normalItem.system._advantagesDc = 6 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 5 AP/die and a 1 advantage is 10 AP per die or 2 DC per die
                            // 5 AP with 10 AP per die = 0.5 which is more than 0.4 (the cost of a pip) but
                            // less than 0.6 which is the cost of a 1/2 die.
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 1)),
                                plusOneInDiceParts,
                            );
                        });

                        it("1 DC Normal Attack & +2 advantage", function () {
                            normalItem.system._advantagesDc = 2;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(filterDc(calculateDicePartsFromDcForItem(normalItem, 1)), zeroInDiceParts);
                        });
                    });

                    describe("2 DC", function () {
                        it("2 DC Killing Attack", function () {
                            killingItem.system._advantagesDc = 0;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Killing Attack & +1/4 advantage", function () {
                            killingItem.system._advantagesDc = 1 / 4;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Killing Attack & +1/2 advantage", function () {
                            killingItem.system._advantagesDc = 1 / 2;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Killing Attack & +3/4 advantage", function () {
                            killingItem.system._advantagesDc = 3 / 4;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Killing Attack & +1 advantage", function () {
                            killingItem.system._advantagesDc = 1;
                            killingItem.system.activePointsDc = 15 * (1 + killingItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(killingItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack", function () {
                            egoAttackItem.system._advantagesDc = 0;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                oneDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +1/4 advantage", function () {
                            egoAttackItem.system._advantagesDc = 1 / 4;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +1/2 advantage", function () {
                            egoAttackItem.system._advantagesDc = 2 / 4;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +3/4 advantage", function () {
                            egoAttackItem.system._advantagesDc = 3 / 4;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +1 advantage", function () {
                            egoAttackItem.system._advantagesDc = 1;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Ego Attack & +1 1/4 advantage", function () {
                            egoAttackItem.system._advantagesDc = 5 / 4;
                            egoAttackItem.system.activePointsDc = 10 * (1 + egoAttackItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(egoAttackItem, 2)),
                                plusOneInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack", function () {
                            normalItem.system._advantagesDc = 0;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                twoDiceInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +1/4 advantage", function () {
                            normalItem.system._advantagesDc = 1 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                oneAndAHalfDiceInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +1/2 advantage", function () {
                            normalItem.system._advantagesDc = 2 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                oneDieInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +3/4 advantage", function () {
                            normalItem.system._advantagesDc = 3 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                oneDieInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +1 advantage", function () {
                            normalItem.system._advantagesDc = 1;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 5 AP/die and a 1 advantage is 10 AP per die or 2 DC per die
                            // 5 AP with 10 AP per die = 0.5 which is more than 0.4 (the cost of a pip) but
                            // less than 0.6 which is the cost of a 1/2 die.
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                oneDieInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +1 1/4 advantage", function () {
                            normalItem.system._advantagesDc = 5 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 5 AP/die and a 1 advantage is 10 AP per die or 2 DC per die
                            // 5 AP with 10 AP per die = 0.5 which is more than 0.4 (the cost of a pip) but
                            // less than 0.6 which is the cost of a 1/2 die.
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +1 1/2 advantage", function () {
                            normalItem.system._advantagesDc = 6 / 4;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            // PH: 6e vol. 2 pg. 97 says "0" but calculations say otherwise:
                            // 5 AP with 5 AP/die and a 1 advantage is 10 AP per die or 2 DC per die
                            // 5 AP with 10 AP per die = 0.5 which is more than 0.4 (the cost of a pip) but
                            // less than 0.6 which is the cost of a 1/2 die.
                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                halfDieInDiceParts,
                            );
                        });

                        it("2 DC Normal Attack & +2 advantage", function () {
                            normalItem.system._advantagesDc = 2;
                            normalItem.system.activePointsDc = 5 * (1 + normalItem.system._advantagesDc);

                            assert.deepEqual(
                                filterDc(calculateDicePartsFromDcForItem(normalItem, 2)),
                                halfDieInDiceParts,
                            );
                        });
                    });
                });
            });

            describe("6e - Killing Strike", function () {
                const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1723406694834" BASECOST="4.0" LEVELS="0" ALIAS="Killing Strike" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Killing Strike" OCV="-2" DCV="+0" DC="2" PHASE="1/2" EFFECT="[KILLINGDC]" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[WEAPONKILLINGDC]">
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
                        {},
                    );
                    actor.system.is5e = false;
                    await actor._postUpload();

                    item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        parent: actor,
                    });
                    item.type = "maneuver";
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("6e Killing Strike damage", function () {
                    // +2DC Killing Strike; +2DC from STR
                    assert.equal(item.system.damage, "1d6+1K");
                });

                it("6e Killing Strike description", function () {
                    assert.equal(item.system.description, "1/2 Phase, -2 OCV, +0 DCV, 1d6+1 HKA");
                });
            });

            describe("5e - Killing Strike", function () {
                const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1724519971623" BASECOST="4.0" LEVELS="0" ALIAS="Killing Strike" POSITION="0" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Killing Strike" OCV="-2" DCV="+0" DC="4" PHASE="1/2" EFFECT="[KILLINGDC]" ADDSTR="Yes" ACTIVECOST="10" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="[WEAPONKILLINGDC]">
                        <NOTES />
                    </MANEUVER>
                `;
                let previousDoubleDamageLimitSetting;
                let item;
                before(async () => {
                    previousDoubleDamageLimitSetting = await game.settings.set(HEROSYS.module, "DoubleDamageLimit");
                    await game.settings.set(HEROSYS.module, "DoubleDamageLimit", true);

                    const actor = new HeroSystem6eActor(
                        {
                            name: "Quench Actor",
                            type: "pc",
                        },
                        {},
                    );
                    actor.system.is5e = true;
                    await actor._postUpload();

                    item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        parent: actor,
                    });
                    item.type = "maneuver";
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                after(async () => {
                    await game.settings.set(HEROSYS.module, "DoubleDamageLimit", previousDoubleDamageLimitSetting);
                });

                it("5e Killing Strike damage", function () {
                    // +2DC Killing Strike (because the 4 DC is chopped in half for martial arts killing attacks); +2DC from STR
                    assert.equal(item.system.damage, "1d6+1K");
                });

                it("5e Killing Strike description", function () {
                    assert.equal(item.system.description, "1/2 Phase, -2 OCV, +0 DCV, 1d6+1 HKA");
                });
            });

            describe("5e - EGOATTACK", function () {
                const contents = `
                    <POWER XMLID="EGOATTACK" ID="1734666299193" BASECOST="0.0" LEVELS="1" ALIAS="Ego Attack" POSITION="10" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="Standard Ego Attack" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
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
                        {},
                    );
                    actor.system.is5e = true;
                    await actor._postUpload();

                    item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                        parent: actor,
                    });
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("5e EGOATTACK damage", function () {
                    assert.equal(item.system.damage, "1d6");
                });

                it("5e EGOATTACK description", function () {
                    assert.equal(item.system.description, "Ego Attack 1d6");
                });

                it("5e EGOATTACK base points", function () {
                    assert.equal(item.system.basePointsPlusAdders, 10);
                });

                it("5e EGOATTACK active points", function () {
                    assert.equal(item.system.activePointsDc, 10);
                });
            });

            describe("5e - TRANSFORM", function () {
                describe("Cosmetic TRANSFORM", function () {
                    const contents = `
                    <POWER XMLID="TRANSFORM" ID="1734827215823" BASECOST="0.0" LEVELS="2" ALIAS="Transform" POSITION="14" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="COSMETIC" OPTIONID="COSMETIC" OPTION_ALIAS="Cosmetic" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <ADDER XMLID="HEALEDBY" ID="1734827773628" BASECOST="0.0" LEVELS="0" ALIAS="Healed back by" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="METHOD" OPTIONID="METHOD" OPTION_ALIAS="" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
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
                            {},
                        );
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("5e Cosmetic TRANSFORM damage", function () {
                        assert.equal(item.system.damage, "2d6");
                    });

                    it("5e Cosmetic TRANSFORM description", function () {
                        assert.equal(item.system.description, "Cosmetic Transform 2d6 (Healed back by unknown)");
                    });

                    it("5e Cosmetic TRANSFORM base points", function () {
                        assert.equal(item.system.basePointsPlusAdders, 10);
                    });

                    it("5e Cosmetic TRANSFORM active points", function () {
                        assert.equal(item.system.activePointsDc, 10);
                    });
                });

                describe("Minor TRANSFORM", function () {
                    const contents = `
                    <POWER XMLID="TRANSFORM" ID="1734827280161" BASECOST="0.0" LEVELS="2" ALIAS="Transform" POSITION="15" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MINOR" OPTIONID="MINOR" OPTION_ALIAS="Minor" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" INPUT="people into Soylent Green" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <ADDER XMLID="HEALEDBY" ID="1734835784973" BASECOST="0.0" LEVELS="0" ALIAS="Healed back by" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="METHOD" OPTIONID="METHOD" OPTION_ALIAS="time &amp; eating a tunafish sandwich" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
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
                            {},
                        );
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("5e Minor TRANSFORM damage", function () {
                        assert.equal(item.system.damage, "2d6");
                    });

                    it("5e Minor TRANSFORM description", function () {
                        assert.equal(
                            item.system.description,
                            "Minor Transform 2d6 (people into Soylent Green; Healed back by time & eating a tunafish sandwich)",
                        );
                    });

                    it("5e Minor TRANSFORM base points", function () {
                        assert.equal(item.system.basePointsPlusAdders, 20);
                    });

                    it("5e Minor TRANSFORM active points", function () {
                        assert.equal(item.system.activePointsDc, 20);
                    });
                });

                describe("Major TRANSFORM", function () {
                    const contents = `
                    <POWER XMLID="TRANSFORM" ID="1734827193183" BASECOST="0.0" LEVELS="2" ALIAS="Transform" POSITION="13" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="MAJOR" OPTIONID="MAJOR" OPTION_ALIAS="Major" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" USESTANDARDEFFECT="No" QUANTITY="1" AFFECTS_PRIMARY="No" AFFECTS_TOTAL="Yes">
                        <NOTES />
                        <ADDER XMLID="HEALEDBY" ID="1734827757240" BASECOST="0.0" LEVELS="0" ALIAS="Healed back by" POSITION="-1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" OPTION="METHOD" OPTIONID="METHOD" OPTION_ALIAS="" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" SHOWALIAS="Yes" PRIVATE="No" REQUIRED="Yes" INCLUDEINBASE="Yes" DISPLAYINSTRING="No" GROUP="No" SELECTED="YES">
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
                            {},
                        );
                        actor.system.is5e = true;
                        await actor._postUpload();

                        item = new HeroSystem6eItem(HeroSystem6eItem.itemDataFromXml(contents, actor), {
                            parent: actor,
                        });
                        await item._postUpload();
                        actor.items.set(item.system.XMLID, item);
                    });

                    it("5e Major TRANSFORM damage", function () {
                        assert.equal(item.system.damage, "2d6");
                    });

                    it("5e Major TRANSFORM description", function () {
                        assert.equal(item.system.description, "Major Transform 2d6 (Healed back by unknown)");
                    });

                    it("5e Major TRANSFORM base points", function () {
                        assert.equal(item.system.basePointsPlusAdders, 30);
                    });

                    it("5e Major TRANSFORM active points", function () {
                        assert.equal(item.system.activePointsDc, 30);
                    });
                });
            });

            describe("6e - Martial Strike", function () {
                const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1724545320876" BASECOST="4.0" LEVELS="0" ALIAS="Martial Strike" POSITION="1" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Martial Strike" OCV="+0" DCV="+2" DC="2" PHASE="1/2" EFFECT="[NORMALDC] Strike" ADDSTR="Yes" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Weapon [WEAPONDC] Strike">
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
                        {},
                    );
                    actor.system.is5e = false;
                    await actor._postUpload();

                    item = new HeroSystem6eItem(
                        {
                            ...HeroSystem6eItem.itemDataFromXml(contents, actor),
                            type: "martialart", // TODO: Kludge to make itemDataFromXml match the uploading code.
                        },
                        {
                            parent: actor,
                        },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("6e Martial Strike damage", function () {
                    assert.equal(item.system.damage, "4d6");
                });

                it("6e Martial Strike description", function () {
                    assert.equal(item.system.description, "1/2 Phase, +0 OCV, +2 DCV, 4d6 Strike");
                });
            });

            describe("NND 6e - Choke Hold", function () {
                const contents = `
                    <MANEUVER XMLID="MANEUVER" ID="1724607722912" BASECOST="4.0" LEVELS="0" ALIAS="Choke Hold" POSITION="2" MULTIPLIER="1.0" GRAPHIC="Burst" COLOR="255 255 255" SFX="Default" SHOW_ACTIVE_COST="Yes" INCLUDE_NOTES_IN_PRINTOUT="Yes" NAME="" CATEGORY="Hand To Hand" DISPLAY="Choke Hold" OCV="-2" DCV="+0" DC="4" PHASE="1/2" EFFECT="Grab One Limb; [NNDDC]" ADDSTR="No" ACTIVECOST="20" DAMAGETYPE="0" MAXSTR="0" STRMULT="1" USEWEAPON="No" WEAPONEFFECT="Grab One Limb; [NNDDC]">
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
                        {},
                    );
                    actor.system.is5e = false;
                    await actor._postUpload();

                    item = new HeroSystem6eItem(
                        {
                            ...HeroSystem6eItem.itemDataFromXml(contents, actor),
                            type: "martialart", // TODO: Kludge to make itemDataFromXml match the uploading code.
                        },
                        {
                            parent: actor,
                        },
                    );
                    await item._postUpload();
                    actor.items.set(item.system.XMLID, item);
                });

                it("NND Choke Hold damage", function () {
                    // No strength bonus for NND maneuvers
                    assert.equal(item.system.damage, "2d6");
                });

                it("NND Choke Hold description", function () {
                    assert.equal(item.system.description, "1/2 Phase, -2 OCV, +0 DCV, Grab One Limb; 2d6 NND");
                });
            });
        },
        { displayName: "HERO: Damage Functions" },
    );
}
